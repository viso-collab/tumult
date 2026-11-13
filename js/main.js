// main.js — menu and main loop.
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const menu = document.getElementById('menu');
const statusEl = document.getElementById('status');
const codeInput = document.getElementById('join-code');

let MODE = null;      // null | 'local' | 'host' | 'guest'
let GAME_MODE = '1v1';
let MY = -1;          // which slot you are online
let SOLO = false;     // vs CPU: one player, everyone else is a bot
let state = null;     // game state (local or on the host)
let view = null;      // what gets drawn (for guests: latest state from the host)
const remoteIn = {};
let acc = 0, last = performance.now();

function setStatus(html) { statusEl.innerHTML = html; }
function showMenu(msg) {
  Net.close();
  MODE = null; MY = -1; SOLO = false; state = null; view = null;
  menu.hidden = false; setStatus(msg || '');
}
function hideMenu() { menu.hidden = true; }
function errText(e) {
  const t = e && e.type;
  if (t === 'peer-unavailable') return 'No game found with that code. Check it and try again.';
  if (t === 'full') return 'That game is full.';
  if (t === 'peerjs-missing') return 'Could not load PeerJS. Check your internet connection.';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'Could not reach the PeerJS server. Check your internet connection.';
  if (t === 'browser-incompatible') return 'Your browser does not support online play. Try Chrome or Firefox.';
  return 'Something went wrong: ' + (t || e);
}

document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
  GAME_MODE = b.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
}));

document.getElementById('btn-local').onclick = () => {
  Net.close();
  MODE = 'local'; MY = -1; SOLO = false; state = newState(GAME_MODE, false); view = state;
  for (let i = 2; i < state.players.length; i++) setCpu(state, i, true);
  hideMenu();
};
document.getElementById('btn-cpu').onclick = () => {
  Net.close();
  MODE = 'local'; MY = 0; SOLO = true; state = newState(GAME_MODE, false, true); view = state;
  for (let i = 1; i < state.players.length; i++) setCpu(state, i, true);
  hideMenu();
};
document.getElementById('btn-host').onclick = () => {
  setStatus('Creating game…');
  Net.host({
    status: code => {
      MODE = 'host'; MY = 0; state = newState(GAME_MODE, true); state.code = code; view = state;
      for (let i = 1; i < state.players.length; i++) setCpu(state, i, true);
      hideMenu();
    },
    join: () => {
      if (!state) return -1;
      const slot = state.players.findIndex((p, i) => i > 0 && p.cpu);
      if (slot < 0) return -1;
      setCpu(state, slot, false);
      return slot;
    },
    input: (slot, i) => { remoteIn[slot] = i; },
    leave: slot => { if (state) { setCpu(state, slot, true); delete remoteIn[slot]; } },
    error: e => { if (MODE === 'host') showMenu(errText(e)); else setStatus(errText(e)); },
  });
};
function join() {
  const code = codeInput.value.trim().toUpperCase();
  if (code.length !== 4) { setStatus('Type the 4-letter code your friend got.'); return; }
  setStatus('Connecting…');
  Net.join(code, {
    hello: slot => { MODE = 'guest'; MY = slot; view = null; hideMenu(); },
    state: s => { view = s; spawnFx(s.events); },
    closed: () => showMenu('Lost the connection to the host.'),
    error: e => { if (MODE === 'guest') showMenu(errText(e)); else setStatus(errText(e)); },
  });
}
document.getElementById('btn-join').onclick = join;
codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
addEventListener('keydown', e => { if (e.code === 'Escape' && MODE) showMenu(''); });

function hints() {
  const local = MODE === 'local' && !SOLO;
  if (SOLO) return {
    mode: 'solo', my: 0,
    hint: 'Move: WASD or arrows · Pick: F · Back: Q',
    teamHint: 'Pick your fighter, then one for each CPU. Back: Q',
    mapHint: 'Pick with A/D or ←/→ · Start: F · Back: Q',
    again: 'Press F to play again',
  };
  return {
    mode: local ? 'local' : 'online', my: MY,
    hint: local ? 'Move: WASD / arrows · Pick: F / K · Back: Q / U' : 'Move: WASD or arrows · Pick: F · Back: Q',
    teamHint: local ? 'Press Q / U to switch team. Players 3 and 4 use controllers, otherwise CPU.' : 'Press Q to switch team. Empty spots are played by the CPU.',
    mapHint: local ? 'Pick with A/D or ←/→ · Start: F / K · Back: Q / U' : 'Anyone can pick · Start: F · Back: Q',
    again: local ? 'Press F or K to play again' : 'Press F to play again',
  };
}

function gather() {
  return state.players.map((P, i) => {
    if (P.cpu) return botInput(state, i);
    if (MODE === 'local') return SOLO ? Input.any() : Input.slot(i);
    if (i === 0) return Input.any();
    return remoteIn[i] || {};
  });
}

function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > .25) dt = .25;
  if (MODE === 'local' || MODE === 'host') {
    if (MODE === 'local' && !SOLO && state.screen === 'select') {
      for (let i = 2; i < state.players.length; i++) setCpu(state, i, !Input.padConnected(i));
    }
    acc += dt;
    let n = 0;
    while (acc >= 1 / 60 && n < 5) {
      step(state, gather());
      spawnFx(state.events);
      if (MODE === 'host') Net.send({ t: 's', s: snapshot(state) });
      acc -= 1 / 60; n++;
    }
    if (n === 5) acc = 0;
  } else if (MODE === 'guest') {
    Net.send({ t: 'i', i: Input.any() });
  }
  const o = hints(); o.waiting = MODE === 'guest' && !view;
  renderFrame(ctx, view, dt, o);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
