// LUMEN TIDE — rules and state, with no drawing and no browser in it.
// One wisp defends the Last Lantern: enemies spawn at the reef's edge and
// swim for the lantern; the wisp shoots them down, gathers light shards,
// and picks an upgrade after every cleared wave. Wave 5 brings the Gloom
// Maw, wave 10 the Tide Tyrant — sink it and the reef is lit again.
// step() advances one fixed step and returns what happened as bit flags,
// so the caller can react (sounds, screens) without the world knowing
// about screens or sound. Pools are allocated once at boot.

import { ENEMY, FIELD, LANTERN, PLAYER, SHARD, STEP, UPGRADES, WAVE, WIN_WAVE } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_SHARD = 2;
export const EVENT_OVER = 4;
export const EVENT_WIN = 8;
export const EVENT_WAVE_CLEAR = 16;
export const EVENT_LANTERN_HIT = 32;
export const EVENT_BOSS = 64;
export const EVENT_KILL = 128;

const TAU = Math.PI * 2;
const ENEMY_POOL = 96;
const BULLET_POOL = 128;
const GLOB_POOL = 64;
const SHARD_POOL = 96;
const PARTICLE_POOL = 160;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function createWorld(random) {
  const player = { x: FIELD.width / 2, y: FIELD.height - 120, angle: -Math.PI / 2, invulnerable: 0, dashTime: 0, dashTimer: 0 };
  const enemies = [];
  for (let i = 0; i < ENEMY_POOL; i += 1) {
    enemies.push({ active: false, kind: 'dart', x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, speed: 0, radius: 10, damage: 1, score: 0, shards: 0, shootTimer: 0, attackTimer: 0, wobble: 0 });
  }
  const bullets = [];
  for (let i = 0; i < BULLET_POOL; i += 1) bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 1, pierce: 0, life: 0 });
  const globs = [];
  for (let i = 0; i < GLOB_POOL; i += 1) globs.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 1, life: 0 });
  const shards = [];
  for (let i = 0; i < SHARD_POOL; i += 1) shards.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  const particles = [];
  for (let i = 0; i < PARTICLE_POOL; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#fff', size: 3 });

  const state = {
    player, enemies, bullets, globs, shards, particles,
    score: 0, best: 0, hp: PLAYER.maxHp, lanternHp: LANTERN.maxHp,
    wave: 1, kills: 0, elapsed: 0,
    damage: PLAYER.bulletDamage, fireInterval: PLAYER.fireInterval, shots: 1,
    pierce: 0, speed: PLAYER.speed, bulletSpeed: PLAYER.bulletSpeed,
    pickupRadius: PLAYER.pickupRadius, dashCooldownStat: PLAYER.dashCooldown,
    waveState: 'calm', calmTimer: WAVE.calm, spawnTimer: 0, toSpawn: 0,
    bossSpawned: false, fireTimer: 0, upgradeChoices: [], bossHp: 0, bossMax: 0,
  };

  function burst(x, y, color, n, power) {
    let made = 0;
    for (const p of particles) {
      if (made >= n) break;
      if (p.active) continue;
      p.active = true;
      p.x = x; p.y = y;
      const a = random() * TAU;
      const v = (0.4 + random() * 0.6) * power;
      p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
      p.maxLife = 0.35 + random() * 0.4; p.life = p.maxLife;
      p.color = color; p.size = 2 + random() * 3;
      made += 1;
    }
  }

  function free(list) {
    for (const e of list) if (!e.active) return e;
    return null;
  }

  function edgePoint() {
    const side = Math.floor(random() * 4);
    const m = 30;
    if (side === 0) return { x: m + random() * (FIELD.width - 2 * m), y: -m };
    if (side === 1) return { x: m + random() * (FIELD.width - 2 * m), y: FIELD.height + m };
    if (side === 2) return { x: -m, y: m + random() * (FIELD.height - 2 * m) };
    return { x: FIELD.width + m, y: m + random() * (FIELD.height - 2 * m) };
  }

  function pickKind(wave) {
    const roll = random();
    if (wave >= 4 && roll < 0.14) return 'brute';
    if (wave >= 3 && roll < 0.32) return 'spitter';
    if (wave >= 2 && roll < 0.52) return 'splitter';
    return 'dart';
  }

  function spawnEnemy(kind) {
    const e = free(enemies);
    if (!e) return;
    const base = ENEMY[kind];
    const at = edgePoint();
    e.active = true; e.kind = kind;
    e.x = at.x; e.y = at.y;
    e.hp = base.hp + Math.floor((state.wave - 1) / 3);
    e.maxHp = e.hp;
    e.speed = base.speed * (1 + (state.wave - 1) * 0.04);
    e.radius = base.radius; e.damage = base.damage;
    e.score = base.score; e.shards = base.shards;
    e.shootTimer = 1.5 + random() * 1.5; e.attackTimer = 0;
    e.wobble = random() * TAU;
  }

  function spawnBoss() {
    spawnEnemy('boss');
    state.bossSpawned = true;
    for (const e of enemies) {
      if (e.active && e.kind === 'boss') {
        // The Tide Tyrant on wave 10 is a far tougher beast than the Gloom Maw.
        if (state.wave === WIN_WAVE) { e.hp = 100; e.maxHp = 100; }
        state.bossHp = e.hp; state.bossMax = e.maxHp;
      }
    }
  }

  function startWave(wave) {
    state.wave = wave;
    state.toSpawn = WAVE.count + WAVE.countPerWave * (wave - 1);
    state.spawnTimer = 0.4;
    state.bossSpawned = false;
    state.waveState = 'fight';
    if (wave === 5 || wave === WIN_WAVE) {
      // Boss waves bring half the usual escort — the boss is the fight.
      state.toSpawn = Math.floor(state.toSpawn / 2);
      spawnBoss();
      return EVENT_BOSS;
    }
    return 0;
  }

  function rollUpgrades() {
    const pool = UPGRADES.slice();
    const picks = [];
    for (let i = 0; i < 3 && pool.length; i += 1) {
      picks.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    }
    state.upgradeChoices = picks;
  }

  function applyUpgrade(index) {
    const choice = state.upgradeChoices[index];
    if (!choice) return;
    choice.apply(state);
    state.upgradeChoices = [];
    state.waveState = 'calm';
    state.calmTimer = WAVE.calm;
    startWave(state.wave + 1);
  }

  function dropShards(x, y, n) {
    for (let i = 0; i < n; i += 1) {
      const s = free(shards);
      if (!s) return;
      s.active = true;
      s.x = x; s.y = y;
      const a = random() * TAU;
      s.vx = Math.cos(a) * 140; s.vy = Math.sin(a) * 140;
      s.life = SHARD.life;
    }
  }

  function killEnemy(e, award) {
    e.active = false;
    state.kills += 1;
    burst(e.x, e.y, ENEMY[e.kind].color, e.kind === 'boss' ? 26 : 10, 180);
    if (award) {
      state.score += e.score;
      dropShards(e.x, e.y, e.shards);
    }
    if (e.kind === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        const m = free(enemies);
        if (!m) break;
        const base = ENEMY.mini;
        m.active = true; m.kind = 'mini';
        m.x = e.x + (random() - 0.5) * 24; m.y = e.y + (random() - 0.5) * 24;
        m.hp = base.hp; m.maxHp = base.hp; m.speed = base.speed;
        m.radius = base.radius; m.damage = base.damage; m.score = base.score; m.shards = base.shards;
        m.shootTimer = 0; m.attackTimer = 0; m.wobble = random() * TAU;
      }
    }
    if (e.kind === 'boss') { state.bossHp = 0; }
  }

  function fireBolt(aimX, aimY) {
    const n = state.shots;
    const baseAngle = Math.atan2(aimY - player.y, aimX - player.x);
    for (let i = 0; i < n; i += 1) {
      const b = free(bullets);
      if (!b) return;
      const off = (i - (n - 1) / 2) * 0.14;
      const a = baseAngle + off;
      b.active = true;
      b.x = player.x + Math.cos(a) * (PLAYER.radius + 6);
      b.y = player.y + Math.sin(a) * (PLAYER.radius + 6);
      b.vx = Math.cos(a) * state.bulletSpeed;
      b.vy = Math.sin(a) * state.bulletSpeed;
      b.damage = state.damage; b.pierce = state.pierce; b.life = 1.1;
    }
    player.angle = baseAngle;
  }

  function reset() {
    player.x = FIELD.width / 2; player.y = FIELD.height - 120;
    player.angle = -Math.PI / 2; player.invulnerable = 0; player.dashTime = 0; player.dashTimer = 0;
    for (const e of enemies) e.active = false;
    for (const b of bullets) b.active = false;
    for (const g of globs) g.active = false;
    for (const s of shards) s.active = false;
    for (const p of particles) p.active = false;
    state.score = 0; state.hp = PLAYER.maxHp; state.lanternHp = LANTERN.maxHp;
    state.wave = 1; state.kills = 0; state.elapsed = 0;
    state.damage = PLAYER.bulletDamage; state.fireInterval = PLAYER.fireInterval; state.shots = 1;
    state.pierce = 0; state.speed = PLAYER.speed; state.bulletSpeed = PLAYER.bulletSpeed;
    state.pickupRadius = PLAYER.pickupRadius; state.dashCooldownStat = PLAYER.dashCooldown;
    state.waveState = 'calm'; state.calmTimer = WAVE.calm; state.spawnTimer = 0; state.toSpawn = 0;
    state.bossSpawned = false; state.fireTimer = 0; state.upgradeChoices = [];
    state.bossHp = 0; state.bossMax = 0;
  }

  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.dashTimer > 0) player.dashTimer = Math.max(0, player.dashTimer - dt);

    // --- player movement ---
    const mx = input?.mx ?? 0;
    const my = input?.my ?? 0;
    const len = Math.hypot(mx, my) || 1;
    const nx = mx / len;
    const ny = my / len;
    const moving = mx !== 0 || my !== 0;
    if (input?.dash && player.dashTimer === 0 && moving) {
      player.dashTime = PLAYER.dashTime;
      player.dashTimer = state.dashCooldownStat;
      burst(player.x, player.y, '#7ef0ff', 8, 120);
    }
    const speed = player.dashTime > 0 ? PLAYER.dashSpeed : state.speed;
    if (player.dashTime > 0) player.dashTime = Math.max(0, player.dashTime - dt);
    if (moving) {
      player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x + nx * speed * dt));
      player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y + ny * speed * dt));
    }

    // --- firing ---
    state.fireTimer -= dt;
    if (!harmless && input?.fire && state.fireTimer <= 0 && state.waveState === 'fight') {
      fireBolt(input.aimX ?? player.x, input.aimY ?? player.y - 100);
      state.fireTimer = state.fireInterval;
    }

    // --- wave flow ---
    if (state.waveState === 'calm') {
      state.calmTimer -= dt;
      if (state.calmTimer <= 0 && !harmless) events |= startWave(state.wave);
    } else if (state.waveState === 'fight') {
      if (state.toSpawn > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          spawnEnemy(pickKind(state.wave));
          state.toSpawn -= 1;
          const interval = Math.max(WAVE.minInterval, WAVE.interval * WAVE.intervalScale ** (state.wave - 1));
          state.spawnTimer = interval * (0.7 + random() * 0.6);
        }
      } else if (!enemies.some((e) => e.active)) {
        if (state.wave === WIN_WAVE) {
          events |= EVENT_WIN;
          state.waveState = 'done';
        } else {
          // Clearing a wave rekindles the lantern a little.
          state.lanternHp = Math.min(LANTERN.maxHp, state.lanternHp + 4);
          rollUpgrades();
          state.waveState = 'upgrade';
          events |= EVENT_WAVE_CLEAR;
        }
      }
    }

    // --- title backdrop: slow darts drift in, fade at the lantern ---
    if (harmless) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) { spawnEnemy('dart'); state.spawnTimer = 1.2; }
    }

    // --- enemies ---
    for (const e of enemies) {
      if (!e.active) continue;
      e.wobble += dt * 3;
      const dPlayer = dist(e.x, e.y, player.x, player.y);
      const dLantern = dist(e.x, e.y, LANTERN.x, LANTERN.y);
      let tx;
      let ty;
      if (e.kind === 'spitter') {
        // Keep some distance, strafe around the lantern.
        const dl = Math.max(1, dLantern);
        tx = LANTERN.x + ((e.x - LANTERN.x) / dl) * 260;
        ty = LANTERN.y + ((e.y - LANTERN.y) / dl) * 260;
        e.shootTimer -= dt;
        if (!harmless && e.shootTimer <= 0 && dPlayer < 460) {
          e.shootTimer = 3.0;
          const g = free(globs);
          if (g) {
            g.active = true; g.x = e.x; g.y = e.y;
            const a = Math.atan2(player.y - e.y, player.x - e.x);
            g.vx = Math.cos(a) * 180; g.vy = Math.sin(a) * 180;
            g.damage = 1; g.life = 3;
          }
        }
      } else if (e.kind === 'boss') {
        // The boss hunts the player, then turns on the lantern.
        const huntPlayer = (Math.floor(state.elapsed / 4) % 2) === 0;
        tx = huntPlayer ? player.x : LANTERN.x;
        ty = huntPlayer ? player.y : LANTERN.y;
        e.attackTimer -= dt;
      } else {
        // Most shadows swim for the lantern; close ones snap at the wisp.
        const chasePlayer = dPlayer < 190;
        tx = chasePlayer ? player.x : LANTERN.x;
        ty = chasePlayer ? player.y : LANTERN.y;
      }
      const dx = tx - e.x;
      const dy = ty - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const wob = e.kind === 'dart' || e.kind === 'mini' ? Math.sin(e.wobble) * 0.35 : 0;
      const px = dx / d;
      const py = dy / d;
      const vx = (px + -py * wob) * e.speed;
      const vy = (py + px * wob) * e.speed;
      e.x += vx * dt;
      e.y += vy * dt;

      if (e.kind === 'boss') {
        for (const other of enemies) {
          if (other.active && other !== e && other.kind !== 'boss') { state.bossHp = e.hp; }
        }
        state.bossHp = e.hp;
      }

      if (harmless) {
        if (dLantern < LANTERN.radius + e.radius) { e.active = false; burst(e.x, e.y, '#ffd166', 6, 90); }
        continue;
      }
      // Reach the lantern: it burns, the shadow bursts (bosses stay and gnaw).
      if (dLantern < LANTERN.radius + e.radius) {
        if (e.kind === 'boss') {
          if (e.attackTimer <= 0) {
            e.attackTimer = 1.1;
            state.lanternHp -= e.damage;
            events |= EVENT_LANTERN_HIT;
            burst(LANTERN.x, LANTERN.y, '#ff5d73', 10, 160);
          }
        } else {
          e.active = false;
          state.lanternHp -= e.damage;
          events |= EVENT_LANTERN_HIT;
          burst(e.x, e.y, '#ff5d73', 8, 140);
        }
        if (state.lanternHp <= 0) { state.lanternHp = 0; events |= EVENT_OVER; }
        continue;
      }
      // Touch the wisp.
      if (dPlayer < e.radius + PLAYER.radius && player.invulnerable === 0) {
        state.hp -= e.damage;
        player.invulnerable = PLAYER.invulnerable;
        events |= EVENT_HIT;
        burst(player.x, player.y, '#ff5d73', 12, 180);
        if (e.kind !== 'boss' && e.kind !== 'brute') {
          killEnemy(e, false);
        } else {
          e.hp -= 1;
          if (e.hp <= 0) killEnemy(e, true);
        }
        if (state.hp <= 0) { state.hp = 0; events |= EVENT_OVER; }
      }
    }

    // --- player bolts ---
    for (const b of bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) { b.active = false; continue; }
      for (const e of enemies) {
        if (!e.active) continue;
        if (dist(b.x, b.y, e.x, e.y) < e.radius + 6) {
          e.hp -= b.damage;
          burst(b.x, b.y, '#ffe66d', 3, 80);
          if (b.pierce > 0) { b.pierce -= 1; }
          else { b.active = false; }
          if (e.hp <= 0) { killEnemy(e, true); events |= EVENT_KILL; }
          break;
        }
      }
      if (!b.active) continue;
      // Bolts can shoot enemy globs out of the water.
      for (const g of globs) {
        if (!g.active) continue;
        if (dist(b.x, b.y, g.x, g.y) < 13) {
          g.active = false;
          b.active = false;
          burst(g.x, g.y, '#a5f3a5', 4, 90);
          break;
        }
      }
    }

    // --- enemy globs ---
    for (const g of globs) {
      if (!g.active) continue;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.life -= dt;
      if (g.life <= 0 || g.x < -20 || g.x > FIELD.width + 20 || g.y < -20 || g.y > FIELD.height + 20) { g.active = false; continue; }
      if (dist(g.x, g.y, player.x, player.y) < PLAYER.radius + 7 && player.invulnerable === 0) {
        g.active = false;
        state.hp -= g.damage;
        player.invulnerable = PLAYER.invulnerable;
        events |= EVENT_HIT;
        if (state.hp <= 0) { state.hp = 0; events |= EVENT_OVER; }
      } else if (dist(g.x, g.y, LANTERN.x, LANTERN.y) < LANTERN.radius + 7) {
        g.active = false;
        state.lanternHp -= g.damage;
        events |= EVENT_LANTERN_HIT;
        if (state.lanternHp <= 0) { state.lanternHp = 0; events |= EVENT_OVER; }
      }
    }

    // --- shards ---
    for (const s of shards) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) { s.active = false; continue; }
      s.vx *= 0.92; s.vy *= 0.92;
      const d = dist(s.x, s.y, player.x, player.y);
      if (d < state.pickupRadius) {
        const a = Math.atan2(player.y - s.y, player.x - s.x);
        s.vx += Math.cos(a) * SHARD.magnetSpeed * dt * 4;
        s.vy += Math.sin(a) * SHARD.magnetSpeed * dt * 4;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (d < PLAYER.radius + SHARD.radius + 4) {
        s.active = false;
        state.score += SHARD.value;
        events |= EVENT_SHARD;
      }
    }

    // --- particles ---
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
    }

    return events;
  }

  reset();
  return { state, reset, step, applyUpgrade, startWave };
}
