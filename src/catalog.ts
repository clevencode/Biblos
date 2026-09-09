import { dateKey } from "./calendar";
import { mergeCard } from "./cardOverrides";
import { compareStudyOrder, isDue } from "./retention";
import type { CalendarCardItem, Flashcard, InboxCard, ReadingPlan, Seed } from "./types";

export type Materia = { id: string; nome: string };

/** Scope do plano ativo: se `cardIds` existir, filtra; senão mostra tudo (MVP). */
export function planCardIds(plan: ReadingPlan | null | undefined): string[] | null {
  const ids = plan?.cardIds;
  if (!ids?.length) return null;
  return ids;
}

function filterByCardIds<T extends { id: string }>(items: T[], cardIds?: string[] | null): T[] {
  if (!cardIds?.length) return items;
  const set = new Set(cardIds);
  return items.filter((item) => set.has(item.id));
}

export function listMaterias(notes: Seed[]): Materia[] {
  const map = new Map<string, Materia>();
  for (const note of notes) map.set(note.materia.id, note.materia);
  return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "fr"));
}

export function findNote(notes: Seed[], preferId = ""): Seed | null {
  if (!notes.length) return null;
  if (preferId) {
    const hit = notes.find((note) => note.nota.id === preferId);
    if (hit) return hit;
  }
  return notes[0];
}

export function latestNote(notes: Seed[]): Seed | null {
  if (!notes.length) return null;
  return notes.reduce((best, note) => (note.nota.criadoEm > best.nota.criadoEm ? note : best));
}

function noteSearchText(note: Seed): string {
  return [
    note.materia.nome,
    note.disciplina.nome,
    note.nota.titulo,
    ...(note.flashcards ?? []).flatMap((card) => [
      card.frente,
      card.verso,
      card.cardCategory ?? "",
      card.connaissance ?? "",
      card.formationNome ?? "",
    ]),
  ].join(" ");
}

export function searchNotes(notes: Seed[], query: string): Seed[] {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter((note) => noteSearchText(note).toLowerCase().includes(q));
}

export function buildFlashcards(note: Seed): Flashcard[] {
  return (note.flashcards ?? [])
    .filter((card) => card.id && card.frente && card.verso)
    .map((card) => ({
      ...card,
      criadoEm: card.criadoEm ?? note.nota.criadoEm,
    }));
}

/** Cartões de estudo no Biblos — VERSECARD créés depuis Lecture. */
export function isBiblosFlashcard(card: Pick<Flashcard, "id" | "cardCategory">): boolean {
  if (String(card.id || "").startsWith("verse-")) return true;
  return String(card.cardCategory || "").toUpperCase() === "VERSECARD";
}

export function listAllFlashcards(notes: Seed[], cardIds?: string[] | null): Flashcard[] {
  return filterByCardIds(
    notes.flatMap((note) => buildFlashcards(note)).filter(isBiblosFlashcard),
    cardIds,
  );
}

/** Cartões no âmbito do plano ativo (pull Notion → Biblos). */
export function listScopedFlashcards(
  notes: Seed[],
  cardIds?: string[] | null,
): Array<{ id: string; url: string }> {
  const seen = new Set<string>();
  const out: Array<{ id: string; url: string }> = [];
  for (const card of listAllFlashcards(notes, cardIds)) {
    if (!card.url || seen.has(card.id)) continue;
    seen.add(card.id);
    out.push({ id: card.id, url: card.url });
  }
  return out;
}

export function listInboxSyncCards(
  notes: Seed[],
  cardIds?: string[] | null,
): Array<{ id: string; url: string }> {
  const seen = new Set<string>();
  const out: Array<{ id: string; url: string }> = [];
  for (const card of buildInbox(notes, cardIds)) {
    if (!card.url || seen.has(card.id)) continue;
    seen.add(card.id);
    out.push({ id: card.id, url: card.url });
  }
  return out;
}

export function buildInbox(notes: Seed[], cardIds?: string[] | null): InboxCard[] {
  const items = notes.flatMap((seed) =>
    buildFlashcards(seed)
      .map(mergeCard)
      .filter((card) => isBiblosFlashcard(card) && card.status !== "encerrado" && isDue(card.lembrete))
      .map((card) => ({
        ...card,
        noteId: seed.nota.id,
        disciplinaNome: seed.disciplina.nome,
        materiaNome: seed.materia.nome,
      })),
  );
  return filterByCardIds(items, cardIds).sort(compareStudyOrder);
}

export function buildCalendarEvents(
  notes: Seed[],
  cardIds?: string[] | null,
): {
  cards: CalendarCardItem[];
  cardCounts: Map<string, number>;
} {
  const cardItems: CalendarCardItem[] = [];
  const cardCounts = new Map<string, number>();

  for (const seed of notes) {
    for (const card of filterByCardIds(buildFlashcards(seed).map(mergeCard), cardIds)) {
      if (card.status === "encerrado" || !card.lembrete) continue;
      cardItems.push({
        id: card.id,
        noteId: seed.nota.id,
        day: card.lembrete,
        title: card.frente,
        disciplinaNome: seed.disciplina.nome,
        materiaNome: seed.materia.nome,
        lembrete: card.lembrete,
        url: card.url,
        cardCategory: card.cardCategory ?? null,
      });
      cardCounts.set(card.lembrete, (cardCounts.get(card.lembrete) ?? 0) + 1);
    }
  }

  cardItems.sort((a, b) => a.day.localeCompare(b.day) || a.title.localeCompare(b.title, "fr"));

  return { cards: cardItems, cardCounts };
}

export function linkedCardCount(note: Seed): number {
  const stored = (note.flashcards ?? []).filter((card) => card.frente && card.verso).length;
  return Math.max(stored, note.nota.cartoes ?? 0);
}

export function noteDayCounts(notes: Seed[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const note of notes) {
    const day = dateKey(note.nota.criadoEm);
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return map;
}
