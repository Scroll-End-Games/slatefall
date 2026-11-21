// The sounds of Slatefall (design v1.2, section 10): every sound is made here, with the
// browser's own Web Audio, from notes written in this file. No sound files, nothing imported.
// The voices are those of an old handheld, made clean: two pulse voices, a triangle and noise.
// Every effect is our own; none is taken from another game.

const RAMP = 0.005;        // s: every note starts and ends with a ramp this long, so nothing clicks
const TAIL = 0.004;        // s of silence that closes an effect
const PULSE_CUTOFF = 7000; // Hz: a low-pass on the pulse voices takes away the harshness
const HARMONICS = 48;      // how many harmonics a pulse wave is built from
// The two gains every sound goes through. With these, the loudest moment measured (four rows with
// a turn and a move inside it, over any bar of the tune) peaks at 0.40, under the 0.5 that is the limit.
const EFFECTS_GAIN = 1.3;
const MUSIC_GAIN = 1.3;

// The pitch of a note: 69 is the A above middle C, and every step is a semitone.
const hz = (note) => 440 * 2 ** ((note - 69) / 12);

// ---------- The effects, as lists of notes ----------
// A note: v the voice ("p12", "p25", "p50" for a pulse of that duty, "tri", "noise"); f its pitch in Hz,
// f2 a pitch to slide to; t when it starts and d how long it lasts, in s; g its peak level;
// fade the share of that level left at its end (1 when absent).
// The levels are set so that the loudest moment of a game stays under 0.5 at the output.

const run = (voice, notes, each, last, level, fade = 0.6) =>
  notes.map((note, i) => ({ v: voice, f: hz(note), t: i * each, d: i === notes.length - 1 ? last : each, g: level, fade }));

const THUD = (at) => [
  { v: "tri", f: 330, f2: 110, t: at, d: 0.08, g: 0.13, fade: 0.4 },
  { v: "noise", t: at, d: 0.025, g: 0.03 },
];

const EFFECTS = {
  // The piece moved sideways: a soft tick.
  move: () => [{ v: "p25", f: hz(76), t: 0, d: 0.015, g: 0.04 }],
  // It turned: two quick rising notes.
  turn: () => [
    { v: "p25", f: hz(72), t: 0, d: 0.035, g: 0.07 },
    { v: "p25", f: hz(79), t: 0.035, d: 0.045, g: 0.07, fade: 0.6 },
  ],
  // A piece settled: a soft low thud.
  land: () => THUD(0),
  // A drop at once: a short falling sweep into the thud.
  drop: () => [{ v: "p12", f: 880, f2: 220, t: 0, d: 0.07, g: 0.055 }, ...THUD(0.06)],
  // One, two or three rows: a rising run of two, three or four notes.
  rows: (count = 1) => run("p25", [76, 81, 83, 88].slice(0, Math.min(3, Math.max(1, count)) + 1), 0.055, 0.09, 0.1),
  // Four rows: a longer, brighter run of six notes, with a second voice under it.
  four: () => [
    ...run("p25", [76, 81, 83, 88, 90, 95], 0.05, 0.1, 0.1),
    ...run("p12", [71, 76, 78, 83, 85, 90], 0.05, 0.1, 0.035),
  ],
  // A new level: a short rising phrase of four notes.
  level: () => run("p50", [69, 74, 76, 81], 0.065, 0.11, 0.09),
  // The end of the game: a falling phrase of five notes.
  over: () => [
    ...run("p25", [76, 72, 69, 65, 62], 0.07, 0.1, 0.07, 0.7),
    ...run("tri", [64, 60, 57, 53, 50], 0.07, 0.1, 0.06, 0.7),
  ],
  // Pause: one soft blip. Resume: the same blip a fifth higher.
  pause: () => [{ v: "p50", f: hz(69), t: 0, d: 0.06, g: 0.06, fade: 0.7 }],
  resume: () => [{ v: "p50", f: hz(76), t: 0, d: 0.06, g: 0.06, fade: 0.7 }],
};

const notesOf = (name, option) => (EFFECTS[name] ? EFFECTS[name](option) : []);

// How long an effect lasts, in s.
export function effectLength(name, option) {
  return notesOf(name, option).reduce((end, note) => Math.max(end, note.t + note.d), 0) + TAIL;
}

// ---------- The tune ----------
// One tune of our own, composed for this game: 32 bars of 4/4 at 140 beats a minute, in D minor.
// Four parts of eight bars: the theme, the theme with a new ending, a calmer middle, the theme again.
// It is no game's music and no folk tune that another game made famous.
// A voice is a list of bars, and a bar a list of notes [pitch, length]: the pitch counts semitones
// (69 is the A above middle C; 0 is a rest), the length counts sixteenths, sixteen to the bar.

const TEMPO = 140;
const STEP = 60 / TEMPO / 4;  // s in a sixteenth
const BAR = 16 * STEP;
const BARS = 32;
export const TUNE_LENGTH = BARS * BAR;  // 54.857 s

// The lead, on the 25 % pulse. Its theme: a note struck twice, a leap up, and a swaying answer.
const T1 = [[81, 2], [81, 1], [0, 1], [86, 2], [84, 2], [81, 3], [79, 3], [81, 2]];
const T2 = [[77, 2], [77, 1], [0, 1], [82, 2], [79, 2], [77, 3], [74, 3], [77, 2]];
const T3 = [[84, 2], [84, 1], [0, 1], [81, 2], [84, 2], [81, 3], [77, 3], [79, 2]];
const T4 = [[79, 2], [79, 1], [0, 1], [76, 2], [79, 2], [84, 4], [0, 2], [81, 2]];
const T5 = [[81, 2], [81, 1], [0, 1], [86, 2], [84, 2], [81, 3], [79, 3], [77, 2]];
const T6 = [[82, 2], [82, 1], [0, 1], [77, 2], [74, 2], [77, 3], [82, 3], [81, 2]];
const T7 = [[86, 2], [86, 1], [0, 1], [82, 2], [79, 2], [82, 3], [79, 3], [81, 2]];
const T8 = [[81, 2], [81, 1], [0, 1], [85, 2], [81, 2], [76, 4], [0, 2], [73, 2]];

const LEAD = [
  // The theme
  T1, T2, T3, T4, T5, T6, T7, T8,
  // The theme with a new ending that climbs and comes to rest
  T1, T2, T3,
  [[79, 2], [79, 1], [0, 1], [84, 2], [79, 2], [76, 3], [79, 3], [84, 2]],
  [[81, 2], [81, 1], [0, 1], [86, 2], [84, 2], [81, 3], [86, 3], [84, 2]],
  [[82, 2], [82, 1], [0, 1], [86, 2], [82, 2], [77, 3], [82, 3], [86, 2]],
  [[85, 2], [85, 1], [0, 1], [88, 2], [85, 2], [88, 3], [86, 3], [88, 2]],
  [[86, 6], [0, 2], [81, 2], [0, 2], [74, 4]],
  // The calmer middle: long notes that come in after the beat
  [[0, 2], [82, 4], [79, 2], [82, 4], [86, 4]],
  [[82, 6], [79, 2], [74, 4], [79, 4]],
  [[0, 2], [81, 4], [77, 2], [81, 4], [86, 4]],
  [[84, 6], [81, 2], [77, 4], [74, 4]],
  [[0, 2], [77, 4], [74, 2], [77, 4], [82, 4]],
  [[84, 6], [79, 2], [76, 4], [79, 4]],
  [[0, 2], [81, 2], [86, 2], [84, 2], [81, 2], [77, 2], [79, 2], [81, 2]],
  [[85, 4], [81, 2], [76, 2], [73, 4], [0, 2], [76, 2]],
  // The theme again, with an ending that leads back to the top
  T1, T2, T3, T4, T5, T6, T7,
  [[81, 2], [81, 1], [0, 1], [85, 2], [88, 2], [86, 3], [85, 3], [79, 2]],
];

// The chord of every bar, and what the other voices play over a chord.
const CHORDS = {
  Dm: { tones: [62, 65, 69], root: 50 },
  Bb: { tones: [58, 62, 65], root: 46 },
  F: { tones: [60, 65, 69], root: 53 },
  C: { tones: [60, 64, 67], root: 48 },
  Gm: { tones: [62, 67, 70], root: 55 },
  A: { tones: [61, 64, 69], root: 45 },
};
const PROGRESSION = [
  "Dm", "Bb", "F", "C", "Dm", "Bb", "Gm", "A",
  "Dm", "Bb", "F", "C", "Dm", "Bb", "A", "Dm",
  "Gm", "Gm", "Dm", "Dm", "Bb", "C", "Dm", "A",
  "Dm", "Bb", "F", "C", "Dm", "Bb", "Gm", "A",
];
const calm = (bar) => bar >= 16 && bar < 24;  // the middle part

// The harmony, on the 12.5 % pulse: the chord, broken into single notes.
const HARMONY = PROGRESSION.map((name, bar) => {
  const [low, mid, high] = CHORDS[name].tones;
  return calm(bar)
    ? [[low, 4], [high, 2], [mid, 2], [low, 4], [high, 2], [mid, 2]]
    : [[low, 2], [mid, 2], [high, 2], [mid, 2], [low, 2], [mid, 2], [high, 2], [mid, 2]];
});

// The bass, on the triangle: the chord's root, its fifth and its octave.
const BASS = PROGRESSION.map((name, bar) => {
  const r = CHORDS[name].root;
  return calm(bar)
    ? [[r, 6], [r + 7, 2], [r, 4], [r + 12, 2], [r + 7, 2]]
    : [[r, 3], [r, 3], [r + 12, 2], [r, 2], [r + 7, 2], [r + 12, 2], [r + 7, 2]];
});

// Light drums on the noise: 1 is a tick, 2 a soft snap, 0 a rest. Every eighth bar ends with a small roll.
const DRUMS = PROGRESSION.map((name, bar) => {
  if (bar % 8 === 7) return [[0, 2], [1, 2], [2, 2], [1, 2], [2, 2], [1, 1], [1, 1], [2, 2], [2, 2]];
  return calm(bar)
    ? [[0, 4], [2, 4], [0, 4], [2, 2], [1, 2]]
    : [[0, 2], [1, 2], [2, 2], [1, 2], [0, 2], [1, 2], [2, 2], [1, 2]];
});

// How each voice sounds: its wave, its peak level, how much of its length a note sounds for,
// and the share of its level left at its end. The levels leave room for the effects under 0.5.
// The lead plays its notes one octave lower than written (shift, in semitones): high up, where it
// was first written, it tired the ear after a while (21 November 2026).
const VOICES = {
  lead: { bars: LEAD, v: "p25", g: 0.065, hold: 1, fade: 0.7, shift: -12 },
  harmony: { bars: HARMONY, v: "p12", g: 0.038, hold: 0.6, fade: 0.5 },
  bass: { bars: BASS, v: "tri", g: 0.075, hold: 0.92, fade: 0.85 },
};
const DRUM_KINDS = { 1: { d: 0.025, g: 0.022, fade: 1 }, 2: { d: 0.07, g: 0.035, fade: 0.2 } };

// The whole tune as one list of notes in the order they start, timed from its first beat.
function buildTune(withDrums) {
  const notes = [];
  for (const voice of Object.values(VOICES)) {
    voice.bars.forEach((bar, index) => {
      let step = 0;
      for (const [pitch, length] of bar) {
        if (pitch) notes.push({ v: voice.v, f: hz(pitch + (voice.shift ?? 0)), t: index * BAR + step * STEP, d: length * STEP * voice.hold, g: voice.g, fade: voice.fade });
        step += length;
      }
    });
  }
  if (withDrums) {
    DRUMS.forEach((bar, index) => {
      let step = 0;
      for (const [kind, length] of bar) {
        if (kind) notes.push({ v: "noise", t: index * BAR + step * STEP, ...DRUM_KINDS[kind] });
        step += length;
      }
    });
  }
  return notes.sort((a, b) => a.t - b.t);
}

let tuneWithDrums = null;
let tuneWithout = null;
function tuneNotes(withDrums = true) {
  if (withDrums) return (tuneWithDrums ??= buildTune(true));
  return (tuneWithout ??= buildTune(false));
}

// For a check of the writing itself: how many sixteenths each bar of each voice holds.
export function tuneBars() {
  const count = (bars) => bars.map((bar) => bar.reduce((sum, [, length]) => sum + length, 0));
  return { lead: count(LEAD), harmony: count(HARMONY), bass: count(BASS), drums: count(DRUMS) };
}

// ---------- The voices ----------

// What a context needs to play: the two gains every sound goes through, the pulse waves, the noise.
const rigs = new WeakMap();

function pulseWave(ac, duty) {
  const real = new Float32Array(HARMONICS + 1);
  const imag = new Float32Array(HARMONICS + 1);
  for (let n = 1; n <= HARMONICS; n++) real[n] = (4 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  return ac.createPeriodicWave(real, imag);
}

// A short buffer of random values, each held for a few samples: the rough noise of an old sound chip.
// The numbers come from a fixed recipe, so the noise is the same every time.
function noiseBuffer(ac) {
  const length = Math.floor(ac.sampleRate * 0.5);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 22222;
  let value = 0;
  for (let i = 0; i < length; i++) {
    if (i % 3 === 0) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      value = (seed / 0x3fffffff) - 1;
    }
    data[i] = value;
  }
  return buffer;
}

function rigOf(ac) {
  let rig = rigs.get(ac);
  if (rig) return rig;
  const effects = ac.createGain();
  const music = ac.createGain();
  effects.gain.value = EFFECTS_GAIN;
  music.gain.value = MUSIC_GAIN;
  // Both gains go straight to the speakers; there is no compressor.
  effects.connect(ac.destination);
  music.connect(ac.destination);
  rig = {
    ac, effects, music,
    waves: { p12: pulseWave(ac, 0.125), p25: pulseWave(ac, 0.25), p50: pulseWave(ac, 0.5) },
    noise: noiseBuffer(ac),
  };
  rigs.set(ac, rig);
  return rig;
}

// Schedules one note on a context, from the moment `at`, into `into`. Answers the source that plays it.
function playNote(rig, into, note, at) {
  const { ac } = rig;
  const start = at + note.t;
  const end = start + note.d;
  const ramp = Math.min(RAMP, note.d / 3);
  const level = ac.createGain();
  // Silent from the moment it is made, not only from its start: a note never lets a sample through early.
  level.gain.value = 0;
  level.gain.setValueAtTime(0, start);
  level.gain.linearRampToValueAtTime(note.g, start + ramp);
  level.gain.linearRampToValueAtTime(note.g * (note.fade ?? 1), end - ramp);
  level.gain.linearRampToValueAtTime(0, end);
  level.connect(into);

  let source;
  if (note.v === "noise") {
    source = ac.createBufferSource();
    source.buffer = rig.noise;
    source.loop = true;
    source.connect(level);
  } else {
    source = ac.createOscillator();
    if (note.v === "tri") {
      source.type = "triangle";
      source.connect(level);
    } else {
      source.setPeriodicWave(rig.waves[note.v]);
      const soften = ac.createBiquadFilter();
      soften.type = "lowpass";
      soften.frequency.value = PULSE_CUTOFF;
      soften.Q.value = 0.5;
      // Two steps: an older Safari's connect() gives nothing back to chain on.
      source.connect(soften);
      soften.connect(level);
    }
    source.frequency.setValueAtTime(note.f, start);
    if (note.f2) source.frequency.exponentialRampToValueAtTime(note.f2, end);
  }
  source.start(start);
  source.stop(end + 0.001);
  return source;
}

// Schedules a whole effect on any context from the moment `at`, straight into its effects gain.
// For measuring an effect in an OfflineAudioContext. Answers its length in s.
export function renderEffect(ac, name, at = 0, option) {
  const rig = rigOf(ac);
  for (const note of notesOf(name, option)) playNote(rig, rig.effects, note, at);
  return effectLength(name, option);
}

// Schedules the tune on any context from the moment `at`, straight into its music gain:
// `rounds` times in a row, with or without the drums; or only `count` bars from bar `first` on;
// at the pace `pace` (paceOf). For measuring it in an OfflineAudioContext. Answers the length of
// what it scheduled in s.
export function renderTune(ac, at = 0, { rounds = 1, drums = true, first = 0, count = BARS, pace: p = 1 } = {}) {
  const rig = rigOf(ac);
  const from = first * BAR;
  const to = (first + count) * BAR;
  for (let round = 0; round < rounds; round++) {
    for (const note of tuneNotes(drums)) {
      if (note.t >= from - 1e-9 && note.t < to - 1e-9) playNote(rig, rig.music, paced(note, p), at + (round * TUNE_LENGTH - from) / p);
    }
  }
  return (rounds > 1 ? rounds * TUNE_LENGTH : to - from) / p;
}

// ---------- The game's own context ----------

let context = null;
let rig = null;
let analyser = null;
let soundsOn = true;
let waking = false;          // a resume has been asked for and has not answered yet
let wakes = 0;               // counts the resumes asked for: only the answer to the last one ends the waiting
let wakeTimer = 0;
let restTimer = 0;
const WAKE_WAIT = 1000;      // ms a resume may take to answer before it stops counting as "about to play"
const sounding = new Map();  // effect name -> { gain, sources, end }: what is playing or about to

// Makes the audio context and resumes it. Called on every tap, click and key that browsers count as
// the player's go-ahead for sound; it does nothing while the context is running.
export function unlock() {
  if (!context) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    // On an iPhone: the silent switch silences the game, and the player's own music keeps playing.
    try {
      if (navigator.audioSession) navigator.audioSession.type = "ambient";
    } catch {
      // An older Safari: the phone decides by itself.
    }
    context = new Context({ latencyHint: "interactive" });
    rig = rigOf(context);
    // For the checks: an analyser listens to everything that goes to the speakers.
    analyser = context.createAnalyser();
    analyser.fftSize = 8192;
    rig.effects.connect(analyser);
    rig.music.connect(analyser);
  }
  clearTimeout(restTimer);
  if (context.state !== "running") {
    // Asked again on every go-ahead until the context runs: a resume that a browser leaves
    // unanswered (a touch it did not take for a tap, a phone call) never stands in the way of the next.
    const asked = ++wakes;
    waking = true;
    context.resume().catch(() => {}).then(() => {
      if (asked !== wakes) return;
      clearTimeout(wakeTimer);
      waking = false;
      runTune();
    });
    // An answer that does not come: the waiting ends, and what was waiting to sound is dropped,
    // so that it cannot all sound at once when the context runs at last.
    clearTimeout(wakeTimer);
    wakeTimer = setTimeout(() => {
      if (asked !== wakes || !waking) return;
      waking = false;
      hush();
    }, WAKE_WAIT);
  }
  runTune();
}

// The context can play, or is about to: a sound scheduled now is heard as soon as it runs.
const awake = () => context && (context.state === "running" || waking);

// Fades out what plays under a name within the ramp, and stops its notes still to come.
function cut(name) {
  const playing = sounding.get(name);
  if (!playing) return;
  sounding.delete(name);
  const now = context.currentTime;
  playing.gain.gain.cancelScheduledValues(now);
  playing.gain.gain.setValueAtTime(1, now);
  playing.gain.gain.linearRampToValueAtTime(0, now + RAMP);
  for (const source of playing.sources) {
    try {
      source.stop(now + RAMP + 0.001);
    } catch {
      // It has ended already.
    }
  }
  setTimeout(() => playing.gain.disconnect(), 100);
}

// Plays effects one after another, each starting when the one before ends.
// An effect is a name, or [name, option] as in ["rows", 2]. A new effect cuts the one of the same name.
export function play(...effects) {
  if (!soundsOn || !awake()) return;
  // What has ended is cleared away.
  for (const [name, playing] of sounding) {
    if (playing.end < context.currentTime - 0.05) {
      sounding.delete(name);
      playing.gain.disconnect();
    }
  }
  let at = context.currentTime + 0.002;
  for (const effect of effects) {
    const [name, option] = Array.isArray(effect) ? effect : [effect];
    const notes = notesOf(name, option);
    if (notes.length === 0) continue;
    cut(name);
    // Each effect has a gain of its own, so that stopping one never touches the next.
    const gain = context.createGain();
    gain.connect(rig.effects);
    const sources = notes.map((note) => playNote(rig, gain, note, at));
    const length = effectLength(name, option);
    sounding.set(name, { gain, sources, end: at + length });
    at += length;
  }
}

// Silences every effect within the ramp: for a pause and for the game leaving the screen.
export function hush() {
  if (!context) return;
  for (const name of [...sounding.keys()]) cut(name);
}

// The page went out of sight: everything falls silent, and the context rests until the next tap or key.
export function rest() {
  if (!context) return;
  hush();
  clearTimeout(restTimer);
  restTimer = setTimeout(() => {
    if (document.hidden) context.suspend().catch(() => {});
  }, 60);
}

// The Sounds switch: off silences the effects at once and keeps them silent.
export function setSounds(on) {
  soundsOn = Boolean(on);
  if (!soundsOn) hush();
}

// ---------- Playing the tune ----------

const TIMER = 25;        // ms between two looks at what is due
const LOOKAHEAD = 0.1;   // s of notes scheduled ahead on the audio clock, so the beat never stumbles

// The tune plays a little faster as the levels go up (brief v1.3; design v1.2, section 10): 2 % at
// each level above the first, up to level 12, where the pieces reach their fastest fall. A pace of 1
// is that of level 1, 140 beats a minute; from level 12 on it is 1.22, about 171.
const PACE_PERCENT = 2;
const PACE_TOP = 12;
export function paceOf(level) {
  const n = Number.isFinite(level) ? Math.min(Math.max(Math.floor(level), 1), PACE_TOP) : 1;
  return (100 + PACE_PERCENT * (n - 1)) / 100;
}

// A note at a pace: its start and its length shrink alike; its pitch stays.
const paced = (note, p) => (p === 1 ? note : { ...note, t: note.t / p, d: note.d / p });

let musicOn = true;      // the Music switch
let wanted = false;      // the game is being played: the tune should sound
let drawnAt = 0;         // when the game last drew a frame
const FRAME_WAIT = 400;  // ms without a frame after which the tune falls silent: the game is not being shown
let fromBar = 0;         // the bar the tune starts from the next time
let pace = 1;            // the pace of the game's level (paceOf)
let tune = null;         // while it plays: { gain, sources, origin, index, timer }; origin is the
                         // moment on the audio clock where this round began, at the current pace

// Schedules every note that starts within the look-ahead.
function pump() {
  if (!tune) return;
  // No frame for a while: the page is not being drawn, though nobody may have said so (a host can
  // hide a page without telling it). The tune stops, and goes on at its bar with the next frame.
  if (performance.now() - drawnAt > FRAME_WAIT) {
    haltTune();
    return;
  }
  const notes = tuneNotes();
  const now = context.currentTime;
  for (;;) {
    const note = notes[tune.index];
    const at = tune.origin + note.t / pace;
    if (at > now + LOOKAHEAD) break;
    // A note whose moment has passed is left out, not played late.
    if (at >= now - 0.02) tune.sources.push({ source: playNote(rig, tune.gain, paced(note, pace), tune.origin), end: at + note.d / pace });
    tune.index++;
    if (tune.index >= notes.length) {
      tune.index = 0;
      tune.origin += TUNE_LENGTH / pace;
    }
  }
  if (tune.sources.length > 64) tune.sources = tune.sources.filter((playing) => playing.end > now);
}

// Starts the tune at the beginning of the bar it stopped in, when it is wanted, switched on and can sound.
function runTune() {
  if (tune || !wanted || !musicOn || !awake()) return;
  const gain = context.createGain();
  gain.connect(rig.music);
  const start = fromBar * BAR;
  tune = {
    gain,
    sources: [],
    origin: context.currentTime + 0.03 - start / pace,
    index: Math.max(0, tuneNotes().findIndex((note) => note.t >= start - 1e-6)),
    timer: setInterval(pump, TIMER),
  };
  pump();
}

// Stops the tune within the ramp, and remembers the bar it was in.
function haltTune() {
  if (!tune) return;
  const stopped = tune;
  tune = null;
  clearInterval(stopped.timer);
  const now = context.currentTime;
  const played = Math.max(0, now - stopped.origin) * pace;
  fromBar = Math.floor(played / BAR) % BARS;
  stopped.gain.gain.setValueAtTime(1, now);
  stopped.gain.gain.linearRampToValueAtTime(0, now + RAMP);
  for (const { source } of stopped.sources) {
    try {
      source.stop(now + RAMP + 0.001);
    } catch {
      // It has ended already.
    }
  }
  setTimeout(() => stopped.gain.disconnect(), 100);
}

// The game calls this with every frame it draws: the tune only plays while the game is being drawn.
export function alive() {
  drawnAt = performance.now();
  if (wanted && !tune) runTune();
}

// The game is being played: the tune sounds. A new game starts it from the top.
export function startMusic(fromTop = false) {
  wanted = true;
  if (fromTop) {
    haltTune();
    fromBar = 0;
  }
  runTune();
}

// Pause, game over, out of sight: the tune stops, and will start again at the beginning of its bar.
export function stopMusic() {
  wanted = false;
  haltTune();
}

// The Music switch.
export function setMusic(on) {
  musicOn = Boolean(on);
  if (musicOn) runTune();
  else haltTune();
}

// The game's level, with every frame and before the tune starts: the tune plays at that level's pace.
// A change while it plays keeps its place: it goes on from where it is, at the new pace.
export function setLevel(level) {
  const next = paceOf(level);
  if (next === pace) return;
  if (tune) {
    const now = context.currentTime;
    const reached = (now - tune.origin) * pace;  // where the tune is, in its own time
    tune.origin = now - reached / next;
  }
  pace = next;
}

// ---------- For the checks ----------

// The bar of the tune that is sounding, counted from 0; -1 while the tune is not playing.
export function tuneBar() {
  if (!tune) return -1;
  return Math.floor((Math.max(0, context.currentTime - tune.origin) * pace) / BAR) % BARS;
}

// Where the tune is in its own time, in s from the top of its round (at the pace of level 1);
// -1 while it is not playing. A check measures the pace with it.
export function tuneAt() {
  if (!tune) return -1;
  return (Math.max(0, context.currentTime - tune.origin) * pace) % TUNE_LENGTH;
}

// "none" before the first unlock, otherwise the context's own state.
export function state() {
  return context ? context.state : "none";
}

// Suspends the context, as a phone call would.
export function suspend() {
  return context ? context.suspend() : Promise.resolve();
}

// The loudest sample of the last 50 ms that went to the speakers.
export function level() {
  if (!context || !analyser || context.state !== "running") return 0;
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  const from = Math.max(0, data.length - Math.ceil(context.sampleRate * 0.05));
  let loudest = 0;
  for (let i = from; i < data.length; i++) loudest = Math.max(loudest, Math.abs(data[i]));
  return loudest;
}
