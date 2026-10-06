// Screens, game state, input, and the turn loop (swap -> clear -> fall -> repeat).
window.M3 = window.M3 || {};

(function () {
  const B = M3.board;
  const R = M3.render;
  const A = M3.audio;
  const S = M3.save;
  const LEVELS = M3.LEVELS;
  const THEME = M3.THEME;

  const $ = id => document.getElementById(id);
  const boardEl = $('board');
  const scoreEl = $('score');
  const movesEl = $('moves');
  const goalEl = $('goal');
  const overlay = $('overlay');
  const card = $('card');

  const game = {
    index: 0,
    level: null,
    grid: null,
    frost: null,
    moves: 0,
    score: 0,
    collected: {},
    selected: null, // { r, c } or null
    busy: false,    // true while animating; input is ignored
    playing: false, // a level is in progress
    moved: false,   // the player has used a move (quitting now costs a life)
  };

  const fmt = n => n.toLocaleString('en-US');

  // ===== Lives & sound =====

  function updateLives() {
    const lives = S.lives();
    $('lives-count').textContent = lives;
    const ms = S.msToNextLife();
    $('life-timer').textContent = ms ? clock(ms) : 'Full';
    const outTimer = $('out-timer');
    if (outTimer) outTimer.textContent = clock(ms);
  }

  function clock(ms) {
    const s = Math.ceil(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function setMuted(muted) {
    S.setMuted(muted);
    A.setMuted(muted);
    const btn = $('mute');
    btn.textContent = muted ? '🔇' : '🔊';
    btn.setAttribute('aria-pressed', String(muted));
    btn.setAttribute('aria-label', muted ? 'Unmute sounds' : 'Mute sounds');
  }

  // ===== Cards (start, win, lose, quit) =====

  function showCard(html, buttons) {
    card.innerHTML = html + '<div class="card-buttons"></div>';
    const row = card.querySelector('.card-buttons');
    for (const { label, onClick, quiet } of buttons) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn' + (quiet ? ' btn-quiet' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => { A.play('tap'); onClick(); });
      row.appendChild(btn);
    }
    overlay.hidden = false;
    row.lastChild.focus();
  }

  function hideCard() {
    overlay.hidden = true;
  }

  function starsHTML(count) {
    return '<div class="card-stars">' +
      [0, 1, 2].map(i => '<span class="' + (i < count ? 'on' : '') + '" style="--i:' + i + '">★</span>').join('') +
      '</div>';
  }

  function goalSentence(level) {
    if (level.goal === 'score') return 'Score <b>' + fmt(level.stars[0]) + '</b> points in ' + level.moves + ' moves.';
    if (level.goal === 'frost') return 'Scrape off all the frosting in ' + level.moves + ' moves.';
    return 'Fill this order in ' + level.moves + ' moves:';
  }

  function orderIcon(key) {
    if (key === 'line') return R.pieceHTML(0, 'h');
    if (key === 'wrap') return R.pieceHTML(1, 'wrap');
    if (key === 'bomb') return R.pieceHTML(-1, 'bomb');
    return R.pieceHTML(key, null);
  }

  function orderName(key) {
    if (typeof key === 'number') return THEME.pieces[key].label;
    return THEME.specials[key];
  }

  function outOfLivesCard() {
    showCard(
      '<h2>Out of hearts</h2><p class="card-big">♥ 0</p>' +
      '<p>Next heart in <b id="out-timer">' + clock(S.msToNextLife()) + '</b>.<br>Take a little break and come back.</p>',
      [{ label: 'OK', onClick: hideCard }]);
  }

  function openLevel(index) {
    if (S.lives() <= 0) return outOfLivesCard();
    const level = LEVELS[index];
    let order = '';
    if (level.goal === 'order') {
      order = '<div class="card-order">' + level.order.map(o =>
        '<span title="' + orderName(o.key) + '">' + orderIcon(o.key) + '<b>' + o.count + '</b></span>').join('') + '</div>';
    }
    showCard(
      '<h2>Level ' + (index + 1) + '</h2>' + starsHTML(S.data.stars[index] || 0) +
      '<p>' + goalSentence(level) + '</p>' + order + '<p class="card-tip">' + level.tip + '</p>',
      [
        { label: 'Not now', quiet: true, onClick: hideCard },
        { label: 'Play', onClick: () => { hideCard(); startLevel(index); } },
      ]);
  }

  // ===== Level map =====

  function showMap() {
    game.playing = false;
    stopHint();
    $('game-screen').hidden = true;
    $('map-screen').hidden = false;
    const gridEl = $('level-grid');
    gridEl.innerHTML = '';
    LEVELS.forEach((level, i) => {
      const locked = i > S.data.unlocked;
      const stars = S.data.stars[i] || 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'level-btn' + (locked ? ' locked' : '') + (i === S.data.unlocked ? ' current' : '');
      btn.disabled = locked;
      btn.setAttribute('aria-label', 'Level ' + (i + 1) + (locked ? ', locked' : ', ' + stars + ' stars'));
      btn.innerHTML = '<span class="level-num">' + (locked ? '🔒' : i + 1) + '</span>' +
        '<span class="level-stars">' + '★'.repeat(stars) + '<i>' + '★'.repeat(3 - stars) + '</i></span>';
      btn.addEventListener('click', () => { A.play('tap'); openLevel(i); });
      gridEl.appendChild(btn);
    });
  }

  // ===== HUD =====

  function starsFor(score) {
    return game.level.stars.filter(t => score >= t).length;
  }

  function updateHud() {
    movesEl.textContent = game.moves;
    movesEl.classList.toggle('low', game.moves <= 5);
    scoreEl.textContent = fmt(game.score);
    const top = game.level.stars[2];
    $('star-fill').style.width = Math.min(100, (game.score / top) * 100) + '%';
    game.level.stars.forEach((t, i) => {
      const mark = $('star-mark-' + i);
      mark.style.left = Math.min(100, (t / top) * 100) + '%';
      mark.classList.toggle('on', game.score >= t);
    });
    updateGoal();
  }

  function orderLeft(o) {
    return Math.max(0, o.count - (game.collected[o.key] || 0));
  }

  function updateGoal() {
    const level = game.level;
    let html;
    if (level.goal === 'score') {
      const left = Math.max(0, level.stars[0] - game.score);
      html = '<span class="goal-item' + (left ? '' : ' done') + '"><span class="goal-star">★</span><b>' +
        (left ? fmt(level.stars[0]) + ' points' : 'Target reached!') + '</b></span>';
    } else if (level.goal === 'frost') {
      const left = B.frostLeft(game.frost);
      html = '<span class="goal-item' + (left ? '' : ' done') + '"><span class="mini-frost"></span><b>' +
        (left ? left + ' frosting left' : 'All clean!') + '</b></span>';
    } else {
      html = level.order.map(o => {
        const left = orderLeft(o);
        return '<span class="goal-item' + (left ? '' : ' done') + '" title="' + orderName(o.key) + '">' +
          orderIcon(o.key) + '<b>' + (left || '✓') + '</b></span>';
      }).join('');
    }
    goalEl.innerHTML = html;
  }

  function goalsMet() {
    if (game.level.goal === 'frost') return B.frostLeft(game.frost) === 0;
    if (game.level.goal === 'order') return game.level.order.every(o => orderLeft(o) === 0);
    return false; // score levels play every move
  }

  // ===== Starting and ending levels =====

  function startLevel(index) {
    const level = LEVELS[index];
    Object.assign(game, {
      index, level, moves: level.moves, score: 0, collected: {},
      selected: null, busy: false, playing: true, moved: false,
    });
    B.setColors(level.colors);
    game.grid = B.createBoard();
    game.frost = B.parseFrost(level.frost);
    $('map-screen').hidden = true;
    $('game-screen').hidden = false;
    $('level-label').textContent = 'Level ' + (index + 1);
    R.build(boardEl, game.grid, game.frost);
    updateHud();
    scheduleHint();
  }

  async function winLevel() {
    game.playing = false;
    const stars = starsFor(game.score);
    const isNew = game.score > (S.data.best[game.index] || 0);
    S.recordWin(game.index, stars, game.score);
    A.play('win');
    await R.wait(700);
    const next = game.index + 1 < LEVELS.length ? game.index + 1 : null;
    showCard(
      '<h2>Level ' + (game.index + 1) + ' complete!</h2>' + starsHTML(stars) +
      '<p class="card-big">' + fmt(game.score) + '</p>' +
      (isNew ? '<p class="card-tip">New best!</p>' : '') +
      (next === null ? '<p>You finished every level. What a baker!</p>' : ''),
      [
        { label: 'Levels', quiet: true, onClick: () => { hideCard(); showMap(); } },
        next === null
          ? { label: 'Play again', onClick: () => { hideCard(); openLevel(game.index); } }
          : { label: 'Next level', onClick: () => { hideCard(); showMap(); openLevel(next); } },
      ]);
    stars && [0, 1, 2].slice(0, stars).forEach(i => setTimeout(() => A.play('star', i), 350 + i * 300));
  }

  async function loseLevel(reason) {
    game.playing = false;
    S.loseLife();
    updateLives();
    A.play('lose');
    await R.wait(900);
    const lives = S.lives();
    showCard(
      '<h2>' + reason + '</h2>' +
      '<p class="card-big lost">♥ −1</p>' +
      '<p>You have <b>' + lives + '</b> ' + (lives === 1 ? 'heart' : 'hearts') + ' left.</p>',
      [
        { label: 'Levels', quiet: true, onClick: () => { hideCard(); showMap(); } },
        { label: 'Try again', onClick: () => { hideCard(); openLevel(game.index); } },
      ]);
  }

  function confirmQuit() {
    showCard(
      '<h2>Leave this level?</h2><p>You\'ve started playing, so leaving costs a heart.</p>',
      [
        { label: 'Leave (−1 ♥)', quiet: true, onClick: () => {
          hideCard();
          S.loseLife();
          updateLives();
          A.play('life');
          showMap();
        } },
        { label: 'Keep playing', onClick: hideCard },
      ]);
  }

  // ===== Turn loop =====

  function select(pos) {
    game.selected = pos;
    R.select(game.grid, pos);
  }

  function onTileClick(pos) {
    if (game.busy || !game.playing) return;
    const sel = game.selected;
    if (!sel) { A.play('tap'); return select(pos); }
    if (sel.r === pos.r && sel.c === pos.c) return select(null);
    if (B.isAdjacent(sel, pos)) {
      select(null);
      attemptSwap(sel, pos);
    } else {
      A.play('tap');
      select(pos);
    }
  }

  async function attemptSwap(a, b) {
    if (game.busy || !game.playing) return;
    game.busy = true;
    stopHint();
    const { grid } = game;

    B.swap(grid, a, b);
    R.sync(grid);
    A.play('swap');
    await R.wait(R.TIMING.move);

    const combo = B.isCombo(grid, a, b);
    if (!combo && B.findMatches(grid).matches.length === 0) {
      B.swap(grid, a, b);
      R.sync(grid);
      await R.wait(R.TIMING.move);
      R.shake(grid, [a, b]);
      A.play('invalid');
      game.busy = false;
      scheduleHint();
      return;
    }

    game.moves--;
    game.moved = true;
    updateHud();

    let chain = 1;
    if (combo) {
      await showClear(B.comboStep(grid, game.frost, a, b), 1);
      await dropAndFill();
      chain = 2;
    }
    await cascade([a, b], chain, false);
    await afterTurn();
  }

  // Animate one clear record from the board engine and bank its points.
  async function showClear(rec, chain) {
    if (rec.converted.length) {
      A.play('special');
      await R.convert(rec.converted);
    }
    R.effects(rec.effects);
    const kinds = new Set(rec.effects.map(fx => fx.kind));
    if (kinds.has('board')) A.play('board');
    else if (kinds.has('bomb')) A.play('bomb');
    if (kinds.has('blast')) A.play('wrap');
    if (kinds.has('row') || kinds.has('col')) A.play('line');
    A.play('match', chain);
    if (rec.frosted.length) A.play('frost');
    if (rec.created.length) setTimeout(() => A.play('special'), 120);

    for (const p of rec.popups) R.popup('+' + fmt(p.points), p.r, p.c);
    await R.pop(rec.removed);
    R.updateFrost(rec.frosted);
    R.sync(game.grid);

    game.score += rec.score;
    for (const k in rec.collected) game.collected[k] = (game.collected[k] || 0) + rec.collected[k];
    R.bump(scoreEl);
    updateHud();
  }

  async function dropAndFill() {
    B.applyGravity(game.grid);
    const spawns = B.refill(game.grid);
    await R.fall(game.grid, spawns);
  }

  // Clear, drop, refill, and repeat until the board settles.
  async function cascade(preferred, chain, fireSpecials) {
    let steps = 0;
    while (steps++ < 80) {
      const rec = B.step(game.grid, game.frost, { preferred, chain, fireSpecials });
      if (!rec) break;
      await showClear(rec, chain);
      if (chain >= 3 && !fireSpecials) {
        R.banner(THEME.words[Math.min(chain - 3, THEME.words.length - 1)]);
        A.play('word');
      }
      await dropAndFill();
      preferred = [];
      chain++;
    }
  }

  async function afterTurn() {
    const done = goalsMet();
    if (done || game.moves === 0) {
      if (!done && game.level.goal !== 'score') return loseLevel('Out of moves!');
      if (done || game.score >= game.level.stars[0]) await finale();
      if (game.score < game.level.stars[0]) {
        return loseLevel(game.level.goal === 'score' ? 'Out of moves!' : 'Not quite enough points');
      }
      return winLevel();
    }

    if (!B.hasValidMove(game.grid)) {
      R.banner('No moves — shuffling!');
      A.play('shuffle');
      await R.wait(R.TIMING.shuffleDelay);
      B.shuffle(game.grid);
      await R.shuffle(game.grid);
    }
    game.busy = false;
    scheduleHint();
  }

  // Level won: leftover moves turn into striped pieces, then every special fires.
  async function finale() {
    const hasSpecials = game.grid.flat().some(p => B.kindOf(p));
    if (!game.moves && !hasSpecials) return;
    R.banner(THEME.finale);
    A.play('word');
    await R.wait(900);
    while (game.moves > 0) {
      const normals = game.grid.flat().filter(p => p && !p.special && p.type >= 0);
      if (!normals.length) break;
      normals[Math.floor(Math.random() * normals.length)].special = Math.random() < 0.5 ? 'h' : 'v';
      game.moves--;
      updateHud();
      R.sync(game.grid);
      A.play('convert');
      await R.wait(90);
    }
    game.moves = 0;
    updateHud();
    await R.wait(300);
    await cascade([], 1, true);
  }

  // ===== Hints: wiggle a valid move after a few idle seconds =====

  let hintTimer = null;

  function stopHint() {
    clearTimeout(hintTimer);
    R.clearHint();
  }

  function scheduleHint() {
    stopHint();
    if (!game.playing || game.busy) return;
    hintTimer = setTimeout(() => {
      const move = B.findValidMove(game.grid);
      if (move && game.playing && !game.busy) R.hint(game.grid, move);
    }, 6000);
  }

  // ===== Input =====

  // Pointer input: a tap acts like a click; a drag past the threshold swaps
  // toward the drag direction. Covers mouse, touch, and pen in one path.
  let drag = null; // { pos, x, y, swiped }

  boardEl.addEventListener('pointerdown', e => {
    const tile = e.target.closest('.tile');
    if (!tile || !e.isPrimary) return;
    scheduleHint();
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
    if (game.busy || !game.playing) return true;
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

  // Sound can only start after the player taps the page. Different browsers
  // accept different events, so listen to all of them.
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
    document.addEventListener(type, () => A.unlock(), true);
  }

  $('back').addEventListener('click', () => {
    if (game.busy) return;
    A.play('tap');
    if (game.playing && game.moved) confirmQuit();
    else showMap();
  });

  $('mute').addEventListener('click', () => {
    A.unlock();
    setMuted(!S.data.muted);
    A.play('tap');
  });

  setMuted(S.data.muted);
  updateLives();
  setInterval(updateLives, 1000);
  showMap();

  // Exposed for console testing.
  M3.game = game;
})();
