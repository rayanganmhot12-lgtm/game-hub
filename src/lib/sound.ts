let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

function tone(freq: number, duration: number, volume: number, type: OscillatorType = "sine", delaySec = 0) {
  const ctx = getContext();
  if (!ctx) return;
  const startAt = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration);
}

export function playClickSound() {
  tone(720, 0.06, 0.05, "sine");
}

export function playHoverSound() {
  tone(1000, 0.03, 0.02, "sine");
}

export function playSuccessSound() {
  [660, 880, 1100].forEach((freq, i) => tone(freq, 0.14, 0.05, "sine", i * 0.08));
}

export function playWarningSound() {
  [880, 660].forEach((freq, i) => tone(freq, 0.5, 0.07, "square", i * 0.5));
}

// Timed to line up with the 7s Plus purchase celebration (PlusCelebration.tsx):
// a rising launch whoosh as the rocket climbs (~2.2s-3.3s), a percussive
// "boom" as it explodes center-screen (~3.3s), then a sparkly ascending
// chime as the "PLUS" text reveals (~3.5s).
export function playPlusFanfare() {
  const rocketLaunchAt = 2.2;
  const explodeAt = 3.3;
  const textAt = 3.5;
  [220, 300, 400, 520, 650, 800].forEach((freq, i) => tone(freq, 0.18, 0.035, "sawtooth", rocketLaunchAt + i * 0.16));
  tone(80, 0.5, 0.11, "square", explodeAt);
  tone(55, 0.55, 0.09, "sine", explodeAt);
  [660, 880, 1100, 1320, 1568].forEach((freq, i) => tone(freq, 0.22, 0.05, "sine", textAt + i * 0.09));
}

// A 5-note attention chime spanning ~5s, timed to line up with
// AnnouncementBanner's 5s auto-dismiss countdown.
export function playAnnouncementSound() {
  [880, 660, 880, 660, 1046].forEach((freq, i) => tone(freq, 0.35, 0.06, "sine", i * 1.0));
}

// Pressing mute changed a button's colour and nothing else, which is no use
// when the button isn't where you're looking. The direction carries the
// meaning: muting falls, unmuting rises, so the two are told apart without
// looking at anything. Deafen is the same pair a fifth lower and on a triangle
// wave — duller and heavier, because it is the heavier act, and distinct from
// the mic pair when both live on the same panel.
export function playMuteSound() {
  [660, 440].forEach((freq, i) => tone(freq, 0.09, 0.05, "sine", i * 0.07));
}

export function playUnmuteSound() {
  [440, 660].forEach((freq, i) => tone(freq, 0.09, 0.05, "sine", i * 0.07));
}

export function playDeafenSound() {
  [330, 220].forEach((freq, i) => tone(freq, 0.13, 0.055, "triangle", i * 0.08));
}

export function playUndeafenSound() {
  [220, 330].forEach((freq, i) => tone(freq, 0.13, 0.055, "triangle", i * 0.08));
}

// Loops a two-note ring burst every 2s until the returned function is called
// (call answered, declined, or hung up).
export function startRingtone(): () => void {
  function ringOnce() {
    tone(760, 0.25, 0.045, "sine", 0);
    tone(920, 0.25, 0.045, "sine", 0.3);
  }
  ringOnce();
  const interval = setInterval(ringOnce, 2000);
  return () => clearInterval(interval);
}
