// render.js — tegner skærmene, HUD og effekter (partikler, rystelser).
// Effekterne findes kun på skærmen og sendes ikke over nettet.

const FX = { parts: [], shake: 0, lag: [1, 1], flash: 0, t: 0 };
const P_COL = ['#4cc9f0', '#ff5d73'];
const rnd = (a, b) => a + Math.random() * (b - a);

function txt(c, s, x, y, size, col, align, stroke, body) {
  c.font = body ? `500 ${size}px Rubik, system-ui, sans-serif` : `${size}px Bungee, Impact, 'Arial Black', sans-serif`;
  c.textAlign = align || 'center'; c.textBaseline = 'alphabetic';
  if (stroke) { c.lineJoin = 'round'; c.lineWidth = stroke; c.strokeStyle = OUT; c.strokeText(s, x, y); }
  c.fillStyle = col; c.fillText(s, x, y);
}
function wrapText(c, s, x, y, maxW, lh, size, col) {
  c.font = `400 ${size}px Rubik, system-ui, sans-serif`; c.textAlign = 'center'; c.fillStyle = col;
  const words = s.split(' '); let line = '';
  words.forEach(w => {
    const test = line ? line + ' ' + w : w;
    if (c.measureText(test).width > maxW && line) { c.fillText(line, x, y); y += lh; line = w; }
    else line = test;
  });
  if (line) c.fillText(line, x, y);
}
function dim(c, a) { c.fillStyle = `rgba(12,10,30,${a})`; c.fillRect(-30, -30, W + 60, H + 60); }

// ---------- effekter ----------
function spawnFx(events) {
  if (!events) return;
  const P = FX.parts;
  for (const e of events) {
    switch (e.t) {
      case 'hit': {
        const n = e.big ? 22 : 12;
        for (let i = 0; i < n; i++) P.push({ k: 'spark', x: e.x, y: e.y, vx: rnd(-420, 420), vy: rnd(-420, 260), g: 700, life: rnd(.18, .38), max: .38, col: e.big ? '#ffd36b' : '#fff3c4' });
        P.push({ k: 'ring', x: e.x, y: e.y, life: .25, max: .25, r0: 6, r1: e.big ? 64 : 40, col: '#ffffff' });
        FX.shake = Math.max(FX.shake, e.big ? 9 : 5);
        break;
      }
      case 'block':
        P.push({ k: 'ring', x: e.x, y: e.y, life: .2, max: .2, r0: 10, r1: 34, col: '#7fd8ff' });
        for (let i = 0; i < 6; i++) P.push({ k: 'spark', x: e.x, y: e.y, vx: rnd(-200, 200), vy: rnd(-200, 100), g: 400, life: .2, max: .2, col: '#bfefff' });
        FX.shake = Math.max(FX.shake, 2);
        break;
      case 'jump':
        if (e.air) P.push({ k: 'ring', x: e.x, y: e.y, life: .22, max: .22, r0: 4, r1: 24, col: '#ffffff', flat: true });
        else for (let i = 0; i < 4; i++) P.push(dust(e.x, e.y));
        break;
      case 'land': for (let i = 0; i < 6; i++) P.push(dust(e.x, e.y)); break;
      case 'dash': P.push({ k: 'dust', x: e.x + rnd(-6, 6), y: e.y + rnd(-14, 14), vx: 0, vy: 0, g: 0, life: .3, max: .3, r: rnd(5, 9), col: '#ffffff' }); break;
      case 'puff':
        for (let i = 0; i < (e.small ? 1 : 6); i++) P.push(dust(e.x, e.y, '#c9b8a0'));
        if (e.small) P.push({ k: 'rock', x: e.x + rnd(-10, 10), y: e.y - 4, vx: rnd(-60, 60), vy: rnd(-260, -140), g: 900, life: .5, max: .5, r: rnd(3, 5), col: '#7d6a5a', rot: rnd(0, 6) });
        break;
      case 'quake':
        for (let i = 0; i < 22; i++) P.push(dust(e.x + rnd(-40, 40), e.y, '#c9b8a0'));
        for (let i = 0; i < 10; i++) P.push({ k: 'rock', x: e.x + rnd(-30, 30), y: e.y - 4, vx: rnd(-200, 200), vy: rnd(-420, -200), g: 900, life: .8, max: .8, r: rnd(3, 6), col: '#7d6a5a', rot: rnd(0, 6) });
        FX.shake = Math.max(FX.shake, 12);
        break;
      case 'tele':
        for (let i = 0; i < 16; i++) P.push({ k: 'dust', x: e.x + rnd(-20, 20), y: e.y + rnd(-40, 40), vx: rnd(-40, 40), vy: rnd(-90, -20), g: 0, life: rnd(.3, .6), max: .6, r: rnd(4, 9), col: '#6b4fa0' });
        break;
      case 'fall':
        P.push({ k: 'ring', x: e.x, y: e.y, life: .5, max: .5, r0: 10, r1: 120, col: '#ffb627' });
        FX.shake = Math.max(FX.shake, 10);
        break;
      case 'ko': FX.flash = 1; FX.shake = Math.max(FX.shake, 14); break;
    }
  }
}
function dust(x, y, col) {
  return { k: 'dust', x: x + rnd(-12, 12), y: y - 2, vx: rnd(-90, 90), vy: rnd(-50, -10), g: 60, life: rnd(.3, .55), max: .55, r: rnd(3, 6), col: col || '#f1eeff' };
}
function drawParts(c, dt) {
  FX.parts.forEach(q => { q.x += q.vx * dt || 0; q.y += q.vy * dt || 0; if (q.vy !== undefined) q.vy += (q.g || 0) * dt; q.life -= dt; });
  FX.parts = FX.parts.filter(q => q.life > 0);
  FX.parts.forEach(q => {
    const a = Math.max(0, q.life / q.max);
    c.save();
    if (q.k === 'dust') {
      c.globalAlpha = a * .8; c.fillStyle = q.col;
      c.beginPath(); c.arc(q.x, q.y, q.r * (1.8 - a * .8), 0, TAU); c.fill();
    } else if (q.k === 'spark') {
      c.globalAlpha = a; c.strokeStyle = q.col; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - q.vx * .03, q.y - q.vy * .03); c.stroke();
    } else if (q.k === 'ring') {
      const r = q.r1 + (q.r0 - q.r1) * a;
      c.globalAlpha = a; c.strokeStyle = q.col; c.lineWidth = 4 * a + 1;
      c.beginPath();
      if (q.flat) c.ellipse(q.x, q.y, r, r * .3, 0, 0, TAU); else c.arc(q.x, q.y, r, 0, TAU);
      c.stroke();
    } else if (q.k === 'rock') {
      c.globalAlpha = Math.min(1, a * 2); c.translate(q.x, q.y); c.rotate(q.rot + q.life * 8);
      c.fillStyle = q.col; c.strokeStyle = OUT; c.lineWidth = 2;
      c.beginPath(); c.rect(-q.r, -q.r, q.r * 2, q.r * 2); c.fill(); c.stroke();
    }
    c.restore();
  });
}

// ---------- projektiler ----------
function drawProj(c, p, t) {
  c.save();
  if (p.type === 'feather') {
    c.translate(p.x, p.y); c.scale(Math.sign(p.vx) || 1, 1); c.rotate(Math.sin(t * .4) * .15);
    blob(c, () => c.ellipse(0, 0, 13, 5, 0, 0, TAU), '#fff1b8', 2.5);
    c.strokeStyle = '#d9a400'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-14, 0); c.lineTo(10, 0); c.stroke();
    c.globalAlpha = .4; c.fillStyle = '#fff'; c.beginPath(); c.ellipse(-22, 0, 8, 2, 0, 0, TAU); c.fill();
  } else if (p.type === 'wave') {
    c.translate(p.x, p.y);
    const k = 1 + Math.sin(t * .6) * .12;
    [[-10, 22, '#8a7766'], [6, 30, '#9d8a78'], [18, 18, '#7d6a5a']].forEach(([dx, h, col]) => {
      blob(c, () => { c.moveTo(dx - 9, 0); c.lineTo(dx - 2, -h * k); c.lineTo(dx + 9, 0); c.closePath(); }, col, 2.5);
    });
  }
  c.restore();
}

// ---------- figur-preview (menuer) ----------
function drawCharPreview(c, ci, x, y, scale, t, mode, face) {
  const C = CHARS[ci];
  let state = 'idle', st = t;
  if (mode === 'attackLoop') {
    const L = C.attack.startup + C.attack.active + C.attack.recovery + 30, u = t % L;
    if (u < L - 30) { state = 'attack'; st = u; }
  }
  const f = { c: ci, x: 0, y: 0, vx: 0, vy: 0, face: face || 1, state, st, onGround: true, flash: 0, inv: 0, landT: 0, hp: C.hp, glide: false, quaked: false };
  c.save(); c.translate(x, y); c.scale(scale, scale);
  drawFighter(c, f, t);
  c.restore();
}
function pedestal(c, x, y, w, col) {
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, y + 4, w, w * .22, 0, 0, TAU); c.fill();
  c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, w, w * .22, 0, 0, TAU); c.stroke();
}

// ---------- skærme ----------
function drawSelect(c, s, ctx2) {
  const t = s.tick;
  MAPS[s.map].bg(c, t); dim(c, .62);
  txt(c, 'VÆLG KÆMPER', W / 2, 52, 34, '#fff', 'center', 7);
  txt(c, ctx2.hint, W / 2, 80, 13, '#c9c5f0', 'center', 0, true);

  const cw = 118, ch = 118, gx = W / 2 - cw - 6, gy = 120;
  CHARS.forEach((C, i) => {
    const x = gx + (i % 2) * (cw + 12), y = gy + Math.floor(i / 2) * (ch + 12);
    c.save();
    c.beginPath(); c.roundRect(x, y, cw, ch, 12);
    c.fillStyle = C.cute ? '#2d3a6b' : '#3a1f3a'; c.fill();
    c.clip();
    c.fillStyle = C.cute ? 'rgba(76,201,240,.12)' : 'rgba(255,77,61,.12)'; c.fillRect(x, y + ch * .55, cw, ch);
    drawCharPreview(c, i, x + cw / 2, y + ch - 14, .72, t, 'idle', 1);
    c.restore();
    c.strokeStyle = '#4a4680'; c.lineWidth = 2; c.beginPath(); c.roundRect(x, y, cw, ch, 12); c.stroke();
    txt(c, C.name, x + 8, y + 16, 10, '#fff', 'left', 3);
    s.players.forEach((P, pi) => {
      if (P.char !== i) return;
      const ins = pi * 5;
      c.strokeStyle = P_COL[pi]; c.lineWidth = 4;
      c.beginPath(); c.roundRect(x - 3 + ins, y - 3 + ins, cw + 6 - ins * 2, ch + 6 - ins * 2, 14); c.stroke();
      const tx = pi === 0 ? x + 4 : x + cw - 34;
      c.fillStyle = P_COL[pi]; c.beginPath(); c.roundRect(tx, y + ch - 22, 30, 18, 5); c.fill();
      txt(c, (pi + 1) + 'P', tx + 15, y + ch - 8, 11, OUT, 'center');
    });
  });
  // tekst under gitteret
  txt(c, 'Nuttede · blå baggrund', W / 2, gy + 2 * ch + 40, 12, '#9fdcf2', 'center', 0, true);
  txt(c, 'Skurke · rød baggrund', W / 2, gy + 2 * ch + 58, 12, '#ff9a9a', 'center', 0, true);

  [0, 1].forEach(pi => {
    const P = s.players[pi], C = CHARS[P.char], cx = pi === 0 ? 165 : W - 165;
    txt(c, ctx2.labels[pi], cx, 116, 16, P_COL[pi], 'center', 4);
    pedestal(c, cx, 330, 70, P_COL[pi]);
    drawCharPreview(c, P.char, cx, 330, 1.4, t, P.ready ? 'attackLoop' : 'idle', pi === 0 ? 1 : -1);
    txt(c, C.name, cx, 378, C.name.length > 8 ? 24 : 30, P_COL[pi], 'center', 6);
    txt(c, C.title, cx, 398, 14, '#e2dfff', 'center', 0, true);
    const rows = [['LIV', Math.round((C.hp - 60) / 18)], ['FART', C.stats.fart], ['STYRKE', C.stats.styrke], ['HOP', C.stats.hop]];
    rows.forEach(([lab, v], r) => {
      const ry = 418 + r * 15;
      txt(c, lab, cx - 30, ry, 10, '#b9b5e6', 'right');
      for (let k = 0; k < 5; k++) {
        c.fillStyle = k < v ? P_COL[pi] : 'rgba(255,255,255,.15)';
        c.beginPath(); c.roundRect(cx - 22 + k * 18, ry - 9, 14, 9, 3); c.fill();
      }
    });
    txt(c, 'SPECIAL: ' + C.special.name.toUpperCase(), cx, 490, 12, '#ffb627', 'center', 3);
    wrapText(c, C.special.desc, cx, 508, 280, 15, 12, '#d8d4ff');
    if (P.ready) {
      c.save(); c.translate(cx, 232); c.rotate(-.12);
      txt(c, 'KLAR!', 0, 0, 40, P_COL[pi], 'center', 8);
      c.restore();
    }
  });
}

function drawMapSelect(c, s, ctx2) {
  const t = s.tick;
  MAPS[s.map].bg(c, t); dim(c, .6);
  txt(c, 'VÆLG BANE', W / 2, 60, 34, '#fff', 'center', 7);
  txt(c, ctx2.mapHint, W / 2, 88, 13, '#c9c5f0', 'center', 0, true);
  const cw = 270, ch = 152, gap = 24, x0 = (W - (cw * 3 + gap * 2)) / 2, y = 150;
  MAPS.forEach((m, i) => {
    const x = x0 + i * (cw + gap), sel = i === s.map;
    c.save();
    c.beginPath(); c.roundRect(x, y, cw, ch, 12); c.clip();
    c.translate(x, y); c.scale(cw / W, ch / H);
    m.bg(c, t); drawPlatforms(c, m, t);
    c.restore();
    c.strokeStyle = sel ? '#ffb627' : '#4a4680'; c.lineWidth = sel ? 6 : 2;
    c.beginPath(); c.roundRect(x, y, cw, ch, 12); c.stroke();
    txt(c, m.name, x + cw / 2, y + ch + 34, 20, sel ? '#ffb627' : '#fff', 'center', 5);
    txt(c, m.terrain, x + cw / 2, y + ch + 54, 14, '#c9c5f0', 'center', 0, true);
  });
  const n0 = CHARS[s.players[0].char].name, n1 = CHARS[s.players[1].char].name;
  txt(c, n0, W / 2 - 50, 470, 26, P_COL[0], 'right', 6);
  txt(c, 'VS', W / 2, 472, 30, '#fff', 'center', 6);
  txt(c, n1, W / 2 + 50, 470, 26, P_COL[1], 'left', 6);
}

function drawHUD(c, s) {
  const bw = 360, bh = 22, y = 22;
  [0, 1].forEach(i => {
    const f = s.fighters[i], C = CHARS[f.c], r = Math.max(0, f.hp / C.hp);
    if (s.phase === 'intro' || FX.lag[i] < r) FX.lag[i] = r;
    else FX.lag[i] += (r - FX.lag[i]) * .04;
    const x0 = i === 0 ? 40 : W - 40 - bw;
    c.fillStyle = OUT; c.beginPath(); c.roundRect(x0 - 4, y - 4, bw + 8, bh + 8, 7); c.fill();
    c.fillStyle = '#2a2440'; c.fillRect(x0, y, bw, bh);
    const bar = (v, col) => { c.fillStyle = col; i === 0 ? c.fillRect(x0, y, bw * v, bh) : c.fillRect(x0 + bw * (1 - v), y, bw * v, bh); };
    bar(FX.lag[i], '#ff4d3d');
    bar(r, r > .5 ? '#7cf06a' : r > .25 ? '#ffd23f' : '#ff8a3d');
    c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(x0, y + 2, bw, 5);
    txt(c, `${Math.ceil(f.hp)}`, i === 0 ? x0 + 8 : x0 + bw - 8, y + 17, 13, '#fff', i === 0 ? 'left' : 'right', 3);
    txt(c, C.name, i === 0 ? x0 : x0 + bw, y + bh + 26, 18, P_COL[i], i === 0 ? 'left' : 'right', 5);
    for (let w = 0; w < WINS_NEEDED; w++) {
      const cx = i === 0 ? x0 + bw - 10 - w * 22 : x0 + 10 + w * 22, cy = y + bh + 18;
      c.fillStyle = w < s.wins[i] ? '#ffb627' : 'rgba(0,0,0,.4)';
      c.strokeStyle = OUT; c.lineWidth = 2.5;
      c.beginPath(); c.arc(cx, cy, 7, 0, TAU); c.fill(); c.stroke();
    }
  });
  c.fillStyle = OUT; c.beginPath(); c.roundRect(W / 2 - 36, 10, 72, 52, 10); c.fill();
  c.fillStyle = '#1e1a36'; c.beginPath(); c.roundRect(W / 2 - 32, 14, 64, 44, 8); c.fill();
  const sec = Math.max(0, Math.ceil(s.timer / 60));
  txt(c, String(sec), W / 2, 48, 28, sec <= 10 ? '#ff5d4d' : '#fff', 'center');
}

function banner(c, str, local, col, size) {
  const k = Math.min(1, local / 8), sc = 1.6 - .6 * k;
  c.save(); c.translate(W / 2, H / 2 - 20); c.scale(sc, sc);
  c.globalAlpha = k;
  txt(c, str, 0, 0, size || 64, col || '#ffb627', 'center', 10);
  c.restore();
}

function drawFight(c, s, dt) {
  const m = MAPS[s.map];
  m.bg(c, s.tick); drawPlatforms(c, m, s.tick);
  s.projectiles.forEach(p => drawProj(c, p, s.tick));
  const order = [0, 1].sort((a, b) => (s.fighters[a].state === 'hurt' ? -1 : 0) - (s.fighters[b].state === 'hurt' ? -1 : 0));
  order.forEach(i => drawFighter(c, s.fighters[i], s.tick));
  // 1P / 2P markør over hovedet
  s.fighters.forEach((f, i) => {
    if (f.state === 'ko') return;
    const C = CHARS[f.c], x = Math.max(16, Math.min(W - 16, f.x)), y = Math.max(16, f.y - C.h - 22);
    c.fillStyle = P_COL[i]; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(x - 7, y + 4); c.lineTo(x + 7, y + 4); c.lineTo(x, y + 12); c.closePath(); c.fill(); c.stroke();
    txt(c, (i + 1) + 'P', x, y, 11, P_COL[i], 'center', 3);
  });
  drawParts(c, dt);
  drawHUD(c, s);
  if (s.phase === 'intro') {
    if (s.phaseT < 60) banner(c, `RUNDE ${s.round}`, s.phaseT, '#fff');
    else banner(c, 'KÆMP!', s.phaseT - 60, '#ffb627', 80);
  } else if (s.phase === 'ko') {
    banner(c, s.koTime ? 'TIDEN ER GÅET' : 'K.O.!', s.phaseT, '#ff5d4d', s.koTime ? 52 : 90);
    if (s.phaseT > 50) {
      const w = s.roundWinner;
      const sub = w >= 0 ? `${CHARS[s.fighters[w].c].name} VINDER RUNDEN` : 'UAFGJORT';
      txt(c, sub, W / 2, H / 2 + 40, 24, w >= 0 ? P_COL[w] : '#fff', 'center', 6);
    }
  }
}

function drawResult(c, s, ctx2) {
  const t = s.tick, w = s.winner;
  MAPS[s.map].bg(c, t); dim(c, .55);
  if (w >= 0) {
    const ci = s.players[w].char;
    txt(c, `SPILLER ${w + 1} VINDER!`, W / 2, 86, 48, P_COL[w], 'center', 9);
    pedestal(c, W / 2, 410, 110, P_COL[w]);
    drawCharPreview(c, ci, W / 2, 410, 1.9, t, 'idle', 1);
    txt(c, CHARS[ci].name, W / 2, 462, 30, '#fff', 'center', 6);
  } else {
    txt(c, 'UAFGJORT!', W / 2, 200, 56, '#fff', 'center', 9);
  }
  txt(c, `${s.wins[0]} – ${s.wins[1]}`, W / 2, 132, 28, '#fff', 'center', 6);
  if (s.phaseT > 60) txt(c, ctx2.again, W / 2, 506, 15, '#e2dfff', 'center', 0, true);
}

function drawIdle(c, waiting) {
  const t = FX.t * 60;
  MAPS[0].bg(c, t); drawPlatforms(c, MAPS[0], t);
  [[0, 300, 400, 1], [2, 660, 400, -1]].forEach(([ci, x, y, face]) => drawCharPreview(c, ci, x, y, 1, t, 'idle', face));
  dim(c, waiting ? .55 : .62);
  if (waiting) txt(c, 'VENTER PÅ VÆRTEN…', W / 2, H / 2, 32, '#fff', 'center', 7);
}

// Kaldes hver skærm-frame
function renderFrame(c, s, dt, opts) {
  FX.t += dt;
  c.setTransform(2, 0, 0, 2, 0, 0);
  if (FX.shake > 0) {
    c.translate(rnd(-1, 1) * FX.shake, rnd(-1, 1) * FX.shake);
    FX.shake = Math.max(0, FX.shake - dt * 40);
  }
  if (!s) { drawIdle(c, opts.waiting); FX.parts.length = 0; }
  else if (s.screen === 'select') { drawSelect(c, s, opts); FX.parts.length = 0; }
  else if (s.screen === 'map') { drawMapSelect(c, s, opts); FX.parts.length = 0; }
  else if (s.screen === 'fight') drawFight(c, s, dt);
  else if (s.screen === 'result') { drawResult(c, s, opts); FX.parts.length = 0; }
  if (FX.flash > 0) {
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.fillStyle = `rgba(255,255,255,${FX.flash * .6})`; c.fillRect(0, 0, W, H);
    FX.flash = Math.max(0, FX.flash - dt * 3);
  }
}
