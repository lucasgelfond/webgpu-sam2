export type Point = { x: number; y: number; label: 0 | 1 };
export type Box = { x0: number; y0: number; x1: number; y1: number };

// Points and boxes are in the 1024x1024 model frame; `scale` maps them onto the canvas.
function drawPrompts(
  context: CanvasRenderingContext2D,
  points: Point[],
  box: Box | null,
  scale: number,
  color: string,
) {
  const lineWidth = 2 * scale;
  if (box) {
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.setLineDash([6 * scale, 4 * scale]);
    context.strokeRect(
      Math.min(box.x0, box.x1) * scale,
      Math.min(box.y0, box.y1) * scale,
      Math.abs(box.x1 - box.x0) * scale,
      Math.abs(box.y1 - box.y0) * scale,
    );
    context.setLineDash([]);
  }
  for (const point of points) {
    context.beginPath();
    context.arc(point.x * scale, point.y * scale, 5 * scale, 0, Math.PI * 2);
    // Positive points are filled; negative points are hollow.
    context.fillStyle = point.label === 1 ? color : 'white';
    context.strokeStyle = point.label === 1 ? 'white' : color;
    context.lineWidth = lineWidth;
    context.fill();
    context.stroke();
  }
}

export default drawPrompts;
