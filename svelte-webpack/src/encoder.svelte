<script lang="ts">
  import FileDropzone from './file-dropzone.svelte';
  import { sourceImage } from './lib/source-image';
  import { currentStatus } from './lib/current-status';
  import { encoderOutput } from './lib/encoder-output'; 
  import * as tf from '@tensorflow/tfjs';
  import * as ONNX_WEBGPU from 'onnxruntime-web/webgpu';
  import fetchModel from './lib/fetch-model';


  let canvas: HTMLCanvasElement;
  let ctx;
  let batchedTensor;
  let initialSourceImg = '';
  let modelType = 'small';
  const modelURL =
    modelType === 'small'
      ? 'https://sam2-download.b-cdn.net/sam2_hiera_small.encoder.with_runtime_opt.ort'
      : 'https://sam2-download.b-cdn.net/sam2_hiera_tiny.encoder.with_runtime_opt.ort';

  function resizeImage(img: HTMLImageElement, ctx: CanvasRenderingContext2D) {
    currentStatus.set('Resizing image...');
    const scale = Math.min(1024 / img.width, 1024 / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const x = (1024 - scaledWidth) / 2;
    const y = (1024 - scaledHeight) / 2;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 1024, 1024);
    const fadeInTime = 1000; // in ms

    let opacity = 0;
    const fadeIn = setInterval(() => {
      ctx.globalAlpha = opacity;
      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
      opacity += 0.01;
      if (opacity >= 1) {
        clearInterval(fadeIn);
        ctx.globalAlpha = 1;
      }
    }, fadeInTime/100);
    return ctx.getImageData(0, 0, 1024, 1024);
  }

  function normalizeImage(imageData: ImageData) {
    currentStatus.set('Normalizing image...');
    const rgbData = [];

    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    for (let i = 0; i < imageData.data.length; i += 4) {
      for (let j = 0; j < 3; j++) {
        const pixelValue = imageData.data[i + j] / 255.0;
        const normalizedValue = (pixelValue - mean[j]) / std[j];
        rgbData.push(normalizedValue);
      }
    }

    return rgbData;
  }


  async function runInference(model: ArrayBuffer, batchedTensor: tf.Tensor3D) {
    const session = await ONNX_WEBGPU.InferenceSession.create(model, {
        executionProviders: ["webgpu"],
        graphOptimizationLevel: "disabled",
      });
      const feeds = {
        image: new ONNX_WEBGPU.Tensor(
          batchedTensor.dataSync(),
          batchedTensor.shape
        ),
      };
      const start = Date.now();
      try {
        const results = await session.run(feeds);
        const end = Date.now();
        const time_taken = (end - start) / 1000;
        currentStatus.set(`Embedding completed in ${time_taken} seconds`);
        return results;
      }
      catch(error) {
        console.error(error);
        currentStatus.set(`Error running inference: ${error}`);
      }
  }

  // Make sure we run these steps only when the image changes
  $: if ($sourceImage !== initialSourceImg) {
    initialSourceImg = $sourceImage;
    if ($sourceImage) {
      const img = new Image();
      img.onload = async () => {
        ctx = canvas.getContext('2d');
        if (ctx) {
          const imageData = resizeImage(img, ctx);
          const rgbData = normalizeImage(imageData);
          const tensor = tf.tensor3d(rgbData, [1024, 1024, 3]);
          batchedTensor = tf.tidy(() => {
            const transposed = tf.transpose(tensor, [2, 0, 1]);
            return tf.expandDims(transposed, 0);
          });
          const model = await fetchModel(modelURL, 'encoder');
          // @ts-ignore
          const inferenceResults = await runInference(model, batchedTensor)
          encoderOutput.set(inferenceResults);
        }
      };
      img.src = $sourceImage;
    }
  }
</script>

<div class="container">
  {#if $sourceImage === ''}
    <FileDropzone />
  {:else}
    <canvas bind:this={canvas} width="1024" height="1024" style="width: 512px; height: 512px;"
    ></canvas>
  {/if}
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    padding: 20px;
    font-family: 'UniversLTStd', sans-serif;
  }


  canvas {
    max-width: 100%;
    height: auto;
  }
</style>
