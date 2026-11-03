// Bilinearly resamples a square grid of mask logits to size x size (half-pixel centers,
// like align_corners=false). Logits stay continuous so the caller thresholds at 0.
function upsampleMask(logits: Float32Array, size: number): Float32Array {
  const inputSize = Math.sqrt(logits.length);
  const ratio = inputSize / size;
  const last = inputSize - 1;

  const x0s = new Int32Array(size);
  const x1s = new Int32Array(size);
  const wxs = new Float32Array(size);
  for (let x = 0; x < size; x++) {
    const sx = Math.min(Math.max((x + 0.5) * ratio - 0.5, 0), last);
    x0s[x] = Math.floor(sx);
    x1s[x] = Math.min(x0s[x] + 1, last);
    wxs[x] = sx - x0s[x];
  }

  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const sy = Math.min(Math.max((y + 0.5) * ratio - 0.5, 0), last);
    const row0 = Math.floor(sy) * inputSize;
    const row1 = Math.min(Math.floor(sy) + 1, last) * inputSize;
    const wy = sy - Math.floor(sy);
    for (let x = 0; x < size; x++) {
      const wx = wxs[x];
      const top = logits[row0 + x0s[x]] * (1 - wx) + logits[row0 + x1s[x]] * wx;
      const bottom = logits[row1 + x0s[x]] * (1 - wx) + logits[row1 + x1s[x]] * wx;
      out[y * size + x] = top * (1 - wy) + bottom * wy;
    }
  }
  return out;
}

export default upsampleMask;
