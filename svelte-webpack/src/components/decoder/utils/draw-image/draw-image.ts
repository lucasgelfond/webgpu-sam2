function drawImage(
  canvas: HTMLCanvasElement,
  inputImageData: ImageData,
  originalSize: number,
  canvasSize: number,
) {
  if (!canvas || !inputImageData) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  canvas.width = canvasSize;
  canvas.height = canvasSize;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = originalSize;
  tempCanvas.height = originalSize;
  const tempContext = tempCanvas.getContext('2d');

  createImageBitmap(inputImageData).then((imageBitmap) => {
    tempContext.drawImage(imageBitmap, 0, 0, originalSize, originalSize);
    context.drawImage(tempCanvas, 0, 0, canvasSize, canvasSize);
  });
}

export default drawImage;
