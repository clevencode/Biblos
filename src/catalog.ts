import { mergeCard } from "./cardOverrides";
import { isDue } from "./retention";
import type { Flashcard, InboxCard, ReadingPlan, Seed } from "./types";

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
  for (const card of buildTimeline(notes, cardIds)) {
    if (!card.url || seen.has(card.id)) continue;
    seen.add(card.id);
    out.push({ id: card.id, url: card.url });
  }
  return out;
}

/** Cartes dues aujourd’hui / en retard (badge Timeline). */
export function buildInbox(notes: Seed[], cardIds?: string[] | null): InboxCard[] {
  return buildTimeline(notes, cardIds).filter((card) => isDue(card.lembrete));
}

/**
 * Agenda Timeline: rappels actifs du plan (tous les jours), sans filtre isDue.
 * Encerrado exclus — le calendrier hebdo filtre ensuite par lembrete.
 */
export function buildTimeline(notes: Seed[], cardIds?: string[] | null): InboxCard[] {
  const items = notes.flatMap((seed) =>
    buildFlashcards(seed)
      .map(mergeCard)
      .filter((card) => isBiblosFlashcard(card) && card.status !== "encerrado")
      .map((card) => ({
        ...card,
        noteId: seed.nota.id,
        disciplinaNome: seed.disciplina.nome,
        materiaNome: seed.materia.nome,
      })),
  );
  return filterByCardIds(items, cardIds).sort((a, b) => {
    const byDay = (a.lembrete ?? "\uffff").localeCompare(b.lembrete ?? "\uffff");
    if (byDay !== 0) return byDay;
    const due = Number(isDue(b.lembrete)) - Number(isDue(a.lembrete));
    if (due !== 0) return due;
    return a.frente.localeCompare(b.frente, "fr");
  });
}
