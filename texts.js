// Every word on the screen, and the version (design v1.3, sections 2 and 9). Nothing is imported.
// Only two lines of text live elsewhere, because they are needed before any script runs:
// the page's title and the "needs JavaScript" line, both in index.html.
// Short words are drawn in the pixel lettering, which has capitals only; sentences use the phone's own typeface.

export const TEXTS = {
  version: "0.1.3",
  name: "Slatefall",
  // The name as its title shows it, large and in two lines; together they spell the name.
  nameLines: ["Slate", "fall"],

  // The game screen
  score: "Score",
  level: "Level",
  next: "Next",
  best: "Best",

  // What the buttons are called, for screen readers
  buttons: {
    left: "Left",
    right: "Right",
    down: "Down: fall faster",
    drop: "Drop at once",
    turn: "Turn",
    pause: "Pause",
  },
  steering: "Steering",
  field: "The playing field",

  // The panels
  play: "Play",
  paused: "Paused",
  resume: "Resume",
  newGame: "New game",
  sure: "Sure? Press again",
  gameOver: "Game over",
  newBest: "New best!",
  howToPlay: "How to play",
  homeScreen: "Add to home screen",
  music: "Music",
  sounds: "Sounds",
  dark: "Dark",
  on: "On",
  off: "Off",
  back: "Back",
  versionLabel: "Version",

  // One plain line in both menus when nothing can be kept: the browser blocks the storage (as when
  // all cookies are blocked), or the storage is full. A private window keeps the game until it closes.
  unkept: "This browser keeps nothing: your best score ends with this visit.",
  // One plain line over the page when the game's own code fails
  fault: "Something went wrong. Your best score is safe. Please reload.",

  // How to play: four short lines, for fingers and for keys
  how: {
    touch: [
      "Move the piece with the left and right buttons.",
      "Turn it with the turn button.",
      "The down button lets it fall faster. The drop button drops it at once.",
      "Fill a row from wall to wall and it disappears.",
    ],
    touchAlso: "The playing field answers your finger too: slide to move, tap to turn, slide down to fall faster, flick down to drop.",
    keys: [
      "Move the piece with the left and right arrow keys.",
      "Turn it with the up arrow, or X.",
      "The down arrow lets it fall faster. The space bar drops it at once.",
      "Fill a row from wall to wall and it disappears.",
    ],
    keysAlso: "P or Escape pauses. The buttons under the playing field work with the mouse.",
  },

  // Help for the home screen: one short how-to per kind of phone
  home: {
    intro: "Put the game on your home screen and it opens like an app.",
    android: {
      title: "Android",
      text: "Open the browser's menu (the three dots) and choose \"Add to Home screen\" or \"Install app\".",
    },
    iphone: {
      title: "iPhone",
      text: "Open the game in Safari, tap the Share button, and choose \"Add to Home Screen\".",
    },
  },

  // What a screen reader is told when the game changes
  status: {
    playing: (score, level) => `Score ${score}, level ${level}.`,
    paused: (score, level) => `Paused. Score ${score}, level ${level}.`,
    over: (score, best) => `Game over. Score ${score}. Best ${best}.`,
  },
};
