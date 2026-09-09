import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv, type Plugin } from "vite";
import { runFlashcardSync, type SyncBody } from "./server/notionFlashcardSync.ts";
import { handleYouVersion } from "./api/youversion.mjs";
import { fetchNotionDescription, createVerseCard, archiveVerseCard } from "./shared/notion.mjs";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  if (status === 204) {
    res.end();
    return;
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function queryParam(req: IncomingMessage, key: string): string {
  try {
    const host = req.headers.host || "localhost";
    const parsed = new URL(req.url || "/", `http://${host}`);
    return parsed.searchParams.get(key) || "";
  } catch {
    return "";
  }
}

async function handle(req: IncomingMessage, res: ServerResponse, token: string) {
  try {
    let body: SyncBody | null = null;
    if (req.method === "POST") {
      try {
        body = JSON.parse(await readBody(req)) as SyncBody;
      } catch {
        send(res, 400, { synced: false, error: "JSON inválido" });
        return;
      }
    }
    const result = await runFlashcardSync(req.method ?? "GET", body, token, {
      useQueue: true,
      allowPersist: true,
    });
    send(res, result.status, result.body);
  } catch (error) {
    console.error("[flashcard-sync]", error);
    if (!res.headersSent) {
      send(res, 500, { synced: false, error: "erro interno no sync Notion" });
    }
  }
}

async function handleCatalog(req: IncomingMessage, res: ServerResponse, token: string) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET") {
    send(res, 405, { ok: false, error: "méthode invalide" });
    return;
  }
  if (!token) {
    send(res, 200, { ok: false, error: "NOTION_TOKEN em falta", hasToken: false, notas: [], plans: [] });
    return;
  }
  try {
    const mode = queryParam(req, "mode") || "index";
    const { buildCatalog } = await import("./api/catalog.mjs");
    const catalog = await buildCatalog(token, { full: mode === "full" });
    send(res, 200, { ok: true, hasToken: true, ...catalog });
  } catch (error) {
    console.error("[catalog]", error);
    const message = error instanceof Error ? error.message : String(error);
    send(res, 500, { ok: false, error: message });
  }
}

async function handleDescriptionSync(req: IncomingMessage, res: ServerResponse, token: string) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET") {
    send(res, 405, { ok: false, error: "méthode invalide" });
    return;
  }
  const urlOrId = queryParam(req, "url") || queryParam(req, "pageId");
  if (!urlOrId) {
    send(res, 400, { ok: false, error: "url ou pageId em falta", hasToken: Boolean(token) });
    return;
  }
  if (!token) {
    send(res, 200, { ok: false, error: "NOTION_TOKEN em falta", hasToken: false, description: "" });
    return;
  }
  const result = await fetchNotionDescription(token, urlOrId);
  send(res, 200, result);
}

async function handleVerseCard(req: IncomingMessage, res: ServerResponse, token: string) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST" && req.method !== "DELETE") {
    send(res, 405, { ok: false, error: "méthode invalide" });
    return;
  }
  let body: {
    frente?: string;
    verso?: string;
    localId?: string;
    lembrete?: string | null;
    status?: string;
    categoria?: string | null;
    url?: string;
    pageId?: string;
  } = {};
  try {
    body = JSON.parse(await readBody(req)) as typeof body;
  } catch {
    send(res, 400, { ok: false, error: "JSON inválido" });
    return;
  }
  if (req.method === "DELETE") {
    const result = await archiveVerseCard(token, body.url || body.pageId || "");
    send(res, result.ok ? 200 : 400, result);
    return;
  }
  const result = await createVerseCard(token, {
    frente: body.frente ?? "",
    verso: body.verso ?? "",
    localId: body.localId,
    lembrete: body.lembrete,
    status: body.status,
    categoria: body.categoria,
  });
  send(res, result.ok ? 200 : 400, result);
}

export function notionFlashcardPlugin(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), "");
  const token = env.NOTION_TOKEN || "";
  const yvKey = env.YOUVERSION_APP_KEY || env.YVP_APP_KEY || "";
  if (env.NOTION_BIBLECARDS_DB) process.env.NOTION_BIBLECARDS_DB = env.NOTION_BIBLECARDS_DB;
  if (env.NOTION_PLAN_DB) process.env.NOTION_PLAN_DB = env.NOTION_PLAN_DB;
  if (env.NOTION_TOKEN) process.env.NOTION_TOKEN = env.NOTION_TOKEN;
  if (yvKey) {
    process.env.YOUVERSION_APP_KEY = yvKey;
    process.env.YVP_APP_KEY = yvKey;
  }

  const mount = (server: {
    middlewares: { use: (path: string, fn: (req: IncomingMessage, res: ServerResponse) => void) => void };
  }) => {
    server.middlewares.use("/api/flashcard-sync", (req, res) => {
      void handle(req, res, token);
    });
    server.middlewares.use("/api/catalog", (req, res) => {
      void handleCatalog(req, res, token);
    });
    server.middlewares.use("/api/youversion", (req, res) => {
      void handleYouVersion(req, res, yvKey);
    });
    server.middlewares.use("/api/description-sync", (req, res) => {
      void handleDescriptionSync(req, res, token);
    });
    server.middlewares.use("/api/verse-card", (req, res) => {
      void handleVerseCard(req, res, token);
    });
  };
  return {
    name: "notion-flashcard-sync",
    configureServer: mount,
    configurePreviewServer: mount,
  };
}
