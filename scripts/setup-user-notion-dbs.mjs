/**
 * Crée la database Notion Admin (profils + messages) sous une page parente.
 *
 * Usage:
 *   NOTION_TOKEN=… NOTION_PARENT_PAGE=… node scripts/setup-user-notion-dbs.mjs
 *
 * Puis copie l’ID imprimé dans .env :
 *   NOTION_ADMIN_DB=…
 *
 * Partage la DB avec l’intégration Notion (Connections → ton intégration).
 */
import { loadEnv } from "vite";

const env = loadEnv("development", process.cwd(), "");
const token = process.env.NOTION_TOKEN || env.NOTION_TOKEN || "";
const parentPage = process.env.NOTION_PARENT_PAGE || env.NOTION_PARENT_PAGE || "";
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

  console.log("Création de la database Admin…");

  const adminId = await createDb("Admin", {
    Name: { title: {} },
    Kind: {
      select: {
        options: [
          { name: "Profil", color: "blue" },
          { name: "Message", color: "orange" },
        ],
      },
    },
    LocalId: { rich_text: {} },
    UserId: { rich_text: {} },
    FirstName: { rich_text: {} },
    LastName: { rich_text: {} },
    PreferredName: { rich_text: {} },
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
    OnboardedAt: { date: {} },
    UpdatedAt: { date: {} },
  });

  console.log("\nOK — ajoute dans .env (et Vercel) :\n");
  console.log(`NOTION_ADMIN_DB=${adminId}`);
  console.log(
    "\nDans Notion : ouvre Admin → ··· → Connections → ajoute ton intégration.",
  );
  console.log("(Activité de lecture reste locale.)");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
