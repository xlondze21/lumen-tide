// All sound is synthesized with WebAudio — no audio files, no network.
// A tiny oscillator blip per event, plus a slow two-note lantern hum that
// plays while a run is going. M toggles mute; audio starts on the first
// user gesture (browsers forbid sound before one).

export function createAudio() {
  let ctx = null;
  let muted = false;
  let humTimer = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    try {
      if (ac.state === 'suspended') void ac.resume();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ac.currentTime + dur);
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    shoot() { blip(880, 0.07, 'square', 0.05, 440); },
    hit() { blip(220, 0.08, 'sawtooth', 0.06, 110); },
    kill() { blip(520, 0.16, 'triangle', 0.09, 130); },
    shard() { blip(1320, 0.09, 'sine', 0.07, 1760); },
    hurt() { blip(160, 0.25, 'sawtooth', 0.12, 60); },
    wave() { blip(330, 0.3, 'triangle', 0.1, 660); },
    upgrade() { blip(523, 0.12, 'sine', 0.09, 784); blip(784, 0.18, 'sine', 0.07, 1046); },
    boss() { blip(98, 0.5, 'sawtooth', 0.12, 49); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'sine', 0.09), i * 130)); },
    // Called once a frame while playing: a soft hum every ~2.4 s.
    hum(dt) {
      humTimer += dt;
      if (humTimer > 2.4) { humTimer = 0; blip(196, 0.9, 'sine', 0.025, 220); }
    },
  };
}
