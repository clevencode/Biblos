import {
  normalizeCategoria as normalizeCategoriaShared,
  normalizeStatus as normalizeStatusShared,
  categoriaToNotion as categoriaToNotionShared,
} from "../shared/notion.mjs";
import { dateKey, todayKey } from "./calendar";
import type { Flashcard, RetentionMark } from "./types";

/** Intervalos alinhados às opções do Notion: Difícil, Médio, Fácil. */
export const RETENTION_DAYS = {
  dificil: 1,
  medio: 4,
  facil: 10,
  novo: 2,
} as const;

export const RETENTION_LABELS: Record<RetentionMark, string> = {
  dificil: "Difficile",
  medio: "Moyen",
  facil: "Facile",
};

export function retentionLabel(categoria: RetentionMark): string {
  return RETENTION_LABELS[categoria];
}

/** Fonte única: shared/notion.mjs — wrapper tipado para RetentionMark. */
export function categoriaToNotion(categoria: RetentionMark): string {
  return categoriaToNotionShared(categoria) ?? RETENTION_LABELS[categoria];
}

export function normalizeCategoria(
  value: Flashcard["categoria"] | "conhecido" | "desconhecido" | string | null | undefined,
): Flashcard["categoria"] {
  return normalizeCategoriaShared(value);
}

export function normalizeStatus(
  value: Flashcard["status"] | string | null | undefined,
): Flashcard["status"] | null {
  return normalizeStatusShared(value);
}

export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

export function intervalDays(categoria: Flashcard["categoria"]): number {
  if (categoria === "dificil") return RETENTION_DAYS.dificil;
  if (categoria === "medio") return RETENTION_DAYS.medio;
  if (categoria === "facil") return RETENTION_DAYS.facil;
  return RETENTION_DAYS.novo;
}

export function isDue(lembrete: string | null | undefined, today = todayKey()): boolean {
  if (!lembrete) return true;
  return lembrete <= today;
}

export type InboxBucket = "overdue" | "today" | "nodate";

const INBOX_BUCKET_ORDER: InboxBucket[] = ["overdue", "today", "nodate"];

export function inboxBucket(lembrete: string | null | undefined, today = todayKey()): InboxBucket {
  if (!lembrete) return "nodate";
  if (lembrete < today) return "overdue";
  return "today";
}

/** Ordem plana do inbox: atrasados → hoje → sem data (estável dentro de cada grupo). */
export function inboxDisplayOrder<T extends { lembrete?: string | null }>(
  items: T[],
  today = todayKey(),
): T[] {
  const buckets: Record<InboxBucket, T[]> = { overdue: [], today: [], nodate: [] };
  for (const item of items) buckets[inboxBucket(item.lembrete, today)].push(item);
  return INBOX_BUCKET_ORDER.flatMap((key) => buckets[key]);
}

/**
 * Lembrete-card: o próximo lembrete parte sempre da data da revisão atual
 * (não da data antiga do lembrete vencido).
 */
export function nextLembrete(categoria: Flashcard["categoria"], reviewedOn = todayKey()): string {
  return addDays(reviewedOn, intervalDays(categoria));
}

/**
 * Data da última revisão/repetição: valor guardado, ou estimativa a partir do
 * lembrete actual menos o intervalo da categoria, senão a criação.
 */
export function lastReviewedOn(
  card: Pick<Flashcard, "revisadoEm" | "lembrete" | "categoria" | "criadoEm">,
): string | null {
  if (card.revisadoEm) return dateKey(card.revisadoEm);
  if (card.lembrete && card.categoria) {
    return addDays(dateKey(card.lembrete), -intervalDays(card.categoria));
  }
  if (card.criadoEm) return dateKey(card.criadoEm);
  return null;
}

/**
 * Lembrete padrão para cartão novo / sem data:
 * data de criação + intervalo "novo" (2 dias), alinhado à criação no Notion.
 */
export function defaultLembrete(criadoEm?: string | null, today = todayKey()): string {
  const base = criadoEm ? dateKey(criadoEm) : today;
  return addDays(base || today, RETENTION_DAYS.novo);
}

/** Garante lembrete em cartões activos (Estudo/Espera); Encerrado pode ficar sem. */
export function ensureLembrete(
  card: Pick<Flashcard, "status" | "lembrete" | "categoria" | "criadoEm">,
  today = todayKey(),
): string | null {
  if (card.status === "encerrado") return card.lembrete ?? null;
  if (card.lembrete) return card.lembrete;
  return defaultLembrete(card.criadoEm, today);
}

/** Fácil consecutivos para graduar o cartão (status → encerrado). */
export const FACIL_GRADUATION = 2;

export type RetentionState = {
  categoria: RetentionMark | null;
  status: Flashcard["status"];
  lembrete: string | null;
  facilStreak: number;
};

export function resolveFacilStreak(
  card: Pick<Flashcard, "categoria" | "status">,
  storedStreak?: number,
): number {
  if (storedStreak != null) return storedStreak;
  if (card.status === "encerrado") return FACIL_GRADUATION;
  if (normalizeCategoria(card.categoria) === "facil") return 1;
  return 0;
}

export function retentionFromMark(
  mark: RetentionMark,
  previous: Pick<RetentionState, "facilStreak">,
  reviewedOn = todayKey(),
  options?: { allowGraduation?: boolean },
): RetentionState {
  const allowGraduation = options?.allowGraduation !== false;
  if (mark === "facil") {
    const facilStreak = previous.facilStreak + 1;
    if (allowGraduation && facilStreak >= FACIL_GRADUATION) {
      // Mantém o último lembrete (não limpa a data no Notion); o calendário/inbox já ignoram Encerrado.
      return {
        categoria: mark,
        status: "encerrado",
        lembrete: nextLembrete(mark, reviewedOn),
        facilStreak,
      };
    }
    const scheduled = scheduleFromMark(mark, reviewedOn);
    return { ...scheduled, lembrete: scheduled.lembrete, facilStreak: allowGraduation ? facilStreak : 0 };
  }

  const scheduled = scheduleFromMark(mark, reviewedOn);
  return { ...scheduled, lembrete: scheduled.lembrete, facilStreak: 0 };
}

export function scheduleFromMark(
  mark: RetentionMark,
  reviewedOn = todayKey(),
): { categoria: RetentionMark; status: "estudo"; lembrete: string } {
  return {
    categoria: mark,
    status: "estudo",
    lembrete: nextLembrete(mark, reviewedOn),
  };
}

function markRank(categoria: Flashcard["categoria"]): number {
  if (categoria === "dificil") return 0;
  if (categoria == null) return 1;
  if (categoria === "medio") return 2;
  return 3;
}

export function compareStudyOrder(a: Flashcard, b: Flashcard, today = todayKey()): number {
  const due = Number(isDue(a.lembrete, today)) - Number(isDue(b.lembrete, today));
  if (due !== 0) return -due;
  const mark = markRank(a.categoria) - markRank(b.categoria);
  if (mark !== 0) return mark;
  return (a.lembrete ?? "").localeCompare(b.lembrete ?? "");
}

export function studyQueue(cards: Flashcard[], today = todayKey()): Flashcard[] {
  return [...cards]
    .filter((card) => card.status !== "encerrado")
    .sort((a, b) => compareStudyOrder(a, b, today));
}
