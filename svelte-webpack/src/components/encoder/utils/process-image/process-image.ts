// @ts-ignore
import * as ONNX_WEBGPU from 'onnxruntime-web/webgpu';
import * as tf from '@tensorflow/tfjs';
import { encoderOutput } from '../../../../lib/encoder-output';
import { inputImageData } from '../../../../lib/input-image-data';
import { currentStatus } from '../../../../lib/current-status';
import fetchModel from '../../../../lib/fetch-model';

const processImage = async (img: HTMLImageElement) => {
  currentStatus.set(
    `Uploaded image is ${img.width}x${img.height}px. Loading the encoder model (~28 MB).`,
  );

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const scale = Math.min(1024 / img.width, 1024 / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const x = (1024 - scaledWidth) / 2;
    const y = (1024 - scaledHeight) / 2;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

    const imageData = ctx.getImageData(0, 0, 1024, 1024);
    // Update inputImageData to notify subscribers
    inputImageData.update((current) => imageData);

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
    // Create a tensor with shape [1024, 1024, 3]
    const tensor = tf.tensor3d(rgbData, [1024, 1024, 3]);

    // Transpose and reshape to [1, 3, 1024, 1024]
    const batchedTensor = tf.tidy(() => {
      const transposed = tf.transpose(tensor, [2, 0, 1]);
      return tf.expandDims(transposed, 0);
    });

    try {
      const model = await fetchModel({ isEncoder: true, modelSize: 'tiny' });
      const session = await ONNX_WEBGPU.InferenceSession.create(model, {
        executionProviders: ['webgpu'],
        graphOptimizationLevel: 'disabled',
      });

      const feeds = {
        image: new ONNX_WEBGPU.Tensor(batchedTensor.dataSync(), batchedTensor.shape),
      };

      const start = Date.now();
      const results = await session.run(feeds);
      const end = Date.now();
      const time_taken = (end - start) / 1000;

      console.log({ results });
      // Update encoderOutput to notify subscribers
      encoderOutput.update((current) => ({ ...current, ...results }));

      inputImageData.set(imageData);
      currentStatus.set(
        `Embedding generated in ${time_taken} seconds. Click on the image to generate a mask.`,
      );
    } catch (error) {
      console.error(error);
      currentStatus.set(`Error: ${error}`);
    } finally {
    }
  }
};

export default processImage;