// maps.js — stages: platforms, spawn points and backgrounds.
// Backgrounds are drawn in screen space (960x540) with parallax; platforms live in world space.
const W = 960, H = 540;

function seeded(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
function hillY(x, base, amp, freq, phase) {
  return base - Math.sin(x * freq + phase) * amp - Math.sin(x * freq * 2.3 + 1 + phase) * amp * .4;
}
function hillLayer(c, base, amp, freq, phase, top, bottom) {
  c.beginPath(); c.moveTo(-300, H + 300);
  for (let x = -300; x <= W + 300; x += 15) c.lineTo(x, hillY(x, base, amp, freq, phase));
  c.lineTo(W + 300, H + 300); c.closePath();
  const g = c.createLinearGradient(0, base - amp * 1.4, 0, H + 40);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  c.fillStyle = g; c.fill();
}
function sky(c, stops) {
  const g = c.createLinearGradient(0, 0, 0, H);
  stops.forEach(([o, color]) => g.addColorStop(o, color));
  c.fillStyle = g; c.fillRect(-60, -60, W + 120, H + 120);
}
function sunGlow(c, x, y, r, core, rgb) {
  const g = c.createRadialGradient(x, y, r * .4, x, y, r * 4);
  g.addColorStop(0, `rgba(${rgb},.55)`); g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g; c.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  const g2 = c.createRadialGradient(x - r * .3, y - r * .3, 0, x, y, r);
  g2.addColorStop(0, '#ffffff'); g2.addColorStop(1, core);
  c.fillStyle = g2; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}
function layer(c, k, ox, oy, fn) { c.save(); c.translate(-ox * k, -oy * k * .6); fn(); c.restore(); }
function haze(c, y0, y1, rgba) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba.replace('A', '0')); g.addColorStop(1, rgba.replace('A', '.55'));
  c.fillStyle = g; c.fillRect(-300, y0, W + 600, y1 - y0);
}
function cloud(c, x, y, r, tint) {
  [[0, 0, 1], [.9, .2, .8], [-.9, .25, .7], [.2, -.5, .75], [-.4, -.3, .6]].forEach(([dx, dy, s]) => {
    const cx = x + dx * r, cy = y + dy * r, rr = r * s;
    const g = c.createRadialGradient(cx - rr * .3, cy - rr * .4, rr * .1, cx, cy, rr);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, tint || '#dfe7f2');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, rr, 0, TAU); c.fill();
  });
}

// ---------- Clover Hill (grassland) ----------
const MEADOW = (() => {
  const r = seeded(7);
  return {
    clouds: Array.from({ length: 7 }, (_, i) => ({ x: i * 190 + r() * 80, y: 40 + r() * 110, r: 18 + r() * 16, s: .1 + r() * .15 })),
    trees: Array.from({ length: 9 }, (_, i) => ({ x: -120 + i * 150 + r() * 50, s: .8 + r() * .5 })),
    blades: Array.from({ length: 220 }, () => ({ x: -300 + r() * (W + 600), y: 492 + r() * 50, h: 4 + r() * 7, l: r() < .5 })),
    flowers: Array.from({ length: 50 }, () => ({ x: -300 + r() * (W + 600), y: 495 + r() * 45, c: ['#ffffff', '#ffd23f', '#ff8fb1', '#b48cff'][Math.floor(r() * 4)] })),
  };
})();
function tree(c, x, y, s) {
  const g = c.createLinearGradient(x - 4 * s, 0, x + 4 * s, 0);
  g.addColorStop(0, '#7a5638'); g.addColorStop(1, '#4a3322');
  c.fillStyle = g; c.fillRect(x - 3.5 * s, y - 26 * s, 7 * s, 28 * s);
  [[0, -38, 16], [-11, -27, 12], [11, -27, 12], [0, -26, 13]].forEach(([dx, dy, rr]) => {
    const cx = x + dx * s, cy = y + dy * s, R = rr * s;
    const gg = c.createRadialGradient(cx - R * .4, cy - R * .5, R * .1, cx, cy, R);
    gg.addColorStop(0, '#6fbf5a'); gg.addColorStop(.6, '#3f8a3a'); gg.addColorStop(1, '#2b5f2a');
    c.fillStyle = gg; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
  });
}
function bgMeadow(c, t, ox = 0, oy = 0) {
  sky(c, [[0, '#5aa9ec'], [.6, '#bfe3fb'], [1, '#e8f6ff']]);
  layer(c, .03, ox, oy, () => sunGlow(c, 820, 90, 34, '#fff4c4', '255,240,180'));
  layer(c, .05, ox, oy, () => MEADOW.clouds.forEach(cl => cloud(c, ((cl.x + t * cl.s) % (W + 400)) - 200, cl.y, cl.r)));
  layer(c, .06, ox, oy, () => {
    c.fillStyle = '#9fb8d6';
    c.beginPath(); c.moveTo(-300, 330);
    [[-120, 250], [60, 300], [220, 230], [400, 300], [560, 240], [760, 300], [900, 250], [1260, 330]].forEach(([x, y]) => c.lineTo(x, y));
    c.lineTo(1260, 400); c.lineTo(-300, 400); c.fill();
  });
  layer(c, .1, ox, oy, () => { hillLayer(c, 345, 40, .006, 0, '#9ccf86', '#7fb46c'); haze(c, 300, 380, 'rgba(220,240,255,A)'); });
  layer(c, .16, ox, oy, () => {
    hillLayer(c, 410, 30, .009, 2, '#73b85f', '#4f8f43');
    MEADOW.trees.forEach(tr => tree(c, tr.x, hillY(tr.x, 410, 30, .009, 2) + 4, tr.s));
  });
  layer(c, .26, ox, oy, () => {
    hillLayer(c, 492, 16, .012, 4, '#5ea64c', '#3d7a33');
    c.lineWidth = 1.2; c.lineCap = 'round';
    MEADOW.blades.forEach(b => { c.strokeStyle = b.l ? '#7cc463' : '#3f7d35'; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x + 1.5, b.y - b.h); c.stroke(); });
    MEADOW.flowers.forEach(fl => { c.fillStyle = fl.c; c.beginPath(); c.arc(fl.x, fl.y, 2.3, 0, TAU); c.fill(); });
  });
}

// ---------- Sunscorch Mesa (desert) ----------
const DESERT = (() => {
  const r = seeded(21);
  return {
    mesasFar: [[-200, 200, 100], [20, 170, 110], [230, 120, 80], [560, 200, 130], [820, 150, 95], [1050, 180, 100]],
    mesasNear: [[-260, 160, 60], [-40, 200, 70], [380, 140, 60], [700, 230, 85], [1040, 160, 70]],
    cacti: Array.from({ length: 7 }, (_, i) => ({ x: -160 + i * 200 + r() * 60, s: .7 + r() * .5 })),
  };
})();
function mesa(c, x, w, h, base, color) {
  const top = base - h;
  c.fillStyle = color; c.beginPath();
  c.moveTo(x, base); c.lineTo(x + w * .12, top); c.lineTo(x + w * .88, top); c.lineTo(x + w, base); c.closePath(); c.fill();
  c.fillStyle = 'rgba(80,30,20,.22)'; c.beginPath();
  c.moveTo(x + w * .6, top); c.lineTo(x + w * .88, top); c.lineTo(x + w, base); c.lineTo(x + w * .66, base); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,230,200,.18)'; c.lineWidth = 2;
  for (let i = 1; i < 4; i++) { const y = top + h * i / 4; c.beginPath(); c.moveTo(x + w * .12 * (1 - i / 4) + 4, y); c.lineTo(x + w - w * .12 * (1 - i / 4) - 4, y); c.stroke(); }
}
function cactus(c, x, y, s) {
  const col = '#5c9353';
  const arm = pts => {
    [[OUTC, 14 * s + 3], [col, 14 * s], ['rgba(190,230,170,.35)', 3 * s]].forEach(([st, w]) => {
      c.strokeStyle = st; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); pts.forEach(([a, b], i) => i ? c.lineTo(a, b) : c.moveTo(a, b)); c.stroke();
    });
  };
  arm([[x - 16 * s, y - 50 * s], [x - 16 * s, y - 30 * s], [x, y - 30 * s]]);
  arm([[x + 14 * s, y - 56 * s], [x + 14 * s, y - 38 * s], [x, y - 38 * s]]);
  arm([[x, y], [x, y - 64 * s]]);
}
function bgDesert(c, t, ox = 0, oy = 0) {
  sky(c, [[0, '#f0855a'], [.5, '#ffc48a'], [1, '#ffe3b6']]);
  layer(c, .03, ox, oy, () => sunGlow(c, 480, 200, 70, '#fff0c6', '255,236,190'));
  layer(c, .07, ox, oy, () => { DESERT.mesasFar.forEach(([x, w, h]) => mesa(c, x, w, h, 380, '#e0916a')); haze(c, 280, 390, 'rgba(255,215,170,A)'); });
  layer(c, .12, ox, oy, () => DESERT.mesasNear.forEach(([x, w, h]) => mesa(c, x, w, h, 425, '#c9714c')));
  layer(c, .18, ox, oy, () => {
    hillLayer(c, 432, 22, .007, 1, '#f2c07c', '#dca061');
    DESERT.cacti.forEach(k => cactus(c, k.x, hillY(k.x, 432, 22, .007, 1) + 6, k.s));
  });
  layer(c, .26, ox, oy, () => {
    hillLayer(c, 482, 18, .01, 3, '#e8a960', '#c9843f');
    c.strokeStyle = 'rgba(255,240,210,.25)'; c.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) { c.beginPath(); for (let x = -300; x <= W + 300; x += 20) c.lineTo(x, hillY(x, 498 + i * 7, 4, .03, i)); c.stroke(); }
    const tx = ((t * 1.6) % (W + 400)) - 200, ty = hillY(tx, 482, 18, .01, 3) - 12 - Math.abs(Math.sin(t * .1)) * 18;
    c.save(); c.translate(tx, ty); c.rotate(t * .1); c.strokeStyle = '#9a6a3a'; c.lineWidth = 1.6;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(0, 0, 5 + i * 1.5, i, i + 4.2); c.stroke(); }
    c.restore();
  });
}

// ---------- Frostpeak (mountain) ----------
const MOUNT = (() => {
  const r = seeded(99);
  return {
    stars: Array.from({ length: 80 }, () => ({ x: -100 + r() * (W + 200), y: r() * 260, s: r() * 1.4 + .4, p: r() * 6 })),
    far: [[-140, 220, 280], [80, 230, 260], [300, 280, 300], [540, 210, 240], [760, 300, 320], [980, 220, 260], [1160, 250, 280]],
    mid: [[-200, 160, 240], [-20, 170, 260], [200, 200, 240], [440, 160, 220], [680, 210, 260], [900, 180, 240], [1120, 170, 240]],
    pines: Array.from({ length: 34 }, (_, i) => ({ x: -300 + i * 46 + r() * 20, s: .7 + r() * .6 })),
    snow: Array.from({ length: 80 }, () => ({ x: r() * W, y: r() * 560, s: .4 + r() * .8, r: 1 + r() * 2, p: r() * 6 })),
  };
})();
function peaks(c, list, base, dark, light, cap) {
  list.forEach(([x, h, w]) => {
    const top = base - h;
    c.fillStyle = dark; c.beginPath(); c.moveTo(x - w / 2, base); c.lineTo(x, top); c.lineTo(x + w / 2, base); c.closePath(); c.fill();
    c.fillStyle = light; c.beginPath(); c.moveTo(x - w / 2, base); c.lineTo(x, top); c.lineTo(x - w * .05, base); c.closePath(); c.fill();
    c.fillStyle = cap; c.beginPath();
    c.moveTo(x, top);
    c.lineTo(x + w * .16, top + h * .32); c.lineTo(x + w * .07, top + h * .26);
    c.lineTo(x, top + h * .36); c.lineTo(x - w * .07, top + h * .26);
    c.lineTo(x - w * .16, top + h * .32); c.closePath(); c.fill();
  });
}
function bgMountain(c, t, ox = 0, oy = 0) {
  sky(c, [[0, '#141634'], [.55, '#4b4285'], [1, '#9b7cb4']]);
  layer(c, .02, ox, oy, () => {
    MOUNT.stars.forEach(s => { c.globalAlpha = .4 + .4 * Math.sin(t * .03 + s.p); c.fillStyle = '#fff'; c.fillRect(s.x, s.y, s.s, s.s); });
    c.globalAlpha = 1;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const g = c.createLinearGradient(0, 40 + i * 30, 0, 160 + i * 30);
      g.addColorStop(0, 'rgba(90,255,180,0)'); g.addColorStop(.5, `rgba(90,255,180,${.08 + i * .03})`); g.addColorStop(1, 'rgba(90,255,180,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(-200, 120 + i * 30);
      for (let x = -200; x <= W + 200; x += 40) c.lineTo(x, 90 + i * 30 + Math.sin(x * .01 + t * .01 + i) * 25);
      c.lineTo(W + 200, 220); c.lineTo(-200, 220); c.fill();
    }
    c.restore();
    sunGlow(c, 770, 90, 28, '#ece4ff', '220,210,255');
  });
  layer(c, .07, ox, oy, () => { peaks(c, MOUNT.far, 430, '#3f437a', '#5a5f9c', '#dfe6ff'); haze(c, 330, 440, 'rgba(150,130,190,A)'); });
  layer(c, .13, ox, oy, () => peaks(c, MOUNT.mid, 470, '#2b2f5e', '#40467e', '#c7cff2'));
  layer(c, .22, ox, oy, () => {
    MOUNT.pines.forEach(p => {
      const x = p.x, y = 548, s = p.s;
      for (let i = 0; i < 3; i++) {
        const g = c.createLinearGradient(x - 22 * s, 0, x + 22 * s, 0); g.addColorStop(0, '#2a3566'); g.addColorStop(1, '#151b3a');
        c.fillStyle = g; c.beginPath(); c.moveTo(x - (22 - i * 5) * s, y - i * 22 * s); c.lineTo(x, y - (40 + i * 22) * s); c.lineTo(x + (22 - i * 5) * s, y - i * 22 * s); c.closePath(); c.fill();
        c.fillStyle = 'rgba(230,240,255,.5)'; c.beginPath(); c.moveTo(x - 6 * s, y - (28 + i * 22) * s); c.lineTo(x, y - (40 + i * 22) * s); c.lineTo(x + 3 * s, y - (30 + i * 22) * s); c.closePath(); c.fill();
      }
    });
  });
  c.fillStyle = 'rgba(255,255,255,.85)';
  MOUNT.snow.forEach(f => {
    const y = ((f.y + t * f.s) % 580) - 20, x = f.x + Math.sin(t * .02 + f.p) * 14;
    c.beginPath(); c.arc(x, y, f.r, 0, TAU); c.fill();
  });
}

// ---------- Skyward Ruins (big 2v2 stage) ----------
const RUINS = (() => {
  const r = seeded(314);
  return {
    isles: [[-120, 210, 140], [120, 150, 90], [430, 120, 70], [700, 180, 110], [980, 140, 120]],
    columns: Array.from({ length: 9 }, (_, i) => ({ x: -200 + i * 165 + r() * 40, h: 60 + r() * 90, broken: r() < .6 })),
    clouds: Array.from({ length: 18 }, (_, i) => ({ x: -300 + i * 90 + r() * 40, y: 470 + r() * 50, r: 30 + r() * 26 })),
    birds: Array.from({ length: 5 }, () => ({ x: r() * W, y: 80 + r() * 100, s: .4 + r() * .4, p: r() * 6 })),
  };
})();
function floatIsle(c, x, y, w) {
  c.fillStyle = '#6b6aa0'; c.beginPath();
  c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.lineTo(x + w * .2, y + w * .45); c.lineTo(x, y + w * .7); c.lineTo(x - w * .25, y + w * .4); c.closePath(); c.fill();
  c.fillStyle = '#86a77a'; c.fillRect(x - w / 2, y - 4, w, 6);
  c.strokeStyle = 'rgba(220,235,255,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + w * .3, y + 2); c.lineTo(x + w * .3, y + 160); c.stroke();
}
function column(c, x, base, h, broken) {
  const g = c.createLinearGradient(x - 12, 0, x + 12, 0); g.addColorStop(0, '#d9c8b0'); g.addColorStop(1, '#8f7f6c');
  c.fillStyle = g;
  c.fillRect(x - 10, base - h, 20, h);
  c.fillRect(x - 14, base - 8, 28, 8);
  if (!broken) c.fillRect(x - 14, base - h - 8, 28, 8);
  else { c.beginPath(); c.moveTo(x - 10, base - h); c.lineTo(x - 3, base - h - 10); c.lineTo(x + 4, base - h - 3); c.lineTo(x + 10, base - h - 12); c.lineTo(x + 10, base - h); c.fill(); }
  c.strokeStyle = 'rgba(80,60,40,.25)'; c.lineWidth = 1;
  for (let i = -6; i <= 6; i += 4) { c.beginPath(); c.moveTo(x + i, base - h + 4); c.lineTo(x + i, base - 8); c.stroke(); }
}
function bgRuins(c, t, ox = 0, oy = 0) {
  sky(c, [[0, '#2c2a5c'], [.45, '#b85d7d'], [.75, '#f2a46a'], [1, '#ffd9a0']]);
  layer(c, .02, ox, oy, () => sunGlow(c, 480, 330, 60, '#ffe7b8', '255,200,150'));
  layer(c, .05, ox, oy, () => {
    RUINS.isles.forEach(([x, y, w]) => floatIsle(c, x, y, w));
    RUINS.birds.forEach(b => {
      const x = ((b.x + t * b.s) % (W + 200)) - 100, y = b.y + Math.sin(t * .03 + b.p) * 6, fl = Math.sin(t * .2 + b.p) * 3;
      c.strokeStyle = 'rgba(40,30,60,.7)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x - 6, y - fl); c.quadraticCurveTo(x - 3, y - 3, x, y); c.quadraticCurveTo(x + 3, y - 3, x + 6, y - fl); c.stroke();
    });
    haze(c, 250, 420, 'rgba(255,190,160,A)');
  });
  layer(c, .12, ox, oy, () => {
    c.fillStyle = '#7b6a78'; c.beginPath(); c.moveTo(-300, 470);
    for (let x = -300; x <= W + 300; x += 30) c.lineTo(x, 440 + Math.sin(x * .02) * 8);
    c.lineTo(W + 300, 560); c.lineTo(-300, 560); c.fill();
    RUINS.columns.forEach(col => column(c, col.x, 446, col.h, col.broken));
  });
  layer(c, .2, ox, oy, () => RUINS.clouds.forEach(cl => cloud(c, cl.x + Math.sin(t * .01 + cl.x) * 6, cl.y, cl.r, '#f0c3c8')));
}

// ---------- the stage list ----------
// spawns: [team A #1, team B #1, team A #2, team B #2]
const MAPS = [
  {
    name: 'CLOVER HILL', terrain: 'Grassland', world: { w: 960, h: 540 },
    plats: [
      { x: 170, y: 400, w: 620, solid: true, main: true },
      { x: 250, y: 300, w: 140 },
      { x: 570, y: 300, w: 140 },
      { x: 410, y: 210, w: 140 },
    ],
    spawns: [[330, 400], [630, 400], [250, 400], [710, 400]], respawn: [480, -40],
    bg: bgMeadow,
    style: { kind: 'grass', top: '#6cb04a', body: '#7a5236', plank: '#9c6b43' },
  },
  {
    name: 'SUNSCORCH MESA', terrain: 'Desert', world: { w: 960, h: 540 },
    plats: [
      { x: 150, y: 410, w: 660, solid: true, main: true },
      { x: 220, y: 305, w: 150 },
      { x: 590, y: 305, w: 150 },
    ],
    spawns: [[320, 410], [640, 410], [230, 410], [730, 410]], respawn: [480, -40],
    bg: bgDesert,
    style: { kind: 'sand', top: '#eebd78', body: '#c97a49', plank: '#8b6a4f' },
  },
  {
    name: 'FROSTPEAK', terrain: 'Mountain', world: { w: 960, h: 540 },
    plats: [
      { x: 210, y: 400, w: 540, solid: true, main: true },
      { x: 80, y: 310, w: 120 },
      { x: 760, y: 310, w: 120 },
      { x: 420, y: 225, w: 120, move: { amp: 150, speed: .012 } },
    ],
    spawns: [[340, 400], [620, 400], [260, 400], [700, 400]], respawn: [480, -40],
    bg: bgMountain,
    style: { kind: 'snow', top: '#eef3ff', body: '#5d6283', plank: '#6f6a8a' },
  },
  {
    name: 'SKYWARD RUINS', terrain: 'Ancient ruins', world: { w: 1600, h: 900 }, large: true,
    plats: [
      { x: 300, y: 640, w: 1000, solid: true, main: true },
      { x: 60, y: 560, w: 170, solid: true },
      { x: 1370, y: 560, w: 170, solid: true },
      { x: 430, y: 530, w: 180 },
      { x: 990, y: 530, w: 180 },
      { x: 700, y: 430, w: 200 },
      { x: 360, y: 400, w: 150 },
      { x: 1090, y: 400, w: 150 },
      { x: 720, y: 290, w: 160, move: { amp: 320, speed: .009 } },
    ],
    spawns: [[560, 640], [1040, 640], [680, 640], [920, 640]], respawn: [800, 60],
    bg: bgRuins,
    style: { kind: 'ruin', top: '#8fae6a', body: '#8c8478', plank: '#a39b8c' },
  },
];

// platform positions at a given tick (moving platforms are computed from the tick)
function platsAt(m, tick) {
  return m.plats.map(p => {
    if (!p.move) return { x: p.x, y: p.y, w: p.w, solid: !!p.solid, main: !!p.main, dx: 0 };
    const x = p.x + Math.sin(tick * p.move.speed) * p.move.amp;
    const xp = p.x + Math.sin((tick - 1) * p.move.speed) * p.move.amp;
    return { x, y: p.y, w: p.w, solid: false, dx: x - xp, move: true };
  });
}

function drawPlatforms(c, m, t) {
  const S = m.style;
  platsAt(m, t).forEach((p, idx) => {
    if (p.solid) {
      const depth = Math.min(150, p.w * .26 + 20);
      const body = () => {
        c.moveTo(p.x + 4, p.y + 8); c.lineTo(p.x + p.w - 4, p.y + 8);
        c.lineTo(p.x + p.w - Math.min(34, p.w * .15), p.y + depth * .45);
        c.quadraticCurveTo(p.x + p.w * .62, p.y + depth * .92, p.x + p.w * .5, p.y + depth);
        c.quadraticCurveTo(p.x + p.w * .38, p.y + depth * .92, p.x + Math.min(34, p.w * .15), p.y + depth * .45);
        c.closePath();
      };
      const g = c.createLinearGradient(0, p.y, 0, p.y + depth);
      g.addColorStop(0, shade(S.body, .1)); g.addColorStop(1, shade(S.body, -.5));
      c.beginPath(); body(); c.fillStyle = g; c.fill();
      c.save(); c.beginPath(); body(); c.clip();
      const r = seeded(idx * 31 + 5);
      if (S.kind === 'ruin') {
        c.strokeStyle = 'rgba(40,30,25,.35)'; c.lineWidth = 1.5;
        for (let y = p.y + 22; y < p.y + depth; y += 16) {
          c.beginPath(); c.moveTo(p.x, y); c.lineTo(p.x + p.w, y); c.stroke();
          for (let x = p.x + ((y / 16) % 2) * 20; x < p.x + p.w; x += 40) { c.beginPath(); c.moveTo(x, y - 16); c.lineTo(x, y); c.stroke(); }
        }
      } else {
        for (let i = 0; i < 4; i++) {
          const y = p.y + 24 + i * depth * .2;
          c.strokeStyle = `rgba(0,0,0,${.12 + i * .03})`; c.lineWidth = 4;
          c.beginPath(); for (let x = p.x; x <= p.x + p.w; x += 20) c.lineTo(x, y + Math.sin(x * .05 + i) * 3); c.stroke();
        }
      }
      for (let i = 0; i < p.w / 25; i++) {
        const x = p.x + r() * p.w, y = p.y + 20 + r() * depth * .6, rr = 2 + r() * 4;
        c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.ellipse(x, y, rr * 1.4, rr, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(x + 1, y + 1.5, rr * 1.4, rr * .6, 0, 0, Math.PI); c.fill();
      }
      if (S.kind === 'grass') {
        c.strokeStyle = 'rgba(60,40,20,.6)'; c.lineWidth = 1.2;
        for (let i = 0; i < p.w / 60; i++) { const x = p.x + 20 + r() * (p.w - 40); c.beginPath(); c.moveTo(x, p.y + 12); c.quadraticCurveTo(x + 6, p.y + 30, x + 2, p.y + 44); c.stroke(); }
      }
      c.restore();
      c.beginPath(); body(); c.lineWidth = 2; c.strokeStyle = OUTC; c.stroke();
      if (S.kind === 'snow') {
        c.fillStyle = '#cfe3ff';
        for (let x = p.x + 18; x < p.x + p.w - 10; x += 34) { c.beginPath(); c.moveTo(x - 4, p.y + 10); c.lineTo(x, p.y + 22 + (x % 3) * 4); c.lineTo(x + 4, p.y + 10); c.fill(); }
      }
      const tg = c.createLinearGradient(0, p.y - 5, 0, p.y + 14);
      tg.addColorStop(0, shade(S.top, .3)); tg.addColorStop(1, shade(S.top, -.25));
      c.beginPath(); c.roundRect(p.x - 6, p.y - 5, p.w + 12, 18, 8); c.fillStyle = tg; c.fill();
      c.lineWidth = 2; c.strokeStyle = OUTC; c.stroke();
      if (S.kind === 'grass') {
        c.strokeStyle = shade(S.top, .35); c.lineWidth = 1.2;
        for (let x = p.x - 2; x < p.x + p.w + 2; x += 5) { c.beginPath(); c.moveTo(x, p.y - 2); c.lineTo(x + 1.5, p.y - 7 - (x % 7) * .5); c.stroke(); }
      } else if (S.kind === 'sand') {
        c.strokeStyle = 'rgba(255,240,210,.5)'; c.lineWidth = 1;
        for (let x = p.x + 10; x < p.x + p.w - 10; x += 26) { c.beginPath(); c.arc(x, p.y + 6, 8, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
      } else if (S.kind === 'snow') {
        c.fillStyle = '#ffffff';
        for (let x = p.x + 10; x < p.x + p.w; x += 46) { c.beginPath(); c.ellipse(x, p.y - 3, 14, 4, 0, Math.PI, 0); c.fill(); }
      } else if (S.kind === 'ruin') {
        c.fillStyle = 'rgba(70,110,50,.7)';
        for (let x = p.x; x < p.x + p.w; x += 30) { c.beginPath(); c.ellipse(x + 10, p.y + 12, 10, 4, 0, 0, Math.PI); c.fill(); }
      }
    } else {
      const stone = S.kind === 'snow' || S.kind === 'ruin';
      const g = c.createLinearGradient(0, p.y - 3, 0, p.y + 10);
      g.addColorStop(0, shade(S.plank, .25)); g.addColorStop(1, shade(S.plank, -.35));
      c.beginPath(); c.roundRect(p.x, p.y - 3, p.w, 13, stone ? 3 : 5); c.fillStyle = g; c.fill();
      c.lineWidth = 2; c.strokeStyle = OUTC; c.stroke();
      if (stone) {
        c.strokeStyle = 'rgba(30,25,35,.4)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(p.x + p.w * .3, p.y - 2); c.lineTo(p.x + p.w * .34, p.y + 4); c.lineTo(p.x + p.w * .3, p.y + 9); c.stroke();
        for (let x = p.x + 40; x < p.x + p.w; x += 40) { c.beginPath(); c.moveTo(x, p.y - 2); c.lineTo(x, p.y + 9); c.stroke(); }
      } else {
        c.strokeStyle = 'rgba(60,35,15,.35)'; c.lineWidth = 1;
        [2, 6].forEach(dy => { c.beginPath(); for (let x = p.x + 4; x < p.x + p.w - 4; x += 10) c.lineTo(x, p.y + dy + Math.sin(x * .3) * .8); c.stroke(); });
        c.fillStyle = '#3a2c22'; [p.x + 6, p.x + p.w - 6].forEach(x => { c.beginPath(); c.arc(x, p.y + 3, 1.5, 0, TAU); c.fill(); });
      }
      if (p.move) {
        c.save(); c.globalCompositeOperation = 'lighter';
        const gg = c.createRadialGradient(p.x + p.w / 2, p.y + 12, 2, p.x + p.w / 2, p.y + 12, 40);
        gg.addColorStop(0, 'rgba(150,220,255,.5)'); gg.addColorStop(1, 'rgba(150,220,255,0)');
        c.fillStyle = gg; c.fillRect(p.x + p.w / 2 - 40, p.y, 80, 40);
        c.restore();
      }
    }
  });
}
