export default async function worldRoutes(app) {
  // Current global online player count (falls back to WS connection count)
  app.get('/presence', async () => {
    return { count: app.wsHub.connectionCount() };
  });
}
