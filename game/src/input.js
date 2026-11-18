// Keyboard + mouse input. Held keys give a movement vector; the mouse gives
// an aim point (converted to playfield coordinates by the caller); one-shot
// presses (start/restart, pause, dash, mute, upgrade picks 1/2/3) are queued
// as bit flags and taken once by the loop, so a press between two frames is
// never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;
export const ACTION_PICK1 = 16;
export const ACTION_PICK2 = 32;
export const ACTION_PICK3 = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const DASH = new Set(['ShiftLeft', 'ShiftRight', 'KeyK']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let firing = false;
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseSeen = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (DASH.has(event.code)) { if (!event.repeat) actions |= ACTION_DASH; }
    else if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (event.code === 'Digit1') { if (!event.repeat) actions |= ACTION_PICK1; }
    else if (event.code === 'Digit2') { if (!event.repeat) actions |= ACTION_PICK2; }
    else if (event.code === 'Digit3') { if (!event.repeat) actions |= ACTION_PICK3; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  window.addEventListener('blur', () => {
    up = down = left = right = firing = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseSeen = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseSeen = true;
    firing = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { firing = false; });

  return {
    move() {
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    get firing() { return firing || false; },
    get mouse() { return { x: mouseX, y: mouseY, seen: mouseSeen }; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
