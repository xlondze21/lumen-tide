// The screenshot scenes behind ?shot=start|play|boss|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (swim toward the nearest shadow, keep the lantern
// between you and them, fire constantly, pick the first upgrade), so the
// frame is what a short game really looks like and the same seed always
// gives the same frame. The end pilot never dashes and aims badly, so it is
// caught out — as a hurried player is.
import { FIELD, LANTERN, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 34;
const BOSS_SECONDS = 150;
const END_LIMIT_SECONDS = 600;

/** Steer toward the shadow nearest the lantern, keep it at bolt range, and aim at it. */
function autopilot(state, skillful) {
  const p = state.player;
  let target = null;
  let bestScore = Infinity;
  // The boss is always the priority target; otherwise guard the lantern.
  for (const e of state.enemies) {
    if (!e.active) continue;
    if (e.kind === 'boss') { target = e; break; }
    const dLantern = Math.hypot(e.x - LANTERN.x, e.y - LANTERN.y);
    const dPlayer = Math.hypot(e.x - p.x, e.y - p.y);
    const score = dLantern * 0.7 + dPlayer * 0.3;
    if (score < bestScore) { bestScore = score; target = e; }
  }
  let mx = 0;
  let my = 0;
  let aimX = p.x;
  let aimY = p.y - 100;
  if (target) {
    const bestD = Math.hypot(target.x - p.x, target.y - p.y);
    aimX = target.x;
    aimY = target.y;
    // Skilful pilot keeps ~140 px from its prey; the careless one walks into it.
    const want = skillful ? 150 : 30;
    const d = Math.max(1, bestD);
    const toward = bestD > want ? 1 : -0.6;
    mx = ((target.x - p.x) / d) * toward;
    my = ((target.y - p.y) / d) * toward;
    // And drift back toward the lantern when it is under attack.
    const dl = Math.hypot(LANTERN.x - p.x, LANTERN.y - p.y);
    if (dl > 320) {
      mx += ((LANTERN.x - p.x) / dl) * 0.5;
      my += ((LANTERN.y - p.y) / dl) * 0.5;
    }
  } else {
    mx = (LANTERN.x - p.x) / Math.max(1, Math.hypot(LANTERN.x - p.x, LANTERN.y - p.y));
    my = (LANTERN.y - p.y) / Math.max(1, Math.hypot(LANTERN.x - p.x, LANTERN.y - p.y));
  }
  const len = Math.hypot(mx, my) || 1;
  const near = target ? Math.hypot(target.x - p.x, target.y - p.y) : Infinity;
  return { mx: mx / len, my: my / len, fire: true, dash: skillful && near < 90, aimX, aimY };
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. `boss` fast-forwards to wave 5's boss fight.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'boss' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { mx: 0, my: 0, fire: false, dash: false, aimX: FIELD.width / 2, aimY: 200 }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'boss') {
    // Clear waves 1-4 on autopilot, then fight the wave-5 boss for a while.
    for (let i = 0; i < BOSS_SECONDS / STEP; i += 1) {
      if (world.state.waveState === 'upgrade') world.applyUpgrade(0);
      const events = world.step(STEP, autopilot(world.state, true), false);
      if (events & EVENT_OVER || events & EVENT_WIN) break;
      if (world.state.wave >= 5 && world.state.bossHp > 0) {
        // Let the fight breathe: a few more seconds of boss on screen.
        for (let j = 0; j < 8 / STEP; j += 1) world.step(STEP, autopilot(world.state, true), false);
        break;
      }
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const skillful = name !== 'end';
  for (let i = 0; i < limit / STEP; i += 1) {
    if (world.state.waveState === 'upgrade') world.applyUpgrade(0);
    const events = world.step(STEP, autopilot(world.state, skillful), false);
    if (events & EVENT_OVER) break;
    if (events & EVENT_WIN) break;
  }
  const over = world.state.hp === 0 || world.state.lanternHp === 0;
  if (world.state.waveState === 'upgrade') return { screen: SCREEN_UPGRADE, best: world.state.score };
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
