// DOM side: one element per piece (keyed by piece id), positioned via --r / --c.
// Moving a piece = updating its vars; CSS transitions do the animation.
window.M3 = window.M3 || {};

M3.render = (function () {
  // Keep in sync with the durations in style.css.
  const TIMING = { move: 200, pop: 260, fall: 340, shake: 300, popup: 800, shuffle: 600, shuffleDelay: 700 };

  let boardEl = null;
  const tiles = new Map(); // piece id -> element

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function iconHTML(icon) {
    return /\.(png|svg|webp|jpe?g)$/i.test(icon)
      ? '<img src="' + icon + '" alt="">'
      : icon;
  }

  function place(el, r, c) {
    el.style.setProperty('--r', r);
    el.style.setProperty('--c', c);
    el.dataset.r = r;
    el.dataset.c = c;
  }

  function createTile(piece, r, c) {
    const info = M3.THEME.pieces[piece.type];
    const el = document.createElement('div');
    el.className = 'tile';
    el.setAttribute('role', 'gridcell');
    el.setAttribute('aria-label', info.label);
    el.style.setProperty('--piece-color', info.color);
    el.innerHTML = '<div class="tile-inner">' + iconHTML(info.icon) + '</div>';
    place(el, r, c);
    tiles.set(piece.id, el);
    boardEl.appendChild(el);
    return el;
  }

  // Throw away all tiles and draw the grid from scratch.
  function build(el, grid) {
    boardEl = el;
    boardEl.innerHTML = '';
    tiles.clear();
    grid.forEach((row, r) => row.forEach((piece, c) => createTile(piece, r, c)));
  }

  // Move every tile to where its piece now sits in the grid. Pieces without a
  // tile get one; tiles whose piece is gone are removed.
  function sync(grid) {
    const live = new Set();
    grid.forEach((row, r) => row.forEach((piece, c) => {
      if (!piece) return;
      live.add(piece.id);
      if (tiles.has(piece.id)) place(tiles.get(piece.id), r, c);
      else createTile(piece, r, c);
    }));
    for (const [id, el] of tiles) {
      if (!live.has(id)) {
        el.remove();
        tiles.delete(id);
      }
    }
  }

  function tileAt(grid, pos) {
    const piece = grid[pos.r][pos.c];
    return piece ? tiles.get(piece.id) : null;
  }

  function select(grid, pos) {
    for (const el of boardEl.querySelectorAll('.tile.selected')) el.classList.remove('selected');
    if (pos) tileAt(grid, pos).classList.add('selected');
  }

  function shake(grid, positions) {
    for (const pos of positions) {
      const el = tileAt(grid, pos);
      el.classList.remove('shake');
      void el.offsetWidth; // restart the animation
      el.classList.add('shake');
      setTimeout(() => el.classList.remove('shake'), TIMING.shake);
    }
  }

  // Burst the matched pieces, then remove their elements.
  async function pop(grid, cells) {
    const ids = cells.map(({ r, c }) => grid[r][c].id);
    for (const id of ids) tiles.get(id).classList.add('pop');
    await wait(TIMING.pop);
    for (const id of ids) {
      tiles.get(id).remove();
      tiles.delete(id);
    }
  }

  // Slide existing pieces down and drop new ones in from above the board.
  async function fall(grid, spawns) {
    boardEl.classList.add('falling');
    for (const { piece, c, fromR } of spawns) createTile(piece, fromR, c);
    void boardEl.offsetWidth; // let new tiles render at fromR before moving
    sync(grid);
    await wait(TIMING.fall);
    boardEl.classList.remove('falling');
  }

  // Slide every piece to its new shuffled spot, a bit slower than a swap.
  async function shuffle(grid) {
    boardEl.classList.add('shuffling');
    sync(grid);
    await wait(TIMING.shuffle);
    boardEl.classList.remove('shuffling');
  }

  // Restart a CSS animation class on an element.
  function replay(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // Floating "+60" over a board cell. Lives in .board-wrap so it isn't
  // clipped by the board's rounded edge.
  function popup(text, r, c) {
    const el = document.createElement('div');
    el.className = 'popup';
    el.textContent = text;
    el.style.left = 'calc(var(--frame) + ' + (c + 0.5) + ' * var(--cell))';
    el.style.top = 'calc(var(--frame) + ' + (r + 0.5) + ' * var(--cell) - 0.6em)';
    boardEl.parentElement.appendChild(el);
    setTimeout(() => el.remove(), TIMING.popup);
  }

  function banner(text) {
    const el = document.getElementById('banner');
    el.textContent = text;
    replay(el, 'show');
  }

  function bump(el) {
    replay(el, 'bump');
  }

  return { TIMING, wait, build, sync, select, shake, pop, fall, shuffle, popup, banner, bump };
})();
