// main.js — menuen og hovedløkken.
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const menu = document.getElementById('menu');
const statusEl = document.getElementById('status');
const codeInput = document.getElementById('join-code');

let MODE = null;      // null | 'local' | 'host' | 'guest'
let MY = -1;          // hvilken spiller du er online (0 = vært, 1 = gæst)
let state = null;     // spillets tilstand (lokalt eller hos værten)
let view = null;      // det der tegnes (hos gæsten: sidste tilstand fra værten)
let remoteIn = {};
let acc = 0, last = performance.now();

function setStatus(html) { statusEl.innerHTML = html; }
function showMenu(msg) {
  Net.close();
  MODE = null; MY = -1; state = null; view = null;
  menu.hidden = false; setStatus(msg || '');
}
function hideMenu() { menu.hidden = true; }
function errText(e) {
  const t = e && e.type;
  if (t === 'peer-unavailable') return 'Fandt ikke noget spil med den kode. Tjek koden og prøv igen.';
  if (t === 'peerjs-missing') return 'PeerJS kunne ikke hentes. Tjek internetforbindelsen.';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'Kunne ikke nå PeerJS-serveren. Tjek internetforbindelsen.';
  if (t === 'browser-incompatible') return 'Din browser understøtter ikke online-spil. Prøv Chrome eller Firefox.';
  return 'Noget gik galt: ' + (t || e);
}

document.getElementById('btn-local').onclick = () => {
  Net.close();
  MODE = 'local'; MY = -1; state = newState(); view = state; hideMenu();
};
document.getElementById('btn-host').onclick = () => {
  setStatus('Opretter spil…');
  Net.host({
    status: code => setStatus(`Din kode er <b>${code}</b>. Giv den til din ven og vent her.`),
    connected: () => { MODE = 'host'; MY = 0; state = newState(); view = state; remoteIn = {}; hideMenu(); },
    input: i => { remoteIn = i; },
    closed: () => showMenu('Forbindelsen til din ven blev afbrudt.'),
    error: e => setStatus(errText(e)),
  });
};
function join() {
  const code = codeInput.value.trim().toUpperCase();
  if (code.length !== 4) { setStatus('Skriv den kode på 4 bogstaver, som din ven har fået.'); return; }
  setStatus('Forbinder…');
  Net.join(code, {
    connected: () => { MODE = 'guest'; MY = 1; view = null; hideMenu(); },
    state: s => { view = s; spawnFx(s.events); },
    closed: () => showMenu('Forbindelsen til værten blev afbrudt.'),
    error: e => setStatus(errText(e)),
  });
}
document.getElementById('btn-join').onclick = join;
codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
addEventListener('keydown', e => { if (e.code === 'Escape' && MODE) showMenu(''); });

function hints() {
  if (MODE === 'local') return {
    hint: 'Vælg: A/D/W/S eller pilene · Bekræft: F eller K · Fortryd: G eller L',
    mapHint: 'Vælg med A/D eller ←/→ · Start: F eller K · Tilbage: G eller L',
    again: 'Tryk F eller K for at spille igen',
    labels: ['SPILLER 1', 'SPILLER 2'],
  };
  return {
    hint: 'Vælg med pilene eller WASD · Bekræft: F eller K · Fortryd: G eller L',
    mapHint: 'Begge kan vælge · Start: F eller K · Tilbage: G eller L',
    again: 'Tryk F eller K for at spille igen',
    labels: MY === 0 ? ['DIG', 'DIN VEN'] : ['DIN VEN', 'DIG'],
  };
}

function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > .25) dt = .25;
  if (MODE === 'local' || MODE === 'host') {
    acc += dt;
    let n = 0;
    while (acc >= 1 / 60 && n < 5) {
      const ins = MODE === 'local' ? [Input.local(0), Input.local(1)] : [Input.any(), remoteIn];
      step(state, ins);
      spawnFx(state.events);
      if (MODE === 'host') Net.send({ t: 's', s: snapshot(state) });
      acc -= 1 / 60; n++;
    }
    if (n === 5) acc = 0;
  } else if (MODE === 'guest') {
    Net.send({ t: 'i', i: Input.any() });
  }
  const opts = hints(); opts.waiting = MODE === 'guest' && !view;
  renderFrame(ctx, view, dt, opts);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
