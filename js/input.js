// input.js — keyboard and controllers.
const Input = (() => {
  const keys = new Set();
  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // player 1: WASD + F (attack) + Q/E/R (extra attacks)
  // player 2: arrows + K (attack) + U/I/O (extra attacks)
  const MAP = [
    { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', attack: 'KeyF', s1: 'KeyQ', s2: 'KeyE', s3: 'KeyR' },
    { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', attack: 'KeyK', s1: 'KeyU', s2: 'KeyI', s3: 'KeyO' },
  ];
  function kb(i) { const m = MAP[i], o = {}; for (const k in m) o[k] = keys.has(m[k]); return o; }
  function gp(i) { const list = navigator.getGamepads ? navigator.getGamepads() : []; return (list && list[i]) || null; }
  function pad(i) {
    const g = gp(i);
    if (!g) return null;
    const ax = g.axes[0] || 0, ay = g.axes[1] || 0, b = n => !!(g.buttons[n] && g.buttons[n].pressed);
    // A = jump, X = attack, Y / B / RB = extra attacks
    return { left: ax < -.4 || b(14), right: ax > .4 || b(15), up: b(0) || b(12) || ay < -.7, down: ay > .6 || b(13), attack: b(2), s1: b(3), s2: b(1), s3: b(5) };
  }
  function merge(...xs) {
    const o = { left: false, right: false, up: false, down: false, attack: false, s1: false, s2: false, s3: false };
    xs.forEach(x => { if (x) for (const k in o) o[k] = o[k] || !!x[k]; });
    return o;
  }
  return {
    slot: i => i < 2 ? merge(kb(i), pad(i)) : merge(pad(i)),   // local play
    any: () => merge(kb(0), kb(1), pad(0)),                       // online: every key controls you
    padConnected: i => !!gp(i),
  };
})();
