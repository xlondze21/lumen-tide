# Lumen Tide — Last Light of the Reef

A lantern-defense roguelite for the web. You are the wisp of the Last
Lantern: guard it through 10 waves of shadow eels, gather light shards,
pick a blessing after every cleared wave, sink the Gloom Maw (wave 5) and
the Tide Tyrant (wave 10) — and the reef shines again.

## Play

Open `game/index.html` in a desktop browser, or run `node serve.ts` and
open http://localhost:8080. No build step, no network, no libraries — the
whole game is plain ES modules plus a canvas, and all sound is synthesized
with WebAudio.

- **WASD / arrow keys** — swim
- **Mouse** — aim
- **Hold click / Space** — shoot light bolts (bolts can also shoot enemy
  globs out of the water)
- **Shift** — dash
- **1 / 2 / 3 or click a card** — pick an upgrade between waves
- **P** — pause · **M** — mute

## Rules

- Shadows swim for the lantern. If one reaches it, the lantern burns.
  If the lantern (or you) runs out of light, the run ends.
- Killing shadows drops light shards — swim over them to score.
- After every cleared wave, choose one of three blessings: brighter bolts,
  faster fire, twin flames, piercing light, a repaired lantern, and more.
- Spitters keep their distance and lob globs; splitters break into minis;
  brutes soak up bolts. Bosses hunt you, then turn on the lantern.

## Screenshots

The four shots in `screenshots/` are real renders of the game's own code,
staged by `game/src/shots.js` (`?shot=start|play|boss|end&seed=1`).

## Entry

Built for the [Make the best game](https://make.fun/bounty/best-game-01)
bounty on make.fun. `main.ts` (Node 22) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` with the vendored
make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see `LICENSE`.
