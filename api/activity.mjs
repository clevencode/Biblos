/**
 * POST /api/activity — événement d’activité utilisateur → NOTION_ACTIVITY_DB.
 */
import { createActivityEvent } from "../shared/notion.mjs";

export default async function handler(req, res) {
  try {
    const token = process.env.NOTION_TOKEN || "";
    const method = req.method ?? "GET";

    if (method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (method !== "POST") {
      res.status(405).json({ ok: false, error: "méthode invalide" });
      return;
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const result = await createActivityEvent(token, {
      localId: body.localId || body.id,
      userId: body.userId,
      displayName: body.displayName,
      type: body.type,
      meta: body.meta,
      at: body.at,
    });
    res.status(result.ok || result.hasToken === false ? 200 : 400).json(result);
  } catch (error) {
    console.error("[activity]", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "erro interno",
    });
  }
}
