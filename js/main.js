// Game state, input, and the turn loop (swap -> clear -> fall -> repeat).
window.M3 = window.M3 || {};

(function () {
  const B = M3.board;
  const R = M3.render;

  const boardEl = document.getElementById('board');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const BEST_KEY = 'match3.best';

  const state = {
    grid: null,
    score: 0,
    best: loadBest(),
    selected: null, // { r, c } or null
    busy: false,    // true while animating; input is ignored
  };

  // localStorage can throw (e.g. some private modes), so never let it break the game.
  function loadBest() {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { return 0; }
  }

  function saveBest() {
    try { localStorage.setItem(BEST_KEY, state.best); } catch (e) { /* ignore */ }
  }

  function setScore(value) {
    const gained = value > state.score;
    state.score = value;
    scoreEl.textContent = value;
    if (gained) R.bump(scoreEl);
    if (value > state.best) {
      state.best = value;
      bestEl.textContent = value;
      R.bump(bestEl);
      saveBest();
    }
  }

  function newGame() {
    state.grid = B.createBoard();
    state.selected = null;
    state.busy = false;
    setScore(0);
    R.build(boardEl, state.grid);
  }

  function select(pos) {
    state.selected = pos;
    R.select(state.grid, pos);
  }

  function onTileClick(pos) {
    if (state.busy) return;
    const sel = state.selected;
    if (!sel) return select(pos);
    if (sel.r === pos.r && sel.c === pos.c) return select(null);
    if (B.isAdjacent(sel, pos)) {
      select(null);
      attemptSwap(sel, pos);
    } else {
      select(pos);
    }
  }

  async function attemptSwap(a, b) {
    state.busy = true;
    const { grid } = state;

    B.swap(grid, a, b);
    R.sync(grid);
    await R.wait(R.TIMING.move);

    if (B.findMatches(grid).matches.length === 0) {
      B.swap(grid, a, b);
      R.sync(grid);
      await R.wait(R.TIMING.move);
      R.shake(grid, [a, b]);
      state.busy = false;
      return;
    }

    await resolveBoard();
    state.busy = false;
  }

  // Clear matches, drop pieces, refill, and repeat until the board settles.
  async function resolveBoard() {
    const { grid } = state;
    let chain = 1;

    while (true) {
      const { matches, cells } = B.findMatches(grid);
      if (matches.length === 0) break;

      for (const m of matches) {
        const mid = m.cells[Math.floor(m.cells.length / 2)];
        R.popup('+' + B.scoreFor([m], chain), mid.r, mid.c);
      }
      if (chain > 1) R.banner('Chain x' + chain + '!');
      setScore(state.score + B.scoreFor(matches, chain));

      await R.pop(grid, cells);
      B.clearCells(grid, cells);
      B.applyGravity(grid);
      const spawns = B.refill(grid);
      await R.fall(grid, spawns);
      chain++;
    }

    if (!B.hasValidMove(grid)) {
      R.banner('No moves — shuffling!');
      await R.wait(R.TIMING.shuffleDelay);
      B.shuffle(grid);
      await R.shuffle(grid);
    }
  }

  // Pointer input: a tap acts like a click; a drag past the threshold swaps
  // toward the drag direction. Covers mouse, touch, and pen in one path.
  let drag = null; // { pos, x, y, swiped }

  boardEl.addEventListener('pointerdown', e => {
    const tile = e.target.closest('.tile');
    if (!tile || !e.isPrimary) return;
    drag = { pos: { r: Number(tile.dataset.r), c: Number(tile.dataset.c) }, x: e.clientX, y: e.clientY, swiped: false };
    boardEl.setPointerCapture(e.pointerId);
  });

  // Swaps toward the drag direction once it passes the threshold.
  // Returns true if the gesture counted as a swipe.
  function trySwipe(e) {
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    const threshold = boardEl.clientWidth / B.SIZE * 0.35;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return false;
    drag.swiped = true;
    if (state.busy) return true;
    const { r, c } = drag.pos;
    const target = Math.abs(dx) > Math.abs(dy)
      ? { r, c: c + Math.sign(dx) }
      : { r: r + Math.sign(dy), c };
    if (target.r < 0 || target.r >= B.SIZE || target.c < 0 || target.c >= B.SIZE) return true;
    select(null);
    attemptSwap(drag.pos, target);
    return true;
  }

  boardEl.addEventListener('pointermove', e => {
    if (drag && !drag.swiped && e.isPrimary) trySwipe(e);
  });

  // Also checked on release, in case a fast flick skipped the move events.
  boardEl.addEventListener('pointerup', e => {
    if (!drag || !e.isPrimary) return;
    if (!drag.swiped && !trySwipe(e)) onTileClick(drag.pos);
    drag = null;
  });

  boardEl.addEventListener('pointercancel', () => { drag = null; });

  document.getElementById('restart').addEventListener('click', () => {
    if (!state.busy) newGame();
  });

  bestEl.textContent = state.best;
  newGame();

  // Exposed for console testing.
  M3.state = state;
})();
