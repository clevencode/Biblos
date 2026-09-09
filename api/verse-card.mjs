/**
 * POST /api/verse-card — crée une page VERSECARD dans Notion (push depuis l’app locale).
 */
import { createVerseCard, archiveVerseCard } from "../shared/notion.mjs";

export default async function handler(req, res) {
  try {
    const token = process.env.NOTION_TOKEN || "";
    const method = req.method ?? "GET";

    if (method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (method !== "POST" && method !== "DELETE") {
      res.status(405).json({ ok: false, error: "méthode invalide" });
      return;
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    if (method === "DELETE") {
      const result = await archiveVerseCard(token, body.url || body.pageId || "");
      res.status(result.ok ? 200 : result.hasToken === false ? 200 : 400).json(result);
      return;
    }
    const result = await createVerseCard(token, {
      localId: body.localId,
      frente: body.frente,
      verso: body.verso,
      lembrete: body.lembrete,
      status: body.status,
      categoria: body.categoria,
    });
    res.status(result.ok ? 200 : result.hasToken === false ? 200 : 400).json(result);
  } catch (error) {
    console.error("[verse-card]", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "erro interno",
    });
  }
}
