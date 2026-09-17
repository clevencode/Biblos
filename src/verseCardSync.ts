/**
 * Sync VERSECARD / VerseMark locaux (Bible) → Notion BIBLECARDS.
 * Création reste local-first ; seule l’admin clevencode pousse vers Notion.
 * Les autres utilisateurs gardent les cartes dans le stockage local de l’appareil.
 */
import type { Catalog, Flashcard, Seed } from "./types";
import { apiUrl, readApiJson } from "./apiBase";
import { isBiblosFlashcard } from "./catalog";
import { persistCatalogCache } from "./catalogSync";
import { loadOverride, notifyFlashcardRevision } from "./cardOverrides";
import { isClevencodeAdmin } from "./userProfile";
import { createVerseMarkFlashcard } from "./verseCard";
import { listAllVerseMarks } from "./verseMarks";
import { formatVerseCardFront, toUsfm } from "./youversion/usfm";
import { CANON_BOOKS } from "./youversion/canon";
import { chapterUsfm } from "./youversion/client";

const OUTBOX_KEY = "biblos-verse-create-outbox";

/** Seul l’admin propriétaire synchronise les VERSECARD / VerseMark vers Notion. */
export function canPushVerseCardsToNotion(): boolean {
  return isClevencodeAdmin();
}

export type VerseCreateOutboxItem = {
  id: string;
  frente: string;
  verso: string;
  lembrete: string | null;
  status: Flashcard["status"];
  categoria: Flashcard["categoria"];
  cardCategory: string;
  color: string | null;
  usfm: string | null;
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

function usfmFromCard(card: Flashcard): string | null {
  const fromVerso = String(card.verso || "").match(/usfm:([A-Z0-9.-]+)/i);
  if (fromVerso?.[1]) return fromVerso[1].toUpperCase();
  const id = String(card.id || "");
  if (id.startsWith("verse-") || id.startsWith("mark-")) {
    return id.replace(/^(verse|mark)-/i, "").toUpperCase() || null;
  }
  try {
    const usfm = toUsfm(card.frente || "");
    return usfm || null;
  } catch {
    return null;
  }
}

/** Met le flashcard local en file pour création Notion (admin seulement). */
export function enqueueVerseCardCreate(card: Flashcard) {
  if (!canPushVerseCardsToNotion()) return;
  if (!isBiblosFlashcard(card)) return;
  if (card.url && /notion\.(so|com|site)/i.test(card.url)) return;
  const next: VerseCreateOutboxItem = {
    id: card.id,
    frente: card.frente,
    verso: card.verso,
    lembrete: card.lembrete ?? null,
    status: card.status,
    categoria: card.categoria,
    cardCategory: String(card.cardCategory || "VERSECARD"),
    color: card.color ?? null,
    usfm: usfmFromCard(card),
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

/** Attache l’URL Notion au cartão local (garde l’id verse-* / mark-*). */
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

/** Pousse la file verse → Notion (un par un). Admin seulement. */
export async function flushVerseCardCreates(): Promise<PushVerseResult> {
  if (!canPushVerseCardsToNotion()) {
    return { pushed: 0, remaining: 0, updates: [] };
  }
  const pending = loadOutbox();
  if (!pending.length) return { pushed: 0, remaining: 0, updates: [] };

  let pushed = 0;
  let error: string | undefined;
  const updates: Array<{ localId: string; url: string }> = [];
  const kept: VerseCreateOutboxItem[] = [];

  for (const item of pending) {
    const override = loadOverride(item.id);
    try {
      const response = await fetch(apiUrl("/api/verse-card"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localId: item.id,
          frente: item.frente,
          verso: item.verso,
          lembrete: override?.lembrete ?? item.lembrete,
          status: override?.status ?? item.status,
          categoria: override?.categoria ?? item.categoria,
          cardCategory: item.cardCategory,
          color: item.color,
          usfm: item.usfm,
        }),
      });
      const parsed = await readApiJson<{
        ok?: boolean;
        error?: string;
        hasToken?: boolean;
        card?: { url?: string };
        localId?: string;
      }>(response);
      if (!parsed.ok || !parsed.data) {
        error = "API /api/verse-card indisponible";
        kept.push(item, ...pending.slice(pending.indexOf(item) + 1));
        break;
      }
      const payload = parsed.data;
      if (!payload.ok || !payload.card?.url) {
        error =
          payload.error ||
          (payload.hasToken === false
            ? "Synchronisation cloud non configurée"
            : "Impossible de créer la carte");
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

/** Remplit la file avec les VERSECARD / VerseMark locaux sans URL Notion (admin seulement). */
export function enqueuePendingVerseCreatesFromCatalog(catalog: Catalog) {
  if (!canPushVerseCardsToNotion()) return;
  for (const note of catalog.notas ?? []) {
    for (const card of note.flashcards ?? []) {
      if (needsNotionCreate(card)) enqueueVerseCardCreate(card);
    }
  }
}

function bookTitle(bookId: string): string {
  const hit = CANON_BOOKS.find((b) => b.id.toUpperCase() === bookId.toUpperCase());
  return hit?.title ?? bookId;
}

function upsertCardInCatalog(catalog: Catalog, card: Flashcard): Catalog {
  const notas = [...(catalog.notas ?? [])];
  const bucketKey = String(card.cardCategory || "VERSECARD");
  const bucketId = `bucket-${bucketKey.toLowerCase()}`;
  let seed = notas.find((item) => item.nota.id === bucketId);
  if (!seed) {
    seed = {
      nota: {
        id: bucketId,
        titulo: bucketKey,
        url: "",
        criadoEm: card.criadoEm || new Date().toISOString(),
        cartoes: 0,
      },
      materia: { id: `cat-${bucketKey.toLowerCase()}`, nome: bucketKey },
      disciplina: { id: `disc-${bucketKey.toLowerCase()}`, nome: bucketKey },
      flashcards: [],
    };
    notas.push(seed);
  }
  const existing = seed.flashcards.find((item) => item.id === card.id);
  const flashcards = existing
    ? seed.flashcards.map((item) =>
        item.id === card.id
          ? { ...item, ...card, url: card.url || item.url || "" }
          : item,
      )
    : [card, ...seed.flashcards];
  const nextSeed: Seed = {
    ...seed,
    flashcards,
    nota: { ...seed.nota, cartoes: flashcards.length },
  };
  const nextNotas = notas.map((item) => (item.nota.id === nextSeed.nota.id ? nextSeed : item));
  const next = { ...catalog, notas: nextNotas };
  persistCatalogCache(next);
  return next;
}

/**
 * Source de vérité = appareil : assure que chaque surlignage local
 * a un cartão VerseMark dans le catalogue (pour push Notion).
 */
export function ensureLocalMarksInCatalog(catalog: Catalog): Catalog {
  let next = catalog;
  const known = new Set<string>();
  for (const note of next.notas ?? []) {
    for (const card of note.flashcards ?? []) {
      if (card.id) known.add(card.id);
    }
  }
  for (const mark of listAllVerseMarks()) {
    const usfm = `${chapterUsfm(mark.bookId, mark.chapterId)}.${mark.verse}`;
    const id = `mark-${usfm}`;
    if (known.has(id)) continue;
    const frente = formatVerseCardFront(bookTitle(mark.bookId), mark.chapterId, mark.verse);
    const created = createVerseMarkFlashcard({
      frente,
      usfm,
      color: mark.color,
    });
    if (!created.ok) continue;
    next = upsertCardInCatalog(next, created.card);
    known.add(created.card.id);
  }
  return next;
}

export type PushMobileResult = PushVerseResult & {
  catalog: Catalog;
};

/**
 * Sync manuel : mobile → Notion uniquement.
 * Enfile tout ce qui est local sans URL Notion, pousse, attache les URLs.
 * Ne tire pas le catalogue Notion (l’appareil reste source de vérité).
 */
export async function pushMobileCatalogToNotion(catalog: Catalog): Promise<PushMobileResult> {
  if (!canPushVerseCardsToNotion()) {
    return { pushed: 0, remaining: 0, updates: [], catalog };
  }
  let next = ensureLocalMarksInCatalog(catalog);
  enqueuePendingVerseCreatesFromCatalog(next);
  const result = await flushVerseCardCreates();
  for (const item of result.updates) {
    next = attachNotionUrlToCatalog(next, item.localId, item.url);
  }
  return { ...result, catalog: next };
}

/** Archive la page Notion d’une VERSECARD / VerseMark (si elle a déjà une URL). Admin seulement. */
export async function archiveRemoteVerseCard(card: Pick<Flashcard, "id" | "url">): Promise<{
  ok: boolean;
  error?: string;
}> {
  removeVerseCreateOutbox(card.id);
  if (!canPushVerseCardsToNotion()) {
    return { ok: true };
  }
  if (!card.url || !/notion\.(so|com|site)/i.test(card.url)) {
    return { ok: true };
  }
  try {
    const response = await fetch(apiUrl("/api/verse-card"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: card.url }),
    });
    const parsed = await readApiJson<{ ok?: boolean; error?: string }>(response);
    if (!parsed.ok || !parsed.data) {
      return { ok: false, error: "API /api/verse-card indisponible" };
    }
    const payload = parsed.data;
    if (!payload.ok) return { ok: false, error: payload.error || "Impossible de supprimer la carte" };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Échec réseau" };
  }
}

/** Enfile + tente un push immédiat (après création Bible). No-op hors admin. */
export async function syncVerseCardToNotion(card: Flashcard): Promise<{
  ok: boolean;
  url?: string;
  queued: boolean;
  error?: string;
}> {
  if (!canPushVerseCardsToNotion()) {
    return { ok: true, queued: false };
  }
  enqueueVerseCardCreate(card);
  const result = await flushVerseCardCreates();
  const hit = result.updates.find((item) => item.localId === card.id);
  if (hit) return { ok: true, url: hit.url, queued: false };
  if (result.error) return { ok: false, queued: true, error: result.error };
  return { ok: false, queued: true, error: "En attente de synchronisation" };
}
