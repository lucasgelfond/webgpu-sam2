function drawContour(
  context: CanvasRenderingContext2D,
  mask: Float32Array,
  canvasWidth: number,
  canvasHeight: number,
  offset: { x: number; y: number },
) {
  const maskHeight = 1024;
  const maskWidth = 1024;
  const scaleX = canvasWidth / maskWidth;
  const scaleY = canvasHeight / maskHeight;
  context.beginPath();
  context.strokeStyle = 'white';
  context.lineWidth = 2;

  for (let y = 0; y < maskHeight; y++) {
    for (let x = 0; x < maskWidth; x++) {
      const i = y * maskWidth + x;
      if (mask[i]) {
        // If neighbor is 0, that means this pixel is an edge
        const hasLowerNeighbor =
          (x > 0 && !mask[i - 1]) ||
          (x < maskWidth - 1 && !mask[i + 1]) ||
          (y > 0 && !mask[i - maskWidth]) ||
          (y < maskHeight - 1 && !mask[i + maskWidth]);

        if (hasLowerNeighbor) {
          // Convert the mask coordinates to canvas coordinates
          // Note: the canvas is scaled from 1024x1024 to the actual size in the DOM
          const canvasX = x * scaleX + offset.x;
          const canvasY = y * scaleY + offset.y;
          context.rect(canvasX, canvasY, 0.1, 0.1);
        }
      }
    }
  }
  context.stroke();
}

export default drawContour;
