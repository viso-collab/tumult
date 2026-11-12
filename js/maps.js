// maps.js — banerne: platforme, startpunkter og baggrunde.
const W = 960, H = 540;

function seeded(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function hillY(x, base, amp, freq, phase) {
  return base - Math.sin(x * freq + phase) * amp - Math.sin(x * freq * 2.3 + 1 + phase) * amp * .4;
}
function hillLayer(c, base, amp, freq, phase, col) {
  c.beginPath(); c.moveTo(-30, H + 30);
  for (let x = -30; x <= W + 30; x += 15) c.lineTo(x, hillY(x, base, amp, freq, phase));
  c.lineTo(W + 30, H + 30); c.closePath();
  c.fillStyle = col; c.fill();
}
function sky(c, stops) {
  const g = c.createLinearGradient(0, 0, 0, H);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  c.fillStyle = g; c.fillRect(-30, -30, W + 60, H + 60);
}
function glowCircle(c, x, y, r, col, glowRgb) {
  const g = c.createRadialGradient(x, y, r * .5, x, y, r * 3);
  g.addColorStop(0, `rgba(${glowRgb},.45)`); g.addColorStop(1, `rgba(${glowRgb},0)`);
  c.fillStyle = g; c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}

// ---------- Kløverbakken (græsslette) ----------
const MEADOW = (() => {
  const r = seeded(7);
  return {
    clouds: Array.from({ length: 6 }, (_, i) => ({ x: i * 200 + r() * 80, y: 50 + r() * 110, r: 18 + r() * 16, s: .15 + r() * .2 })),
    trees: Array.from({ length: 7 }, (_, i) => ({ x: 40 + i * 140 + r() * 50, s: .8 + r() * .5 })),
    flowers: Array.from({ length: 40 }, () => ({ x: r() * W, y: 495 + r() * 45, c: ['#fff', '#ffd23f', '#ff8fb1', '#b48cff'][Math.floor(r() * 4)] })),
  };
})();
function cloud(c, x, y, r) {
  c.fillStyle = 'rgba(255,255,255,.95)';
  [[0, 0, 1], [.9, .2, .8], [-.9, .25, .7], [.2, -.5, .75]].forEach(([dx, dy, s]) => {
    c.beginPath(); c.arc(x + dx * r, y + dy * r, r * s, 0, TAU); c.fill();
  });
}
function tree(c, x, y, s) {
  c.fillStyle = '#6b4a32'; c.fillRect(x - 3 * s, y - 24 * s, 6 * s, 26 * s);
  c.fillStyle = '#3f8f3c';
  [[0, -34, 15], [-10, -24, 11], [10, -24, 11]].forEach(([dx, dy, r]) => { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, TAU); c.fill(); });
  c.fillStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.arc(x - 4 * s, y - 38 * s, 6 * s, 0, TAU); c.fill();
}
function bgMeadow(c, t) {
  sky(c, [[0, '#6fbfff'], [.7, '#cdeeff'], [1, '#e9f8ff']]);
  glowCircle(c, 820, 90, 38, '#fff6c2', '255,240,170');
  MEADOW.clouds.forEach(cl => cloud(c, ((cl.x + t * cl.s) % (W + 240)) - 120, cl.y, cl.r));
  hillLayer(c, 340, 40, .006, 0, '#a5da8f');
  hillLayer(c, 410, 30, .009, 2, '#7cc06a');
  MEADOW.trees.forEach(tr => tree(c, tr.x, hillY(tr.x, 410, 30, .009, 2) + 4, tr.s));
  hillLayer(c, 490, 18, .012, 4, '#5fa850');
  MEADOW.flowers.forEach(fl => { c.fillStyle = fl.c; c.beginPath(); c.arc(fl.x, fl.y, 2.5, 0, TAU); c.fill(); });
}

// ---------- Solskær (ørken) ----------
const DESERT = (() => {
  const r = seeded(21);
  return {
    mesasFar: [[20, 170, 110], [230, 120, 80], [560, 200, 130], [820, 150, 95]],
    mesasNear: [[-40, 200, 70], [380, 140, 60], [700, 230, 85]],
    cacti: Array.from({ length: 5 }, (_, i) => ({ x: 60 + i * 210 + r() * 60, s: .7 + r() * .5 })),
  };
})();
function mesa(c, x, w, h, base, col) {
  c.fillStyle = col; c.beginPath();
  c.moveTo(x, base); c.lineTo(x + w * .12, base - h); c.lineTo(x + w * .88, base - h); c.lineTo(x + w, base); c.closePath(); c.fill();
}
function cactus(c, x, y, s) {
  const col = '#5c9d55';
  polyStroke(c, [[x - 16 * s, y - 50 * s], [x - 16 * s, y - 30 * s], [x, y - 30 * s]], 10 * s, col);
  polyStroke(c, [[x + 14 * s, y - 56 * s], [x + 14 * s, y - 38 * s], [x, y - 38 * s]], 10 * s, col);
  polyStroke(c, [[x, y], [x, y - 64 * s]], 14 * s, col);
}
function bgDesert(c, t) {
  sky(c, [[0, '#ff8f5a'], [.55, '#ffc98a'], [1, '#ffe4b5']]);
  glowCircle(c, 480, 210, 80, '#fff1c9', '255,236,190');
  DESERT.mesasFar.forEach(([x, w, h]) => mesa(c, x, w, h, 380, '#e5946a'));
  DESERT.mesasNear.forEach(([x, w, h]) => mesa(c, x, w, h, 420, '#cf7650'));
  hillLayer(c, 430, 22, .007, 1, '#f0b56e');
  DESERT.cacti.forEach(k => cactus(c, k.x, hillY(k.x, 430, 22, .007, 1) + 6, k.s));
  hillLayer(c, 480, 20, .01, 3, '#e39e57');
  const tx = ((t * 1.6) % (W + 200)) - 100, ty = hillY(tx, 480, 20, .01, 3) - 12 - Math.abs(Math.sin(t * .1)) * 18;
  c.save(); c.translate(tx, ty); c.rotate(t * .1);
  c.strokeStyle = '#a0703e'; c.lineWidth = 2;
  for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(0, 0, 6 + i * 1.6, i, i + 4.2); c.stroke(); }
  c.restore();
}

// ---------- Frostfjeld (bjerg) ----------
const MOUNT = (() => {
  const r = seeded(99);
  return {
    stars: Array.from({ length: 60 }, () => ({ x: r() * W, y: r() * 250, s: r() * 1.4 + .4, p: r() * 6 })),
    far: [[80, 230, 260], [300, 280, 300], [540, 210, 240], [760, 300, 320], [960, 220, 260]],
    mid: [[-20, 170, 260], [200, 200, 240], [440, 160, 220], [680, 210, 260], [900, 180, 240]],
    pines: Array.from({ length: 22 }, (_, i) => ({ x: i * 46 + r() * 20, s: .7 + r() * .6 })),
    snow: Array.from({ length: 70 }, () => ({ x: r() * W, y: r() * 560, s: .4 + r() * .8, r: 1 + r() * 2, p: r() * 6 })),
  };
})();
function peaks(c, list, base, col, cap) {
  list.forEach(([x, h, w]) => {
    c.fillStyle = col; c.beginPath();
    c.moveTo(x - w / 2, base); c.lineTo(x, base - h); c.lineTo(x + w / 2, base); c.closePath(); c.fill();
    const top = base - h;
    c.fillStyle = cap; c.beginPath();
    c.moveTo(x, top);
    c.lineTo(x + w * .16, top + h * .32); c.lineTo(x + w * .07, top + h * .26);
    c.lineTo(x, top + h * .36); c.lineTo(x - w * .07, top + h * .26);
    c.lineTo(x - w * .16, top + h * .32); c.closePath(); c.fill();
  });
}
function bgMountain(c, t) {
  sky(c, [[0, '#1f2150'], [.6, '#5b4e93'], [1, '#a07fb8']]);
  MOUNT.stars.forEach(s => { c.globalAlpha = .4 + .4 * Math.sin(t * .03 + s.p); c.fillStyle = '#fff'; c.fillRect(s.x, s.y, s.s, s.s); });
  c.globalAlpha = 1;
  glowCircle(c, 770, 90, 30, '#f3ecff', '220,210,255');
  c.fillStyle = '#d9cfee';
  [[762, 84, 6], [780, 100, 4], [774, 78, 3]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); });
  peaks(c, MOUNT.far, 430, '#4b4f8c', '#dfe6ff');
  peaks(c, MOUNT.mid, 470, '#363a70', '#c7cff2');
  MOUNT.pines.forEach(p => {
    const x = p.x, y = 545, s = p.s;
    c.fillStyle = '#1d2246';
    for (let i = 0; i < 3; i++) {
      c.beginPath(); c.moveTo(x - (22 - i * 5) * s, y - i * 22 * s); c.lineTo(x, y - (40 + i * 22) * s); c.lineTo(x + (22 - i * 5) * s, y - i * 22 * s); c.closePath(); c.fill();
    }
  });
  c.fillStyle = 'rgba(255,255,255,.85)';
  MOUNT.snow.forEach(f => {
    const y = ((f.y + t * f.s) % 580) - 20, x = f.x + Math.sin(t * .02 + f.p) * 14;
    c.beginPath(); c.arc(x, y, f.r, 0, TAU); c.fill();
  });
}

// ---------- banelisten ----------
const MAPS = [
  {
    name: 'KLØVERBAKKEN', terrain: 'Græsslette',
    plats: [
      { x: 170, y: 400, w: 620, solid: true },
      { x: 250, y: 300, w: 140 },
      { x: 570, y: 300, w: 140 },
      { x: 410, y: 210, w: 140 },
    ],
    spawns: [[330, 400], [630, 400]],
    bg: bgMeadow,
    style: { top: '#6cc04a', topHi: '#9be37a', body: '#8a5a3c', body2: '#6b4430', plank: '#a9744a', plankHi: '#d39b6a', drip: true },
  },
  {
    name: 'SOLSKÆR', terrain: 'Ørken',
    plats: [
      { x: 150, y: 410, w: 660, solid: true },
      { x: 220, y: 305, w: 150 },
      { x: 590, y: 305, w: 150 },
    ],
    spawns: [[320, 410], [640, 410]],
    bg: bgDesert,
    style: { top: '#f2c27b', topHi: '#ffe0a8', body: '#d1834f', body2: '#b56a3e', plank: '#8b6a4f', plankHi: '#b89270', drip: false },
  },
  {
    name: 'FROSTFJELD', terrain: 'Bjerg',
    plats: [
      { x: 210, y: 400, w: 540, solid: true },
      { x: 80, y: 310, w: 120 },
      { x: 760, y: 310, w: 120 },
      { x: 420, y: 225, w: 120, move: { amp: 150, speed: .012 } },
    ],
    spawns: [[340, 400], [620, 400]],
    bg: bgMountain,
    style: { top: '#eef3ff', topHi: '#ffffff', body: '#5d6283', body2: '#474b69', plank: '#6f6a8a', plankHi: '#9b96b8', drip: true },
  },
];

// Platformenes position på et bestemt tidspunkt (bevægelige platforme regnes ud fra tick)
function platsAt(m, tick) {
  return m.plats.map(p => {
    if (!p.move) return { x: p.x, y: p.y, w: p.w, solid: !!p.solid, dx: 0 };
    const x = p.x + Math.sin(tick * p.move.speed) * p.move.amp;
    const xp = p.x + Math.sin((tick - 1) * p.move.speed) * p.move.amp;
    return { x, y: p.y, w: p.w, solid: false, dx: x - xp, move: true };
  });
}

function drawPlatforms(c, m, t) {
  const S = m.style;
  platsAt(m, t).forEach(p => {
    if (p.solid) {
      blob(c, () => {
        c.moveTo(p.x + 4, p.y + 8); c.lineTo(p.x + p.w - 4, p.y + 8);
        c.lineTo(p.x + p.w - 34, p.y + 60);
        c.quadraticCurveTo(p.x + p.w * .62, p.y + 128, p.x + p.w * .5, p.y + 140);
        c.quadraticCurveTo(p.x + p.w * .38, p.y + 128, p.x + 34, p.y + 60);
        c.closePath();
      }, S.body);
      fillShape(c, () => { c.moveTo(p.x + 30, p.y + 40); c.lineTo(p.x + p.w - 30, p.y + 40); c.lineTo(p.x + p.w - 46, p.y + 62); c.lineTo(p.x + 46, p.y + 62); c.closePath(); }, S.body2);
      fillShape(c, () => { c.moveTo(p.x + p.w * .3, p.y + 90); c.lineTo(p.x + p.w * .7, p.y + 90); c.lineTo(p.x + p.w * .62, p.y + 104); c.lineTo(p.x + p.w * .38, p.y + 104); c.closePath(); }, S.body2);
      if (S.drip) for (let x = p.x + 14; x < p.x + p.w - 8; x += 28) blob(c, () => c.arc(x, p.y + 11, 8, 0, Math.PI), S.top, 2.5);
      blob(c, () => c.roundRect(p.x - 6, p.y - 4, p.w + 12, 18, 9), S.top);
      fillShape(c, () => c.roundRect(p.x + 2, p.y - 1, p.w - 4, 4, 2), S.topHi);
    } else {
      blob(c, () => c.roundRect(p.x, p.y - 3, p.w, 13, 6), S.plank);
      fillShape(c, () => c.roundRect(p.x + 5, p.y - 1, p.w - 10, 3, 2), S.plankHi);
      if (p.move) {
        c.fillStyle = 'rgba(255,255,255,.5)';
        [-1, 1].forEach(d => { c.beginPath(); c.arc(p.x + p.w / 2 + d * 20, p.y + 3.5, 2.5, 0, TAU); c.fill(); });
      }
    }
  });
}
