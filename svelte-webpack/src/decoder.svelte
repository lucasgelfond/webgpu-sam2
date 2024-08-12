<script lang="ts">
  import { onMount } from 'svelte';
  //@ts-ignore
  import * as ONNX_WEBGPU from 'onnxruntime-web/webgpu';
  import { currentStatus } from './lib/current-status';
  import { encoderOutput } from './lib/encoder-output'; 
  import { inputImageData } from './lib/input-image-data';
  import {prepareDecodingInputs, drawMaskOutline, drawMask, postProcessMasks} from './lib/decoder-utils';
  import fetchModel from './lib/fetch-model';
  import { canvas } from './lib/canvas';

  let maskThreshold = 0.2;
  const modelURL = "https://sam2-download.b-cdn.net/sam2_hiera_small.decoder.onnx";


  const handleClick = async (event: MouseEvent) => {
    if (!$canvas || !$inputImageData || !$encoderOutput) return;

    const rect = $canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    console.log("Clicked position:", x, y);
    currentStatus.set(`Clicked on (${x}, ${y}). Generating masks...`);

    const context = $canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, $canvas.width, $canvas.height);
    context.putImageData($inputImageData, 0, 0);
    context.fillStyle = "rgba(255, 0, 0, 0.7)";  // Changed to red for better visibility
    context.fillRect(x - 2, y - 2, 4, 4);  // Slightly larger point for better visibility

    const inputPointCoords = new Float32Array([(x / $canvas.width) * 1024, (y / $canvas.height) * 1024, 0, 0]);
    const inputPointLabels = new Float32Array([1, -1]);
    const pointCoords = new ONNX_WEBGPU.Tensor(inputPointCoords, [1, 2, 2]);
    const pointLabels = new ONNX_WEBGPU.Tensor(inputPointLabels, [1, 2]);

    try {
      const decoderModel = await fetchModel(modelURL, "decoder");
      const decodingSession = await ONNX_WEBGPU.InferenceSession.create(decoderModel, {
      executionProviders: ["webgpu"],
    });
      const decodingFeeds = prepareDecodingInputs(
        $encoderOutput,
        pointCoords,
        pointLabels
      );

      const start = Date.now();
      const results = await decodingSession.run(decodingFeeds);
      const { masks, iou_predictions } = results;
      const stop = Date.now();
      const time_taken = (stop - start) / 1000;
      currentStatus.set(`Inference completed in ${time_taken} seconds`);

      const postProcessedMasks = postProcessMasks(masks,  maskThreshold);
    console.log(JSON.stringify(postProcessedMasks));

      const colors = [
        [255, 0, 0],  // Red
        [0, 255, 0],  // Green
        [0, 0, 255],  // Blue
      ];

      for (let i = 0; i < postProcessedMasks.length; i++) {
        let imageData = context.getImageData(0, 0, $canvas.width, $canvas.height);
        imageData = drawMask(
          imageData,
          postProcessedMasks[i],
          colors[i % colors.length] as [number, number, number],
          0.3,
          $canvas.width,
          $canvas.height,
          0.5
        );
        context.putImageData(imageData, 0, 0);
        drawMaskOutline(
          context,
          postProcessedMasks[i],
          $canvas.width,
          $canvas.height,
          $canvas.width,
          $canvas.height,
          0.5
        );
      }
    } catch(error) {
      console.error(error);
      currentStatus.set(`Error running inference: ${error}`);
    }
  };

  onMount(() => {
    if ($canvas) {
      $canvas.addEventListener("click", handleClick);
    }
    return () => {
      if ($canvas) {
        $canvas.removeEventListener("click", handleClick);
      }
    };
  });
</script>

<div class="container">
  <div>
    <label for="threshold">Mask Threshold: </label>
    <input
      type="range"
      id="threshold"
      min="0"
      max="1"
      step="0.01"
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
