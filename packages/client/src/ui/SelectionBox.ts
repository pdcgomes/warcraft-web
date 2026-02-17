/**
 * Manages the drag-select rectangle overlay.
 */
export class SelectionBox {
  private readonly element: HTMLElement;

  startX = 0;
  startY = 0;
  endX = 0;
  endY = 0;
  active = false;

  constructor() {
    this.element = document.getElementById('selection-box')!;
  }

  begin(x: number, y: number): void {
    this.startX = x;
    this.startY = y;
    this.endX = x;
    this.endY = y;
    this.active = true;
    this.element.style.display = 'block';
    this.updateElement();
  }

  move(x: number, y: number): void {
    if (!this.active) return;
    this.endX = x;
    this.endY = y;
    this.updateElement();
  }

  end(): { x: number; y: number; width: number; height: number } {
    this.active = false;
    this.element.style.display = 'none';

    const rect = this.getRect();
    return rect;
  }

  getRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: Math.min(this.startX, this.endX),
      y: Math.min(this.startY, this.endY),
      width: Math.abs(this.endX - this.startX),
      height: Math.abs(this.endY - this.startY),
    };
  }

  private updateElement(): void {
    const rect = this.getRect();
    this.element.style.left = rect.x + 'px';
    this.element.style.top = rect.y + 'px';
    this.element.style.width = rect.width + 'px';
    this.element.style.height = rect.height + 'px';
  }
}
