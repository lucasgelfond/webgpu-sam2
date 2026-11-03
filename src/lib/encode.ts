// @ts-ignore
import * as ONNX_WEBGPU from 'onnxruntime-web/webgpu';
import { currentStatus, encoderOutput, getSession, initialImageDims, inputImageData } from 'src/lib';

const INPUT_SIZE = 1024;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

const cropCanvas = document.createElement('canvas');
cropCanvas.width = INPUT_SIZE;
cropCanvas.height = INPUT_SIZE;
const cropContext = cropCanvas.getContext('2d', { willReadFrequently: true });

// Center-crops the source to a square and scales it to SAM 2's 1024x1024 input.
export function cropToInput(source: CanvasImageSource, width: number, height: number) {
  const side = Math.min(width, height);
  cropContext.drawImage(
    source,
    (width - side) / 2,
    (height - side) / 2,
    side,
    side,
    0,
    0,
    INPUT_SIZE,
    INPUT_SIZE,
  );
  return cropContext.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
}

// Normalizes RGBA pixels into a [1, 3, 1024, 1024] tensor and runs the encoder.
export async function encodeImageData(imageData: ImageData, modelSize: string) {
  const pixels = INPUT_SIZE * INPUT_SIZE;
  const chw = new Float32Array(3 * pixels);
  for (let i = 0; i < pixels; i++) {
    for (let c = 0; c < 3; c++) {
      chw[c * pixels + i] = (imageData.data[i * 4 + c] / 255 - MEAN[c]) / STD[c];
    }
  }
  const session = await getSession({ isEncoder: true, modelSize });
  return session.run({ image: new ONNX_WEBGPU.Tensor(chw, [1, 3, INPUT_SIZE, INPUT_SIZE]) });
}

const processImage = async (
  source: CanvasImageSource,
  width: number,
  height: number,
  modelSize: string,
) => {
  currentStatus.set(`Input is ${width}x${height}px. Loading the encoder model (~28 MB).`);
  initialImageDims.set([width, height]);

  const imageData = cropToInput(source, width, height);
  inputImageData.set(imageData);

  try {
    const start = Date.now();
    const results = await encodeImageData(imageData, modelSize);
    const timeTaken = (Date.now() - start) / 1000;

    encoderOutput.set(results);
    currentStatus.set(
      `Embedding generated in ${timeTaken} seconds. Click to add a point, shift-click to exclude, or drag a box.`,
    );
  } catch (error) {
    console.error(error);
    currentStatus.set(`Error: ${error}`);
  }
};

export default processImage;
