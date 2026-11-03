<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    INPUT_SIZE,
    currentStatus,
    encode,
    MODELS,
    formatMB,
    getSession,
    loadFile,
    modelProgress,
    modelSize,
    prepareModels,
    source,
    useDemoImage,
    useWebcam,
    type Source,
  } from 'src/lib';
  import {
    drawContour,
    drawMask,
    drawPrompts,
    maskBounds,
    prepareDecodingInputs,
    selectMask,
    upsampleMask,
    type Box,
    type Point,
  } from './utils';

  const LIVE_INTERVAL_MS = 200; // webcam tracking runs at most ~5 steps per second
  const VIDEO_SAMPLE_FPS = 5; // frames per second of an uploaded video that get tracked
  const DRAG_THRESHOLD_PX = 4;
  const ACCENT: [number, number, number] = [30, 100, 255];
  const ACCENT_CSS = `rgb(${ACCENT.join(',')})`;
  const HINT = 'Click to add a point, shift-click to exclude, or drag a box.';

  let canvas: HTMLCanvasElement;
  let video: HTMLVideoElement;
  let fileInput: HTMLInputElement;
  let dragging = false;
  let loadedSource: Source | null = null;
  let loadedModelSize = '';

  // Prompts and masks live in the 1024x1024 model frame, so they survive canvas resizes.
  let embedding: any = null;
  let embeddingKey: number | null = null; // which frame `embedding` (or the pending encode) is for
  let points: Point[] = [];
  let box: Box | null = null;
  let maskLogits: Float32Array | null = null; // current selection, fed back as mask_input
  let shownLogits: Float32Array | null = null; // what is drawn, e.g. a tracked frame on playback
  let field: Float32Array | null = null; // shownLogits upsampled to canvas resolution
  let drag: { start: { x: number; y: number }; box: Box | null; negative: boolean } | null =
    null;
  let generation = 0; // bumped whenever the selection resets, so stale results are dropped

  let busy = false;
  let queue: Promise<unknown> = Promise.resolve();

  // Uploaded video: masks per sampled frame, filled by trackVideo().
  let tracked = new Map<number, Float32Array>();
  let processing = false;
  let progress = '';
  let paused = true;
  let currentTime = 0;
  let duration = 0;

  // Webcam
  let liveTracking = true;
  let fps = 0;
  let stepMs = 0;
  let lastStepStart = 0;
  let lastStepEnd = 0;
  let frameHandle: number | null = null;

  $: prepareModels($modelSize);
  // Nothing can be opened until the selected model is downloaded.
  $: ready = !!$modelProgress?.ready;
  $: progressLabel = $modelProgress?.error
    ? `Couldn't download the model: ${$modelProgress.error}`
    : `Downloading the ${MODELS.find((model) => model.value === $modelSize).label} model · ${formatMB($modelProgress?.loaded ?? 0)} of ${formatMB($modelProgress?.total ?? 0)} (cached after the first visit)`;

  $: if (video && ($source !== loadedSource || $modelSize !== loadedModelSize)) {
    loadSource($source);
  }

  function loadSource(next: Source | null) {
    loadedSource = next;
    loadedModelSize = $modelSize;
    resetSelection();
    embedding = null;
    embeddingKey = null;
    fps = 0;
    stopFrameLoop();
    video.srcObject = next?.kind === 'camera' ? next.stream : null;
    if (next?.kind === 'video') video.src = next.url;
    else video.removeAttribute('src');
    if (!next) return render();

    if (next.kind === 'image') {
      embeddingKey = 0;
      render();
      refine(true, 'Embedding the image. ');
    } else {
      frameHandle = video.requestVideoFrameCallback(onVideoFrame);
      if (next.kind === 'camera') video.play();
      currentStatus.set(
        next.kind === 'camera'
          ? 'Webcam on. Click an object (or drag a box) to start tracking it.'
          : 'Pick a frame, click the object, then press "Track video".',
      );
    }
  }

  function frameKey() {
    if ($source.kind === 'image') return 0;
    if ($source.kind === 'video') return video.currentTime;
    return performance.now(); // live webcam: every click lands on a new frame
  }

  function encodeFrame() {
    return $source.kind === 'image'
      ? encode($source.image, $source.image.width, $source.image.height, $modelSize)
      : encode(video, video.videoWidth, video.videoHeight, $modelSize);
  }

  async function decode(frameEmbedding: any, prompts: Point[], promptBox: Box | null) {
    const session = await getSession({ isEncoder: false, modelSize: $modelSize });
    // mask_input refines clicks on the same frame; across frames it drags the old shape along.
    const previous = prompts.length ? maskLogits : null;
    const feeds = prepareDecodingInputs(frameEmbedding, prompts, promptBox, previous);
    const { masks, iou_predictions } = await session.run(feeds);
    return selectMask(masks, iou_predictions);
  }

  // Inference runs one task at a time, in order.
  function exclusive<T>(task: () => Promise<T>): Promise<T | undefined> {
    const run = queue.then(async () => {
      busy = true;
      try {
        return await task();
      } catch (error) {
        console.error(error);
        currentStatus.set(`Error running inference: ${error}`);
      } finally {
        busy = false;
      }
    });
    queue = run;
    return run;
  }

  // Decodes the current prompts, encoding the current frame first if it is new.
  function refine(encodeFirst: boolean, message = '') {
    const current = generation;
    const frame = { source: loadedSource, key: embeddingKey };
    exclusive(async () => {
      if (encodeFirst) {
        currentStatus.set(`${message}Running the encoder…`);
        const start = performance.now();
        const output = await encodeFrame();
        // The embedding belongs to the frame, so keep it even if the selection was reset meanwhile.
        if (frame.source !== loadedSource || frame.key !== embeddingKey) return;
        embedding = output;
        if (!points.length && !box) {
          currentStatus.set(`Embedded in ${Math.round(performance.now() - start)} ms. ${HINT}`);
          return;
        }
      }
      if (current !== generation) return;
      const start = performance.now();
      const mask = await decode(embedding, points, box);
      if (current !== generation) return;
      setMask(mask);
      const next = $source.kind === 'video' ? ' Press "Track video" to follow it.' : '';
      currentStatus.set(`Mask in ${Math.round(performance.now() - start)} ms.${next}`);
    });
  }

  // Moves the selection onto the current frame: encode it, then prompt the decoder with the
  // previous mask's padded bounding box. Returns false if the object is lost.
  async function propagate() {
    const current = generation;
    const bounds = maskLogits && maskBounds(maskLogits, INPUT_SIZE);
    if (!bounds) {
      setMask(null);
      currentStatus.set('Lost the object. Click it again to reselect.');
      return false;
    }
    const output = await encodeFrame();
    const mask = await decode(output, [], bounds);
    if (current !== generation) return false;
    embedding = output;
    embeddingKey = frameKey();
    points = [];
    box = null;
    setMask(mask);
    return true;
  }

  function resetSelection() {
    generation++;
    points = [];
    box = null;
    tracked = new Map();
    setMask(null);
  }

  function setMask(logits: Float32Array | null) {
    maskLogits = logits;
    showMask(logits);
  }

  function showMask(logits: Float32Array | null) {
    if (logits === shownLogits && (field || !logits)) return;
    shownLogits = logits;
    field = logits && canvas ? upsampleMask(logits, canvas.width) : null;
    render();
  }

  function render() {
    const context = canvas?.getContext('2d');
    if (!context) return;
    const size = canvas.width;
    context.clearRect(0, 0, size, size);
    // Videos play in the <video> underneath; images are drawn here, center-cropped like the encoder.
    if ($source?.kind === 'image') {
      const { image } = $source;
      const side = Math.min(image.width, image.height);
      context.drawImage(
        image,
        (image.width - side) / 2,
        (image.height - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size,
      );
    }
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
      field = shownLogits && upsampleMask(shownLogits, size);
      render();
    });
    observer.observe(element);
    return { destroy: () => observer.disconnect() };
  }

  function toModelFrame(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * INPUT_SIZE,
      y: ((event.clientY - rect.top) / rect.height) * INPUT_SIZE,
    };
  }

  function handleDrop(event: DragEvent) {
    dragging = false;
    if (!ready) return;
    const file = event.dataTransfer?.files[0];
    if (file) loadFile(file);
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) loadFile(input.files[0]);
    input.value = '';
  }

  function handlePointerDown(event: PointerEvent) {
    if (!$source || processing) return;
    if ($source.kind === 'video' && !paused) video.pause();
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
    const key = frameKey();
    const newFrame = key !== embeddingKey;
    // A new frame or a new box starts a fresh selection; clicks after that refine it.
    if (newFrame || draggedBox) resetSelection();
    if (draggedBox) box = draggedBox;
    else points = [...points, { ...start, label: negative ? 0 : 1 }];
    embeddingKey = key;
    render();
    refine(newFrame);
  }

  function clearSelection() {
    processing = false;
    resetSelection();
    fps = 0;
  }

  function seek(time: number) {
    return new Promise((resolve) => {
      video.addEventListener('seeked', resolve, { once: true });
      video.currentTime = time;
    });
  }

  const sampleIndex = (time: number) => Math.round(time * VIDEO_SAMPLE_FPS);

  // Steps through the uploaded video, propagating the mask frame by frame, then plays it back.
  async function trackVideo() {
    const current = generation;
    const startTime = video.currentTime;
    const total = Math.floor((duration - startTime) * VIDEO_SAMPLE_FPS);
    processing = true;
    tracked = new Map([[sampleIndex(startTime), maskLogits]]);
    for (let i = 1; i <= total && processing && current === generation; i++) {
      progress = `${i}/${total}`;
      await seek(startTime + i / VIDEO_SAMPLE_FPS);
      if (!(await exclusive(propagate))) break;
      tracked.set(sampleIndex(video.currentTime), maskLogits);
    }
    processing = false;
    if (current !== generation) return;
    await seek(startTime);
    currentStatus.set(`Tracked ${tracked.size} frames. Press play.`);
    video.play();
  }

  function onVideoFrame() {
    frameHandle = video.requestVideoFrameCallback(onVideoFrame);
    if ($source?.kind === 'camera') {
      const now = performance.now();
      if (liveTracking && maskLogits && !busy && now - lastStepStart >= LIVE_INTERVAL_MS) {
        liveStep(now);
      }
    } else if (!processing) {
      // Playback or scrubbing: show the tracked mask for this frame, or the selection on its own frame.
      const mask = tracked.size
        ? tracked.get(sampleIndex(video.currentTime))
        : video.currentTime === embeddingKey && maskLogits;
      showMask(mask || null);
    }
  }

  async function liveStep(start: number) {
    lastStepStart = start;
    await exclusive(propagate);
    const end = performance.now();
    stepMs = end - start;
    if (lastStepEnd) fps = 1000 / (end - lastStepEnd);
    lastStepEnd = end;
  }

  function stopFrameLoop() {
    if (frameHandle !== null) video?.cancelVideoFrameCallback(frameHandle);
    frameHandle = null;
  }

  onDestroy(stopFrameLoop);
</script>

<!-- The whole page accepts drops, like exiftool-web. -->
<svelte:window
  on:dragover|preventDefault={() => (dragging = true)}
  on:dragleave={(event) => {
    if (!event.relatedTarget) dragging = false;
  }}
  on:drop|preventDefault={handleDrop}
/>

<input type="file" accept="image/*,video/*" hidden bind:this={fileInput} on:change={handleFileSelect} />

<div class="viewer">
  <div class="toolbar">
    <label>
      Model
      <select bind:value={$modelSize}>
        {#each MODELS as model}
          <option value={model.value}>
            {model.label} · {formatMB(model.bytes)}{model.note ? ` (${model.note})` : ''}
          </option>
        {/each}
      </select>
    </label>
    {#if $source}
      {#if !ready}
        <span class="meta">{progressLabel}</span>
      {/if}
      <button on:click={() => fileInput.click()} disabled={!ready}>Open file</button>
      {#if $source.kind !== 'camera'}
        <button on:click={useWebcam} disabled={!ready}>Use webcam</button>
      {/if}
    {/if}
  </div>

  <div class="stage" class:empty={!$source} class:dragging use:observeSize>
    <!-- svelte-ignore a11y-media-has-caption -->
    <video
      bind:this={video}
      bind:paused
      bind:currentTime
      bind:duration
      muted
      playsinline
      hidden={!$source || $source.kind === 'image'}
    />
    <canvas
      bind:this={canvas}
      hidden={!$source}
      on:pointerdown={handlePointerDown}
      on:pointermove={handlePointerMove}
      on:pointerup={handlePointerUp}
      on:pointercancel={() => (drag = null)}
      style:cursor={processing ? 'progress' : 'crosshair'}
    />
    {#if !$source}
      <!-- Clicking anywhere opens the picker; keyboard users get the "Choose a file" button. -->
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <div class="dropzone" class:disabled={!ready} on:click={() => ready && fileInput.click()}>
        {#if ready}
          <span>Drop an image or video here</span>
        {:else}
          <span>{progressLabel}</span>
          <progress max={$modelProgress?.total} value={$modelProgress?.loaded} />
        {/if}
        <div class="actions">
          <button on:click|stopPropagation={() => fileInput.click()} disabled={!ready}>
            Choose a file
          </button>
          <button on:click|stopPropagation={useWebcam} disabled={!ready}>Use webcam</button>
          <button on:click|stopPropagation={useDemoImage} disabled={!ready}>
            Try the demo image
          </button>
        </div>
      </div>
    {:else if dragging && ready}
      <div class="drop-overlay">Drop to replace</div>
    {/if}
  </div>

  {#if $source}
    <div class="controls">
      {#if $source.kind === 'video'}
        <button on:click={() => (paused ? video.play() : video.pause())} disabled={processing}>
          {paused ? 'Play' : 'Pause'}
        </button>
        <input
          class="scrubber"
          type="range"
          min="0"
          max={duration || 0}
          step="any"
          bind:value={currentTime}
          disabled={processing}
          aria-label="Seek"
        />
        {#if processing}
          <span class="meta">{progress}</span>
          <button on:click={() => (processing = false)}>Stop</button>
        {:else}
          <button on:click={trackVideo} disabled={!maskLogits}>Track video</button>
        {/if}
      {:else if $source.kind === 'camera'}
        <label class="toggle"><input type="checkbox" bind:checked={liveTracking} /> Track</label>
        <span class="meta">
          {liveTracking && maskLogits ? `${fps.toFixed(1)} fps · ${Math.round(stepMs)} ms/step` : ''}
        </span>
      {:else}
        <span class="meta">{HINT}</span>
      {/if}
      <button on:click={clearSelection} disabled={!maskLogits && !points.length && !box}>
        Clear
      </button>
    </div>
  {/if}
</div>

<style>
  .viewer {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .toolbar label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-right: auto;
    font-weight: 500;
  }
  .stage {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    background: var(--surface);
  }
  .stage.empty {
    aspect-ratio: 3 / 2;
    background: none;
    border: 2px dashed var(--border);
    box-sizing: border-box;
    transition: border-color 150ms ease-out, background-color 150ms ease-out;
  }
  .stage.empty:hover:has(.dropzone:not(.disabled)),
  .stage.empty.dragging:has(.dropzone:not(.disabled)) {
    border-color: var(--accent);
    background: var(--accent-wash);
  }
  .dropzone,
  .drop-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: var(--muted);
  }
  .dropzone {
    cursor: pointer;
  }
  .dropzone.disabled {
    cursor: default;
  }
  progress {
    width: min(320px, 60%);
    height: 4px;
    appearance: none;
    border: none;
    border-radius: 2px;
    background: var(--border);
    overflow: hidden;
  }
  progress::-webkit-progress-bar {
    background: var(--border);
  }
  progress::-webkit-progress-value {
    background: var(--accent);
    transition: width 150ms linear;
  }
  progress::-moz-progress-bar {
    background: var(--accent);
  }
  .drop-overlay {
    pointer-events: none;
    color: white;
    font-weight: 500;
    background: rgba(30, 100, 255, 0.5);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
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
  [hidden] {
    display: none;
  }
  canvas {
    touch-action: none;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
  }
  .scrubber {
    flex: 1;
    accent-color: var(--accent);
  }
  .meta {
    flex: 1;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .scrubber + .meta {
    flex: 0;
    white-space: nowrap;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 4px;
  }
</style>
