// net.js — online play via PeerJS.
// The host runs the game. Guests send their buttons and receive the whole game state.
const Net = (() => {
  let peer = null, conns = [], hostConn = null;
  const PREFIX = 'tumult-kampspil-';
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

  function newCode() { let s = ''; for (let i = 0; i < 4; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)]; return s; }
  function close() {
    conns.forEach(c => { try { c.close(); } catch (e) { /* ignore */ } });
    try { if (hostConn) hostConn.close(); } catch (e) { /* ignore */ }
    try { if (peer) peer.destroy(); } catch (e) { /* ignore */ }
    conns = []; hostConn = null; peer = null;
  }
  // cb: status(code), join() -> slot or -1, input(slot, i), leave(slot), error(e)
  function host(cb) {
    if (typeof Peer === 'undefined') { cb.error({ type: 'peerjs-missing' }); return; }
    close();
    const code = newCode();
    peer = new Peer(PREFIX + code.toLowerCase());
    peer.on('open', () => cb.status(code));
    peer.on('connection', c => {
      c.on('open', () => {
        const slot = cb.join();
        if (slot < 0) { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); return; }
        c.slot = slot; conns.push(c);
        c.send({ t: 'hello', slot });
      });
      c.on('data', d => { if (d && d.t === 'i' && c.slot != null) cb.input(c.slot, d.i); });
      c.on('close', () => { if (conns.includes(c)) { conns = conns.filter(x => x !== c); cb.leave(c.slot); } });
    });
    peer.on('error', e => {
      if (e.type === 'unavailable-id') { host(cb); return; }   // code taken, try another
      cb.error(e);
    });
  }
  // cb: hello(slot), state(s), closed(), error(e)
  function join(code, cb) {
    if (typeof Peer === 'undefined') { cb.error({ type: 'peerjs-missing' }); return; }
    close();
    peer = new Peer();
    peer.on('open', () => {
      hostConn = peer.connect(PREFIX + code.toLowerCase(), { reliable: true, serialization: 'json' });
      hostConn.on('data', d => {
        if (!d) return;
        if (d.t === 'hello') cb.hello(d.slot);
        else if (d.t === 's') cb.state(d.s);
        else if (d.t === 'full') cb.error({ type: 'full' });
      });
      hostConn.on('close', () => cb.closed());
      hostConn.on('error', e => cb.error(e));
    });
    peer.on('error', e => cb.error(e));
  }
  function send(o) {
    if (hostConn) { if (hostConn.open) hostConn.send(o); return; }
    conns.forEach(c => { if (c.open) c.send(o); });
  }
  return { host, join, send, close };
})();
