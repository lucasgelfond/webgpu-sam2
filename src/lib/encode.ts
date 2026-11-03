// @ts-ignore
import * as ONNX_WEBGPU from 'onnxruntime-web/webgpu';
import getSession from './get-session';

export const INPUT_SIZE = 1024;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

const cropCanvas = document.createElement('canvas');
cropCanvas.width = INPUT_SIZE;
cropCanvas.height = INPUT_SIZE;
const cropContext = cropCanvas.getContext('2d', { willReadFrequently: true });

// Center-crops a frame to a square, scales it to 1024x1024, normalizes it into a
// [1, 3, 1024, 1024] tensor and runs the SAM 2 encoder on it.
async function encode(frame: CanvasImageSource, width: number, height: number, modelSize: string) {
  const side = Math.min(width, height);
  cropContext.drawImage(
    frame,
    (width - side) / 2,
    (height - side) / 2,
    side,
    side,
    0,
    0,
    INPUT_SIZE,
    INPUT_SIZE,
  );
  const { data } = cropContext.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

  const pixels = INPUT_SIZE * INPUT_SIZE;
  const chw = new Float32Array(3 * pixels);
  for (let i = 0; i < pixels; i++) {
    for (let c = 0; c < 3; c++) {
      chw[c * pixels + i] = (data[i * 4 + c] / 255 - MEAN[c]) / STD[c];
    }
  }
  const session = await getSession({ isEncoder: true, modelSize });
  return session.run({
    image: new ONNX_WEBGPU.Tensor(chw, [1, 3, INPUT_SIZE, INPUT_SIZE]),
  });
}

export default encode;
