import type { Catalog, ReadingPlan, Seed } from "./types";
import { applyRemoteOverride } from "./cardOverrides";
import { normalizeCategoria, normalizeStatus } from "./retention";

const CATALOG_CACHE_KEY = "biblos-catalog-v1";

export function hydrateCatalogFromCache(catalog: Catalog): Catalog {
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return catalog;
    const cached = JSON.parse(raw) as Catalog;
    if (!cached || !Array.isArray(cached.notas)) return catalog;
    return mergeCatalog(catalog, cached).catalog;
  } catch {
    return catalog;
  }
}

function persistCatalogCache(catalog: Catalog) {
  try {
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalog));
  } catch {
    /* quota / private mode */
  }
}

function mergeFlashcards(prev: Seed[], incoming: Seed[]): { notes: Seed[]; changed: boolean } {
  const byId = new Map(prev.map((note) => [note.nota.id, note]));
  let changed = false;

  for (const stub of incoming) {
    const existing = byId.get(stub.nota.id);
    if (!existing) {
      for (const card of stub.flashcards ?? []) {
        if (!card.url || !card.id) continue;
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
      byId.set(stub.nota.id, stub);
      changed = true;
      continue;
    }

    const prevByUrl = new Map((existing.flashcards ?? []).map((card) => [card.url, card]));
    const incomingCards = stub.flashcards ?? [];
    let flashcards = existing.flashcards ?? [];

    if (incomingCards.length) {
      flashcards = incomingCards.map((card) => {
        const old = prevByUrl.get(card.url);
        if (!old) return card;
        return {
          ...old,
          frente: card.frente || old.frente,
          verso: card.verso || old.verso,
          categoria: card.categoria ?? old.categoria,
          status: card.status ?? old.status,
          lembrete: card.lembrete ?? old.lembrete,
          criadoEm: card.criadoEm ?? old.criadoEm,
          cardCategory: card.cardCategory ?? old.cardCategory,
          connaissance: card.connaissance ?? old.connaissance,
          formationNome: card.formationNome ?? old.formationNome,
        };
      });
      for (const old of existing.flashcards ?? []) {
        if (!flashcards.some((card) => card.url === old.url)) flashcards.push(old);
      }
    }

    const merged: Seed = {
      ...existing,
      nota: {
        ...existing.nota,
        ...stub.nota,
        cartoes: flashcards.length || stub.nota.cartoes || existing.nota.cartoes,
      },
      materia: stub.materia?.nome ? stub.materia : existing.materia,
      disciplina: stub.disciplina?.nome ? stub.disciplina : existing.disciplina,
      flashcards,
    };

    if (JSON.stringify(existing) !== JSON.stringify(merged)) {
      changed = true;
      byId.set(stub.nota.id, merged);
      for (const card of flashcards) {
        if (!card.url || !card.id) continue;
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
    }
  }

  const notes = [...byId.values()].sort((a, b) => b.nota.criadoEm.localeCompare(a.nota.criadoEm));
  return { notes, changed };
}

function mergePlans(prev: ReadingPlan[], incoming: ReadingPlan[]): { plans: ReadingPlan[]; changed: boolean } {
  const byId = new Map(prev.map((plan) => [plan.id, plan]));
  let changed = false;
  for (const plan of incoming) {
    const existing = byId.get(plan.id);
    if (!existing) {
      byId.set(plan.id, plan);
      changed = true;
      continue;
    }
    const merged = {
      ...existing,
      ...plan,
      days: plan.days.length ? plan.days : existing.days,
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
  const changed = notesMerge.changed || plansMerge.changed;
  const catalog: Catalog = { notas: notesMerge.notes, plans: plansMerge.plans };
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
