// Buttons, fingers and keys, turned into calls (design v1.2, section 7).
// Nothing is imported: app.js hands over the functions to call. Nothing else reads them.

// ---------- The numbers of section 7 ----------

const REPEAT_DELAY = 170;    // ms a held left or right button waits before it repeats
const REPEAT_EVERY = 50;     // ms between two repeats of a held button
const DIRECTION_AFTER = 12;  // px of travel that decide the direction of a stroke
const TAP_TIME = 250;        // ms: a finger that lifts within this time ...
const TAP_REACH = 10;        // px: ... and within this reach of where it went down is a tap
const FLICK_SPEED = 1.2;     // px per ms: lifting faster than this while going down ...
const FLICK_SQUARES = 2;     // ... after at least this many squares of travel drops the piece at once
const SPEED_WINDOW = 100;    // ms before the finger lifts over which its speed is taken
const CLICK_AFTER = 400;     // ms after a press ends within which a click still belongs to that press

// Which key does what. Letters are matched in either case.
const KEYS = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowDown: "down",
  ArrowUp: "turn",
  x: "turn",
  " ": "drop",
  Spacebar: "drop",
  p: "pause",
  Escape: "pause",
};

// Held down, these keys act once: the browser's own key repeat is ignored for them.
const ONCE = new Set(["turn", "drop", "pause"]);

// How a held button repeats: [ms before the first repeat, ms between repeats]. The others act once per press.
const REPEATS = {
  left: [REPEAT_DELAY, REPEAT_EVERY],
  right: [REPEAT_DELAY, REPEAT_EVERY],
  down: [REPEAT_EVERY, REPEAT_EVERY],
};

// actions: { left, right, down, turn, drop, pause }, each a function. A key whose action answers
//   false was not wanted, and the browser keeps it.
// buttons: a list of { element, act } for the buttons on the screen.
// press(element, down): shows a button pressed or let go.
// strokes: { element, top(), open(), piece() }: the element whose touches are strokes, from the client y
//   of top() downwards; whether strokes are taken right now (not while a panel lies on the game); and a
//   number that changes with every new piece, so that a stroke steers only the piece it began on.
// squareSize(): the size of a square of the well in CSS pixels, as it is now.
// unlock(): wakes the sound; called on every event that browsers count as the player's go-ahead for it.
export function startInput({ actions, buttons = [], press = () => {}, strokes = null, squareSize = () => 32, unlock = () => {} }) {
  // ---------- The go-ahead for sound (design section 10) ----------

  // A press of the mouse counts; a finger or a pen counts when it lifts, not when it goes down.
  window.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") unlock();
  }, true);
  window.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "mouse") unlock();
  }, true);
  // A click of the player's own counts too: a screen reader presses a button with a click and no pointer.
  window.addEventListener("click", (event) => {
    if (event.isTrusted) unlock();
  }, true);

  // ---------- Keys ----------

  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // Enter presses the button of a panel that has the focus: a go-ahead too.
    if (event.key === "Enter") unlock();
    const name = KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (!name) return;
    // The game's own keys count as a go-ahead, except Escape, which browsers do not count.
    if (event.key !== "Escape") unlock();
    if (ONCE.has(name) && event.repeat) {
      event.preventDefault();
      return;
    }
    // The keys never scroll the page.
    if (actions[name]() !== false) event.preventDefault();
  });

  // ---------- The buttons: each follows its own finger ----------

  const held = new Map();   // pointer id -> { element, timer }
  const ended = new Map();  // button -> when the last press on it ended

  const isHeld = (element) => [...held.values()].some((hold) => hold.element === element);

  function release(pointerId) {
    const hold = held.get(pointerId);
    if (!hold) return;
    clearTimeout(hold.timer);
    held.delete(pointerId);
    ended.set(hold.element, performance.now());
    if (!isHeld(hold.element)) press(hold.element, false);
  }

  function releaseAll() {
    for (const pointerId of [...held.keys()]) release(pointerId);
  }

  for (const { element, act } of buttons) {
    element.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      // No focus, no selection, no long-press menu: the space bar can never press a button.
      event.preventDefault();
      release(event.pointerId);
      // The button acts at once.
      actions[act]();
      const hold = { element, timer: 0 };
      held.set(event.pointerId, hold);
      press(element, true);
      const repeat = REPEATS[act];
      if (repeat) {
        const again = () => {
          actions[act]();
          hold.timer = setTimeout(again, repeat[1]);
        };
        hold.timer = setTimeout(again, repeat[0]);
      }
      // After acting: a pointer made by a script cannot be captured, and that must not stop the press.
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // The window's own pointerup and pointercancel below still end the press.
      }
    });

    // A click is ignored: the press has already acted. The one exception is the pause button
    // pressed through a screen reader, which sends a click and no pointer. A click that ends a
    // press, however long the button was held, is never taken for one.
    element.addEventListener("click", (event) => {
      event.preventDefault();
      if (act !== "pause" || isHeld(element)) return;
      if (performance.now() - (ended.get(element) ?? -Infinity) < CLICK_AFTER) return;
      actions.pause();
    });
  }

  // ---------- Strokes of a finger on the panel ----------

  let stroke = null;

  // A stroke belongs to the piece that was falling when the finger went down. Once that piece has
  // settled, the rest of the stroke does nothing: it never steers or drops the piece that comes next.
  const spent = (one) => Boolean(strokes.piece) && strokes.piece() !== one.piece;

  // The end of a stroke: a tap turns, a quick flick down drops at once.
  function finish(event, lifted) {
    if (!stroke || event.pointerId !== stroke.id) return;
    const done = stroke;
    stroke = null;
    if (!lifted || spent(done)) return;
    const dx = event.clientX - done.x;
    const dy = event.clientY - done.y;
    if (!done.direction) {
      // A short touch that stayed where it went down is a tap: turn.
      if (event.timeStamp - done.time <= TAP_TIME && Math.hypot(dx, dy) <= TAP_REACH) actions.turn();
      return;
    }
    if (done.direction !== "down") return;
    // The speed over the last moments before the finger lifted.
    const since = event.timeStamp - SPEED_WINDOW;
    let from = done.trail[0];
    for (const point of done.trail) {
      if (point[0] > since) break;
      from = point;
    }
    const time = event.timeStamp - from[0];
    const speed = time > 0 ? (event.clientY - from[1]) / time : 0;
    if (dy >= FLICK_SQUARES * Math.max(1, squareSize()) && speed > FLICK_SPEED) actions.drop();
  }

  // A finger that lifts, or a pointer that is cancelled, ends its stroke and stops its button's repeat.
  window.addEventListener("pointerup", (event) => {
    release(event.pointerId);
    finish(event, true);
  });
  window.addEventListener("pointercancel", (event) => {
    release(event.pointerId);
    finish(event, false);
  });
  window.addEventListener("blur", () => {
    releaseAll();
    stroke = null;
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) return;
    releaseAll();
    stroke = null;
  });

  if (strokes) {
    strokes.element.addEventListener("pointerdown", (event) => {
      // A finger or a pen; the mouse has the keys and the buttons.
      if (event.pointerType === "mouse" || stroke || event.clientY < strokes.top() || !strokes.open()) return;
      stroke = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        time: event.timeStamp,
        piece: strokes.piece ? strokes.piece() : 0,  // the piece this stroke steers
        direction: null,  // "side", "down" or "up", decided by the first DIRECTION_AFTER px
        steps: 0,         // squares of travel already answered
        trail: [[event.timeStamp, event.clientY]],
      };
      try {
        strokes.element.setPointerCapture(event.pointerId);
      } catch {
        // A pointer made by a script cannot be captured; the stroke still works inside the element.
      }
    });

    strokes.element.addEventListener("pointermove", (event) => {
      if (!stroke || event.pointerId !== stroke.id || spent(stroke)) return;
      const dx = event.clientX - stroke.x;
      const dy = event.clientY - stroke.y;
      stroke.trail.push([event.timeStamp, event.clientY]);
      while (stroke.trail.length > 2 && stroke.trail[1][0] < event.timeStamp - SPEED_WINDOW) stroke.trail.shift();
      if (!stroke.direction) {
        if (Math.hypot(dx, dy) < DIRECTION_AFTER) return;
        stroke.direction = Math.abs(dx) >= Math.abs(dy) ? "side" : dy > 0 ? "down" : "up";
      }
      const square = Math.max(1, squareSize());
      if (stroke.direction === "side") {
        // Every square of travel moves the piece one square in that direction.
        while (dx - stroke.steps * square >= square) {
          actions.right();
          stroke.steps++;
        }
        while (dx - stroke.steps * square <= -square) {
          actions.left();
          stroke.steps--;
        }
      } else if (stroke.direction === "down") {
        // Every square of travel lets the piece fall one square.
        while (dy - stroke.steps * square >= square) {
          actions.down();
          stroke.steps++;
        }
      }
    });
  }

  // No long-press menu on a touch screen.
  window.addEventListener("contextmenu", (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen" || held.size > 0) event.preventDefault();
  });
}
