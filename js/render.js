// render.js — screens, camera, HUD and effects (particles, shake).
// Effects only exist on screen; they are not sent over the network.

const FX = { parts: [], shake: 0, lag: [1, 1, 1, 1], flash: 0, t: 0 };
const CAM = { x: 480, y: 270, z: 1, init: false };
const TEAM_COL = ['#4cc9f0', '#ff5d73'];
const TEAM_NAME = ['BLUE TEAM', 'RED TEAM'];
const SLOT_KEYS = [['F', 'Q', 'E', 'R'], ['K', 'U', 'I', 'O'], ['X', 'Y', 'B', 'RB'], ['X', 'Y', 'B', 'RB']];
const rnd = (a, b) => a + Math.random() * (b - a);

function txt(c, s, x, y, size, color, align, stroke, body) {
  c.font = body ? `500 ${size}px Rubik, system-ui, sans-serif` : `${size}px Bungee, Impact, 'Arial Black', sans-serif`;
  c.textAlign = align || 'center'; c.textBaseline = 'alphabetic';
  if (stroke) { c.lineJoin = 'round'; c.lineWidth = stroke; c.strokeStyle = '#140e1e'; c.strokeText(s, x, y); }
  c.fillStyle = color; c.fillText(s, x, y);
}
function dim(c, a) { c.fillStyle = `rgba(12,10,30,${a})`; c.fillRect(-60, -60, W + 120, H + 120); }
function pcol(s, i) { return TEAM_COL[s.players[i].team]; }
function slotLabel(s, i, o) {
  const P = s.players[i];
  if (P.cpu) return s.requireHumans ? 'WAITING…' : 'CPU';
  if (o.my === i) return 'YOU';
  return 'P' + (i + 1);
}
function keyFor(s, i, k, o) {
  if (o.mode !== 'local') return ['F', 'Q', 'E', 'R'][k];
  return SLOT_KEYS[i][k];
}

// ---------- effects ----------
function spawnFx(events) {
  if (!events) return;
  const P = FX.parts;
  for (const e of events) {
    switch (e.t) {
      case 'hit': {
        const n = e.big ? 22 : 12, colr = e.magic ? '#d9b8ff' : (e.big ? '#ffd36b' : '#fff3c4');
        for (let i = 0; i < n; i++) P.push({ k: 'spark', x: e.x, y: e.y, vx: rnd(-420, 420), vy: rnd(-420, 260), g: 700, life: rnd(.18, .38), max: .38, col: colr });
        P.push({ k: 'ring', x: e.x, y: e.y, life: .25, max: .25, r0: 6, r1: e.big ? 64 : 40, col: '#ffffff' });
        P.push({ k: 'glow', x: e.x, y: e.y, life: .15, max: .15, r: e.big ? 60 : 36, col: colr });
        FX.shake = Math.max(FX.shake, e.big ? 9 : 4);
        break;
      }
      case 'block':
        P.push({ k: 'ring', x: e.x, y: e.y, life: .2, max: .2, r0: 10, r1: 34, col: '#7fd8ff' });
        for (let i = 0; i < 6; i++) P.push({ k: 'spark', x: e.x, y: e.y, vx: rnd(-200, 200), vy: rnd(-200, 100), g: 400, life: .2, max: .2, col: '#bfefff' });
        FX.shake = Math.max(FX.shake, 2);
        break;
      case 'armor':
        P.push({ k: 'ring', x: e.x, y: e.y, life: .25, max: .25, r0: 8, r1: 30, col: '#ffb347' });
        for (let i = 0; i < 5; i++) P.push({ k: 'spark', x: e.x, y: e.y, vx: rnd(-160, 160), vy: rnd(-160, 60), g: 300, life: .2, max: .2, col: '#ffcf7a' });
        break;
      case 'snare':
        for (let i = 0; i < 14; i++) P.push({ k: 'dust', x: e.x + rnd(-14, 14), y: e.y + rnd(-20, 20), vx: rnd(-30, 30), vy: rnd(-60, -10), g: 0, life: rnd(.4, .8), max: .8, r: rnd(4, 8), col: '#5b3f8f' });
        P.push({ k: 'ring', x: e.x, y: e.y, life: .35, max: .35, r0: 6, r1: 46, col: '#9a7bd6' });
        break;
      case 'jump':
        if (e.air) P.push({ k: 'ring', x: e.x, y: e.y, life: .22, max: .22, r0: 4, r1: 24, col: '#ffffff', flat: true });
        else for (let i = 0; i < 4; i++) P.push(dust(e.x, e.y));
        break;
      case 'land': for (let i = 0; i < 6; i++) P.push(dust(e.x, e.y)); break;
      case 'dash': P.push({ k: 'dust', x: e.x + rnd(-6, 6), y: e.y + rnd(-14, 14), vx: 0, vy: 0, g: 0, life: .3, max: .3, r: rnd(5, 9), col: '#ffffff' }); break;
      case 'puff':
        for (let i = 0; i < (e.small ? 1 : 6); i++) P.push(dust(e.x, e.y, '#c9b8a0'));
        if (e.small) P.push(rock(e.x, e.y));
        break;
      case 'rock':
        for (let i = 0; i < 12; i++) P.push(rock(e.x, e.y));
        for (let i = 0; i < 8; i++) P.push(dust(e.x, e.y, '#bfae98'));
        FX.shake = Math.max(FX.shake, 6);
        break;
      case 'quake':
        for (let i = 0; i < (e.small ? 12 : 22); i++) P.push(dust(e.x + rnd(-40, 40), e.y, '#c9b8a0'));
        for (let i = 0; i < (e.small ? 6 : 10); i++) P.push(rock(e.x, e.y));
        FX.shake = Math.max(FX.shake, e.small ? 8 : 12);
        break;
      case 'tele':
        for (let i = 0; i < (e.small ? 3 : 16); i++) P.push({ k: 'dust', x: e.x + rnd(-20, 20), y: e.y + rnd(-40, 40), vx: rnd(-40, 40), vy: rnd(-90, -20), g: 0, life: rnd(.3, .6), max: .6, r: rnd(4, 9), col: '#4b3a7a' });
        break;
      case 'heal':
        for (let i = 0; i < 24; i++) P.push({ k: 'star', x: e.x + rnd(-24, 24), y: e.y + rnd(-30, 40), vx: rnd(-20, 20), vy: rnd(-120, -40), g: 0, life: rnd(.5, 1), max: 1, r: rnd(2, 4), col: i % 2 ? '#b9ffcf' : '#fff2a8' });
        P.push({ k: 'glow', x: e.x, y: e.y, life: .5, max: .5, r: 70, col: '#c8ffd8' });
        break;
      case 'zap':
        for (let i = 0; i < 3; i++) P.push({ k: 'spark', x: e.x + rnd(-10, 10), y: e.y + rnd(-10, 10), vx: rnd(-120, 120), vy: rnd(40, 160), g: 0, life: .2, max: .2, col: '#e6ccff' });
        break;
      case 'bolt':
        P.push({ k: 'glow', x: e.x, y: e.y - 10, life: .3, max: .3, r: 90, col: '#d9b8ff' });
        for (let i = 0; i < 16; i++) P.push({ k: 'spark', x: e.x, y: e.y - 4, vx: rnd(-300, 300), vy: rnd(-300, -40), g: 600, life: .3, max: .3, col: '#efdcff' });
        FX.shake = Math.max(FX.shake, 7);
        break;
      case 'fall':
        P.push({ k: 'ring', x: e.x, y: e.y, life: .5, max: .5, r0: 10, r1: 120, col: '#ffb627' });
        FX.shake = Math.max(FX.shake, 10);
        break;
      case 'burn':
        for (let i = 0; i < 4; i++) P.push({ k: 'spark', x: e.x + rnd(-12, 12), y: e.y + rnd(-14, 14), vx: rnd(-40, 40), vy: rnd(-160, -60), g: 0, life: .3, max: .3, col: '#ffae42' });
        break;
      case 'boom':
        P.push({ k: 'glow', x: e.x, y: e.y, life: .35, max: .35, r: 110, col: '#ffb070' });
        P.push({ k: 'ring', x: e.x, y: e.y, life: .35, max: .35, r0: 10, r1: 90, col: '#ffd0a0' });
        for (let i = 0; i < 20; i++) P.push({ k: 'spark', x: e.x, y: e.y, vx: rnd(-380, 380), vy: rnd(-380, 200), g: 500, life: rnd(.25, .45), max: .45, col: i % 2 ? '#9fe6ff' : '#ffcf8a' });
        FX.shake = Math.max(FX.shake, 10);
        break;
      case 'splash':
        P.push({ k: 'glow', x: e.x, y: e.y - 6, life: .3, max: .3, r: 60, col: '#ff7a1a' });
        for (let i = 0; i < 12; i++) P.push({ k: 'spark', x: e.x, y: e.y - 4, vx: rnd(-200, 200), vy: rnd(-300, -80), g: 800, life: .4, max: .4, col: '#ff9a3a' });
        break;
      case 'clang':
        P.push({ k: 'ring', x: e.x, y: e.y, life: .18, max: .18, r0: 4, r1: 26, col: '#ffffff' });
        for (let i = 0; i < 6; i++) P.push({ k: 'spark', x: e.x, y: e.y, vx: rnd(-220, 220), vy: rnd(-220, 120), g: 400, life: .2, max: .2, col: '#fff3c4' });
        break;
      case 'jet':
        P.push({ k: 'dust', x: e.x + rnd(-4, 4), y: e.y, vx: rnd(-20, 20), vy: rnd(120, 200), g: 0, life: .25, max: .25, r: rnd(4, 7), col: '#ffb347' });
        break;
      case 'flare':
        P.push({ k: 'glow', x: e.x, y: e.y, life: .5, max: .5, r: 130, col: '#ff6a00' });
        P.push({ k: 'ring', x: e.x, y: e.y, life: .4, max: .4, r0: 20, r1: 110, col: '#ffb347' });
        FX.shake = Math.max(FX.shake, 5);
        break;
      case 'frost':
        P.push({ k: 'ring', x: e.x, y: e.y, life: .45, max: .45, r0: 20, r1: 170, col: '#cfefff' });
        P.push({ k: 'glow', x: e.x, y: e.y, life: .3, max: .3, r: 120, col: '#bfe9ff' });
        for (let i = 0; i < 30; i++) { const a = rnd(0, TAU), v = rnd(150, 380); P.push({ k: 'star', x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, life: rnd(.3, .6), max: .6, r: rnd(1.5, 3), col: '#e8f8ff' }); }
        FX.shake = Math.max(FX.shake, 6);
        break;
      case 'smoke':
        for (let i = 0; i < 26; i++) P.push({ k: 'dust', x: e.x + rnd(-50, 50), y: e.y + rnd(-50, 40), vx: rnd(-40, 40), vy: rnd(-30, 10), g: 0, life: rnd(.6, 1.1), max: 1.1, r: rnd(8, 16), col: '#5a5a6a' });
        break;
      case 'down': P.push({ k: 'ring', x: e.x, y: e.y - 30, life: .4, max: .4, r0: 10, r1: 80, col: '#ff5d4d' }); FX.shake = Math.max(FX.shake, 8); break;
      case 'ko': FX.flash = 1; FX.shake = Math.max(FX.shake, 14); break;
    }
  }
}
function dust(x, y, color) {
  return { k: 'dust', x: x + rnd(-12, 12), y: y - 2, vx: rnd(-90, 90), vy: rnd(-50, -10), g: 60, life: rnd(.3, .55), max: .55, r: rnd(3, 6), col: color || '#f1eeff' };
}
function rock(x, y) {
  return { k: 'rock', x: x + rnd(-14, 14), y: y - 4, vx: rnd(-200, 200), vy: rnd(-420, -160), g: 900, life: .8, max: .8, r: rnd(3, 6), col: '#7d6a5a', rot: rnd(0, 6) };
}
function drawParts(c, dt) {
  FX.parts.forEach(q => { q.x += (q.vx || 0) * dt; q.y += (q.vy || 0) * dt; q.vy = (q.vy || 0) + (q.g || 0) * dt; q.life -= dt; });
  FX.parts = FX.parts.filter(q => q.life > 0);
  FX.parts.forEach(q => {
    const a = Math.max(0, q.life / q.max);
    c.save();
    if (q.k === 'dust') {
      c.globalAlpha = a * .75; c.fillStyle = q.col;
      c.beginPath(); c.arc(q.x, q.y, q.r * (1.8 - a * .8), 0, TAU); c.fill();
    } else if (q.k === 'spark') {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = a; c.strokeStyle = q.col; c.lineWidth = 2.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - q.vx * .03, q.y - q.vy * .03); c.stroke();
    } else if (q.k === 'ring') {
      const r = q.r1 + (q.r0 - q.r1) * a;
      c.globalAlpha = a; c.strokeStyle = q.col; c.lineWidth = 4 * a + 1;
      c.beginPath();
      if (q.flat) c.ellipse(q.x, q.y, r, r * .3, 0, 0, TAU); else c.arc(q.x, q.y, r, 0, TAU);
      c.stroke();
    } else if (q.k === 'glow') {
      glow(c, q.x, q.y, q.r, q.col, a);
    } else if (q.k === 'star') {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = a; c.fillStyle = q.col;
      c.beginPath(); c.moveTo(q.x, q.y - q.r * 2); c.lineTo(q.x + q.r * .5, q.y); c.lineTo(q.x, q.y + q.r * 2); c.lineTo(q.x - q.r * .5, q.y); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(q.x - q.r * 2, q.y); c.lineTo(q.x, q.y + q.r * .5); c.lineTo(q.x + q.r * 2, q.y); c.lineTo(q.x, q.y - q.r * .5); c.closePath(); c.fill();
    } else if (q.k === 'rock') {
      c.globalAlpha = Math.min(1, a * 2); c.translate(q.x, q.y); c.rotate(q.rot + q.life * 8);
      const g = c.createLinearGradient(-q.r, -q.r, q.r, q.r); g.addColorStop(0, '#a28f7c'); g.addColorStop(1, '#5a4a3c');
      c.fillStyle = g; c.strokeStyle = OUTC; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(-q.r, -q.r * .6); c.lineTo(q.r * .4, -q.r); c.lineTo(q.r, q.r * .3); c.lineTo(-q.r * .2, q.r); c.closePath(); c.fill(); c.stroke();
    }
    c.restore();
  });
}

// ---------- projectiles ----------
function drawProj(c, p, t, s) {
  const fake = { flash: false }, d = Math.sign(p.vx || 1);
  c.save();
  switch (p.type) {
    case 'wisp':
      glow(c, p.x, p.y, 24, '#6fd3ff', .85);
      c.translate(p.x, p.y);
      fillP(c, () => { c.moveTo(0, -12); c.quadraticCurveTo(8, 0, 0, 6); c.quadraticCurveTo(-8, 0, 0, -12); }, '#9fe6ff');
      fillP(c, () => { c.moveTo(0, -6); c.quadraticCurveTo(4, 1, 0, 4); c.quadraticCurveTo(-4, 1, 0, -6); }, '#ffffff');
      break;
    case 'decoy': {
      const blink = p.life < 24 && Math.floor(p.age / 3) % 2;
      c.globalAlpha = blink ? .75 : .45;
      drawFighter(c, { c: p.c, x: p.x, y: p.y, vx: 0, vy: 0, face: p.face, state: 'idle', st: p.age, onGround: true, flash: blink ? 1 : 0, inv: 0, landT: 0, sk: -1 }, t);
      c.globalAlpha = 1;
      if (p.life < 24) glow(c, p.x, p.y - 40, 30 + (24 - p.life) * 2.5, '#ffb070', .5);
      break;
    }
    case 'fist':
      c.translate(p.x, p.y); c.scale(d, 1);
      glow(c, -22, 0, 22, '#ffb347', .7);
      fillP(c, () => { c.moveTo(-12, -6); c.quadraticCurveTo(-38 - Math.sin(t) * 4, 0, -12, 6); c.closePath(); }, '#ffe2a0');
      part(c, () => c.roundRect(-10, -9, 22, 18, 7), lg(c, fake, -10, -9, 12, 9, '#9aa5b1'), 1.8);
      part(c, () => c.roundRect(-15, -8, 7, 16, 2), lg(c, fake, -15, -8, -8, 8, '#c9a24a'), 1.4);
      c.strokeStyle = 'rgba(40,50,60,.6)'; c.lineWidth = 1; [-4, 1, 6].forEach(x => { c.beginPath(); c.moveTo(x, -8); c.lineTo(x, -3); c.stroke(); });
      break;
    case 'raven': {
      c.translate(p.x, p.y); c.scale(d, 1);
      const fl = Math.sin(p.age * .6);
      part(c, () => { c.moveTo(-10, 0); c.lineTo(-20, -4); c.lineTo(-20, 4); c.closePath(); }, '#1c1a26', 1.2);
      part(c, () => c.ellipse(0, 0, 11, 6, 0, 0, TAU), lg(c, fake, -11, -6, 11, 6, '#24212e', .35), 1.4);
      part(c, () => c.arc(9, -3, 5, 0, TAU), '#24212e', 1.4);
      fillP(c, () => { c.moveTo(13, -4); c.lineTo(20, -2); c.lineTo(13, -1); c.closePath(); }, '#8a8590');
      fillP(c, () => c.arc(10.5, -4, 1.2, 0, TAU), '#9bff7a');
      part(c, () => { c.moveTo(-4, -2); c.quadraticCurveTo(-6, -18 * fl, -18, -14 * fl); c.lineTo(4, -3); c.closePath(); }, lg(c, fake, -18, -16, 4, 0, '#2a2636', .35), 1.4);
      glow(c, 0, 0, 22, '#9bff7a', .25);
      break;
    }
    case 'rune': {
      c.translate(p.x, p.y);
      const a = Math.min(1, p.life / 30, p.age / 10), r = p.w / 2;
      c.globalAlpha = a;
      glow(c, 0, -6, r * 1.1, '#7dff6a', .35);
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = '#9bff7a'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(0, -2, r, 12, 0, 0, TAU); c.stroke();
      c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, -2, r - 12, 8, 0, 0, TAU); c.stroke();
      for (let i = 0; i < 10; i++) {
        const ang = i / 10 * TAU + t * .02, x = Math.cos(ang) * (r - 6), y = -2 + Math.sin(ang) * 10;
        c.beginPath(); c.moveTo(x - 2, y - 2); c.lineTo(x + 2, y + 2); c.moveTo(x + 2, y - 2); c.lineTo(x - 2, y + 2); c.stroke();
      }
      c.strokeStyle = 'rgba(160,255,140,.35)'; c.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const x = -r + 14 + i * (r * 2 - 28) / 5, ph = (t * .03 + i * .37) % 1; c.beginPath(); c.moveTo(x, -4 - ph * 40); c.lineTo(x, -12 - ph * 40); c.stroke(); }
      c.restore();
      break;
    }
    case 'shuriken':
      c.translate(p.x, p.y); c.rotate(p.age * .6);
      part(c, () => { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; c.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); c.lineTo(Math.cos(a + .785) * 3, Math.sin(a + .785) * 3); } c.closePath(); }, lg(c, fake, -9, -9, 9, 9, '#c8d0d8', .4), 1.3);
      fillP(c, () => c.arc(0, 0, 1.6, 0, TAU), '#1b1b22');
      break;
    case 'smoke': {
      const a = Math.min(1, p.life / 30) * .85;
      for (let i = 0; i < 9; i++) {
        const x = p.x + Math.sin(i * 2.1) * 55, y = p.y - 20 - (i % 3) * 30 - Math.cos(i * 1.7) * 8 - p.age * .1, r = 26 + (i % 4) * 6 + p.age * .08;
        const g = c.createRadialGradient(x, y, 2, x, y, r);
        g.addColorStop(0, `rgba(95,95,110,${a})`); g.addColorStop(1, 'rgba(70,70,85,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      }
      break;
    }
    case 'harpoon': {
      const o = s && s.fighters[p.owner];
      if (o) {
        c.strokeStyle = '#c8b48a'; c.lineWidth = 1.6;
        const hx = o.x + o.face * 20, hy = o.y - 62;
        c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo((hx + p.x) / 2, (hy + p.y) / 2 + 10, p.x, p.y); c.stroke();
      }
      c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx));
      seg(c, fake, -30, 0, 0, 0, 3, '#6a4a30');
      part(c, () => { c.moveTo(16, 0); c.lineTo(0, -6); c.lineTo(3, 0); c.lineTo(0, 6); c.closePath(); }, lg(c, fake, 0, -6, 16, 6, '#b8c0c8'), 1.4);
      break;
    }
    case 'pool': {
      c.translate(p.x, p.y);
      c.globalAlpha = Math.min(1, p.life / 30);
      glow(c, 0, -4, 64, '#ff6a00', .5);
      const g = c.createRadialGradient(0, 0, 4, 0, 0, 46);
      g.addColorStop(0, '#fff1a0'); g.addColorStop(.4, '#ff8a1a'); g.addColorStop(1, '#7a2000');
      c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 45, 7, 0, 0, TAU); c.fill();
      for (let i = 0; i < 3; i++) {
        const ph = (p.age * .03 + i * .33) % 1;
        c.fillStyle = `rgba(255,220,140,${1 - ph})`; c.beginPath(); c.arc(-24 + i * 24, -2 - ph * 8, 2 + ph * 3, 0, TAU); c.fill();
      }
      break;
    }
    case 'pillar': {
      c.translate(p.x, p.y);
      const k = Math.min(1, p.life / 12), w = p.w * (.6 + .4 * k);
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createLinearGradient(0, -p.h, 0, 0);
      g.addColorStop(0, 'rgba(255,90,0,0)'); g.addColorStop(.3, `rgba(255,140,30,${.8 * k})`); g.addColorStop(1, `rgba(255,240,160,${k})`);
      c.fillStyle = g;
      c.beginPath(); c.moveTo(-w / 2, 0);
      for (let i = 0; i <= 6; i++) c.lineTo(-w / 2 + i * w / 6, -p.h + (i % 2 ? 20 : 0) + Math.sin(t * .5 + i) * 8);
      c.lineTo(w / 2, 0); c.closePath(); c.fill();
      c.restore();
      glow(c, 0, -20, 70, '#ff7a1a', .6 * k);
      break;
    }
    case 'magma':
      glow(c, p.x, p.y, 32, '#ff7a1a', .85);
      part(c, () => c.arc(p.x, p.y, 12, 0, TAU), (() => { const g = c.createRadialGradient(p.x - 4, p.y - 4, 1, p.x, p.y, 12); g.addColorStop(0, '#fff1a0'); g.addColorStop(.5, '#ff8a1a'); g.addColorStop(1, '#7a2a00'); return g; })(), 1.6);
      fillP(c, () => c.arc(p.x + 4, p.y + 3, 3, 0, TAU), 'rgba(60,30,20,.7)');
      break;
    case 'snare':
      if (p.ground) {
        c.translate(p.x, p.y);
        glow(c, 0, -6, 34, '#7a52c8', .5);
        for (let i = 0; i < 5; i++) {
          const x = -18 + i * 9, h = 14 + Math.sin(t * .3 + i) * 6 + (i % 2) * 6;
          c.strokeStyle = i % 2 ? '#2a1d44' : '#3d2b63'; c.lineWidth = 4; c.lineCap = 'round';
          c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + 6 * Math.sin(t * .2 + i), -h * .6, x + 3, -h); c.stroke();
        }
      } else {
        glow(c, p.x, p.y, 26, '#7a52c8', .7);
        fillP(c, () => c.arc(p.x, p.y, 9, 0, TAU), '#24173c');
      }
      break;
    case 'prism':
      c.translate(p.x, p.y); c.scale(d, 1);
      glow(c, 0, 0, 34, '#9ff3ff', .8);
      c.save(); c.globalCompositeOperation = 'lighter';
      { const g = c.createLinearGradient(-40, 0, 22, 0); g.addColorStop(0, 'rgba(160,240,255,0)'); g.addColorStop(1, 'rgba(220,255,255,1)');
        c.fillStyle = g; c.beginPath(); c.ellipse(-8, 0, 30, 5, 0, 0, TAU); c.fill(); }
      c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(10, 0, 10, 3.5, 0, 0, TAU); c.fill();
      c.restore();
      break;
  }
  c.restore();
}

// ---------- fighter preview (menus) ----------
function drawCharPreview(c, ci, x, y, scale, t, mode, face) {
  const C = CHARS[ci];
  let state = 'idle', st = t, move = null;
  if (mode === 'attackLoop') {
    const seq = ['jab1', 'jab2', 'fin'];
    const lens = seq.map(n => { const mv = C.moves[n]; return mv.f[0] + mv.f[1] + mv.f[2]; });
    const total = lens.reduce((a, b) => a + b, 0) + 40;
    let u = t % total;
    for (let k = 0; k < 3; k++) { if (u < lens[k]) { state = 'attack'; move = seq[k]; st = u; break; } u -= lens[k]; }
    if (!move) st = t;
  }
  const f = { c: ci, x: 0, y: 0, vx: 0, vy: 0, face: face || 1, state, st, move, onGround: true, flash: 0, inv: 0, landT: 0, hp: C.hp, glide: false, quaked: false, sk: -1 };
  c.save(); c.translate(x, y); c.scale(scale, scale);
  drawFighter(c, f, t);
  c.restore();
}
function pedestal(c, x, y, w, color) {
  const g = c.createRadialGradient(x, y, 2, x, y, w);
  g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(x, y + 4, w, w * .22, 0, 0, TAU); c.fill();
  c.strokeStyle = color; c.lineWidth = 2.5; c.beginPath(); c.ellipse(x, y, w, w * .22, 0, 0, TAU); c.stroke();
}
function keyBadge(c, x, y, key, color) {
  c.font = `10px Bungee, Impact, sans-serif`;
  const w = Math.max(16, c.measureText(key).width + 8);
  c.fillStyle = '#140e1e'; c.beginPath(); c.roundRect(x, y - 11, w, 15, 4); c.fill();
  c.strokeStyle = color; c.lineWidth = 1.2; c.stroke();
  txt(c, key, x + w / 2, y + 1, 10, color, 'center');
  return w;
}
function statRows(c, C, x, y, color, step) {
  const rows = [['LIFE', Math.max(1, Math.min(5, Math.round((C.hp - 60) / 16)))], ['POWER', C.stats.power], ['SPEED', C.stats.speed], ['JUMP', C.stats.jump], ['MAGIC', C.stats.magic]];
  rows.forEach(([lab, v], r) => {
    const ry = y + r * step;
    txt(c, lab, x - 30, ry, 9, '#b9b5e6', 'right');
    for (let k = 0; k < 5; k++) {
      c.fillStyle = k < v ? color : 'rgba(255,255,255,.15)';
      c.beginPath(); c.roundRect(x - 22 + k * 17, ry - 8, 13, 8, 3); c.fill();
    }
  });
}

// ---------- screens ----------
function drawSelect(c, s, o) {
  const t = s.tick;
  MAPS[s.map].bg(c, t); dim(c, .66);
  txt(c, 'CHOOSE YOUR FIGHTER', W / 2, 44, 30, '#fff', 'center', 7);
  txt(c, o.hint, W / 2, 68, 12, '#c9c5f0', 'center', 0, true);
  if (s.code) txt(c, 'CODE: ' + s.code, W - 16, 26, 16, '#ffb627', 'right', 4);

  const cw = 88, ch = 88, gap = 8, gx = W / 2 - (COLS * cw + (COLS - 1) * gap) / 2, gy = 88;
  CHARS.forEach((C, i) => {
    const x = gx + (i % COLS) * (cw + gap), y = gy + Math.floor(i / COLS) * (ch + gap);
    c.save();
    c.beginPath(); c.roundRect(x, y, cw, ch, 12);
    const g = c.createLinearGradient(0, y, 0, y + ch); g.addColorStop(0, '#34315e'); g.addColorStop(1, '#1d1b3a');
    c.fillStyle = g; c.fill(); c.clip();
    drawCharPreview(c, i, x + cw / 2, y + ch - 10, .52, t, 'idle', 1);
    c.restore();
    c.strokeStyle = '#4a4680'; c.lineWidth = 2; c.beginPath(); c.roundRect(x, y, cw, ch, 12); c.stroke();
    txt(c, C.name, x + 7, y + 15, 9, '#fff', 'left', 3);
    let n = 0;
    s.players.forEach((P, pi) => {
      if (P.char !== i) return;
      const ins = n * 4, colr = pcol(s, pi);
      c.strokeStyle = colr; c.lineWidth = 3.5;
      c.beginPath(); c.roundRect(x - 3 + ins, y - 3 + ins, cw + 6 - ins * 2, ch + 6 - ins * 2, 14); c.stroke();
      const lab = slotLabel(s, pi, o);
      c.font = '10px Bungee, Impact, sans-serif';
      const tw = c.measureText(lab).width + 10, tx = x + 4 + n * 28;
      c.fillStyle = colr; c.beginPath(); c.roundRect(tx, y + ch - 20, tw, 16, 5); c.fill();
      txt(c, lab, tx + tw / 2, y + ch - 8, 10, '#140e1e', 'center');
      n++;
    });
  });

  if (s.players.length === 2) {
    // how to fight
    const ly = gy + 2 * (ch + gap) + 22;
    txt(c, 'HOW TO FIGHT', W / 2, ly, 14, '#ffb627', 'center', 4);
    ['Attack 3 times for a combo: small, small, big.', 'You can wait a moment between hits.', 'After the big hit there is a short pause.', '3 extra attacks, each with its own cooldown.', 'Hold down to block. Falling off costs 15 HP.']
      .forEach((l, k) => txt(c, l, W / 2, ly + 20 + k * 17, 12, '#d8d4ff', 'center', 0, true));
    [0, 1].forEach(pi => {
      const P = s.players[pi], C = CHARS[P.char], cx = pi === 0 ? 150 : W - 150, colr = pcol(s, pi);
      txt(c, pi === o.my ? 'YOU' : (P.cpu ? slotLabel(s, pi, o) : 'PLAYER ' + (pi + 1)), cx, 100, 15, colr, 'center', 4);
      pedestal(c, cx, 290, 64, colr);
      drawCharPreview(c, P.char, cx, 290, 1.2, t, P.ready ? 'attackLoop' : 'idle', pi === 0 ? 1 : -1);
      txt(c, C.name, cx, 326, C.name.length > 8 ? 21 : 26, colr, 'center', 5);
      txt(c, C.title, cx, 343, 12, '#e2dfff', 'center', 0, true);
      statRows(c, C, cx, 364, colr, 13);
      C.skills.forEach((sk, k) => {
        const y = 442 + k * 30;
        const bw = keyBadge(c, cx - 128, y, keyFor(s, pi, k + 1, o), '#ffb627');
        txt(c, sk.name.toUpperCase(), cx - 128 + bw + 6, y + 1, 11, '#ffb627', 'left', 3);
        txt(c, sk.desc, cx - 128 + bw + 6, y + 15, 10.5, '#d8d4ff', 'left', 0, true);
      });
      if (P.ready) { c.save(); c.translate(cx, 214); c.rotate(-.12); txt(c, 'READY!', 0, 0, 34, colr, 'center', 7); c.restore(); }
    });
  } else {
    [0, 1].forEach(tm => {
      const cx = tm === 0 ? 150 : W - 150;
      txt(c, TEAM_NAME[tm], cx, 170, 26, TEAM_COL[tm], 'center', 6);
      const names = s.players.map((P, i) => P.team === tm ? slotLabel(s, i, o) : null).filter(Boolean).join(' + ');
      txt(c, names, cx, 196, 14, '#e2dfff', 'center', 0, true);
    });
    txt(c, o.teamHint, W / 2, gy + 2 * (ch + gap) + 6, 11, '#c9c5f0', 'center', 0, true);
    const order = [0, 1, 2, 3].sort((a, b) => s.players[a].team - s.players[b].team || a - b);
    order.forEach((pi, k) => {
      const P = s.players[pi], C = CHARS[P.char], colr = pcol(s, pi);
      const x = [10, 240, 500, 730][k], y = 322, w = 220, h = 212;
      c.fillStyle = 'rgba(20,16,40,.75)'; c.beginPath(); c.roundRect(x, y, w, h, 12); c.fill();
      c.strokeStyle = colr; c.lineWidth = 2; c.stroke();
      txt(c, slotLabel(s, pi, o), x + 10, y + 20, 13, colr, 'left', 3);
      if (P.ready) txt(c, P.cpu ? '' : 'READY', x + w - 10, y + 20, 12, '#7cf06a', 'right', 3);
      pedestal(c, x + w / 2, y + 140, 44, colr);
      drawCharPreview(c, P.char, x + w / 2, y + 140, .82, t, P.ready && !P.cpu ? 'attackLoop' : 'idle', k < 2 ? 1 : -1);
      txt(c, C.name, x + w / 2, y + 164, 16, '#fff', 'center', 4);
      C.skills.forEach((sk, j) => txt(c, (P.cpu ? '' : keyFor(s, pi, j + 1, o) + '  ') + sk.name, x + w / 2, y + 180 + j * 11, 9.5, '#d8d4ff', 'center', 0, true));
    });
  }
}

function drawMapSelect(c, s, o) {
  const t = s.tick;
  MAPS[s.map].bg(c, t); dim(c, .6);
  txt(c, 'CHOOSE A STAGE', W / 2, 60, 32, '#fff', 'center', 7);
  txt(c, o.mapHint, W / 2, 86, 12, '#c9c5f0', 'center', 0, true);
  const cw = 210, ch = 118, gap = 16, x0 = (W - (cw * MAPS.length + gap * (MAPS.length - 1))) / 2, y = 140;
  MAPS.forEach((m, i) => {
    const x = x0 + i * (cw + gap), sel = i === s.map;
    c.save();
    c.beginPath(); c.roundRect(x, y, cw, ch, 10); c.clip();
    c.translate(x, y);
    c.save(); c.scale(cw / W, ch / H); m.bg(c, t); c.restore();
    c.scale(cw / m.world.w, ch / m.world.h); drawPlatforms(c, m, t);
    c.restore();
    c.strokeStyle = sel ? '#ffb627' : '#4a4680'; c.lineWidth = sel ? 5 : 2;
    c.beginPath(); c.roundRect(x, y, cw, ch, 10); c.stroke();
    if (m.large) {
      c.fillStyle = '#ffb627'; c.beginPath(); c.roundRect(x + cw - 92, y + 6, 86, 16, 5); c.fill();
      txt(c, 'BEST FOR 2V2', x + cw - 49, y + 18, 9, '#140e1e', 'center');
    }
    txt(c, m.name, x + cw / 2, y + ch + 26, 14, sel ? '#ffb627' : '#fff', 'center', 4);
    txt(c, m.terrain + (m.large ? ' · large' : ''), x + cw / 2, y + ch + 44, 12, '#c9c5f0', 'center', 0, true);
  });
  [0, 1].forEach(tm => {
    const names = s.players.map((P, i) => P.team === tm ? CHARS[P.char].name : null).filter(Boolean).join(' + ');
    txt(c, names, tm === 0 ? W / 2 - 46 : W / 2 + 46, 420, names.length > 12 ? 18 : 24, TEAM_COL[tm], tm === 0 ? 'right' : 'left', 6);
  });
  txt(c, 'VS', W / 2, 422, 28, '#fff', 'center', 6);
}

function updateCam(s, snap) {
  const m = MAPS[s.map], wd = m.world;
  const zMin = Math.max(W / wd.w, H / wd.h), zMax = m.large ? 1.0 : 1.18;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0;
  s.fighters.forEach(f => {
    if (f.gone || (f.state === 'ko' && s.fighters.length > 2)) return;
    const C = CHARS[f.c], fy = Math.max(0, f.y);
    x0 = Math.min(x0, f.x); x1 = Math.max(x1, f.x); y0 = Math.min(y0, fy - C.h); y1 = Math.max(y1, fy); n++;
  });
  let tx = wd.w / 2, ty = wd.h / 2, tz = zMin;
  if (n) {
    const bw = x1 - x0 + 380, bh = y1 - y0 + 300;
    tz = Math.max(zMin, Math.min(zMax, W / bw, H / bh));
    tx = (x0 + x1) / 2; ty = (y0 + y1) / 2 - 20;
  }
  if (snap || !CAM.init) { CAM.x = tx; CAM.y = ty; CAM.z = tz; CAM.init = true; }
  else { CAM.z += (tz - CAM.z) * .05; CAM.x += (tx - CAM.x) * .1; CAM.y += (ty - CAM.y) * .1; }
  const hw = W / (2 * CAM.z), hh = H / (2 * CAM.z);
  CAM.x = Math.max(hw, Math.min(wd.w - hw, CAM.x));
  CAM.y = Math.max(hh, Math.min(wd.h - hh, CAM.y));
}

function skillIcons(c, s, f, i, x, y, size, alignRight, o) {
  const C = CHARS[f.c];
  for (let k = 0; k < 3; k++) {
    const bx = alignRight ? x - (3 - k) * (size + 4) : x + k * (size + 4);
    const ready = f.cds[k] <= 0, r = f.cds[k] / C.skills[k].cd;
    c.fillStyle = ready ? '#2c2758' : '#18152e'; c.beginPath(); c.roundRect(bx, y, size, size, 4); c.fill();
    if (!ready) {
      c.save(); c.beginPath(); c.roundRect(bx, y, size, size, 4); c.clip();
      c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.moveTo(bx + size / 2, y + size / 2);
      c.arc(bx + size / 2, y + size / 2, size, -Math.PI / 2, -Math.PI / 2 + TAU * r); c.closePath(); c.fill();
      c.restore();
    }
    c.strokeStyle = ready ? '#ffb627' : '#4a4680'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(bx, y, size, size, 4); c.stroke();
    txt(c, keyFor(s, i, k + 1, o), bx + size / 2, y + size * .68, size * .48, ready ? '#ffb627' : '#77739e', 'center');
  }
}

function drawHUD(c, s, o) {
  const two = s.fighters.length === 2;
  const counts = [0, 0];
  s.fighters.forEach((f, i) => {
    const C = CHARS[f.c], r = Math.max(0, f.hp / C.hp), k = counts[f.team]++, left = f.team === 0;
    if (s.phase === 'intro' || FX.lag[i] < r) FX.lag[i] = r; else FX.lag[i] += (r - FX.lag[i]) * .04;
    const bw = two ? 360 : 300, bh = two ? 22 : 13, x0 = left ? 36 : W - 36 - bw, y = two ? 22 : 16 + k * 46;
    c.fillStyle = '#140e1e'; c.beginPath(); c.roundRect(x0 - 3, y - 3, bw + 6, bh + 6, 6); c.fill();
    c.fillStyle = '#2a2440'; c.fillRect(x0, y, bw, bh);
    const bar = (v, color) => {
      const g = typeof color === 'string' ? color : null;
      c.fillStyle = g || color;
      left ? c.fillRect(x0, y, bw * v, bh) : c.fillRect(x0 + bw * (1 - v), y, bw * v, bh);
    };
    bar(FX.lag[i], '#ff4d3d');
    const hc = r > .5 ? '#6fe05e' : r > .25 ? '#ffd23f' : '#ff8a3d';
    const g = c.createLinearGradient(0, y, 0, y + bh); g.addColorStop(0, shade(hc, .35)); g.addColorStop(1, shade(hc, -.25));
    bar(r, g);
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x0, y + 2, bw, bh * .25);
    const lab = (f.state === 'ko' ? 'KO · ' : '') + C.name, sl = slotLabel(s, i, o);
    if (two) {
      txt(c, String(Math.ceil(f.hp)), left ? x0 + 8 : x0 + bw - 8, y + 17, 13, '#fff', left ? 'left' : 'right', 3);
      txt(c, lab, left ? x0 : x0 + bw, y + bh + 24, 17, TEAM_COL[f.team], left ? 'left' : 'right', 5);
      txt(c, sl, left ? x0 : x0 + bw, y + bh + 40, 11, '#e2dfff', left ? 'left' : 'right', 3);
      skillIcons(c, s, f, i, left ? x0 + bw : x0, y + bh + 8, 24, left, o);
    } else {
      txt(c, `${sl} · ${lab}`, left ? x0 : x0 + bw, y + bh + 14, 11, f.state === 'ko' ? '#8c88b0' : TEAM_COL[f.team], left ? 'left' : 'right', 3);
      txt(c, String(Math.ceil(f.hp)), left ? x0 + bw - 4 : x0 + 4, y + bh + 14, 11, '#fff', left ? 'right' : 'left', 3);
      skillIcons(c, s, f, i, left ? x0 + bw + 8 : x0 - 8, y - 2, 16, !left ? true : false, o);
    }
  });
  c.fillStyle = '#140e1e'; c.beginPath(); c.roundRect(W / 2 - 36, 10, 72, 52, 10); c.fill();
  c.fillStyle = '#1e1a36'; c.beginPath(); c.roundRect(W / 2 - 32, 14, 64, 44, 8); c.fill();
  const sec = Math.max(0, Math.ceil(s.timer / 60));
  txt(c, String(sec), W / 2, 48, 28, sec <= 10 ? '#ff5d4d' : '#fff', 'center');
  for (let tm = 0; tm < 2; tm++) for (let w = 0; w < WINS_NEEDED; w++) {
    const cx = W / 2 + (tm ? 1 : -1) * (14 + w * 20), cy = 76;
    c.fillStyle = w < s.wins[tm] ? TEAM_COL[tm] : 'rgba(0,0,0,.45)';
    c.strokeStyle = '#140e1e'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(cx, cy, 7, 0, TAU); c.fill(); c.stroke();
  }
}

function banner(c, str, local, color, size) {
  const k = Math.min(1, local / 8), sc = 1.6 - .6 * k;
  c.save(); c.translate(W / 2, H / 2 - 20); c.scale(sc, sc);
  c.globalAlpha = k;
  txt(c, str, 0, 0, size || 64, color || '#ffb627', 'center', 10);
  c.restore();
}

function drawFight(c, s, dt, o) {
  const m = MAPS[s.map];
  updateCam(s, s.phase === 'intro' && s.phaseT < 3);
  m.bg(c, s.tick, CAM.x - m.world.w / 2, CAM.y - m.world.h / 2);
  c.save();
  c.translate(W / 2, H / 2); c.scale(CAM.z, CAM.z); c.translate(-CAM.x, -CAM.y);
  drawPlatforms(c, m, s.tick);
  s.projectiles.forEach(p => drawProj(c, p, s.tick, s));
  const order = s.fighters.map((_, i) => i).sort((a, b) => {
    const r = f => s.fighters[f].state === 'ko' ? 0 : s.fighters[f].state === 'hurt' ? 1 : 2;
    return r(a) - r(b);
  });
  s.fighters.forEach(f => {
    if (!f.zip) return;
    c.strokeStyle = '#c8b48a'; c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(f.x + f.face * 16, f.y - 62); c.lineTo(f.zip.x, f.zip.y); c.stroke();
  });
  order.forEach(i => drawFighter(c, s.fighters[i], s.tick));
  s.fighters.forEach((f, i) => {
    if (f.state === 'ko' || f.gone || f.stealthT > 0) return;
    const C = CHARS[f.c], y = f.y - C.h - 20, colr = TEAM_COL[f.team];
    c.fillStyle = colr; c.strokeStyle = '#140e1e'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(f.x - 6, y + 4); c.lineTo(f.x + 6, y + 4); c.lineTo(f.x, y + 11); c.closePath(); c.fill(); c.stroke();
    txt(c, slotLabel(s, i, o), f.x, y, 10, colr, 'center', 3);
  });
  drawParts(c, dt);
  c.restore();
  // markers for fighters outside the view
  s.fighters.forEach((f, i) => {
    if (f.state === 'ko' || f.gone || f.stealthT > 0) return;
    const sx = (f.x - CAM.x) * CAM.z + W / 2, sy = (f.y - CHARS[f.c].h / 2 - CAM.y) * CAM.z + H / 2;
    if (sx > -10 && sx < W + 10 && sy > -10 && sy < H + 10) return;
    const cx = Math.max(22, Math.min(W - 22, sx)), cy = Math.max(100, Math.min(H - 22, sy));
    c.fillStyle = 'rgba(20,14,30,.85)'; c.strokeStyle = TEAM_COL[f.team]; c.lineWidth = 2.5;
    c.beginPath(); c.arc(cx, cy, 16, 0, TAU); c.fill(); c.stroke();
    txt(c, slotLabel(s, i, o), cx, cy + 4, 9, TEAM_COL[f.team], 'center');
  });
  drawHUD(c, s, o);
  if (s.phase === 'intro') {
    if (s.phaseT < 60) banner(c, `ROUND ${s.round}`, s.phaseT, '#fff');
    else banner(c, 'FIGHT!', s.phaseT - 60, '#ffb627', 80);
  } else if (s.phase === 'ko') {
    banner(c, s.koTime ? 'TIME!' : 'K.O.!', s.phaseT, '#ff5d4d', 90);
    if (s.phaseT > 50) {
      const w = s.roundWinner;
      let sub = 'DRAW';
      if (w >= 0) sub = s.fighters.length === 2 ? `${CHARS[s.fighters.find(f => f.team === w).c].name} WINS THE ROUND` : `${TEAM_NAME[w]} WINS THE ROUND`;
      txt(c, sub, W / 2, H / 2 + 40, 24, w >= 0 ? TEAM_COL[w] : '#fff', 'center', 6);
    }
  }
}

function drawResult(c, s, o) {
  const t = s.tick, w = s.winner;
  MAPS[s.map].bg(c, t); dim(c, .55);
  if (w >= 0) {
    const members = s.players.map((P, i) => ({ P, i })).filter(x => x.P.team === w);
    const title = members.length === 1 ? `${slotLabel(s, members[0].i, o)} WINS!` : `${TEAM_NAME[w]} WINS!`;
    txt(c, title, W / 2, 86, 46, TEAM_COL[w], 'center', 9);
    members.forEach((x, k) => {
      const cx = members.length === 1 ? W / 2 : W / 2 + (k ? 120 : -120);
      pedestal(c, cx, 410, 90, TEAM_COL[w]);
      drawCharPreview(c, x.P.char, cx, 410, 1.6, t, 'idle', k ? -1 : 1);
      txt(c, CHARS[x.P.char].name, cx, 458, 24, '#fff', 'center', 6);
    });
  } else {
    txt(c, 'DRAW!', W / 2, 200, 56, '#fff', 'center', 9);
  }
  txt(c, `${s.wins[0]} – ${s.wins[1]}`, W / 2, 130, 28, '#fff', 'center', 6);
  if (s.phaseT > 60) txt(c, o.again, W / 2, 506, 15, '#e2dfff', 'center', 0, true);
}

function drawIdle(c, waiting) {
  const t = FX.t * 60, m = MAPS[3];
  c.save(); m.bg(c, t);
  c.translate(W / 2, H / 2); c.scale(.6, .6); c.translate(-800, -450);
  drawPlatforms(c, m, t);
  [[0, 560, 640, 1], [4, 660, 640, 1], [2, 950, 640, -1], [5, 1060, 640, -1]].forEach(([ci, x, y, face]) => drawCharPreview(c, ci, x, y, 1, t, 'idle', face));
  c.restore();
  dim(c, waiting ? .55 : .6);
  if (waiting) txt(c, 'CONNECTING…', W / 2, H / 2, 32, '#fff', 'center', 7);
}

// called every screen frame
function renderFrame(c, s, dt, o) {
  FX.t += dt;
  c.setTransform(2, 0, 0, 2, 0, 0);
  if (FX.shake > 0) {
    c.translate(rnd(-1, 1) * FX.shake, rnd(-1, 1) * FX.shake);
    FX.shake = Math.max(0, FX.shake - dt * 40);
  }
  if (!s) { drawIdle(c, o.waiting); FX.parts.length = 0; CAM.init = false; }
  else if (s.screen === 'select') { drawSelect(c, s, o); FX.parts.length = 0; CAM.init = false; }
  else if (s.screen === 'map') { drawMapSelect(c, s, o); FX.parts.length = 0; CAM.init = false; }
  else if (s.screen === 'fight') drawFight(c, s, dt, o);
  else if (s.screen === 'result') { drawResult(c, s, o); FX.parts.length = 0; CAM.init = false; }
  if (FX.flash > 0) {
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.fillStyle = `rgba(255,255,255,${FX.flash * .6})`; c.fillRect(0, 0, W, H);
    FX.flash = Math.max(0, FX.flash - dt * 3);
  }
}
