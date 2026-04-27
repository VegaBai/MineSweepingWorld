// WebSocket hub: manages all connected clients, broadcasts presence & events.
// Grid-level presence (which cell each user is in) is tracked per-connection.

export default async function wsHub(app) {
  const clients = new Set();      // Set<WebSocket>
  const gridPresence = new Map(); // ws → { gx, gy } | null

  function connectionCount() { return clients.size; }

  function broadcast(msg, exclude = null) {
    const data = JSON.stringify(msg);
    for (const ws of clients) {
      if (ws !== exclude && ws.readyState === 1 /* OPEN */) ws.send(data);
    }
  }

  function broadcastPresence() {
    broadcast({ type: 'presence', count: clients.size });
  }

  function broadcastGridPresence(gx, gy) {
    let count = 0;
    for (const pos of gridPresence.values()) {
      if (pos && pos.gx === gx && pos.gy === gy) count++;
    }
    broadcast({ type: 'grid_active', gx, gy, count });
  }

  app.get('/ws', { websocket: true }, (ws, _req) => {
    clients.add(ws);
    gridPresence.set(ws, null);

    // Send current presence to newcomer
    ws.send(JSON.stringify({ type: 'presence', count: clients.size }));
    broadcastPresence();

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === 'enter_grid' && Number.isInteger(msg.gx) && Number.isInteger(msg.gy)) {
        const prev = gridPresence.get(ws);
        gridPresence.set(ws, { gx: msg.gx, gy: msg.gy });
        if (prev) broadcastGridPresence(prev.gx, prev.gy);   // decrement old cell
        broadcastGridPresence(msg.gx, msg.gy);                // increment new cell
      }

      if (msg.type === 'leave_grid') {
        const prev = gridPresence.get(ws);
        gridPresence.set(ws, null);
        if (prev) broadcastGridPresence(prev.gx, prev.gy);
      }
    });

    ws.on('close', () => {
      const prev = gridPresence.get(ws);
      clients.delete(ws);
      gridPresence.delete(ws);
      broadcastPresence();
      if (prev) broadcastGridPresence(prev.gx, prev.gy);
    });

    ws.on('error', () => {
      clients.delete(ws);
      gridPresence.delete(ws);
    });
  });

  // Expose broadcast & connectionCount to other routes via app.wsHub
  app.decorate('wsHub', { broadcast, connectionCount });
}
