import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv, type Plugin } from "vite";
import { handleYouVersion } from "./api/youversion.mjs";
import { handleBibleAudio } from "./api/bible-audio.mjs";
import { fetchNotionDescription, listPublishedNotifications } from "./shared/notion.mjs";

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

async function handleNotifications(req: IncomingMessage, res: ServerResponse, token: string) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET") {
    send(res, 405, { ok: false, error: "méthode invalide", items: [] });
    return;
  }
  const limit = Number(queryParam(req, "limit")) || 40;
  const result = await listPublishedNotifications(token, { limit });
  send(res, result.ok || result.hasToken === false ? 200 : 400, result);
}

export function notionFlashcardPlugin(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), "");
  const token = env.NOTION_TOKEN || "";
  if (env.NOTION_BIBLECARDS_DB) process.env.NOTION_BIBLECARDS_DB = env.NOTION_BIBLECARDS_DB;
  if (env.NOTION_PLAN_DB) process.env.NOTION_PLAN_DB = env.NOTION_PLAN_DB;
  if (env.NOTION_NOTIFICATIONS_DB) process.env.NOTION_NOTIFICATIONS_DB = env.NOTION_NOTIFICATIONS_DB;
  if (env.NOTION_TOKEN) process.env.NOTION_TOKEN = env.NOTION_TOKEN;

  const mount = (server: {
    middlewares: { use: (path: string, fn: (req: IncomingMessage, res: ServerResponse) => void) => void };
  }) => {
    server.middlewares.use("/api/catalog", (req, res) => {
      void handleCatalog(req, res, token);
    });
    server.middlewares.use("/api/youversion", (req, res) => {
      void handleYouVersion(req, res);
    });
    server.middlewares.use("/api/bible-audio", (req, res) => {
      void handleBibleAudio(req, res);
    });
    server.middlewares.use("/api/description-sync", (req, res) => {
      void handleDescriptionSync(req, res, token);
    });
    server.middlewares.use("/api/notifications", (req, res) => {
      void handleNotifications(req, res, token);
    });
  };
  return {
    name: "notion-cms-dev",
    configureServer: mount,
    configurePreviewServer: mount,
  };
}
