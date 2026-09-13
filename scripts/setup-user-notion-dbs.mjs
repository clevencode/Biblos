/**
 * Crée les databases Notion de monitoring (Profil, Activité, Message)
 * sous une page parente, et assure Audience sur la PLAN_DB.
 *
 * Usage:
 *   NOTION_TOKEN=… NOTION_PARENT_PAGE=… node scripts/setup-user-notion-dbs.mjs
 *
 * Puis copie les IDs imprimés dans .env / Vercel :
 *   NOTION_PROFILE_DB=…
 *   NOTION_ACTIVITY_DB=…
 *   NOTION_MESSAGES_DB=…
 *
 * Partage chaque DB avec l’intégration Notion (Connections).
 */
import { loadEnv } from "vite";

const env = loadEnv("development", process.cwd(), "");
const token = process.env.NOTION_TOKEN || env.NOTION_TOKEN || "";
const parentPage = process.env.NOTION_PARENT_PAGE || env.NOTION_PARENT_PAGE || "";
const planDb =
  process.env.NOTION_PLAN_DB || env.NOTION_PLAN_DB || "3d103af9-2e96-80c4-bcdd-000bd60ac72f";
const version = "2022-06-28";

function pageUuid(raw) {
  const hex = String(raw || "").replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function notion(path, init) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": version,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Notion ${response.status}: ${JSON.stringify(body).slice(0, 400)}`);
  }
  return body;
}

async function createDb(title, properties) {
  const parentId = pageUuid(parentPage) || parentPage;
  const page = await notion("/databases", {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "page_id", page_id: parentId },
      title: [{ type: "text", text: { content: title } }],
      properties,
    }),
  });
  return page.id;
}

const profileProps = {
  Name: { title: {} },
  LocalId: { rich_text: {} },
  UserId: { rich_text: {} },
  FirstName: { rich_text: {} },
  LastName: { rich_text: {} },
  PreferredName: { rich_text: {} },
  DisplayName: { rich_text: {} },
  TimeSpentMinutes: { number: {} },
  Presence: {
    select: {
      options: [
        { name: "Online", color: "green" },
        { name: "Offline", color: "gray" },
      ],
    },
  },
  LastSeenAt: { date: {} },
  CreatedAt: { date: {} },
  OnboardedAt: { date: {} },
  UpdatedAt: { date: {} },
};

const activityProps = {
  Name: { title: {} },
  LocalId: { rich_text: {} },
  UserId: { rich_text: {} },
  DisplayName: { rich_text: {} },
  /** Nome d’utilisateur (colonne visible / filtre). */
  Nome: { rich_text: {} },
  Type: { rich_text: {} },
  Meta: { rich_text: {} },
  At: { date: {} },
  SyncedAt: { date: {} },
};

const messageProps = {
  Name: { title: {} },
  LocalId: { rich_text: {} },
  UserId: { rich_text: {} },
  DisplayName: { rich_text: {} },
  Body: { rich_text: {} },
  Category: {
    select: {
      options: [
        { name: "Bug", color: "red" },
        { name: "Suggestion", color: "green" },
        { name: "Réclamation", color: "orange" },
        { name: "Question", color: "blue" },
        { name: "Autre", color: "gray" },
      ],
    },
  },
  Status: {
    select: {
      options: [
        { name: "Nouveau", color: "blue" },
        { name: "En cours", color: "yellow" },
        { name: "Traité", color: "green" },
        { name: "Archivé", color: "gray" },
      ],
    },
  },
  CreatedAt: { date: {} },
};

async function ensurePlanAudience() {
  const dbId = pageUuid(planDb) || planDb;
  if (!dbId) {
    console.warn("NOTION_PLAN_DB manquant — Audience non configuré.");
    return;
  }
  try {
    const db = await notion(`/databases/${dbId}`, { method: "GET" });
    const props = db.properties || {};
    const existing =
      props.Audience ||
      Object.keys(props).find((key) => key.toLowerCase() === "audience");
    if (existing) {
      console.log("Audience déjà présent sur PLAN_DB.");
      return;
    }
    await notion(`/databases/${dbId}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          Audience: {
            select: {
              options: [
                { name: "Shared", color: "green" },
                { name: "Admin", color: "purple" },
              ],
            },
          },
        },
      }),
    });
    console.log("Audience ajouté sur PLAN_DB (Shared | Admin).");
  } catch (error) {
    console.warn(
      "Impossible d’ajouter Audience sur PLAN_DB:",
      error instanceof Error ? error.message : error,
    );
    console.warn(
      "Ajoute manuellement la propriété select Audience = Shared | Admin.",
    );
  }
}

async function main() {
  if (!token) {
    console.error("Manque NOTION_TOKEN");
    process.exit(1);
  }
  if (!parentPage) {
    console.error(
      "Manque NOTION_PARENT_PAGE (id d’une page Notion où créer les DBs).\n" +
        "Crée une page « Biblos Cloud », copie son id, puis relance.",
    );
    process.exit(1);
  }

  console.log("Création Profil…");
  const profileId = await createDb("Biblos Profil", profileProps);
  console.log("Création Activité…");
  const activityId = await createDb("Biblos Activité", activityProps);
  console.log("Création Message…");
  const messagesId = await createDb("Biblos Message", messageProps);

  console.log("\nAudience sur PLAN_DB…");
  await ensurePlanAudience();

  console.log("\nOK — ajoute dans .env (et Vercel) :\n");
  console.log(`NOTION_PROFILE_DB=${profileId}`);
  console.log(`NOTION_ACTIVITY_DB=${activityId}`);
  console.log(`NOTION_MESSAGES_DB=${messagesId}`);
  console.log(
    "\nDans Notion : ouvre chaque DB → ··· → Connections → ajoute ton intégration.",
  );
  console.log(
    "Planos: marque Audience=Admin (perso) ou Shared (tous). Sans valeur = Shared.",
  );
  console.log(
    "Compat: NOTION_ADMIN_DB reste un fallback si PROFILE/MESSAGES absents.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
