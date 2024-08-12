<script lang="ts">
  import { onMount } from 'svelte';
  // @ts-ignore
  import * as ONNX_WEBGPU from 'onnxruntime-web/webgpu';
  import { currentStatus } from '../../lib/current-status';
  import { encoderOutput } from '../../lib/encoder-output'; 
  import { inputImageData } from '../../lib/input-image-data';
  import fetchModel from '../../lib/fetch-model';

  export let isUsingMobileSam: boolean = false;
  const ORIGINAL_SIZE = 1024;
  let canvasRef: HTMLCanvasElement;
  let maskThreshold = 2;
  let canvasSize: number;
  let scale: number;
  let offset: { x: number, y: number };

  $: modelURL = isUsingMobileSam
    ? "https://sam2-download.b-cdn.net/models/mobilesam.decoder.quant.onnx"
    : "https://sam2-download.b-cdn.net/sam2_hiera_small.decoder.onnx";

  $: if (canvasRef) {
    canvasSize = Math.min(canvasRef.width, canvasRef.height);
    scale = canvasSize / ORIGINAL_SIZE;
    offset = {
      x: (canvasRef.width - canvasSize) / 2,
      y: (canvasRef.height - canvasSize) / 2
    };
    drawImage();
  }

  function prepareDecodingInputs(
    encoderOutputs: any,
    pointCoords: any,
    pointLabels: any
  ) {
    const { image_embed, high_res_feats_0, high_res_feats_1 } = encoderOutputs;
    return {
      image_embed,
      high_res_feats_0,
      high_res_feats_1,
      point_coords: pointCoords,
      point_labels: pointLabels,
      mask_input: new ONNX_WEBGPU.Tensor(
        new Float32Array(256 * 256),
        [1, 1, 256, 256]
      ),
      has_mask_input: new ONNX_WEBGPU.Tensor(new Float32Array([0]), [1]),
    };
  }

  function drawContour(
    context: CanvasRenderingContext2D,
    mask: Float32Array,
    maskWidth: number,
    maskHeight: number,
    canvasWidth: number,
    canvasHeight: number,
    threshold: number
  ) {
    const scaleX = canvasWidth / maskWidth;
    const scaleY = canvasHeight / maskHeight;
    context.beginPath();
    context.strokeStyle = "white";
    context.lineWidth = 2;

    for (let y = 0; y < maskHeight; y++) {
      for (let x = 0; x < maskWidth; x++) {
        const i = y * maskWidth + x;
        if (mask[i] > threshold) {
          const hasLowerNeighbor =
            (x > 0 && mask[i - 1] <= threshold) ||
            (x < maskWidth - 1 && mask[i + 1] <= threshold) ||
            (y > 0 && mask[i - maskWidth] <= threshold) ||
            (y < maskHeight - 1 && mask[i + maskWidth] <= threshold);

          if (hasLowerNeighbor) {
            const canvasX = x * scaleX + offset.x;
            const canvasY = y * scaleY + offset.y;
            context.moveTo(canvasX, canvasY);
            context.lineTo(canvasX + scaleX, canvasY);
            context.lineTo(canvasX + scaleX, canvasY + scaleY);
            context.lineTo(canvasX, canvasY + scaleY);
            context.lineTo(canvasX, canvasY);
          }
        }
      }
    }
    context.stroke();
  }

  function drawMask(
    context: CanvasRenderingContext2D,
    mask: Float32Array,
    color: [number, number, number],
    alpha: number,
    maskWidth: number,
    maskHeight: number,
    threshold: number
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
              imageData.data[index] = Math.floor((1 - alpha) * imageData.data[index] + alpha * color[0]);
              imageData.data[index + 1] = Math.floor((1 - alpha) * imageData.data[index + 1] + alpha * color[1]);
              imageData.data[index + 2] = Math.floor((1 - alpha) * imageData.data[index + 2] + alpha * color[2]);
              imageData.data[index + 3] = 255;
            }
          }
        }
      }
    }

    context.putImageData(imageData, offset.x, offset.y);
  }

  function postProcessMasks(masks: any, threshold: number): Float32Array[] {
    const { data, dims } = masks;
    const numMasks = dims[1];
    const maskWidth = dims[2];
    const maskHeight = dims[3];
    const processedMasks: Float32Array[] = [];

    for (let i = 0; i < numMasks; i++) {
      const mask = new Float32Array(ORIGINAL_SIZE * ORIGINAL_SIZE);
      for (let y = 0; y < ORIGINAL_SIZE; y++) {
        for (let x = 0; x < ORIGINAL_SIZE; x++) {
          const maskX = Math.floor((x * maskWidth) / ORIGINAL_SIZE);
          const maskY = Math.floor((y * maskHeight) / ORIGINAL_SIZE);
          const maskIndex = (maskY * maskWidth + maskX) + (i * maskWidth * maskHeight);
          mask[y * ORIGINAL_SIZE + x] = data[maskIndex] > threshold ? 1 : 0;
        }
      }
      processedMasks.push(mask);
    }

    return processedMasks;
  }

  async function handleClick(event: MouseEvent) {
    if (!canvasRef || !$inputImageData || !$encoderOutput) return;

    const rect = canvasRef.getBoundingClientRect();
    const x = (event.clientX - rect.left - offset.x) / scale;
    const y = (event.clientY - rect.top - offset.y) / scale;

    console.log("Clicked position:", x, y);
    currentStatus.set(`Clicked on (${x}, ${y}). Downloading the decoder model if needed and generating masks...`);

    const context = canvasRef.getContext("2d");
    if (!context) return;

    drawImage();
    context.fillStyle = "rgba(0, 0, 139, 0.7)";  // Dark blue with some transparency
    context.fillRect(x * scale + offset.x - 1, y * scale + offset.y - 1, 2, 2);  // Smaller 2x2 pixel

    const inputPointCoords = new Float32Array([x, y, 0, 0]);
    const inputPointLabels = new Float32Array([1, -1]);
    const pointCoords = new ONNX_WEBGPU.Tensor(inputPointCoords, [1, 2, 2]);
    const pointLabels = new ONNX_WEBGPU.Tensor(inputPointLabels, [1, 2]);

    try {
      const decoderModel = await fetchModel(modelURL, "decoder");
      const decodingSession = await ONNX_WEBGPU.InferenceSession.create(decoderModel, {
        executionProviders: ["webgpu"],
      });
      // @ts-ignore
      const decodingFeeds = prepareDecodingInputs(
        $encoderOutput,
        pointCoords,
        pointLabels
      );
      console.log({ decodingFeeds });
      const start = Date.now();
      const results = await decodingSession.run(decodingFeeds);
      const { masks, iou_predictions } = results;
      const stop = Date.now();
      const time_taken = (stop - start) / 1000;
      currentStatus.set(`Inference completed in ${time_taken} seconds`);

      const postProcessedMasks = postProcessMasks(masks, maskThreshold / 10);

      const colors = [
        [0, 0, 139],  // Dark blue
        [0, 139, 0],  // Dark green
        [139, 0, 0],  // Dark red
      ];

      for (let i = 0; i < postProcessedMasks.length; i++) {
        drawMask(
          context,
          postProcessedMasks[i],
          colors[i % colors.length] as [number, number, number],
          0.3,
          ORIGINAL_SIZE,
          ORIGINAL_SIZE,
          0.5
        );
      }

      for (let i = 0; i < postProcessedMasks.length; i++) {
        drawContour(
          context,
          postProcessedMasks[i],
          ORIGINAL_SIZE,
          ORIGINAL_SIZE,
          canvasSize,
          canvasSize,
          0.5
        );
      }

      console.log("Masks drawn:", postProcessedMasks.length);
    } catch(error) {
      console.error(error);
      currentStatus.set(`Error running inference: ${error}`);
    }
  }

  function drawImage() {
    if (!canvasRef || !$inputImageData) return;
    const context = canvasRef.getContext("2d");
    if (!context) return;

    context.fillStyle = "#f0f0f0";
    context.fillRect(0, 0, canvasRef.width, canvasRef.height);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = ORIGINAL_SIZE;
    tempCanvas.height = ORIGINAL_SIZE;
    const tempContext = tempCanvas.getContext('2d');

    createImageBitmap($inputImageData).then(imageBitmap => {
      tempContext.drawImage(imageBitmap, 0, 0, ORIGINAL_SIZE, ORIGINAL_SIZE);
      context.drawImage(tempCanvas, offset.x, offset.y, canvasSize, canvasSize);
    });
  }

  onMount(() => {
    if (!canvasRef) return;
    const resizeObserver = new ResizeObserver(() => {
      if (canvasRef.parentElement) {
        canvasRef.width = canvasRef.parentElement.clientWidth;
        canvasRef.height = canvasRef.parentElement.clientHeight;
      }
    });
    resizeObserver.observe(canvasRef.parentElement);

    return () => {
      resizeObserver.disconnect();
    };
  });
</script>

<div class="container">
  <canvas bind:this={canvasRef} on:click={handleClick}/>
  <div>
    <label for="threshold">Mask Threshold: </label>
    <input
      type="range"
      id="threshold"
      min="0"
      max="20"
      step="0.1"
      bind:value={maskThreshold}
    />
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

export default as decoder;
