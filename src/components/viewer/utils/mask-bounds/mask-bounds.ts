import type { Box } from '../draw-prompts';

// Bounding box of the positive logits in the 1024x1024 model frame, padded so an
// object that moved between frames still falls inside it. Null if the mask is empty.
function maskBounds(logits: Float32Array, inputSize: number, padding = 0.1): Box | null {
  const size = Math.sqrt(logits.length);
  let x0 = size;
  let y0 = size;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (logits[y * size + x] > 0) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < 0) return null;

  const scale = inputSize / size;
  const padX = (x1 - x0 + 1) * padding;
  const padY = (y1 - y0 + 1) * padding;
  return {
    x0: Math.max(0, (x0 - padX) * scale),
    y0: Math.max(0, (y0 - padY) * scale),
    x1: Math.min(inputSize, (x1 + 1 + padX) * scale),
    y1: Math.min(inputSize, (y1 + 1 + padY) * scale),
  };
}

export default maskBounds;
