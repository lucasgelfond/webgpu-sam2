// @ts-ignore
import * as ONNX_WEBGPU from "onnxruntime-web/webgpu";

function prepareDecodingInputs(
  encoderOutput: any,
    pointCoords: any,
    pointLabels: any
  ) {
    const {image_embed, high_res_feats_0, high_res_feats_1} = encoderOutput
    return {
      image_embed: new ONNX_WEBGPU.Tensor(
        new Float32Array(image_embed.data),
        image_embed.dims
      ),
      high_res_feats_0: new ONNX_WEBGPU.Tensor(
        new Float32Array(high_res_feats_0.data),
        high_res_feats_0.dims
      ),
      high_res_feats_1: new ONNX_WEBGPU.Tensor(
        new Float32Array(high_res_feats_1.data),
        high_res_feats_1.dims
      ),
      // image_embed,
      // high_res_feats_0,
      // high_res_feats_1,
      point_coords: pointCoords,
      point_labels: pointLabels,
      mask_input: new ONNX_WEBGPU.Tensor(
        new Float32Array(256 * 256),
        [1, 1, 256, 256]
      ),
      has_mask_input: new ONNX_WEBGPU.Tensor(new Float32Array([0]), [1]),
    };
  }
  
  function drawMaskOutline(
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
  
          // scale the start and end coordinates of the mask
          // masks directly from SAM 2 are 256 x 256
          const startX = Math.floor(x * scaleX);
          const startY = Math.floor(y * scaleY);
          const endX = Math.floor((x + 1) * scaleX);
          const endY = Math.floor((y + 1) * scaleY);
  
          for (let py = startY; py < endY; py++) {
            for (let px = startX; px < endX; px++) {
              const index = (py * imageData.width + px) * 4;
              imageDataCopy.data[index] = color[0];
              imageDataCopy.data[index + 1] = color[1];
              imageDataCopy.data[index + 2] = color[2];
            }
          }
        }
      }
    }
  
    // Blend the mask with the original image
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] =
        (1 - alpha) * imageData.data[i] + alpha * imageDataCopy.data[i];
      imageData.data[i + 1] =
        (1 - alpha) * imageData.data[i + 1] + alpha * imageDataCopy.data[i + 1];
      imageData.data[i + 2] =
        (1 - alpha) * imageData.data[i + 2] + alpha * imageDataCopy.data[i + 2];
    }
  
    return imageDataCopy;
  }
  
  function getMaskDimensions(masks: any) {
    return {
      maskWidth: masks.dims[2],
      maskHeight: masks.dims[3],
      numMasks: masks.dims[1],
  }
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
    threshold: number
  ): Float32Array[] {
    const [height, width] = [1024, 1024]
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

  export {prepareDecodingInputs, drawMaskOutline, drawMask, postProcessMasks}