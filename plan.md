# Match-3 Game Plan: Bake & Bloom

A beginner-friendly match-3 puzzle game like Candy Crush, with a custom non-candy theme. Built with vanilla HTML, CSS, and JavaScript only: no frameworks, build tools, or dependencies.

## 1. Goals
- 8x8 grid with 6 piece types.
- Swap only adjacent pieces, horizontally or vertically, and only when the swap makes at least one match of 3 or more. Otherwise the pieces animate back.
- Matches clear, gravity drops pieces down, and new pieces fill from the top. Chains repeat until the board settles.
- Scoring rewards longer matches and chains.
- Score display, restart button, short instructions.
- Opening `index.html` by double-click works (`file://`). No server, no setup.

## 2. Theme: "Bake & Bloom"
A cozy home kitchen with baking and houseplants. The page is a soft terracotta gingham tablecloth, the board is warm oak around a linen inset, and the button and accents are terracotta. The 6 pieces are 3 bakes and 3 plants, each on its own pastel tile color:

| id | piece | tile color |
|----|-------|------------|
| croissant | 🥐 Croissant | butter `#ffd46e` |
| cupcake | 🧁 Cupcake | pink `#f8a9c6` |
| cookie | 🍪 Cookie | caramel `#d9a27a` |
| plant | 🪴 Potted plant | sage `#a7d58f` |
| cactus | 🌵 Cactus | sky `#92cbf0` |
| tulip | 🌷 Tulip | lavender `#c8adf2` |

The pieces use clay-style icons generated with ComfyCloud (see 11a and `assets/PROMPTS.md`). All theme data lives in `js/theme.js` and the CSS custom properties in `:root`. Every color in `style.css` goes through those variables, so a re-theme only touches those two places.

## 3. File structure
```
candy-crush/
├── index.html      # layout: header (title, score, moves-free), board, controls, instructions
├── style.css       # theme vars, layout, tile styles, animations (@keyframes)
├── plan.md
├── assets/         # later: ComfyCloud-generated piece PNGs + PROMPTS.md
└── js/
    ├── theme.js    # THEME = { name, pieces: [{ id, label, icon, color }] }
    ├── board.js    # pure game logic, no DOM: create, swap, findMatches, gravity, refill, hasValidMove
    ├── render.js   # DOM: builds/updates tiles, animations, score popups, messages
    └── main.js     # input handling, game loop (resolve cascade), score, restart
```
Use classic `<script>` tags loaded in order, **not** ES modules, because Chrome blocks module imports over `file://`. Each file attaches to one global namespace (`window.M3 = window.M3 || {}`) to avoid global clutter.

## 4. Data model
```js
const SIZE = 8, TYPES = 6;
// grid[row][col] -> Piece | null   (row 0 = top)
Piece = { id: number /* unique, stable across moves */, type: 0..5 }
state = {
  grid,            // 8x8 array of Pieces
  score: 0,
  best: Number(localStorage.best || 0),
  selected: null,  // {r, c} or null
  busy: false,     // true while animating/resolving; input ignored
  nextId: 1,
}
Match = { cells: [{r,c}...], length, dir: 'h'|'v' }
```
The stable `id` lets the renderer keep one DOM element per piece and move it with CSS transitions. Elements are not rebuilt.

## 5. Game logic (`board.js`, pure functions)
- **createBoard()**: fill left to right, top to bottom. Pick a random type and reroll if it would make 3 in a row with the two cells to the left or the two above. Do the whole fill again if `hasValidMove` is false.
- **isAdjacent(a, b)**: `|dr| + |dc| === 1`.
- **swap(grid, a, b)**: swaps pieces in place.
- **findMatches(grid)**: scan every row, then every column, for runs of the same type with length ≥ 3. Returns the list of `Match` objects plus a deduplicated set of matched cells, so L/T shapes clear their shared cell once but score both runs.
- **trySwap(a, b)**: if not adjacent, ignore it. Otherwise swap. If `findMatches` is empty, swap back and return `false` (invalid). Else return `true`.
- **applyGravity(grid)**: for each column, walk from bottom to top and compact non-null pieces downward. Returns a list of moves `{id, fromR, toR}` for animation.
- **refill(grid)**: fill nulls at the top of each column with new random pieces. Returns spawn info so new pieces can start above the board and drop in.
- **hasValidMove(grid)**: try each right and down swap, check for a match, then undo. If there is none, `main.js` shuffles: rebuild with the same types redistributed, falling back to `createBoard()`, and shows a "No moves — shuffling!" message.

## 6. Turn flow (`main.js`)
```
on swap attempt (a, b):
  if busy or !adjacent: return
  busy = true
  animate swap
  if no match: animate swap back + shake, busy = false, return
  chain = 1
  loop:
    matches = findMatches(grid); if none: break
    score += scoreFor(matches, chain); show popup / "Chain x{chain}!" banner
    animate pop, set matched cells to null
    applyGravity -> animate fall; refill -> animate drop-in
    chain++
  if !hasValidMove: shuffle
  update best score; busy = false
```
Animation steps are `async/await` on small `wait(ms)` promises that match the CSS transition durations, so the logic reads top to bottom.

## 7. Scoring
- Per match run: `3 → 30`, `4 → 60`, `5 → 120`, each piece past 4 adds 20 (`6 → 140`).
- Chain multiplier: the step's total × `chain` (1st clear ×1, first cascade ×2, ...).
- Everything is in `scoreFor()`, so it's easy to tune. Best score is saved in `localStorage`.

## 8. Input
- **Click/tap:** click a piece to select it (glow), then click a neighbor to swap. Clicking a non-neighbor moves the selection to that piece. Clicking the selected piece again deselects it.
- **Drag/swipe:** Pointer Events (`pointerdown` → `pointerup`). If the pointer moves more than about 20px, swap toward the dominant axis. One code path covers mouse and touch.
- Input is ignored while `busy`.

## 9. Rendering and visual feedback (`render.js`, `style.css`)
- The board is a `position: relative` square sized with `min(90vw, 480px)`. Each tile is absolutely positioned using `transform: translate(calc(var(--c) * 100%), calc(var(--r) * 100%))`. Changing `--r`/`--c` animates movement through `transition: transform 200ms`.
- Feedback:
  - Selected piece: pulse glow.
  - Invalid swap: swap and return, plus a quick shake.
  - Match: pieces scale up, fade, and burst.
  - Gravity: falling pieces use slight ease-out bounce.
  - Floating "+60" score text at the match location.
  - "Chain x2!" banner on cascades.
  - Score counter does a brief bump when it changes.
- `prefers-reduced-motion` turns animations down to simple fades.

## 10. UI (`index.html`)
- Header with the title, Score, and Best.
- The board.
- Restart button: resets score and creates a new board.
- Collapsible "How to play" with 3 bullet points: swap neighbors, line up 3+, chains score more.
- Responsive single-column layout that works on phone and desktop.

## 11. Build order (future steps)
1. `index.html` + `style.css` skeleton with static board.
2. `board.js` logic, tested from the console.
3. `render.js` + `main.js`: click to swap, cascade loop.
4. Scoring, popups, chain banner, restart, instructions.
5. Swipe input, shuffle on no moves, reduced motion.
6. Choose the final theme and drop in the custom icons (edit `theme.js` and CSS vars only).

## 11a. Custom art: ComfyCloud (done 2026-10-05)
- Generate all images with **ComfyCloud**: the 6 piece icons, plus an optional background and board texture.
- Icon spec:
  - Square PNG, 256×256, transparent background.
  - One piece per image, centered, with some padding.
  - Each piece has a distinct silhouette and color, so it reads at about 50px and for colorblind players.
  - Same style prompt and seed family across all 6 so they look like one set.
- Save to `assets/pieces/<id>.png` and the background to `assets/bg.png`. Point `THEME.pieces[i].icon` at those paths. `render.js` renders an `<img>` when `icon` ends in an image extension and the emoji text otherwise, so the placeholders keep working until the art lands.
- Keep the ComfyCloud prompts and settings in `assets/PROMPTS.md` so the set can be regenerated or extended.

## 12. How to run and verify
- Run: double-click `index.html`, or `open index.html`. No server needed.
- Manual checks:
  - New board never starts with a match.
  - Non-adjacent and diagonal swaps are rejected.
  - A swap with no match snaps back and doesn't change the score.
  - A 3, 4, or 5 match scores 30, 60, or 120.
  - Cascades show the chain banner and the multiplier.
  - Gravity leaves no gaps, and the refill completes the board.
  - Restart resets the score and keeps Best.
  - Input is locked during animations: spam-clicking doesn't break the board.
- Console checks: call `M3.board.findMatches` and `hasValidMove` on hand-built grids, including an L/T shape where the shared cell is cleared once and both runs are scored.
- **All browser checks use a Chromium browser.** Serve the folder locally (e.g. `python3 -m http.server`), open it in a new tab, take screenshots, click to swap, read console messages for errors, and resize to a mobile width. Record a GIF of a cascade for review.
