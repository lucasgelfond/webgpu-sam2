//@ts-ignore
import * as ONNX_WEBGPU from 'onnxruntime-web/webgpu';
import type { Box, Point } from '../draw-prompts';

const MASK_SIZE = 256;

// SAM prompt encoding: labels 1/0 are positive/negative points, 2/3 are box corners,
// and -1 is a padding point required when there is no box.
function prepareDecodingInputs(
  encoderOutputs: any,
  points: Point[],
  box: Box | null,
  previousMask: Float32Array | null,
) {
  const { image_embed, high_res_feats_0, high_res_feats_1 } = encoderOutputs;
  const coords = points.flatMap((point) => [point.x, point.y]);
  const labels: number[] = points.map((point) => point.label);
  if (box) {
    coords.push(
      Math.min(box.x0, box.x1),
      Math.min(box.y0, box.y1),
      Math.max(box.x0, box.x1),
      Math.max(box.y0, box.y1),
    );
    labels.push(2, 3);
  } else {
    coords.push(0, 0);
    labels.push(-1);
  }

  return {
    image_embed,
    high_res_feats_0,
    high_res_feats_1,
    point_coords: new ONNX_WEBGPU.Tensor(new Float32Array(coords), [1, labels.length, 2]),
    point_labels: new ONNX_WEBGPU.Tensor(new Float32Array(labels), [1, labels.length]),
    mask_input: new ONNX_WEBGPU.Tensor(previousMask ?? new Float32Array(MASK_SIZE * MASK_SIZE), [
      1,
      1,
      MASK_SIZE,
      MASK_SIZE,
    ]),
    has_mask_input: new ONNX_WEBGPU.Tensor(new Float32Array([previousMask ? 1 : 0]), [1]),
  };
}

export default prepareDecodingInputs;
