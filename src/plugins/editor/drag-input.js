export class DragInput {
  constructor(handle, input) {
    this.input = input;
    this.handle = handle;
    this.step = parseFloat(input.step) || 1;
    this.min = input.min ? parseFloat(input.min) : Number.NEGATIVE_INFINITY;
    this.max = input.max ? parseFloat(input.max) : Number.POSITIVE_INFINITY;

    this.bindEvents();
  }

  bindEvents() {
    const startDrag = (startX, startValue, moveEvent, endEvent) => {
      this.startX = startX;
      this.startValue = startValue || 0;
      this.dragging = true;

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'e-resize';

      const onMove = (e) => {
        if (!this.dragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const deltaX = clientX - this.startX;
        let newValue = this.startValue + deltaX * this.step;

        // Проверка пределов min и max
        newValue = Math.min(Math.max(newValue, this.min), this.max);

        this.input.value = +newValue.toFixed(6);
        this.input.dispatchEvent(new Event('input', { bubbles: true }));
      };

      const onEnd = () => {
        this.dragging = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        window.removeEventListener(moveEvent, onMove);
        window.removeEventListener(endEvent, onEnd);
      };

      window.addEventListener(moveEvent, onMove);
      window.addEventListener(endEvent, onEnd);
    };

    this.handle.addEventListener('mousedown', (e) =>
      startDrag(e.clientX, parseFloat(this.input.value), 'mousemove', 'mouseup')
    );

    this.handle.addEventListener('touchstart', (e) =>
      startDrag(e.touches[0].clientX, parseFloat(this.input.value), 'touchmove', 'touchend')
    );
  }
}
