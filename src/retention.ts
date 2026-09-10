import {
  normalizeCategoria as normalizeCategoriaShared,
  normalizeStatus as normalizeStatusShared,
} from "../shared/notion.mjs";
import { dateKey, todayKey } from "./calendar";
import type { Flashcard, RetentionMark } from "./types";

/**
 * Intervalles Anki (jours) — cartes nouvelles.
 * Review: Again=1 · Hard=×1.2 · Good=×2.5 · Easy=×2.5×1.3
 */
export const ANKI_NEW_DAYS = {
  encore: 1,
  dificil: 3,
  medio: 4,
  facil: 7,
} as const;

export const ANKI_EASE = 2.5;
export const ANKI_HARD_FACTOR = 1.2;
export const ANKI_EASY_BONUS = 1.3;

/** @deprecated alias — intervales fixes hérités (évite casser imports). */
export const RETENTION_DAYS = {
  encore: ANKI_NEW_DAYS.encore,
  dificil: ANKI_NEW_DAYS.dificil,
  medio: ANKI_NEW_DAYS.medio,
  facil: ANKI_NEW_DAYS.facil,
  novo: 2,
} as const;

/** Libellés UI (Notion garde « Dificile » via shared/notion). */
export const RETENTION_LABELS: Record<RetentionMark, string> = {
  encore: "Encore",
  dificil: "Difficile",
  medio: "Correct",
  facil: "Facile",
};

export const RETENTION_MARKS: RetentionMark[] = ["encore", "dificil", "medio", "facil"];

export function normalizeCategoria(
  value: Flashcard["categoria"] | "connu" | "desconhecido" | string | null | undefined,
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

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${dateKey(from)}T00:00:00`).getTime();
  const b = new Date(`${dateKey(to)}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Intervalle planifié actuel (0 = carte neuve / jamais notée). */
export function cardIntervalDays(
  card: Pick<Flashcard, "revisadoEm" | "lembrete" | "categoria" | "criadoEm">,
): number {
  const last = lastReviewedOn(card);
  if (!last || !card.lembrete) return 0;
  const span = daysBetween(last, dateKey(card.lembrete));
  return span > 0 ? span : 0;
}

/** Prochain intervalle Anki (jours) à partir de l’intervalle précédent. */
export function ankiIntervalDays(mark: RetentionMark, previousInterval = 0): number {
  const isNew = previousInterval <= 0;
  if (mark === "encore") return ANKI_NEW_DAYS.encore;
  if (isNew) return ANKI_NEW_DAYS[mark];
  if (mark === "dificil") return Math.max(1, Math.round(previousInterval * ANKI_HARD_FACTOR));
  if (mark === "medio") {
    return Math.max(previousInterval + 1, Math.round(previousInterval * ANKI_EASE));
  }
  return Math.max(
    previousInterval + 1,
    Math.round(previousInterval * ANKI_EASE * ANKI_EASY_BONUS),
  );
}

export function isDue(lembrete: string | null | undefined, today = todayKey()): boolean {
  if (!lembrete) return true;
  return lembrete <= today;
}

export function nextLembrete(
  categoria: Flashcard["categoria"],
  reviewedOn = todayKey(),
  previousInterval = 0,
): string {
  if (!categoria) return addDays(reviewedOn, RETENTION_DAYS.novo);
  return addDays(reviewedOn, ankiIntervalDays(categoria, previousInterval));
}

export function lastReviewedOn(
  card: Pick<Flashcard, "revisadoEm" | "lembrete" | "categoria" | "criadoEm">,
): string | null {
  if (card.revisadoEm) return dateKey(card.revisadoEm);
  if (card.lembrete && card.categoria) {
    // Estimation legacy (intervalles fixes) — évite de remonter trop loin.
    const fixed =
      card.categoria === "encore"
        ? ANKI_NEW_DAYS.encore
        : card.categoria === "dificil"
          ? ANKI_NEW_DAYS.dificil
          : card.categoria === "medio"
            ? ANKI_NEW_DAYS.medio
            : ANKI_NEW_DAYS.facil;
    return addDays(dateKey(card.lembrete), -fixed);
  }
  if (card.criadoEm) return dateKey(card.criadoEm);
  return null;
}

export function defaultLembrete(criadoEm?: string | null, today = todayKey()): string {
  const base = criadoEm ? dateKey(criadoEm) : today;
  return addDays(base || today, RETENTION_DAYS.novo);
}

export function ensureLembrete(
  card: Pick<Flashcard, "status" | "lembrete" | "categoria" | "criadoEm">,
  today = todayKey(),
): string | null {
  if (card.status === "encerrado") return card.lembrete ?? null;
  if (card.lembrete) return card.lembrete;
  if (card.status === "espera") {
    return card.criadoEm ? dateKey(card.criadoEm) : today;
  }
  return defaultLembrete(card.criadoEm, today);
}

/** Facile consécutifs pour graduer (Inbox → Encerrado). */
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
  previous: Pick<RetentionState, "facilStreak"> & { intervalDays?: number },
  reviewedOn = todayKey(),
): RetentionState {
  // Archiver est explicite — Facile ne termine plus la carte.
  const prevInterval = previous.intervalDays ?? 0;
  const scheduled = scheduleFromMark(mark, reviewedOn, prevInterval);
  return { ...scheduled, facilStreak: 0 };
}

export function scheduleFromMark(
  mark: RetentionMark,
  reviewedOn = todayKey(),
  previousInterval = 0,
): { categoria: RetentionMark; status: "estudo"; lembrete: string } {
  return {
    categoria: mark,
    status: "estudo",
    lembrete: nextLembrete(mark, reviewedOn, previousInterval),
  };
}

function markRank(categoria: Flashcard["categoria"]): number {
  if (categoria === "encore") return 0;
  if (categoria === "dificil") return 1;
  if (categoria == null) return 2;
  if (categoria === "medio") return 3;
  return 4;
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
