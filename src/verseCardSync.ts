/**
 * Sync VERSECARD locaux (Bible) → Notion BIBLECARDS.
 * Création reste local-first ; cette file pousse l’URL Notion dès que l’intégration a accès à la DB.
 */
import type { Catalog, Flashcard } from "./types";
import { isBiblosFlashcard } from "./catalog";
import { persistCatalogCache } from "./catalogSync";
import { loadOverride, notifyFlashcardRevision } from "./cardOverrides";

const OUTBOX_KEY = "biblos-verse-create-outbox";

export type VerseCreateOutboxItem = {
  id: string;
  frente: string;
  verso: string;
  lembrete: string | null;
  status: Flashcard["status"];
  categoria: Flashcard["categoria"];
  at: string;
};

function loadOutbox(): VerseCreateOutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VerseCreateOutboxItem[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.frente && item?.verso) : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: VerseCreateOutboxItem[]) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
}

export function listVerseCreateOutbox(): VerseCreateOutboxItem[] {
  return loadOutbox();
}

/** Met le flashcard local en file pour création Notion. */
export function enqueueVerseCardCreate(card: Flashcard) {
  if (!isBiblosFlashcard(card)) return;
  if (card.url && /notion\.(so|com|site)/i.test(card.url)) return;
  const next: VerseCreateOutboxItem = {
    id: card.id,
    frente: card.frente,
    verso: card.verso,
    lembrete: card.lembrete ?? null,
    status: card.status,
    categoria: card.categoria,
    at: new Date().toISOString(),
  };
  writeOutbox([...loadOutbox().filter((item) => item.id !== next.id), next]);
}

export function removeVerseCreateOutbox(id: string) {
  writeOutbox(loadOutbox().filter((item) => item.id !== id));
}

export function needsNotionCreate(card: Flashcard): boolean {
  if (!isBiblosFlashcard(card)) return false;
  return !card.url || !/notion\.(so|com|site)/i.test(card.url);
}

/** Attache l’URL Notion au cartão local (garde l’id verse-*). */
export function attachNotionUrlToCatalog(catalog: Catalog, localId: string, url: string): Catalog {
  let changed = false;
  const notas = (catalog.notas ?? []).map((note) => {
    let noteChanged = false;
    const flashcards = (note.flashcards ?? []).map((card) => {
      if (card.id !== localId || card.url === url) return card;
      noteChanged = true;
      return { ...card, url };
    });
    if (!noteChanged) return note;
    changed = true;
    return { ...note, flashcards };
  });
  if (!changed) return catalog;
  const next = { ...catalog, notas };
  persistCatalogCache(next);
  return next;
}

export type PushVerseResult = {
  pushed: number;
  remaining: number;
  error?: string;
  updates: Array<{ localId: string; url: string }>;
};

/** Pousse la file verse → Notion (un par un). */
export async function flushVerseCardCreates(): Promise<PushVerseResult> {
  const pending = loadOutbox();
  if (!pending.length) return { pushed: 0, remaining: 0, updates: [] };

  let pushed = 0;
  let error: string | undefined;
  const updates: Array<{ localId: string; url: string }> = [];
  const kept: VerseCreateOutboxItem[] = [];

  for (const item of pending) {
    const override = loadOverride(item.id);
    try {
      const response = await fetch("/api/verse-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localId: item.id,
          frente: item.frente,
          verso: item.verso,
          lembrete: override?.lembrete ?? item.lembrete,
          status: override?.status ?? item.status,
          categoria: override?.categoria ?? item.categoria,
        }),
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        error = "API /api/verse-card indisponible";
        kept.push(item, ...pending.slice(pending.indexOf(item) + 1));
        break;
      }
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        hasToken?: boolean;
        card?: { url?: string };
        localId?: string;
      };
      if (!payload.ok || !payload.card?.url) {
        error =
          payload.error ||
          (payload.hasToken === false
            ? "NOTION_TOKEN em falta no servidor"
            : "Échec de création Notion");
        kept.push(item, ...pending.slice(pending.indexOf(item) + 1));
        break;
      }
      updates.push({ localId: item.id, url: payload.card.url });
      pushed += 1;
    } catch (err) {
      error = err instanceof Error ? err.message : "Échec réseau";
      kept.push(item, ...pending.slice(pending.indexOf(item) + 1));
      break;
    }
  }

  writeOutbox(kept);
  if (pushed) notifyFlashcardRevision();
  return { pushed, remaining: kept.length, error, updates };
}

/** Remplit la file avec les VERSECARD locaux sans URL Notion. */
export function enqueuePendingVerseCreatesFromCatalog(catalog: Catalog) {
  for (const note of catalog.notas ?? []) {
    for (const card of note.flashcards ?? []) {
      if (needsNotionCreate(card)) enqueueVerseCardCreate(card);
    }
  }
}

/** Enfile + tente un push immédiat (après création Bible). */
export async function syncVerseCardToNotion(card: Flashcard): Promise<{
  ok: boolean;
  url?: string;
  queued: boolean;
  error?: string;
}> {
  enqueueVerseCardCreate(card);
  const result = await flushVerseCardCreates();
  const hit = result.updates.find((item) => item.localId === card.id);
  if (hit) return { ok: true, url: hit.url, queued: false };
  if (result.error) return { ok: false, queued: true, error: result.error };
  return { ok: false, queued: true, error: "En attente de sync Notion" };
}
