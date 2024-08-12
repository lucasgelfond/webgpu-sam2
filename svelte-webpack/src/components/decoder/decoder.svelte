<script lang="ts">
  import { onMount } from 'svelte';
  // @ts-ignore
  import * as ONNX_WEBGPU from 'onnxruntime-web/webgpu';
  import { currentStatus } from '../../lib/current-status';
  import { encoderOutput } from '../../lib/encoder-output';
  import { inputImageData } from '../../lib/input-image-data';
  import fetchModel from '../../lib/fetch-model';
  import scaleAndProcessMasks from './utils/scale-and-process-masks';
  import drawContour from './utils/draw-contour';

  export let isUsingMobileSam: boolean = false;
  const ORIGINAL_SIZE = 1024;
  let canvas: HTMLCanvasElement;
  let maskThreshold = 2;
  let canvasSize: number;
  let scale: number;
  let offset: { x: number; y: number };

  $: modelURL = isUsingMobileSam
    ? 'https://sam2-download.b-cdn.net/models/mobilesam.decoder.quant.onnx'
    : 'https://sam2-download.b-cdn.net/sam2_hiera_small.decoder.onnx';

  $: if (canvas) {
    canvasSize = Math.min(canvas.width, canvas.height);
    scale = canvasSize / ORIGINAL_SIZE;
    offset = {
      x: (canvas.width - canvasSize) / 2,
      y: (canvas.height - canvasSize) / 2,
    };
    drawImage(canvas, $inputImageData, ORIGINAL_SIZE, canvasSize, offset);
  }

  $: $inputImageData, drawImage(canvas, $inputImageData, ORIGINAL_SIZE, canvasSize, offset);

  function prepareDecodingInputs(encoderOutputs: any, pointCoords: any, pointLabels: any) {
    const { image_embed, high_res_feats_0, high_res_feats_1 } = encoderOutputs;
    return {
      image_embed,
      high_res_feats_0,
      high_res_feats_1,
      point_coords: pointCoords,
      point_labels: pointLabels,
      mask_input: new ONNX_WEBGPU.Tensor(new Float32Array(256 * 256), [1, 1, 256, 256]),
      has_mask_input: new ONNX_WEBGPU.Tensor(new Float32Array([0]), [1]),
    };
  }

  function drawMask(
    context: CanvasRenderingContext2D,
    mask: Float32Array,
    color: [number, number, number],
    alpha: number,
    maskWidth: number,
    maskHeight: number,
    threshold: number,
    canvasSize: number,
    offset: { x: number; y: number }
  ) {
    const imageData = context.getImageData(offset.x, offset.y, canvasSize, canvasSize);
    const scaleX = canvasSize / maskWidth;
    const scaleY = canvasSize / maskHeight;

    for (let y = 0; y < maskHeight; y++) {
      for (let x = 0; x < maskWidth; x++) {
        const maskIndex = y * maskWidth + x;
        if (mask[maskIndex] > threshold) {
          const startX = Math.floor(x * scaleX);
          const startY = Math.floor(y * scaleY);
          const endX = Math.floor((x + 1) * scaleX);
          const endY = Math.floor((y + 1) * scaleY);

          for (let py = startY; py < endY; py++) {
            for (let px = startX; px < endX; px++) {
              const index = (py * canvasSize + px) * 4;
              imageData.data[index] = Math.floor(
                (1 - alpha) * imageData.data[index] + alpha * color[0],
              );
              imageData.data[index + 1] = Math.floor(
                (1 - alpha) * imageData.data[index + 1] + alpha * color[1],
              );
              imageData.data[index + 2] = Math.floor(
                (1 - alpha) * imageData.data[index + 2] + alpha * color[2],
              );
              imageData.data[index + 3] = 255;
            }
          }
        }
      }
    }
    context.putImageData(imageData, offset.x, offset.y);
  }


  async function handleClick(event: MouseEvent) {
    if (!canvas || !$inputImageData || !$encoderOutput) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - offset.x) / scale;
    const y = (event.clientY - rect.top - offset.y) / scale;

    console.log('Clicked position:', x, y);
    currentStatus.set(
      `Clicked on (${x}, ${y}). Downloading the decoder model if needed and generating masks...`,
    );

    const context = canvas.getContext('2d');
    if (!context) return;

    drawImage(canvas, $inputImageData, ORIGINAL_SIZE, canvasSize, offset);
    context.fillStyle = 'rgba(0, 0, 139, 0.7)'; // Dark blue with some transparency
    context.fillRect(x * scale + offset.x - 1, y * scale + offset.y - 1, 2, 2); // Smaller 2x2 pixel

    const inputPointCoords = new Float32Array([x, y, 0, 0]);
    const inputPointLabels = new Float32Array([1, -1]);
    const pointCoords = new ONNX_WEBGPU.Tensor(inputPointCoords, [1, 2, 2]);
    const pointLabels = new ONNX_WEBGPU.Tensor(inputPointLabels, [1, 2]);

    try {
      const decoderModel = await fetchModel(modelURL, 'decoder');
      const decodingSession = await ONNX_WEBGPU.InferenceSession.create(decoderModel, {
        executionProviders: ['webgpu'],
      });
      // @ts-ignore
      const decodingFeeds = prepareDecodingInputs($encoderOutput, pointCoords, pointLabels);
      console.log({ decodingFeeds });
      const start = Date.now();
      const results = await decodingSession.run(decodingFeeds);
      const { masks, iou_predictions } = results;
      const stop = Date.now();
      const time_taken = (stop - start) / 1000;
      currentStatus.set(`Inference completed in ${time_taken} seconds`);

      const postProcessedMasks = scaleAndProcessMasks(masks, maskThreshold / 10);

      const colors = [
        [0, 0, 139], // Dark blue
        [0, 139, 0], // Dark green
        [139, 0, 0], // Dark red
      ];

      for (let i = 0; i < postProcessedMasks.length; i++) {
        drawMask(
          context,
          postProcessedMasks[i],
          colors[i % colors.length] as [number, number, number],
          0.3,
          ORIGINAL_SIZE,
          ORIGINAL_SIZE,
          0.5,
          canvasSize,
          offset
        );
      }

      for (let i = 0; i < postProcessedMasks.length; i++) {
        drawContour(
          context,
          postProcessedMasks[i],
          canvasSize,
          canvasSize,
          0.5,
          offset
        );
      }

      console.log('Masks drawn:', postProcessedMasks.length);
    } catch (error) {
      console.error(error);
      currentStatus.set(`Error running inference: ${error}`);
    }
  }

  function drawImage(
    canvas: HTMLCanvasElement,
    inputImageData: ImageData,
    originalSize: number,
    canvasSize: number,
    offset: { x: number; y: number }
  ) {
    if (!canvas || !inputImageData) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.fillStyle = '#f0f0f0';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = originalSize;
    tempCanvas.height = originalSize;
    const tempContext = tempCanvas.getContext('2d');

    createImageBitmap(inputImageData).then((imageBitmap) => {
      tempContext.drawImage(imageBitmap, 0, 0, originalSize, originalSize);
      context.drawImage(tempCanvas, offset.x, offset.y, canvasSize, canvasSize);
    });
  }

  onMount(() => {
    if (!canvas) return;
    const resizeObserver = new ResizeObserver(() => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
    });
    resizeObserver.observe(canvas.parentElement);

    return () => {
      resizeObserver.disconnect();
    };
  });
</script>

<div class="container">
  <canvas bind:this={canvas} on:click={handleClick} />
  <div>
    <label for="threshold">Mask Threshold: </label>
    <input type="range" id="threshold" min="0" max="20" step="0.1" bind:value={maskThreshold} />
    <span>{maskThreshold}</span>
  </div>
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    padding: 20px;
    align-items: center;
    width: 100%;
    height: 80vh;
  }
  canvas {
    width: 100%;
    height: 100%;
  }
</style>
