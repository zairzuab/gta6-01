// Input: keyboard + mouse state for driving, walking and shooting.
// Keys are read by code name (KeyW, Space, ...) so layouts do not matter.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.canvas = canvas;
    this._prev = new Set(); // keys held at the END of the previous frame
    this._onKeyDown = (e) => {
      if (e.code === 'Space') e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'KeyM') this.muteToggle = true;
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; }
    };
    this._onMouseUp = (e) => { if (e.button === 0) this.mouseDown = false; };
    this._onWheel = (e) => { this.wheel += Math.sign(e.deltaY); };
    this._onBlur = () => { this.keys.clear(); this.mouseDown = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('wheel', this._onWheel);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) { return this.keys.has(code); }
  // True only on the frame the key was first pressed (edge trigger).
  pressed(code) {
    if (this.keys.has(code) && !this._prev.has(code)) { this._prev.add(code); return true; }
    return false;
  }
  beginFrame() {
    // NOTE: _prev is NOT refreshed here. It holds the keys from the end of
    // the previous frame (set in endFrame), so pressed() can spot a key that
    // went down since then. Refreshing it here would make pressed() always
    // return false, because the snapshot would already contain the new key.
    this.mouseClicked = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.muteToggle = false;
  }
  endFrame() { this._prev = new Set(this.keys); }
}
