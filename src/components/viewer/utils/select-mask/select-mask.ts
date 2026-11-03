// SAM 2 always returns three candidate masks (whole object / part / subpart).
// Keep only the one with the highest predicted IoU, as raw 256x256 logits.
function selectMask(masks: any, iouPredictions: any): Float32Array {
  const [, numMasks, height, width] = masks.dims;
  const scores = iouPredictions.data;
  let best = 0;
  for (let i = 1; i < numMasks; i++) {
    if (scores[i] > scores[best]) best = i;
  }
  const size = height * width;
  return Float32Array.from(masks.data.subarray(best * size, (best + 1) * size));
}

export default selectMask;
