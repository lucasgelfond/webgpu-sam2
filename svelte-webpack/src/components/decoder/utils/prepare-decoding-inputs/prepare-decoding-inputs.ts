//@ts-ignore
import * as ONNX_WEBGPU from 'onnxruntime-web/webgpu';

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

export default prepareDecodingInputs;
