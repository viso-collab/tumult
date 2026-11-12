// characters.js — figurerne: tal, angreb og hvordan de tegnes.
// Hver figur tegnes med fødderne i (0,0) og ansigtet mod højre.

const TAU = Math.PI * 2;
const OUT = '#1a1426'; // omridsfarve

// ---------- tegne-hjælpere ----------
function limb(c, x, y, ang, len, w, col) {
  // ang = 0 peger lige ned, PI/2 peger frem, PI peger op
  const ex = x + Math.sin(ang) * len, ey = y + Math.cos(ang) * len;
  c.lineCap = 'round';
  c.strokeStyle = OUT; c.lineWidth = w + 6;
  c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke();
  c.strokeStyle = col; c.lineWidth = w;
  c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke();
  return [ex, ey];
}
function blob(c, path, col, lw) {
  c.beginPath(); path();
  c.fillStyle = col; c.fill();
  c.lineWidth = lw || 3; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke();
}
function fillShape(c, path, col) { c.beginPath(); path(); c.fillStyle = col; c.fill(); }
function dot(c, x, y, r, col) { blob(c, () => c.arc(x, y, r, 0, TAU), col); }

function cuteEyes(c, p, pts, rx, ry) {
  c.lineCap = 'round'; c.strokeStyle = OUT; c.lineWidth = 3;
  pts.forEach(([ex, ey], i) => {
    if (p.eyes === 'open') {
      blob(c, () => c.ellipse(ex, ey, rx, ry, 0, 0, TAU), '#fff');
      fillShape(c, () => c.ellipse(ex + rx * .3, ey + ry * .08, rx * .52, ry * .55, 0, 0, TAU), OUT);
      fillShape(c, () => c.arc(ex + rx * .45, ey - ry * .3, rx * .22, 0, TAU), '#fff');
    } else if (p.eyes === 'closed') {
      c.strokeStyle = OUT; c.lineWidth = 3;
      c.beginPath(); c.moveTo(ex - rx, ey); c.quadraticCurveTo(ex, ey + ry * .5, ex + rx, ey); c.stroke();
    } else {
      const r = rx * .8;
      c.strokeStyle = OUT; c.lineWidth = 3;
      c.beginPath(); c.moveTo(ex - r, ey - r); c.lineTo(ex + r, ey + r); c.moveTo(ex + r, ey - r); c.lineTo(ex - r, ey + r); c.stroke();
    }
    if (p.brow > .05) {
      const b = ry * .6 * p.brow;
      c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath();
      if (i === 0) { c.moveTo(ex - rx - 1, ey - ry - 4); c.lineTo(ex + rx + 1, ey - ry - 4 + b); }
      else { c.moveTo(ex - rx - 1, ey - ry - 4 + b); c.lineTo(ex + rx + 1, ey - ry - 4); }
      c.stroke();
    }
  });
}

function glowEyes(c, p, pts, col, w, h) {
  pts.forEach(([ex, ey], i) => {
    if (p.eyes === 'x') {
      c.strokeStyle = col; c.lineWidth = 2.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(ex - w, ey - w); c.lineTo(ex + w, ey + w); c.moveTo(ex + w, ey - w); c.lineTo(ex - w, ey + w); c.stroke();
      return;
    }
    const hh = p.eyes === 'closed' ? .7 : h;
    c.save(); c.globalAlpha *= .3;
    fillShape(c, () => c.arc(ex, ey, w * 2.4, 0, TAU), col);
    c.restore();
    fillShape(c, () => c.ellipse(ex, ey, w, hh, i === 0 ? .35 : -.35, 0, TAU), col);
  });
}

function mouth(c, p, x, y, s) {
  c.lineWidth = 2.5; c.strokeStyle = OUT; c.beginPath();
  if (p.mouth === 'smile') { c.arc(x, y, 4 * s, .3, Math.PI - .3); c.stroke(); }
  else if (p.mouth === 'grin') { c.arc(x, y - 1, 5 * s, .1, Math.PI - .1); c.closePath(); c.fillStyle = '#5a1a2e'; c.fill(); c.stroke(); }
  else if (p.mouth === 'grit') { c.rect(x - 6 * s, y - 3 * s, 12 * s, 5 * s); c.fillStyle = '#fff'; c.fill(); c.stroke(); }
  else { c.ellipse(x, y + 1, 3 * s, 4 * s, 0, 0, TAU); c.fillStyle = '#5a1a2e'; c.fill(); c.stroke(); }
}

function polyStroke(c, pts, w, col) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  [[OUT, w + 6], [col, w]].forEach(([s, lw]) => {
    c.strokeStyle = s; c.lineWidth = lw; c.beginPath();
    pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.stroke();
  });
}

function claws(c, x, y, a, col) {
  for (let i = -1; i <= 1; i++) {
    const aa = a + i * .38, ex = x + Math.sin(aa) * 13, ey = y + Math.cos(aa) * 13;
    c.lineCap = 'round';
    c.strokeStyle = OUT; c.lineWidth = 5; c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke();
    c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke();
  }
}

// ---------- BRASK: nuttet, rund, horn og halstørklæde ----------
function drawBrask(c, f, p, t) {
  c.scale(.8, .8);
  const k = col => p.flash ? '#fff' : col;
  const sp = (f.state === 'run' || !f.onGround) ? 2 : 1;
  const pts = [];
  for (let i = 0; i < 7; i++) pts.push([-14 - i * 8, -53 + i * 1.6 + Math.sin(t * .13 * sp - i * .8) * i * .9]);
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 6; i++) {
    c.strokeStyle = pass ? k('#ef476f') : OUT; c.lineWidth = (10 - i * 1.1) + (pass ? 0 : 5);
    c.beginPath(); c.moveTo(pts[i][0], pts[i][1]); c.lineTo(pts[i + 1][0], pts[i + 1][1]); c.stroke();
  }
  const bl = limb(c, -7, -22, p.legB, 18, 12, k('#2a9488')); dot(c, bl[0] + 2, bl[1] + 1, 6.5, k('#2a9488'));
  const ba = limb(c, -10, -46, p.armB, 17, 9, k('#2a9488')); dot(c, ba[0], ba[1], 6.5, k('#2a9488'));
  blob(c, () => c.ellipse(0, -38, 24, 22, 0, 0, TAU), k('#3ec6b4'));
  fillShape(c, () => c.ellipse(5, -33, 14, 13, 0, 0, TAU), k('#f6e7c8'));
  const fl = limb(c, 7, -22, p.legF, 18, 12, k('#3ec6b4')); dot(c, fl[0] + 3, fl[1] + 1, 7, k('#3ec6b4'));
  blob(c, () => { c.moveTo(-14, -94); c.quadraticCurveTo(-22, -108, -14, -116); c.quadraticCurveTo(-8, -104, -2, -99); c.closePath(); }, k('#f6e7c8'));
  blob(c, () => { c.moveTo(10, -99); c.quadraticCurveTo(18, -110, 26, -114); c.quadraticCurveTo(26, -102, 20, -94); c.closePath(); }, k('#f6e7c8'));
  dot(c, 2, -74, 27, k('#3ec6b4'));
  fillShape(c, () => c.arc(-6, -84, 9, 0, TAU), p.flash ? '#fff' : 'rgba(255,255,255,.18)');
  if (!p.flash) fillShape(c, () => c.arc(25, -66, 4.5, 0, TAU), 'rgba(239,71,111,.45)');
  cuteEyes(c, p, [[10, -78], [22, -77]], 5.5, 7.5);
  mouth(c, p, 17, -66, 1);
  blob(c, () => c.roundRect(-20, -58, 42, 11, 5), k('#ef476f'));
  blob(c, () => c.ellipse(-16, -52, 6, 5, 0, 0, TAU), k('#b8304f'));
  const fa = limb(c, 8, -46, p.armF, 16 + p.ext, 9, k('#3ec6b4'));
  dot(c, fa[0], fa[1], p.ext > 4 ? 9 : 7, k('#3ec6b4'));
}

// ---------- PIP: lille kylling-fugl med et blad på hovedet ----------
function drawPip(c, f, p, t) {
  const k = col => p.flash ? '#fff' : col;
  const air = !f.onGround && f.state !== 'ko';
  blob(c, () => { c.moveTo(-17, -32); c.lineTo(-31, -40); c.lineTo(-27, -30); c.lineTo(-33, -23); c.lineTo(-17, -20); c.closePath(); }, k('#f5b700'));
  if (air) {
    limb(c, -5, -8, -.6, 6, 3, k('#ff8c42')); limb(c, 5, -8, .6, 6, 3, k('#ff8c42'));
  } else {
    const lb = limb(c, -5, -8, p.legB * .6, 8, 3, k('#ff8c42'));
    const lf = limb(c, 5, -8, p.legF * .6, 8, 3, k('#ff8c42'));
    blob(c, () => c.ellipse(lb[0] + 2, lb[1], 5, 2.5, 0, 0, TAU), k('#ff8c42'), 2);
    blob(c, () => c.ellipse(lf[0] + 2, lf[1], 5, 2.5, 0, 0, TAU), k('#ff8c42'), 2);
  }
  blob(c, () => c.ellipse(0, -28, 21, 22, 0, 0, TAU), k('#ffd23f'));
  fillShape(c, () => c.ellipse(6, -21, 12, 12, 0, 0, TAU), k('#fff1b8'));
  // blad på hovedet
  c.save(); c.translate(-2, -49); c.rotate(Math.sin(t * .08) * .25 + (air ? -.3 : 0));
  c.strokeStyle = OUT; c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-2, -6, 1, -11); c.stroke();
  blob(c, () => c.ellipse(7, -13, 8, 4, -.5, 0, TAU), k('#6bd16b'));
  blob(c, () => c.ellipse(-6, -10, 6, 3, .6, 0, TAU), k('#4fb84f'));
  c.restore();
  cuteEyes(c, p, [[3, -34], [14, -33]], 5.5, 7);
  if (!p.flash) fillShape(c, () => c.arc(17, -23, 3.5, 0, TAU), 'rgba(239,71,111,.45)');
  const open = p.mouth === 'grin' || p.mouth === 'o' || f.state === 'attack';
  blob(c, () => { c.moveTo(18, -29); c.lineTo(31, -26); c.lineTo(18, -22); c.closePath(); }, k('#ff8c42'));
  if (open) blob(c, () => { c.moveTo(18, -21); c.lineTo(27, -19); c.lineTo(18, -16); c.closePath(); }, k('#e06a2a'));
  // vinge
  let wa = .5 + p.armF * .3;
  if (air) wa = -.5 + Math.sin(t * .5) * .9;
  if (f.glide) wa = -1.8 + Math.sin(t * .3) * .1;
  if (f.state === 'special') wa = f.st < 7 ? -1.3 : 1.5;
  if (f.state === 'hurt' || f.state === 'ko') wa = -2;
  c.save(); c.translate(-4, -29); c.rotate(wa);
  blob(c, () => c.ellipse(0, 9, 7, 12, 0, 0, TAU), k('#f5b700'));
  c.restore();
}

// ---------- GRUMHAL: stort, krumbøjet troldmonster ----------
function drawGrum(c, f, p, t) {
  const k = col => p.flash ? '#fff' : col;
  const skin = k('#5d4e78'), dark = k('#3f3456'), belly = k('#8b7b98'), iron = k('#34343f'), ironL = k('#6a6a7c');
  const bl = limb(c, -14, -34, p.legB * .6, 24, 20, dark);
  blob(c, () => c.ellipse(bl[0] + 4, bl[1] + 2, 13, 7, 0, 0, TAU), dark);
  const ba = limb(c, -16, -84, p.armB, 38, 15, dark); dot(c, ba[0], ba[1], 11, dark);
  [[-30, -82, -1.0], [-36, -60, -1.4], [-18, -100, -.6]].forEach(([x, y, a]) => {
    c.save(); c.translate(x, y); c.rotate(a);
    blob(c, () => { c.moveTo(-7, 2); c.lineTo(0, -18); c.lineTo(7, 2); c.closePath(); }, ironL);
    c.restore();
  });
  blob(c, () => c.ellipse(0, -62, 36, 38, .25, 0, TAU), skin);
  fillShape(c, () => c.ellipse(10, -50, 20, 22, .2, 0, TAU), belly);
  blob(c, () => c.roundRect(-30, -40, 62, 10, 4), iron);
  fillShape(c, () => c.roundRect(-2, -39, 10, 8, 2), k('#c9a24a'));
  const fl = limb(c, 12, -32, p.legF * .6, 24, 20, skin);
  blob(c, () => c.ellipse(fl[0] + 5, fl[1] + 2, 14, 7, 0, 0, TAU), skin);
  // arm + skulderplade
  const fa = limb(c, 12, -84, p.armF, 40 + p.ext, 17, skin);
  dot(c, fa[0], fa[1], 14, skin);
  dot(c, fa[0] + Math.sin(p.armF) * 6, fa[1] + Math.cos(p.armF) * 6, 4, ironL);
  [-.9, 0, .9].forEach(a => {
    blob(c, () => {
      c.moveTo(6 + Math.sin(a - .28) * 15, -92 - Math.cos(a - .28) * 15);
      c.lineTo(6 + Math.sin(a) * 29, -92 - Math.cos(a) * 29);
      c.lineTo(6 + Math.sin(a + .28) * 15, -92 - Math.cos(a + .28) * 15);
      c.closePath();
    }, ironL);
  });
  blob(c, () => { c.arc(6, -90, 17, Math.PI, 0); c.closePath(); }, iron);
  // hoved
  c.save(); c.translate(32, -86);
  blob(c, () => { c.moveTo(-10, -10); c.quadraticCurveTo(-22, -28, -36, -20); c.quadraticCurveTo(-22, -20, -14, -1); c.closePath(); }, k('#d9cbb0'));
  blob(c, () => c.ellipse(0, 0, 18, 16, 0, 0, TAU), skin);
  fillShape(c, () => c.ellipse(5, -7, 16, 5, -.1, 0, TAU), dark);
  blob(c, () => c.roundRect(-4, 4, 26, 13, 6), skin);
  blob(c, () => { c.moveTo(2, 6); c.lineTo(5, -5); c.lineTo(9, 6); c.closePath(); }, k('#efe3c2'));
  blob(c, () => { c.moveTo(14, 6); c.lineTo(17, -4); c.lineTo(20, 6); c.closePath(); }, k('#efe3c2'));
  glowEyes(c, p, [[4, -2], [13, -1]], '#ff4d3d', 3.4, 2.2);
  c.restore();
}

// ---------- NATTEVÆVER: svævende kappe med kløer ----------
function drawNat(c, f, p, t) {
  const k = col => p.flash ? '#fff' : col;
  const cloak = k('#2c2244'), cloakD = k('#1a1430'), trim = k('#8a6ad6'), claw = k('#d8d0f0');
  const hover = f.state === 'ko' ? 0 : -8 + Math.sin(t * .07) * 4;
  c.translate(0, hover);
  if (!p.flash && f.state !== 'ko') for (let i = 0; i < 3; i++) {
    const ph = (t * .03 + i / 3) % 1;
    c.save(); c.globalAlpha *= (1 - ph) * .55;
    fillShape(c, () => c.arc(-12 + i * 12, -2 + ph * 16, 5 * (1 - ph) + 1, 0, TAU), '#8a6ad6');
    c.restore();
  }
  const ba = limb(c, -6, -78, p.armB, 34, 6, cloakD); claws(c, ba[0], ba[1], p.armB, claw);
  blob(c, () => {
    c.moveTo(-8, -112);
    c.quadraticCurveTo(12, -126, 22, -100);
    c.quadraticCurveTo(32, -56, 26, -6);
    for (let i = 1; i <= 6; i++) {
      const x = 26 - i * (52 / 6), y = -6 - (i % 2 ? 10 : 0) + Math.sin(t * .15 + i * 1.3) * 3;
      c.lineTo(x, y);
    }
    c.quadraticCurveTo(-30, -60, -20, -104);
    c.lineTo(-32, -124);
    c.closePath();
  }, cloak);
  c.strokeStyle = trim; c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(18, -96); c.quadraticCurveTo(28, -56, 22, -12); c.stroke();
  fillShape(c, () => c.ellipse(9, -97, 11, 13, .1, 0, TAU), k('#07050d'));
  glowEyes(c, p, [[6, -99], [14, -98]], '#7dffd0', 3.2, 2);
  blob(c, () => { c.moveTo(8, -78); c.lineTo(13, -71); c.lineTo(8, -64); c.lineTo(3, -71); c.closePath(); }, k('#b48cff'), 2);
  const fa = limb(c, 6, -78, p.armF, 32 + p.ext, 6, cloak); claws(c, fa[0], fa[1], p.armF, claw);
}

// ---------- figurlisten ----------
const CHARS = [
  {
    id: 'brask', name: 'BRASK', title: 'Hornet hyggetrold', cute: true,
    hp: 100, w: 44, h: 88, speed: 4.3, jump: 11.5, jumps: 2, grav: .62, maxFall: 12, weight: 1,
    attack: { startup: 5, active: 4, recovery: 10, dmg: 7, kb: [4, -3.5], box: { x: 14, y: -52, w: 42, h: 30 } },
    reach: 26,
    swoosh: { x: 6, y: -37, r: 42, a0: -1.3, a1: .6, col: '#ffb627' },
    special: { name: 'Hornstød', desc: 'Brager frem med hornene. Virker også i luften.' },
    stats: { fart: 3, styrke: 3, hop: 3 },
    draw: drawBrask,
    pose(p, f) {
      if (f.state !== 'special') return;
      if (f.st < 7) { p.sy = .85; p.sx = 1.1; p.armF = -.8; p.armB = -1; }
      else if (f.st < 23) { p.lean = .45; p.armF = -1.6; p.armB = -1.8; p.legF = -.6; p.legB = -1; }
    },
  },
  {
    id: 'pip', name: 'PIP', title: 'Lille fugl med stort mod', cute: true,
    hp: 80, w: 40, h: 54, speed: 5.2, jump: 10.5, jumps: 3, grav: .5, maxFall: 9, weight: .7, glide: true,
    attack: { startup: 3, active: 3, recovery: 7, dmg: 4, kb: [3, -2.5], box: { x: 10, y: -42, w: 32, h: 28 } },
    reach: 0,
    swoosh: { x: 10, y: -26, r: 26, a0: -.9, a1: .9, col: '#fff1b8' },
    special: { name: 'Fjerkast', desc: 'Kaster en skarp fjer. Hold hop nede for at svæve.' },
    stats: { fart: 5, styrke: 1, hop: 5 },
    draw: drawPip,
    pose(p, f) {
      if (f.state === 'attack' && f.st >= this.attack.startup && f.st < this.attack.startup + this.attack.active) p.lean = .45;
    },
  },
  {
    id: 'grum', name: 'GRUMHAL', title: 'Troldmonster fra kløften', cute: false,
    hp: 135, w: 64, h: 112, speed: 3.0, jump: 11, jumps: 2, grav: .72, maxFall: 14, weight: 1.5,
    attack: { startup: 12, active: 5, recovery: 16, dmg: 13, kb: [8, -6], box: { x: 14, y: -114, w: 70, h: 106 } },
    reach: 6,
    swoosh: { x: 12, y: -84, r: 58, a0: -2.0, a1: 1.1, col: '#ff6b3d' },
    special: { name: 'Jordskælv', desc: 'Slår i jorden, så chokbølger løber begge veje. I luften: styrtdyk.' },
    stats: { fart: 1, styrke: 5, hop: 2 },
    draw: drawGrum,
    pose(p, f) {
      const a = this.attack, st = f.st;
      if (f.state === 'attack') {
        if (st < a.startup) { const q = st / a.startup; p.armF = .3 + (-2.7 - .3) * q; p.lean = -.12 * q; }
        else if (st < a.startup + a.active) { const q = (st - a.startup) / a.active; p.armF = -2.7 + 3.8 * Math.min(1, q * 1.6); p.ext = 6; p.lean = .2; }
        else { const q = (st - a.startup - a.active) / a.recovery; p.armF = 1.1 - .8 * q; p.ext = 6 * (1 - q); p.lean = .2 * (1 - q); }
      }
      if (f.state === 'special') {
        if (!f.quaked) { p.armF = 2.9; p.armB = -2.9; p.sy = 1.06; p.sx = .96; p.lean = -.08; }
        else { p.armF = .7; p.armB = -.7; p.sy = .9; p.sx = 1.08; p.lean = .15; }
      }
    },
  },
  {
    id: 'nat', name: 'NATTEVÆVER', title: 'Skyggen der svæver', cute: false,
    hp: 95, w: 40, h: 112, speed: 3.9, jump: 10, jumps: 2, grav: .45, maxFall: 8, weight: .9,
    attack: { startup: 7, active: 4, recovery: 12, dmg: 8, kb: [5, -4], box: { x: 12, y: -116, w: 66, h: 78 } },
    reach: 14,
    swoosh: { x: 6, y: -86, r: 48, a0: 1.2, a1: -1.4, col: '#7dffd0' },
    special: { name: 'Skyggespring', desc: 'Teleporterer i den retning, du holder. Også opad.' },
    stats: { fart: 3, styrke: 3, hop: 4 },
    draw: drawNat,
    pose(p, f) {
      const a = this.attack, st = f.st;
      if (f.state === 'attack') {
        if (st < a.startup) { p.armF = .3 - .7 * (st / a.startup); }
        else if (st < a.startup + a.active) { const q = (st - a.startup) / a.active; p.armF = .6 + 1.8 * q; p.ext = 14; p.lean = .1; }
      }
      if (f.state === 'special') {
        p.alpha = st < 10 ? 1 - st / 10 * .9 : st < 20 ? .1 + (st - 10) / 10 * .9 : 1;
      }
    },
  },
];

// ---------- positur ud fra tilstand ----------
function computePose(f, t) {
  const C = CHARS[f.c];
  const p = { bob: 0, lean: 0, sx: 1, sy: 1, legF: 0, legB: 0, armF: .3, armB: -.3, ext: 0, eyes: 'open', brow: 0, mouth: 'smile', flash: f.flash > 0, swoosh: -1, alpha: 1 };
  const st = f.st;
  switch (f.state) {
    case 'idle': {
      const b = Math.sin(t * .05 + f.c);
      p.sy = 1 + b * .025; p.sx = 1 - b * .02; p.armF = .3 + b * .08; p.armB = -.3 - b * .08;
      if ((t + f.c * 50) % 200 < 8) p.eyes = 'closed';
      break;
    }
    case 'run': {
      const ph = t * .22;
      p.legF = Math.sin(ph) * .8; p.legB = -p.legF; p.bob = -Math.abs(Math.cos(ph)) * 4;
      p.lean = .12; p.armF = -Math.sin(ph) * .9; p.armB = Math.sin(ph) * .9; p.mouth = 'grin';
      break;
    }
    case 'air':
      if (f.vy < 0) { p.sy = 1.08; p.sx = .94; p.legF = .9; p.legB = -.5; p.armF = 2.2; p.armB = -2.2; }
      else { p.legF = .4; p.legB = -.2; p.armF = 1.2; p.armB = -1.4; }
      p.mouth = 'grin';
      break;
    case 'attack': {
      const a = C.attack;
      if (st < a.startup) { const q = st / a.startup; p.armF = .3 - 1.4 * q; p.lean = -.08 * q; }
      else if (st < a.startup + a.active) { const q = (st - a.startup) / a.active; p.armF = 1.57; p.ext = C.reach; p.lean = .15; p.swoosh = q; }
      else { const q = (st - a.startup - a.active) / a.recovery; p.armF = 1.57 - 1.27 * q; p.ext = C.reach * (1 - q); p.lean = .15 * (1 - q); p.swoosh = q < .3 ? 1 + q / .3 : -1; }
      p.brow = 1; p.mouth = 'grit'; p.legF = .4; p.legB = -.3;
      break;
    }
    case 'special': p.brow = 1; p.mouth = 'grit'; break;
    case 'hurt': p.eyes = 'x'; p.mouth = 'o'; p.lean = -.25; p.armF = 2.3; p.armB = -2.3; break;
    case 'block': p.armF = 1.9; p.armB = 1.5; p.lean = -.1; p.brow = 1; p.mouth = 'grit'; p.sy = .94; p.sx = 1.04; break;
    case 'ko': p.eyes = 'x'; p.mouth = 'o'; p.lean = -Math.min(1.45, st * .06); break;
  }
  if (f.landT > 0) { p.sy *= 1 - f.landT * .025; p.sx *= 1 + f.landT * .02; }
  if (C.pose) C.pose(p, f, t);
  return p;
}

function drawSwoosh(c, sw, k) {
  const prog = Math.min(1, k), alpha = k <= 1 ? .9 : .9 * (1 - (k - 1));
  if (alpha <= 0) return;
  const span = sw.a1 - sw.a0, end = sw.a0 + span * prog, start = sw.a0 + span * Math.max(0, prog - .7);
  const a = Math.min(start, end), b = Math.max(start, end);
  if (b - a < .01) return;
  c.save(); c.globalAlpha *= alpha; c.lineCap = 'round';
  c.strokeStyle = sw.col; c.lineWidth = 10; c.beginPath(); c.arc(sw.x, sw.y, sw.r, a, b); c.stroke();
  c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.arc(sw.x, sw.y, sw.r, a, b); c.stroke();
  c.restore();
}

function drawFighter(c, f, t) {
  const C = CHARS[f.c], p = computePose(f, t);
  c.save();
  if (f.onGround || f.state === 'ko') {
    c.fillStyle = 'rgba(0,0,0,.3)';
    c.beginPath(); c.ellipse(f.x, f.y + 2, C.w * .6, 6, 0, 0, TAU); c.fill();
  }
  c.translate(f.x, f.y + p.bob);
  c.scale(f.face, 1);
  c.rotate(p.lean);
  c.scale(p.sx, p.sy);
  if (f.inv > 0 && f.state !== 'special' && (t >> 2) % 2) c.globalAlpha = .45;
  c.globalAlpha *= p.alpha;
  c.save(); C.draw(c, f, p, t); c.restore();
  if (p.swoosh >= 0) drawSwoosh(c, C.swoosh, p.swoosh);
  c.restore();
}
