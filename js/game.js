// game.js — rules and physics.
// Runs on the host (or locally). Online guests only receive the result.

const BTN = ['left', 'right', 'up', 'down', 'attack', 's1', 's2', 's3'];
const ROUND_TIME = 60 * 60;   // 60 seconds
const FALL_DAMAGE = 15;       // HP lost when falling off the stage
const WINS_NEEDED = 2;
const COMBO_WINDOW = 40;      // how long you have to continue the combo after a hit (frames, ~0.67 s)

function newState(mode, online) {
  const n = mode === '2v2' ? 4 : 2;
  const defaults = [0, 2, 5, 3];
  const players = [];
  for (let i = 0; i < n; i++) players.push({ char: defaults[i], ready: false, team: n === 2 ? i : i % 2, cpu: false });
  return {
    mode, online: !!online, requireHumans: !!online && mode === '1v1', code: '',
    screen: 'select', tick: 0, players,
    map: mode === '2v2' ? MAPS.findIndex(m => m.large) : 0,
    fighters: [], projectiles: [], events: [],
    round: 1, wins: [0, 0], timer: 0, phase: '', phaseT: 0,
    roundWinner: -1, koTime: false, winner: -1,
    prevIn: players.map(() => ({})),
  };
}
// What gets sent to online guests (everything except the host's own button history)
function snapshot(s) {
  const o = {};
  for (const k in s) if (k !== 'prevIn') o[k] = s[k];
  return o;
}
function setCpu(s, i, cpu) {
  const P = s.players[i];
  if (!P || P.cpu === cpu) return;
  P.cpu = cpu;
  if (cpu) { P.ready = true; P.char = Math.floor(Math.random() * CHARS.length); }
  else P.ready = false;
}

function setState(f, st) { if (f.state !== st) { f.state = st; f.st = 0; } }
function ev(s, e) { s.events.push(e); }
function dirOf(inp) { return (inp.right ? 1 : 0) - (inp.left ? 1 : 0); }

function step(s, inp) {
  s.events = []; s.tick++;
  const I = [], P = [];
  s.players.forEach((_, i) => {
    const x = inp[i] || {}, prev = s.prevIn[i] || {}, o = {}, q = {};
    BTN.forEach(k => { o[k] = !!x[k]; q[k] = o[k] && !prev[k]; });
    I.push(o); P.push(q);
  });
  s.prevIn = I;
  if (s.screen === 'select') stepSelect(s, P);
  else if (s.screen === 'map') stepMap(s, P);
  else if (s.screen === 'fight') stepFight(s, I, P);
  else if (s.screen === 'result') stepResult(s, P);
}

// ---------- menus ----------
const COLS = 4;
function stepSelect(s, P) {
  const N = CHARS.length, rows = Math.ceil(N / COLS);
  s.players.forEach((pl, i) => {
    if (pl.cpu) { pl.ready = true; return; }
    const p = P[i], skill = p.s1 || p.s2 || p.s3;
    if (!pl.ready) {
      const col = pl.char % COLS, row = Math.floor(pl.char / COLS);
      if (p.left) pl.char = row * COLS + (col + COLS - 1) % COLS;
      if (p.right) pl.char = row * COLS + (col + 1) % COLS;
      if (p.up || p.down) pl.char = ((row + 1) % rows) * COLS + col;
      if (p.attack) { pl.ready = true; ev(s, { t: 'ok' }); }
      else if (skill && s.mode === '2v2') switchTeam(s, i);
    } else if (skill) pl.ready = false;
  });
  const humans = s.players.filter(p => !p.cpu).length;
  const waiting = s.requireHumans && s.players.some(p => p.cpu);
  if (humans > 0 && !waiting && s.players.every(p => p.ready)) s.screen = 'map';
}
function switchTeam(s, i) {
  const P = s.players[i], nt = 1 - P.team;
  const others = s.players.map((_, j) => j).filter(j => s.players[j].team === nt);
  const cpu = others.find(j => s.players[j].cpu);
  const j = cpu !== undefined ? cpu : others[0];
  if (j === undefined) return;
  s.players[j].team = P.team; P.team = nt;
}
function stepMap(s, P) {
  const M = MAPS.length;
  for (let i = 0; i < s.players.length; i++) {
    if (s.players[i].cpu) continue;
    if (P[i].left) s.map = (s.map + M - 1) % M;
    if (P[i].right) s.map = (s.map + 1) % M;
    if (P[i].attack) { startMatch(s); return; }
    if (P[i].s1 || P[i].s2 || P[i].s3) { s.screen = 'select'; s.players.forEach(p => { if (!p.cpu) p.ready = false; }); return; }
  }
}
function stepResult(s, P) {
  if (s.phaseT++ < 60) return;
  if (s.players.some((p, i) => !p.cpu && P[i].attack)) {
    s.screen = 'select'; s.players.forEach(p => { if (!p.cpu) p.ready = false; });
    s.fighters = []; s.projectiles = [];
  }
}

// ---------- fight ----------
function startMatch(s) {
  s.wins = [0, 0]; s.round = 1; s.winner = -1; s.screen = 'fight';
  startRound(s);
}
function makeFighter(ci, i, team, sp, m) {
  const C = CHARS[ci];
  return {
    c: ci, idx: i, team, x: sp[0], y: sp[1] - 1, vx: 0, vy: 0, face: sp[0] < m.world.w / 2 ? 1 : -1,
    hp: C.hp, onGround: false, plat: -1, jumps: C.jumps, state: 'air', st: 0,
    move: null, hitSet: [], buf: 0, atkCd: 0, cds: [0, 0, 0], airUsed: [false, false, false], sk: -1,
    hitstun: 0, blockstun: 0, inv: 0, flash: 0, dropT: 0, landT: 0, hs: 0,
    glide: false, noGrav: false, armor: false, quaked: false, spAir: false, endAt: 0, gone: false,
    comboNext: null, comboT: 0, moltenT: 0, stealthT: 0, zip: null,
  };
}
function startRound(s) {
  const m = MAPS[s.map], order = [0, 0];
  s.fighters = s.players.map((P, i) => {
    const k = order[P.team]++;
    return makeFighter(P.char, i, P.team, m.spawns[(P.team + 2 * k) % m.spawns.length], m);
  });
  s.projectiles = [];
  s.phase = 'intro'; s.phaseT = 0; s.timer = ROUND_TIME;
  s.roundWinner = -1; s.koTime = false;
}
function endRound(s, w, time) {
  s.phase = 'ko'; s.phaseT = 0; s.roundWinner = w; s.koTime = time;
  if (w >= 0) s.wins[w]++;
  s.fighters.forEach(f => { if (f.hp <= 0 && f.state !== 'ko') { f.state = 'ko'; f.st = 0; f.noGrav = false; } });
  s.projectiles = [];
  ev(s, { t: 'ko' });
}

function stepFight(s, I, P) {
  s.phaseT++;
  const none = s.players.map(() => ({}));
  if (s.phase === 'intro') {
    updateFighters(s, none, none);
    if (s.phaseT >= 100) { s.phase = 'fight'; s.phaseT = 0; ev(s, { t: 'go' }); }
    return;
  }
  if (s.phase === 'fight') {
    s.timer--;
    updateFighters(s, I, P);
    updateProjectiles(s);
    s.fighters.forEach(f => {
      if (f.hp <= 0 && f.state !== 'ko') {
        f.state = 'ko'; f.st = 0; f.noGrav = false; f.move = null;
        ev(s, { t: 'down', x: f.x, y: f.y });
      }
    });
    const alive = [0, 1].map(t => s.fighters.some(f => f.team === t && f.hp > 0));
    if (!alive[0] || !alive[1]) endRound(s, alive[0] ? 0 : alive[1] ? 1 : -1, false);
    else if (s.timer <= 0) {
      const r = [0, 1].map(t => {
        const fs = s.fighters.filter(f => f.team === t);
        return fs.reduce((a, f) => a + f.hp, 0) / fs.reduce((a, f) => a + CHARS[f.c].hp, 0);
      });
      endRound(s, Math.abs(r[0] - r[1]) < 1e-6 ? -1 : r[0] > r[1] ? 0 : 1, true);
    }
    return;
  }
  if (s.phase === 'ko') {
    updateFighters(s, none, none);
    updateProjectiles(s);
    if (s.phaseT >= 160) {
      if (s.wins[0] >= WINS_NEEDED || s.wins[1] >= WINS_NEEDED || s.round >= 5) {
        s.screen = 'result'; s.phaseT = 0;
        s.winner = s.wins[0] > s.wins[1] ? 0 : s.wins[1] > s.wins[0] ? 1 : -1;
      } else { s.round++; startRound(s); }
    }
  }
}

function nearestEnemy(s, f) {
  let o = null, best = 1e9;
  for (const e of s.fighters) {
    if (e.team === f.team || e.state === 'ko' || e.gone) continue;
    const d = Math.abs(e.x - f.x) + Math.abs(e.y - f.y) * .7;
    if (d < best) { best = d; o = e; }
  }
  return o;
}

function updateFighters(s, I, P) {
  const m = MAPS[s.map], plats = platsAt(m, s.tick);
  s.fighters.forEach((f, i) => {
    if (f.gone) return;
    const C = CHARS[f.c], inp = I[i] || {}, pr = P[i] || {};
    if (pr.attack) f.buf = 8; else if (f.buf > 0) f.buf--;
    if (f.hs > 0) { f.hs--; return; }   // hit-stop: a tiny freeze when a hit lands
    f.st++;
    if (f.flash > 0) f.flash--;
    if (f.inv > 0) f.inv--;
    if (f.atkCd > 0) f.atkCd--;
    for (let k = 0; k < 3; k++) if (f.cds[k] > 0) f.cds[k]--;
    if (f.dropT > 0) f.dropT--;
    if (f.landT > 0) f.landT--;
    if (f.comboT > 0) f.comboT--;
    if (f.stealthT > 0) f.stealthT--;
    if (f.moltenT > 0) {
      f.moltenT--;
      if (s.tick % 20 === 0) for (const o of s.fighters) {   // Molten Core: touching Magmor burns
        if (o.team === f.team || o.state === 'ko' || o.gone || o.inv > 0) continue;
        const r = hurtRect(f), h = hurtRect(o);
        if (overlap({ x: r.x - 14, y: r.y - 10, w: r.w + 28, h: r.h + 10 }, h)) chip(s, o, 2);
      }
    }
    if (f.state === 'hurt') { f.hitstun--; if (f.hitstun <= 0) setState(f, f.onGround ? 'idle' : 'air'); }
    if (f.state === 'block' && f.blockstun > 0) f.blockstun--;

    if (f.state === 'idle' || f.state === 'run' || f.state === 'air' || f.state === 'block') control(s, f, C, inp, pr, plats);

    if (f.state === 'attack') updateAttack(s, f, C);
    else if (f.state === 'skill') SKILLS[C.id][f.sk].update(f, s, inp, C);

    f.glide = !!C.glide && f.state === 'air' && !!inp.up && f.vy > 0;
    physics(s, f, C, plats);
    const wb = m.world;
    if (f.y > wb.h + 200 || f.x < -220 || f.x > wb.w + 220) fellOff(s, f, m);
  });
  pushApart(s);
}

function control(s, f, C, inp, pr, plats) {
  if (f.state === 'block' && f.blockstun > 0) return;
  const o = nearestEnemy(s, f);
  // melee combo (one button)
  if (pr.attack && f.atkCd <= 0) { startMove(f, f.comboT > 0 && f.comboNext ? f.comboNext : 'jab1'); return; }
  // three extra attacks
  for (let k = 0; k < 3; k++) {
    if (!pr['s' + (k + 1)] || f.cds[k] > 0) continue;
    if (C.skills[k].air && !f.onGround && f.airUsed[k]) continue;
    startSkill(s, f, C, k);
    return;
  }
  // block: hold down on the ground
  if (f.onGround && inp.down && !inp.up) {
    setState(f, 'block'); if (o) f.face = o.x >= f.x ? 1 : -1; f.vx *= .6;
    return;
  }
  if (f.state === 'block') setState(f, 'idle');

  const dir = dirOf(inp);
  if (f.onGround) { f.vx += (dir * C.speed - f.vx) * .3; f.face = dir || (o ? (o.x >= f.x ? 1 : -1) : f.face); }
  else { f.vx += (dir * C.speed - f.vx) * .1; if (dir) f.face = dir; }

  if (pr.up) {
    const pl = plats[f.plat];
    if (f.onGround && inp.down && pl && !pl.solid) {            // drop through a platform
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
}

// ---------- melee combo ----------
function startMove(f, name) { f.state = 'attack'; f.move = name; f.st = 0; f.hitSet = []; f.buf = 0; f.comboT = 0; }
function updateAttack(s, f, C) {
  const mv = C.moves[f.move];
  if (!mv) { setState(f, 'idle'); return; }
  const [S, A, R] = mv.f;
  f.vx *= f.onGround ? .8 : .97;
  if (f.st >= S && f.st < S + A && hitEnemies(s, f, mv.box, mv.dmg + (f.stealthT > 0 ? 4 : 0), mv.kb)) f.stealthT = 0;
  if (mv.next && f.buf > 0 && f.st >= S + A) { startMove(f, mv.next); return; }   // continue the combo
  if (f.st >= S + A + R) {
    if (mv.next) { f.comboNext = mv.next; f.comboT = COMBO_WINDOW; }   // wait a moment and the combo continues
    else { f.comboNext = null; f.atkCd = mv.cd; }                      // the big hit gives a short pause
    f.move = null;
    setState(f, f.onGround ? 'idle' : 'air');
  }
}

// ---------- physics ----------
function physics(s, f, C, plats) {
  const was = f.onGround;
  if (was && plats[f.plat] && plats[f.plat].dx) f.x += plats[f.plat].dx;   // ride moving platforms
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
          f.jumps = C.jumps; f.landT = 6; f.airUsed = [false, false, false];
          if (f.state === 'air') setState(f, 'idle');
          if (f.state !== 'ko') ev(s, { t: 'land', x: f.x, y: f.y });
        }
        break;
      }
    }
  }
  if (!f.onGround && (f.state === 'idle' || f.state === 'run' || f.state === 'block')) setState(f, 'air');
}

function fellOff(s, f, m) {
  const wb = m.world;
  ev(s, { t: 'fall', x: Math.max(20, Math.min(wb.w - 20, f.x)), y: Math.min(wb.h - 10, Math.max(10, f.y)) });
  if (f.state === 'ko') { f.gone = true; return; }
  if (s.phase === 'fight') f.hp = Math.max(0, f.hp - FALL_DAMAGE);
  f.x = m.respawn[0] + [-40, 40, -90, 90][f.idx % 4]; f.y = m.respawn[1]; f.vx = 0; f.vy = 0;
  f.onGround = false; f.noGrav = false; f.armor = false; f.move = null; f.sk = -1;
  f.jumps = CHARS[f.c].jumps; f.airUsed = [false, false, false];
  f.inv = 100; f.state = 'air'; f.st = 0;
}

function pushApart(s) {
  const fs = s.fighters.filter(f => f.state !== 'ko' && !f.gone);
  for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
    const a = fs[i], b = fs[j], ca = CHARS[a.c], cb = CHARS[b.c];
    const need = (ca.w + cb.w) / 2 * .7, dx = b.x - a.x;
    if (Math.abs(dx) < need && a.y - ca.h < b.y && b.y - cb.h < a.y) {
      const push = (need - Math.abs(dx)) / 4, d = dx >= 0 ? 1 : -1;
      a.x -= d * push; b.x += d * push;
    }
  }
}

// ---------- hits and damage ----------
function hurtRect(f) { const C = CHARS[f.c]; return { x: f.x - C.w / 2, y: f.y - C.h, w: C.w, h: C.h }; }
function boxRect(f, b) { return { x: f.face > 0 ? f.x + b.x : f.x - b.x - b.w, y: f.y + b.y, w: b.w, h: b.h }; }
function overlap(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
function hasArmor(o) {
  if (o.state === 'skill') return o.armor;
  if (o.state !== 'attack' || !o.move) return false;
  const mv = CHARS[o.c].moves[o.move];
  return !!mv.armor && o.st < mv.f[0] + mv.f[1];
}

function hitEnemies(s, f, box, dmg, kb, opts) {
  opts = opts || {};
  const r = boxRect(f, box);
  let any = false;
  for (const o of s.fighters) {
    if (o === f || o.team === f.team || o.state === 'ko' || o.gone || o.inv > 0 || f.hitSet.includes(o.idx)) continue;
    if (opts.single && f.lock >= 0 && o.idx !== f.lock) continue;   // this attack only hits one enemy
    const h = hurtRect(o);
    if (!overlap(r, h)) continue;
    f.hitSet.push(o.idx);
    if (opts.single) f.lock = o.idx;
    const dir = opts.radial ? (o.x >= f.x ? 1 : -1) : f.face;
    const hx = (Math.max(r.x, h.x) + Math.min(r.x + r.w, h.x + h.w)) / 2;
    const hy = (Math.max(r.y, h.y) + Math.min(r.y + r.h, h.y + h.h)) / 2;
    applyHit(s, o, dmg, kb[0] * dir, kb[1], hx, hy, f.x, opts);
    f.hs = Math.max(f.hs, o.hs);
    any = true;
  }
  return any;
}

function applyHit(s, o, dmg, kx, ky, hx, hy, fromX, opts) {
  opts = opts || {};
  const C = CHARS[o.c], side = fromX >= o.x ? 1 : -1;
  if (o.state === 'block' && o.face === side) {
    o.hp = Math.max(0, o.hp - Math.ceil(dmg * .15));
    o.vx = kx * .4; o.blockstun = 8; o.hs = 3;
    ev(s, { t: 'block', x: hx, y: hy });
    return 'block';
  }
  if ((hasArmor(o) && dmg < 7) || (o.moltenT > 0 && dmg < 10)) {   // heavy attacks can't be interrupted by small hits
    o.hp = Math.max(0, o.hp - dmg); o.flash = 4; o.hs = 3;
    ev(s, { t: 'armor', x: hx, y: hy });
    return 'armor';
  }
  o.hp = Math.max(0, o.hp - dmg);
  o.vx = kx / C.weight; o.vy = ky / C.weight;
  if (o.vy < 0) o.onGround = false;
  o.hitstun = opts.stun || Math.round((8 + dmg * 1.6) / Math.sqrt(C.weight));
  o.state = 'hurt'; o.st = 0; o.move = null; o.sk = -1;
  o.flash = 6; o.noGrav = false; o.glide = false; o.armor = false; o.face = side;
  o.comboT = 0; o.stealthT = 0; o.zip = null;
  o.hs = dmg >= 10 ? 7 : dmg >= 6 ? 5 : 3;
  ev(s, { t: opts.stun ? 'snare' : 'hit', x: hx, y: hy, big: dmg >= 10, magic: !!opts.magic });
  return 'hit';
}


// ---------- projectiles ----------
function chip(s, o, dmg) {   // damage without stun (fire, curses)
  o.hp = Math.max(0, o.hp - dmg); o.flash = Math.max(o.flash, 3);
  ev(s, { t: 'burn', x: o.x, y: o.y - CHARS[o.c].h * .5 });
}
function projRect(p) {
  if (p.ground || p.anchor === 'bottom') return { x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h };
  return { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
}
function spawnProj(s, f, p) { p.owner = f.idx; p.team = f.team; p.age = 0; p.hitSet = []; if (!p.area && !p.group) p.group = { lock: -1 }; s.projectiles.push(p); return p; }
function reflectShots(s, f, box) {   // Rook's shield sends shots back
  const r = boxRect(f, box);
  for (const p of s.projectiles) {
    if (p.team === f.team || !p.reflect || !overlap(projRect(p), r)) continue;
    p.vx = -p.vx * 1.1; if (p.dir0) p.dir0 = -p.dir0;
    p.team = f.team; p.owner = f.idx; p.hitSet = []; if (p.group) p.group = { lock: -1 }; p.life = Math.max(p.life, 40);
    ev(s, { t: 'block', x: p.x, y: p.y });
  }
}

function updateProjectiles(s) {
  const m = MAPS[s.map], plats = platsAt(m, s.tick), wb = m.world, born = [];
  s.projectiles.forEach(p => {
    p.life--; p.age++;
    const owner = s.fighters[p.owner];
    if (p.type === 'decoy') {   // Kitsu's decoy explodes when its time is up
      if (p.life <= 0) {
        ev(s, { t: 'boom', x: p.x, y: p.y - 40 });
        let o = null, best = 85;   // only the closest enemy gets hit
        for (const e of s.fighters) {
          if (e.team === p.team || e.state === 'ko' || e.gone || e.inv > 0) continue;
          const d = Math.hypot(e.x - p.x, (e.y - CHARS[e.c].h / 2) - (p.y - 40));
          if (d < best) { best = d; o = e; }
        }
        if (o) applyHit(s, o, 11, (o.x >= p.x ? 1 : -1) * 7, -6, o.x, o.y - CHARS[o.c].h * .5, p.x, { magic: true });
      }
      return;
    }
    if (p.type === 'magma') p.vy += .45;
    if (p.type === 'raven') {   // flies out, slows down and comes back like a boomerang
      p.vx -= p.dir0 * .26;
      p.y = p.y0 + Math.sin(p.age * .22) * 10;
      if (p.lastVx && Math.sign(p.vx) !== Math.sign(p.lastVx)) p.hitSet = [];
      p.lastVx = p.vx;
      if (owner && Math.sign(p.vx) === -p.dir0 && Math.abs(owner.x - p.x) < 24 && Math.abs(owner.y - CHARS[owner.c].h * .7 - p.y) < 60) p.life = 0;
    }
    if (p.type === 'wisp') {    // circles around Kitsu
      if (!owner || owner.state === 'ko' || owner.gone) { p.life = 0; return; }
      const a = p.a0 + p.age * .09;
      p.x = owner.x + Math.cos(a) * 48; p.y = owner.y - CHARS[owner.c].h * .5 + Math.sin(a) * 36;
    }
    p.x += p.vx; p.y += p.vy;
    if (p.ground) {
      const pl = plats[p.plat];
      if (!pl || p.x < pl.x - 2 || p.x > pl.x + pl.w + 2) { p.life = 0; if (p.vx) ev(s, { t: 'puff', x: p.x, y: p.y }); }
      else { p.y = pl.y; if (pl.dx) p.x += pl.dx; if (p.type === 'wave' && s.tick % 4 === 0) ev(s, { t: 'puff', x: p.x, y: p.y, small: true }); }
    }
    if (p.type === 'magma' && p.vy > 0) {   // lands and leaves a burning pool
      for (let k = 0; k < plats.length; k++) {
        const pl = plats[k], bottom = p.y + p.h / 2;
        if (p.x > pl.x && p.x < pl.x + pl.w && bottom >= pl.y && bottom - p.vy <= pl.y + 1) {
          p.life = 0; ev(s, { t: 'splash', x: p.x, y: pl.y });
          const px = pl.w < 90 ? pl.x + pl.w / 2 : Math.max(pl.x + 45, Math.min(pl.x + pl.w - 45, p.x));
          born.push({ type: 'pool', area: true, ground: true, plat: k, x: px, y: pl.y, vx: 0, vy: 0, w: 90, h: 22, dmg: 2, chip: true, pierce: true, tickEvery: 20, life: 200, owner: p.owner, team: p.team, age: 0, hitSet: [] });
          break;
        }
      }
    }
    if (p.type === 'harpoon' && p.life > 0 && owner && owner.state === 'skill' && owner.sk === 1 && !owner.onGround && !owner.zip) {
      for (let k = 0; k < plats.length; k++) {   // hook a ledge and pull yourself up
        const pl = plats[k];
        if (overlap(projRect(p), { x: pl.x, y: pl.y - 6, w: pl.w, h: pl.solid ? 70 : 16 })) {
          owner.zip = { x: Math.max(pl.x + 14, Math.min(pl.x + pl.w - 14, p.x)), y: pl.y };
          p.life = 0; ev(s, { t: 'clang', x: p.x, y: p.y }); break;
        }
      }
    }
    if (p.tickEvery && p.age % p.tickEvery === 0) p.hitSet = [];
    if (p.life > 0 && !p.harmless) {
      const r = projRect(p);
      for (const o of s.fighters) {
        if (o.team === p.team || o.state === 'ko' || o.gone || o.inv > 0 || p.hitSet.includes(o.idx)) continue;
        if (p.group && p.group.lock >= 0 && o.idx !== p.group.lock) continue;   // shots only hit one enemy
        if (!overlap(r, hurtRect(o))) continue;
        p.hitSet.push(o.idx);
        if (p.group) p.group.lock = o.idx;
        if (p.chip) { chip(s, o, p.dmg); continue; }
        const dir = p.radial ? (o.x >= p.x ? 1 : -1) : Math.sign(p.vx || (owner ? owner.face : 1));
        const res = applyHit(s, o, p.dmg, p.kb[0] * dir, p.kb[1], o.x - dir * CHARS[o.c].w * .3, Math.max(r.y + 4, o.y - CHARS[o.c].h * .55), p.radial ? p.x : o.x - dir * 10, { stun: p.stun, magic: p.magic });
        if (p.type === 'harpoon' && res === 'hit' && owner) {   // reel the enemy in
          o.vx = (owner.x >= o.x ? 1 : -1) * 7; o.vy = -3; o.hitstun = 18;
          ev(s, { t: 'clang', x: o.x, y: o.y - 40 });
        }
        if (!p.pierce) { p.life = 0; break; }
      }
    }
    if (p.x < -100 || p.x > wb.w + 100 || p.y > wb.h + 150 || p.y < -500) p.life = 0;
  });
  s.projectiles = s.projectiles.filter(p => p.life > 0).concat(born);
}

// ---------- the three extra attacks (Q/E/R) ----------
function startSkill(s, f, C, k) {
  f.state = 'skill'; f.sk = k; f.st = 0; f.hitSet = []; f.lock = -1; f.quaked = false; f.armor = false; f.noGrav = false; f.comboT = 0;
  f.cds[k] = C.skills[k].cd;
  if (C.skills[k].air && !f.onGround) f.airUsed[k] = true;
  SKILLS[C.id][k].start(f, s, C);
}
function endSkill(f) { f.noGrav = false; f.armor = false; f.sk = -1; f.zip = null; setState(f, f.onGround ? 'idle' : 'air'); }
function steer(f, inp, max, k) { f.vx += (dirOf(inp) * max - f.vx) * k; }
function aimDir(f, inp, upBias) {   // the direction the player holds (falls back to forward)
  let dx = dirOf(inp), dy = inp.up ? -1 : (inp.down ? 1 : 0);
  if (f.onGround && dy > 0) dy = 0;
  if (!dx && !dy) { dx = f.face; dy = upBias || 0; }
  const l = Math.hypot(dx, dy);
  if (dx) f.face = dx > 0 ? 1 : -1;
  return [dx / l, dy / l];
}
function hover(f, k) { if (!f.onGround) f.vy *= k; }
const noop = () => {};

const SKILLS = {
  kitsu: [
    { // Foxfire
      start: noop,
      update(f, s) {
        if (f.st < 12) hover(f, .6);
        if (f.st === 8) {
          s.projectiles = s.projectiles.filter(p => !(p.type === 'wisp' && p.owner === f.idx));
          const group = { lock: -1 }; for (let k = 0; k < 3; k++) spawnProj(s, f, { group, type: 'wisp', a0: k * TAU / 3, x: f.x, y: f.y, vx: 0, vy: 0, w: 20, h: 20, dmg: 5, kb: [4, -4], life: 240, magic: true, radial: true });
        }
        if (f.st >= 16) endSkill(f);
      },
    },
    { // Tail Vault
      start(f) { f.vy = -12.5; f.onGround = false; },
      update(f, s, inp) {
        if (f.st === 0) f.vx = (dirOf(inp) || -f.face) * 3.5;   // backflip, or the way you hold
        if (f.st < 20) hitEnemies(s, f, { x: -44, y: -84, w: 70, h: 84 }, 6, [5, -6], { radial: true, single: true });
        else endSkill(f);
      },
    },
    { // Mirage
      start(f, s) {
        f.inv = Math.max(f.inv, 16);
        spawnProj(s, f, { type: 'decoy', x: f.x, y: f.y, vx: 0, vy: 0, w: 10, h: 10, harmless: true, life: 70, c: f.c, face: f.face });
        ev(s, { t: 'tele', x: f.x, y: f.y - 40 });
      },
      update(f) {
        if (f.st < 10) { f.noGrav = true; f.vy = 0; f.vx = f.face * 17; }
        else { f.noGrav = false; f.vx *= .8; if (f.st >= 18) endSkill(f); }
      },
    },
  ],
  rook: [
    { // Rocket Fist
      start: noop,
      update(f, s) {
        f.vx *= .7; if (f.st < 10) hover(f, .6);
        if (f.st === 8) spawnProj(s, f, { type: 'fist', x: f.x + f.face * 30, y: f.y - 48, vx: f.face * 13, vy: 0, w: 28, h: 20, dmg: 8, kb: [8, -4], life: 48, reflect: true });
        if (f.st >= 22) endSkill(f);
      },
    },
    { // Jet Boost
      start(f) { f.vy = Math.min(f.vy, -3); f.onGround = false; },
      update(f, s, inp) {
        if (f.st < 36) {
          f.noGrav = true; f.vy = Math.max(f.vy - .85, -8); steer(f, inp, 4.5, .15);
          hitEnemies(s, f, { x: -22, y: -10, w: 44, h: 36 }, 4, [2, -4], { radial: true, single: true });
          if (f.st % 2 === 0) ev(s, { t: 'jet', x: f.x - f.face * 18, y: f.y - 36 });
        } else endSkill(f);
      },
    },
    { // Shield Bash
      start(f) { f.armor = true; },
      update(f, s) {
        hover(f, .5);
        if (f.st < 5) f.vx *= .5;
        else if (f.st < 19) {
          f.vx = f.face * 10;
          hitEnemies(s, f, { x: 8, y: -74, w: 40, h: 74 }, 8, [9, -5], { single: true });
          reflectShots(s, f, { x: 4, y: -84, w: 48, h: 84 });
        } else { f.armor = false; f.vx *= .8; if (f.st >= 30) endSkill(f); }
      },
    },
  ],
  magmor: [
    { // Magma Toss
      start(f) { f.armor = true; },
      update(f, s) {
        f.vx *= .7;
        if (f.st === 14) {
          f.armor = false;
          spawnProj(s, f, { type: 'magma', x: f.x + f.face * 30, y: f.y - 120, vx: f.face * 6.5, vy: -8, w: 24, h: 24, dmg: 6, kb: [5, -5], life: 150, reflect: true, magic: true });
        }
        if (f.st >= 30) endSkill(f);
      },
    },
    { // Eruption
      start(f, s) {
        spawnProj(s, f, { type: 'pillar', anchor: 'bottom', x: f.x, y: f.y, vx: 0, vy: 0, w: 54, h: 140, dmg: 7, kb: [2, -10], radial: true, pierce: true, life: 24, magic: true });
        f.vy = -14.5; f.onGround = false;
        ev(s, { t: 'quake', x: f.x, y: f.y, small: true });
      },
      update(f, s, inp) { steer(f, inp, 3, .08); if (f.st >= 18) endSkill(f); },
    },
    { // Molten Core
      start: noop,
      update(f, s) {
        f.vx *= .6;
        if (f.st === 12) { f.moltenT = 240; ev(s, { t: 'flare', x: f.x, y: f.y - 60 }); }
        if (f.st >= 20) endSkill(f);
      },
    },
  ],
  morwen: [
    { // Raven Call
      start: noop,
      update(f, s) {
        if (f.st < 12) hover(f, .6);
        if (f.st === 9) spawnProj(s, f, { type: 'raven', x: f.x + f.face * 24, y: f.y - 80, y0: f.y - 80, dir0: f.face, vx: f.face * 9, vy: 0, w: 30, h: 22, dmg: 7, kb: [4, -3], life: 80, pierce: true, reflect: true, magic: true });
        if (f.st >= 20) endSkill(f);
      },
    },
    { // Broom Ride
      start: noop,
      update(f, s, inp) {
        if (f.st === 0) { [f.bdx, f.bdy] = aimDir(f, inp, -.5); f.onGround = false; }
        if (f.st <= 30) {
          f.noGrav = true; f.vx = f.bdx * 8.5; f.vy = f.bdy * 8.5;
          hitEnemies(s, f, { x: 0, y: -74, w: 42, h: 64 }, 7, [6, -4], { single: true });
        } else endSkill(f);
      },
    },
    { // Hex Circle
      start: noop,
      update(f, s) {
        f.vx *= .6;
        if (f.st === 12) {
          s.projectiles = s.projectiles.filter(p => !(p.type === 'rune' && p.owner === f.idx));
          spawnProj(s, f, { type: 'rune', area: true, anchor: 'bottom', ground: f.onGround, plat: f.plat, x: f.x, y: f.y, vx: 0, vy: 0, w: 130, h: 50, dmg: 2, chip: true, pierce: true, tickEvery: 15, life: 240 });
        }
        if (f.st >= 22) endSkill(f);
      },
    },
  ],
  nightweaver: [
    { // Shadow Snare
      start: noop,
      update(f, s) {
        hover(f, .6);
        if (f.st === 12) {
          if (f.onGround) spawnProj(s, f, { type: 'snare', ground: true, plat: f.plat, x: f.x + f.face * 30, y: f.y, vx: f.face * 5.5, vy: 0, w: 44, h: 26, dmg: 4, kb: [0, -1], stun: 55, life: 70, magic: true });
          else spawnProj(s, f, { type: 'snare', x: f.x + f.face * 30, y: f.y - 50, vx: f.face * 6, vy: 2, w: 30, h: 24, dmg: 4, kb: [0, -1], stun: 55, life: 70, magic: true, reflect: true });
        }
        if (f.st >= 24) endSkill(f);
      },
    },
    { // Shadow Step
      start(f) { f.inv = Math.max(f.inv, 22); },
      update(f, s, inp) {
        f.noGrav = true; f.vx *= .6; f.vy *= .5;
        if (f.st === 10) {
          const [dx, dy] = aimDir(f, inp, 0), wb = MAPS[s.map].world;
          ev(s, { t: 'tele', x: f.x, y: f.y - 55 });
          f.x = Math.max(20, Math.min(wb.w - 20, f.x + dx * 170));
          f.y += dy * 136;
          f.onGround = false; f.vy = 0;
          ev(s, { t: 'tele', x: f.x, y: f.y - 55 });
        }
        if (f.st >= 22) endSkill(f);
      },
    },
    { // Reaper Spin
      start: noop,
      update(f, s) {
        const st = f.st;
        if (!f.onGround) f.vy = Math.min(f.vy, 1);
        if (st >= 6 && st < 36) {
          f.vx = f.face * 2;
          if ((st - 6) % 6 === 0) f.hitSet = [];
          hitEnemies(s, f, { x: -46, y: -122, w: 92, h: 112 }, 3, [2, -3], { radial: true, single: true });
        } else if (st === 36) {
          f.hitSet = [];
          hitEnemies(s, f, { x: -50, y: -122, w: 100, h: 112 }, 5, [7, -6], { radial: true, single: true });
        }
        if (st >= 44) endSkill(f);
      },
    },
  ],
  lumina: [
    { // Prism Bolt
      start: noop,
      update(f, s) {
        if (f.st < 10) hover(f, .6);
        if (f.st === 9) spawnProj(s, f, { type: 'prism', x: f.x + f.face * 40, y: f.y - 76, vx: f.face * 12, vy: 0, w: 44, h: 12, dmg: 8, kb: [5, -2], life: 60, magic: true, reflect: true });
        if (f.onGround) f.vx *= .8;
        if (f.st >= 22) endSkill(f);
      },
    },
    { // Wings of Light
      start(f) { f.vy = -6; f.onGround = false; },
      update(f, s, inp) {
        if (f.st < 32) {
          f.noGrav = true; f.vy = -6.5 + f.st * .13; steer(f, inp, 4, .15);
          hitEnemies(s, f, { x: -28, y: -104, w: 56, h: 100 }, 6, [3, -7], { radial: true, magic: true, single: true });
        } else endSkill(f);
      },
    },
    { // Mend
      start: noop,
      update(f, s, inp, C) {
        f.vx *= .7;
        if (f.st === 40) { f.hp = Math.min(C.hp, f.hp + 15); ev(s, { t: 'heal', x: f.x, y: f.y - 50 }); }
        if (f.st >= 52) endSkill(f);
      },
    },
  ],
  sable: [
    { // Shuriken Fan
      start: noop,
      update(f, s) {
        if (f.st < 10) hover(f, .5);
        if (f.st === 6) { const group = { lock: -1 }; for (const a of [-.22, 0, .22]) spawnProj(s, f, { group, type: 'shuriken', x: f.x + f.face * 16, y: f.y - 56, vx: f.face * 11 * Math.cos(a), vy: 11 * Math.sin(a), w: 16, h: 16, dmg: 4, kb: [3, -2], life: 45, reflect: true }); }
        if (f.st >= 16) endSkill(f);
      },
    },
    { // Shadow Dash
      start(f) { f.inv = Math.max(f.inv, 14); },
      update(f, s, inp) {
        if (f.st === 0) { [f.bdx, f.bdy] = aimDir(f, inp, 0); f.onGround = f.onGround && f.bdy >= 0; }
        if (f.st < 12) {
          f.noGrav = true; f.vx = f.bdx * 13; f.vy = f.bdy * 13;
          hitEnemies(s, f, { x: -20, y: -80, w: 60, h: 80 }, 7, [5, -4], { single: true });
          if (f.st % 2 === 0) ev(s, { t: 'tele', x: f.x, y: f.y - 40, small: true });
        } else {
          if (f.st === 12) { f.vx *= .4; f.vy *= .3; }
          f.noGrav = false;
          if (f.st >= 16) endSkill(f);
        }
      },
    },
    { // Smoke Bomb
      start: noop,
      update(f, s) {
        if (f.st === 4) {
          spawnProj(s, f, { type: 'smoke', anchor: 'bottom', x: f.x, y: f.y, vx: 0, vy: 0, w: 150, h: 120, harmless: true, life: 120 });
          f.stealthT = 240;
          ev(s, { t: 'smoke', x: f.x, y: f.y - 40 });
        }
        if (f.st >= 12) endSkill(f);
      },
    },
  ],
  tusk: [
    { // Belly Slide
      start: noop,
      update(f, s) {
        const st = f.st;
        if (st < 6) f.vx *= .7;
        else if (st < 36) {
          f.vx = f.face * (11 - (st - 6) * .2);
          if (!f.onGround) f.vy = Math.max(f.vy, 3);
          hitEnemies(s, f, { x: -10, y: -44, w: 74, h: 44 }, 8, [7, -6], { single: true });
          if (st % 4 === 0 && f.onGround) ev(s, { t: 'dash', x: f.x - f.face * 20, y: f.y - 6 });
        } else { f.vx *= .85; if (st >= 46) endSkill(f); }
      },
    },
    { // Harpoon Hook
      start: noop,
      update(f, s, inp) {
        if (f.zip) {   // pulling ourselves to a ledge
          f.noGrav = true;
          const dx = f.zip.x - f.x, dy = (f.zip.y - 1) - f.y, d = Math.hypot(dx, dy);
          if (d < 16) { f.x = f.zip.x; f.y = f.zip.y - 1; f.vx = 0; f.vy = 0; endSkill(f); }
          else { f.vx = dx / d * 15; f.vy = dy / d * 15; }
          return;
        }
        f.vx *= .7; if (f.st < 20) hover(f, .7);
        if (f.st === 8) {
          const a = inp.up ? -.75 : 0;
          spawnProj(s, f, { type: 'harpoon', x: f.x + f.face * 30, y: f.y - 62, vx: f.face * 14 * Math.cos(a), vy: 14 * Math.sin(a), w: 26, h: 12, dmg: 6, kb: [0, -2], life: 24 });
        }
        if (f.st >= 34) endSkill(f);
      },
    },
    { // Winter Horn
      start: noop,
      update(f, s) {
        f.vx *= .6;
        if (f.st === 14) {
          ev(s, { t: 'frost', x: f.x, y: f.y - 50 });
          hitEnemies(s, f, { x: -140, y: -150, w: 280, h: 160 }, 4, [11, -7], { radial: true });
        }
        if (f.st >= 32) endSkill(f);
      },
    },
  ],
};
