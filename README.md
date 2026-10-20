# Drawy

Draw a game screen with one pen, say what each part is, press **Generate**, and get a
themed game UI you can try, tweak and export as PNGs + `layout.json`. Same look as Webby
and Gamey.

1. **Draw** on a blank 1080p (or phone / 720p) canvas: boxes for buttons and panels, lines
   for bars, words where text goes. Drawy groups your strokes into numbered marks (writing
   inside a box belongs to that box; a box inside a panel stays its own mark). The Group
   tool fixes it by hand when it guesses wrong.
2. **Describe** each mark in the left panel: "play button", "health bar 70%", "coins 1,250".
3. **Generate**: the `claude` CLI reads the sketch and your notes and returns a checked
   layout (data only, never code). Drawy draws it in the chosen theme: Cartoon, Fantasy,
   Sci-fi, Pixel or Minimal. Switching theme is instant.
4. **Try** it (buttons press, sliders drag, toggles flip), **Edit** by hand (drag, resize
   with snapping, Inspect panel), or ask for changes in **Chat**.
5. **Export** writes `~/Documents/Drawy/<project>/export/<screen>/`: `screen.png`, one PNG
   per element plus its states/parts (@hover, @pressed, @disabled, @blank, @track, @fill,
   @knob, @on, @off), `layout.json` with positions and nine-slice margins, the theme font
   (OFL) and a README.

## Run

```bash
npm install
npm start          # DRAWY_HOME=/some/dir npm start keeps test projects elsewhere
npm run dist       # build, sign with the local certificate, install /Applications/Drawy.app
```

Needs Claude Code (`claude`) installed and signed in.

## Files

- `main.js`: window, projects, asking Claude, writing exports.
- `src/claude.js`: the `claude -p --json-schema` request and Drawy's instructions to Claude.
- `src/schema.js`: the layout format and the checks every answer goes through.
- `renderer/sketch.js`: strokes, grouping them into marks, the picture Claude reads.
- `renderer/themes.js`: drawing every element type in every theme (stage, thumbnails and exports).
- `renderer/app.js`: the app.
- Icons: Lucide (ISC), copied by `tools/vendor.js`. Fonts: Google Fonts, SIL OFL.
