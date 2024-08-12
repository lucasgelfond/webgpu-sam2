// This function applies smoothing to the masks, scales them, and removes those below the threshold value
// Note that SAM-2's inputs are 1024x1024 images and outputs are 256x256 masks
// We normalize to 1024x1024 images in previous steps, this function scales masks same size
function scaleAndProcessMasks(masks: any, threshold: number): Float32Array[] {
  const { data } = masks;

  // SAM's outputs are always 3 256x256 masks
  const numMasks = 3;
  const inputMaskSize = 256;
  const outputMaskSize = 1024;

  const processedMasks: Float32Array[] = [];

  for (let i = 0; i < numMasks; i++) {
    const mask = new Float32Array(inputMaskSize * inputMaskSize);
    const smoothedMask = new Float32Array(inputMaskSize * inputMaskSize);

    // Extract the mask
    for (let y = 0; y < inputMaskSize; y++) {
      for (let x = 0; x < inputMaskSize; x++) {
        const maskIndex = y * inputMaskSize + x + i * inputMaskSize * inputMaskSize;
        mask[y * inputMaskSize + x] = data[maskIndex];
      }
    }

    // Efficient smoothing pass
    const smoothingRadius = 2; // Optimized for 4 pixels around (2 in each direction)
    const jaggednessThreshold = 0.2;

    for (let y = 0; y < inputMaskSize; y++) {
      for (let x = 0; x < inputMaskSize; x++) {
        let sum = 0;
        let count = 0;
        let jaggedness = 0;

        for (let dy = -smoothingRadius; dy <= smoothingRadius; dy++) {
          for (let dx = -smoothingRadius; dx <= smoothingRadius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < inputMaskSize && ny >= 0 && ny < inputMaskSize) {
              const value = mask[ny * inputMaskSize + nx];
              sum += value;
              count++;
              if (dx !== 0 || dy !== 0) {
                jaggedness += Math.abs(mask[y * inputMaskSize + x] - value);
              }
            }
          }
        }

        const averageValue = sum / count;
        const normalizedJaggedness = jaggedness / (count - 1);

        smoothedMask[y * inputMaskSize + x] =
          normalizedJaggedness > jaggednessThreshold
            ? averageValue > 0.5
              ? 1
              : 0
            : mask[y * inputMaskSize + x];
      }
    }

    // Efficient fill enclosed areas pass
    for (let y = 1; y < inputMaskSize - 1; y++) {
      for (let x = 1; x < inputMaskSize - 1; x++) {
        if (smoothedMask[y * inputMaskSize + x] === 0) {
          const surroundingSum =
            smoothedMask[(y - 1) * inputMaskSize + x] +
            smoothedMask[(y + 1) * inputMaskSize + x] +
            smoothedMask[y * inputMaskSize + (x - 1)] +
            smoothedMask[y * inputMaskSize + (x + 1)];
          if (surroundingSum === 4) {
            smoothedMask[y * inputMaskSize + x] = 1;
          }
        }
      }
    }

    // Scale and apply threshold
    const scaledMask = new Float32Array(outputMaskSize * outputMaskSize);
    for (let y = 0; y < outputMaskSize; y++) {
      for (let x = 0; x < outputMaskSize; x++) {
        const maskX = Math.floor((x * inputMaskSize) / outputMaskSize);
        const maskY = Math.floor((y * inputMaskSize) / outputMaskSize);
        const maskIndex = maskY * inputMaskSize + maskX;
        scaledMask[y * outputMaskSize + x] = smoothedMask[maskIndex] > threshold ? 1 : 0;
      }
    }

    processedMasks.push(scaledMask);
  }

  return processedMasks;
}

export default scaleAndProcessMasks;
