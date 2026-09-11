/**
 * GET/POST /api/plan-day-note — note quotidienne du plan (page enfant Notion).
 */
import { fetchPlanDayNote, upsertPlanDayNote } from "../shared/notion.mjs";

export default async function handler(req, res) {
  try {
    const token = process.env.NOTION_TOKEN || "";
    const method = req.method ?? "GET";

    if (method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (method === "GET") {
      const url = new URL(req.url || "/", "http://localhost");
      const result = await fetchPlanDayNote(token, {
        planUrl: url.searchParams.get("planUrl") || url.searchParams.get("url") || "",
        planPageId: url.searchParams.get("planPageId") || "",
        jour: url.searchParams.get("jour"),
        pageId: url.searchParams.get("pageId") || "",
        noteUrl: url.searchParams.get("noteUrl") || "",
      });
      res.status(result.ok || result.hasToken === false ? 200 : 400).json(result);
      return;
    }

    if (method !== "POST") {
      res.status(405).json({ ok: false, error: "méthode invalide" });
      return;
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const result = await upsertPlanDayNote(token, {
      planUrl: body.planUrl || body.url || "",
      planPageId: body.planPageId || "",
      jour: body.jour,
      body: body.body ?? body.text ?? "",
      pageId: body.pageId || "",
      noteUrl: body.noteUrl || "",
    });
    res.status(result.ok || result.hasToken === false ? 200 : 400).json(result);
  } catch (error) {
    console.error("[plan-day-note]", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "erro interno",
    });
  }
}
