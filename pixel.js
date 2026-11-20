// Pixel art for Slatefall (design v1.1, sections 6 and 8): our own pixel lettering,
// the pictures on the buttons, the tiles of the Slate look, and the functions that draw
// them on a canvas. Everything here is given in whole device pixels. Nothing is imported.

// ---------- The lettering: 5 x 7 dots per sign, 6 dots from one sign to the next ----------

export const FONT = Object.freeze({
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  0: [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  1: ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  3: ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  6: ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  7: ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  9: [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
});

export const SIGN_HEIGHT = 7;
// How far each sign moves the pen, in dots: a space 4, the thin space between thousands 3, all others 6.
const ADVANCE = Object.freeze({ " ": 4, " ": 3 });
const advanceOf = (ch) => ADVANCE[ch] ?? 6;

// The width of a line of lettering, for a dot of the given size.
export function textWidth(text, dot) {
  let dots = 0;
  let gap = 0;
  for (const ch of String(text).toUpperCase()) {
    dots += advanceOf(ch);
    gap = ch in ADVANCE ? 0 : 1;
  }
  return Math.max(0, dots - gap) * dot;
}

// Draws a line of lettering with its top left corner at (x, y).
export function drawText(ctx, text, x, y, dot, colour) {
  ctx.fillStyle = colour;
  let pen = x;
  for (const ch of String(text).toUpperCase()) {
    const sign = FONT[ch];
    if (sign) {
      for (let j = 0; j < SIGN_HEIGHT; j++) {
        const row = sign[j];
        for (let i = 0; i < 5; i++) if (row[i] === "#") ctx.fillRect(pen + i * dot, y + j * dot, dot, dot);
      }
    }
    pen += advanceOf(ch) * dot;
  }
}

// ---------- The title: the game's name, large, in letters of its own ----------

// The signs the title is written in: 6 x 9 dots each, drawn two dots thick. Only the signs the
// name needs are here; a test fails when the name asks for one that is missing.
export const TITLE_FONT = Object.freeze({
  A: [".####.", "######", "##..##", "##..##", "######", "######", "##..##", "##..##", "##..##"],
  E: ["######", "######", "##....", "#####.", "#####.", "##....", "##....", "######", "######"],
  F: ["######", "######", "##....", "#####.", "#####.", "##....", "##....", "##....", "##...."],
  L: ["##....", "##....", "##....", "##....", "##....", "##....", "##....", "######", "######"],
  S: [".#####", "######", "##....", "#####.", ".#####", "....##", "....##", "######", "#####."],
  T: ["######", "######", "..##..", "..##..", "..##..", "..##..", "..##..", "..##..", "..##.."],
});

// Everything in the title is measured in small pixels: a dot is two of them, the line round a sign
// one, its shadow two. A sign is 6 x 9 dots; signs stand 2 dots apart and lines 3 dots apart.
const TITLE_SIGN = [6, 9];
const TITLE_GAP = 2;
const TITLE_LEADING = 3;

// How many small pixels a title of these lines is wide and high, with its line and its shadow.
export function titleSize(lines) {
  const longest = Math.max(...lines.map((line) => [...String(line)].length));
  const wide = (longest * (TITLE_SIGN[0] + TITLE_GAP) - TITLE_GAP) * 2 + 4;
  const high = (lines.length * (TITLE_SIGN[1] + TITLE_LEADING) - TITLE_LEADING) * 2 + 4;
  return [wide, high];
}

// One sign, with its top left corner at (x, y); s is one small pixel in device pixels.
// colours holds { line, top, bottom, glint, shade }: like the blocks, a sign has a dark line round it;
// its face is light above and the middle tone below, with a glint along every top edge.
function drawTitleSign(ctx, sign, x, y, s, colours) {
  const dot = 2 * s;
  const [wide, high] = TITLE_SIGN;
  const on = (i, j) => j >= 0 && j < high && i >= 0 && i < wide && sign[j][i] === "#";
  const each = (draw) => {
    for (let j = 0; j < high; j++) for (let i = 0; i < wide; i++) if (on(i, j)) draw(i, j, x + i * dot, y + j * dot);
  };
  // The shadow: the sign with its line, two small pixels to the lower right.
  ctx.fillStyle = colours.shade;
  each((i, j, px, py) => ctx.fillRect(px + s, py + s, dot + 2 * s, dot + 2 * s));
  ctx.fillStyle = colours.line;
  each((i, j, px, py) => ctx.fillRect(px - s, py - s, dot + 2 * s, dot + 2 * s));
  each((i, j, px, py) => {
    ctx.fillStyle = j < 4 ? colours.top : colours.bottom;
    ctx.fillRect(px, py, dot, dot);
  });
  ctx.fillStyle = colours.glint;
  each((i, j, px, py) => {
    if (!on(i, j - 1)) ctx.fillRect(px, py, dot, s);
  });
}

// Draws the name in its lines on a canvas of w x h, as large as whole device pixels allow: in the
// middle of its width and, with `low`, at its foot (what is above stays free); otherwise in the middle of its height too.
// lift(i, n, s) says how far above its place sign i of the n signs of the last line stands right now,
// in device pixels, or null while it has not appeared: the last line falls into place when the title shows.
// One small pixel of a title of these lines on a canvas of w x h, in device pixels: as large as fits.
export function titleScale(w, h, lines) {
  const [wide, high] = titleSize(lines);
  return Math.max(1, Math.floor(Math.min(w / wide, h / high)));
}

// `scale`, when given, is the size of one small pixel in device pixels; otherwise the largest that fits.
export function drawTitle(ctx, w, h, lines, colours, lift = () => 0, low = false, scale = 0) {
  const [wide, high] = titleSize(lines);
  const s = scale || titleScale(w, h, lines);
  const dot = 2 * s;
  const top = (low ? h - high * s : Math.floor((h - high * s) / 2)) + s;
  lines.forEach((line, row) => {
    const signs = [...String(line).toUpperCase()];
    let pen = Math.floor((w - ((signs.length * (TITLE_SIGN[0] + TITLE_GAP) - TITLE_GAP) * dot + 2 * s)) / 2);
    signs.forEach((ch, i) => {
      const up = row === lines.length - 1 ? lift(i, signs.length, s) : 0;
      if (TITLE_FONT[ch] && up !== null) drawTitleSign(ctx, TITLE_FONT[ch], pen, top + row * (TITLE_SIGN[1] + TITLE_LEADING) * dot - up, s, colours);
      pen += (TITLE_SIGN[0] + TITLE_GAP) * dot;
    });
  });
}

// A number with a thin space between the thousands: 1240 becomes "1 240".
export function thousands(n) {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// ---------- The pictures on the buttons ----------

export const ICONS = Object.freeze({
  left: ["....#", "...##", "..###", ".####", "#####", ".####", "..###", "...##", "....#"],
  right: ["#....", "##...", "###..", "####.", "#####", "####.", "###..", "##...", "#...."],
  down: ["#########", ".#######.", "..#####..", "...###...", "....#...."],
  drop: ["#########", ".#######.", "..#####..", "...###...", "....#....", ".........", "#########", "#########"],
  turn: [
    "....####....",
    "..########..",
    ".###....###.",
    ".##....#####",
    "##......###.",
    "##.......#..",
    "##..........",
    "##........##",
    ".##......##.",
    ".###....###.",
    "..########..",
    "....####....",
  ],
  pause: ["##..##", "##..##", "##..##", "##..##", "##..##", "##..##", "##..##"],
});

// Draws a picture with its middle at (cx, cy); u is the size of one of its pixels.
export function drawIcon(ctx, name, cx, cy, u, colour) {
  const rows = ICONS[name];
  if (!rows) return;
  const x0 = Math.round(cx - (rows[0].length * u) / 2);
  const y0 = Math.round(cy - (rows.length * u) / 2);
  ctx.fillStyle = colour;
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === "#") ctx.fillRect(x0 + i * u, y0 + j * u, u, u);
  });
}

// ---------- The tiles of the Slate look: a square is 8 x 8 art pixels ----------

// One pattern per colour number. 3 is the line round every square, 2 the middle tone, 1 the light tone.
export const TILES = Object.freeze([
  ["33333333", "31212123", "32121213", "31212123", "32121213", "31212123", "32121213", "33333333"], // colour 1, dither
  ["33333333", "31111123", "31111123", "31111123", "31111123", "31111123", "32222223", "33333333"], // colour 2, shaded: a light face, shaded along its right and bottom
  ["33333333", "31111113", "31222223", "31222223", "31222223", "31222223", "31222223", "33333333"], // colour 3, lit: a dark face, lit along its top and left
  ["33333333", "31111113", "31222213", "31211213", "31211213", "31222213", "31111113", "33333333"], // colour 4, box
  ["33333333", "31111113", "31111113", "31111113", "32222223", "32222223", "32222223", "33333333"], // colour 5, halves
]);

export const ART = 8;

// The colour number of a kind, counted from 0 here: kinds 1 and 6 share a pattern, 2 and 7, and so on.
export function slotOf(kind) {
  return (kind - 1) % 5;
}

// Draws the tile of a colour number with its top left corner at (x, y); a is the size of one art pixel.
// tones holds the three tones as { 1: colour, 2: colour, 3: colour }.
export function drawTile(ctx, x, y, a, slot, tones) {
  const recipe = TILES[slot];
  for (let j = 0; j < ART; j++) {
    const row = recipe[j];
    // Runs of the same tone are drawn as one bar.
    let i = 0;
    while (i < ART) {
      let end = i + 1;
      while (end < ART && row[end] === row[i]) end++;
      ctx.fillStyle = tones[row[i]];
      ctx.fillRect(x + i * a, y + j * a, (end - i) * a, a);
      i = end;
    }
  }
}

// ---------- The panel and the buttons ----------

// A rectangle with its corners cut in two pixel steps; u is the size of one step.
export function pixelRect(ctx, x, y, w, h, u, colour) {
  ctx.fillStyle = colour;
  ctx.fillRect(x + 2 * u, y, w - 4 * u, h);
  ctx.fillRect(x + u, y + u, w - 2 * u, h - 2 * u);
  ctx.fillRect(x, y + 2 * u, w, h - 4 * u);
}

// A button on a canvas of w x h: its face stands `lift` above its lower edge, with its picture on it.
// Pressed, the face lies down on the edge. colours holds { key, edge, icon }.
// picture is the name of an icon, or { label, value, dot } for lettering: the label in the middle,
// or, when there is a value, the label on the left and the value on the right.
export function drawKey(ctx, w, h, u, lift, colours, picture, pressed) {
  ctx.clearRect(0, 0, w, h);
  const top = pressed ? lift : 0;
  if (!pressed) pixelRect(ctx, 0, lift, w, h - lift, u, colours.edge);
  pixelRect(ctx, 0, top, w, h - lift, u, colours.key);
  const middle = top + (h - lift) / 2;
  if (typeof picture === "string") {
    drawIcon(ctx, picture, w / 2, middle, u, colours.icon);
    return;
  }
  const { label, value, dot } = picture;
  const y = Math.round(middle - (SIGN_HEIGHT * dot) / 2);
  if (value === undefined) {
    drawText(ctx, label, Math.round((w - textWidth(label, dot)) / 2), y, dot, colours.icon);
  } else {
    const side = 5 * u;
    drawText(ctx, label, side, y, dot, colours.icon);
    drawText(ctx, value, w - side - textWidth(value, dot), y, dot, colours.icon);
  }
}
