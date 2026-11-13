// characters.js — the fighters: stats, attacks, poses and drawing.
// Every fighter is drawn with feet at (0,0), facing right.

const TAU = Math.PI * 2;
const OUTC = 'rgba(20,14,30,.92)';

// ---------- colour helpers ----------
const _shadeCache = new Map();
function shade(hex, amt) {
  const key = hex + amt;
  let v = _shadeCache.get(key);
  if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const tgt = amt >= 0 ? 255 : 0, a = Math.abs(amt);
  r = Math.round(r + (tgt - r) * a); g = Math.round(g + (tgt - g) * a); b = Math.round(b + (tgt - b) * a);
  v = `rgb(${r},${g},${b})`;
  _shadeCache.set(key, v);
  return v;
}
function col(p, base) { return p.flash ? '#ffffff' : base; }
// radial gradient lit from the top-left
function rg(c, p, x, y, r, base) {
  if (p.flash) return '#ffffff';
  const g = c.createRadialGradient(x - r * .35, y - r * .45, r * .08, x, y, r * 1.15);
  g.addColorStop(0, shade(base, .3)); g.addColorStop(.5, base); g.addColorStop(1, shade(base, -.45));
  return g;
}
function lg(c, p, x1, y1, x2, y2, base, k) {
  if (p.flash) return '#ffffff';
  k = k === undefined ? .3 : k;
  const g = c.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, shade(base, k)); g.addColorStop(.45, base); g.addColorStop(1, shade(base, -k));
  return g;
}
function part(c, path, fill, lw) {
  c.beginPath(); path();
  c.fillStyle = fill; c.fill();
  if (lw !== 0) { c.lineWidth = lw || 2; c.strokeStyle = OUTC; c.lineJoin = 'round'; c.stroke(); }
}
function fillP(c, path, fill) { c.beginPath(); path(); c.fillStyle = fill; c.fill(); }
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

// a shaded capsule (arm/leg segment)
function seg(c, p, x1, y1, x2, y2, w, base) {
  c.lineCap = 'round';
  c.strokeStyle = OUTC; c.lineWidth = w + 3; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  c.strokeStyle = col(p, base); c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  if (!p.flash) {
    const o = w * .2;
    c.strokeStyle = shade(base, .25); c.lineWidth = w * .3;
    c.beginPath(); c.moveTo(x1 - o, y1 - o); c.lineTo(x2 - o, y2 - o); c.stroke();
  }
}
// two-part limb (upper + lower) — angle 0 points down, PI/2 forward, PI up
function limb2(c, p, x, y, a1, l1, a2, l2, w1, w2, base) {
  const ex = x + Math.sin(a1) * l1, ey = y + Math.cos(a1) * l1;
  const hx = ex + Math.sin(a2) * l2, hy = ey + Math.cos(a2) * l2;
  const segs = [[x, y, ex, ey, w1], [ex, ey, hx, hy, w2]];
  c.lineCap = 'round';
  segs.forEach(([a, b, d, e, w]) => { c.strokeStyle = OUTC; c.lineWidth = w + 3; c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); });
  segs.forEach(([a, b, d, e, w]) => { c.strokeStyle = col(p, base); c.lineWidth = w; c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); });
  if (!p.flash) segs.forEach(([a, b, d, e, w]) => {
    const o = w * .2;
    c.strokeStyle = shade(base, .25); c.lineWidth = w * .3;
    c.beginPath(); c.moveTo(a - o, b - o); c.lineTo(d - o, e - o); c.stroke();
  });
  return [hx, hy, ex, ey];
}
// tapered ribbon through points (scarves, hair, capes)
function ribbon(c, p, pts, w0, w1, base) {
  const L = [], R = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d, w = (w0 + (w1 - w0) * i / (n - 1)) / 2;
    L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); R.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  part(c, () => {
    c.moveTo(L[0][0], L[0][1]); L.forEach(q => c.lineTo(q[0], q[1]));
    for (let i = n - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1]);
    c.closePath();
  }, lg(c, p, pts[0][0], pts[0][1] - 8, pts[n - 1][0], pts[n - 1][1] + 8, base, .28), 1.8);
}
function realEye(c, p, x, y, rx, ry, iris) {
  c.lineCap = 'round';
  if (p.eyes === 'x') {
    const r = rx * .8; c.strokeStyle = OUTC; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x - r, y - r); c.lineTo(x + r, y + r); c.moveTo(x + r, y - r); c.lineTo(x - r, y + r); c.stroke();
    return;
  }
  if (p.eyes === 'closed') {
    c.strokeStyle = OUTC; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x - rx, y); c.quadraticCurveTo(x, y + ry * .6, x + rx, y); c.stroke();
    return;
  }
  c.save();
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = p.flash ? '#fff' : '#f4f1ea'; c.fill(); c.clip();
  const m = Math.min(rx, ry);
  fillP(c, () => c.arc(x + rx * .28, y + ry * .05, m * .78, 0, TAU), col(p, iris));
  fillP(c, () => c.arc(x + rx * .34, y + ry * .05, m * .38, 0, TAU), p.flash ? '#fff' : '#0b0a10');
  fillP(c, () => c.arc(x + rx * .1, y - ry * .3, m * .22, 0, TAU), '#fff');
  c.restore();
  c.strokeStyle = OUTC; c.lineWidth = 1.8;
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
}
function brows(c, p, list, color) {
  if (p.brow < .05) return;
  c.strokeStyle = col(p, color); c.lineWidth = 2.6; c.lineCap = 'round';
  list.forEach(([x, y, w]) => { c.beginPath(); c.moveTo(x - w, y - 1); c.lineTo(x + w, y + 3 * p.brow); c.stroke(); });
}
function mouth(c, p, x, y, s) {
  c.lineWidth = 2; c.strokeStyle = OUTC; c.lineCap = 'round'; c.beginPath();
  if (p.mouth === 'smile') { c.arc(x, y, 3.6 * s, .35, Math.PI - .35); c.stroke(); }
  else if (p.mouth === 'grin') { c.arc(x, y - 1, 4.5 * s, .1, Math.PI - .1); c.closePath(); c.fillStyle = '#5a1a2e'; c.fill(); c.stroke(); }
  else if (p.mouth === 'grit') { c.rect(x - 5 * s, y - 2.5 * s, 10 * s, 4.5 * s); c.fillStyle = '#f2ece0'; c.fill(); c.stroke(); }
  else { c.ellipse(x, y + 1, 2.6 * s, 3.6 * s, 0, 0, TAU); c.fillStyle = '#4a1424'; c.fill(); c.stroke(); }
}
function glowEyes(c, p, pts, color, w, h) {
  pts.forEach(([ex, ey], i) => {
    if (p.eyes === 'x') {
      c.strokeStyle = color; c.lineWidth = 2.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(ex - w, ey - w); c.lineTo(ex + w, ey + w); c.moveTo(ex + w, ey - w); c.lineTo(ex - w, ey + w); c.stroke();
      return;
    }
    c.save();
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(ex, ey, 0, ex, ey, w * 3.2);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha *= .55; c.fillStyle = g; c.beginPath(); c.arc(ex, ey, w * 3.2, 0, TAU); c.fill();
    c.restore();
    fillP(c, () => c.ellipse(ex, ey, w, p.eyes === 'closed' ? .6 : h, i === 0 ? .35 : -.35, 0, TAU), p.flash ? '#fff' : color);
    fillP(c, () => c.ellipse(ex, ey, w * .45, (p.eyes === 'closed' ? .3 : h * .45), 0, 0, TAU), '#ffffff');
  });
}
function glow(c, x, y, r, color, a) {
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= a;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.restore();
}
function claws(c, p, x, y, a, color) {
  for (let i = -1; i <= 1; i++) {
    const aa = a + i * .38;
    const mx = x + Math.sin(aa) * 8, my = y + Math.cos(aa) * 8;
    const ex = x + Math.sin(aa + .35) * 14, ey = y + Math.cos(aa + .35) * 14;
    c.lineCap = 'round';
    c.strokeStyle = OUTC; c.lineWidth = 4; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx, my, ex, ey); c.stroke();
    c.strokeStyle = col(p, color); c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx, my, ex, ey); c.stroke();
  }
}
function orb(c, p, x, y, r, color) {
  glow(c, x, y, r * 3.5, color, .6);
  part(c, () => c.arc(x, y, r, 0, TAU), p.flash ? '#fff' : (() => {
    const g = c.createRadialGradient(x - r * .3, y - r * .3, 0, x, y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.4, color); g.addColorStop(1, shade(color, -.5)); return g;
  })(), 1.2);
}


// ============ KITSU — fox spirit trickster (cute / magic) ============
function drawKitsu(c, f, p, t) {
  const fur = '#e2843a', furL = '#f6e6cf', furD = '#a85a22', vest = '#b8323a', fire = '#6fd3ff';
  // three tails
  for (let k = 2; k >= 0; k--) {
    const base = -2.35 + k * .38 + Math.sin(t * .06 + k * 1.3) * .14 + (f.state === 'run' ? .35 : 0);
    const pts = [];
    for (let i = 0; i < 7; i++) {
      const a = base + i * .1, r = i * 7;
      pts.push([-8 + Math.sin(a) * r, -30 + Math.cos(a) * r]);
    }
    ribbon(c, p, pts, 7, 17, k === 1 ? shade(fur, -.08) : fur);
    const tip = pts[6];
    part(c, () => c.arc(tip[0], tip[1], 8.5, 0, TAU), rg(c, p, tip[0], tip[1], 8.5, furL), 1.6);
  }
  const bl = limb2(c, p, -5, -26, p.legB, 12, p.legB - p.kneeB - .3, 13, 7, 6, furD);
  part(c, () => c.ellipse(bl[0] + 3, bl[1], 6, 3, 0, 0, TAU), col(p, '#4a2a18'), 1.4);
  const ba = limb2(c, p, -6, -50, p.armB, 10, p.armB + p.elbB, 10, 6, 5, furD);
  part(c, () => c.arc(ba[0], ba[1], 4, 0, TAU), rg(c, p, ba[0], ba[1], 4, furD), 1.4);
  part(c, () => c.ellipse(1, -40, 13, 17, 0, 0, TAU), rg(c, p, 0, -44, 16, fur));
  fillP(c, () => c.ellipse(6, -40, 7, 12, 0, 0, TAU), rg(c, p, 6, -42, 10, furL));
  part(c, () => { c.moveTo(-12, -52); c.lineTo(6, -54); c.lineTo(12, -30); c.lineTo(-12, -26); c.closePath(); }, lg(c, p, -12, -54, 12, -26, vest), 1.6);
  c.strokeStyle = col(p, '#f2e6d0'); c.lineWidth = 2; c.beginPath(); c.moveTo(4, -54); c.lineTo(10, -30); c.stroke();
  part(c, () => c.roundRect(-13, -32, 26, 4, 2), col(p, '#e9c46a'), 1.2);
  const fl = limb2(c, p, 5, -26, p.legF, 12, p.legF - p.kneeF - .3, 13, 7, 6, fur);
  part(c, () => c.ellipse(fl[0] + 3, fl[1], 6, 3, 0, 0, TAU), col(p, '#4a2a18'), 1.4);
  // ears
  part(c, () => { c.moveTo(-6, -70); c.lineTo(-8, -90); c.lineTo(4, -74); c.closePath(); }, lg(c, p, -8, -90, 4, -70, fur), 1.6);
  fillP(c, () => { c.moveTo(-5, -73); c.lineTo(-7, -85); c.lineTo(1, -75); c.closePath(); }, col(p, '#4a2a18'));
  part(c, () => { c.moveTo(6, -73); c.lineTo(10, -91); c.lineTo(15, -71); c.closePath(); }, lg(c, p, 6, -91, 15, -71, fur), 1.6);
  // head and muzzle
  part(c, () => c.ellipse(4, -64, 13, 12, 0, 0, TAU), rg(c, p, 2, -67, 13, fur));
  part(c, () => { c.moveTo(8, -68); c.quadraticCurveTo(20, -66, 27, -61); c.quadraticCurveTo(20, -55, 8, -56); c.closePath(); }, lg(c, p, 8, -68, 27, -56, fur), 1.6);
  fillP(c, () => { c.moveTo(6, -60); c.quadraticCurveTo(18, -58, 26, -60); c.quadraticCurveTo(18, -54, 6, -55); c.closePath(); }, col(p, furL));
  fillP(c, () => c.ellipse(26.5, -61.5, 2.6, 2, 0, 0, TAU), col(p, '#1b1214'));
  realEye(c, p, 12, -66, 3.6, 2.8, '#e0a020');
  brows(c, p, [[12, -71, 4]], furD);
  // spirit mask on the side of the head
  c.save(); c.translate(-6, -66); c.rotate(-.35);
  part(c, () => c.ellipse(0, 0, 6, 8, 0, 0, TAU), lg(c, p, -6, -8, 6, 8, '#f4efe6', .15), 1.4);
  if (!p.flash) { c.strokeStyle = '#c0392b'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-3, -3); c.lineTo(-1, -1); c.moveTo(3, -3); c.lineTo(1, -1); c.moveTo(0, 2); c.lineTo(0, 5); c.stroke(); }
  c.restore();
  const fa = limb2(c, p, 6, -50, p.armF, 10, p.armF + p.elbF, 10 + p.ext, 6, 5, fur);
  part(c, () => c.arc(fa[0], fa[1], 4.5, 0, TAU), rg(c, p, fa[0], fa[1], 4.5, fur), 1.4);
  if (!p.flash && (p.glow > 0 || f.state === 'idle')) {
    const fx = fa[0] + 6, fy = fa[1] - 6 + Math.sin(t * .15) * 2;
    glow(c, fx, fy, 12 + p.glow * 14, fire, .6);
    fillP(c, () => { c.moveTo(fx, fy - 7); c.quadraticCurveTo(fx + 4, fy, fx, fy + 3); c.quadraticCurveTo(fx - 4, fy, fx, fy - 7); }, '#d8f6ff');
  }
}

// ============ ROOK — clockwork knight (cute) ============
function drawRook(c, f, p, t) {
  const steel = '#9aa5b1', steelD = '#6b7580', brass = '#c9a24a', plume = '#d64545', blue = '#7fd8ff';
  // jetpack
  [[-26, -64], [-19, -66]].forEach(([x, y]) => part(c, () => c.roundRect(x, y, 9, 26, 4), lg(c, p, x, y, x + 9, y, steelD, .3), 1.6));
  if (f.state === 'skill' && f.sk === 1 && !p.flash) {
    [[-21.5, -38], [-14.5, -40]].forEach(([x, y]) => {
      const len = 16 + Math.sin(t * 1.3 + x) * 5;
      glow(c, x, y + 8, 18, '#ffb347', .7);
      fillP(c, () => { c.moveTo(x - 4, y); c.quadraticCurveTo(x, y + len * 1.4, x + 4, y); c.closePath(); }, '#ffe2a0');
    });
  }
  const bl = limb2(c, p, -7, -24, p.legB * .7, 9, p.legB * .7 - p.kneeB, 9, 8, 7, steelD);
  part(c, () => c.roundRect(bl[0] - 5, bl[1] - 4, 14, 7, 3), lg(c, p, 0, bl[1] - 4, 0, bl[1] + 3, brass), 1.5);
  const ba = limb2(c, p, -8, -52, p.armB, 10, p.armB + p.elbB, 10, 7, 6, steelD);
  part(c, () => c.roundRect(-18, -64, 36, 42, 14), lg(c, p, -18, -64, 18, -22, steel, .3));
  if (!p.flash) {
    fillP(c, () => c.roundRect(-18, -40, 36, 6, 3), lg(c, p, 0, -40, 0, -34, brass));
    [[-12, -58], [12, -58], [-12, -28], [12, -28]].forEach(([x, y]) => fillP(c, () => c.arc(x, y, 1.6, 0, TAU), '#e8ecf0'));
    part(c, () => c.arc(4, -50, 6, 0, TAU), rg(c, p, 4, -50, 6, brass), 1.3);
    c.strokeStyle = '#6b5420'; c.lineWidth = 1; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + t * .05; c.beginPath(); c.moveTo(4 + Math.cos(a) * 3, -50 + Math.sin(a) * 3); c.lineTo(4 + Math.cos(a) * 6.5, -50 + Math.sin(a) * 6.5); c.stroke(); }
  }
  const fl = limb2(c, p, 7, -24, p.legF * .7, 9, p.legF * .7 - p.kneeF, 9, 8, 7, steel);
  part(c, () => c.roundRect(fl[0] - 4, fl[1] - 4, 15, 7, 3), lg(c, p, 0, fl[1] - 4, 0, fl[1] + 3, brass), 1.5);
  // helmet + plume
  const pts = [];
  for (let i = 0; i < 6; i++) pts.push([-2 - i * 6, -88 - Math.sin(i * .5) * 8 + Math.sin(t * .12 - i * .7) * i * .7]);
  ribbon(c, p, pts, 8, 3, plume);
  part(c, () => c.roundRect(-14, -90, 30, 28, 11), lg(c, p, -14, -90, 16, -62, steel, .32));
  fillP(c, () => c.roundRect(1, -79, 15, 4, 2), p.flash ? '#fff' : '#0e1620');
  if (!p.flash) {
    const vc = f.state === 'hurt' || f.state === 'ko' ? '#ff6a5a' : blue;
    glow(c, 9, -77, 12, vc, .7);
    fillP(c, () => c.roundRect(3, -78.5, 11, 2, 1), vc);
    c.strokeStyle = 'rgba(40,50,60,.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(1, -70); c.lineTo(15, -70); c.stroke();
  }
  // shield on the far arm, held in front
  const sx = ba[0] + 10, sy = Math.min(-26, ba[1] - 4), big = f.state === 'block' || (f.state === 'skill' && f.sk === 2);
  part(c, () => c.ellipse(sx, sy, big ? 11 : 9, big ? 19 : 16, 0, 0, TAU), rg(c, p, sx, sy, 16, '#7b4b2a'), 1.8);
  part(c, () => c.ellipse(sx + 1, sy, big ? 7 : 6, big ? 14 : 12, 0, 0, TAU), rg(c, p, sx, sy, 12, brass), 1.2);
  const fa = limb2(c, p, 8, -52, p.armF, 10, p.armF + p.elbF, 10 + p.ext, 8, 7, steel);
  part(c, () => c.arc(fa[0], fa[1], 7.5, 0, TAU), rg(c, p, fa[0], fa[1], 7.5, brass), 1.6);
}

// ============ MAGMOR — lava golem (villain) ============
const MAG_BODY = [[-36, -100], [-10, -120], [22, -110], [38, -82], [34, -42], [18, -26], [-22, -24], [-40, -52]];
function drawMagmor(c, f, p, t) {
  const rock = '#3d3638', rockD = '#272224', lava = '#ff7a1a';
  const hot = .55 + Math.sin(t * .1) * .15 + (f.moltenT > 0 ? .45 : 0);
  if (f.moltenT > 0 && !p.flash) glow(c, 0, -70, 110, '#ff6a00', .35 + Math.sin(t * .3) * .08);
  const bl = limb2(c, p, -14, -34, p.legB * .5, 16, p.legB * .5 - p.kneeB, 16, 22, 20, rockD);
  part(c, () => c.ellipse(bl[0] + 4, bl[1], 15, 7, 0, 0, TAU), rg(c, p, bl[0] + 4, bl[1], 15, rockD));
  const ba = limb2(c, p, -18, -92, p.armB, 22, p.armB + p.elbB, 22, 18, 17, rockD);
  part(c, () => c.arc(ba[0], ba[1], 14, 0, TAU), rg(c, p, ba[0], ba[1], 14, rockD));
  part(c, () => { MAG_BODY.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); }, rg(c, p, -6, -84, 60, rock));
  // rock spikes on the back
  [[-28, -106, -.7], [-38, -80, -1.2]].forEach(([x, y, a]) => {
    c.save(); c.translate(x, y); c.rotate(a);
    part(c, () => { c.moveTo(-8, 2); c.lineTo(-2, -20); c.lineTo(8, 2); c.closePath(); }, lg(c, p, -8, -20, 8, 2, rock), 1.8);
    c.restore();
  });
  if (!p.flash) {
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 2;
    [[[-20, -110], [-6, -80], [-26, -60]], [[20, -104], [10, -76], [28, -56]], [[-30, -44], [0, -50], [24, -36]]].forEach(seam => { c.beginPath(); seam.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); });
    // glowing cracks
    c.save(); c.globalCompositeOperation = 'lighter';
    const cracks = [[[-14, -96], [-4, -82], [-12, -70], [0, -60]], [[16, -94], [8, -80], [16, -66]], [[-24, -48], [-10, -40], [6, -44], [20, -34]]];
    [[lava, 7, .3 * hot], ['#ffd27a', 2.5, hot]].forEach(([color, w, a]) => {
      c.strokeStyle = color; c.lineWidth = w; c.globalAlpha = Math.min(1, a); c.lineCap = 'round'; c.lineJoin = 'round';
      cracks.forEach(cr => { c.beginPath(); cr.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); });
    });
    c.restore();
    glow(c, 4, -62, 22, lava, .6 * hot);
    // dripping lava
    for (let i = 0; i < 2; i++) {
      const ph = (t * .02 + i * .5) % 1;
      fillP(c, () => c.ellipse(-10 + i * 26, -30 + ph * 26, 2.2, 3.2, 0, 0, TAU), `rgba(255,150,40,${1 - ph})`);
    }
  }
  const fl = limb2(c, p, 12, -32, p.legF * .5, 16, p.legF * .5 - p.kneeF, 16, 22, 20, rock);
  part(c, () => c.ellipse(fl[0] + 6, fl[1], 16, 7, 0, 0, TAU), rg(c, p, fl[0] + 6, fl[1], 16, rock));
  // head
  part(c, () => { c.moveTo(14, -112); c.lineTo(34, -118); c.lineTo(44, -102); c.lineTo(38, -88); c.lineTo(18, -90); c.closePath(); }, rg(c, p, 26, -108, 18, rock));
  if (!p.flash) {
    glowEyes(c, p, [[30, -106], [39, -104]], '#ffb347', 3, 1.6);
    if (p.eyes !== 'x') {
      c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#ff9a3a'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(24, -95); c.lineTo(28, -92); c.lineTo(32, -95); c.lineTo(36, -92); c.lineTo(40, -95); c.stroke(); c.restore();
    }
  }
  const fa = limb2(c, p, 14, -92, p.armF, 22, p.armF + p.elbF, 22 + p.ext, 19, 18, rock);
  part(c, () => c.arc(fa[0], fa[1], 15.5, 0, TAU), rg(c, p, fa[0], fa[1], 15.5, rock));
  if (!p.flash) glow(c, fa[0], fa[1], 14, lava, .35 * hot);
}

// ============ MORWEN — raven witch (villain / magic) ============
function drawMorwen(c, f, p, t) {
  const dress = '#2b2236', feather = '#1c1a26', skin = '#e8dcd6', hat = '#221b2b', hair = '#151018', wood = '#5a4030', straw = '#c9a85a';
  const sway = Math.sin(t * (f.state === 'run' ? .22 : .05)) * (f.state === 'run' ? 3 : 1.2);
  const riding = f.state === 'skill' && f.sk === 1;
  for (let i = 0; i < 3; i++) {
    const pts = [];
    for (let k = 0; k < 6; k++) pts.push([-4 - k * (3 + i), -86 + k * 9 + Math.sin(t * .07 - k * .6 + i) * k * .5]);
    ribbon(c, p, pts, 7 - i, 2, hair);
  }
  const ba = limb2(c, p, -6, -70, p.armB, 13, p.armB + p.elbB, 12, 6, 5, dress);
  fillP(c, () => c.arc(ba[0], ba[1], 3, 0, TAU), col(p, skin));
  if (riding) {
    part(c, () => { c.moveTo(-10, -56); c.lineTo(10, -56); c.lineTo(16, -30); c.lineTo(-18, -30); c.closePath(); }, lg(c, p, -18, -56, 16, -30, dress, .25));
  } else {
    const dressPath = () => {
      c.moveTo(-9, -58); c.quadraticCurveTo(-14, -30, -20 - sway * .5, -4);
      for (let i = 1; i <= 6; i++) c.lineTo(-20 - sway * .5 + i * (42 / 6), -4 - (i % 2 ? 5 : 0));
      c.quadraticCurveTo(14, -30, 9, -58); c.closePath();
    };
    part(c, dressPath, lg(c, p, -20, -58, 22, 0, dress, .25));
    if (!p.flash) {
      c.save(); c.beginPath(); dressPath(); c.clip();
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 2;
      [-8, 2, 10].forEach(x => { c.beginPath(); c.moveTo(x * .4, -54); c.quadraticCurveTo(x + sway * .3, -28, x * 1.3, -2); c.stroke(); });
      c.restore();
    }
    part(c, () => { c.moveTo(-8 + p.legB * 3, 0); c.lineTo(2 + p.legB * 3, 0); c.lineTo(6 + p.legB * 3, -3); c.lineTo(-6 + p.legB * 3, -5); c.closePath(); }, col(p, '#1a1420'), 1.3);
    part(c, () => { c.moveTo(4 + p.legF * 3, 0); c.lineTo(16 + p.legF * 3, -1); c.lineTo(10 + p.legF * 3, -5); c.lineTo(4 + p.legF * 3, -5); c.closePath(); }, col(p, '#1a1420'), 1.3);
  }
  // feather shawl
  for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
    const x = -13 + i * 5.2, y = -70 + row * 8 + Math.abs(i - 2.5) * 1.2;
    c.save(); c.translate(x, y); c.rotate(.2 + (i - 2.5) * .08);
    part(c, () => c.ellipse(0, 4, 3.6, 8, 0, 0, TAU), lg(c, p, -3, -4, 3, 12, feather, .35), 1);
    if (!p.flash) { c.strokeStyle = 'rgba(110,140,220,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-1, -2); c.lineTo(-1, 9); c.stroke(); }
    c.restore();
  }
  // head
  part(c, () => c.ellipse(4, -82, 8.5, 10, .05, 0, TAU), rg(c, p, 2, -85, 10, skin));
  fillP(c, () => { c.moveTo(11.5, -84); c.lineTo(14, -80); c.lineTo(11, -79); c.closePath(); }, col(p, shade(skin, -.12)));
  realEye(c, p, 8, -84, 3, 2.4, '#6bd66b');
  brows(c, p, [[8, -88, 3.5]], hair);
  fillP(c, () => c.ellipse(9, -76, 2.6, 1.2, 0, 0, TAU), col(p, '#5a1a3a'));
  part(c, () => { c.moveTo(-6, -84); c.quadraticCurveTo(0, -94, 12, -88); c.quadraticCurveTo(4, -88, -6, -80); c.closePath(); }, col(p, hair), 1.2);
  // hat
  part(c, () => c.ellipse(2, -90, 21, 4.5, -.05, 0, TAU), lg(c, p, -19, -95, 23, -86, hat, .3));
  part(c, () => { c.moveTo(-9, -91); c.lineTo(10, -92); c.lineTo(-2, -120); c.closePath(); }, lg(c, p, -9, -120, 10, -91, hat, .3));
  part(c, () => { c.moveTo(-2, -120); c.quadraticCurveTo(-10, -126, -18, -121); c.lineTo(-4, -114); c.closePath(); }, col(p, hat), 1.5);
  part(c, () => c.roundRect(-9, -96, 19, 4, 1), col(p, '#6b3fa0'), 1.2);
  // raven on the shoulder
  if (!riding) {
    part(c, () => c.ellipse(-12, -76, 6, 4.5, -.3, 0, TAU), lg(c, p, -18, -80, -6, -72, '#16141c', .4), 1.2);
    part(c, () => c.arc(-8, -80, 3.4, 0, TAU), col(p, '#16141c'), 1.2);
    fillP(c, () => { c.moveTo(-5, -81); c.lineTo(0, -80); c.lineTo(-5, -79); c.closePath(); }, col(p, '#8a8590'));
    fillP(c, () => c.arc(-7.5, -81, .9, 0, TAU), '#ffd84a');
  }
  // broom in hand
  const fa = limb2(c, p, 6, -70, p.armF, 13, p.armF + p.elbF, 12 + p.ext * .3, 6, 5, dress);
  const sa = riding ? 1.68 : p.staffA, dx = Math.sin(sa), dy = -Math.cos(sa);
  const bx = riding ? 0 : fa[0], by = riding ? -30 : fa[1];
  seg(c, p, bx - dx * 40, by - dy * 40, bx + dx * 34, by + dy * 34, 3, wood);
  const ex = bx - dx * 40, ey = by - dy * 40;
  part(c, () => { c.moveTo(ex + dy * 3, ey - dx * 3); c.lineTo(ex - dx * 20 + dy * 9, ey - dy * 20 - dx * 9); c.lineTo(ex - dx * 20 - dy * 9, ey - dy * 20 + dx * 9); c.lineTo(ex - dy * 3, ey + dx * 3); c.closePath(); }, lg(c, p, ex - 10, ey - 10, ex + 10, ey + 10, straw), 1.4);
  fillP(c, () => c.arc(fa[0], fa[1], 3, 0, TAU), col(p, skin));
  if (p.glow > 0 && !p.flash) glow(c, fa[0] + 6, fa[1] - 4, 16 + p.glow * 14, '#9bff7a', .55 * p.glow);
}

// ============ NIGHTWEAVER — floating wraith (villain) ============
function drawNightweaver(c, f, p, t) {
  const cloak = '#2b2440', trim = '#7d63b8', bone = '#d6cfbf';
  const hover = f.state === 'ko' ? 0 : -8 + Math.sin(t * .07) * 4;
  c.translate(0, hover);
  if (!p.flash && f.state !== 'ko') for (let i = 0; i < 4; i++) {
    const ph = (t * .025 + i / 4) % 1;
    c.save(); c.globalAlpha *= (1 - ph) * .45;
    fillP(c, () => c.ellipse(-16 + i * 11, 2 + ph * 12, 10 * (1 - ph) + 3, 4 * (1 - ph) + 2, 0, 0, TAU), '#6b55a0');
    c.restore();
  }
  const ba = limb2(c, p, -6, -80, p.armB, 17, p.armB + p.elbB, 17, 4.5, 3.5, shade(bone, -.25));
  claws(c, p, ba[0], ba[1], p.armB + p.elbB, shade(bone, -.2));
  const cloakPath = () => {
    c.moveTo(-8, -112);
    c.quadraticCurveTo(12, -126, 22, -100);
    c.quadraticCurveTo(32, -56, 26, -6);
    for (let i = 1; i <= 6; i++) c.lineTo(26 - i * (52 / 6), -6 - (i % 2 ? 10 : 0) + Math.sin(t * .15 + i * 1.3) * 3);
    c.quadraticCurveTo(-30, -60, -20, -104);
    c.lineTo(-32, -124);
    c.closePath();
  };
  part(c, cloakPath, lg(c, p, -30, -124, 30, 0, cloak, .3));
  if (!p.flash) {
    c.save(); c.beginPath(); cloakPath(); c.clip();
    c.strokeStyle = 'rgba(8,4,14,.55)'; c.lineWidth = 3;
    [-14, -4, 8, 18].forEach(x => { c.beginPath(); c.moveTo(x * .5, -96); c.quadraticCurveTo(x + Math.sin(t * .05 + x) * 3, -50, x, -4); c.stroke(); });
    c.strokeStyle = 'rgba(170,150,220,.16)'; c.lineWidth = 2;
    [-10, 2, 13].forEach(x => { c.beginPath(); c.moveTo(x * .5 + 2, -96); c.quadraticCurveTo(x + 2, -50, x + 2, -8); c.stroke(); });
    const g = c.createLinearGradient(0, -40, 0, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)');
    c.fillStyle = g; c.fillRect(-40, -40, 80, 40);
    c.restore();
  }
  c.strokeStyle = col(p, trim); c.lineWidth = 2.5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(18, -96); c.quadraticCurveTo(28, -56, 22, -12); c.stroke();
  fillP(c, () => c.ellipse(9, -97, 11, 13, .1, 0, TAU), p.flash ? '#fff' : (() => {
    const g = c.createRadialGradient(9, -97, 1, 9, -97, 13); g.addColorStop(0, '#000'); g.addColorStop(1, '#1c1528'); return g;
  })());
  glowEyes(c, p, [[6, -99], [14, -98]], '#7dffd0', 2.8, 1.8);
  part(c, () => { c.moveTo(8, -78); c.lineTo(13, -71); c.lineTo(8, -64); c.lineTo(3, -71); c.closePath(); }, lg(c, p, 3, -78, 13, -64, '#a77bff'), 1.5);
  if (!p.flash) glow(c, 8, -71, 10, '#b48cff', .5);
  const fa = limb2(c, p, 6, -78, p.armF, 16, p.armF + p.elbF, 16 + p.ext, 4.5, 3.5, bone);
  claws(c, p, fa[0], fa[1], p.armF + p.elbF, bone);
  // sleeve
  part(c, () => { c.moveTo(0, -84); c.quadraticCurveTo(6 + Math.sin(p.armF) * 14, -80 + Math.cos(p.armF) * 14, 12, -72); c.lineTo(2, -70); c.closePath(); }, lg(c, p, 0, -84, 12, -70, cloak), 1.5);
}

// ============ LUMINA — elven light mage (cute / magic) ============
function drawLumina(c, f, p, t) {
  const robe = '#ece7f6', robeD = '#a99fcf', gold = '#d6b25a', skin = '#efcdb4', hair = '#efe0b0', wood = '#7a5a3a', crys = '#7fe8ff';
  const run = f.state === 'run', sway = Math.sin(t * (run ? .22 : .05)) * (run ? 4 : 1.5);
  // light wings (skill E)
  if (f.state === 'skill' && f.sk === 1 && !p.flash) {
    [[-1, 1], [-.6, .8]].forEach(([a, s]) => {
      c.save(); c.translate(-4, -70); c.rotate(a + Math.sin(t * .4) * .2); c.globalAlpha *= .55;
      fillP(c, () => c.ellipse(-18 * s, -10, 30 * s, 10 * s, -.4, 0, TAU), '#bff6ff');
      c.restore();
    });
    glow(c, -10, -70, 50, '#9ff3ff', .5);
  }
  for (let i = 0; i < 3; i++) {
    const pts = [];
    for (let k = 0; k < 6; k++) pts.push([-2 - k * (4 + i), -92 + k * (8 + i * 2) + Math.sin(t * .08 - k * .6 + i) * k * .6 - sway * k * .1]);
    ribbon(c, p, pts, 8 - i, 2, i ? shade(hair, -.12) : hair);
  }
  const ba = limb2(c, p, -6, -72, p.armB, 13, p.armB + p.elbB, 12, 7, 6, robeD);
  fillP(c, () => c.arc(ba[0], ba[1], 3.5, 0, TAU), col(p, skin));
  const robePath = () => {
    c.moveTo(-11, -74);
    c.quadraticCurveTo(-16, -48, -22 - sway * .5, -3);
    c.quadraticCurveTo(0, 1 + sway * .3, 20 + sway * .5, -3);
    c.quadraticCurveTo(15, -48, 11, -74);
    c.closePath();
  };
  part(c, robePath, lg(c, p, -22, -80, 22, 0, robe, .22));
  if (!p.flash) {
    c.save(); c.beginPath(); robePath(); c.clip();
    c.strokeStyle = 'rgba(120,105,170,.35)'; c.lineWidth = 2;
    [-12, -3, 8, 15].forEach(x => { c.beginPath(); c.moveTo(x * .4, -66); c.quadraticCurveTo(x + sway * .3, -36, x * 1.2 + sway * .5, 0); c.stroke(); });
    c.restore();
    c.strokeStyle = gold; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-22 - sway * .5, -4); c.quadraticCurveTo(0, 0 + sway * .3, 20 + sway * .5, -4); c.stroke();
    c.lineWidth = 1.5; c.beginPath(); c.moveTo(3, -70); c.lineTo(3 + sway * .4, -5); c.stroke();
  }
  part(c, () => c.roundRect(-12, -56, 24, 6, 3), lg(c, p, 0, -56, 0, -50, gold), 1.4);
  part(c, () => c.ellipse(-6 + p.legB * 4, -1, 6, 3, 0, 0, TAU), col(p, '#7a5a40'), 1.4);
  part(c, () => c.ellipse(9 + p.legF * 4, -1, 6.5, 3, 0, 0, TAU), col(p, '#8a6a4a'), 1.4);
  seg(c, p, 2, -74, 3, -80, 6, skin);
  part(c, () => { c.moveTo(-3, -90); c.lineTo(-14, -100); c.lineTo(-1, -84); c.closePath(); }, rg(c, p, -6, -92, 8, skin), 1.5);
  part(c, () => c.ellipse(4, -88, 10, 12, .1, 0, TAU), rg(c, p, 2, -91, 12, skin));
  fillP(c, () => { c.moveTo(13, -91); c.lineTo(16, -86); c.lineTo(12, -85); c.closePath(); }, col(p, shade(skin, -.12)));
  realEye(c, p, 9, -90, 3.2, 2.7, '#4a7fc9');
  brows(c, p, [[9, -95, 3.5]], '#b89a5a');
  c.strokeStyle = OUTC; c.lineWidth = 1.4; c.beginPath(); c.moveTo(8, -81); c.lineTo(11, -81.5); c.stroke();
  part(c, () => { c.moveTo(-8, -91); c.quadraticCurveTo(0, -105, 13, -96); c.quadraticCurveTo(9, -94, 6, -93); c.quadraticCurveTo(2, -97, -8, -89); c.closePath(); }, lg(c, p, -8, -105, 13, -89, hair), 1.5);
  c.strokeStyle = col(p, gold); c.lineWidth = 1.8; c.beginPath(); c.ellipse(3, -92, 11, 5, .1, Math.PI * 1.1, Math.PI * 1.95); c.stroke();
  fillP(c, () => c.arc(12, -95, 1.8, 0, TAU), col(p, crys));
  // front arm + staff
  const fa = limb2(c, p, 6, -72, p.armF, 13, p.armF + p.elbF, 12 + p.ext * .3, 7, 6, robe);
  const sa = p.staffA, dx = Math.sin(sa), dy = -Math.cos(sa);
  const tx = fa[0] + dx * 50, ty = fa[1] + dy * 50;
  seg(c, p, fa[0] - dx * 34, fa[1] - dy * 34, tx, ty, 3.5, wood);
  part(c, () => { c.moveTo(tx + dx * 14, ty + dy * 14); c.lineTo(tx - dy * 6, ty + dx * 6); c.lineTo(tx - dx * 2, ty - dy * 2); c.lineTo(tx + dy * 6, ty - dx * 6); c.closePath(); }, lg(c, p, tx - 6, ty - 14, tx + 6, ty, crys, .4), 1.4);
  if (!p.flash) glow(c, tx + dx * 5, ty + dy * 5, 18 + p.glow * 22, '#9ff3ff', .45 + p.glow * .5 + Math.sin(t * .1) * .08);
  fillP(c, () => c.arc(fa[0], fa[1], 3.6, 0, TAU), col(p, skin));
}


// ============ SABLE — ninja cat (cute / cool) ============
function drawSable(c, f, p, t) {
  const fur = '#2c2c34', garb = '#353a56', scarf = '#d23b3b', eye = '#ffd84a', steel = '#dfe6ee';
  const fast = f.state === 'run' || !f.onGround;
  const tail = [];
  for (let i = 0; i < 7; i++) tail.push([-8 - i * 4, -30 - i * 5 + Math.sin(t * .1 - i * .7) * i * 1.2]);
  ribbon(c, p, tail, 6, 3, fur);
  const sc = [];
  for (let i = 0; i < 9; i++) sc.push([-6 - i * 7, -58 + i * 1.5 + Math.sin(t * (fast ? .3 : .12) - i * .8) * i * .8]);
  ribbon(c, p, sc, 7, 2, scarf);
  const armed = f.state === 'attack' || (f.state === 'skill' && f.sk === 1);
  if (!armed) {
    seg(c, p, -14, -66, 10, -32, 4, '#1b1b22');
    fillP(c, () => c.arc(-12, -63, 3, 0, TAU), col(p, scarf));
  }
  const bl = limb2(c, p, -5, -28, p.legB, 12, p.legB - p.kneeB, 13, 7, 6, garb);
  part(c, () => c.ellipse(bl[0] + 3, bl[1], 5.5, 3, 0, 0, TAU), col(p, '#1b1b22'), 1.3);
  const ba = limb2(c, p, -6, -52, p.armB, 11, p.armB + p.elbB, 11, 6, 5, garb);
  fillP(c, () => c.arc(ba[0], ba[1], 3.6, 0, TAU), col(p, fur));
  part(c, () => c.ellipse(0, -42, 12, 17, 0, 0, TAU), lg(c, p, -12, -58, 12, -26, garb, .3));
  if (!p.flash) { c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; [-50, -44, -38].forEach(y => { c.beginPath(); c.moveTo(-9, y); c.lineTo(9, y + 3); c.stroke(); }); }
  part(c, () => c.roundRect(-12, -36, 24, 5, 2), lg(c, p, 0, -36, 0, -31, scarf), 1.3);
  const fl = limb2(c, p, 5, -28, p.legF, 12, p.legF - p.kneeF, 13, 7, 6, garb);
  part(c, () => c.ellipse(fl[0] + 3, fl[1], 6, 3, 0, 0, TAU), col(p, '#1b1b22'), 1.3);
  // head
  part(c, () => { c.moveTo(-6, -74); c.lineTo(-8, -90); c.lineTo(3, -78); c.closePath(); }, col(p, fur), 1.5);
  part(c, () => { c.moveTo(6, -77); c.lineTo(11, -92); c.lineTo(15, -75); c.closePath(); }, col(p, fur), 1.5);
  fillP(c, () => { c.moveTo(8, -78); c.lineTo(11, -88); c.lineTo(13, -77); c.closePath(); }, col(p, '#6a4050'));
  part(c, () => c.arc(4, -68, 12.5, 0, TAU), rg(c, p, 2, -71, 13, fur));
  part(c, () => { c.moveTo(-8, -66); c.quadraticCurveTo(8, -70, 18, -65); c.quadraticCurveTo(16, -56, 4, -55); c.quadraticCurveTo(-6, -57, -8, -66); c.closePath(); }, lg(c, p, -8, -70, 18, -55, garb, .25), 1.4);
  if (!p.flash) { c.strokeStyle = 'rgba(220,220,230,.6)'; c.lineWidth = .8; [[16, -64, 24, -66], [16, -62, 24, -61]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); }); }
  if (p.eyes === 'open') {
    [[9, -71, 3.6], [15.5, -71, 2.6]].forEach(([x, y, r]) => {
      fillP(c, () => c.ellipse(x, y, r, r * .8, 0, 0, TAU), col(p, eye));
      fillP(c, () => c.ellipse(x + .6, y, r * .22, r * .7, 0, 0, TAU), p.flash ? '#fff' : '#0b0a10');
    });
    if (!p.flash) glow(c, 11, -71, 10, eye, .25);
  } else realEye(c, p, 11, -71, 3.6, 2.6, eye);
  brows(c, p, [[11, -76, 5]], '#111');
  // front arm and katana
  const fa = limb2(c, p, 6, -52, p.armF, 11, p.armF + p.elbF, 11 + p.ext * .4, 6, 5, garb);
  if (armed) {
    const sa = f.state === 'skill' ? 2.4 : p.staffA, dx = Math.sin(sa), dy = -Math.cos(sa);
    const tx = fa[0] + dx * 46, ty = fa[1] + dy * 46;
    c.lineCap = 'round';
    c.strokeStyle = OUTC; c.lineWidth = 5; c.beginPath(); c.moveTo(fa[0] - dx * 8, fa[1] - dy * 8); c.lineTo(tx, ty); c.stroke();
    c.strokeStyle = col(p, '#7a1f24'); c.lineWidth = 3.4; c.beginPath(); c.moveTo(fa[0] - dx * 8, fa[1] - dy * 8); c.lineTo(fa[0] + dx * 4, fa[1] + dy * 4); c.stroke();
    c.strokeStyle = p.flash ? '#fff' : lg(c, p, fa[0], fa[1], tx, ty, steel, .2); c.lineWidth = 3; c.beginPath(); c.moveTo(fa[0] + dx * 6, fa[1] + dy * 6); c.lineTo(tx, ty); c.stroke();
    fillP(c, () => c.ellipse(fa[0] + dx * 5, fa[1] + dy * 5, 4, 1.6, sa, 0, TAU), col(p, '#c9a24a'));
  }
  fillP(c, () => c.arc(fa[0], fa[1], 3.8, 0, TAU), col(p, fur));
}

// ============ TUSK — walrus viking (cute / big) ============
function drawTusk(c, f, p, t) {
  const skin = '#8a6a58', skinD = '#6b4f40', belly = '#b9998a', steel = '#9aa1a8', horn = '#efe6d2', furC = '#d9cfc0', wood = '#6a4a30';
  part(c, () => { c.moveTo(-6, -84); c.quadraticCurveTo(-36, -70, -38 + Math.sin(t * .08) * 2, -16); c.lineTo(-18, -14); c.quadraticCurveTo(-16, -60, 6, -82); c.closePath(); }, lg(c, p, -38, -84, -6, -14, '#7a3d2c', .25));
  const bl = limb2(c, p, -12, -20, p.legB * .5, 8, p.legB * .5 - p.kneeB * .5, 8, 13, 12, skinD);
  part(c, () => c.ellipse(bl[0] + 4, bl[1], 11, 5, 0, 0, TAU), rg(c, p, bl[0] + 4, bl[1], 11, skinD));
  const ba = limb2(c, p, -14, -66, p.armB, 13, p.armB + p.elbB, 13, 12, 11, skinD);
  part(c, () => c.ellipse(ba[0], ba[1], 8, 6, p.armB, 0, TAU), rg(c, p, ba[0], ba[1], 8, skinD));
  part(c, () => c.ellipse(0, -46, 32, 36, 0, 0, TAU), rg(c, p, -4, -54, 38, skin));
  fillP(c, () => c.ellipse(8, -38, 20, 24, 0, 0, TAU), rg(c, p, 8, -42, 24, belly));
  if (!p.flash) { c.strokeStyle = 'rgba(80,50,40,.35)'; c.lineWidth = 1.2; [-48, -40, -32].forEach(y => { c.beginPath(); c.arc(8, y, 12, .4, Math.PI - .4); c.stroke(); }); }
  part(c, () => c.roundRect(-30, -28, 62, 8, 3), lg(c, p, 0, -28, 0, -20, '#4a3020'), 1.6);
  part(c, () => c.roundRect(4, -30, 13, 12, 3), lg(c, p, 4, -30, 17, -18, '#c9a24a'), 1.4);
  const fl = limb2(c, p, 12, -20, p.legF * .5, 8, p.legF * .5 - p.kneeF * .5, 8, 13, 12, skin);
  part(c, () => c.ellipse(fl[0] + 5, fl[1], 12, 5, 0, 0, TAU), rg(c, p, fl[0] + 5, fl[1], 12, skin));
  // fur collar
  for (let i = 0; i < 7; i++) part(c, () => c.arc(-16 + i * 5.5, -76 + Math.abs(i - 3) * 1.6, 5, 0, TAU), rg(c, p, -16 + i * 5.5, -78, 5, furC), 1.2);
  // head
  part(c, () => c.ellipse(14, -84, 20, 16, 0, 0, TAU), rg(c, p, 10, -88, 20, skin));
  part(c, () => { c.moveTo(22, -74); c.quadraticCurveTo(25, -60, 22, -48); c.lineTo(26, -50); c.quadraticCurveTo(30, -62, 27, -74); c.closePath(); }, lg(c, p, 22, -74, 30, -48, '#fffaf0', .2), 1.4);
  part(c, () => { c.moveTo(30, -74); c.quadraticCurveTo(34, -62, 31, -50); c.lineTo(35, -52); c.quadraticCurveTo(38, -63, 35, -75); c.closePath(); }, lg(c, p, 30, -75, 38, -50, '#fffaf0', .2), 1.4);
  part(c, () => c.ellipse(25, -78, 9, 6.5, 0, 0, TAU), rg(c, p, 25, -79, 9, '#a88472'), 1.4);
  part(c, () => c.ellipse(33, -78, 7, 5.5, 0, 0, TAU), rg(c, p, 33, -79, 7, '#a88472'), 1.4);
  if (!p.flash) { c.fillStyle = 'rgba(60,40,30,.6)'; for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(21 + (i % 4) * 4, -79 + Math.floor(i / 4) * 3, .9, 0, TAU); c.fill(); } }
  fillP(c, () => c.ellipse(34, -85, 4, 2.6, 0, 0, TAU), col(p, '#2a1a18'));
  realEye(c, p, 20, -90, 3, 3, '#2b1d16');
  brows(c, p, [[20, -95, 5]], '#4a3328');
  // helmet with horns
  part(c, () => { c.moveTo(-1, -95); c.quadraticCurveTo(-8, -112, -4, -122); c.quadraticCurveTo(0, -110, 5, -99); c.closePath(); }, lg(c, p, -8, -122, 5, -95, horn), 1.5);
  part(c, () => { c.moveTo(22, -99); c.quadraticCurveTo(28, -112, 34, -118); c.quadraticCurveTo(32, -106, 28, -95); c.closePath(); }, lg(c, p, 22, -118, 34, -95, horn), 1.5);
  part(c, () => { c.arc(13, -94, 15, Math.PI, 0); c.closePath(); }, rg(c, p, 10, -100, 15, steel));
  part(c, () => c.roundRect(-3, -96, 32, 5, 2), lg(c, p, 0, -96, 0, -91, '#7a8088'), 1.3);
  // front arm with harpoon
  const fa = limb2(c, p, 12, -66, p.armF, 13, p.armF + p.elbF, 13 + p.ext * .3, 12, 11, skin);
  const thrown = f.state === 'skill' && f.sk === 1 && f.st >= 8;
  if (!thrown) {
    const sa = p.staffA, dx = Math.sin(sa), dy = -Math.cos(sa);
    seg(c, p, fa[0] - dx * 30, fa[1] - dy * 30, fa[0] + dx * 40, fa[1] + dy * 40, 3, wood);
    const hx = fa[0] + dx * 40, hy = fa[1] + dy * 40;
    part(c, () => { c.moveTo(hx + dx * 14, hy + dy * 14); c.lineTo(hx - dy * 5, hy + dx * 5); c.lineTo(hx + dy * 5, hy - dx * 5); c.closePath(); }, lg(c, p, hx - 5, hy - 5, hx + 5, hy + 5, '#b8c0c8'), 1.3);
  }
  part(c, () => c.ellipse(fa[0], fa[1], 8, 6.5, p.armF, 0, TAU), rg(c, p, fa[0], fa[1], 8, skin));
}

// ============ the roster ============
// moves: melee combo (jab1 -> jab2 -> fin). f = [startup, active, recovery] frames.
// skills: three extra attacks (Q/E/R for player 1). Their code lives in game.js (SKILLS).
const CHARS = [
  {
    id: 'kitsu', name: 'KITSU', title: 'Fox spirit trickster',
    hp: 94, w: 38, h: 82, speed: 4.9, jump: 11, jumps: 2, grav: .55, maxFall: 10, weight: .8,
    reach: 8, shoulder: [6, -50], trail: '#9fe6ff',
    stats: { power: 2, speed: 4, jump: 4, magic: 4 },
    moves: {
      jab1: { f: [4, 3, 9], dmg: 4, kb: [1.5, -1], box: { x: 10, y: -62, w: 42, h: 30 }, anim: 'punch', next: 'jab2' },
      jab2: { f: [4, 3, 10], dmg: 4, kb: [1.5, -1], box: { x: 8, y: -42, w: 46, h: 32 }, anim: 'kick', next: 'fin' },
      fin: { f: [7, 5, 14], dmg: 8, kb: [6, -6], box: { x: -38, y: -90, w: 96, h: 86 }, anim: 'spin', cd: 28 },
    },
    skills: [
      { name: 'Foxfire', desc: 'Three spirit flames circle around you.', cd: 180 },
      { name: 'Tail Vault', desc: 'Backflip high into the air.', cd: 35, air: true },
      { name: 'Mirage', desc: 'Leave a decoy that explodes and dash ahead.', cd: 150 },
    ],
    draw: drawKitsu,
    pose(p, f) {
      if (f.state !== 'skill') return;
      if (f.sk === 0) ANIMS.cast(p, f.st < 8 ? 0 : f.st < 14 ? 1 : 2, f.st < 8 ? f.st / 8 : f.st < 14 ? (f.st - 8) / 6 : Math.min(1, (f.st - 14) / 8), this);
      if (f.sk === 1) { p.spin = -f.st * .32; p.legF = .9; p.kneeF = 1.3; p.armF = 2; p.armB = -2; }
      if (f.sk === 2 && f.st < 12) { p.alpha = .3; p.lean = .5; p.armF = -1.2; p.armB = -1.4; }
    },
  },
  {
    id: 'rook', name: 'ROOK', title: 'Little clockwork knight',
    hp: 105, w: 42, h: 76, speed: 3.6, jump: 10.5, jumps: 2, grav: .7, maxFall: 13, weight: 1.25,
    reach: 8, shoulder: [8, -52], trail: '#bfe9ff',
    stats: { power: 3, speed: 2, jump: 3, magic: 1 },
    moves: {
      jab1: { f: [5, 3, 9], dmg: 5, kb: [2, -1], box: { x: 12, y: -64, w: 38, h: 28 }, anim: 'punch', next: 'jab2' },
      jab2: { f: [5, 3, 10], dmg: 5, kb: [2, -1], box: { x: 10, y: -66, w: 38, h: 40 }, anim: 'punch2', next: 'fin' },
      fin: { f: [10, 4, 16], dmg: 10, kb: [7, -6], box: { x: 6, y: -100, w: 52, h: 96 }, anim: 'slam', cd: 30 },
    },
    skills: [
      { name: 'Rocket Fist', desc: 'Fire your fist straight ahead.', cd: 100 },
      { name: 'Jet Boost', desc: 'Fly with your jetpack. Steer left and right.', cd: 50, air: true },
      { name: 'Shield Bash', desc: 'Charge with your shield. Bounces shots back.', cd: 110 },
    ],
    draw: drawRook,
    pose(p, f) {
      if (f.state !== 'skill') return;
      if (f.sk === 0) { if (f.st < 8) { p.armF = -.5; p.elbF = 1.6; p.lean = -.1; } else { p.armF = 1.55; p.elbF = 0; p.lean = .1; } }
      if (f.sk === 1) { p.legF = .5; p.kneeF = 1; p.legB = .3; p.kneeB = 1; p.armF = -.5; p.armB = -.7; }
      if (f.sk === 2) { p.lean = .3; p.armB = 1.4; p.elbB = .3; p.armF = -.5; p.legF = .6; p.legB = -.6; }
    },
  },
  {
    id: 'magmor', name: 'MAGMOR', title: 'Living lava golem',
    hp: 112, w: 68, h: 122, speed: 2.8, jump: 11, jumps: 2, grav: .72, maxFall: 14, weight: 1.45,
    reach: 6, shoulder: [14, -92], trail: '#ff8a3a',
    stats: { power: 5, speed: 1, jump: 2, magic: 3 },
    moves: {
      jab1: { f: [6, 3, 11], dmg: 3, kb: [2, -1], box: { x: 16, y: -100, w: 52, h: 46 }, anim: 'punch', next: 'jab2' },
      jab2: { f: [6, 3, 11], dmg: 3, kb: [2, -1], box: { x: 16, y: -100, w: 52, h: 46 }, anim: 'punch2', next: 'fin' },
      fin: { f: [14, 5, 20], dmg: 11, kb: [9, -6], box: { x: 10, y: -140, w: 78, h: 134 }, anim: 'slam', armor: true, cd: 34 },
    },
    skills: [
      { name: 'Magma Toss', desc: 'Lob lava that leaves a burning pool.', cd: 120 },
      { name: 'Eruption', desc: 'A fire pillar launches you upward.', cd: 55, air: true },
      { name: 'Molten Core', desc: 'Small hits cannot stop you, and touching you burns.', cd: 420 },
    ],
    draw: drawMagmor,
    pose(p, f) {
      if (f.state !== 'skill') return;
      if (f.sk === 0) { if (f.st < 14) { p.armF = -2.6; p.elbF = .6; p.lean = -.15; } else { p.armF = 1.9; p.elbF = .1; p.lean = .15; } }
      if (f.sk === 1) { p.armF = 2.8; p.armB = -2.8; p.elbF = .2; p.elbB = .2; p.legF = .7; p.kneeF = 1; }
      if (f.sk === 2) { p.armF = 1.3; p.armB = -1.3; p.elbF = -1.2; p.elbB = 1.2; p.sy = 1.05; p.brow = 1; }
    },
  },
  {
    id: 'morwen', name: 'MORWEN', title: 'Witch of the ravens',
    hp: 96, w: 38, h: 106, speed: 3.8, jump: 10.5, jumps: 2, grav: .5, maxFall: 9, weight: .85,
    reach: 10, shoulder: [6, -70], trail: '#9bff7a',
    stats: { power: 3, speed: 3, jump: 3, magic: 5 },
    moves: {
      jab1: { f: [5, 3, 9], dmg: 4, kb: [1.5, -1], box: { x: 14, y: -80, w: 44, h: 32 }, anim: 'cast', next: 'jab2' },
      jab2: { f: [5, 3, 10], dmg: 5, kb: [1.5, -1], box: { x: 6, y: -96, w: 60, h: 60 }, anim: 'sweep', next: 'fin' },
      fin: { f: [9, 5, 15], dmg: 10, kb: [7, -4], box: { x: 12, y: -100, w: 68, h: 66 }, anim: 'cast', cd: 30 },
    },
    skills: [
      { name: 'Raven Call', desc: 'A raven flies out and comes back to you.', cd: 100 },
      { name: 'Broom Ride', desc: 'Fly on your broom the way you hold.', cd: 90, air: true },
      { name: 'Hex Circle', desc: 'A rune circle that hurts enemies inside it.', cd: 260 },
    ],
    draw: drawMorwen,
    pose(p, f) {
      if (f.state !== 'skill') return;
      if (f.sk === 0) ANIMS.cast(p, f.st < 9 ? 0 : f.st < 15 ? 1 : 2, f.st < 9 ? f.st / 9 : f.st < 15 ? (f.st - 9) / 6 : Math.min(1, (f.st - 15) / 7), this);
      if (f.sk === 1) { p.lean = .35; p.armF = 1.0; p.elbF = .6; p.armB = .9; p.elbB = .6; }
      if (f.sk === 2) { p.armF = 2.7; p.elbF = .1; p.staffA = 0; p.glow = Math.min(1, f.st / 16); p.armB = -2.4; }
    },
  },
  {
    id: 'nightweaver', name: 'NIGHTWEAVER', title: 'Wraith of the deep woods',
    hp: 88, w: 40, h: 112, speed: 3.9, jump: 10, jumps: 2, grav: .45, maxFall: 8, weight: .9,
    reach: 8, shoulder: [6, -86], trail: '#7dffd0',
    stats: { power: 3, speed: 3, jump: 4, magic: 3 },
    moves: {
      jab1: { f: [5, 3, 9], dmg: 4, kb: [1.5, -1], box: { x: 12, y: -104, w: 46, h: 44 }, anim: 'sweep', next: 'jab2' },
      jab2: { f: [5, 3, 9], dmg: 4, kb: [1.5, -1], box: { x: 12, y: -96, w: 46, h: 40 }, anim: 'punch2', next: 'fin' },
      fin: { f: [8, 4, 14], dmg: 9, kb: [7, -4], box: { x: 8, y: -112, w: 64, h: 72 }, anim: 'headbutt', cd: 28 },
    },
    skills: [
      { name: 'Shadow Snare', desc: 'A creeping shadow that roots enemies.', cd: 110 },
      { name: 'Shadow Step', desc: 'Teleport the way you hold. Up works too.', cd: 90, air: true },
      { name: 'Reaper Spin', desc: 'Whirl your claws, hitting many times.', cd: 80 },
    ],
    draw: drawNightweaver,
    pose(p, f) {
      if (f.state !== 'skill') return;
      if (f.sk === 0) ANIMS.cast(p, f.st < 10 ? 0 : f.st < 16 ? 1 : 2, f.st < 10 ? f.st / 10 : f.st < 16 ? (f.st - 10) / 6 : Math.min(1, (f.st - 16) / 8), this);
      if (f.sk === 1) p.alpha = f.st < 10 ? 1 - f.st / 10 * .9 : f.st < 20 ? .1 + (f.st - 10) / 10 * .9 : 1;
      if (f.sk === 2 && f.st >= 6 && f.st < 36) { p.spin = (f.st - 6) * .45; p.armF = 1.6; p.armB = -1.6; p.elbF = .1; p.elbB = .1; p.ext = 14; }
    },
  },
  {
    id: 'lumina', name: 'LUMINA', title: 'Elven light mage',
    hp: 96, w: 38, h: 102, speed: 3.8, jump: 10.5, jumps: 2, grav: .55, maxFall: 10, weight: .85,
    reach: 12, shoulder: [6, -72], trail: '#9ff3ff',
    stats: { power: 2, speed: 3, jump: 3, magic: 5 },
    moves: {
      jab1: { f: [4, 3, 9], dmg: 4, kb: [1.5, -1], box: { x: 12, y: -78, w: 56, h: 26 }, anim: 'punch', next: 'jab2' },
      jab2: { f: [4, 3, 9], dmg: 4, kb: [1.5, -1], box: { x: 12, y: -78, w: 56, h: 26 }, anim: 'punch', next: 'fin' },
      fin: { f: [7, 5, 14], dmg: 9, kb: [6, -5], box: { x: -36, y: -108, w: 104, h: 100 }, anim: 'spin', cd: 30 },
    },
    skills: [
      { name: 'Prism Bolt', desc: 'Fire a fast bolt of light.', cd: 90 },
      { name: 'Wings of Light', desc: 'Rise on glowing wings.', cd: 40, air: true },
      { name: 'Mend', desc: 'Heal 15 HP. Long cooldown.', cd: 900 },
    ],
    draw: drawLumina,
    pose(p, f) {
      if (f.state !== 'skill') return;
      if (f.sk === 0) ANIMS.cast(p, f.st < 9 ? 0 : f.st < 15 ? 1 : 2, f.st < 9 ? f.st / 9 : f.st < 15 ? (f.st - 9) / 6 : Math.min(1, (f.st - 15) / 7), this);
      if (f.sk === 1) { p.armF = 2.4; p.armB = -2.4; p.elbF = .2; p.elbB = .2; p.glow = .8; p.staffA = .3; }
      if (f.sk === 2) { p.armF = 2.6; p.elbF = .1; p.staffA = 0; p.glow = Math.min(1, f.st / 30); p.eyes = 'closed'; p.brow = 0; p.mouth = 'smile'; }
    },
  },
  {
    id: 'sable', name: 'SABLE', title: 'Shadow ninja cat',
    hp: 90, w: 36, h: 86, speed: 5.4, jump: 11.5, jumps: 2, grav: .6, maxFall: 11, weight: .75,
    reach: 6, shoulder: [6, -52], trail: '#ff7a7a',
    stats: { power: 3, speed: 5, jump: 4, magic: 1 },
    moves: {
      jab1: { f: [4, 3, 8], dmg: 4, kb: [1.5, -1], box: { x: 8, y: -84, w: 54, h: 54 }, anim: 'sweep', next: 'jab2' },
      jab2: { f: [4, 3, 9], dmg: 4, kb: [1.5, -1], box: { x: 8, y: -70, w: 56, h: 40 }, anim: 'punch', next: 'fin' },
      fin: { f: [6, 5, 14], dmg: 8, kb: [3, -9], box: { x: 0, y: -124, w: 56, h: 110 }, anim: 'uppercut', cd: 26 },
    },
    skills: [
      { name: 'Shuriken Fan', desc: 'Throw three stars in a fan.', cd: 100 },
      { name: 'Shadow Dash', desc: 'Dash the way you hold, cutting through enemies.', cd: 100, air: true },
      { name: 'Smoke Bomb', desc: 'Vanish in smoke. Your next attack hits harder.', cd: 300 },
    ],
    draw: drawSable,
    pose(p, f) {
      if (f.state !== 'skill') return;
      if (f.sk === 0) { if (f.st < 6) { p.armF = -1.4; p.elbF = 1.2; } else { p.armF = 1.6; p.elbF = 0; p.lean = .12; } }
      if (f.sk === 1) { p.lean = .55; p.armF = -1.3; p.armB = -1.5; p.legF = .8; p.kneeF = 1.2; p.legB = -.9; p.alpha = .55; }
      if (f.sk === 2) { p.sy = .85; p.sx = 1.1; p.armF = 1.2; p.elbF = 1.4; }
    },
  },
  {
    id: 'tusk', name: 'TUSK', title: 'Walrus viking',
    hp: 100, w: 60, h: 100, speed: 3.3, jump: 10.5, jumps: 2, grav: .7, maxFall: 13, weight: 1.4,
    reach: 6, shoulder: [12, -66], trail: '#bfe9ff',
    stats: { power: 4, speed: 2, jump: 2, magic: 1 },
    moves: {
      jab1: { f: [5, 3, 10], dmg: 4, kb: [2, -1], box: { x: 14, y: -76, w: 46, h: 40 }, anim: 'punch', next: 'jab2' },
      jab2: { f: [6, 3, 10], dmg: 5, kb: [2, -1], box: { x: 14, y: -84, w: 46, h: 50 }, anim: 'headbutt', next: 'fin' },
      fin: { f: [11, 5, 18], dmg: 11, kb: [8, -6], box: { x: 6, y: -124, w: 74, h: 120 }, anim: 'slam', cd: 32 },
    },
    skills: [
      { name: 'Belly Slide', desc: 'Slide forward on your belly.', cd: 100 },
      { name: 'Harpoon Hook', desc: 'Reel an enemy in, or hook a ledge. Hold up to aim up.', cd: 110, air: true },
      { name: 'Winter Horn', desc: 'A mighty blast that pushes everyone away.', cd: 200 },
    ],
    draw: drawTusk,
    pose(p, f) {
      if (f.state !== 'skill') return;
      if (f.sk === 0 && f.st >= 6) { p.lean = 1.35; p.legF = -1.2; p.legB = -1.4; p.armF = 1.9; p.armB = 1.7; }
      if (f.sk === 1) { if (f.st < 8) { p.armF = -2.4; p.elbF = .4; p.staffA = 1.2; } else { p.armF = 1.6; p.elbF = 0; } }
      if (f.sk === 2) { p.armF = 2.5; p.elbF = .8; p.lean = -.15; p.mouth = 'o'; p.eyes = 'closed'; }
    },
  },
];

const ANIMS = {
  punch(p, ph, q, C) {
    if (ph === 0) { p.armF = .3 - .6 * q; p.elbF = .5 + 1.2 * q; p.lean = -.06 * q; }
    else if (ph === 1) { p.armF = 1.5; p.elbF = 0; p.ext = C.reach; p.lean = .12; p.staffA = 1.5; }
    else { p.armF = 1.5 - 1.2 * q; p.elbF = .6 * q; p.ext = C.reach * (1 - q); p.lean = .12 * (1 - q); p.staffA = 1.5 - 1.35 * q; }
    p.legF = .35; p.legB = -.3; p.kneeF = .2; p.kneeB = .3;
  },
  punch2(p, ph, q) {
    p.armF = -.4; p.elbF = 1.4;
    if (ph === 0) { p.armB = -.3 - .4 * q; p.elbB = 1.5; p.lean = -.05 * q; }
    else if (ph === 1) { p.armB = 1.5; p.elbB = 0; p.lean = .16; }
    else { p.armB = 1.5 - 1.8 * q; p.elbB = .5; p.lean = .16 * (1 - q); }
    p.legF = .35; p.legB = -.3; p.kneeF = .2; p.kneeB = .3;
  },
  kick(p, ph, q) {
    p.armF = -.5; p.armB = .8;
    if (ph === 0) { p.legF = .9 * q; p.kneeF = 1.4 * q; p.lean = -.12 * q; }
    else if (ph === 1) { p.legF = 1.45; p.kneeF = 0; p.lean = -.22; }
    else { p.legF = 1.45 * (1 - q); p.kneeF = .6 * (1 - q); p.lean = -.22 * (1 - q); }
  },
  uppercut(p, ph, q) {
    if (ph === 0) { p.armF = .2; p.elbF = 1.4; p.sy = 1 - .1 * q; p.sx = 1 + .06 * q; p.kneeF = .6 * q; p.kneeB = .6 * q; }
    else if (ph === 1) { p.armF = .2 + 2.6 * q; p.elbF = .3; p.lean = -.12; p.sy = 1.08; p.sx = .95; p.staffA = -.2 + .6 * q; }
    else { p.armF = 2.8 - 2.5 * q; p.elbF = .3 + .2 * q; p.lean = -.12 * (1 - q); }
  },
  slam(p, ph, q) {
    if (ph === 0) { p.armF = .3 - 3.0 * q; p.armB = -.3 - 2.2 * q; p.elbF = .4; p.elbB = .4; p.lean = -.12 * q; }
    else if (ph === 1) { const k = Math.min(1, q * 1.6); p.armF = -2.7 + 3.8 * k; p.armB = -2.5 + 3.4 * k; p.elbF = .2; p.elbB = .2; p.ext = 6; p.lean = .22; }
    else { p.armF = 1.1 - .8 * q; p.armB = .9 - 1.2 * q; p.lean = .22 * (1 - q); }
  },
  sweep(p, ph, q, C) {
    if (ph === 0) p.armF = .3 - .8 * q;
    else if (ph === 1) { p.armF = .6 + 1.8 * q; p.elbF = .15; p.ext = C.reach; p.lean = .1; }
    else { p.armF = 2.4 - 2.1 * q; p.ext = C.reach * (1 - q); }
  },
  spin(p, ph, q) {
    p.legF = .9; p.kneeF = 1.2; p.legB = -.4; p.kneeB = 1.0;
    if (ph === 0) p.sy = .92;
    else if (ph === 1) { p.spin = q * TAU; p.armF = 1.6; p.armB = -1.6; p.elbF = .1; p.elbB = .1; p.staffA = q * TAU; }
  },
  headbutt(p, ph, q) {
    p.armF = -.9; p.armB = -1.1;
    if (ph === 0) { p.lean = -.22 * q; p.sy = 1 - .08 * q; }
    else if (ph === 1) { p.lean = .55; p.legF = .6; p.legB = -.7; }
    else p.lean = .55 * (1 - q);
  },
  cast(p, ph, q) {
    if (ph === 0) { p.armF = .3 - .7 * q; p.armB = -.3 - .4 * q; p.elbF = .9; p.glow = q * .6; }
    else if (ph === 1) { p.armF = 1.45; p.elbF = .1; p.armB = 1.25; p.elbB = .2; p.glow = 1; p.lean = .08; p.staffA = 1.2; }
    else { p.armF = 1.45 - 1.15 * q; p.armB = 1.25 - 1.55 * q; p.glow = 1 - q; p.staffA = 1.2 - 1.05 * q; }
  },
};

function computePose(f, t) {
  const C = CHARS[f.c];
  const p = { bob: 0, lean: 0, spin: 0, sx: 1, sy: 1, legF: 0, legB: 0, kneeF: 0, kneeB: 0, armF: .3, armB: -.3, elbF: .5, elbB: .5, ext: 0,
    eyes: 'open', brow: 0, mouth: 'smile', flash: f.flash > 0, alpha: 1, glow: 0, staffA: .15, trail: -1, mv: null };
  const st = f.st;
  switch (f.state) {
    case 'idle': {
      const b = Math.sin(t * .05 + f.c);
      p.sy = 1 + b * .02; p.sx = 1 - b * .015; p.armF = .3 + b * .06; p.armB = -.3 - b * .06; p.kneeF = .08; p.kneeB = .08;
      if ((t + f.c * 50) % 200 < 8) p.eyes = 'closed';
      break;
    }
    case 'run': {
      const ph = t * .22;
      p.legF = Math.sin(ph) * .8; p.legB = -p.legF;
      p.kneeF = .25 + Math.max(0, -Math.cos(ph)) * .9; p.kneeB = .25 + Math.max(0, Math.cos(ph)) * .9;
      p.bob = -Math.abs(Math.cos(ph)) * 3; p.lean = .12;
      p.armF = -Math.sin(ph) * .8; p.armB = Math.sin(ph) * .8; p.elbF = .9; p.elbB = .9; p.mouth = 'grin';
      break;
    }
    case 'air':
      if (f.vy < 0) { p.sy = 1.06; p.sx = .95; p.legF = .9; p.kneeF = 1.3; p.legB = -.3; p.kneeB = .6; p.armF = 2.2; p.armB = -2.2; p.elbF = .3; p.elbB = .3; }
      else { p.legF = .4; p.kneeF = .5; p.legB = -.2; p.kneeB = .4; p.armF = 1.2; p.armB = -1.4; }
      p.mouth = 'grin';
      break;
    case 'attack': {
      const mv = C.moves[f.move];
      if (mv) {
        const [S, A, R] = mv.f;
        let ph, q;
        if (st < S) { ph = 0; q = st / S; } else if (st < S + A) { ph = 1; q = (st - S) / A; } else { ph = 2; q = Math.min(1, (st - S - A) / R); }
        ANIMS[mv.anim](p, ph, q, C);
        p.trail = ph === 1 ? q : (ph === 2 && q < .35 ? 1 + q / .35 : -1);
        p.mv = mv;
      }
      p.brow = 1; p.mouth = 'grit';
      break;
    }
    case 'skill': p.brow = 1; p.mouth = 'grit'; break;
    case 'hurt': p.eyes = 'x'; p.mouth = 'o'; p.lean = -.25; p.armF = 2.3; p.armB = -2.3; p.elbF = .3; p.elbB = .3; break;
    case 'block': p.armF = 1.2; p.elbF = 1.6; p.armB = 1.0; p.elbB = 1.6; p.lean = -.1; p.brow = 1; p.mouth = 'grit'; p.sy = .95; p.kneeF = .4; p.kneeB = .4; break;
    case 'ko': p.eyes = 'x'; p.mouth = 'o'; p.lean = -Math.min(1.45, st * .06); break;
  }
  if (f.landT > 0) { p.sy *= 1 - f.landT * .025; p.sx *= 1 + f.landT * .02; }
  if (C.pose) C.pose(p, f, t);
  return p;
}

// motion trails for the combo
function crescent(c, x, y, r, a0, a1, k, color) {
  const prog = Math.min(1, k), span = a1 - a0;
  const end = a0 + span * prog, start = a0 + span * Math.max(0, prog - .75);
  if (Math.abs(end - start) < .02) return;
  const N = 14, outer = [], inner = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, a = start + (end - start) * u, th = 12 * Math.sin(Math.PI * u);
    outer.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    inner.push([x + Math.cos(a) * (r - th), y + Math.sin(a) * (r - th)]);
  }
  c.beginPath(); outer.forEach(([a, b], i) => i ? c.lineTo(a, b) : c.moveTo(a, b));
  for (let i = N; i >= 0; i--) c.lineTo(inner[i][0], inner[i][1]);
  c.closePath(); c.fillStyle = color; c.globalAlpha *= .7; c.fill();
  c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.beginPath(); outer.forEach(([a, b], i) => i ? c.lineTo(a, b) : c.moveTo(a, b)); c.stroke();
}
function drawTrail(c, C, p) {
  const mv = p.mv;
  if (!mv || p.trail < 0) return;
  const k = p.trail, alpha = k <= 1 ? .85 : .85 * (1 - (k - 1));
  if (alpha <= 0) return;
  const bx = mv.box.x + mv.box.w / 2, by = mv.box.y + mv.box.h / 2, [sx, sy] = C.shoulder;
  c.save(); c.globalAlpha *= alpha;
  switch (mv.anim) {
    case 'punch': case 'punch2': case 'headbutt': case 'kick':
      c.strokeStyle = C.trail; c.lineCap = 'round';
      for (let i = -1; i <= 1; i++) { c.lineWidth = 3 - Math.abs(i); c.beginPath(); c.moveTo(bx - 30 - Math.abs(i) * 6, by + i * 7); c.lineTo(bx - 4, by + i * 5); c.stroke(); }
      break;
    case 'uppercut': crescent(c, sx, sy, 44, 1.0, -1.7, k, C.trail); break;
    case 'slam': crescent(c, sx, sy, Math.max(40, mv.box.h * .45), -2.3, 1.1, k, C.trail); break;
    case 'sweep': crescent(c, sx, sy, Math.max(36, mv.box.w * .7), 1.2, -1.4, k, C.trail); break;
    case 'spin': crescent(c, 0, -C.h / 2, Math.max(mv.box.w, mv.box.h) / 2, 0, TAU, k, C.trail); break;
    case 'cast': glow(c, bx, by, mv.box.h * (k <= 1 ? .6 + k * .5 : 1.1), C.trail, 1); break;
  }
  c.restore();
}

function drawFighter(c, f, t) {
  if (f.gone) return;
  const C = CHARS[f.c], p = computePose(f, t);
  c.save();
  if (f.onGround || f.state === 'ko') {
    const g = c.createRadialGradient(f.x, f.y + 2, 2, f.x, f.y + 2, C.w * .8);
    g.addColorStop(0, 'rgba(0,0,0,.38)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(f.x, f.y + 2, C.w * .8, 7, 0, 0, TAU); c.fill();
  }
  c.translate(f.x, f.y + p.bob);
  c.scale(f.face, 1);
  c.rotate(p.lean);
  if (p.spin) { c.translate(0, -C.h / 2); c.rotate(p.spin); c.translate(0, C.h / 2); }
  c.scale(p.sx, p.sy);
  if (f.inv > 0 && f.state !== 'skill' && (t >> 2) % 2) c.globalAlpha = .45;
  c.globalAlpha *= p.alpha;
  if (f.stealthT > 0) c.globalAlpha *= .18;
  c.save(); C.draw(c, f, p, t); c.restore();
  drawTrail(c, C, p);
  c.restore();
}
