// input.js — tastatur og controller.
const Input = (() => {
  const keys = new Set();
  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  const MAP = [
    { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', attack: 'KeyF', special: 'KeyG' },
    { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', attack: 'KeyK', special: 'KeyL' },
  ];
  function kb(i) { const m = MAP[i], o = {}; for (const k in m) o[k] = keys.has(m[k]); return o; }
  function pad(i) {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = list && list[i];
    if (!gp) return null;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, b = n => !!(gp.buttons[n] && gp.buttons[n].pressed);
    return { left: ax < -.4 || b(14), right: ax > .4 || b(15), up: b(0) || b(12) || ay < -.7, down: ay > .6 || b(13), attack: b(2), special: b(1) || b(3) };
  }
  function merge(...xs) {
    const o = { left: false, right: false, up: false, down: false, attack: false, special: false };
    xs.forEach(x => { if (x) for (const k in o) o[k] = o[k] || !!x[k]; });
    return o;
  }
  return {
    local: i => merge(kb(i), pad(i)),           // lokalt spil: spiller 1 og 2 hver deres taster
    any: () => merge(kb(0), kb(1), pad(0)),     // online: alle taster styrer din figur
  };
})();
