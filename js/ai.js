// ai.js — CPU players. Returns the same kind of button input a human would give.
const BOTS = {};

const BOT_SKILLS = {
  //            far away       up close
  kitsu:       { far: [2],    near: [0] },
  rook:        { far: [0],    near: [2] },
  magmor:      { far: [0],    near: [2] },
  morwen:      { far: [0],    near: [2] },
  nightweaver: { far: [0],    near: [2] },
  lumina:      { far: [0],    near: [] },
  sable:       { far: [0],    near: [2] },
  tusk:        { far: [1],    near: [0, 2] },
};

function botInput(s, i) {
  if (s.screen !== 'fight' || s.phase !== 'fight') return {};
  const f = s.fighters[i];
  if (!f || f.state === 'ko' || f.gone) return {};
  const B = BOTS[i] || (BOTS[i] = { next: 0, roll: 0, block: 0 });
  const C = CHARS[f.c], m = MAPS[s.map], plats = platsAt(m, s.tick);
  const mainIdx = m.plats.findIndex(p => p.main), main = plats[mainIdx];
  const tap = s.tick % 2 === 0;   // buttons must be released between presses
  const inp = {};
  const L = main.x + 10, R = main.x + main.w - 10;

  // 1) get back to the stage
  if (!f.onGround && (f.x < L - 20 || f.x > R + 20)) {
    const toward = f.x < L ? 'right' : 'left';
    inp[toward] = true;
    if (f.vy > 0 || f.y > main.y - 40) {
      if (f.jumps > 0) inp.up = tap;
      else {
        const k = C.skills.findIndex((sk, j) => sk.air && f.cds[j] <= 0 && !f.airUsed[j]);
        if (k >= 0) { inp['s' + (k + 1)] = tap; inp.up = true; }
        else if (C.glide) inp.up = true;
      }
    }
    return inp;
  }

  // 2) pick the closest enemy
  let o = null, best = 1e9;
  for (const e of s.fighters) {
    if (e.team === f.team || e.state === 'ko' || e.gone) continue;
    const d = Math.abs(e.x - f.x) + Math.abs(e.y - f.y) * .7;
    if (e.stealthT > 0 && d > 120) continue;   // can't see Sable in her smoke
    if (d < best) { best = d; o = e; }
  }
  if (!o) return inp;
  if (s.tick >= B.next) { B.next = s.tick + 8 + ((Math.random() * 10) | 0); B.roll = Math.random(); }
  const dx = o.x - f.x, dy = o.y - f.y, ad = Math.abs(dx), dir = dx >= 0 ? 1 : -1, side = dir > 0 ? 'right' : 'left';
  const jb = C.moves.jab1.box, range = jb.x + jb.w - 6;

  // 3) block sometimes when the enemy swings
  if (B.block > 0) { B.block--; if (f.onGround) { inp.down = true; return inp; } }
  if (o.state === 'attack' && ad < 100 && Math.abs(dy) < 60 && f.onGround && f.state !== 'attack' && B.roll < .22) {
    B.block = 16; inp.down = true; return inp;
  }

  // 4) heal when hurt (Lumina)
  if (C.id === 'lumina' && f.cds[2] <= 0 && f.hp < C.hp * .5 && ad > 220) { inp.s3 = tap; return inp; }

  // 5) extra attacks
  if (f.state !== 'attack' && B.roll > .88) {
    const pref = BOT_SKILLS[C.id];
    const list = ad > 160 && Math.abs(dy) < 80 ? pref.far : (ad < 90 && Math.abs(dy) < 60 ? pref.near : []);
    const ok = list.filter(k => f.cds[k] <= 0);
    if (ok.length && f.face === dir) { inp['s' + (ok[(Math.random() * ok.length) | 0] + 1)] = tap; return inp; }
  }

  // 6) move toward the enemy without walking off the edge
  if (ad > range * .85) {
    const nx = f.x + dir * 40;
    const edge = f.onGround && f.plat === mainIdx && (nx < L || nx > R);
    if (!edge) inp[side] = true;
  } else if (f.face !== dir && f.state !== 'attack') inp[side] = true;
  if (dy < -80 && f.onGround && B.roll < .6) inp.up = tap;
  if (dy > 60 && f.onGround && plats[f.plat] && !plats[f.plat].solid && B.roll < .5) { inp.down = true; inp.up = tap; }

  // 7) melee
  if (ad < range + 8 && Math.abs(dy) < 60 && f.atkCd <= 0 && B.roll < .8) inp.attack = tap;
  return inp;
}
