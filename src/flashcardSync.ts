/**
 * Cliente HTTP Notion para flashcards (+ merge remoto no Seed[]).
 * Persistência local: ver cardOverrides.ts
 *
 * Multi-aparelho: Notion é a ponte.
 * 1) push local (outbox durável) → Notion
 * 2) pull Notion → overrides (excepto dirty/outbox)
 */
import type { Flashcard, Seed } from "./types";
import {
  applyRemoteOverride,
  clearDirty,
  isDirty,
  listOutbox,
  loadOverride,
  notifyFlashcardRevision,
  removeOutbox,
  upsertOutbox,
  type CardOverride,
} from "./cardOverrides";
import { normalizeCategoria, normalizeStatus } from "./retention";

export type { CardOverride } from "./cardOverrides";
export {
  notifyFlashcardRevision,
  subscribeFlashcardRevision,
  clearDirty,
  loadOverride,
  saveOverride,
  applyRemoteOverride,
  mergeCard,
  applyCardMark,
  archiveCardLearning,
  restartCardLearning,
  listOutbox,
  upsertOutbox,
  removeOutbox,
} from "./cardOverrides";
export type SyncState = "idle" | "saving" | "saved" | "error";

function canSync(url: string): boolean {
  return /notion\.(so|com|site)/i.test(url);
}

/** Chave estável da página Notion (ignora so/com e hífenes). */
export function notionUrlKey(url: string): string {
  const raw = url.trim().split("/").pop()?.split("?")[0]?.replace(/-/g, "") ?? "";
  const hex = raw.replace(/^p/, "").toLowerCase();
  return /^[0-9a-f]{32}$/.test(hex) ? hex : url.trim().toLowerCase();
}

export async function syncFlashcard(input: {
  url: string;
  lembrete: string | null;
  categoria: Flashcard["categoria"];
  status: Flashcard["status"];
  /** Se definido, falhas entram na outbox durável. */
  id?: string;
}): Promise<{ ok: boolean; queued?: boolean; localOnly?: boolean; error?: string }> {
  if (!canSync(input.url)) {
    // Cartão local (Bible → app) — sem página Notion; override já está no aparelho.
    if (input.id) removeOutbox(input.id);
    return { ok: true, localOnly: true };
  }
  try {
    const response = await fetch("/api/flashcard-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: input.url,
        lembrete: input.lembrete,
        categoria: input.categoria,
        status: input.status,
      }),
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      if (input.id) {
        upsertOutbox({
          id: input.id,
          url: input.url,
          lembrete: input.lembrete,
          categoria: input.categoria,
          status: input.status,
        });
      }
      return { ok: false, queued: Boolean(input.id), error: "API de sincronização indisponível" };
    }
    const payload = (await response.json().catch(() => ({}))) as {
      synced?: boolean;
      queued?: boolean;
      error?: string;
    };
    if (response.ok && payload.synced) {
      if (input.id) removeOutbox(input.id);
      return { ok: true };
    }
    if (input.id) {
      upsertOutbox({
        id: input.id,
        url: input.url,
        lembrete: input.lembrete,
        categoria: input.categoria,
        status: input.status,
      });
    }
    return {
      ok: false,
      queued: Boolean(payload.queued || input.id),
      error: payload.error ?? "falha ao sincronizar Lembrete",
    };
  } catch {
    if (input.id) {
      upsertOutbox({
        id: input.id,
        url: input.url,
        lembrete: input.lembrete,
        categoria: input.categoria,
        status: input.status,
      });
    }
    return { ok: false, queued: Boolean(input.id), error: "sem ligação" };
  }
}

type PullCard = {
  url: string;
  categoria?: Flashcard["categoria"];
  lembrete?: string | null;
  status?: Flashcard["status"] | null;
  criadoEm?: string | null;
  error?: string;
};

export type FlashcardPullResult = {
  updated: number;
  ok: boolean;
  error?: string;
  notes?: Seed[];
};

function remoteOverride(remote: PullCard): CardOverride | null {
  if (remote.error) return null;
  return {
    categoria: normalizeCategoria(remote.categoria),
    status: normalizeStatus(remote.status) ?? "estudo",
    lembrete: remote.lembrete ?? null,
  };
}

function remoteByUrlKey(remotes: PullCard[]): Map<string, PullCard> {
  const map = new Map<string, PullCard>();
  for (const item of remotes) {
    if (!item.url) continue;
    map.set(notionUrlKey(item.url), item);
  }
  return map;
}

/** Funde estados remotos no catálogo (excepto cartões dirty / outbox). */
export function mergeRemoteCardsIntoNotes(
  notes: Seed[],
  remotes: PullCard[],
): { notes: Seed[]; updated: number } {
  const byKey = remoteByUrlKey(remotes);
  const pendingIds = new Set(listOutbox().map((item) => item.id));
  let updated = 0;

  const next = notes.map((seed) => {
    let changed = false;
    const flashcards = (seed.flashcards ?? []).map((card) => {
      if (!card.url || isDirty(card.id) || pendingIds.has(card.id)) return card;
      const remote = byKey.get(notionUrlKey(card.url));
      if (!remote) return card;
      const override = remoteOverride(remote);
      if (!override) return card;
      const criadoEm = remote.criadoEm ?? card.criadoEm ?? null;
      const same =
        card.categoria === override.categoria &&
        card.status === override.status &&
        (card.lembrete ?? null) === override.lembrete &&
        (card.criadoEm ?? null) === criadoEm;
      const applied = applyRemoteOverride(card.id, override, false);
      if (same && !applied) return card;
      updated += 1;
      if (same) return card;
      changed = true;
      return { ...card, ...override, ...(criadoEm ? { criadoEm } : {}) };
    });
    return changed ? { ...seed, flashcards } : seed;
  });

  return { notes: updated ? next : notes, updated };
}

/** Lê Categoria/Lembrete/Status do Notion e actualiza o StudyOS (excepto cartões dirty). */
export async function pullFlashcardStates(
  cards: Array<{ id: string; url: string }>,
  options?: { persist?: boolean; notes?: Seed[] },
): Promise<FlashcardPullResult> {
  const pendingIds = new Set(listOutbox().map((item) => item.id));
  const syncable = cards.filter(
    (card) => canSync(card.url) && !isDirty(card.id) && !pendingIds.has(card.id),
  );
  if (!syncable.length) return { updated: 0, ok: true, notes: options?.notes };

  try {
    const response = await fetch("/api/flashcard-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pull: true,
        persist: Boolean(options?.persist),
        urls: syncable.map((card) => card.url),
      }),
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return { updated: 0, ok: false, error: "API de sincronização indisponível", notes: options?.notes };
    }
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      cards?: PullCard[];
      error?: string;
    };
    if (!response.ok || !payload.ok || !Array.isArray(payload.cards)) {
      return { updated: 0, ok: false, error: payload.error ?? "falha ao ler Notion", notes: options?.notes };
    }

    if (options?.notes) {
      const merged = mergeRemoteCardsIntoNotes(options.notes, payload.cards);
      if (merged.updated) notifyFlashcardRevision();
      return { updated: merged.updated, ok: true, notes: merged.notes };
    }

    const byKey = remoteByUrlKey(payload.cards);
    let updated = 0;
    for (const card of syncable) {
      const remote = byKey.get(notionUrlKey(card.url));
      if (!remote) continue;
      const next = remoteOverride(remote);
      if (!next) continue;
      if (applyRemoteOverride(card.id, next, false)) updated += 1;
    }
    if (updated) notifyFlashcardRevision();
    return { updated, ok: true };
  } catch {
    return { updated: 0, ok: false, error: "sem ligação", notes: options?.notes };
  }
}

/** Descarrega outbox local (+ fila Vite em dev) para o Notion. */
export async function flushFlashcardQueue(): Promise<{ flushed: number; remaining: number }> {
  const pending = listOutbox();
  let flushed = 0;
  for (const item of pending) {
    const result = await syncFlashcard({
      id: item.id,
      url: item.url,
      lembrete: item.lembrete,
      categoria: item.categoria,
      status: item.status,
    });
    if (!result.ok) break;
    clearDirty(item.id);
    removeOutbox(item.id);
    flushed += 1;
  }
  try {
    await fetch("/api/flashcard-sync");
  } catch {
    /* ignore */
  }
  if (flushed) notifyFlashcardRevision();
  return { flushed, remaining: listOutbox().length };
}

/**
 * Se há dirty sem outbox (sessão antiga), promove o override local para a fila durável.
 * Evita o PWA ficar para sempre a ignorar o Notion noutro aparelho.
 */
export function promoteDirtyOverridesToOutbox(
  cards: Array<{ id: string; url: string }>,
): number {
  let promoted = 0;
  const pending = new Set(listOutbox().map((item) => item.id));
  for (const card of cards) {
    if (!card.url || !isDirty(card.id) || pending.has(card.id)) continue;
    const local = loadOverride(card.id);
    if (!local) {
      clearDirty(card.id);
      continue;
    }
    upsertOutbox({
      id: card.id,
      url: card.url,
      lembrete: local.lembrete,
      categoria: local.categoria,
      status: local.status,
    });
    promoted += 1;
  }
  return promoted;
}

export type NotionSyncHealth = {
  ok: boolean;
  hasToken: boolean;
  error?: string;
};

/** GET /api/flashcard-sync — verifica se a API de produção tem NOTION_TOKEN. */
export async function probeNotionSyncHealth(): Promise<NotionSyncHealth> {
  try {
    const response = await fetch("/api/flashcard-sync");
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return { ok: false, hasToken: false, error: "API de sincronização indisponível" };
    }
    const payload = (await response.json().catch(() => ({}))) as {
      hasToken?: boolean;
      error?: string;
    };
    return {
      ok: response.ok,
      hasToken: Boolean(payload.hasToken),
      error: payload.hasToken ? undefined : "NOTION_TOKEN em falta no servidor",
    };
  } catch {
    return { ok: false, hasToken: false, error: "sem ligação" };
  }
}
