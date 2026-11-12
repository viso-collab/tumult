// game.js — rules and physics.
// Runs on the host (or locally). Online guests only receive the result.

const BTN = ['left', 'right', 'up', 'down', 'attack', 's1', 's2', 's3'];
const ROUND_TIME = 60 * 60;   // 60 seconds
const FALL_DAMAGE = 15;       // HP lost when falling off the stage
const WINS_NEEDED = 2;
const COMBO_PAUSE = 10;       // pause after a combo that stopped early (frames)

function newState(mode, online) {
  const n = mode === '2v2' ? 4 : 2;
  const defaults = [0, 2, 4, 5];
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
const COLS = 3;
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
  if (pr.attack && f.atkCd <= 0) { startMove(f, 'jab1'); return; }
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
function startMove(f, name) { f.state = 'attack'; f.move = name; f.st = 0; f.hitSet = []; f.buf = 0; }
function updateAttack(s, f, C) {
  const mv = C.moves[f.move];
  if (!mv) { setState(f, 'idle'); return; }
  const [S, A, R] = mv.f;
  f.vx *= f.onGround ? .8 : .97;
  if (f.st >= S && f.st < S + A) hitEnemies(s, f, mv.box, mv.dmg, mv.kb);
  if (mv.next && f.buf > 0 && f.st >= S + A) { startMove(f, mv.next); return; }   // continue the combo
  if (f.st >= S + A + R) {
    f.atkCd = mv.cd || COMBO_PAUSE;   // the big hit gives a longer pause
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
    const h = hurtRect(o);
    if (!overlap(r, h)) continue;
    f.hitSet.push(o.idx);
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
  if (hasArmor(o) && dmg < 7) {        // heavy attacks can't be interrupted by small hits
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
  o.hs = dmg >= 10 ? 7 : dmg >= 6 ? 5 : 3;
  ev(s, { t: opts.stun ? 'snare' : 'hit', x: hx, y: hy, big: dmg >= 10, magic: !!opts.magic });
  return 'hit';
}

// ---------- projectiles ----------
function projRect(p) {
  if (p.ground) return { x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h };
  if (p.type === 'strike') return { x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h };
  return { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
}
function spawnProj(s, f, p) { p.owner = f.idx; p.team = f.team; p.age = 0; p.hitSet = []; s.projectiles.push(p); }

function updateProjectiles(s) {
  const m = MAPS[s.map], plats = platsAt(m, s.tick), wb = m.world;
  s.projectiles.forEach(p => {
    p.life--; p.age++;
    if (p.type === 'boulder') p.vy += .45;
    if (p.type === 'hexorb') {
      let o = null, best = 1e9;
      for (const e of s.fighters) {
        if (e.team === p.team || e.state === 'ko' || e.gone) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < best) { best = d; o = e; }
      }
      if (o) {
        const dx = o.x - p.x, dy = (o.y - CHARS[o.c].h / 2) - p.y, d = Math.hypot(dx, dy) || 1;
        p.vx += dx / d * .14; p.vy += dy / d * .14;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 3.4) { p.vx *= 3.4 / sp; p.vy *= 3.4 / sp; }
      }
    }
    p.x += p.vx; p.y += p.vy;
    if (p.ground) {
      const pl = plats[p.plat];
      if (!pl || p.x < pl.x || p.x > pl.x + pl.w) { p.life = 0; ev(s, { t: 'puff', x: p.x, y: p.y }); }
      else { p.y = pl.y; if (p.type === 'wave' && s.tick % 4 === 0) ev(s, { t: 'puff', x: p.x, y: p.y, small: true }); }
    }
    if (p.type === 'boulder' && p.vy > 0) {
      for (const pl of plats) {
        const bottom = p.y + p.h / 2;
        if (p.x > pl.x && p.x < pl.x + pl.w && bottom >= pl.y && bottom - p.vy <= pl.y + 1) { p.life = 0; ev(s, { t: 'rock', x: p.x, y: pl.y }); break; }
      }
    }
    if (p.type === 'strike') {
      if (p.life === 8) ev(s, { t: 'bolt', x: p.x, y: p.y });
      if (p.life > 8) return;   // still just a warning marker
    }
    if (p.life > 0) {
      const r = projRect(p);
      for (const o of s.fighters) {
        if (o.team === p.team || o.state === 'ko' || o.gone || o.inv > 0 || p.hitSet.includes(o.idx)) continue;
        if (!overlap(r, hurtRect(o))) continue;
        const dir = p.type === 'strike' ? (o.x >= p.x ? 1 : -1) : Math.sign(p.vx || 1);
        applyHit(s, o, p.dmg, p.kb[0] * dir, p.kb[1], o.x - dir * CHARS[o.c].w * .3, Math.max(r.y + 4, o.y - CHARS[o.c].h * .55), o.x - dir * 10, { stun: p.stun, magic: p.magic });
        p.hitSet.push(o.idx);
        if (!p.pierce) { p.life = 0; break; }
      }
    }
    if (p.x < -100 || p.x > wb.w + 100 || p.y > wb.h + 150) p.life = 0;
  });
  s.projectiles = s.projectiles.filter(p => p.life > 0);
}

// ---------- the three extra attacks (Q/E/R) ----------
function startSkill(s, f, C, k) {
  f.state = 'skill'; f.sk = k; f.st = 0; f.hitSet = []; f.quaked = false; f.armor = false; f.noGrav = false;
  f.cds[k] = C.skills[k].cd;
  if (C.skills[k].air && !f.onGround) f.airUsed[k] = true;
  SKILLS[C.id][k].start(f, s, C);
}
function endSkill(f) { f.noGrav = false; f.armor = false; f.sk = -1; setState(f, f.onGround ? 'idle' : 'air'); }
function steer(f, inp, max, k) { f.vx += (dirOf(inp) * max - f.vx) * k; }
const noop = () => {};

const SKILLS = {
  bramble: [
    { // Horn Charge
      start: noop,
      update(f, s) {
        const st = f.st;
        if (st < 7) { f.vx *= .7; if (f.vy > 0) f.vy *= .5; }
        else if (st < 23) {
          f.noGrav = true; f.vx = f.face * 12.5; f.vy = 0;
          hitEnemies(s, f, { x: 6, y: -80, w: 44, h: 62 }, 10, [9, -5]);
          if (st % 3 === 0) ev(s, { t: 'dash', x: f.x - f.face * 20, y: f.y - 30 });
        } else { f.noGrav = false; f.vx *= .82; if (st >= 34) endSkill(f); }
      },
    },
    { // Scarf Twirl
      start(f) { f.vy = -10; f.onGround = false; f.vx *= .5; },
      update(f, s, inp) {
        if (f.st < 22) {
          f.noGrav = true; f.vy = -9 + f.st * .42; steer(f, inp, 3.5, .15);
          if (f.st % 8 === 0) f.hitSet = [];
          hitEnemies(s, f, { x: -30, y: -84, w: 60, h: 80 }, 3, [3, -8], { radial: true });
        } else endSkill(f);
      },
    },
    { // Thorn Uppercut
      start: noop,
      update(f, s) {
        const st = f.st;
        if (st < 8) f.vx *= .6;
        else if (st < 14) {
          if (st === 8 && f.onGround) { f.vy = -5; f.onGround = false; }
          hitEnemies(s, f, { x: 0, y: -122, w: 48, h: 112 }, 9, [2, -11]);
        }
        if (st >= 30) endSkill(f);
      },
    },
  ],
  pip: [
    { // Feather Shot
      start: noop,
      update(f, s) {
        if (!f.onGround && f.st < 10) f.vy *= .6;
        if (f.st === 7) spawnProj(s, f, { type: 'feather', x: f.x + f.face * 22, y: f.y - 30, vx: f.face * 10, vy: 0, w: 24, h: 14, dmg: 6, kb: [4, -3], life: 70 });
        if (f.onGround) f.vx *= .8;
        if (f.st >= 20) endSkill(f);
      },
    },
    { // Updraft
      start(f) { f.vy = -13.5; f.onGround = false; },
      update(f, s, inp) {
        steer(f, inp, 4, .12);
        if (f.st < 14) hitEnemies(s, f, { x: -22, y: -64, w: 44, h: 56 }, 3, [1, -7], { radial: true });
        else endSkill(f);
      },
    },
    { // Dive Bomb
      start(f) { if (f.onGround) { f.vy = -7; f.onGround = false; } },
      update(f, s) {
        const st = f.st;
        if (st < 6) { f.vy *= .5; f.vx *= .5; return; }
        f.noGrav = true; f.vx = f.face * 8; f.vy = 7;
        if (hitEnemies(s, f, { x: 4, y: -50, w: 40, h: 46 }, 8, [6, -5])) { f.vy = -7; f.vx = -f.face * 2; endSkill(f); return; }
        if ((f.onGround && st > 8) || st >= 40) { if (f.onGround) ev(s, { t: 'land', x: f.x, y: f.y }); endSkill(f); }
      },
    },
  ],
  grimjaw: [
    { // Earthquake
      start(f) { f.spAir = !f.onGround; f.armor = true; },
      update(f, s) {
        const st = f.st;
        if (!f.quaked) {
          if (f.spAir) {
            if (st < 10) { f.vx *= .8; f.vy = -1; }
            else { f.vy = 17; f.vx *= .92; if (f.onGround) quake(f, s); }
            if (st > 120) endSkill(f);
          } else { f.vx *= .7; if (st >= 22) quake(f, s); }
        } else if (st >= f.endAt) endSkill(f);
      },
    },
    { // Titan Leap
      start(f) { f.vy = -14; f.vx = f.face * 4.5; f.onGround = false; },
      update(f, s) {
        if (!f.quaked) {
          if (f.vy > 0) f.vy = Math.min(f.vy + .5, 16);
          if (f.onGround && f.st > 6) {
            f.quaked = true; f.endAt = f.st + 16;
            hitEnemies(s, f, { x: -64, y: -50, w: 128, h: 50 }, 11, [6, -8], { radial: true });
            ev(s, { t: 'quake', x: f.x, y: f.y, small: true });
          }
          if (f.st > 150) endSkill(f);
        } else if (f.st >= f.endAt) endSkill(f);
      },
    },
    { // Boulder Toss
      start(f) { f.armor = true; },
      update(f, s) {
        f.vx *= .7;
        if (f.st === 16) {
          f.armor = false;
          spawnProj(s, f, { type: 'boulder', x: f.x + f.face * 30, y: f.y - 120, vx: f.face * 7, vy: -7, w: 32, h: 32, dmg: 13, kb: [7, -6], life: 150 });
        }
        if (f.st >= 34) endSkill(f);
      },
    },
  ],
  nightweaver: [
    { // Shadow Snare
      start: noop,
      update(f, s) {
        if (!f.onGround) f.vy *= .6;
        if (f.st === 12) {
          if (f.onGround) spawnProj(s, f, { type: 'snare', ground: true, plat: f.plat, x: f.x + f.face * 30, y: f.y, vx: f.face * 5.5, vy: 0, w: 44, h: 26, dmg: 4, kb: [0, -1], stun: 55, life: 70, magic: true });
          else spawnProj(s, f, { type: 'snare', x: f.x + f.face * 30, y: f.y - 50, vx: f.face * 6, vy: 2, w: 30, h: 24, dmg: 4, kb: [0, -1], stun: 55, life: 70, magic: true });
        }
        if (f.st >= 24) endSkill(f);
      },
    },
    { // Shadow Step
      start(f) { f.inv = Math.max(f.inv, 22); },
      update(f, s, inp) {
        const st = f.st;
        f.noGrav = true; f.vx *= .6; f.vy *= .5;
        if (st === 10) {
          let dx = dirOf(inp), dy = inp.up ? -1 : (inp.down ? 1 : 0);
          if (f.onGround && dy > 0) dy = 0;
          if (!dx && !dy) dx = f.face;
          const len = Math.hypot(dx, dy), dist = 170, wb = MAPS[s.map].world;
          ev(s, { t: 'tele', x: f.x, y: f.y - 55 });
          f.x = Math.max(20, Math.min(wb.w - 20, f.x + dx / len * dist));
          f.y += dy / len * dist * .8;
          if (dx) f.face = dx > 0 ? 1 : -1;
          f.onGround = false; f.vy = 0;
          ev(s, { t: 'tele', x: f.x, y: f.y - 55 });
        }
        if (st >= 22) endSkill(f);
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
          hitEnemies(s, f, { x: -46, y: -122, w: 92, h: 112 }, 3, [2, -3], { radial: true });
        } else if (st === 36) {
          f.hitSet = [];
          hitEnemies(s, f, { x: -50, y: -122, w: 100, h: 112 }, 5, [7, -6], { radial: true });
        }
        if (st >= 44) endSkill(f);
      },
    },
  ],
  lumina: [
    { // Prism Bolt
      start: noop,
      update(f, s) {
        if (!f.onGround && f.st < 10) f.vy *= .6;
        if (f.st === 9) spawnProj(s, f, { type: 'prism', x: f.x + f.face * 40, y: f.y - 76, vx: f.face * 12, vy: 0, w: 44, h: 12, dmg: 7, kb: [5, -2], life: 60, magic: true });
        if (f.onGround) f.vx *= .8;
        if (f.st >= 22) endSkill(f);
      },
    },
    { // Wings of Light
      start(f) { f.vy = -6; f.onGround = false; },
      update(f, s, inp) {
        if (f.st < 32) {
          f.noGrav = true; f.vy = -6.5 + f.st * .13; steer(f, inp, 4, .15);
          hitEnemies(s, f, { x: -28, y: -104, w: 56, h: 100 }, 5, [3, -7], { radial: true, magic: true });
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
  vex: [
    { // Chain Lightning
      start: noop,
      update(f, s) {
        if (!f.onGround) f.vy *= .7;
        f.vx *= .8;
        if (f.st === 12) {
          const o = nearestEnemy(s, f);
          spawnProj(s, f, { type: 'strike', x: o ? o.x : f.x + f.face * 200, y: o ? o.y : f.y, vx: 0, vy: 0, w: 44, h: 320, dmg: 12, kb: [3, -9], life: 36, pierce: true, magic: true });
        }
        if (f.st >= 26) endSkill(f);
      },
    },
    { // Storm Lift
      start(f) { f.vy = -12; f.onGround = false; },
      update(f, s, inp) {
        if (f.st < 16) {
          f.noGrav = true; f.vy = -11 + f.st * .3; steer(f, inp, 3.5, .15);
          hitEnemies(s, f, { x: -22, y: -110, w: 44, h: 110 }, 6, [2, -8], { radial: true, magic: true });
          if (f.st % 3 === 0) ev(s, { t: 'zap', x: f.x, y: f.y - 20 });
        } else endSkill(f);
      },
    },
    { // Hex Orb
      start: noop,
      update(f, s) {
        if (!f.onGround) f.vy *= .7;
        if (f.st === 10) spawnProj(s, f, { type: 'hexorb', x: f.x + f.face * 30, y: f.y - 62, vx: f.face * 2.5, vy: -.5, w: 26, h: 26, dmg: 8, kb: [4, -5], life: 260, magic: true });
        if (f.st >= 20) endSkill(f);
      },
    },
  ],
};

function quake(f, s) {
  f.quaked = true; f.endAt = f.st + 22; f.armor = false;
  ev(s, { t: 'quake', x: f.x, y: f.y });
  for (const d of [-1, 1]) {
    spawnProj(s, f, { type: 'wave', ground: true, plat: f.plat, x: f.x + d * 34, y: f.y, vx: d * 7, vy: 0, w: 34, h: 34, dmg: 12, kb: [6, -8], life: 60 });
  }
  hitEnemies(s, f, { x: -70, y: -36, w: 140, h: 36 }, 8, [5, -7], { radial: true });
}
