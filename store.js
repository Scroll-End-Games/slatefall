// Saving and loading on the phone (design v1.1, section 9). Nothing is imported.
// One entry holds everything: the best score, the light or dark choice, the two sound switches,
// whether "How to play" has been closed once, and the game in progress.
// Both functions stay harmless when the storage is missing, full or holds something broken.

export const KEY = "slatefall:v1";

// What load gives when nothing usable is there.
const fresh = () => ({ best: 0, dark: null, music: true, sounds: true, seen: false, game: null });

const whole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

// A saved game is taken only when it has the shape of a game: a well of 14 rows of 8 numbers
// from 0 to 10, a piece or none, and whole numbers where the rules have them. Anything else is no game.
function gameFrom(saved) {
  if (saved === null || typeof saved !== "object") return null;
  const { well, piece, next, bag, rng, score, rows, level, status } = saved;
  if (!Array.isArray(well) || well.length !== 14) return null;
  for (const row of well) {
    if (!Array.isArray(row) || row.length !== 8 || !row.every((v) => whole(v, 0, 10))) return null;
  }
  if (piece !== null) {
    if (typeof piece !== "object") return null;
    if (!whole(piece.kind, 1, 10) || !whole(piece.rot, 0, 3) || !whole(piece.x, -3, 8) || !whole(piece.y, -3, 14)) return null;
  }
  if (!whole(next, 1, 10)) return null;
  if (!Array.isArray(bag) || bag.length > 10 || !bag.every((v) => whole(v, 1, 10))) return null;
  if (!whole(rng, 0, 4294967295)) return null;
  if (!whole(score, 0, Number.MAX_SAFE_INTEGER) || !whole(rows, 0, Number.MAX_SAFE_INTEGER) || !whole(level, 1, Number.MAX_SAFE_INTEGER)) return null;
  if (status !== "playing" && status !== "paused" && status !== "over") return null;
  return {
    well: well.map((row) => row.slice()),
    piece: piece && { kind: piece.kind, rot: piece.rot, x: piece.x, y: piece.y },
    next,
    bag: bag.slice(),
    rng, score, rows, level, status,
  };
}

// Reads what was saved. Every part that is not usable is replaced by its fresh value.
export function load(storage) {
  const data = fresh();
  try {
    const text = storage.getItem(KEY);
    if (typeof text !== "string") return data;
    const saved = JSON.parse(text);
    if (saved === null || typeof saved !== "object" || Array.isArray(saved)) return data;
    if (whole(saved.best, 0, Number.MAX_SAFE_INTEGER)) data.best = saved.best;
    if (typeof saved.dark === "boolean") data.dark = saved.dark;
    if (typeof saved.music === "boolean") data.music = saved.music;
    if (typeof saved.sounds === "boolean") data.sounds = saved.sounds;
    if (typeof saved.seen === "boolean") data.seen = saved.seen;
    data.game = gameFrom(saved.game);
    return data;
  } catch {
    return fresh();
  }
}

// Writes everything. Answers whether it worked; it never throws.
export function save(storage, data) {
  try {
    storage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// Saves a page's data without undoing what another page of the game has saved since this one
// read the storage: a tab left open beside the game on the home screen shares its storage.
// The best score never goes down, and "How to play" stays seen once it has been. A page that has
// no game of its own (own: false: it has not played) leaves the saved game in progress alone.
// Answers what was written, or null when it could not be; it never throws.
export function keep(storage, data, own = true) {
  const there = load(storage);
  const merged = {
    ...data,
    best: Math.max(data.best, there.best),
    seen: data.seen || there.seen,
    game: own ? data.game : there.game,
  };
  return save(storage, merged) ? merged : null;
}
