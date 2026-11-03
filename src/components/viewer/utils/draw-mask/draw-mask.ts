const maskCanvas = document.createElement('canvas');
const maskContext = maskCanvas.getContext('2d');

// Fills every pixel whose logit is above 0. `field` is size x size, matching the canvas.
function drawMask(
  context: CanvasRenderingContext2D,
  field: Float32Array,
  size: number,
  color: [number, number, number],
  alpha: number,
) {
  maskCanvas.width = size;
  maskCanvas.height = size;
  const imageData = maskContext.createImageData(size, size);
  const a = Math.round(alpha * 255);
  for (let i = 0; i < field.length; i++) {
    if (field[i] > 0) {
      imageData.data[i * 4] = color[0];
      imageData.data[i * 4 + 1] = color[1];
      imageData.data[i * 4 + 2] = color[2];
      imageData.data[i * 4 + 3] = a;
    }
  }
  maskContext.putImageData(imageData, 0, 0);
  context.drawImage(maskCanvas, 0, 0);
}

export default drawMask;
