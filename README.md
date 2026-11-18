# best-game-xlondze21

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/xlondze21/best-game-xlondze21/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/xlondze21/best-game-xlondze21/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Lumen Tide** — a lantern-defense roguelite for make.fun's "Make the best game" (best-game-01). You are a wisp guarding the Last Lantern through 10 waves of shadow eels. Survive every wave, pick an upgrade after each one, sink the Gloom Maw (wave 5) and the Tide Tyrant (wave 10) to win.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Or just open `game/index.html` directly in a desktop browser — the game runs fully offline, no network, no build step.

## How to play

- **Move:** WASD / arrow keys to swim
- **Aim:** mouse, **shoot:** hold click or Space
- **Dash:** Shift (brief invulnerability)
- **Upgrades:** after each cleared wave, press 1 / 2 / 3 or click a card
- **Goal:** keep the lantern alive (30 HP, it regains 4 HP per cleared wave). You have 4 hearts. Collect light shards for score.
- **Enemies:** darters, spitters (shoot their globs down), tanks, and bosses on waves 5 and 10.
- **Sound:** synthesized WebAudio, M to mute, P to pause.

## Files

- `main.ts` — entrypoint: copies `game/` + `screenshots/` to the output dir and builds `dossier.json`
- `game/` — the whole game, plain JS, zero external references
- `screenshots/` — 4 real renders (start, play, boss, end)
- `vendor/makefun-game.ts` — make.fun kit file, unchanged

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
