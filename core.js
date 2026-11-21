// The rules of Slatefall as plain functions (design v1.3, sections 3 to 5).
// No screen code, no document, no window, no clock. Nothing is imported.
// A game is one plain object; no function changes it in place.

export const WIDTH = 8;
export const HEIGHT = 14;

// The ten pieces: every shape that two, three or four squares can make,
// mirror images counted as two. The kind is the index; index 0 is empty.
// n is the size of the piece's box; squares are [x, y] inside the box at rot 0.
export const PIECES = deepFreeze([
  null,
  { name: "two",    n: 2, squares: [[0, 0], [1, 0]] },
  { name: "three",  n: 3, squares: [[0, 1], [1, 1], [2, 1]] },
  { name: "corner", n: 2, squares: [[0, 0], [0, 1], [1, 1]] },
  { name: "square", n: 2, squares: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { name: "tee",    n: 3, squares: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  { name: "ell",    n: 3, squares: [[2, 0], [0, 1], [1, 1], [2, 1]] },
  { name: "jay",    n: 3, squares: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  { name: "ess",    n: 3, squares: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { name: "zed",    n: 3, squares: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { name: "four",   n: 4, squares: [[0, 1], [1, 1], [2, 1], [3, 1]] },
]);

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

// 14 rows of 8 zeros. Read as well[y][x]: x from 0 on the left, y from 0 at the top.
export function emptyWell() {
  return Array.from({ length: HEIGHT }, () => new Array(WIDTH).fill(0));
}

// The squares of a piece inside its box as [x, y] pairs,
// each quarter turn clockwise taking (x, y) to (n - 1 - y, x).
export function cells(kind, rot) {
  const { n, squares } = PIECES[kind];
  const turns = ((rot % 4) + 4) % 4;
  let out = squares.map(([x, y]) => [x, y]);
  for (let t = 0; t < turns; t++) out = out.map(([x, y]) => [n - 1 - y, x]);
  return out;
}

// True when every square of the piece lies inside the well, on an empty square.
export function fits(well, piece) {
  for (const [cx, cy] of cells(piece.kind, piece.rot)) {
    const x = piece.x + cx;
    const y = piece.y + cy;
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return false;
    if (well[y][x] !== 0) return false;
  }
  return true;
}

// ---------- Moving and turning (rule 4) ----------

// The shifts a turn tries, in this order, when the turned piece does not fit where it is.
const TURN_SHIFTS = deepFreeze([[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]]);

function withPiece(state, piece) {
  return { ...state, piece };
}

// Moves the piece one square left (dx -1) or right (dx 1) if it fits there.
export function move(state, dx) {
  if (state.status !== "playing" || !state.piece) return state;
  const piece = { ...state.piece, x: state.piece.x + dx };
  return fits(state.well, piece) ? withPiece(state, piece) : state;
}

// A quarter turn clockwise. A turn may shift the piece a little to fit;
// if it fits nowhere, nothing happens.
export function rotate(state) {
  if (state.status !== "playing" || !state.piece) return state;
  const rot = (state.piece.rot + 1) % 4;
  for (const [dx, dy] of TURN_SHIFTS) {
    const piece = { ...state.piece, rot, x: state.piece.x + dx, y: state.piece.y + dy };
    if (fits(state.well, piece)) return withPiece(state, piece);
  }
  return state;
}

// Moves the piece one square down if it fits there.
export function softDrop(state) {
  if (state.status !== "playing" || !state.piece) return state;
  const piece = { ...state.piece, y: state.piece.y + 1 };
  return fits(state.well, piece) ? withPiece(state, piece) : state;
}

// The piece as it would lie after falling straight down: the lowest place where it fits.
// Null when there is no piece.
export function landing(state) {
  if (!state.piece) return null;
  let piece = { ...state.piece };
  for (;;) {
    const lower = { ...piece, y: piece.y + 1 };
    if (!fits(state.well, lower)) return piece;
    piece = lower;
  }
}

// ---------- The start of a game and the settling of a piece (rules 2, 3, 6 to 9) ----------

// Points for one, two, three or four rows at one settling, before the level multiplies them.
const ROW_POINTS = deepFreeze([0, 10, 30, 60, 100]);
// The level goes up by one every eight rows.
const ROWS_PER_LEVEL = 8;

// One step of the mulberry32 recipe: the next number from 0 up to, not including, 1,
// and the new place in the row of random numbers.
export function nextRandom(rng) {
  const a = (rng + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a >>> 0];
}

// Takes the next kind from the round. An empty round is filled with 1 to 10
// and shuffled first (Fisher-Yates). Returns [kind, bag, rng].
function draw(bag, rng) {
  let round = bag;
  let place = rng;
  if (round.length === 0) {
    round = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (let i = round.length - 1; i > 0; i--) {
      let r;
      [r, place] = nextRandom(place);
      const j = Math.floor(r * (i + 1));
      [round[i], round[j]] = [round[j], round[i]];
    }
  }
  return [round[0], round.slice(1), place];
}

// A piece of this kind at its starting place: the top middle.
function startPiece(kind) {
  return { kind, rot: 0, x: Math.floor((WIDTH - PIECES[kind].n) / 2), y: 0 };
}

// A new game: an empty well, the first piece at its starting place, the next one drawn.
export function newGame(seed) {
  let rng = seed >>> 0;
  let bag = [];
  let first;
  let next;
  [first, bag, rng] = draw(bag, rng);
  [next, bag, rng] = draw(bag, rng);
  return { well: emptyWell(), piece: startPiece(first), next, bag, rng, score: 0, rows: 0, level: 1, status: "playing" };
}

// The piece becomes blocks, full rows disappear, points and level are brought up to date,
// and the next piece comes. If it has no room, the game is over.
export function settle(state) {
  if (!state.piece) return state;
  const { piece } = state;
  const filled = state.well.map((row) => row.slice());
  for (const [cx, cy] of cells(piece.kind, piece.rot)) filled[piece.y + cy][piece.x + cx] = piece.kind;

  const kept = filled.filter((row) => row.includes(0));
  const removed = HEIGHT - kept.length;
  const well = [...Array.from({ length: removed }, () => new Array(WIDTH).fill(0)), ...kept];

  const score = state.score + ROW_POINTS[Math.min(removed, 4)] * state.level;
  const rows = state.rows + removed;
  const level = 1 + Math.floor(rows / ROWS_PER_LEVEL);

  const coming = startPiece(state.next);
  const [next, bag, rng] = draw(state.bag, state.rng);
  const after = { ...state, well, next, bag, rng, score, rows, level };
  if (!fits(well, coming)) return { ...after, piece: null, status: "over" };
  return { ...after, piece: coming };
}

// ---------- The beat, the drop at once and pause (rules 5, 7, 8 and 10) ----------

// One beat: the piece moves one square down; if it cannot, it settles.
export function tick(state) {
  if (state.status !== "playing" || !state.piece) return state;
  const piece = { ...state.piece, y: state.piece.y + 1 };
  return fits(state.well, piece) ? withPiece(state, piece) : settle(state);
}

// Puts the piece at its landing, adds one point per square fallen, and settles it at once.
export function hardDrop(state) {
  if (state.status !== "playing" || !state.piece) return state;
  const landed = landing(state);
  return settle({ ...state, piece: landed, score: state.score + (landed.y - state.piece.y) });
}

// The length of a beat in ms: each level falls faster, down to a fastest beat. The first two levels
// are a gentler start (design v1.3, section 5); from level 3 on 60 ms less at each level.
const START = [900, 800];  // ms at levels 1 and 2
export function interval(level) {
  const n = Number.isInteger(level) && level >= 1 ? level : 1;
  return n <= START.length ? START[n - 1] : Math.max(150, 800 - (n - 1) * 60);
}

// From "playing" to "paused".
export function pause(state) {
  return state.status === "playing" ? { ...state, status: "paused" } : state;
}

// From "paused" back to "playing".
export function resume(state) {
  return state.status === "paused" ? { ...state, status: "playing" } : state;
}
