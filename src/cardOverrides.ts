/**
 * Overlay local dos cartões (localStorage + dirty em sessionStorage).
 * Fonte de verdade runtime:
 * 1. seed.json — catálogo build-time
 * 2. este overlay — edições locais (dirty ganha ao pull Notion)
 * 3. Notion — remoto via flashcardSync HTTP
 */
import type { Flashcard, RetentionMark } from "./types";
import { todayKey } from "./calendar";
import {
  normalizeCategoria,
  resolveFacilStreak,
  retentionFromMark,
  ensureLembrete,
  FACIL_GRADUATION,
  cardIntervalDays,
} from "./retention";

const STORAGE_KEY = "studyos-flashcard-reminders";
const DIRTY_KEY = "studyos-flashcard-dirty";
const OUTBOX_KEY = "studyos-flashcard-outbox";
const REVISION_EVENT = "studyos-flashcard-revision";

export type CardOverride = {
  categoria: Flashcard["categoria"];
  status: Flashcard["status"];
  lembrete: string | null;
  facilStreak?: number;
  revisadoEm?: string | null;
};

export type FlashcardOutboxItem = {
  id: string;
  url: string;
  lembrete: string | null;
  categoria: Flashcard["categoria"];
  status: Flashcard["status"];
  at: string;
};

export function notifyFlashcardRevision() {
  window.dispatchEvent(new Event(REVISION_EVENT));
}

export function subscribeFlashcardRevision(onChange: () => void) {
  window.addEventListener(REVISION_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(REVISION_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function loadAll(): Record<string, CardOverride> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CardOverride>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function loadDirty(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DIRTY_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function writeDirty(ids: Set<string>) {
  sessionStorage.setItem(DIRTY_KEY, JSON.stringify([...ids]));
}

function markDirty(id: string) {
  const dirty = loadDirty();
  dirty.add(id);
  writeDirty(dirty);
}

export function clearDirty(id: string) {
  const dirty = loadDirty();
  if (!dirty.delete(id)) return;
  writeDirty(dirty);
}

export function isDirty(id: string) {
  return loadDirty().has(id);
}

function loadOutbox(): FlashcardOutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FlashcardOutboxItem[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.url) : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: FlashcardOutboxItem[]) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
}

/** Fila durável StudyOS → Notion (sobrevive a fechar o PWA). */
export function upsertOutbox(item: Omit<FlashcardOutboxItem, "at"> & { at?: string }) {
  const next: FlashcardOutboxItem = {
    id: item.id,
    url: item.url,
    lembrete: item.lembrete,
    categoria: item.categoria,
    status: item.status,
    at: item.at ?? new Date().toISOString(),
  };
  writeOutbox([...loadOutbox().filter((entry) => entry.id !== next.id), next]);
}

export function removeOutbox(id: string) {
  const current = loadOutbox();
  const next = current.filter((entry) => entry.id !== id);
  if (next.length === current.length) return;
  writeOutbox(next);
}

export function listOutbox(): FlashcardOutboxItem[] {
  return loadOutbox();
}

function sameOverride(a: CardOverride | undefined, b: CardOverride): boolean {
  if (!a) return false;
  return a.categoria === b.categoria && a.status === b.status && (a.lembrete ?? null) === (b.lembrete ?? null);
}

export function loadOverride(id: string): CardOverride | undefined {
  return loadAll()[id];
}

export function saveOverride(id: string, next: CardOverride) {
  const map = loadAll();
  map[id] = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  markDirty(id);
  notifyFlashcardRevision();
}

/** Aplica estado remoto do Notion sem marcar o cartão como dirty. */
export function applyRemoteOverride(id: string, next: CardOverride, notify = true): boolean {
  if (isDirty(id)) return false;
  const map = loadAll();
  if (sameOverride(map[id], next)) return false;
  map[id] = { ...map[id], ...next };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  if (notify) notifyFlashcardRevision();
  return true;
}

export function mergeCard(card: Flashcard): Flashcard {
  const local = loadAll()[card.id];
  const categoria = normalizeCategoria(local?.categoria ?? card.categoria);
  const status = local?.status ?? card.status;
  const revisadoEm = local?.revisadoEm ?? card.revisadoEm ?? null;
  const base = !local
    ? { ...card, categoria, status, revisadoEm }
    : {
        ...card,
        categoria,
        status,
        revisadoEm,
        lembrete: local.lembrete,
      };
  return { ...base, lembrete: ensureLembrete(base) };
}

export function applyCardMark(
  mark: RetentionMark,
  card: Pick<Flashcard, "categoria" | "status" | "lembrete" | "revisadoEm" | "criadoEm">,
  stored?: Pick<CardOverride, "facilStreak" | "revisadoEm"> | null,
  reviewedOn = todayKey(),
  options?: { allowGraduation?: boolean },
): CardOverride {
  const next = retentionFromMark(
    mark,
    {
      facilStreak: resolveFacilStreak(card, stored?.facilStreak),
      intervalDays: cardIntervalDays({
        ...card,
        revisadoEm: stored?.revisadoEm ?? card.revisadoEm,
      }),
    },
    reviewedOn,
    options,
  );
  return {
    categoria: next.categoria,
    status: next.status,
    lembrete: next.lembrete,
    facilStreak: next.facilStreak,
    revisadoEm: reviewedOn,
  };
}

/** Classe la carte comme Terminé (hors rappels Timeline) sans passer par Facile×2. */
export function archiveCardLearning(reviewedOn = todayKey()): CardOverride {
  return {
    categoria: null,
    status: "encerrado",
    lembrete: reviewedOn,
    facilStreak: FACIL_GRADUATION,
    revisadoEm: reviewedOn,
  };
}

/** Remet la carte en Nouveau (jour actuel), sans option de révision. */
export function restartCardLearning(_card?: Pick<Flashcard, "criadoEm">, reviewedOn = todayKey()): CardOverride {
  return {
    categoria: null,
    status: "espera",
    lembrete: reviewedOn,
    facilStreak: 0,
    revisadoEm: null,
  };
}
