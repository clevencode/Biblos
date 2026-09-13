/**
 * GET/POST /api/plan-day-note — désactivé.
 * Les notes du plan restent sur l’appareil (localStorage).
 */
export default async function handler(req, res) {
  if ((req.method ?? "GET") === "OPTIONS") {
    res.status(204).end();
    return;
  }
  res.status(410).json({
    ok: false,
    error: "Notes du plan : stockage local uniquement (plus de sync Notion)",
  });
}
