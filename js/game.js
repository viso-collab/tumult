// game.js — spillets regler og fysik.
// Kører kun hos værten (eller lokalt). En online-gæst modtager bare resultatet.

const BTN = ['left', 'right', 'up', 'down', 'attack', 'special'];
const ROUND_TIME = 60 * 60;   // 60 sekunder
const FALL_DAMAGE = 15;       // HP man mister ved at falde ud af banen
const WINS_NEEDED = 2;

function newState() {
  return {
    screen: 'select', tick: 0,
    players: [{ char: 0, ready: false }, { char: 2, ready: false }],
    map: 0, fighters: [], projectiles: [], events: [],
    round: 1, wins: [0, 0], timer: 0, phase: '', phaseT: 0,
    roundWinner: -1, koTime: false, winner: -1, hitstop: 0,
    prevIn: [{}, {}],
  };
}
// Det der sendes til gæsten (alt undtagen værtens egne knap-historik)
function snapshot(s) {
  const o = {};
  for (const k in s) if (k !== 'prevIn') o[k] = s[k];
  return o;
}

function setState(f, st) { if (f.state !== st) { f.state = st; f.st = 0; } }
function ev(s, e) { s.events.push(e); }

function step(s, inp) {
  s.events = []; s.tick++;
  const I = [inp[0] || {}, inp[1] || {}];
  const P = I.map((x, i) => { const o = {}; BTN.forEach(k => o[k] = !!x[k] && !s.prevIn[i][k]); return o; });
  s.prevIn = I.map(x => { const o = {}; BTN.forEach(k => o[k] = !!x[k]); return o; });
  if (s.screen === 'select') stepSelect(s, P);
  else if (s.screen === 'map') stepMap(s, P);
  else if (s.screen === 'fight') stepFight(s, I, P);
  else if (s.screen === 'result') stepResult(s, P);
}

// ---------- menuer ----------
function stepSelect(s, P) {
  const N = CHARS.length;
  s.players.forEach((pl, i) => {
    const p = P[i];
    if (!pl.ready) {
      if (p.left) pl.char = (pl.char + N - 1) % N;
      if (p.right) pl.char = (pl.char + 1) % N;
      if (p.up || p.down) pl.char = (pl.char + 2) % N;
      if (p.attack) { pl.ready = true; ev(s, { t: 'ok' }); }
    } else if (p.special) pl.ready = false;
  });
  if (s.players.every(p => p.ready)) s.screen = 'map';
}
function stepMap(s, P) {
  const M = MAPS.length;
  for (let i = 0; i < 2; i++) {
    if (P[i].left) s.map = (s.map + M - 1) % M;
    if (P[i].right) s.map = (s.map + 1) % M;
    if (P[i].attack) { startMatch(s); return; }
    if (P[i].special) { s.screen = 'select'; s.players.forEach(p => p.ready = false); return; }
  }
}
function stepResult(s, P) {
  if (s.phaseT++ < 60) return;
  if (P[0].attack || P[1].attack) {
    s.screen = 'select'; s.players.forEach(p => p.ready = false); s.fighters = []; s.projectiles = [];
  }
}

// ---------- kamp ----------
function startMatch(s) {
  s.wins = [0, 0]; s.round = 1; s.winner = -1; s.screen = 'fight';
  startRound(s);
}
function makeFighter(ci, i, m) {
  const C = CHARS[ci];
  return {
    c: ci, idx: i, x: m.spawns[i][0], y: m.spawns[i][1] - 1, vx: 0, vy: 0, face: i === 0 ? 1 : -1,
    hp: C.hp, onGround: false, plat: -1, jumps: C.jumps, state: 'air', st: 0,
    hit: false, hitstun: 0, inv: 0, flash: 0, dropT: 0, cd: 0, landT: 0,
    glide: false, noGrav: false, quaked: false, spAir: false, endAt: 0,
  };
}
function startRound(s) {
  const m = MAPS[s.map];
  s.fighters = [0, 1].map(i => makeFighter(s.players[i].char, i, m));
  s.projectiles = [];
  s.phase = 'intro'; s.phaseT = 0; s.timer = ROUND_TIME; s.hitstop = 0;
  s.roundWinner = -1; s.koTime = false;
}
function endRound(s, w, time) {
  s.phase = 'ko'; s.phaseT = 0; s.roundWinner = w; s.koTime = time;
  if (w >= 0) s.wins[w]++;
  s.fighters.forEach(f => { if (f.hp <= 0) { f.state = 'ko'; f.st = 0; f.noGrav = false; } });
  s.projectiles = [];
  ev(s, { t: 'ko' });
}

function stepFight(s, I, P) {
  s.phaseT++;
  const none = [{}, {}];
  if (s.phase === 'intro') {
    updateFighters(s, none, none);
    if (s.phaseT >= 100) { s.phase = 'fight'; s.phaseT = 0; ev(s, { t: 'go' }); }
    return;
  }
  if (s.phase === 'fight') {
    if (s.hitstop > 0) { s.hitstop--; return; }   // lille frys når et slag rammer
    s.timer--;
    updateFighters(s, I, P);
    updateProjectiles(s);
    const dead = s.fighters.map(f => f.hp <= 0);
    if (dead[0] || dead[1]) endRound(s, dead[0] && dead[1] ? -1 : dead[0] ? 1 : 0, false);
    else if (s.timer <= 0) {
      const r = s.fighters.map(f => f.hp / CHARS[f.c].hp);
      endRound(s, Math.abs(r[0] - r[1]) < 1e-6 ? -1 : r[0] > r[1] ? 0 : 1, true);
    }
    return;
  }
  if (s.phase === 'ko') {
    updateFighters(s, none, none);
    if (s.phaseT >= 160) {
      if (s.wins[0] >= WINS_NEEDED || s.wins[1] >= WINS_NEEDED || s.round >= 5) {
        s.screen = 'result'; s.phaseT = 0;
        s.winner = s.wins[0] > s.wins[1] ? 0 : s.wins[1] > s.wins[0] ? 1 : -1;
      } else { s.round++; startRound(s); }
    }
  }
}

function updateFighters(s, I, P) {
  const plats = platsAt(MAPS[s.map], s.tick);
  s.fighters.forEach((f, i) => {
    const o = s.fighters[1 - i], C = CHARS[f.c], inp = I[i] || {}, pr = P[i] || {};
    f.st++;
    if (f.flash > 0) f.flash--;
    if (f.inv > 0) f.inv--;
    if (f.cd > 0) f.cd--;
    if (f.dropT > 0) f.dropT--;
    if (f.landT > 0) f.landT--;
    if (f.state === 'hurt') { f.hitstun--; if (f.hitstun <= 0) setState(f, f.onGround ? 'idle' : 'air'); }

    if (f.state === 'idle' || f.state === 'run' || f.state === 'air' || f.state === 'block') control(s, f, o, C, inp, pr, plats);

    if (f.state === 'attack') {
      const a = C.attack;
      if (f.onGround) f.vx *= .8;
      if (f.st >= a.startup && f.st < a.startup + a.active && !f.hit) tryHit(s, f, o, a.box, a.dmg, a.kb);
      if (f.st >= a.startup + a.active + a.recovery) setState(f, f.onGround ? 'idle' : 'air');
    } else if (f.state === 'special') {
      SPECIALS[C.id].update(f, o, s, inp);
    }

    f.glide = !!C.glide && f.state === 'air' && !!inp.up && f.vy > 0;
    physics(s, f, C, plats);
    if (f.y > H + 180 || f.x < -220 || f.x > W + 220) fellOff(s, f, i);
  });
  pushApart(s);
}

function control(s, f, o, C, inp, pr, plats) {
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  // blokér: hold ned på jorden
  if (f.onGround && inp.down && !inp.up && !pr.attack && !pr.special) {
    setState(f, 'block'); f.face = o.x >= f.x ? 1 : -1; f.vx *= .6;
    return;
  }
  if (f.state === 'block') setState(f, 'idle');

  if (f.onGround) { f.vx += (dir * C.speed - f.vx) * .3; f.face = dir || (o.x >= f.x ? 1 : -1); }
  else { f.vx += (dir * C.speed - f.vx) * .1; if (dir) f.face = dir; }

  if (pr.up) {
    const pl = plats[f.plat];
    if (f.onGround && inp.down && pl && !pl.solid) {          // hop ned gennem platform
      f.dropT = 12; f.onGround = false; f.y += 2; setState(f, 'air');
    } else if (f.onGround) {
      f.vy = -C.jump; f.onGround = false; f.jumps = C.jumps - 1; setState(f, 'air');
      ev(s, { t: 'jump', x: f.x, y: f.y });
    } else if (f.jumps > 0) {
      f.vy = -C.jump * .9; f.jumps--;
      ev(s, { t: 'jump', x: f.x, y: f.y, air: true });
    }
  }
  if (f.onGround && (f.state === 'idle' || f.state === 'run')) setState(f, dir ? 'run' : 'idle');

  if (pr.attack) { f.state = 'attack'; f.st = 0; f.hit = false; }
  else if (pr.special && f.cd <= 0) { f.state = 'special'; f.st = 0; f.hit = false; SPECIALS[C.id].start(f, o, s); }
}

function physics(s, f, C, plats) {
  const was = f.onGround;
  if (was && plats[f.plat] && plats[f.plat].dx) f.x += plats[f.plat].dx;   // følg bevægelig platform
  if (!f.noGrav) {
    f.vy = Math.min(f.vy + C.grav, C.maxFall);
    if (f.glide) f.vy = Math.min(f.vy, 1.4);
  }
  if (f.state === 'hurt' || f.state === 'ko') f.vx *= f.onGround ? .85 : .985;
  const py = f.y;
  f.x += f.vx; f.y += f.vy;
  f.onGround = false;
  if (f.vy >= 0) {
    for (let k = 0; k < plats.length; k++) {
      const pl = plats[k];
      if (!pl.solid && f.dropT > 0) continue;
      if (f.x < pl.x - 6 || f.x > pl.x + pl.w + 6) continue;
      if (py <= pl.y + .01 && f.y >= pl.y) {
        f.y = pl.y; f.vy = 0; f.onGround = true; f.plat = k;
        if (!was) {
          f.jumps = C.jumps; f.landT = 6;
          if (f.state === 'air') setState(f, 'idle');
          if (f.state !== 'ko') ev(s, { t: 'land', x: f.x, y: f.y });
        }
        break;
      }
    }
  }
  if (!f.onGround && (f.state === 'idle' || f.state === 'run' || f.state === 'block')) setState(f, 'air');
}

function fellOff(s, f, i) {
  ev(s, { t: 'fall', x: Math.max(20, Math.min(W - 20, f.x)), y: Math.min(H - 10, Math.max(10, f.y)) });
  if (s.phase === 'fight' && f.state !== 'ko') f.hp = Math.max(0, f.hp - FALL_DAMAGE);
  f.x = W / 2 + (i === 0 ? -50 : 50); f.y = -40; f.vx = 0; f.vy = 0;
  f.onGround = false; f.noGrav = false; f.jumps = CHARS[f.c].jumps;
  if (f.state !== 'ko') { f.inv = 100; setState(f, 'air'); }
}

function pushApart(s) {
  const [a, b] = s.fighters;
  if (!a || !b || a.state === 'ko' || b.state === 'ko') return;
  const ca = CHARS[a.c], cb = CHARS[b.c];
  const need = (ca.w + cb.w) / 2 * .7, dx = b.x - a.x;
  if (Math.abs(dx) < need && a.y - ca.h < b.y && b.y - cb.h < a.y) {
    const push = (need - Math.abs(dx)) / 4, d = dx >= 0 ? 1 : -1;
    a.x -= d * push; b.x += d * push;
  }
}

// ---------- slag og skade ----------
function hurtRect(f) { const C = CHARS[f.c]; return { x: f.x - C.w / 2, y: f.y - C.h, w: C.w, h: C.h }; }
function boxRect(f, b) { return { x: f.face > 0 ? f.x + b.x : f.x - b.x - b.w, y: f.y + b.y, w: b.w, h: b.h }; }
function overlap(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

function tryHit(s, f, o, box, dmg, kb) {
  if (!o || o.state === 'ko' || o.inv > 0) return false;
  const r = boxRect(f, box);
  if (!overlap(r, hurtRect(o))) return false;
  f.hit = true;
  const dir = o.x >= f.x ? 1 : -1;
  const h = hurtRect(o);
  applyHit(s, o, dmg, kb[0] * dir, kb[1], (Math.max(r.x, h.x) + Math.min(r.x + r.w, h.x + h.w)) / 2, (Math.max(r.y, h.y) + Math.min(r.y + r.h, h.y + h.h)) / 2, f.x);
  return true;
}

function applyHit(s, o, dmg, kx, ky, hx, hy, fromX) {
  const C = CHARS[o.c], side = fromX >= o.x ? 1 : -1;
  if (o.state === 'block' && o.face === side) {
    o.hp = Math.max(0, o.hp - Math.ceil(dmg * .15));
    o.vx = kx * .4;
    s.hitstop = 3;
    ev(s, { t: 'block', x: hx, y: hy });
    return;
  }
  o.hp = Math.max(0, o.hp - dmg);
  o.vx = kx / C.weight; o.vy = ky / C.weight;
  if (o.vy < 0) o.onGround = false;
  o.hitstun = Math.round(12 + dmg * 1.3);
  o.state = 'hurt'; o.st = 0; o.flash = 7; o.noGrav = false; o.glide = false; o.face = side;
  s.hitstop = dmg >= 10 ? 8 : 5;
  ev(s, { t: 'hit', x: hx, y: hy, big: dmg >= 10 });
}

function projRect(p) {
  return p.type === 'wave'
    ? { x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h }
    : { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
}
function updateProjectiles(s) {
  const plats = platsAt(MAPS[s.map], s.tick);
  s.projectiles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.life--;
    if (p.type === 'wave') {
      const pl = plats[p.plat];
      if (!pl || p.x < pl.x || p.x > pl.x + pl.w) { p.life = 0; ev(s, { t: 'puff', x: p.x, y: p.y }); }
      else { p.y = pl.y; if (s.tick % 4 === 0) ev(s, { t: 'puff', x: p.x, y: p.y, small: true }); }
    }
    const o = s.fighters[1 - p.owner];
    if (p.life > 0 && o && o.state !== 'ko' && o.inv <= 0 && overlap(projRect(p), hurtRect(o))) {
      const r = projRect(p);
      applyHit(s, o, p.dmg, p.kb[0] * Math.sign(p.vx || 1), p.kb[1], r.x + r.w / 2, r.y + r.h / 2, p.x - p.vx * 3);
      p.life = 0;
    }
    if (p.x < -60 || p.x > W + 60) p.life = 0;
  });
  s.projectiles = s.projectiles.filter(p => p.life > 0);
}

// ---------- specials ----------
function endSpecial(f) { f.noGrav = false; setState(f, f.onGround ? 'idle' : 'air'); }

const SPECIALS = {
  // Brask: Hornstød — dash frem, også i luften
  brask: {
    start(f) { f.cd = 55; },
    update(f, o, s) {
      const st = f.st;
      if (st < 7) { f.vx *= .7; if (f.vy > 0) f.vy *= .5; }
      else if (st < 23) {
        f.noGrav = true; f.vx = f.face * 12.5; f.vy = 0;
        if (!f.hit) tryHit(s, f, o, { x: 6, y: -78, w: 42, h: 60 }, 11, [9, -5]);
        if (st % 3 === 0) ev(s, { t: 'dash', x: f.x - f.face * 20, y: f.y - 30 });
      } else {
        f.noGrav = false; f.vx *= .82;
        if (st >= 34) endSpecial(f);
      }
    },
  },
  // Pip: Fjerkast — projektil
  pip: {
    start(f) { f.cd = 28; },
    update(f, o, s) {
      if (f.st === 7) {
        s.projectiles.push({ type: 'feather', owner: f.idx, x: f.x + f.face * 22, y: f.y - 30, vx: f.face * 9.5, vy: 0, w: 24, h: 14, dmg: 6, kb: [4, -3], life: 70 });
        if (!f.onGround) f.vy = Math.min(f.vy, -3);
      }
      if (f.onGround) f.vx *= .8;
      if (f.st >= 20) endSpecial(f);
    },
  },
  // Grumhal: Jordskælv — chokbølger; i luften styrtdykker han først
  grum: {
    start(f) { f.cd = 90; f.spAir = !f.onGround; f.quaked = false; },
    update(f, o, s) {
      const st = f.st;
      if (!f.quaked) {
        if (f.spAir) {
          if (st < 10) { f.vx *= .8; f.vy = -1; }
          else { f.vy = 17; f.vx *= .92; if (f.onGround) quake(f, o, s); }
          if (st > 120) endSpecial(f);
        } else {
          f.vx *= .7;
          if (st >= 22) quake(f, o, s);
        }
      } else if (st >= f.endAt) endSpecial(f);
    },
  },
  // Nattevæver: Skyggespring — teleport
  nat: {
    start(f) { f.cd = 60; f.inv = Math.max(f.inv, 22); },
    update(f, o, s, I) {
      const st = f.st;
      f.noGrav = true; f.vx *= .6; f.vy *= .5;
      if (st === 10) {
        let dx = (I.right ? 1 : 0) - (I.left ? 1 : 0);
        let dy = I.up ? -1 : (I.down ? 1 : 0);
        if (f.onGround && dy > 0) dy = 0;
        if (!dx && !dy) dx = f.face;
        const len = Math.hypot(dx, dy), dist = 170;
        ev(s, { t: 'tele', x: f.x, y: f.y - 55 });
        f.x = Math.max(20, Math.min(W - 20, f.x + dx / len * dist));
        f.y += dy / len * dist * .8;
        if (dx) f.face = dx > 0 ? 1 : -1;
        f.onGround = false; f.vy = 0;
        ev(s, { t: 'tele', x: f.x, y: f.y - 55 });
      }
      if (st >= 22) endSpecial(f);
    },
  },
};

function quake(f, o, s) {
  f.quaked = true; f.endAt = f.st + 22;
  ev(s, { t: 'quake', x: f.x, y: f.y });
  for (const d of [-1, 1]) {
    s.projectiles.push({ type: 'wave', owner: f.idx, x: f.x + d * 34, y: f.y, vx: d * 7, vy: 0, w: 34, h: 34, dmg: 12, kb: [6, -8], life: 60, plat: f.plat });
  }
  tryHit(s, f, o, { x: -70, y: -36, w: 140, h: 36 }, 8, [5, -7]);
}
