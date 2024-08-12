<script lang="ts">
  import { onMount } from 'svelte';
  // @ts-ignore
  import * as ONNX_WEBGPU from 'onnxruntime-web/webgpu';
  import { currentStatus } from './lib/current-status';
  import { encoderOutput } from './lib/encoder-output'; 
  import { inputImageData } from './lib/input-image-data';
  import fetchModel from './lib/fetch-model';


  export let isUsingMobileSam: boolean = false;

  let canvasRef: HTMLCanvasElement;
  let maskThreshold = 2;

  $: modelURL = isUsingMobileSam
    ? "https://sam2-download.b-cdn.net/models/mobilesam.decoder.quant.onnx"
    : "https://sam2-download.b-cdn.net/sam2_hiera_small.decoder.onnx";

  $: {
    console.log('encoderOutput changed:', $encoderOutput);
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
            const canvasX = x * scaleX;
            const canvasY = y * scaleY;
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
    imageData: ImageData,
    mask: Float32Array,
    color: [number, number, number],
    alpha: number,
    maskWidth: number,
    maskHeight: number,
    threshold: number
  ) {
    const imageDataCopy = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );
    const scaleX = imageData.width / maskWidth;
    const scaleY = imageData.height / maskHeight;

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
              const index = (py * imageData.width + px) * 4;
              imageDataCopy.data[index] = Math.floor((1 - alpha) * imageData.data[index] + alpha * color[0]);
              imageDataCopy.data[index + 1] = Math.floor((1 - alpha) * imageData.data[index + 1] + alpha * color[1]);
              imageDataCopy.data[index + 2] = Math.floor((1 - alpha) * imageData.data[index + 2] + alpha * color[2]);
              imageDataCopy.data[index + 3] = 255;
            }
          }
        }
      }
    }

    return imageDataCopy;
  }

  function getMaskDimensions(masks: any) {
    return {
      maskWidth: masks.dims[2],
      maskHeight: masks.dims[3],
      numMasks: masks.dims[1],
    };
  }

  function selectMask(masks: any, maskIndex: number) {
    const maskData = masks.data;
    const maskWidth = masks.dims[2];
    const maskHeight = masks.dims[3];

    const mask = new Float32Array(maskWidth * maskHeight);
    for (let i = 0; i < maskWidth * maskHeight; i++) {
      mask[i] = maskData[i + maskIndex * maskWidth * maskHeight];
    }

    return mask;
  }

  function postProcessMasks(
    masks: any,
    originalSize: [number, number],
    threshold: number
  ): Float32Array[] {
    const [height, width] = originalSize;
    const { maskWidth, maskHeight, numMasks } = getMaskDimensions(masks);

    const processedMasks: Float32Array[] = [];

    for (let i = 0; i < numMasks; i++) {
      const mask = selectMask(masks, i);
      const processedMask = new Float32Array(height * width);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const maskX = Math.floor((x * maskWidth) / width);
          const maskY = Math.floor((y * maskHeight) / height);
          const maskIndex = maskY * maskWidth + maskX;
          processedMask[y * width + x] = mask[maskIndex] > threshold ? 1 : 0;
        }
      }

      processedMasks.push(processedMask);
    }

    return processedMasks;
  }

  async function handleClick(event: MouseEvent) {
    if (!canvasRef || !inputImageData || !encoderOutput) return;

    const rect = canvasRef.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    console.log("Clicked position:", x, y);
    currentStatus.set(`Clicked on (${x}, ${y}). Downloading the decoder model if needed and generating masks...`);

    const context = canvasRef.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvasRef.width, canvasRef.height);
    canvasRef.width = $inputImageData.width;
    canvasRef.height = $inputImageData.height;
    context.putImageData($inputImageData, 0, 0);
    context.fillStyle = "rgba(0, 0, 139, 0.7)";  // Dark blue with some transparency
    context.fillRect(x - 1, y - 1, 2, 2);  // Smaller 2x2 pixel

    const inputPointCoords = new Float32Array([(x / canvasRef.width) * 1024, (y / canvasRef.height) * 1024, 0, 0]);
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

      const originalSize: [number, number] = [canvasRef.height, canvasRef.width];
      const postProcessedMasks = postProcessMasks(masks, originalSize, maskThreshold / 10);

      const colors = [
        [0, 0, 139],  // Dark blue
        [0, 139, 0],  // Dark green
        [139, 0, 0],  // Dark red
      ];

      let combinedImageData = context.getImageData(0, 0, canvasRef.width, canvasRef.height);

      for (let i = 0; i < postProcessedMasks.length; i++) {
        combinedImageData = drawMask(
          combinedImageData,
          postProcessedMasks[i],
          colors[i % colors.length] as [number, number, number],
          0.3,
          canvasRef.width,
          canvasRef.height,
          0.5
        );
      }

      context.putImageData(combinedImageData, 0, 0);

      for (let i = 0; i < postProcessedMasks.length; i++) {
        drawContour(
          context,
          postProcessedMasks[i],
          canvasRef.width,
          canvasRef.height,
          canvasRef.width,
          canvasRef.height,
          0.5
        );
      }

      console.log("Masks drawn:", postProcessedMasks.length);
    } catch(error) {
      console.error(error);
      currentStatus.set(`Error running inference: ${error}`);
    }
  }

  onMount(() => {
    if (canvasRef && $inputImageData) {
      const context = canvasRef.getContext("2d");
      if (context) {
        context.clearRect(0, 0, canvasRef.width, canvasRef.height);
        canvasRef.width =  $inputImageData.width;
        canvasRef.height =  $inputImageData.height;
        context.putImageData( $inputImageData, 0, 0);
      }
    }
  });
</script>

<div class="container">
  <canvas bind:this={canvasRef} on:click={handleClick} />
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
  }
</style>
