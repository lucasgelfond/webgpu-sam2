// This function scales the masks and removes those below the threshold value
// Note that SAM-2's inputs are 1024x1024 images and outputs are 256x256 masks
// We normalize to 1024x1024 images in previous steps, this function scales masks same size
function scaleAndProcessMasks(masks: any, threshold: number): Float32Array[] {
  const { data } = masks;

  // SAM's outputs are always 3 256x256 masks
  const numMasks = 3;
  const inputMaskSize = 256;

  // We scale up to match the canvas
  const outputMaskSize = 1024;

  const processedMasks: Float32Array[] = [];

  // For each pixel in output mask, check corresponding pixel in input mask
  // If it's above threshold, set to 1, otherwise 0
  for (let i = 0; i < numMasks; i++) {
    const mask = new Float32Array(outputMaskSize * outputMaskSize);
    for (let y = 0; y < outputMaskSize; y++) {
      for (let x = 0; x < outputMaskSize; x++) {
        const maskX = Math.floor((x * inputMaskSize) / outputMaskSize);
        const maskY = Math.floor((y * inputMaskSize) / outputMaskSize);
        const maskIndex = maskY * inputMaskSize + maskX + i * inputMaskSize * inputMaskSize;
        mask[y * outputMaskSize + x] = data[maskIndex] > threshold ? 1 : 0;
      }
    }
    processedMasks.push(mask);
  }

  return processedMasks;
}

export default scaleAndProcessMasks;
