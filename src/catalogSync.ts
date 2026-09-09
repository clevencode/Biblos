import type { Catalog, ReadingPlan, Seed } from "./types";
import { applyRemoteOverride } from "./cardOverrides";
import { isBiblosFlashcard } from "./catalog";
import { sanitizePlanDays } from "./plan";
import { normalizeCategoria, normalizeStatus } from "./retention";

const CATALOG_CACHE_KEY = "biblos-catalog-v1";

/** Remove ENSEIGNEMENT / cartões Notion não usados — só VERSECARD + verse-*. */
export function pruneCatalogToVerseCards(catalog: Catalog): Catalog {
  const notas = (catalog.notas ?? [])
    .map((note) => {
      const flashcards = (note.flashcards ?? []).filter(isBiblosFlashcard);
      return {
        ...note,
        flashcards,
        nota: { ...note.nota, cartoes: flashcards.length },
      };
    })
    .filter((note) => {
      const id = String(note.nota.id || "").toLowerCase();
      if (id.includes("versecard") || id.includes("verse")) return true;
      return note.flashcards.length > 0;
    });
  const plans = (catalog.plans ?? []).map((plan) => ({
    ...plan,
    days: sanitizePlanDays(plan.days),
  }));
  return { ...catalog, notas, plans };
}

export function hydrateCatalogFromCache(catalog: Catalog): Catalog {
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return pruneCatalogToVerseCards(catalog);
    const cached = JSON.parse(raw) as Catalog;
    if (!cached || !Array.isArray(cached.notas)) return pruneCatalogToVerseCards(catalog);
    const merged = pruneCatalogToVerseCards(mergeCatalog(catalog, cached).catalog);
    persistCatalogCache(merged);
    return merged;
  } catch {
    return pruneCatalogToVerseCards(catalog);
  }
}

export function persistCatalogCache(catalog: Catalog) {
  try {
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalog));
  } catch {
    /* quota / private mode */
  }
}

/** Enlève un flashcard du catalogue local (liste, inbox, calendrier). */
export function removeCardFromCatalog(catalog: Catalog, cardId: string): Catalog {
  const notas = (catalog.notas ?? []).map((note) => {
    const flashcards = (note.flashcards ?? []).filter((card) => card.id !== cardId);
    if (flashcards.length === (note.flashcards ?? []).length) return note;
    return {
      ...note,
      flashcards,
      nota: { ...note.nota, cartoes: flashcards.length },
    };
  });
  const plans = (catalog.plans ?? []).map((plan) => {
    if (!plan.cardIds?.includes(cardId)) return plan;
    return { ...plan, cardIds: plan.cardIds.filter((id) => id !== cardId) };
  });
  const next = pruneCatalogToVerseCards({ ...catalog, notas, plans });
  persistCatalogCache(next);
  return next;
}

function mergeFlashcards(prev: Seed[], incoming: Seed[]): { notes: Seed[]; changed: boolean } {
  const byId = new Map(prev.map((note) => [note.nota.id, note]));
  let changed = false;

  for (const stub of incoming) {
    const verseCards = (stub.flashcards ?? []).filter(isBiblosFlashcard);
    if (!verseCards.length && !String(stub.nota.id || "").toLowerCase().includes("verse")) {
      continue;
    }
    const filteredStub = {
      ...stub,
      flashcards: verseCards,
      nota: { ...stub.nota, cartoes: verseCards.length },
    };
    const existing = byId.get(filteredStub.nota.id);
    if (!existing) {
      for (const card of verseCards) {
        if (!card.id) continue;
        applyRemoteOverride(
          card.id,
          {
            categoria: normalizeCategoria(card.categoria),
            status: normalizeStatus(card.status) ?? "estudo",
            lembrete: card.lembrete ?? null,
          },
          false,
        );
      }
      byId.set(filteredStub.nota.id, filteredStub);
      changed = true;
      continue;
    }

    // merge existing — continue with original logic but only verse cards
    const existingCards = (existing.flashcards ?? []).filter(isBiblosFlashcard);
    const byCard = new Map(existingCards.map((card) => [card.id, card]));
    let cardsChanged = existingCards.length !== (existing.flashcards ?? []).length;
    for (const card of verseCards) {
      if (!card.id) continue;
      const old = byCard.get(card.id);
      if (!old) {
        byCard.set(card.id, card);
        cardsChanged = true;
        if (card.url) {
          applyRemoteOverride(
            card.id,
            {
              categoria: normalizeCategoria(card.categoria),
              status: normalizeStatus(card.status) ?? "estudo",
              lembrete: card.lembrete ?? null,
            },
            false,
          );
        }
        continue;
      }
      const merged = {
        ...old,
        ...card,
        lembrete: card.lembrete ?? old.lembrete,
        categoria: card.categoria ?? old.categoria,
        status: card.status ?? old.status,
      };
      if (JSON.stringify(old) !== JSON.stringify(merged)) {
        byCard.set(card.id, merged);
        cardsChanged = true;
      }
    }
    if (cardsChanged) {
      const flashcards = [...byCard.values()];
      byId.set(filteredStub.nota.id, {
        ...existing,
        ...filteredStub,
        flashcards,
        nota: {
          ...existing.nota,
          ...filteredStub.nota,
          cartoes: flashcards.length,
        },
      });
      changed = true;
    }
  }

  // Strip leftover ENSEIGNEMENT buckets / cards from prev
  for (const [id, note] of [...byId.entries()]) {
    const flashcards = (note.flashcards ?? []).filter(isBiblosFlashcard);
    if (flashcards.length !== (note.flashcards ?? []).length) {
      byId.set(id, {
        ...note,
        flashcards,
        nota: { ...note.nota, cartoes: flashcards.length },
      });
      changed = true;
    }
    const key = String(id).toLowerCase();
    if (!flashcards.length && !key.includes("verse")) {
      byId.delete(id);
      changed = true;
    }
  }

  return { notes: [...byId.values()], changed };
}

function mergePlans(prev: ReadingPlan[], incoming: ReadingPlan[]): { plans: ReadingPlan[]; changed: boolean } {
  const byId = new Map(prev.map((plan) => [plan.id, plan]));
  let changed = false;
  for (const plan of incoming) {
    const existing = byId.get(plan.id);
    if (!existing) {
      byId.set(plan.id, { ...plan, days: sanitizePlanDays(plan.days) });
      changed = true;
      continue;
    }
    const incomingDays = sanitizePlanDays(plan.days);
    const merged = {
      ...existing,
      ...plan,
      days: incomingDays.length ? incomingDays : sanitizePlanDays(existing.days),
      description:
        typeof plan.description === "string" && plan.description.trim()
          ? plan.description
          : (existing.description ?? ""),
    };
    if (JSON.stringify(existing) !== JSON.stringify(merged)) {
      byId.set(plan.id, merged);
      changed = true;
    }
  }
  return { plans: [...byId.values()], changed };
}

export function mergeCatalog(base: Catalog, incoming: Catalog): { catalog: Catalog; changed: boolean } {
  const notesMerge = mergeFlashcards(base.notas ?? [], incoming.notas ?? []);
  const plansMerge = mergePlans(base.plans ?? [], incoming.plans ?? []);
  const catalog = pruneCatalogToVerseCards({
    notas: notesMerge.notes,
    plans: plansMerge.plans,
  });
  const changed =
    notesMerge.changed ||
    plansMerge.changed ||
    JSON.stringify(catalog.notas) !== JSON.stringify(notesMerge.notes);
  if (changed) persistCatalogCache(catalog);
  return { catalog, changed };
}

export async function pullCatalog(current: Catalog): Promise<{ catalog: Catalog; changed: boolean; ok: boolean }> {
  try {
    const response = await fetch("/api/catalog?mode=index");
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return { catalog: current, changed: false, ok: false };
    }
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      catalog?: Catalog;
      notas?: Catalog["notas"];
      plans?: Catalog["plans"];
      error?: string;
    };
    const incoming: Catalog | null = payload.catalog
      ? payload.catalog
      : Array.isArray(payload.notas) || Array.isArray(payload.plans)
        ? { notas: payload.notas ?? [], plans: payload.plans ?? [] }
        : null;
    if (!response.ok || !payload.ok || !incoming) {
      return { catalog: current, changed: false, ok: Boolean(payload.ok) };
    }
    const merged = mergeCatalog(current, incoming);
    return { ...merged, ok: true };
  } catch {
    return { catalog: current, changed: false, ok: false };
  }
}
