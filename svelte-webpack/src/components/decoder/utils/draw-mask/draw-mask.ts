function drawMask(
  context: CanvasRenderingContext2D,
  mask: Float32Array,
  color: [number, number, number],
  alpha: number,
  maskWidth: number,
  maskHeight: number,
  threshold: number,
  canvasSize: number,
  offset: { x: number; y: number },
) {
  const imageData = context.getImageData(offset.x, offset.y, canvasSize, canvasSize);
  const scaleX = canvasSize / maskWidth;
  const scaleY = canvasSize / maskHeight;

  for (let y = 0; y < maskHeight; y++) {
    for (let x = 0; x < maskWidth; x++) {
      const maskIndex = y * maskWidth + x;
      if (mask[maskIndex] > threshold) {
        const startX = Math.floor(x * scaleX);
        const startY = Math.floor(y * scaleY);
        const endX = Math.floor((x + 1) * scaleX);
        const endY = Math.floor((y + 1) * scaleY);

        for (let py = startY; py < endY; py++) {
          for (let px = startX; px < endX; px++) {
            const index = (py * canvasSize + px) * 4;
            imageData.data[index] = Math.floor(
              (1 - alpha) * imageData.data[index] + alpha * color[0],
            );
            imageData.data[index + 1] = Math.floor(
              (1 - alpha) * imageData.data[index + 1] + alpha * color[1],
            );
            imageData.data[index + 2] = Math.floor(
              (1 - alpha) * imageData.data[index + 2] + alpha * color[2],
            );
            imageData.data[index + 3] = 255;
          }
        }
      }
    }
  }
  context.putImageData(imageData, offset.x, offset.y);
}

export default drawMask;
