// Traces the 0-level set of `field` (size x size logits) with marching squares,
// interpolating each crossing so the outline is smooth at display resolution.
function drawContour(context: CanvasRenderingContext2D, field: Float32Array, size: number) {
  const crossing = (p: number, q: number) => p / (p - q);

  context.beginPath();
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const i = y * size + x;
      const a = field[i];
      const b = field[i + 1];
      const c = field[i + size + 1];
      const d = field[i + size];
      const code = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (c > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
      if (code === 0 || code === 15) continue;

      // Sample centers sit at pixel + 0.5.
      const px = x + 0.5;
      const py = y + 0.5;
      const top = (): [number, number] => [px + crossing(a, b), py];
      const right = (): [number, number] => [px + 1, py + crossing(b, c)];
      const bottom = (): [number, number] => [px + crossing(d, c), py + 1];
      const left = (): [number, number] => [px, py + crossing(a, d)];
      const segment = (from: [number, number], to: [number, number]) => {
        context.moveTo(from[0], from[1]);
        context.lineTo(to[0], to[1]);
      };
      const centerInside = a + b + c + d > 0;

      switch (code) {
        case 1:
        case 14:
          segment(left(), bottom());
          break;
        case 2:
        case 13:
          segment(bottom(), right());
          break;
        case 3:
        case 12:
          segment(left(), right());
          break;
        case 4:
        case 11:
          segment(top(), right());
          break;
        case 6:
        case 9:
          segment(top(), bottom());
          break;
        case 7:
        case 8:
          segment(left(), top());
          break;
        case 5: // b and d inside
          if (centerInside) {
            segment(left(), top());
            segment(bottom(), right());
          } else {
            segment(top(), right());
            segment(left(), bottom());
          }
          break;
        case 10: // a and c inside
          if (centerInside) {
            segment(top(), right());
            segment(left(), bottom());
          } else {
            segment(left(), top());
            segment(bottom(), right());
          }
          break;
      }
    }
  }
  context.strokeStyle = 'white';
  context.lineWidth = Math.max(1.5, size / 512);
  context.lineJoin = 'round';
  context.stroke();
}

export default drawContour;
