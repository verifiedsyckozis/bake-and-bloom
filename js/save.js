// Saved progress: unlocked levels, stars, best scores, lives, and the mute setting.
// Lives work like the classic rules: 5 max, lose one when you fail (or quit after
// moving), and get one back every 30 minutes.
window.M3 = window.M3 || {};

M3.save = (function () {
  const KEY = 'bakebloom.save.v1';
  const MAX_LIVES = 5;
  const REGEN_MS = 30 * 60 * 1000;

  function defaults() {
    return { unlocked: 0, stars: [], best: [], lives: MAX_LIVES, nextLifeAt: null, muted: false };
  }

  // localStorage can throw (e.g. some private modes), so never let it break the game.
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw) return Object.assign(defaults(), raw);
    } catch (e) { /* ignore */ }
    return defaults();
  }

  const data = load();

  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  // Hand out any lives that have grown back since last time.
  function regen() {
    const now = Date.now();
    let changed = false;
    while (data.lives < MAX_LIVES && data.nextLifeAt && now >= data.nextLifeAt) {
      data.lives++;
      data.nextLifeAt = data.lives < MAX_LIVES ? data.nextLifeAt + REGEN_MS : null;
      changed = true;
    }
    if (data.lives >= MAX_LIVES && data.nextLifeAt) {
      data.nextLifeAt = null;
      changed = true;
    }
    if (changed) write();
  }

  function lives() {
    regen();
    return data.lives;
  }

  function msToNextLife() {
    regen();
    return data.nextLifeAt ? Math.max(0, data.nextLifeAt - Date.now()) : 0;
  }

  function loseLife() {
    regen();
    if (data.lives <= 0) return;
    if (data.lives === MAX_LIVES) data.nextLifeAt = Date.now() + REGEN_MS;
    data.lives--;
    write();
  }

  function recordWin(index, stars, score) {
    data.stars[index] = Math.max(data.stars[index] || 0, stars);
    data.best[index] = Math.max(data.best[index] || 0, score);
    data.unlocked = Math.max(data.unlocked, Math.min(index + 1, M3.LEVELS.length - 1));
    write();
  }

  function setMuted(muted) {
    data.muted = muted;
    write();
  }

  return { MAX_LIVES, data, lives, msToNextLife, loseLife, recordWin, setMuted };
})();
