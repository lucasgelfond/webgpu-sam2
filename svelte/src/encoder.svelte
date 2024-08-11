<script lang="ts">
  import FileDropzone from './file-dropzone.svelte';
  import { sourceImage } from '$lib/source-image';
  import { currentStatus } from '$lib/current-status';
  import * as tf from '@tensorflow/tfjs';



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
    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
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

  async function fetchModel() {
    currentStatus.set("Fetching model...")
    const response = await fetch(modelURL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const totalSize = Number(response.headers.get('Content-Length'));
    const buffer = new Uint8Array(totalSize);
    let receivedLength = 0;

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get reader for model stream');
    }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer.set(value, receivedLength);
      receivedLength += value.length;
    
      // Download progress indicator
      const percentComplete = (receivedLength / totalSize) * 100;
      currentStatus.set(`Fetching model, ${percentComplete.toFixed(2)}%`);
    }

    const blob = new Blob([buffer], { type: 'application/octet-stream' });

    const arrayBuffer = await blob.arrayBuffer();
    return arrayBuffer;
  }

//   async function runInference(model: ArrayBuffer, batchedTensor: tf.Tensor3D) {
//     const session = await WEBGPU_INFERENCE_SESSION.create(model, {
//         executionProviders: ["webgpu"],
//         graphOptimizationLevel: "disabled",
//       });
//       const feeds = {
//         image: new ONNX_WEBGPU.Tensor(
//           batchedTensor.dataSync(),
//           batchedTensor.shape
//         ),
//       };
//       const start = Date.now();
//       try {
//         const results = await session.run(feeds);
//         const end = Date.now();
//         const time_taken = (end - start) / 1000;
//         currentStatus.set(`Inference completed in ${time_taken} seconds`);
//         return results;
//       }
//       catch(error) {
//         console.error(error);
//         currentStatus.set(`Error running inference: ${error}`);
//       }
//   }

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
          const model = await fetchModel();
          // @ts-ignore
              await runInference(model, batchedTensor)


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
