/**
 * POST /api/admin-note — note personnelle du plan → Admin (Kind=Note).
 */
import { upsertAdminPersonalNote } from "../shared/notion.mjs";

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
    const result = await upsertAdminPersonalNote(token, {
      localId: body.localId,
      userId: body.userId,
      displayName: body.displayName,
      planId: body.planId,
      planName: body.planName || body.plan,
      jour: body.jour,
      passage: body.passage,
      body: body.body || body.text,
      at: body.at,
    });
    res.status(result.ok || result.hasToken === false ? 200 : 400).json(result);
  } catch (error) {
    console.error("[admin-note]", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "erro interno",
    });
  }
}
