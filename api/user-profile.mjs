/**
 * POST /api/user-profile — upsert du profil local dans Notion (NOTION_ADMIN_DB).
 */
import { upsertUserProfile } from "../shared/notion.mjs";

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
    const result = await upsertUserProfile(token, {
      localId: body.localId || body.id,
      firstName: body.firstName,
      lastName: body.lastName,
      preferredName: body.preferredName,
      createdAt: body.createdAt,
      onboardedAt: body.onboardedAt,
      notionUrl: body.notionUrl || body.url,
      pageId: body.pageId,
    });
    res.status(result.ok || result.hasToken === false ? 200 : 400).json(result);
  } catch (error) {
    console.error("[user-profile]", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "erro interno",
    });
  }
}
