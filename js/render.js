// DOM side: one element per piece (keyed by piece id), positioned via --r / --c.
// Moving a piece = updating its vars; CSS transitions do the animation.
window.M3 = window.M3 || {};

M3.render = (function () {
  // Keep in sync with the durations in style.css.
  const TIMING = {
    move: 200, pop: 260, fall: 340, shake: 300, popup: 800,
    shuffle: 600, shuffleDelay: 700, effect: 420, convert: 450, fly: 380,
  };
  const SPECIAL_CLASSES = ['sp-h', 'sp-v', 'sp-wrap', 'sp-bomb', 'sp-armed', 'sp-fly'];
  const SIZE = 8;

  let boardEl = null;
  const tiles = new Map();     // piece id -> element
  const frostEls = new Map();  // r * 8 + c -> element

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

  function label(piece) {
    const names = M3.THEME.specials;
    if (piece.special === 'bomb') return names.bomb;
    const base = M3.THEME.pieces[piece.type].label;
    if (piece.special === 'h' || piece.special === 'v') return names.line + ' ' + base;
    if (piece.special === 'wrap' || piece.special === 'armed') return base + ' ' + names.wrap;
    if (piece.special === 'fly') return base + ' ' + names.fly;
    return base;
  }

  // Inner markup for a piece icon. Also used for the goal panel and cards.
  function pieceHTML(type, special) {
    const info = M3.THEME.pieces[type];
    const cls = special ? ' sp-' + special : '';
    const color = info ? info.color : 'transparent';
    return '<span class="mini' + cls + '" style="--piece-color:' + color + '"><span class="tile-inner">' +
      (info ? iconHTML(info.icon) : '') + '</span></span>';
  }

  // Bring a tile's look in line with its piece (color, special). Returns true if it changed.
  function decorate(el, piece) {
    const sig = piece.type + '|' + (piece.special || '');
    if (el.dataset.sig === sig) return false;
    el.dataset.sig = sig;
    for (const cls of SPECIAL_CLASSES) el.classList.remove(cls);
    if (piece.special) el.classList.add('sp-' + piece.special);
    if (el.dataset.type !== String(piece.type)) {
      el.dataset.type = piece.type;
      const info = M3.THEME.pieces[piece.type];
      el.firstChild.innerHTML = info ? iconHTML(info.icon) : '';
      el.style.setProperty('--piece-color', info ? info.color : 'transparent');
    }
    el.setAttribute('aria-label', label(piece));
    return true;
  }

  function createTile(piece, r, c) {
    const el = document.createElement('div');
    el.className = 'tile';
    el.setAttribute('role', 'gridcell');
    el.innerHTML = '<div class="tile-inner"></div>';
    decorate(el, piece);
    place(el, r, c);
    tiles.set(piece.id, el);
    boardEl.appendChild(el);
    return el;
  }

  // Throw away everything and draw the frosting and grid from scratch.
  function build(el, grid, frost) {
    boardEl = el;
    boardEl.innerHTML = '';
    tiles.clear();
    frostEls.clear();
    frost.forEach((row, r) => row.forEach((layers, c) => {
      if (!layers) return;
      const f = document.createElement('div');
      f.className = 'frost l' + layers;
      place(f, r, c);
      frostEls.set(r * SIZE + c, f);
      boardEl.appendChild(f);
    }));
    grid.forEach((row, r) => row.forEach((piece, c) => createTile(piece, r, c)));
  }

  // Move every tile to where its piece now sits in the grid and refresh its look.
  // Pieces without a tile get one; tiles whose piece is gone are removed.
  function sync(grid) {
    const live = new Set();
    grid.forEach((row, r) => row.forEach((piece, c) => {
      if (!piece) return;
      live.add(piece.id);
      const el = tiles.get(piece.id);
      if (!el) return createTile(piece, r, c);
      place(el, r, c);
      if (decorate(el, piece) && piece.special) replay(el, 'upgrade');
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

  function hint(grid, move) {
    for (const pos of [move.a, move.b]) {
      const el = tileAt(grid, pos);
      if (el) el.classList.add('hint');
    }
  }

  function clearHint() {
    if (!boardEl) return;
    for (const el of boardEl.querySelectorAll('.tile.hint')) el.classList.remove('hint');
  }

  function shake(grid, positions) {
    for (const pos of positions) {
      const el = tileAt(grid, pos);
      if (!el) continue;
      replay(el, 'shake');
      setTimeout(() => el.classList.remove('shake'), TIMING.shake);
    }
  }

  // Show pieces turning into specials (bomb combos) before they fire.
  async function convert(pieces) {
    for (const piece of pieces) {
      const el = tiles.get(piece.id);
      if (el && decorate(el, piece)) replay(el, 'upgrade');
    }
    await wait(TIMING.convert);
  }

  // Burst the removed pieces, then drop their elements.
  async function pop(removed) {
    for (const { piece } of removed) {
      const el = tiles.get(piece.id);
      if (el) el.classList.add('pop');
    }
    await wait(TIMING.pop);
    for (const { piece } of removed) {
      const el = tiles.get(piece.id);
      if (el) el.remove();
      tiles.delete(piece.id);
    }
  }

  function updateFrost(frosted) {
    for (const { r, c, level } of frosted) {
      const el = frostEls.get(r * SIZE + c);
      if (!el) continue;
      if (level > 0) {
        el.className = 'frost l' + level;
        replay(el, 'crack');
      } else {
        el.classList.add('melt');
        frostEls.delete(r * SIZE + c);
        setTimeout(() => el.remove(), 400);
      }
    }
  }

  // Striped beams, gift-box blasts, bomb sparkles, and butterfly flights.
  function effects(list) {
    const add = (cls, vars) => {
      const el = document.createElement('div');
      el.className = 'fx ' + cls;
      for (const name in vars) el.style.setProperty('--' + name, vars[name]);
      boardEl.appendChild(el);
      setTimeout(() => el.remove(), TIMING.effect + 100);
    };
    for (const fx of list) {
      if (fx.kind === 'row') add('fx-row', { r: fx.r });
      else if (fx.kind === 'col') add('fx-col', { c: fx.c });
      else if (fx.kind === 'blast') add('fx-blast', { r: fx.r, c: fx.c, radius: fx.radius });
      else if (fx.kind === 'board') add('fx-board', {});
      else if (fx.kind === 'fly') add('fx-fly', { r: fx.r, c: fx.c, tr: fx.to.r, tc: fx.to.c });
      else if (fx.kind === 'bomb') {
        add('fx-blast fx-sprinkle', { r: fx.r, c: fx.c, radius: 1 });
        for (const t of fx.targets) add('fx-spark', { r: t.r, c: t.c });
      }
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

  return {
    TIMING, wait, pieceHTML, build, sync, select, hint, clearHint, shake, convert, pop,
    updateFrost, effects, fall, shuffle, popup, banner, bump,
  };
})();
