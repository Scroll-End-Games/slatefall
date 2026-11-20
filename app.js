// Slatefall: the screen and the loop (design v1.1, sections 6, 7 and 9).
// Draws the state, keeps the beat, shows the panels, and hands buttons, fingers and keys to the rules.
import {
  WIDTH, HEIGHT, cells, fits, newGame, move, rotate, softDrop, hardDrop, tick, landing, interval, pause, resume,
} from "./core.js";
import {
  ART, SIGN_HEIGHT, ICONS, textWidth, drawText, drawTitle, titleSize, titleScale, thousands, slotOf, drawTile, pixelRect, drawKey, drawIcon,
} from "./pixel.js";
import { startInput } from "./input.js";
import { KEY, load, keep } from "./store.js";
import * as audio from "./sound.js";
import { TEXTS as T } from "./texts.js";

// Whatever goes wrong in the sound, the game goes on without it: no call into sound.js can throw here.
const quiet = (fn) => (...args) => {
  try {
    return fn(...args);
  } catch {
    return undefined;
  }
};
const unlock = quiet(audio.unlock);
const sound = quiet(audio.play);
const hush = quiet(audio.hush);
const rest = quiet(audio.rest);
const setSounds = quiet(audio.setSounds);
const setMusic = quiet(audio.setMusic);
const startMusic = quiet(audio.startMusic);
const stopMusic = quiet(audio.stopMusic);
const alive = quiet(audio.alive);

const root = document.documentElement;
const byId = (id) => document.getElementById(id);
const panel = byId("panel");
const screen = byId("screen");
const wellArea = byId("well-area");
const statusLine = byId("status");
const sheet = byId("sheet");
const sheetBody = byId("sheet-body");
const gameButtons = [...document.querySelectorAll(".pause, .keys .key")];

// ---------- The game, and what is kept beside it ----------

// The seed of a new game is chosen here, never in the rules.
const newSeed = () => Date.now() % 2147483647;

// What is kept on the phone (design section 9). A storage that cannot be reached is simply not used.
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
const kept = load(storage);

// A saved game comes back only if it still obeys the rules: a piece that fits and no full row.
function broughtBack(saved) {
  if (!saved || saved.status === "over" || !saved.piece) return null;
  if (!fits(saved.well, saved.piece) || saved.well.some((row) => !row.includes(0))) return null;
  // A game that is brought back starts paused.
  return { ...saved, status: "paused" };
}

const restored = broughtBack(kept.game);
let game = restored ?? pause(newGame(newSeed()));  // a new game waits for Play
let mine = false;     // this page has changed the game since it loaded: the game to keep is its own
let unsaved = false;  // something has changed since the last save, or could not be kept
let lost = storage === null;  // nothing can be kept: the storage cannot be reached, or the last save failed
let broken = false;   // a fault in the game's own code has stopped the game (the safety net, below)
let falling = 0;      // counts the pieces as they come, so that a stroke knows the piece it began on
let best = kept.best;      // the best score
let dark = kept.dark;      // the player's choice: true for dark, false for light, null to follow the system
let music = kept.music;    // the Music switch
let sounds = kept.sounds;  // the Sounds switch
let seen = kept.seen;      // "How to play" has been closed once
let newBest = false;

// Saves everything. A game that is over is not a game in progress. Another page of the game may
// have saved since this one loaded (a tab left open beside the game on the home screen), so no
// page ever lowers the best score, and a page that has not played leaves the saved game alone
// (keep, in store.js). After a fault nothing is written: what was kept stays as it was.
function persist() {
  if (broken) return;
  const written = keep(storage, { best, dark, music, sounds, seen, game: game.status !== "over" ? game : null }, mine);
  if (written) {
    best = written.best;
    seen = written.seen;
  }
  // What could not be kept stays unsaved: it is tried again at the next save and when the page
  // closes. The menu says in one plain line whether anything can be kept (finding A07).
  unsaved = !written;
  if (lost !== !written) {
    lost = !written;
    if (sheetName === "start" || sheetName === "paused") refreshSheet(sheetName);
  }
}
let beat = 0;      // ms since the last beat
let dirty = true;  // the game screen needs drawing

// Every change of the game goes through here. Answers whether anything changed.
// The state changes at once; what moves on the screen only follows it.
function apply(fn, ...args) {
  if (broken) return false;
  const before = game;
  const after = fn(before, ...args);
  if (after === before) return false;
  const now = performance.now();
  const drawn = before.piece ? shownPiece(now) : null;
  game = after;
  dirty = true;
  mine = true;
  unsaved = true;
  if (after.well !== before.well) falling++;
  moveFor(before, after, fn, drawn, now);
  // A soft drop that moves the piece, or a drop at once, starts the count of the beat again.
  if (fn === softDrop || fn === hardDrop) beat = 0;
  soundFor(before, after, fn);
  if (after.status === "over" && before.status !== "over") endGame();
  else if (after.level !== before.level || after.status !== before.status) tellStatus();
  // Saved when a piece settles, and when the game pauses, goes on or ends.
  if (after.well !== before.well || after.status !== before.status) persist();
  return true;
}

// ---------- Movement that follows the state (design section 6) ----------

let motion = { glide: 0, fade: 0, press: 0, level: 0, over: 0, title: 0, rain: 0 };  // ms, read from style.css
let glide = null;    // the falling piece on its way: { fromX, fromY, start }, in squares
let fading = null;   // full rows going: { well, rows, start }, the well as it was with them
let pressing = null; // a settled piece giving its short press: { squares, start }
let levelUp = -Infinity;  // when the level last went up
let overTimer = 0;

// ---------- Unhurried presses ----------

// Tells an unhurried press from a hasty one, for the two buttons that end something. A press is
// hasty when it comes less than `rest` ms after start(), or less than HASTE ms after another hasty
// press: a run of quick presses that began too soon stays hasty until it pauses.
const HASTE = 600;      // ms
const OVER_REST = 900;  // ms after a game ends before New game answers; its panel shows after 400
const SURE_REST = 500;  // ms after "Sure? Press again" shows before the second press counts

function patience(rest) {
  let from = -Infinity;
  let hasty = -Infinity;
  // How long until a press would count, in ms; 0 when it would count now.
  const left = () => {
    const now = performance.now();
    return Math.max(0, from + rest - now, hasty + HASTE - now);
  };
  return {
    start() {
      from = performance.now();
      hasty = -Infinity;
    },
    left,
    // Takes a press and answers whether it counts.
    press() {
      if (left() === 0) return true;
      hasty = performance.now();
      return false;
    },
  };
}

// After a game ends, New game rests: a press that was meant for the game, such as one more drop,
// never starts the next game before the score has been seen.
const overWait = patience(OVER_REST);

// Where the falling piece is drawn right now, in squares: on its way during a glide, else where it is.
function shownPiece(now) {
  const { piece } = game;
  if (!glide || !piece) return piece;
  const t = (now - glide.start) / motion.glide;
  if (!(t < 1)) {
    glide = null;
    return piece;
  }
  const eased = 1 - (1 - t) * (1 - t);
  return { ...piece, x: glide.fromX + (piece.x - glide.fromX) * eased, y: glide.fromY + (piece.y - glide.fromY) * eased };
}

// Starts what should move after a change of the game.
function moveFor(before, after, fn, drawn, now) {
  if (after.well === before.well) {
    // The same piece moved or turned: it glides from where it was drawn to where it is.
    if (before.piece && after.piece && (after.piece.x !== before.piece.x || after.piece.y !== before.piece.y)) {
      glide = motion.glide > 0 ? { fromX: drawn.x, fromY: drawn.y, start: now } : null;
    }
    return;
  }
  // A piece settled. The next one starts at the top without a glide.
  glide = null;
  fading = null;
  pressing = null;
  const settled = fn === hardDrop ? landing(before) : before.piece;
  if (!settled) return;
  const squares = cells(settled.kind, settled.rot).map(([x, y]) => [settled.x + x, settled.y + y]);
  if (after.rows > before.rows && motion.fade > 0) {
    // Full rows fade before the rows above come down: until then the well is shown as it was.
    const well = before.well.map((row) => row.slice());
    for (const [x, y] of squares) well[y][x] = settled.kind;
    const rows = well.map((row, y) => (row.includes(0) ? -1 : y)).filter((y) => y >= 0);
    fading = { well, rows, start: now };
  } else if (after.rows === before.rows && motion.press > 0) {
    pressing = { squares, start: now };
  }
  if (after.level > before.level) levelUp = now;
}

// Something is still moving, or has just stopped: the screen is drawn again on this frame.
// The frame after the last movement is drawn too, so that what follows it shows at once:
// the rows that come down, the piece at rest, the level without its plate.
let wasMoving = false;
function moving(now) {
  if (fading && now - fading.start >= motion.fade) fading = null;
  if (pressing && now - pressing.start >= motion.press) pressing = null;
  if (glide && now - glide.start >= motion.glide) glide = null;
  const still = Boolean(glide || fading || pressing) || now - levelUp < motion.level;
  const draw = still || wasMoving;
  wasMoving = still;
  return draw;
}

// Compares the state before and after a call and plays the matching sound (design section 10).
function soundFor(before, after, fn) {
  if (after.well !== before.well) {
    // A piece settled: its thud, or the sweep of a drop at once, then one after another
    // the rows, the new level and the end of the game.
    const chain = [fn === hardDrop ? "drop" : "land"];
    const rows = after.rows - before.rows;
    if (rows >= 4) chain.push("four");
    else if (rows > 0) chain.push(["rows", rows]);
    if (after.level > before.level) chain.push("level");
    if (after.status === "over") chain.push("over");
    // What the settling before this one left sounding is cut: two runs never sound on top of each other.
    hush();
    sound(...chain);
  } else if (fn === move) sound("move");
  else if (fn === rotate) sound("turn");
}

function tellStatus() {
  const say = T.status[game.status];
  statusLine.textContent = game.status === "over" ? say(game.score, best) : say(game.score, game.level);
}

// The end of a game: the tune stops and stays off; the falling phrase is already on its way.
function endGame() {
  stopMusic();
  overWait.start();
  // Another page of the game may have made a better score since this one loaded.
  best = Math.max(best, load(storage).best);
  newBest = game.score > best;
  best = Math.max(best, game.score);
  tellStatus();
  // The last piece stands for a moment before the panel shows.
  clearTimeout(overTimer);
  if (motion.over > 0) overTimer = setTimeout(() => showSheet("over"), motion.over);
  else showSheet("over");
}

// A new game starts the tune from the top.
function startGame() {
  if (broken) return;
  clearTimeout(overTimer);
  glide = null;
  fading = null;
  pressing = null;
  levelUp = -Infinity;
  best = Math.max(best, game.score);
  game = newGame(newSeed());
  mine = true;
  falling++;
  beat = 0;
  dirty = true;
  hideSheet();
  tellStatus();
  startMusic(true);
  persist();
}

// A resume made by the player plays its blip, and the tune goes on from the bar it stopped in.
// A page that has not played goes on with the game that is kept now: another page of the game may
// have kept a newer one since this page loaded, and the browser may not have said so yet.
function resumeGame() {
  if (broken) return;
  if (!mine) takeGame();
  hideSheet();
  if (apply(resume)) {
    sound("resume");
    startMusic();
  }
  beat = 0;
}

// A pause silences everything; made by the player, it then plays its blip.
// The pause by itself, when the page goes out of sight, makes no sound.
function pauseGame(byPlayer = true) {
  if (!apply(pause)) return;
  stopMusic();
  hush();
  if (byPlayer) sound("pause");
  showSheet("paused");
}

// The Play button of the panels a visit starts with.
function play() {
  resumeGame();
}

// "How to play" has been closed once: it will not show by itself again.
function markSeen() {
  if (seen) return;
  seen = true;
  persist();
}

// Steering does nothing while a panel is open, or after a fault; the key then stays with the browser.
function steer(fn, ...args) {
  if (sheetName || broken) return false;
  apply(fn, ...args);
  return true;
}

// The pause button, P and Escape: pause, resume, or one step back out of a help.
function pauseKey() {
  if (broken) return false;
  if (!sheetName) pauseGame();
  else if (sheetName === "paused") resumeGame();
  else if (sheetFrom) showSheet(sheetFrom);
  else if (sheetName === "how") play();
  else return false;
  return true;
}

// ---------- Light and dark ----------

const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
const isDark = () => dark ?? systemDark.matches;

// The player's choice sets a class on the root that wins over the system's setting.
function showSide() {
  root.classList.toggle("dark", dark === true);
  root.classList.toggle("light", dark === false);
  redrawAll();
}

function setDark(value) {
  dark = value;
  showSide();
  persist();
}

// ---------- The look: colours and sizes come from the variables of style.css ----------

let look = null;

function readLook() {
  const css = getComputedStyle(root);
  const colour = (name) => css.getPropertyValue(name).trim();
  const size = (name) => parseFloat(css.getPropertyValue(name)) || 0;
  look = {
    page: colour("--page"),
    screen: colour("--screen"),
    well: colour("--well"),
    grid: colour("--grid"),
    frame: colour("--frame"),
    text: colour("--text"),
    key: colour("--key"),
    edge: colour("--edge"),
    icon: colour("--icon"),
    tones: { 1: colour("--tone-1"), 2: colour("--tone-2"), 3: colour("--tone-3") },
    far: { 1: colour("--far-1"), 2: colour("--far-2"), 3: colour("--far-3") },
    line: colour("--line"),
    title: {
      line: colour("--title-line"), top: colour("--title-top"), bottom: colour("--title-bottom"),
      glint: colour("--title-glint"), shade: colour("--title-shade"),
    },
    inner: size("--inner"),
    partGap: size("--part-gap"),
    labelGap: size("--label-gap"),
    header: size("--header"),
    pause: size("--pause"),
    titleHigh: size("--title-high"),
    titleSmall: size("--title-high-small"),
    px: size("--px"),
    dot: size("--dot"),
    lift: size("--lift"),
  };
  // The browser's own bars take the page colour of the side in use.
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.content = look.page;
  // How long things take to move, in ms; all 0 with "reduce motion" on.
  motion = { glide: size("--glide"), fade: size("--fade"), press: size("--press"), level: size("--level-up"), over: size("--over"), title: size("--title"), rain: size("--rain") };
  // The one button a panel wants pressed first wears the colours the other way round.
  look.primary = { key: look.icon, edge: look.edge, icon: look.key };
}

// ---------- The measures of the screen, in device pixels ----------

let geo = null;

// Lays a canvas on whole device pixels inside the box of the element that holds it: the box is cut
// to the device-pixel grid, and the backing store is that cut box, one to one. Nothing is resampled,
// so pixel art stays sharp at any devicePixelRatio. Answers the canvas's place in CSS pixels too.
function fitCanvas(canvas, box, ratio) {
  const snap = 0.001;  // forgives the last digits of a measured box
  const hair = 0.004;  // keeps a rounded-off size from ever shrinking the picture, which would smooth it
  const left = Math.ceil(box.left * ratio - snap);
  const top = Math.ceil(box.top * ratio - snap);
  const w = Math.max(1, Math.floor(box.right * ratio + snap) - left);
  const h = Math.max(1, Math.floor(box.bottom * ratio + snap) - top);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  canvas.style.left = `${(left + hair) / ratio - box.left}px`;
  canvas.style.top = `${(top + hair) / ratio - box.top}px`;
  canvas.style.width = `${(w + hair) / ratio}px`;
  canvas.style.height = `${(h + hair) / ratio}px`;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { ctx, w, h, left: left / ratio, top: top / ratio };
}

// The tile of each colour number, drawn once at the given size of an art pixel.
function makeTiles(a) {
  return [0, 1, 2, 3, 4].map((slot) => {
    const tile = document.createElement("canvas");
    tile.width = tile.height = ART * a;
    drawTile(tile.getContext("2d"), 0, 0, a, slot, look.tones);
    return tile;
  });
}

function measure() {
  const ratio = window.devicePixelRatio || 1;
  const box = panel.getBoundingClientRect();
  const area = wellArea.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return;
  const px = (v) => Math.round(v * ratio);
  const fit = fitCanvas(screen, box, ratio);

  // The square: room for 8 x 14 squares and the frame, an eighth of a square on each side,
  // rounded down so that an eighth of a square is a whole number of device pixels.
  const raw = Math.min(area.width / (WIDTH + 2 / ART), area.height / (HEIGHT + 2 / ART));
  const a = Math.max(1, Math.floor((raw * ratio + 0.001) / ART));
  const cell = ART * a;
  const areaX = px(area.left - fit.left);
  const areaY = px(area.top - fit.top);
  const small = Math.max(1, px(look.dot));
  // The tiles of the next piece are never drawn larger than their size in CSS pixels,
  // so two rows of them always fit under the label.
  const tiny = Math.max(1, Math.floor(look.dot * ratio + 0.001));

  geo = {
    ratio, px,
    ctx: fit.ctx,
    w: fit.w,
    h: fit.h,
    u: Math.max(1, px(look.px)),   // a pixel of the numbers and the button pictures
    dot: small,                    // a dot of the small labels
    tiny,                          // an art pixel of the next piece
    a, cell,
    wellX: areaX + Math.round((px(area.width) - WIDTH * cell) / 2),
    wellY: areaY + Math.round((px(area.height) - HEIGHT * cell) / 2),
    tiles: makeTiles(a),
    smallTiles: makeTiles(tiny),
  };
  dirty = true;
}

// ---------- Drawing the game screen ----------

function drawHeader() {
  const { ctx, px, u, dot, tiny, w, smallTiles } = geo;
  const top = px(look.inner);
  const partGap = px(look.partGap);
  const valueY = top + SIGN_HEIGHT * dot + px(look.labelGap);

  // On the right, beside the pause button: the next piece under its label.
  const square = ART * tiny;
  const column = Math.max(textWidth(T.next, dot), 4 * square);
  const nextX = w - px(look.inner) - px(look.pause) - partGap - column;
  drawText(ctx, T.next, nextX + Math.round((column - textWidth(T.next, dot)) / 2), top, dot, look.text);
  const squares = cells(game.next, 0);
  const minX = Math.min(...squares.map(([x]) => x));
  const minY = Math.min(...squares.map(([, y]) => y));
  const cols = Math.max(...squares.map(([x]) => x)) - minX + 1;
  const rows = Math.max(...squares.map(([, y]) => y)) - minY + 1;
  const pieceX = nextX + Math.round((column - cols * square) / 2);
  const pieceY = valueY + Math.round(((2 - rows) * square) / 2);
  for (const [x, y] of squares) {
    ctx.drawImage(smallTiles[slotOf(game.next)], pieceX + (x - minX) * square, pieceY + (y - minY) * square);
  }

  // Beside it: the level, a small label over its number. It keeps its place whatever the score.
  const level = String(game.level);
  const levelX = nextX - partGap - Math.max(textWidth(T.level, dot), textWidth(level, u));
  drawText(ctx, T.level, levelX, top, dot, look.text);
  if (performance.now() - levelUp < motion.level) {
    // A new level: for a moment its number stands on a plate, the colours the other way round.
    ctx.fillStyle = look.text;
    ctx.fillRect(levelX - u, valueY - u, textWidth(level, u) + 2 * u, (SIGN_HEIGHT + 2) * u);
    drawText(ctx, level, levelX, valueY, u, look.screen);
  } else {
    drawText(ctx, level, levelX, valueY, u, look.text);
  }

  // On the left: the score. A very long score is written smaller, so that it stays clear of the level.
  const left = px(look.inner);
  const score = thousands(game.score);
  const scoreDot = textWidth(score, u) <= levelX - partGap - left ? u : dot;
  drawText(ctx, T.score, left, top, dot, look.text);
  drawText(ctx, score, left, valueY, scoreDot, look.text);
}

// The order in which the art pixels of a fading row go, so that it thins out evenly.
const DISSOLVE = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

function drawWell(now) {
  const { ctx, a, cell, wellX, wellY, tiles } = geo;
  const wide = WIDTH * cell;
  const high = HEIGHT * cell;

  // The frame, one art pixel wide, and the well inside it.
  ctx.fillStyle = look.frame;
  ctx.fillRect(wellX - a, wellY - a, wide + 2 * a, high + 2 * a);
  ctx.fillStyle = look.well;
  ctx.fillRect(wellX, wellY, wide, high);

  // The grid: one art pixel in the lower right corner of every square but those of the last
  // column and row, so a tile covers its own square's dot and never part of another.
  ctx.fillStyle = look.grid;
  for (let y = 0; y < HEIGHT - 1; y++) {
    for (let x = 0; x < WIDTH - 1; x++) ctx.fillRect(wellX + x * cell + (ART - 1) * a, wellY + y * cell + (ART - 1) * a, a, a);
  }

  // Nothing is drawn outside the well, also not by a piece that gives its press on the floor.
  ctx.save();
  ctx.beginPath();
  ctx.rect(wellX, wellY, wide, high);
  ctx.clip();

  // The settled blocks. While full rows fade, the well is shown as it was with them.
  const well = fading ? fading.well : game.well;
  // A piece that has just settled gives a short press: one art pixel down and back.
  const dip = pressing ? Math.round(a * Math.sin((Math.PI * (now - pressing.start)) / motion.press)) : 0;
  const pressed = (x, y) => dip > 0 && pressing.squares.some(([px, py]) => px === x && py === y);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const kind = well[y][x];
      if (kind) ctx.drawImage(tiles[slotOf(kind)], wellX + x * cell, wellY + y * cell + (pressed(x, y) ? dip : 0));
    }
  }

  // The full rows thin out, art pixel by art pixel, until they are gone.
  if (fading) {
    const gone = ((now - fading.start) / motion.fade) * 16;
    ctx.fillStyle = look.well;
    for (const y of fading.rows) {
      for (let j = 0; j < ART; j++) {
        for (let i = 0; i < WIDTH * ART; i++) {
          if (DISSOLVE[j % 4][i % 4] < gone) ctx.fillRect(wellX + i * a, wellY + y * cell + j * a, a, a);
        }
      }
    }
  }

  const { piece } = game;
  if (piece) {
    // The landing shadow: one outline round the squares where the piece will land,
    // one art pixel wide and closed at inside corners. It waits while rows are still fading.
    if (!fading) {
      const land = landing(game);
      const shadow = cells(land.kind, land.rot).map(([x, y]) => [land.x + x, land.y + y]);
      const has = (x, y) => shadow.some(([sx, sy]) => sx === x && sy === y);
      ctx.fillStyle = look.line;
      for (const [x, y] of shadow) {
        const sx = wellX + x * cell;
        const sy = wellY + y * cell;
        if (!has(x, y - 1)) ctx.fillRect(sx, sy, cell, a);
        if (!has(x, y + 1)) ctx.fillRect(sx, sy + cell - a, cell, a);
        if (!has(x - 1, y)) ctx.fillRect(sx, sy, a, cell);
        if (!has(x + 1, y)) ctx.fillRect(sx + cell - a, sy, a, cell);
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          if (has(x + dx, y) && has(x, y + dy) && !has(x + dx, y + dy)) {
            ctx.fillRect(dx < 0 ? sx : sx + cell - a, dy < 0 ? sy : sy + cell - a, a, a);
          }
        }
      }
    }

    // The falling piece, on its way during a glide, always on whole device pixels.
    const shown = shownPiece(now);
    const pieceX = wellX + Math.round(shown.x * cell);
    const pieceY = wellY + Math.round(shown.y * cell);
    for (const [x, y] of cells(piece.kind, piece.rot)) {
      ctx.drawImage(tiles[slotOf(piece.kind)], pieceX + x * cell, pieceY + y * cell);
    }
  }
  ctx.restore();
}

function draw(now) {
  if (!geo) return;
  const { ctx, w, h, u } = geo;
  ctx.clearRect(0, 0, w, h);
  // The panel: the screen colour, its corners cut in two pixel steps.
  pixelRect(ctx, 0, 0, w, h, u, look.screen);
  drawHeader();
  drawWell(now);
}

// ---------- Painting the buttons, the lettering and the ground of the panels ----------

// Every element that holds a canvas of its own is listed here with the function that paints it.
const painted = new Map();
const pressed = new Set();

function paint(host) {
  const painter = painted.get(host);
  const canvas = host.querySelector(":scope > canvas");
  const box = host.getBoundingClientRect();
  if (!geo || !painter || !canvas || box.width < 1 || box.height < 1) return;
  const { ctx, w, h } = fitCanvas(canvas, box, geo.ratio);
  ctx.clearRect(0, 0, w, h);
  painter(ctx, w, h);
}

function paintAll() {
  for (const host of [...painted.keys()]) {
    if (host.isConnected) paint(host);
    else painted.delete(host);
  }
}

function redrawAll() {
  readLook();
  measure();
  fitTitle();
  paintAll();
}

function setPressed(button, down) {
  if (down) pressed.add(button);
  else pressed.delete(button);
  paint(button);
}

// The buttons of the game screen: the pause button and the five steering buttons.
for (const button of gameButtons) {
  painted.set(button, (ctx, w, h) => {
    drawKey(ctx, w, h, geo.u, geo.px(look.lift), look, button.dataset.icon, pressed.has(button));
  });
}

// The ground of a panel is the screen's own: the screen colour, corners cut in two pixel steps.
painted.set(sheet, (ctx, w, h) => pixelRect(ctx, 0, 0, w, h, geo.u, look.screen));

// ---------- The panels ----------

let sheetName = null;  // the panel that is open: "start", "paused", "over", "how" or "home"
let sheetFrom = null;  // the panel a help was opened from, to go back to

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// Gives an element a canvas of its own and the function that paints it.
function withCanvas(node, painter) {
  const canvas = el("canvas", "pixels");
  canvas.setAttribute("aria-hidden", "true");
  node.prepend(canvas);
  painted.set(node, painter);
  return node;
}

// A line of pixel lettering, centred. The words are there for screen readers too.
function pixelLine(text, { small = false, kind = "", tag = "p" } = {}) {
  const node = el(tag, `pixel-line${small ? " small" : ""}${kind ? ` ${kind}` : ""}`);
  node.append(el("span", "sr-only", text));
  return withCanvas(node, (ctx, w, h) => {
    // Lettering too wide for its line is written smaller.
    const dot = !small && textWidth(text, geo.u) <= w ? geo.u : geo.dot;
    drawText(ctx, text, Math.round((w - textWidth(text, dot)) / 2), Math.round((h - SIGN_HEIGHT * dot) / 2), dot, look.text);
  });
}

// A button of a panel. `value`, when given, is shown on the right, as for a switch.
function menuKey(label, onPress, { primary = false, value } = {}) {
  const button = el("button", `key wide${primary ? " primary" : ""}`);
  button.type = "button";
  button.setAttribute("aria-label", label);
  const shown = { label, value, primary };
  withCanvas(button, (ctx, w, h) => {
    const picture = { label: shown.label, value: shown.value, dot: geo.dot };
    drawKey(ctx, w, h, geo.u, geo.px(look.lift), shown.primary ? look.primary : look, picture, pressed.has(button));
  });
  button.addEventListener("click", () => onPress());
  button.addEventListener("pointerdown", () => setPressed(button, true));
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) button.addEventListener(type, () => setPressed(button, false));
  // New words are told to screen readers too; `primary` puts on or takes off the colours of the button to press.
  const set = (changes) => {
    Object.assign(shown, changes);
    button.setAttribute("aria-label", shown.label);
    button.classList.toggle("primary", shown.primary);
    paint(button);
  };
  return { button, set };
}

// A switch: a button that shows On or Off and says so to screen readers.
function switchKey(label, isOn, toggle) {
  const key = menuKey(label, () => {
    toggle();
    key.button.setAttribute("aria-checked", String(isOn()));
    key.set({ value: isOn() ? T.on : T.off });
  }, { value: isOn() ? T.on : T.off });
  key.button.setAttribute("role", "switch");
  key.button.setAttribute("aria-checked", String(isOn()));
  return key;
}

const sentence = (text, className = "words") => el("p", className, text);

// The switches that both menus hold.
function switches() {
  return [
    switchKey(T.music, () => music, () => {
      music = !music;
      setMusic(music);
      persist();
    }).button,
    switchKey(T.sounds, () => sounds, () => {
      sounds = !sounds;
      setSounds(sounds);
      persist();
    }).button,
    switchKey(T.dark, isDark, () => setDark(!isDark())).button,
  ];
}

// The two helps, as both menus offer them. A game that already runs from the home screen needs no help with it.
function helps(from) {
  const keys = [menuKey(T.howToPlay, () => showSheet("how", from)).button];
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (!standalone) keys.push(menuKey(T.homeScreen, () => showSheet("home", from)).button);
  return keys;
}

const versionLine = () => pixelLine(`${T.versionLabel} ${T.version}`, { small: true, kind: "foot" });

// The title: the game's name, large, on the panel a visit starts with (design section 6).
// Its last line falls into place when the panel opens: sign after sign, each landing with the
// small press of a piece that settles. With "reduce motion" on it simply stands there.
let titleHost = null;       // the title that is on the screen, if any
let titleStart = -Infinity; // when it showed
let titleSub = 0;           // one small pixel of it in device pixels, as its panel allows (fitTitle)
let steady = false;         // the open menu is being built again as it is: its title stays where it stands

// Behind the title a couple of the game's own pieces fall, square by square, in quieter tones: they
// say what the game is about, and the name stays easy to read. With "reduce motion" on they stand still.
const RAIN = 4;       // how many pieces fall at a time
const RAIN_TOP = -4;  // the row a piece starts from, above the canvas
const RAIN_ROOM = 6;  // how many squares of open ground the rain gets above the title, where the screen has the room
let rain = null;      // { cols, rows, pieces: [{ kind, rot, third, x, y }] }, in squares of the rain
let rainAt = 0;       // when the pieces last fell a square

const pick = (n) => Math.floor(Math.random() * n);

// A new piece for the rain: any of the ten, turned any way, somewhere in its own third of the width.
function rainPiece(cols, third, y) {
  const kind = 1 + pick(10);
  const rot = pick(4);
  const wide = Math.max(...cells(kind, rot).map(([x]) => x)) + 1;
  const from = Math.floor((third * cols) / RAIN);
  const room = Math.max(1, Math.floor(cols / RAIN) - wide + 1);
  return { kind, rot, third, x: Math.min(cols - wide, from + pick(room)), y };
}

// The rain on a canvas of w x h, where one art pixel is `a` device pixels. The pieces keep an even
// distance from top to bottom, each in its own part of the width, so that one of them is always in view.
function drawRain(ctx, w, h, a) {
  const square = ART * a;
  const cols = Math.max(RAIN * 2, Math.floor(w / square));
  const rows = Math.ceil(h / square);
  if (!rain || rain.cols !== cols || rain.rows !== rows) {
    // Which part of the width comes first is left to chance, so that the pieces do not come down like a stair.
    const order = Array.from({ length: RAIN }, (_, i) => i).sort(() => Math.random() - 0.5);
    const round = rows + 1 - RAIN_TOP;
    rain = { cols, rows, pieces: order.map((third, i) => rainPiece(cols, third, RAIN_TOP + Math.round((i * round) / RAIN))) };
  }
  const left = Math.floor((w - cols * square) / 2);
  for (const piece of rain.pieces) {
    for (const [x, y] of cells(piece.kind, piece.rot)) {
      const top = (piece.y + y) * square;
      if (top + square > 0 && top < h) drawTile(ctx, left + (piece.x + x) * square, top, a, slotOf(piece.kind), look.far);
    }
  }
}

// Every piece of the rain falls one square; one that has left at the bottom comes again at the top.
function stepRain() {
  if (!rain) return;
  rain.pieces = rain.pieces.map((piece) => (piece.y >= rain.rows ? rainPiece(rain.cols, piece.third, RAIN_TOP) : { ...piece, y: piece.y + 1 }));
}

// How far above its place sign i of the n signs of the last line stands right now, in device
// pixels; null while it has not appeared yet. One small pixel of the title is `sub` device pixels.
// A sign falls two dots, which are four small pixels.
function titleLift(i, n, sub) {
  if (!(motion.title > 0)) return 0;
  // The signs start one after another; each falls for 1.45 and presses for 0.9 of the time between two starts.
  const step = motion.title / (n - 1 + 2.35);
  const since = performance.now() - titleStart - i * step;
  if (since < 0) return null;
  const fall = 1.45 * step;
  const press = 0.9 * step;
  if (since < fall) return Math.round(4 * sub * (1 - (since / fall) ** 2));
  if (since < fall + press) return -Math.round(sub * Math.sin((Math.PI * (since - fall)) / press));
  return 0;
}

// small: the title stays at its smaller size, as above "How to play"; otherwise it may grow to its full size.
function titleArt(small = false) {
  const node = el("h2", `title-art${small ? " small" : ""}`);
  node.append(el("span", "sr-only", T.name));
  titleHost = node;
  if (!steady) {
    titleStart = performance.now();
    rain = null;
    rainAt = titleStart;
  }
  return withCanvas(node, (ctx, w, h) => {
    // A square of the rain is as wide as a stroke of the title's letters: four of its small pixels.
    const sub = titleSub || titleScale(w, h, T.nameLines);
    drawRain(ctx, w, h, Math.max(1, Math.floor(sub / 2)));
    drawTitle(ctx, w, h, T.nameLines, look.title, titleLift, true, sub);
  });
}

// The title takes the room its panel leaves it: as large as whole device pixels allow, up to its
// full size. On a low screen it shrinks, so that the buttons under it need no scrolling.
// Its box is made exactly as high as the title is drawn, so no room is lost.
function fitTitle() {
  if (!titleHost || !titleHost.isConnected || !geo) return;
  const [across, rows] = titleSize(T.nameLines);
  const most = titleHost.classList.contains("small") ? look.titleSmall : look.titleHigh;
  const style = getComputedStyle(sheetBody);
  const box = titleHost.getBoundingClientRect();
  const others = titleHost.parentElement.getBoundingClientRect().height - box.height;
  const room = sheetBody.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - others;
  // One small pixel of the title, in device pixels: what its height may be and its column's width allow.
  const small = Math.max(1, Math.min(
    Math.floor((Math.min(most, room) * geo.ratio + 0.001) / rows),
    Math.floor((box.width * geo.ratio + 0.001) / across),
  ));
  // Where the screen has room left, the box is a few squares of the rain higher than the title,
  // which stands at its foot: the pieces are seen falling on the open ground above the name
  // before they pass behind its letters.
  titleSub = small;
  const square = ART * Math.max(1, Math.floor(small / 2));
  const spare = Math.max(0, Math.min(Math.floor((room * geo.ratio - small * rows) / square), RAIN_ROOM));
  titleHost.style.height = `${(small * rows + spare * square) / geo.ratio}px`;
}

// The best score, in both menus, once there is one.
const bestLine = () => (best > 0 ? [pixelLine(`${T.best} ${thousands(best)}`, { small: true })] : []);

// When nothing can be kept, both menus say so in one plain line (finding A07).
const unkeptLine = () => (lost ? [sentence(T.unkept, "words spaced")] : []);

const SHEETS = {
  // What a visit starts with once "How to play" has been seen.
  start(column) {
    column.append(
      titleArt(),
      ...bestLine(),
      menuKey(T.play, play, { primary: true }).button,
      ...switches(),
      ...helps("start"),
      ...unkeptLine(),
      versionLine(),
    );
    return T.name;
  },

  paused(column) {
    // New game asks once more when there is a game to lose, and takes the answer only from an
    // unhurried press: a double tap or a held key never loses the game.
    const worth = game.score > 0 || game.well.some((row) => row.some((v) => v !== 0));
    const sure = patience(SURE_REST);
    let armed = false;
    const fresh = menuKey(T.newGame, () => {
      if (worth && !armed) {
        armed = true;
        sure.start();
        fresh.set({ label: T.sure });
        setTimeout(() => {
          armed = false;
          fresh.set({ label: T.newGame });
        }, 3000);
        return;
      }
      if (!worth || sure.press()) startGame();
    });
    column.append(
      pixelLine(T.paused, { kind: "title", tag: "h2" }),
      ...bestLine(),
      menuKey(T.resume, resumeGame, { primary: true }).button,
      fresh.button,
      ...switches(),
      ...helps("paused"),
      ...unkeptLine(),
      versionLine(),
    );
    return T.paused;
  },

  over(column) {
    column.append(
      pixelLine(T.gameOver, { kind: "title", tag: "h2" }),
      pixelLine(`${T.score} ${thousands(game.score)}`),
      pixelLine(`${T.best} ${thousands(best)}`),
    );
    if (newBest) column.append(pixelLine(T.newBest, { small: true }));
    // New game rests for a moment after the end of a game. It wears the colours of the button to
    // press only once it answers, and a press that comes too soon puts that moment off.
    let timer = 0;
    const again = menuKey(T.newGame, () => {
      if (overWait.press()) startGame();
      else ready();
    });
    const ready = (first = false) => {
      clearTimeout(timer);
      const left = overWait.left();
      again.set({ primary: left === 0 });
      if (left > 0 && (first === true || again.button.isConnected)) timer = setTimeout(ready, left + 5);
    };
    again.button.classList.add("spaced");
    column.append(again.button);
    ready(true);
    return T.gameOver;
  },

  // Four short lines, each with a small picture; for fingers on a touch screen, for keys otherwise.
  how(column) {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const lines = touch ? T.how.touch : T.how.keys;
    const pictures = [["left", "right"], ["turn"], ["down", "drop"], null];
    // At the first start of a visit the game's name stands above it, a little smaller.
    if (!sheetFrom) column.append(titleArt(true));
    column.append(pixelLine(T.howToPlay, { kind: "title", tag: "h2" }));
    lines.forEach((text, i) => {
      const row = el("div", "how-row");
      const picture = withCanvas(el("div", "how-picture"), (ctx, w, h) => {
        const icons = pictures[i];
        if (icons) {
          // The pictures stand side by side, three dots apart, in the middle.
          const widths = icons.map((name) => ICONS[name][0].length * geo.dot);
          const gap = 3 * geo.dot;
          let x = Math.round((w - widths.reduce((sum, v) => sum + v, 0) - gap * (icons.length - 1)) / 2);
          icons.forEach((name, n) => {
            drawIcon(ctx, name, x + widths[n] / 2, h / 2, geo.dot, look.text);
            x += widths[n] + gap;
          });
        } else {
          // A full row: four tiles side by side.
          const size = ART * geo.tiny;
          const x0 = Math.round((w - 4 * size) / 2);
          const y0 = Math.round((h - size) / 2);
          for (let n = 0; n < 4; n++) ctx.drawImage(geo.smallTiles[n], x0 + n * size, y0);
        }
      });
      row.append(picture, sentence(text));
      column.append(row);
    });
    column.append(sentence(touch ? T.how.touchAlso : T.how.keysAlso, "words spaced"));
    const close = sheetFrom ? menuKey(T.back, () => showSheet(sheetFrom), { primary: true }) : menuKey(T.play, play, { primary: true });
    close.button.classList.add("spaced");
    column.append(close.button);
    return T.howToPlay;
  },

  // Two short how-tos; the one that fits the phone comes first.
  home(column) {
    const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const order = apple ? [T.home.iphone, T.home.android] : [T.home.android, T.home.iphone];
    column.append(pixelLine(T.homeScreen, { kind: "title", tag: "h2" }), sentence(T.home.intro));
    for (const how of order) {
      const block = el("p", "words spaced");
      block.append(el("strong", "", `${how.title}: `), how.text);
      column.append(block);
    }
    const back = menuKey(T.back, () => showSheet(sheetFrom || "paused"), { primary: true }).button;
    back.classList.add("spaced");
    column.append(back);
    return T.homeScreen;
  },
};

function showSheet(name, from = null) {
  if (sheetName === "how" && name !== "how") markSeen();
  sheetName = name;
  sheetFrom = from;
  titleHost = null;
  const column = el("div", "sheet-column");
  sheet.setAttribute("aria-label", SHEETS[name](column));
  sheetBody.replaceChildren(column);
  sheetBody.scrollTop = 0;
  sheet.hidden = false;
  shownMenu = menuShows(name);
  fitTitle();
  paintAll();
  // The keyboard starts on the button the panel wants pressed first.
  (column.querySelector(".key.primary") || column.querySelector(".key"))?.focus({ preventScroll: true });
}

function hideSheet() {
  if (sheetName === "how") markSeen();
  sheetName = null;
  sheetFrom = null;
  sheet.hidden = true;
  sheetBody.replaceChildren();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

// What a menu shows, in short: its name, the best score, the switches, the line on keeping, and
// whether New game asks first.
const menuShows = (name) => JSON.stringify([name, best, music, sounds, isDark(), lost, game.score > 0 || game.well.some((row) => row.some((v) => v !== 0))]);
let shownMenu = "";  // what the open panel showed when it was built

// Builds the open menu again, as `name`, with what is known now, but only when that has changed: a
// press on a button that a rebuild would have changed nothing on is never lost. The focus stays on
// the button it was on, and a title that is already on the screen stays where it stands.
function refreshSheet(name) {
  if (name === sheetName && menuShows(name) === shownMenu) return;
  const focused = sheet.contains(document.activeElement) ? document.activeElement.getAttribute("aria-label") : null;
  steady = name === sheetName;
  try {
    showSheet(name);
  } finally {
    steady = false;
  }
  if (focused) [...sheet.querySelectorAll("button")].find((button) => button.getAttribute("aria-label") === focused)?.focus({ preventScroll: true });
}

// ---------- Another open page of the game ----------

// The page holds the game that is kept now, paused, or a new game when none is kept. Answers whether
// a game is kept.
function takeGame() {
  const back = broughtBack(load(storage).game);
  game = back ?? pause(newGame(newSeed()));
  glide = null;
  fading = null;
  pressing = null;
  levelUp = -Infinity;
  falling++;
  dirty = true;
  return back !== null;
}

// Another page of the game has kept something: the browser says so with a storage event (finding
// A06). The side, the two sound switches, the best score and "How to play" seen are taken over as
// they are kept now, so that this page never writes its older switches over newer ones. A page that
// has not played takes over the game in progress too, and its menu shows that game, paused: its Play
// goes on with it instead of putting an older game in its place. So does a page whose game is over
// once another page keeps one in progress: its New game then asks first, as over any game to lose.
function takeOver() {
  if (broken) return;
  const there = load(storage);
  best = Math.max(best, there.best);
  seen = seen || there.seen;
  if (there.music !== music) {
    music = there.music;
    setMusic(music);
  }
  if (there.sounds !== sounds) {
    sounds = there.sounds;
    setSounds(sounds);
  }
  if (there.dark !== dark) {
    dark = there.dark;
    showSide();
  }
  if (!mine) {
    const menu = takeGame() ? "paused" : "start";
    tellStatus();
    if (sheetFrom === "start" || sheetFrom === "paused") sheetFrom = menu;
    if (sheetName === "start" || sheetName === "paused") refreshSheet(menu);
  } else if (game.status === "over" && broughtBack(there.game)) {
    // The game that is kept is now this page's to show, not its own to write: it has not played it.
    clearTimeout(overTimer);
    mine = false;
    takeGame();
    tellStatus();
    showSheet("paused");
  } else if (sheetName === "paused") {
    refreshSheet("paused");
  }
}

// The line round the button that has the focus shows only while the keys are in use: a key marks
// the root, and a finger or the mouse takes the mark away (style.css draws the line).
window.addEventListener("keydown", () => {
  if (!root.hasAttribute("data-keys")) root.setAttribute("data-keys", "");
}, true);
window.addEventListener("pointerdown", () => root.removeAttribute("data-keys"), true);

// In a panel, Tab and the up and down arrows go round its buttons.
sheet.addEventListener("keydown", (event) => {
  const keys = [...sheet.querySelectorAll("button")];
  if (keys.length === 0) return;
  const at = keys.indexOf(document.activeElement);
  let to = -1;
  if (event.key === "Tab") to = event.shiftKey ? (at <= 0 ? keys.length - 1 : at - 1) : (at + 1) % keys.length;
  else if (event.key === "ArrowDown") to = (at + 1) % keys.length;
  else if (event.key === "ArrowUp") to = at <= 0 ? keys.length - 1 : at - 1;
  if (to < 0) return;
  event.preventDefault();
  keys[to].focus();
});

// ---------- The safety net ----------

// A fault in the game's own code never leaves a frozen picture with the tune going on, nor an empty
// page (finding A08). The game stops where it is, everything falls silent, and one plain line says
// so over the page, in the phone's own typeface: the drawing may be what failed. What was kept is
// left alone, so a reload brings back the game as it was last saved, paused. The fault itself goes
// to the console only, never to the screen.
function fault(error) {
  if (broken) return;
  broken = true;
  console.error(error);
  try {
    if (game.status === "playing") game = pause(game);
  } catch {
    // The game stays as it was: nothing plays it any more.
  }
  stopMusic();
  rest();  // every effect falls silent too, and out of sight the sound engine rests
  const line = el("p", "fault", T.fault);
  line.setAttribute("role", "alert");
  document.body.append(line);
  // Nothing under the line takes a press or the focus any more.
  document.querySelector("main")?.setAttribute("inert", "");
}

// A redraw that the browser asks for (a new size, sharpness or side) has the same safety net.
const guarded = (fn) => (...args) => {
  if (broken) return undefined;
  try {
    return fn(...args);
  } catch (error) {
    fault(error);
    return undefined;
  }
};

// ---------- The loop ----------

let last = 0;
const FRAME_GAP = 1000;  // ms between two frames after which the game counts as having been out of sight

function frame(now) {
  if (broken) return;
  try {
    // No frame for more than a second: the page was not being drawn, though nobody said so (a host
    // can hide a page without telling it). The game pauses, as it does when it leaves the screen.
    if (last && now - last > FRAME_GAP && game.status === "playing") pauseGame(false);
    // A long gap between two frames counts as a short one: the piece never jumps rows.
    const passed = last ? Math.min(now - last, 100) : 0;
    last = now;
    alive();
    if (game.status === "playing") {
      beat += passed;
      const length = interval(game.level);
      if (beat >= length) {
        beat -= length;
        apply(tick);
      }
    }
    // The title's last line falls into place: its canvas is drawn again until every sign has landed.
    if (titleHost && titleHost.isConnected) {
      const falling = motion.rain > 0 && now - rainAt >= motion.rain;
      if (falling) {
        rainAt = now;
        stepRain();
      }
      if (falling || now - titleStart <= motion.title + 40) paint(titleHost);
    }
    // While something moves, every frame is drawn.
    if (moving(now)) dirty = true;
    if (dirty) {
      dirty = false;
      draw(now);
    }
  } catch (error) {
    // A fault while the game is played or drawn: the safety net, and no more frames.
    fault(error);
    return;
  }
  requestAnimationFrame(frame);
}

// ---------- Start ----------

// A fault while starting, as in a browser too old for the game, shows the plain line of the safety
// net instead of an empty page.
try {
  byId("name").textContent = T.name;
  screen.setAttribute("aria-label", T.field);
  byId("keys").setAttribute("aria-label", T.steering);
  for (const button of gameButtons) button.setAttribute("aria-label", T.buttons[button.dataset.act]);

  startInput({
    actions: {
      left: () => steer(move, -1),
      right: () => steer(move, 1),
      down: () => steer(softDrop),
      turn: () => steer(rotate),
      drop: () => steer(hardDrop),
      pause: pauseKey,
    },
    // The five steering buttons and the pause button.
    buttons: gameButtons.map((element) => ({ element, act: element.dataset.act })),
    press: setPressed,
    // A finger on the panel below the header steers too.
    strokes: { element: panel, top: () => wellArea.getBoundingClientRect().top - 1, open: () => !sheetName, piece: () => falling },
    squareSize: () => (geo ? geo.cell / geo.ratio : 32),
    unlock,
  });

  // The game pauses by itself when the page goes out of sight, and the sound rests.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) return;
    pauseGame(false);
    rest();
  });

  // It pauses by itself too when its window loses the keyboard while it stays on the screen: on a
  // PC, a click on another window, after which the keys no longer reach the game (finding A03).
  window.addEventListener("blur", (event) => {
    if (event.target === window) pauseGame(false);
  });

  // Whatever closes the page, the game as it stands is kept. A page that has changed nothing writes
  // nothing: it would only undo what another page of the game has saved.
  window.addEventListener("pagehide", () => {
    if (unsaved) persist();
  });

  // Another page of the game has kept something (finding A06).
  window.addEventListener("storage", (event) => {
    if (event.storageArea === storage && event.key === KEY && event.newValue !== null) takeOver();
  });

  // Draw again when the screen changes size, sharpness or side.
  new ResizeObserver(guarded(redrawAll)).observe(panel);
  new ResizeObserver(guarded(redrawAll)).observe(wellArea);
  systemDark.addEventListener("change", guarded(redrawAll));
  // "Reduce motion" may be switched while the game is open: by the system, or by the mark on the root.
  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", guarded(readLook));
  new MutationObserver(guarded(readLook)).observe(root, { attributes: true, attributeFilter: ["data-motion"] });
  (function watchRatio() {
    window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener("change", guarded(() => {
      redrawAll();
      watchRatio();
    }), { once: true });
  })();

  // What was kept comes back: the side, the switches, and the game, which waits paused.
  setMusic(music);
  setSounds(sounds);
  showSide();
  tellStatus();
  // A visit starts with the game that was in progress, or with "How to play" until it has been
  // closed once, and with the menu after that.
  showSheet(restored ? "paused" : seen ? "start" : "how");
  requestAnimationFrame(frame);
} catch (error) {
  fault(error);
}

// Playing without internet: a worker keeps every file of the game (sw.js). Where a page may not have
// one, as in a frame of another site that is closed off, even asking for it fails: the game plays all
// the same, only not without internet. That is no fault of the game's own code.
try {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
} catch {
  // No worker: nothing else changes.
}

// For the checks: a look at the game from the preview's script tool, through import("./app.js").
export const check = {
  state: () => game,
  set: (state) => { game = state; beat = 0; dirty = true; mine = true; unsaved = true; falling++; tellStatus(); },
  sheet: () => sheetName,
  best: () => best,
  measures: () => geo && { ratio: geo.ratio, a: geo.a, cell: geo.cell, wellX: geo.wellX, wellY: geo.wellY, w: geo.w, h: geo.h },
  // What is moving on the screen right now, and where the falling piece is drawn.
  motion: () => {
    const now = performance.now();
    const shown = game.piece ? shownPiece(now) : null;
    return {
      times: { ...motion },
      glide: Boolean(glide), fading: fading ? fading.rows.slice() : null, pressing: Boolean(pressing),
      levelUp: now - levelUp < motion.level,
      shown: shown && { x: shown.x, y: shown.y },
    };
  },
};
