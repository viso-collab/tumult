// net.js — online via PeerJS.
// Værten kører spillet. Gæsten sender sine knapper og får hele spillets tilstand tilbage.
const Net = (() => {
  let peer = null, conn = null;
  const PREFIX = 'tumult-kampspil-';
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

  function newCode() { let s = ''; for (let i = 0; i < 4; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)]; return s; }
  function close() {
    try { if (conn) conn.close(); } catch (e) { /* ignorér */ }
    try { if (peer) peer.destroy(); } catch (e) { /* ignorér */ }
    conn = null; peer = null;
  }
  function wire(c, cb) {
    conn = c;
    c.on('open', () => cb.connected && cb.connected());
    c.on('data', d => {
      if (!d) return;
      if (d.t === 's' && cb.state) cb.state(d.s);
      else if (d.t === 'i' && cb.input) cb.input(d.i);
    });
    c.on('close', () => { if (conn === c) cb.closed && cb.closed(); });
    c.on('error', e => cb.error && cb.error(e));
  }
  function host(cb) {
    if (typeof Peer === 'undefined') { cb.error({ type: 'peerjs-missing' }); return; }
    close();
    const code = newCode();
    peer = new Peer(PREFIX + code.toLowerCase());
    peer.on('open', () => cb.status(code));
    peer.on('connection', c => {
      if (conn && conn.open) { c.close(); return; }   // kun én gæst
      wire(c, cb);
    });
    peer.on('error', e => {
      if (e.type === 'unavailable-id') { host(cb); return; }   // koden var optaget, prøv en ny
      cb.error(e);
    });
  }
  function join(code, cb) {
    if (typeof Peer === 'undefined') { cb.error({ type: 'peerjs-missing' }); return; }
    close();
    peer = new Peer();
    peer.on('open', () => wire(peer.connect(PREFIX + code.toLowerCase(), { reliable: true, serialization: 'json' }), cb));
    peer.on('error', e => cb.error(e));
  }
  function send(o) { if (conn && conn.open) conn.send(o); }
  return { host, join, send, close };
})();
