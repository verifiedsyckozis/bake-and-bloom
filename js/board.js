// Pure game logic, no DOM. Runs in the browser and in Node (for tests and tuning).
// grid[row][col] -> Piece | null   (row 0 is the top)
// Piece = { id, type, special }
//   type:    0..colors-1, or -1 for a Sprinkle Bomb (it has no color)
//   special: null
//            'h' / 'v'  striped: clears its row / column
//            'wrap'     gift box: blasts 3x3, falls, then blasts again
//            'bomb'     sprinkle bomb: clears every piece of one color
//            'fly'      butterfly: flies to one target (frosting or a wanted piece first) and clears it
//                       Optional: `carry` (a special it drops on its target), `flights` (how many targets)
//            'armed'    a gift box that already blasted once; it goes off again next step
// frost[row][col] -> layers of frosting under that cell (0, 1, or 2)
window.M3 = window.M3 || {};

M3.board = (function () {
  const SIZE = 8;
  const POINTS = { match3: 60, match4: 120, shape: 200, extraCell: 20, blasted: 60, frost: 1000 };
  let colors = 6;
  let nextId = 1;
  let wanted = new Set(); // piece types the current level's order still needs; butterflies aim for them

  function setColors(n) {
    colors = n;
  }

  function setWanted(types) {
    wanted = new Set(types);
  }

  function randomType() {
    return Math.floor(Math.random() * colors);
  }

  function newPiece(type) {
    return { id: nextId++, type: type === undefined ? randomType() : type, special: null };
  }

  function emptyGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  }

  function key(p) {
    return p.r * SIZE + p.c;
  }

  function inBounds(p) {
    return p.r >= 0 && p.r < SIZE && p.c >= 0 && p.c < SIZE;
  }

  function isAdjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  function swap(grid, a, b) {
    const tmp = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = tmp;
  }

  // Sprinkle bombs and armed gift boxes never line up in a match.
  function matchable(piece) {
    return !!piece && piece.type >= 0 && piece.special !== 'armed';
  }

  // How a piece behaves when swapped: 'line' | 'wrap' | 'bomb' | null.
  function kindOf(piece) {
    if (!piece) return null;
    if (piece.special === 'h' || piece.special === 'v') return 'line';
    if (piece.special === 'wrap' || piece.special === 'bomb' || piece.special === 'fly') return piece.special;
    return null;
  }

  // True if placing `type` at (r, c) would complete 3 in a row with the two
  // cells to the left or the two above, or a 2x2 square with the cells
  // up and to the left (the only ones filled so far).
  function wouldMatch(grid, r, c, type) {
    const left = c >= 2 && grid[r][c - 1].type === type && grid[r][c - 2].type === type;
    const up = r >= 2 && grid[r - 1][c].type === type && grid[r - 2][c].type === type;
    const square = r >= 1 && c >= 1 && grid[r - 1][c - 1].type === type &&
      grid[r - 1][c].type === type && grid[r][c - 1].type === type;
    return left || up || square;
  }

  // A full board with no matches and at least one valid move.
  function createBoard() {
    let grid;
    do {
      grid = emptyGrid();
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          let type;
          do { type = randomType(); } while (wouldMatch(grid, r, c, type));
          grid[r][c] = newPiece(type);
        }
      }
    } while (!hasValidMove(grid));
    return grid;
  }

  // Scan rows, then columns, for runs of 3+, then for 2x2 squares (dir 'sq').
  // Returns { matches: [{ cells, length, dir, type }], cells: deduped [{r, c}] }.
  function findMatches(grid) {
    const matches = [];

    function scan(dir) {
      for (let i = 0; i < SIZE; i++) {
        let run = [];
        let runType = null;
        for (let j = 0; j <= SIZE; j++) {
          const r = dir === 'h' ? i : j;
          const c = dir === 'h' ? j : i;
          const piece = j < SIZE ? grid[r][c] : null;
          if (run.length && matchable(piece) && piece.type === runType) {
            run.push({ r, c });
          } else {
            if (run.length >= 3) matches.push({ cells: run, length: run.length, dir, type: runType });
            run = matchable(piece) ? [{ r, c }] : [];
            runType = piece ? piece.type : null;
          }
        }
      }
    }

    scan('h');
    scan('v');

    for (let r = 0; r < SIZE - 1; r++) {
      for (let c = 0; c < SIZE - 1; c++) {
        const cells = [{ r, c }, { r, c: c + 1 }, { r: r + 1, c }, { r: r + 1, c: c + 1 }];
        const type = grid[r][c] && grid[r][c].type;
        if (cells.every(p => matchable(grid[p.r][p.c]) && grid[p.r][p.c].type === type)) {
          matches.push({ cells, length: 4, dir: 'sq', type });
        }
      }
    }
    return { matches, cells: dedupe(matches.flatMap(m => m.cells)) };
  }

  function dedupe(cells) {
    const seen = new Set();
    return cells.filter(cell => {
      const k = key(cell);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // Runs that share a cell (L, T, + shapes) become one group.
  function groupMatches(matches) {
    const groups = [];
    for (const m of matches) {
      const keys = new Set(m.cells.map(key));
      const isSquare = m.dir === 'sq';
      const merged = { runs: isSquare ? [] : [m], square: isSquare, cells: m.cells.slice() };
      for (let i = groups.length - 1; i >= 0; i--) {
        if (groups[i].cells.some(cell => keys.has(key(cell)))) {
          merged.runs.push(...groups[i].runs);
          merged.square = merged.square || groups[i].square;
          merged.cells.push(...groups[i].cells);
          groups.splice(i, 1);
        }
      }
      merged.cells = dedupe(merged.cells);
      groups.push(merged);
    }
    return groups;
  }

  function longestRun(group) {
    return group.runs.reduce((best, run) => (run.length > best.length ? run : best), group.runs[0]);
  }

  // The special piece a group earns: 5 in a line -> bomb, L/T -> gift box,
  // 4 in a line -> striped (a horizontal 4 gives vertical stripes, and vice versa),
  // 2x2 square -> butterfly.
  function specialFor(group) {
    if (!group.runs.length) return 'fly';
    const longest = longestRun(group);
    if (longest.length >= 5) return 'bomb';
    const hasH = group.runs.some(run => run.dir === 'h');
    const hasV = group.runs.some(run => run.dir === 'v');
    if (hasH && hasV) return 'wrap';
    if (longest.length === 4) return longest.dir === 'h' ? 'v' : 'h';
    return group.square ? 'fly' : null;
  }

  function groupPoints(group, special) {
    const n = group.cells.length;
    if (special === 'wrap' || special === 'bomb') return POINTS.shape + POINTS.extraCell * Math.max(0, n - 5);
    if (n >= 4 || special === 'fly') return POINTS.match4 + POINTS.extraCell * Math.max(0, n - 4);
    return POINTS.match3;
  }

  // Where the new special appears: the swapped cell if it's in the group,
  // else the corner of an L/T, else the middle of the longest run.
  // Cells already holding a special are skipped (that special goes off instead).
  function specialSpot(grid, group, preferred) {
    const inGroup = new Set(group.cells.map(key));
    const free = cell => inGroup.has(key(cell)) && !grid[cell.r][cell.c].special;
    const hCells = new Set(group.runs.filter(run => run.dir === 'h').flatMap(run => run.cells).map(key));
    const vCells = new Set(group.runs.filter(run => run.dir === 'v').flatMap(run => run.cells).map(key));
    const corner = group.cells.filter(cell => hCells.has(key(cell)) && vCells.has(key(cell)));
    const line = group.runs.length ? longestRun(group).cells : [];
    const middle = line[Math.floor((line.length - 1) / 2)];
    const order = [...preferred, ...corner, ...(middle ? [middle] : []), ...line, ...group.cells];
    return order.find(free) || null;
  }

  function middleOf(group) {
    if (!group.runs.length) return group.cells[0];
    const longest = longestRun(group);
    return longest.cells[Math.floor((longest.cells.length - 1) / 2)];
  }

  function area(r, c, radius) {
    const out = [];
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) out.push({ r: r + dr, c: c + dc });
    }
    return out.filter(inBounds);
  }

  function rowCells(r) {
    return Array.from({ length: SIZE }, (_, c) => ({ r, c }));
  }

  function colCells(c) {
    return Array.from({ length: SIZE }, (_, r) => ({ r, c }));
  }

  function allCells() {
    return Array.from({ length: SIZE * SIZE }, (_, i) => ({ r: Math.floor(i / SIZE), c: i % SIZE }));
  }

  function cellsOfColor(grid, type) {
    return allCells().filter(({ r, c }) => grid[r][c] && grid[r][c].type === type);
  }

  function randomColorOnBoard(grid) {
    const types = [...new Set(grid.flat().filter(p => p && p.type >= 0).map(p => p.type))];
    return types.length ? types[Math.floor(Math.random() * types.length)] : -1;
  }

  // Where a butterfly lands: thickest frosting first, then a piece the order
  // needs, then anywhere. Skips cells that are already being cleared.
  function pickTarget(grid, frost, from, taken) {
    const open = allCells().filter(cell => {
      const piece = grid[cell.r][cell.c];
      return piece && piece.special !== 'armed' && !taken.has(key(cell)) && key(cell) !== key(from);
    });
    if (!open.length) return null;
    const score = cell => {
      const layers = frost ? frost[cell.r][cell.c] : 0;
      if (layers) return 10 + layers;
      return wanted.has(grid[cell.r][cell.c].type) ? 5 : 0;
    };
    const best = Math.max(...open.map(score));
    const top = open.filter(cell => score(cell) === best);
    return top[Math.floor(Math.random() * top.length)];
  }

  // Clears `seeds` and everything their specials set off, in waves.
  // Cells in `protect` (where new specials are being made) are left alone.
  // Mutates grid and frost. Appends visual effects to `effects`.
  function blast(grid, frost, seeds, protect, effects) {
    const removed = [];
    const frosted = [];
    const visited = new Set();
    const queue = seeds.slice();

    while (queue.length) {
      const cell = queue.shift();
      if (!inBounds(cell)) continue;
      const k = key(cell);
      if (visited.has(k) || protect.has(k)) continue;
      visited.add(k);
      const piece = grid[cell.r][cell.c];
      if (!piece || piece.special === 'armed') continue;

      const { r, c } = cell;
      if (piece.special === 'h') {
        effects.push({ kind: 'row', r, c });
        queue.push(...rowCells(r));
      } else if (piece.special === 'v') {
        effects.push({ kind: 'col', r, c });
        queue.push(...colCells(c));
      } else if (piece.special === 'wrap') {
        // First blast: the box stays put, glowing, and goes off again after it falls.
        effects.push({ kind: 'blast', r, c, radius: 1 });
        queue.push(...area(r, c, 1));
        piece.special = 'armed';
        piece.radius = 1;
        continue;
      } else if (piece.special === 'bomb') {
        const targets = cellsOfColor(grid, randomColorOnBoard(grid));
        effects.push({ kind: 'bomb', r, c, targets });
        queue.push(...targets);
      } else if (piece.special === 'fly') {
        for (let i = 0; i < (piece.flights || 1); i++) {
          const taken = new Set([...visited, ...protect, ...queue.filter(inBounds).map(key)]);
          const target = pickTarget(grid, frost, cell, taken);
          if (!target) break;
          effects.push({ kind: 'fly', r, c, to: target });
          // A butterfly carrying a special drops it on the target, which then fires.
          const landed = grid[target.r][target.c];
          if (piece.carry && !landed.special) landed.special = piece.carry;
          queue.push(target);
        }
      }

      removed.push({ r, c, piece });
      grid[r][c] = null;
      if (frost && frost[r][c] > 0) {
        frost[r][c]--;
        frosted.push({ r, c, level: frost[r][c] });
      }
    }
    return { removed, frosted };
  }

  // Bundles a clear into one record for the game loop and renderer.
  function record(result, effects, groups, chain, created, converted) {
    const groupKeys = new Set();
    const popups = [];
    let score = 0;
    for (const g of groups) {
      g.cells.forEach(cell => groupKeys.add(key(cell)));
      const pts = g.points * chain;
      score += pts;
      popups.push({ r: g.mid.r, c: g.mid.c, points: pts });
    }

    const extra = result.removed.filter(cell => !groupKeys.has(key(cell)));
    const bonus = extra.length * POINTS.blasted + result.frosted.length * POINTS.frost;
    if (bonus) {
      const spots = extra.length ? extra : result.frosted;
      const avg = prop => Math.round(spots.reduce((sum, s) => sum + s[prop], 0) / spots.length);
      popups.push({ r: avg('r'), c: avg('c'), points: bonus });
      score += bonus;
    }

    const collected = {};
    const add = k => { collected[k] = (collected[k] || 0) + 1; };
    for (const { piece } of result.removed) if (piece.type >= 0) add(piece.type);
    for (const cr of created) add(cr.special === 'h' || cr.special === 'v' ? 'line' : cr.special);

    return {
      effects, removed: result.removed, frosted: result.frosted,
      created, converted: converted || [], score, popups, collected,
    };
  }

  // One clear step: armed gift boxes go off, matches clear and make specials,
  // and specials caught in the blast fire. With `fireSpecials`, every special on
  // the board fires too (the end-of-level finale). Returns null if nothing happens.
  function step(grid, frost, { preferred = [], chain = 1, fireSpecials = false } = {}) {
    const seeds = [];
    const effects = [];
    const protect = new Set();
    const created = [];

    // Find matches before disarming boxes, so an armed box can't join one.
    const groups = groupMatches(findMatches(grid).matches);

    for (const { r, c } of allCells()) {
      const piece = grid[r][c];
      if (piece && piece.special === 'armed') {
        const radius = piece.radius || 1;
        piece.special = null;
        effects.push({ kind: 'blast', r, c, radius });
        seeds.push(...area(r, c, radius));
      } else if (fireSpecials && kindOf(piece)) {
        seeds.push({ r, c });
      }
    }

    for (const g of groups) {
      seeds.push(...g.cells);
      const special = specialFor(g);
      g.points = groupPoints(g, special);
      g.mid = middleOf(g);
      const spot = special ? specialSpot(grid, g, preferred) : null;
      if (spot) {
        protect.add(key(spot));
        created.push({ r: spot.r, c: spot.c, special });
      }
    }

    if (!seeds.length) return null;
    const result = blast(grid, frost, seeds, protect, effects);

    for (const cr of created) {
      const piece = grid[cr.r][cr.c];
      piece.special = cr.special;
      if (cr.special === 'bomb') piece.type = -1;
      if (frost && frost[cr.r][cr.c] > 0) {
        frost[cr.r][cr.c]--;
        result.frosted.push({ r: cr.r, c: cr.c, level: frost[cr.r][cr.c] });
      }
    }
    return record(result, effects, groups, chain, created);
  }

  // A swap that works without a match: a bomb with anything, or two specials.
  function isCombo(grid, a, b) {
    const ka = kindOf(grid[a.r][a.c]);
    const kb = kindOf(grid[b.r][b.c]);
    return ka === 'bomb' || kb === 'bomb' || (!!ka && !!kb);
  }

  // Resolves a combo swap (call after the pieces are swapped). `b` is where the
  // player moved their piece to, which is the combo's center.
  function comboStep(grid, frost, a, b) {
    const p = grid[a.r][a.c];
    const q = grid[b.r][b.c];
    const kp = kindOf(p);
    const kq = kindOf(q);
    const effects = [];
    const converted = [];
    const protect = new Set();
    let seeds = [];

    if (kp === 'bomb' && kq === 'bomb') {
      // Two bombs: clear the whole board.
      p.special = q.special = null;
      effects.push({ kind: 'board' });
      seeds = allCells();
    } else if (kp === 'bomb' || kq === 'bomb') {
      const [bomb, other, at] = kp === 'bomb' ? [p, q, a] : [q, p, b];
      const ko = kindOf(other);
      const targets = cellsOfColor(grid, other.type);
      bomb.special = null;
      // Bomb + striped / gift box: every piece of that color becomes one, then they all fire.
      if (ko === 'line' || ko === 'wrap' || ko === 'fly') {
        for (const t of targets) {
          const piece = grid[t.r][t.c];
          if (piece.special) continue;
          piece.special = ko === 'line' ? (Math.random() < 0.5 ? 'h' : 'v') : ko;
          converted.push(piece);
        }
      }
      effects.push({ kind: 'bomb', r: at.r, c: at.c, targets });
      seeds = [at, ...targets];
    } else if (kp === 'fly' || kq === 'fly') {
      // Butterfly + butterfly: three butterflies. Butterfly + striped / gift box:
      // the butterfly carries that special to its target.
      const [fly, other] = kp === 'fly' ? [p, q] : [q, p];
      if (kindOf(other) === 'fly') {
        other.special = null;
        fly.flights = 3;
      } else {
        fly.carry = other.special;
        other.special = null;
      }
      seeds = [a, b];
    } else if (kp === 'line' && kq === 'line') {
      // Two striped: a cross through the center.
      p.special = q.special = null;
      effects.push({ kind: 'row', r: b.r, c: b.c }, { kind: 'col', r: b.r, c: b.c });
      seeds = [...rowCells(b.r), ...colCells(b.c)];
    } else if (kp === 'wrap' && kq === 'wrap') {
      // Two gift boxes: a big 5x5 blast, then another after falling.
      p.special = null;
      q.special = 'armed';
      q.radius = 2;
      protect.add(key(b));
      effects.push({ kind: 'blast', r: b.r, c: b.c, radius: 2 });
      seeds = area(b.r, b.c, 2);
    } else {
      // Striped + gift box: three rows and three columns.
      p.special = q.special = null;
      for (let d = -1; d <= 1; d++) {
        if (b.r + d >= 0 && b.r + d < SIZE) {
          effects.push({ kind: 'row', r: b.r + d, c: b.c });
          seeds.push(...rowCells(b.r + d));
        }
        if (b.c + d >= 0 && b.c + d < SIZE) {
          effects.push({ kind: 'col', r: b.r, c: b.c + d });
          seeds.push(...colCells(b.c + d));
        }
      }
    }

    const result = blast(grid, frost, seeds, protect, effects);
    return record(result, effects, [], 1, [], converted);
  }

  function clearCells(grid, cells) {
    for (const { r, c } of cells) grid[r][c] = null;
  }

  // Drops pieces down to fill gaps. Returns [{ id, c, fromR, toR }].
  function applyGravity(grid) {
    const moves = [];
    for (let c = 0; c < SIZE; c++) {
      let write = SIZE - 1;
      for (let r = SIZE - 1; r >= 0; r--) {
        const piece = grid[r][c];
        if (!piece) continue;
        if (r !== write) {
          grid[write][c] = piece;
          grid[r][c] = null;
          moves.push({ id: piece.id, c, fromR: r, toR: write });
        }
        write--;
      }
    }
    return moves;
  }

  // Fills empty cells (all at the top after gravity) with new pieces.
  // Returns [{ piece, r, c, fromR }] where fromR is a row above the board to drop in from.
  function refill(grid) {
    const spawns = [];
    for (let c = 0; c < SIZE; c++) {
      let empty = 0;
      while (empty < SIZE && !grid[empty][c]) empty++;
      for (let r = 0; r < empty; r++) {
        const piece = newPiece();
        grid[r][c] = piece;
        spawns.push({ piece, r, c, fromR: r - empty });
      }
    }
    return spawns;
  }

  // First swap that does something (a match or a combo), or null. Used for hints.
  function findValidMove(grid) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const a = { r, c };
        for (const b of [{ r, c: c + 1 }, { r: r + 1, c }]) {
          if (!inBounds(b) || !grid[r][c] || !grid[b.r][b.c]) continue;
          if (isCombo(grid, a, b)) return { a, b };
          swap(grid, a, b);
          const ok = findMatches(grid).matches.length > 0;
          swap(grid, a, b);
          if (ok) return { a, b };
        }
      }
    }
    return null;
  }

  function hasValidMove(grid) {
    return findValidMove(grid) !== null;
  }

  // Rearranges the existing pieces (keeping ids, so they can animate) into a
  // layout with no matches and at least one move. Falls back to a fresh board.
  function shuffle(grid) {
    const pieces = grid.flat();
    for (let attempt = 0; attempt < 200; attempt++) {
      for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
      }
      for (let k = 0; k < pieces.length; k++) {
        grid[Math.floor(k / SIZE)][k % SIZE] = pieces[k];
      }
      if (findMatches(grid).matches.length === 0 && hasValidMove(grid)) return grid;
    }
    const fresh = createBoard();
    for (let r = 0; r < SIZE; r++) grid[r] = fresh[r];
    return grid;
  }

  // Frosting map from a level's strings ('.', '1', '2' per cell).
  function parseFrost(rows) {
    return Array.from({ length: SIZE }, (_, r) =>
      Array.from({ length: SIZE }, (_, c) => (rows ? Number(rows[r][c]) || 0 : 0)));
  }

  function frostLeft(frost) {
    return frost.flat().reduce((sum, n) => sum + n, 0);
  }

  return {
    SIZE, POINTS,
    setColors, setWanted, newPiece, createBoard, isAdjacent, swap, kindOf, findMatches, isCombo,
    step, comboStep, clearCells, applyGravity, refill, findValidMove, hasValidMove, shuffle,
    parseFrost, frostLeft,
  };
})();
