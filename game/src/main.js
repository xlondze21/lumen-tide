// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens:
// title, play, upgrade, paused, game over and win.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|boss|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, PLAYER, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import {
  createWorld, EVENT_BOSS, EVENT_HIT, EVENT_KILL, EVENT_LANTERN_HIT,
  EVENT_OVER, EVENT_SHARD, EVENT_WAVE_CLEAR, EVENT_WIN,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE,
  ACTION_PICK1, ACTION_PICK2, ACTION_PICK3, createInput,
} from './input.js';
import {
  createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY,
  SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let toast = '';
  let toastTimer = 0;
  let dashQueued = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`Playing. ${PLAYER.maxHp} hearts, lantern at full light.`);
  }

  function finishRun(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) audio.win();
    announce(won ? `You won! Score ${world.state.score}. Best ${best}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      toast = muted ? 'Sound off (M to turn back on)' : 'Sound on';
      toastTimer = 1.6;
    }
    if (actions & ACTION_DASH) dashQueued = true;
    if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_PICK1) { world.applyUpgrade(0); audio.upgrade(); screen = SCREEN_PLAY; announce('Upgrade taken. Next wave incoming.'); }
      else if (actions & ACTION_PICK2) { world.applyUpgrade(1); audio.upgrade(); screen = SCREEN_PLAY; announce('Upgrade taken. Next wave incoming.'); }
      else if (actions & ACTION_PICK3) { world.applyUpgrade(2); audio.upgrade(); screen = SCREEN_PLAY; announce('Upgrade taken. Next wave incoming.'); }
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { mx: 0, my: 0, fire: false, dash: false, aimX: 640, aimY: 200 }, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const move = input.move();
    const mouse = input.mouse;
    const aim = mouse.seen
      ? renderer.toScreen(0, 0) && { x: (mouse.x - renderer.toScreen(0, 0).x) / ((renderer.toScreen(1, 0).x - renderer.toScreen(0, 0).x) || 1), y: (mouse.y - renderer.toScreen(0, 0).y) / ((renderer.toScreen(0, 1).y - renderer.toScreen(0, 0).y) || 1) }
      : null;
    // Aim at the mouse; without a mouse yet, aim at the nearest shadow.
    let aimX = world.state.player.x;
    let aimY = world.state.player.y - 100;
    if (aim) { aimX = aim.x; aimY = aim.y; }
    else {
      let bestD = Infinity;
      for (const e of world.state.enemies) {
        if (!e.active) continue;
        const d = Math.hypot(e.x - world.state.player.x, e.y - world.state.player.y);
        if (d < bestD) { bestD = d; aimX = e.x; aimY = e.y; }
      }
    }
    const events = world.step(STEP, { mx: move.x, my: move.y, fire: input.firing, dash: dashQueued, aimX, aimY }, false);
    dashQueued = false;
    audio.hum(STEP);
    if (events & EVENT_BOSS) { audio.boss(); toast = 'Something huge stirs in the deep…'; toastTimer = 2.5; announce('A boss has arrived.'); }
    if (events & EVENT_WAVE_CLEAR) { screen = SCREEN_UPGRADE; audio.wave(); announce('Wave cleared. Choose an upgrade.'); }
    if (events & EVENT_WIN) finishRun(true);
    else if (events & EVENT_OVER) finishRun(false);
    else if (events & EVENT_HIT) { audio.hurt(); announce(world.state.hp === 1 ? 'Hit. 1 heart left.' : `Hit. ${world.state.hp} hearts left.`); }
    else if (events & EVENT_LANTERN_HIT) { audio.hurt(); announce(`The lantern is burning. ${world.state.lanternHp} light left.`); }
    if (events & EVENT_KILL) audio.kill();
    if (events & EVENT_SHARD) audio.shard();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += dt;
    last = now;
    handleActions();
    if (toastTimer > 0) toastTimer -= dt;
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, { toast: toastTimer > 0 ? toast : '' });
  }

  // Clicking an upgrade card picks it.
  canvas.addEventListener('click', (event) => {
    if (screen !== SCREEN_UPGRADE) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // Cards are drawn at field coords; convert the click the same way the renderer does.
    const origin = renderer.toScreen(0, 0);
    const unitX = renderer.toScreen(1, 0).x - origin.x;
    const unitY = renderer.toScreen(0, 1).y - origin.y;
    const fx = (x - origin.x) / unitX;
    const fy = (y - origin.y) / unitY;
    const cards = world.state.upgradeChoices;
    const cw = 200;
    const gap = 16;
    const total = cards.length * cw + (cards.length - 1) * gap;
    const startX = (1280 - total) / 2;
    const cardY = 720 / 2 + 30;
    for (let i = 0; i < cards.length; i += 1) {
      const cx = startX + i * (cw + gap);
      if (fx >= cx && fx <= cx + cw && fy >= cardY && fy <= cardY + 120) {
        world.applyUpgrade(i);
        audio.upgrade();
        screen = SCREEN_PLAY;
        announce('Upgrade taken. Next wave incoming.');
        break;
      }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lumen Tide. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
