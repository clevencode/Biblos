/**
 * Produção: sync leve só da propriedade Devotional de um PLAN.
 * GET /api/description-sync?url=https://app.notion.com/p/...
 * Equivalente a /api/resumo-sync do StudyOS.
 */
import { fetchNotionDescription } from "../shared/notion.mjs";

export default async function handler(req, res) {
  try {
    const token = process.env.NOTION_TOKEN || "";
    const method = req.method ?? "GET";

    if (method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (method !== "GET") {
      res.status(405).json({ ok: false, error: "méthode invalide" });
      return;
    }
    if (!token) {
      res.status(200).json({ ok: false, error: "NOTION_TOKEN em falta", hasToken: false });
      return;
    }

    const urlParam =
      typeof req.query?.url === "string"
        ? req.query.url
        : typeof req.query?.pageId === "string"
          ? req.query.pageId
          : "";
    let urlOrId = urlParam;
    if (!urlOrId && req.url) {
      try {
        const parsed = new URL(req.url, "http://localhost");
        urlOrId = parsed.searchParams.get("url") || parsed.searchParams.get("pageId") || "";
      } catch {
        /* ignore */
      }
    }

    if (!urlOrId) {
      res.status(400).json({ ok: false, error: "url ou pageId em falta", hasToken: true });
      return;
    }

    const result = await fetchNotionDescription(token, urlOrId);
    if (!result.ok && result.error === "url ou pageId inválido") {
      res.status(400).json({ ok: false, error: "url ou pageId em falta", hasToken: true });
      return;
    }
    if (result.ok) {
      res.status(200).json({
        ok: true,
        pageId: result.pageId,
        description: result.description,
        hasToken: true,
      });
      return;
    }
    res.status(200).json({
      ok: false,
      error: result.error,
      hasToken: result.hasToken,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(200).json({
      ok: false,
      error: message,
      hasToken: Boolean(process.env.NOTION_TOKEN),
    });
  }
}
