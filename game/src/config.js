// LUMEN TIDE — every tuning number and colour in one place.
// A lantern-defense roguelite: one wisp defends the Last Lantern of the
// reef against waves of shadow eels. Survive 10 waves, sink the Tide Tyrant,
// and the reef lights up again. Playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule depends on screen size.

export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const BEST_KEY = 'lumen-tide.best';
export const WIN_WAVE = 10;

export const PLAYER = {
  radius: 14,
  speed: 300,
  maxHp: 4,
  invulnerable: 1.2,
  fireInterval: 0.22,
  bulletSpeed: 620,
  bulletDamage: 1,
  dashSpeed: 760,
  dashTime: 0.16,
  dashCooldown: 1.6,
  pickupRadius: 90,
};

export const LANTERN = {
  x: FIELD.width / 2,
  y: FIELD.height / 2,
  radius: 34,
  maxHp: 30,
};

export const ENEMY = {
  dart: { hp: 1, speed: 150, radius: 12, damage: 1, score: 10, shards: 1, color: '#ff7a59' },
  brute: { hp: 6, speed: 62, radius: 24, damage: 2, score: 30, shards: 3, color: '#b388ff' },
  spitter: { hp: 2, speed: 84, radius: 14, damage: 1, score: 25, shards: 2, color: '#7ee787' },
  splitter: { hp: 3, speed: 105, radius: 17, damage: 1, score: 20, shards: 2, color: '#f2c94c' },
  mini: { hp: 1, speed: 190, radius: 8, damage: 1, score: 5, shards: 0, color: '#ffb454' },
  boss: { hp: 60, speed: 52, radius: 46, damage: 2, score: 500, shards: 12, color: '#ff4d6d' },
};

export const WAVE = {
  calm: 2.5,
  interval: 1.15,
  intervalScale: 0.92,
  minInterval: 0.32,
  count: 6,
  countPerWave: 3,
};

export const SHARD = { value: 5, radius: 7, magnetSpeed: 420, life: 12 };

export const UPGRADES = [
  { id: 'damage', name: 'Bright Bolts', desc: '+1 bolt damage', apply: (s) => { s.damage += 1; } },
  { id: 'rapid', name: 'Quick Wick', desc: 'Fire 18% faster', apply: (s) => { s.fireInterval *= 0.82; } },
  { id: 'multishot', name: 'Twin Flames', desc: '+1 bolt per shot', apply: (s) => { s.shots += 1; } },
  { id: 'pierce', name: 'Piercing Light', desc: 'Bolts pierce +1 enemy', apply: (s) => { s.pierce += 1; } },
  { id: 'swift', name: 'Drift Fin', desc: 'Move 15% faster', apply: (s) => { s.speed *= 1.15; } },
  { id: 'heart', name: 'Warm Ember', desc: 'Restore 1 heart (max 4)', apply: (s) => { s.hp = Math.min(PLAYER.maxHp, s.hp + 1); } },
  { id: 'repair', name: 'Rekindle', desc: 'Repair the lantern +8', apply: (s) => { s.lanternHp = Math.min(LANTERN.maxHp, s.lanternHp + 8); } },
  { id: 'magnet', name: 'Shard Pull', desc: 'Pickup radius +60%', apply: (s) => { s.pickupRadius *= 1.6; } },
  { id: 'dash', name: 'Slipstream', desc: 'Dash recharges 35% faster', apply: (s) => { s.dashCooldown *= 0.65; } },
  { id: 'velocity', name: 'Long Reach', desc: 'Bolts fly 25% faster', apply: (s) => { s.bulletSpeed *= 1.25; } },
];

export const PALETTE = {
  backdrop: '#060a18',
  deep: '#0a1230',
  reef: '#0e1a3d',
  sand: '#1a2447',
  lantern: '#ffd166',
  lanternCore: '#fff3c4',
  player: '#7ef0ff',
  playerCore: '#ffffff',
  bullet: '#ffe66d',
  shard: '#8affc1',
  text: '#eef4ff',
  muted: '#93a1c4',
  danger: '#ff5d73',
  panel: 'rgba(10, 16, 38, 0.92)',
  panelEdge: '#2c3d6e',
  wave: '#b388ff',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
