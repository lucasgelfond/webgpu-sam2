<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    cameraStream,
    currentStatus,
    encoderOutput,
    getSession,
    inputImageData,
    modelSize,
  } from 'src/lib';
  import { cropToInput, encodeImageData, processImage } from '../encoder/utils';
  import {
    drawContour,
    drawMask,
    drawPrompts,
    prepareDecodingInputs,
    selectMask,
    upsampleMask,
    type Box,
    type Point,
  } from './utils';

  const INPUT_SIZE = 1024;
  const TRACK_INTERVAL_MS = 200; // ~5fps
  const DRAG_THRESHOLD_PX = 4;
  const ACCENT: [number, number, number] = [30, 100, 255];
  const ACCENT_CSS = `rgb(${ACCENT.join(',')})`;

  let canvas: HTMLCanvasElement;
  let video: HTMLVideoElement;
  let image: ImageBitmap | null = null;

  // Everything below is in the 1024x1024 model frame, so it survives canvas resizes.
  let embedding: any = null;
  let points: Point[] = [];
  let box: Box | null = null;
  let maskLogits: Float32Array | null = null;
  let field: Float32Array | null = null; // maskLogits upsampled to canvas resolution
  let drag: { start: { x: number; y: number }; box: Box | null; negative: boolean } | null =
    null;

  let busy = false;
  let pending = false;
  let pendingReencode = false;
  let generation = 0;

  let tracking = true;
  let fps = 0;
  let stepMs = 0;
  let lastStepStart = 0;
  let lastStepEnd = 0;
  let frameHandle: number | null = null;

  $: $inputImageData, loadImage($inputImageData);
  $: $encoderOutput, resetPrompts($encoderOutput);
  $: if (video) attachStream($cameraStream);

  async function loadImage(imageData: ImageData | null) {
    image = imageData ? await createImageBitmap(imageData) : null;
    render();
  }

  function resetPrompts(output: any) {
    generation++;
    embedding = output;
    points = [];
    box = null;
    setMask(null);
  }

  function setMask(logits: Float32Array | null) {
    maskLogits = logits;
    field = logits && canvas ? upsampleMask(logits, canvas.width) : null;
    render();
  }

  function render() {
    const context = canvas?.getContext('2d');
    if (!context) return;
    const size = canvas.width;
    context.clearRect(0, 0, size, size);
    // In camera mode the <video> underneath is the background.
    if (!$cameraStream && image) context.drawImage(image, 0, 0, size, size);
    if (field) {
      drawMask(context, field, size, ACCENT, 0.45);
      drawContour(context, field, size);
    }
    drawPrompts(context, points, drag?.box ?? box, size / INPUT_SIZE, ACCENT_CSS);
  }

  function observeSize(element: HTMLElement) {
    const observer = new ResizeObserver(() => {
      const size = Math.round(element.clientWidth * devicePixelRatio);
      if (!size || size === canvas.width) return;
      canvas.width = size;
      canvas.height = size;
      setMask(maskLogits);
    });
    observer.observe(element);
    return { destroy: () => observer.disconnect() };
  }

  async function decodeOnce(quiet: boolean) {
    const current = generation;
    const session = await getSession({ isEncoder: false, modelSize: $modelSize });
    const feeds = prepareDecodingInputs(embedding, points, box, maskLogits);
    const start = performance.now();
    const { masks, iou_predictions } = await session.run(feeds);
    if (current !== generation) return;
    setMask(selectMask(masks, iou_predictions));
    if (!quiet) {
      currentStatus.set(`Mask generated in ${Math.round(performance.now() - start)} ms.`);
    }
  }

  // Runs one decode at a time; requests made mid-run are coalesced into one follow-up.
  async function segment({ reencode = false, quiet = false } = {}) {
    pendingReencode ||= reencode;
    if (busy) {
      pending = true;
      return;
    }
    busy = true;
    try {
      do {
        pending = false;
        if (pendingReencode) {
          pendingReencode = false;
          const current = generation;
          const frame = cropToInput(video, video.videoWidth, video.videoHeight);
          const output = await encodeImageData(frame, $modelSize);
          if (current === generation) embedding = output;
        }
        await decodeOnce(quiet);
      } while (pending);
    } catch (error) {
      console.error(error);
      currentStatus.set(`Error running inference: ${error}`);
    } finally {
      busy = false;
    }
  }

  function toModelFrame(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * INPUT_SIZE,
      y: ((event.clientY - rect.top) / rect.height) * INPUT_SIZE,
    };
  }

  function handlePointerDown(event: PointerEvent) {
    if (!embedding) return;
    canvas.setPointerCapture(event.pointerId);
    drag = { start: toModelFrame(event), box: null, negative: event.shiftKey };
  }

  function handlePointerMove(event: PointerEvent) {
    if (!drag) return;
    const { x, y } = toModelFrame(event);
    const threshold = (DRAG_THRESHOLD_PX / canvas.clientWidth) * INPUT_SIZE;
    if (drag.box || Math.hypot(x - drag.start.x, y - drag.start.y) > threshold) {
      drag.box = { x0: drag.start.x, y0: drag.start.y, x1: x, y1: y };
      render();
    }
  }

  function handlePointerUp() {
    if (!drag) return;
    const { start, box: draggedBox, negative } = drag;
    drag = null;
    if (draggedBox) {
      // A new box starts a fresh selection; clicks after it refine.
      resetPrompts(embedding);
      box = draggedBox;
    } else {
      points = [...points, { ...start, label: negative ? 0 : 1 }];
    }
    render();
    segment();
  }

  function clearSelection() {
    resetPrompts(embedding);
    fps = 0;
    stepMs = 0;
  }

  // First press embeds the frame and waits for a prompt. Later presses re-encode the
  // current frame but keep the prompts and previous mask, so the selection re-locks.
  function segmentNow() {
    if (embedding && maskLogits) segment({ reencode: true });
    else processImage(video, video.videoWidth, video.videoHeight, $modelSize);
  }

  function attachStream(stream: MediaStream | null) {
    if (frameHandle !== null) video.cancelVideoFrameCallback(frameHandle);
    frameHandle = null;
    video.srcObject = stream;
    if (stream) frameHandle = video.requestVideoFrameCallback(onVideoFrame);
    render();
  }

  // Throttled decoder-only propagation: reuses the embedding, feeds back the previous mask.
  async function onVideoFrame() {
    frameHandle = video.requestVideoFrameCallback(onVideoFrame);
    const now = performance.now();
    if (!tracking || !maskLogits || busy || now - lastStepStart < TRACK_INTERVAL_MS) return;
    lastStepStart = now;
    await segment({ quiet: true });
    const end = performance.now();
    stepMs = end - now;
    if (lastStepEnd) fps = 1000 / (end - lastStepEnd);
    lastStepEnd = end;
  }

  onDestroy(() => {
    if (frameHandle !== null) video?.cancelVideoFrameCallback(frameHandle);
  });
</script>

{#if !$inputImageData && !$cameraStream}
  <div class="container"></div>
{:else}
  <div class="container-loaded">
    <div class="controls">
      {#if $cameraStream}
        <button on:click={segmentNow}>
          {maskLogits ? 'Re-segment' : 'Segment now'}
        </button>
        <label><input type="checkbox" bind:checked={tracking} /> Tracking</label>
        <span class="fps">
          {tracking && maskLogits ? `${fps.toFixed(1)} fps · ${Math.round(stepMs)} ms/step` : 'paused'}
        </span>
      {/if}
      <button on:click={clearSelection} disabled={!maskLogits && !points.length && !box}>
        Clear
      </button>
    </div>
    <div class="stage" use:observeSize>
      <!-- svelte-ignore a11y-media-has-caption -->
      <video bind:this={video} autoplay muted playsinline hidden={!$cameraStream} />
      <canvas
        bind:this={canvas}
        on:pointerdown={handlePointerDown}
        on:pointermove={handlePointerMove}
        on:pointerup={handlePointerUp}
        on:pointercancel={() => (drag = null)}
        on:pointerenter={() => {
          if (!embedding) {
            currentStatus.set(
              $cameraStream
                ? 'Press "Segment now" to embed the current frame.'
                : 'Clicking is disabled until encoder output is available.',
            );
          }
        }}
        style:cursor={!embedding ? 'not-allowed' : 'crosshair'}
      />
    </div>
  </div>
{/if}

<style>
  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    margin-bottom: 40px;
    gap: 8px;
  }
  .container-loaded {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    margin-bottom: 40px;
    gap: 12px;
  }
  .controls {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }
  .fps {
    font-variant-numeric: tabular-nums;
    margin-left: auto;
  }
  .stage {
    position: relative;
    width: min(100%, 60vh);
    aspect-ratio: 1;
  }
  video,
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  video {
    object-fit: cover;
  }
  canvas {
    touch-action: none;
  }
</style>
