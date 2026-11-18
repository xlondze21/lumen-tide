// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred. The reef
// is drawn procedurally — glowing lantern, coral silhouettes, drifting
// motes — so the game needs no image files at all.

import { FIELD, FONT, LANTERN, PALETTE, PLAYER, WIN_WAVE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 680, top: 150, line: 32, bottom: 76 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, width: 0, height: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.width = width;
    view.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function textPlain(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function toScreen(fieldX, fieldY) {
    return { x: view.x + fieldX * view.scale, y: view.y + fieldY * view.scale };
  }

  function drawReef(state) {
    // Deep water gradient.
    const grad = context.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.deep);
    grad.addColorStop(0.6, PALETTE.reef);
    grad.addColorStop(1, PALETTE.sand);
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    // Coral silhouettes along the bottom and top edges.
    context.fillStyle = 'rgba(30, 48, 96, 0.55)';
    for (let i = 0; i < 14; i += 1) {
      const x = i * 96 + 20;
      const h = 34 + ((i * 37) % 52);
      context.beginPath();
      context.moveTo(x, FIELD.height);
      context.quadraticCurveTo(x + 18, FIELD.height - h, x + 40, FIELD.height);
      context.fill();
    }
    context.fillStyle = 'rgba(22, 36, 74, 0.5)';
    for (let i = 0; i < 10; i += 1) {
      const x = i * 140 + 60;
      const h = 22 + ((i * 53) % 34);
      context.beginPath();
      context.moveTo(x, 0);
      context.quadraticCurveTo(x + 16, h, x + 36, 0);
      context.fill();
    }

    // Lantern glow — the heart of the picture.
    const flicker = 0.9 + Math.sin(state.elapsed * 3.1) * 0.06 + Math.sin(state.elapsed * 7.7) * 0.04;
    const glowR = 260 * flicker * (0.55 + (state.lanternHp / LANTERN.maxHp) * 0.45);
    const glow = context.createRadialGradient(LANTERN.x, LANTERN.y, 10, LANTERN.x, LANTERN.y, glowR);
    glow.addColorStop(0, 'rgba(255, 209, 102, 0.5)');
    glow.addColorStop(0.5, 'rgba(255, 209, 102, 0.14)');
    glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
    context.fillStyle = glow;
    context.fillRect(LANTERN.x - glowR, LANTERN.y - glowR, glowR * 2, glowR * 2);

    // Lantern: a ringed lamp post with a bright core.
    context.strokeStyle = '#3a2f10';
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(LANTERN.x, LANTERN.y + LANTERN.radius);
    context.lineTo(LANTERN.x, LANTERN.y + LANTERN.radius + 46);
    context.stroke();
    context.fillStyle = '#8a6d1f';
    context.beginPath();
    context.arc(LANTERN.x, LANTERN.y, LANTERN.radius + 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.lantern;
    context.beginPath();
    context.arc(LANTERN.x, LANTERN.y, LANTERN.radius - 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.lanternCore;
    context.beginPath();
    context.arc(LANTERN.x, LANTERN.y, (LANTERN.radius - 14) * flicker, 0, Math.PI * 2);
    context.fill();
    // Lantern HP ring.
    context.strokeStyle = 'rgba(238, 244, 255, 0.35)';
    context.lineWidth = 4;
    context.beginPath();
    context.arc(LANTERN.x, LANTERN.y, LANTERN.radius + 14, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * state.lanternHp) / LANTERN.maxHp);
    context.stroke();
  }

  function drawShards(state) {
    for (const s of state.shards) {
      if (!s.active) continue;
      const pulse = 0.7 + Math.sin(state.elapsed * 6 + s.x) * 0.3;
      context.fillStyle = PALETTE.shard;
      context.globalAlpha = pulse;
      context.save();
      context.translate(s.x, s.y);
      context.rotate(state.elapsed * 2 + s.x);
      context.fillRect(-5, -5, 10, 10);
      context.restore();
      context.globalAlpha = 1;
    }
  }

  function drawEnemies(state) {
    for (const e of state.enemies) {
      if (!e.active) continue;
      const wob = Math.sin(state.elapsed * 5 + e.wobble) * 2;
      context.fillStyle = e.kind === 'boss' ? '#ff4d6d' : e.kind === 'brute' ? '#b388ff' : e.kind === 'spitter' ? '#7ee787' : e.kind === 'splitter' ? '#f2c94c' : e.kind === 'mini' ? '#ffb454' : '#ff7a59';
      context.save();
      context.translate(e.x, e.y + wob * 0.4);
      if (e.kind === 'boss') {
        // Horned maw: big circle, two horns, glowing eye.
        context.beginPath();
        context.arc(0, 0, e.radius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#2a0a12';
        context.beginPath();
        context.moveTo(-e.radius + 6, -e.radius + 14);
        context.lineTo(-e.radius - 14, -e.radius - 16);
        context.lineTo(-e.radius + 22, -e.radius + 2);
        context.fill();
        context.beginPath();
        context.moveTo(e.radius - 6, -e.radius + 14);
        context.lineTo(e.radius + 14, -e.radius - 16);
        context.lineTo(e.radius - 22, -e.radius + 2);
        context.fill();
        context.fillStyle = '#fff';
        context.beginPath();
        context.arc(-14, -6, 7, 0, Math.PI * 2);
        context.arc(14, -6, 7, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#ff4d6d';
        context.beginPath();
        context.arc(-14, -6, 3.5, 0, Math.PI * 2);
        context.arc(14, -6, 3.5, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#2a0a12';
        context.fillRect(-20, 12, 40, 8);
      } else if (e.kind === 'brute') {
        context.beginPath();
        context.arc(0, 0, e.radius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = 'rgba(255,255,255,0.5)';
        context.lineWidth = 3;
        context.beginPath();
        context.arc(0, 0, e.radius - 7, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = '#1a0b2e';
        context.beginPath();
        context.arc(-7, -4, 4, 0, Math.PI * 2);
        context.arc(7, -4, 4, 0, Math.PI * 2);
        context.fill();
      } else {
        // Eel-like dart: triangle body with a tail.
        const ang = Math.atan2(LANTERN.y - e.y, LANTERN.x - e.x);
        context.rotate(ang);
        context.beginPath();
        context.moveTo(e.radius + 6, 0);
        context.lineTo(-e.radius, -e.radius * 0.7);
        context.lineTo(-e.radius * 0.5, 0);
        context.lineTo(-e.radius, e.radius * 0.7);
        context.closePath();
        context.fill();
        context.fillStyle = '#1a0b12';
        context.beginPath();
        context.arc(e.radius * 0.4, -3, 2.5, 0, Math.PI * 2);
        context.arc(e.radius * 0.4, 3, 2.5, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
      // HP bar for tough enemies.
      if (e.maxHp > 2 && e.hp < e.maxHp) {
        context.fillStyle = 'rgba(0,0,0,0.5)';
        context.fillRect(e.x - 22, e.y - e.radius - 12, 44, 5);
        context.fillStyle = '#ff5d73';
        context.fillRect(e.x - 22, e.y - e.radius - 12, 44 * (e.hp / e.maxHp), 5);
      }
    }
    // Enemy globs.
    for (const g of state.globs) {
      if (!g.active) continue;
      context.fillStyle = '#a5f3a5';
      context.beginPath();
      context.arc(g.x, g.y, 7, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawBullets(state) {
    for (const b of state.bullets) {
      if (!b.active) continue;
      context.strokeStyle = PALETTE.bullet;
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
      context.fillStyle = '#fff8d0';
      context.beginPath();
      context.arc(b.x, b.y, 3, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.invulnerable === 0 || Math.floor(p.invulnerable * 10) % 2 === 1) {
      // Dash trail.
      if (p.dashTime > 0) {
        context.fillStyle = 'rgba(126, 240, 255, 0.35)';
        context.beginPath();
        context.arc(p.x, p.y, PLAYER.radius + 10, 0, Math.PI * 2);
        context.fill();
      }
      // Wisp: glowing body, tail, bright core, aim tick.
      const glow = context.createRadialGradient(p.x, p.y, 2, p.x, p.y, 34);
      glow.addColorStop(0, 'rgba(126, 240, 255, 0.55)');
      glow.addColorStop(1, 'rgba(126, 240, 255, 0)');
      context.fillStyle = glow;
      context.fillRect(p.x - 34, p.y - 34, 68, 68);
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.playerCore;
      context.beginPath();
      context.arc(p.x, p.y, 6, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(238, 244, 255, 0.8)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(p.x + Math.cos(p.angle) * (PLAYER.radius + 2), p.y + Math.sin(p.angle) * (PLAYER.radius + 2));
      context.lineTo(p.x + Math.cos(p.angle) * (PLAYER.radius + 12), p.y + Math.sin(p.angle) * (PLAYER.radius + 12));
      context.stroke();
    }
    // Dash cooldown pip under the wisp.
    if (p.dashTimer > 0) {
      context.fillStyle = 'rgba(238, 244, 255, 0.3)';
      context.fillRect(p.x - 14, p.y + PLAYER.radius + 8, 28, 3);
      context.fillStyle = PALETTE.player;
      context.fillRect(p.x - 14, p.y + PLAYER.radius + 8, 28 * (1 - p.dashTimer / state.dashCooldownStat), 3);
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
  }

  function drawHud(state, best) {
    context.textBaseline = 'top';
    text(`SCORE ${state.score}`, 24, 20, 26, PALETTE.text, 'left');
    textPlain(`BEST ${best}`, 24, 52, 18, PALETTE.muted, 'left');
    text(`WAVE ${state.wave} / ${WIN_WAVE}`, FIELD.width / 2, 20, 26, PALETTE.wave, 'center');
    const waveLabel = state.waveState === 'calm' ? 'next wave soon…' : state.waveState === 'upgrade' ? 'choose an upgrade' : state.toSpawn > 0 ? `${state.toSpawn} shadows left to spawn` : 'clear the reef!';
    textPlain(waveLabel, FIELD.width / 2, 52, 18, PALETTE.muted, 'center');
    // Hearts, top right.
    for (let i = 0; i < PLAYER.maxHp; i += 1) {
      const x = FIELD.width - 24 - (PLAYER.maxHp - 1 - i) * 34;
      context.fillStyle = i < state.hp ? '#ff5d73' : 'rgba(238, 244, 255, 0.18)';
      context.beginPath();
      context.arc(x - 6, 30, 7, 0, Math.PI * 2);
      context.arc(x + 6, 30, 7, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(x - 12, 32);
      context.lineTo(x, 46);
      context.lineTo(x + 12, 32);
      context.fill();
    }
    textPlain('LANTERN', FIELD.width - 24, 62, 16, PALETTE.muted, 'right');
    context.fillStyle = 'rgba(0,0,0,0.5)';
    context.fillRect(FIELD.width - 184, 82, 160, 10);
    context.fillStyle = state.lanternHp > 6 ? PALETTE.lantern : PALETTE.danger;
    context.fillRect(FIELD.width - 184, 82, 160 * (state.lanternHp / LANTERN.maxHp), 10);
    // Boss bar.
    if (state.bossMax > 0 && state.bossHp > 0) {
      text(state.wave >= WIN_WAVE ? 'TIDE TYRANT' : 'GLOOM MAW', FIELD.width / 2, FIELD.height - 44, 20, '#ff4d6d', 'center');
      context.fillStyle = 'rgba(0,0,0,0.5)';
      context.fillRect(FIELD.width / 2 - 200, FIELD.height - 22, 400, 10);
      context.fillStyle = '#ff4d6d';
      context.fillRect(FIELD.width / 2 - 200, FIELD.height - 22, 400 * (state.bossHp / state.bossMax), 10);
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(x, y, PANEL.width, height, 16);
    context.fill();
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      textPlain(lines[i], FIELD.width / 2, y + PANEL.top + i * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.lantern, 'center');
  }

  function drawUpgrade(state) {
    drawPanel('Wave cleared!', ['The reef holds — for now. Choose one blessing:', ''], 'Press 1, 2 or 3 — or click a card');
    const cards = state.upgradeChoices;
    const cw = 200;
    const gap = 16;
    const total = cards.length * cw + (cards.length - 1) * gap;
    const startX = (FIELD.width - total) / 2;
    const y = FIELD.height / 2 + 30;
    for (let i = 0; i < cards.length; i += 1) {
      const x = startX + i * (cw + gap);
      context.fillStyle = 'rgba(255, 209, 102, 0.1)';
      context.strokeStyle = PALETTE.lantern;
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(x, y, cw, 120, 12);
      context.fill();
      context.stroke();
      text(`${i + 1}`, x + cw / 2, y + 36, 22, PALETTE.lantern, 'center');
      text(cards[i].name, x + cw / 2, y + 66, 19, PALETTE.text, 'center');
      textPlain(cards[i].desc, x + cw / 2, y + 96, 16, PALETTE.muted, 'center');
    }
  }

  function draw(state, screen, best, extra) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawReef(state);
    drawShards(state);
    drawEnemies(state);
    drawBullets(state);
    drawPlayer(state);
    drawParticles(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('LUMEN TIDE', [
        'The Last Lantern is fading. You are its wisp.',
        'Guard the lantern through 10 waves of shadow eels.',
        'WASD / arrows to swim · mouse to aim · hold click to shoot',
        'Shift to dash · P to pause · M to mute',
        '',
        `Best score ${best}`,
      ], 'Press Space or click to begin');
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_UPGRADE) drawUpgrade(state);
    else if (screen === SCREEN_PAUSED) drawPanel('Paused', ['The shadows wait for no wisp — except now.'], 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      drawPanel('The light went out', [`Wave ${state.wave} · Score ${state.score}`, `Best ${best}`], 'Press Space or click to try again');
    } else if (screen === SCREEN_WIN) {
      drawPanel('THE REEF SHINES AGAIN', [`You sank the Tide Tyrant on wave ${WIN_WAVE}.`, `Final score ${state.score} · Best ${best}`], 'Press Space or click to play again');
    }
    if (extra?.toast) {
      context.textBaseline = 'top';
      textPlain(extra.toast, FIELD.width / 2, 96, 20, PALETTE.lantern, 'center');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toScreen };
}
