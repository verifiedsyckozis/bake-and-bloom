// Pure game logic, no DOM.
// grid[row][col] -> { id, type } | null   (row 0 is the top)
window.M3 = window.M3 || {};

M3.board = (function () {
  const SIZE = 8;
  const TYPES = 6;
  let nextId = 1;

  function randomType() {
    return Math.floor(Math.random() * TYPES);
  }

  function newPiece(type) {
    return { id: nextId++, type: type === undefined ? randomType() : type };
  }

  function emptyGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  }

  // True if placing `type` at (r, c) would complete 3 in a row with the two
  // cells to the left or the two above (the only ones filled so far).
  function wouldMatch(grid, r, c, type) {
    const left = c >= 2 && grid[r][c - 1].type === type && grid[r][c - 2].type === type;
    const up = r >= 2 && grid[r - 1][c].type === type && grid[r - 2][c].type === type;
    return left || up;
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

  // Scan rows, then columns, for runs of 3+.
  // Returns { matches: [{ cells, length, dir, type }], cells: deduped [{r, c}] }.
  // An L/T shape yields two matches but its shared cell appears once in `cells`.
  function findMatches(grid) {
    const matches = [];

    function scan(dir) {
      for (let i = 0; i < SIZE; i++) {
        let run = [];
        for (let j = 0; j <= SIZE; j++) {
          const r = dir === 'h' ? i : j;
          const c = dir === 'h' ? j : i;
          const piece = j < SIZE ? grid[r][c] : null;
          const prev = run.length ? grid[run[0].r][run[0].c] : null;
          if (piece && prev && piece.type === prev.type) {
            run.push({ r, c });
          } else {
            if (run.length >= 3) {
              matches.push({ cells: run, length: run.length, dir, type: prev.type });
            }
            run = piece ? [{ r, c }] : [];
          }
        }
      }
    }

    scan('h');
    scan('v');

    const seen = new Set();
    const cells = [];
    for (const m of matches) {
      for (const cell of m.cells) {
        const key = cell.r * SIZE + cell.c;
        if (!seen.has(key)) {
          seen.add(key);
          cells.push(cell);
        }
      }
    }
    return { matches, cells };
  }

  // Swaps a and b if that creates a match; otherwise leaves the grid untouched.
  function trySwap(grid, a, b) {
    if (!inBounds(a) || !inBounds(b) || !isAdjacent(a, b)) return false;
    swap(grid, a, b);
    if (findMatches(grid).matches.length === 0) {
      swap(grid, a, b);
      return false;
    }
    return true;
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

  // First swap that makes a match, or null. Handy for hints later.
  function findValidMove(grid) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const a = { r, c };
        for (const b of [{ r, c: c + 1 }, { r: r + 1, c }]) {
          if (!inBounds(b)) continue;
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

  // Points for one clear step. 3 → 30, 4 → 60, 5 → 120, each piece past 4 adds 20 more,
  // summed over all runs, times the chain number (1, 2, 3...).
  function scoreFor(matches, chain) {
    let total = 0;
    for (const m of matches) {
      if (m.length === 3) total += 30;
      else if (m.length === 4) total += 60;
      else total += 100 + 20 * (m.length - 4);
    }
    return total * chain;
  }

  return {
    SIZE, TYPES,
    newPiece, createBoard, isAdjacent, swap, findMatches, trySwap,
    clearCells, applyGravity, refill, findValidMove, hasValidMove, shuffle, scoreFor,
  };
})();
