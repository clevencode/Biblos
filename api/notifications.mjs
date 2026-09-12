/**
 * GET /api/notifications — mises à jour publiées (Notion → onglet Notifications).
 */
import { listPublishedNotifications } from "../shared/notion.mjs";

export default async function handler(req, res) {
  try {
    const token = process.env.NOTION_TOKEN || "";
    const method = req.method ?? "GET";

    if (method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (method !== "GET") {
      res.status(405).json({ ok: false, error: "méthode invalide", items: [] });
      return;
    }

    const limit = Number(req.query?.limit) || 40;
    const result = await listPublishedNotifications(token, { limit });
    res.status(result.ok || result.hasToken === false ? 200 : 400).json(result);
  } catch (error) {
    console.error("[notifications]", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "erro interno",
      items: [],
    });
  }
}
