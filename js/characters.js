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

// ============ BRAMBLE — horned forest brawler (cute) ============
function drawBramble(c, f, p, t) {
  c.scale(.8, .8);
  const fur = '#3aa596', furD = '#26786d', belly = '#efe0c2', horn = '#e6d8b8', scarf = '#c8364f';
  const sp = (f.state === 'run' || !f.onGround) ? 2 : 1;
  const pts = [];
  for (let i = 0; i < 7; i++) pts.push([-14 - i * 8, -53 + i * 1.6 + Math.sin(t * .13 * sp - i * .8) * i * .9]);
  ribbon(c, p, pts, 10, 3, scarf);
  const bl = limb2(c, p, -7, -24, p.legB, 10, p.legB - p.kneeB, 11, 10, 9, furD);
  part(c, () => c.ellipse(bl[0] + 3, bl[1] + 1, 7, 4.5, 0, 0, TAU), rg(c, p, bl[0] + 3, bl[1], 7, furD));
  const ba = limb2(c, p, -10, -46, p.armB, 9, p.armB + p.elbB, 9, 8, 7, furD);
  part(c, () => c.arc(ba[0], ba[1], 5.5, 0, TAU), rg(c, p, ba[0], ba[1], 5.5, furD));
  part(c, () => c.ellipse(0, -38, 23, 22, 0, 0, TAU), rg(c, p, 0, -40, 24, fur));
  fillP(c, () => c.ellipse(5, -33, 14, 13, 0, 0, TAU), rg(c, p, 5, -35, 14, belly));
  if (!p.flash) {
    c.strokeStyle = shade(belly, -.18); c.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(5, -40 + i * 6, 6, .5, Math.PI - .5); c.stroke(); }
  }
  const fl = limb2(c, p, 7, -24, p.legF, 10, p.legF - p.kneeF, 11, 11, 10, fur);
  part(c, () => c.ellipse(fl[0] + 4, fl[1] + 1, 8, 5, 0, 0, TAU), rg(c, p, fl[0] + 4, fl[1], 8, fur));
  // horns
  part(c, () => { c.moveTo(-14, -94); c.quadraticCurveTo(-22, -108, -14, -117); c.quadraticCurveTo(-8, -104, -2, -99); c.closePath(); }, lg(c, p, -22, -117, -2, -94, horn));
  part(c, () => { c.moveTo(10, -99); c.quadraticCurveTo(18, -110, 26, -115); c.quadraticCurveTo(26, -102, 20, -94); c.closePath(); }, lg(c, p, 10, -115, 26, -94, horn));
  if (!p.flash) {
    c.strokeStyle = shade(horn, -.3); c.lineWidth = 1.1;
    [[-15, -101, -8, -99], [-17, -106, -11, -104], [14, -103, 21, -101], [17, -107, 24, -106]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); });
  }
  // head
  part(c, () => c.arc(2, -74, 26, 0, TAU), rg(c, p, 2, -76, 26, fur));
  fillP(c, () => c.ellipse(16, -66, 11, 8, 0, 0, TAU), rg(c, p, 16, -67, 11, belly));
  fillP(c, () => c.ellipse(26, -70, 3.6, 2.7, 0, 0, TAU), col(p, '#2a1d24'));
  realEye(c, p, 9, -80, 4.6, 5.6, '#3b7a3a');
  realEye(c, p, 20, -80, 4.2, 5.4, '#3b7a3a');
  brows(c, p, [[9, -88, 5], [20, -88, 4.5]], furD);
  mouth(c, p, 18, -61, .9);
  part(c, () => c.roundRect(-20, -59, 42, 12, 5), lg(c, p, 0, -59, 0, -47, scarf));
  if (!p.flash) { c.strokeStyle = shade(scarf, -.35); c.lineWidth = 1.3; [-8, 4, 14].forEach(x => { c.beginPath(); c.moveTo(x, -58); c.lineTo(x + 2, -48); c.stroke(); }); }
  part(c, () => c.ellipse(-16, -52, 6, 5, 0, 0, TAU), rg(c, p, -16, -52, 6, shade(scarf, -.25)));
  const fa = limb2(c, p, 8, -46, p.armF, 9, p.armF + p.elbF, 9 + p.ext, 8, 7, fur);
  part(c, () => c.arc(fa[0], fa[1], p.ext > 4 ? 7.5 : 6, 0, TAU), rg(c, p, fa[0], fa[1], 7, fur));
}

// ============ PIP — tiny brave finch (cute) ============
function drawPip(c, f, p, t) {
  const body = '#f0be2e', back = '#7f8a3a', wing = '#6b7531', beak = '#e8913c', leg = '#d98c5f';
  const air = !f.onGround && f.state !== 'ko';
  [-.3, 0, .3].forEach(a => {
    c.save(); c.translate(-16, -26); c.rotate(-2.1 + a + (air ? -.2 : 0));
    part(c, () => c.ellipse(0, 9, 3.5, 11, 0, 0, TAU), lg(c, p, -3, 0, 3, 18, back), 1.5);
    c.restore();
  });
  const foot = (x, a) => {
    const ex = x + Math.sin(a) * 9, ey = -9 + Math.cos(a) * 9;
    seg(c, p, x, -9, ex, ey, 2.5, leg);
    c.strokeStyle = col(p, shade(leg, -.25)); c.lineWidth = 1.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex + 6, ey + .5); c.moveTo(ex, ey); c.lineTo(ex + 4, ey + 2); c.moveTo(ex, ey); c.lineTo(ex - 4, ey + .5); c.stroke();
  };
  if (air) { seg(c, p, -4, -9, -8, -5, 2.5, leg); seg(c, p, 5, -9, 2, -5, 2.5, leg); }
  else { foot(-5, p.legB * .6); foot(5, p.legF * .6); }
  part(c, () => c.ellipse(0, -28, 20, 21, 0, 0, TAU), rg(c, p, 0, -30, 21, body));
  if (!p.flash) {
    c.save(); c.beginPath(); c.ellipse(0, -28, 20, 21, 0, 0, TAU); c.clip();
    fillP(c, () => c.ellipse(-9, -42, 22, 15, -.3, 0, TAU), lg(c, p, -20, -54, 0, -30, back, .2));
    fillP(c, () => c.ellipse(7, -19, 12, 12, 0, 0, TAU), 'rgba(255,245,210,.55)');
    c.strokeStyle = shade(body, -.2); c.lineWidth = 1;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(8 + (i % 2) * 4, -25 + i * 4, 3, .3, Math.PI - .3); c.stroke(); }
    c.restore();
  }
  // leaf sprout
  c.save(); c.translate(-2, -48); c.rotate(Math.sin(t * .08) * .25 + (air ? -.3 : 0));
  c.strokeStyle = col(p, '#4d7a2c'); c.lineWidth = 2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-2, -6, 1, -11); c.stroke();
  part(c, () => c.ellipse(7, -13, 8, 3.8, -.5, 0, TAU), lg(c, p, 0, -17, 12, -9, '#5fbf4f'), 1.5);
  if (!p.flash) { c.strokeStyle = 'rgba(30,70,20,.6)'; c.lineWidth = .8; c.beginPath(); c.moveTo(1, -11); c.lineTo(13, -15); c.stroke(); }
  c.restore();
  // eye (profile)
  if (p.eyes === 'open') {
    fillP(c, () => c.arc(10, -35, 5, 0, TAU), col(p, shade(body, -.25)));
    fillP(c, () => c.arc(10.5, -35, 3.9, 0, TAU), p.flash ? '#fff' : '#17121a');
    fillP(c, () => c.arc(9, -36.5, 1.3, 0, TAU), '#fff');
  } else realEye(c, p, 10, -35, 4, 4, '#000');
  brows(c, p, [[10, -42, 5]], shade(back, -.3));
  const open = f.state === 'attack' || p.mouth === 'o';
  part(c, () => { c.moveTo(17, -34); c.quadraticCurveTo(26, -34, 30, -29); c.lineTo(17, -26); c.closePath(); }, lg(c, p, 17, -34, 30, -26, beak), 1.6);
  c.save(); c.translate(17, -26); c.rotate(open ? .35 : 0);
  part(c, () => { c.moveTo(0, 0); c.lineTo(10, -1); c.lineTo(0, 3); c.closePath(); }, col(p, shade(beak, -.2)), 1.4);
  c.restore();
  // wing
  let wa = .5 + p.armF * .3;
  if (air) wa = -.5 + Math.sin(t * .5) * .9;
  if (f.glide) wa = -1.8 + Math.sin(t * .3) * .1;
  if (f.state === 'skill') wa = f.sk === 1 ? -2.2 + Math.sin(t * 1.2) * .6 : (f.st < 7 ? -1.3 : 1.5);
  if (f.state === 'hurt' || f.state === 'ko') wa = -2;
  c.save(); c.translate(-4, -30); c.rotate(wa);
  part(c, () => c.ellipse(0, 10, 8, 14, 0, 0, TAU), lg(c, p, -8, 0, 8, 24, wing), 1.8);
  if (!p.flash) {
    c.strokeStyle = shade(wing, -.35); c.lineWidth = 1;
    [-3, 0, 3].forEach(x => { c.beginPath(); c.moveTo(x, 10); c.lineTo(x * 1.3, 23); c.stroke(); });
    c.strokeStyle = 'rgba(255,250,220,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-5, 7); c.lineTo(5, 7); c.stroke();
  }
  c.restore();
}

// ============ GRIMJAW — armored ogre brute (villain) ============
function drawGrimjaw(c, f, p, t) {
  const skin = '#6e7a5a', skinD = '#4b5540', iron = '#555863', leather = '#5a3e2b', fur = '#4e3d2e', tusk = '#e8dcc0';
  const bl = limb2(c, p, -14, -38, p.legB * .6, 17, p.legB * .6 - p.kneeB, 17, 19, 16, skinD);
  part(c, () => c.ellipse(bl[0] + 5, bl[1] + 1, 14, 7, 0, 0, TAU), rg(c, p, bl[0] + 5, bl[1], 14, skinD));
  const ba = limb2(c, p, -16, -86, p.armB, 20, p.armB + p.elbB, 20, 14, 13, skinD);
  part(c, () => c.arc(ba[0], ba[1], 10, 0, TAU), rg(c, p, ba[0], ba[1], 10, skinD));
  [[-30, -84, -1.0], [-36, -62, -1.4], [-18, -102, -.6]].forEach(([x, y, a]) => {
    c.save(); c.translate(x, y); c.rotate(a);
    part(c, () => { c.moveTo(-7, 2); c.lineTo(0, -18); c.lineTo(7, 2); c.closePath(); }, lg(c, p, -7, -18, 7, 2, '#8d909c'), 1.8);
    c.restore();
  });
  part(c, () => c.ellipse(0, -64, 36, 39, .25, 0, TAU), rg(c, p, -4, -72, 42, skin));
  if (!p.flash) {
    fillP(c, () => c.ellipse(10, -52, 18, 20, .2, 0, TAU), 'rgba(255,255,220,.1)');
    c.strokeStyle = shade(skin, -.35); c.lineWidth = 1.6; c.lineCap = 'round';
    c.beginPath(); c.arc(16, -78, 14, .3, 1.7); c.stroke();
    c.beginPath(); c.moveTo(6, -62); c.lineTo(14, -60); c.moveTo(4, -54); c.lineTo(14, -52); c.stroke();
  }
  part(c, () => {
    c.moveTo(-28, -40); c.lineTo(30, -40);
    for (let i = 0; i <= 6; i++) c.lineTo(30 - i * 9.6, -22 + (i % 2 ? 6 : 0));
    c.closePath();
  }, lg(c, p, 0, -40, 0, -18, fur, .25), 1.8);
  part(c, () => c.roundRect(-30, -45, 62, 9, 3), lg(c, p, 0, -45, 0, -36, leather));
  part(c, () => c.roundRect(0, -46, 11, 11, 2), lg(c, p, 0, -46, 11, -35, '#c9a24a'), 1.5);
  const fl = limb2(c, p, 12, -36, p.legF * .6, 17, p.legF * .6 - p.kneeF, 17, 20, 17, skin);
  part(c, () => c.ellipse(fl[0] + 6, fl[1] + 1, 15, 7, 0, 0, TAU), rg(c, p, fl[0] + 6, fl[1], 15, skin));
  const fa = limb2(c, p, 12, -86, p.armF, 20, p.armF + p.elbF, 21 + p.ext, 17, 16, skin);
  const bx = fa[2] + (fa[0] - fa[2]) * .2, by = fa[3] + (fa[1] - fa[3]) * .2;
  const ex = fa[2] + (fa[0] - fa[2]) * .65, ey = fa[3] + (fa[1] - fa[3]) * .65;
  seg(c, p, bx, by, ex, ey, 19, iron);
  part(c, () => c.arc(fa[0], fa[1], 12.5, 0, TAU), rg(c, p, fa[0], fa[1], 12.5, skin));
  if (!p.flash) {
    c.strokeStyle = shade(skin, -.4); c.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(fa[0], fa[1], 8, p.armF * -1 + i * .5 + .8, p.armF * -1 + i * .5 + 1.1); c.stroke(); }
  }
  // pauldron
  [-.9, 0, .9].forEach(a => {
    part(c, () => {
      c.moveTo(6 + Math.sin(a - .28) * 15, -92 - Math.cos(a - .28) * 15);
      c.lineTo(6 + Math.sin(a) * 30, -92 - Math.cos(a) * 30);
      c.lineTo(6 + Math.sin(a + .28) * 15, -92 - Math.cos(a + .28) * 15);
      c.closePath();
    }, lg(c, p, 6, -122, 6, -92, '#8d909c'), 1.6);
  });
  part(c, () => { c.arc(6, -90, 18, Math.PI, 0); c.closePath(); }, rg(c, p, 2, -98, 18, '#62656f'));
  if (!p.flash) [[-6, -94], [6, -102], [18, -94]].forEach(([x, y]) => fillP(c, () => c.arc(x, y, 1.6, 0, TAU), '#c9ccd6'));
  // head
  c.save(); c.translate(32, -88);
  part(c, () => { c.moveTo(-10, -10); c.quadraticCurveTo(-24, -30, -40, -20); c.quadraticCurveTo(-24, -21, -14, 0); c.closePath(); }, lg(c, p, -40, -28, -10, 0, '#d9cbb0'));
  if (!p.flash) { c.strokeStyle = 'rgba(90,70,50,.6)'; c.lineWidth = 1; [[-20, -22, -18, -16], [-28, -24, -27, -19], [-34, -21, -33, -18]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); }); }
  part(c, () => { c.moveTo(-12, -4); c.lineTo(-25, -11); c.lineTo(-13, 4); c.closePath(); }, rg(c, p, -16, -4, 9, skinD), 1.6);
  part(c, () => c.ellipse(0, 0, 17, 15, 0, 0, TAU), rg(c, p, -3, -4, 17, skin));
  fillP(c, () => c.ellipse(5, -7, 16, 5, -.1, 0, TAU), col(p, skinD));
  fillP(c, () => c.ellipse(15, -1, 4, 3, 0, 0, TAU), col(p, shade(skin, -.25)));
  part(c, () => c.roundRect(-4, 4, 26, 13, 6), rg(c, p, 8, 8, 14, skin));
  part(c, () => { c.moveTo(2, 6); c.lineTo(5, -6); c.lineTo(9, 6); c.closePath(); }, lg(c, p, 2, -6, 9, 6, tusk), 1.4);
  part(c, () => { c.moveTo(14, 6); c.lineTo(17, -4); c.lineTo(20, 6); c.closePath(); }, lg(c, p, 14, -4, 20, 6, tusk), 1.4);
  if (!p.flash) { c.strokeStyle = 'rgba(70,20,20,.6)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-3, -13); c.lineTo(8, 2); c.stroke(); }
  glowEyes(c, p, [[4, -2], [12, -1]], '#ff5a36', 3, 2);
  c.restore();
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

// ============ VEX — storm warlock (villain / magic) ============
function drawVex(c, f, p, t) {
  const robe = '#3d1f2c', bone = '#dccfb3', magic = '#b56bff';
  const sway = Math.sin(t * .06) * 2;
  const orbs = [0, 1].map(i => { const a = t * .06 + i * Math.PI; return [Math.cos(a) * 30, -62 + Math.sin(a * 2) * 6, Math.sin(a)]; });
  orbs.filter(o => o[2] < 0).forEach(o => orb(c, p, o[0], o[1], 4, magic));
  part(c, () => {
    c.moveTo(-10, -80); c.quadraticCurveTo(-34, -50, -34 + sway, -6);
    for (let i = 1; i <= 5; i++) c.lineTo(-34 + sway + i * 6, -6 - (i % 2 ? 9 : 0));
    c.lineTo(-4, -70); c.closePath();
  }, lg(c, p, -34, -80, 0, 0, shade(robe, -.25)));
  const ba = limb2(c, p, -8, -70, p.armB, 15, p.armB + p.elbB, 14, 6, 5, robe);
  claws(c, p, ba[0], ba[1], p.armB + p.elbB, shade(bone, -.2));
  const bodyPath = () => {
    c.moveTo(-12, -80); c.quadraticCurveTo(-24, -66, -22, -40); c.lineTo(-24, -4);
    for (let i = 1; i <= 6; i++) c.lineTo(-24 + i * 7.3, -4 - (i % 2 ? 7 : 0) + Math.sin(t * .1 + i) * 1.5);
    c.quadraticCurveTo(22, -40, 18, -60); c.quadraticCurveTo(14, -78, 4, -84); c.closePath();
  };
  part(c, bodyPath, lg(c, p, -24, -84, 22, -4, robe, .3));
  if (!p.flash) {
    c.save(); c.beginPath(); bodyPath(); c.clip();
    c.strokeStyle = 'rgba(10,2,6,.5)'; c.lineWidth = 2.5;
    [-14, -4, 7].forEach(x => { c.beginPath(); c.moveTo(x, -64); c.quadraticCurveTo(x + 3, -34, x + 1, -2); c.stroke(); });
    c.restore();
  }
  part(c, () => c.roundRect(-18, -46, 36, 6, 2), lg(c, p, 0, -46, 0, -40, '#2a1a14'), 1.4);
  if (!p.flash) [-10, 0, 10].forEach((x, i) => {
    c.strokeStyle = '#6b5a45'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, -40); c.lineTo(x + 1, -32 - i); c.stroke();
    fillP(c, () => c.ellipse(x + 1, -30 - i, 2.2, 3, 0, 0, TAU), bone);
  });
  part(c, () => { c.moveTo(-12, -80); c.quadraticCurveTo(-14, -104, 6, -106); c.quadraticCurveTo(24, -100, 22, -82); c.quadraticCurveTo(10, -76, -12, -80); c.closePath(); }, lg(c, p, -14, -106, 22, -76, robe, .3));
  part(c, () => { c.moveTo(4, -98); c.bezierCurveTo(-6, -122, -28, -112, -20, -94); c.bezierCurveTo(-16, -101, -8, -105, 0, -93); c.closePath(); }, lg(c, p, -28, -120, 4, -94, bone));
  if (!p.flash) { c.strokeStyle = 'rgba(110,90,60,.6)'; c.lineWidth = 1; [[-4, -110, -2, -105], [-12, -112, -11, -106], [-19, -106, -15, -103]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); }); }
  part(c, () => c.ellipse(12, -90, 10, 11, .15, 0, TAU), rg(c, p, 10, -93, 11, bone));
  if (!p.flash) {
    c.strokeStyle = 'rgba(60,40,30,.7)'; c.lineWidth = 1;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(9 + i * 2.6, -83); c.lineTo(9 + i * 2.6, -80); c.stroke(); }
  }
  glowEyes(c, p, [[10, -92], [17, -91]], '#c58bff', 2.6, 1.6);
  // staff
  const fa = limb2(c, p, 6, -70, p.armF, 14, p.armF + p.elbF, 13 + p.ext * .3, 6, 5, robe);
  const sa = p.staffA, dx = Math.sin(sa), dy = -Math.cos(sa);
  const pts = [];
  for (let k = 0; k <= 6; k++) {
    const d = -36 + k * 15, w = (k % 2 ? 2 : -2);
    pts.push([fa[0] + dx * d - dy * w, fa[1] + dy * d + dx * w]);
  }
  c.lineCap = 'round'; c.lineJoin = 'round';
  [[OUTC, 6.5], [col(p, '#3b2a22'), 3.8]].forEach(([s, w]) => { c.strokeStyle = s; c.lineWidth = w; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); });
  const tx = fa[0] + dx * 62, ty = fa[1] + dy * 62;
  orb(c, p, tx, ty, 6 + p.glow * 2, magic);
  if (!p.flash) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#e6ccff'; c.lineWidth = 1.2;
    const seed = Math.floor(t / 3);
    for (let b = 0; b < 2 + Math.round(p.glow * 3); b++) {
      let x = tx, y = ty; c.beginPath(); c.moveTo(x, y);
      for (let s = 0; s < 3; s++) { x += (hash(seed + b * 7 + s) - .5) * 18; y += (hash(seed + b * 13 + s * 3) - .5) * 18; c.lineTo(x, y); }
      c.stroke();
    }
    c.restore();
  }
  claws(c, p, fa[0], fa[1], p.armF + p.elbF, bone);
  orbs.filter(o => o[2] >= 0).forEach(o => orb(c, p, o[0], o[1], 4, magic));
}

// ============ the roster ============
// moves: melee combo (jab1 -> jab2 -> fin). f = [startup, active, recovery] frames.
// skills: three extra attacks (Q/E/R for player 1). Their code lives in game.js (SKILLS).
const CHARS = [
  {
    id: 'bramble', name: 'BRAMBLE', title: 'Horned forest brawler',
    hp: 100, w: 44, h: 88, speed: 4.3, jump: 11.5, jumps: 2, grav: .62, maxFall: 12, weight: 1,
    reach: 10, shoulder: [6, -37], trail: '#ffd27a',
    stats: { power: 3, speed: 3, jump: 3, magic: 1 },
    moves: {
      jab1: { f: [4, 3, 9], dmg: 3, kb: [1.5, -1], box: { x: 12, y: -56, w: 38, h: 26 }, anim: 'punch', next: 'jab2' },
      jab2: { f: [4, 3, 9], dmg: 3, kb: [1.5, -1], box: { x: 12, y: -56, w: 38, h: 26 }, anim: 'punch2', next: 'fin' },
      fin: { f: [7, 4, 14], dmg: 8, kb: [7, -5], box: { x: 8, y: -84, w: 46, h: 50 }, anim: 'headbutt', cd: 28 },
    },
    skills: [
      { name: 'Horn Charge', desc: 'Dash forward horns first.', cd: 50 },
      { name: 'Scarf Twirl', desc: 'Spin upward. Great for getting back.', cd: 30, air: true },
      { name: 'Thorn Uppercut', desc: 'A rising punch that launches.', cd: 70 },
    ],
    draw: drawBramble,
    pose(p, f) {
      if (f.state !== 'skill') return;
      if (f.sk === 0) {
        if (f.st < 7) { p.sy = .85; p.sx = 1.1; p.armF = -.8; p.armB = -1; }
        else if (f.st < 23) { p.lean = .45; p.armF = -1.6; p.armB = -1.8; p.legF = -.6; p.legB = -1; p.kneeF = .4; }
      } else if (f.sk === 1) { p.spin = f.st * .55; p.armF = 1.6; p.armB = -1.6; p.elbF = .1; p.elbB = .1; p.legF = .5; p.kneeF = 1; }
      else if (f.sk === 2) ANIMS.uppercut(p, f.st < 8 ? 0 : f.st < 14 ? 1 : 2, f.st < 8 ? f.st / 8 : f.st < 14 ? (f.st - 8) / 6 : Math.min(1, (f.st - 14) / 16), this);
    },
  },
  {
    id: 'pip', name: 'PIP', title: 'Tiny bird, big heart',
    hp: 85, w: 40, h: 54, speed: 5.2, jump: 10.5, jumps: 3, grav: .5, maxFall: 9, weight: .7, glide: true,
    reach: 0, shoulder: [10, -26], trail: '#fff3c0',
    stats: { power: 1, speed: 5, jump: 5, magic: 1 },
    moves: {
      jab1: { f: [3, 2, 7], dmg: 3, kb: [1, -1], box: { x: 10, y: -44, w: 30, h: 28 }, anim: 'headbutt', next: 'jab2' },
      jab2: { f: [3, 2, 7], dmg: 3, kb: [1, -1], box: { x: 10, y: -44, w: 30, h: 28 }, anim: 'headbutt', next: 'fin' },
      fin: { f: [6, 4, 12], dmg: 7, kb: [6, -4], box: { x: 0, y: -54, w: 48, h: 48 }, anim: 'sweep', cd: 24 },
    },
    skills: [
      { name: 'Feather Shot', desc: 'Throw a sharp feather.', cd: 28 },
      { name: 'Updraft', desc: 'A huge flap that lifts you high.', cd: 30, air: true },
      { name: 'Dive Bomb', desc: 'Swoop down beak first.', cd: 60 },
    ],
    draw: drawPip,
    pose(p, f) {
      if (f.state === 'skill' && f.sk === 2 && f.st >= 6) { p.lean = 1.0; }
    },
  },
  {
    id: 'grimjaw', name: 'GRIMJAW', title: 'Armored ogre brute',
    hp: 120, w: 64, h: 116, speed: 3.0, jump: 11, jumps: 2, grav: .72, maxFall: 14, weight: 1.5,
    reach: 6, shoulder: [12, -86], trail: '#ff8a4a',
    stats: { power: 5, speed: 1, jump: 2, magic: 1 },
    moves: {
      jab1: { f: [6, 3, 11], dmg: 4, kb: [2, -1], box: { x: 16, y: -96, w: 50, h: 44 }, anim: 'punch', next: 'jab2' },
      jab2: { f: [6, 3, 11], dmg: 4, kb: [2, -1], box: { x: 16, y: -96, w: 50, h: 44 }, anim: 'punch2', next: 'fin' },
      fin: { f: [14, 5, 20], dmg: 13, kb: [9, -6], box: { x: 10, y: -134, w: 76, h: 128 }, anim: 'slam', armor: true, cd: 34 },
    },
    skills: [
      { name: 'Earthquake', desc: 'Pound the ground. Shockwaves run both ways.', cd: 90 },
      { name: 'Titan Leap', desc: 'A huge leap that crashes down.', cd: 50, air: true },
      { name: 'Boulder Toss', desc: 'Hurl a heavy rock in an arc.', cd: 75 },
    ],
    draw: drawGrimjaw,
    pose(p, f) {
      if (f.state !== 'skill') return;
      if (f.sk === 0) {
        if (!f.quaked) { p.armF = 2.9; p.armB = -2.9; p.elbF = .2; p.elbB = .2; p.sy = 1.06; p.sx = .96; p.lean = -.08; }
        else { p.armF = .7; p.armB = -.7; p.sy = .9; p.sx = 1.08; p.lean = .15; }
      } else if (f.sk === 1) {
        if (!f.quaked && f.vy < 0) { p.armF = 2.6; p.armB = -2.6; p.legF = .9; p.kneeF = 1.2; }
        else if (!f.quaked) { p.armF = -2.4; p.armB = -2.2; p.lean = .1; }
        else { p.armF = .9; p.armB = .7; p.sy = .88; p.sx = 1.1; }
      } else if (f.sk === 2) {
        if (f.st < 16) { p.armF = -2.6; p.armB = -2.4; p.elbF = .6; p.lean = -.15; }
        else { p.armF = 1.9; p.armB = 1.4; p.elbF = .1; p.lean = .15; }
      }
    },
  },
  {
    id: 'nightweaver', name: 'NIGHTWEAVER', title: 'Wraith of the deep woods',
    hp: 95, w: 40, h: 112, speed: 3.9, jump: 10, jumps: 2, grav: .45, maxFall: 8, weight: .9,
    reach: 14, shoulder: [6, -86], trail: '#7dffd0',
    stats: { power: 3, speed: 3, jump: 4, magic: 3 },
    moves: {
      jab1: { f: [5, 3, 9], dmg: 4, kb: [1.5, -1], box: { x: 12, y: -104, w: 56, h: 44 }, anim: 'sweep', next: 'jab2' },
      jab2: { f: [5, 3, 9], dmg: 4, kb: [1.5, -1], box: { x: 12, y: -96, w: 56, h: 40 }, anim: 'punch2', next: 'fin' },
      fin: { f: [8, 4, 14], dmg: 9, kb: [7, -4], box: { x: 8, y: -112, w: 78, h: 72 }, anim: 'headbutt', cd: 28 },
    },
    skills: [
      { name: 'Shadow Snare', desc: 'A creeping shadow that roots enemies.', cd: 70 },
      { name: 'Shadow Step', desc: 'Teleport the way you hold. Up works too.', cd: 55, air: true },
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
    hp: 90, w: 38, h: 102, speed: 3.8, jump: 10.5, jumps: 2, grav: .55, maxFall: 10, weight: .85,
    reach: 12, shoulder: [6, -72], trail: '#9ff3ff',
    stats: { power: 2, speed: 3, jump: 3, magic: 5 },
    moves: {
      jab1: { f: [4, 3, 9], dmg: 3, kb: [1.5, -1], box: { x: 12, y: -78, w: 56, h: 26 }, anim: 'punch', next: 'jab2' },
      jab2: { f: [4, 3, 9], dmg: 3, kb: [1.5, -1], box: { x: 12, y: -78, w: 56, h: 26 }, anim: 'punch', next: 'fin' },
      fin: { f: [7, 5, 14], dmg: 8, kb: [6, -5], box: { x: -36, y: -108, w: 104, h: 100 }, anim: 'spin', cd: 30 },
    },
    skills: [
      { name: 'Prism Bolt', desc: 'Fire a fast bolt of light.', cd: 35 },
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
    id: 'vex', name: 'VEX', title: 'Storm warlock',
    hp: 95, w: 44, h: 104, speed: 3.6, jump: 10, jumps: 2, grav: .55, maxFall: 10, weight: .95,
    reach: 4, shoulder: [8, -70], trail: '#c58bff',
    stats: { power: 3, speed: 2, jump: 3, magic: 5 },
    moves: {
      jab1: { f: [5, 3, 9], dmg: 3, kb: [1.5, -1], box: { x: 16, y: -82, w: 46, h: 34 }, anim: 'cast', next: 'jab2' },
      jab2: { f: [5, 3, 9], dmg: 3, kb: [1.5, -1], box: { x: 16, y: -82, w: 46, h: 34 }, anim: 'cast', next: 'fin' },
      fin: { f: [9, 5, 15], dmg: 9, kb: [7, -4], box: { x: 12, y: -100, w: 70, h: 66 }, anim: 'cast', cd: 30 },
    },
    skills: [
      { name: 'Chain Lightning', desc: 'Lightning strikes the nearest enemy.', cd: 85 },
      { name: 'Storm Lift', desc: 'Ride a bolt of lightning upward.', cd: 40, air: true },
      { name: 'Hex Orb', desc: 'A slow orb that hunts enemies.', cd: 130 },
    ],
    draw: drawVex,
    pose(p, f) {
      if (f.state !== 'skill') return;
      if (f.sk === 0) { p.armF = 2.8; p.elbF = .1; p.staffA = -.1; p.glow = 1; p.armB = 1.2; }
      if (f.sk === 1) { p.armF = 2.6; p.armB = -2.6; p.glow = 1; p.staffA = .1; }
      if (f.sk === 2) ANIMS.cast(p, f.st < 10 ? 0 : f.st < 16 ? 1 : 2, f.st < 10 ? f.st / 10 : f.st < 16 ? (f.st - 10) / 6 : Math.min(1, (f.st - 16) / 6), this);
    },
  },
];

// ---------- animation shapes for the combo ----------
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
    case 'punch': case 'punch2': case 'headbutt':
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
  c.save(); C.draw(c, f, p, t); c.restore();
  drawTrail(c, C, p);
  c.restore();
}
