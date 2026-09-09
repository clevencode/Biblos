import { useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { listInboxSyncCards, listScopedFlashcards } from "./catalog";
import { pullCatalog } from "./catalogSync";
import {
  flushFlashcardQueue,
  probeNotionSyncHealth,
  promoteDirtyOverridesToOutbox,
  pullFlashcardStates,
  subscribeFlashcardRevision,
} from "./flashcardSync";
import {
  attachNotionUrlToCatalog,
  enqueuePendingVerseCreatesFromCatalog,
  flushVerseCardCreates,
} from "./verseCardSync";
import { DESCRIPTION_PULL_MS, pullPlanDescription } from "./planDescriptionSync";
import type { Catalog, CenterMode, ReadingPlan, Seed } from "./types";

const NOTION_PULL_MS = 12_000;
const CATALOG_PULL_MS = 45_000;
const HEALTH_PULL_MS = 60_000;
const INBOX_RECONCILE_MS = 25_000;

const FLASHCARD_SYNC_MODES: CenterMode[] = ["cards", "inbox", "calendar"];

/**
 * Polling Notion + révisions locales.
 * Catalogue via /api/catalog ; Devotional du plan actif via /api/description-sync
 * (équivalent Resumo StudyOS).
 */
export function useNotionSync(options: {
  catalog: Catalog;
  setCatalog: Dispatch<SetStateAction<Catalog>>;
  notesRef: MutableRefObject<Seed[]>;
  setRetentionTick: Dispatch<SetStateAction<number>>;
  mode: CenterMode;
  cardIds?: string[] | null;
  activePlan?: ReadingPlan | null;
}): { notionHealth: "unknown" | "ok" | "no-token" | "down" } {
  const { catalog, setCatalog, notesRef, setRetentionTick, mode, cardIds, activePlan } = options;

  const [notionHealth, setNotionHealth] = useState<"unknown" | "ok" | "no-token" | "down">("unknown");
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;

  useEffect(() => subscribeFlashcardRevision(() => setRetentionTick((value) => value + 1)), [setRetentionTick]);

  useEffect(() => {
    void (async () => {
      enqueuePendingVerseCreatesFromCatalog(catalogRef.current);
      await flushFlashcardQueue();
      const versePush = await flushVerseCardCreates();
      if (versePush.updates.length) {
        setCatalog((prev) => {
          let next = prev;
          for (const item of versePush.updates) {
            next = attachNotionUrlToCatalog(next, item.localId, item.url);
          }
          return next;
        });
      }
    })();
  }, [setCatalog]);

  useEffect(() => {
    let cancelled = false;
    let busy = false;

    async function syncCatalog() {
      if (busy || cancelled) return;
      busy = true;
      try {
        enqueuePendingVerseCreatesFromCatalog(catalogRef.current);
        const versePush = await flushVerseCardCreates();
        if (!cancelled && versePush.updates.length) {
          setCatalog((prev) => {
            let next = prev;
            for (const item of versePush.updates) {
              next = attachNotionUrlToCatalog(next, item.localId, item.url);
            }
            return next;
          });
        }
        const result = await pullCatalog(catalogRef.current);
        if (!cancelled && result.changed) {
          setCatalog(result.catalog);
        }
      } finally {
        busy = false;
      }
    }

    void syncCatalog();
    const timer = window.setInterval(() => void syncCatalog(), CATALOG_PULL_MS);
    function onVisibility() {
      if (document.visibilityState === "visible") void syncCatalog();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [setCatalog]);

  useEffect(() => {
    if (!activePlan?.url) return;
    let cancelled = false;
    let busy = false;

    async function syncDescription() {
      if (busy || cancelled || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const result = await pullPlanDescription(catalogRef.current.plans, activePlan);
        if (!cancelled && result.changed) {
          setCatalog((prev) => ({ ...prev, plans: result.plans }));
        }
      } finally {
        busy = false;
      }
    }

    void syncDescription();
    const timer = window.setInterval(() => void syncDescription(), DESCRIPTION_PULL_MS);
    function onVisibility() {
      if (document.visibilityState === "visible") void syncDescription();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activePlan?.id, activePlan?.url, setCatalog]);

  useEffect(() => {
    let cancelled = false;
    let busy = false;

    async function reconcileInbox() {
      if (busy || cancelled || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const candidates = listInboxSyncCards(notesRef.current, []);
        const scoped = listScopedFlashcards(notesRef.current, []);
        promoteDirtyOverridesToOutbox(scoped.length ? scoped : candidates);
        await flushFlashcardQueue();
        const cards = listInboxSyncCards(notesRef.current, []);
        if (!cards.length) return;
        const result = await pullFlashcardStates(cards, { notes: notesRef.current });
        if (!cancelled && result.notes && result.updated) {
          setCatalog((prev) => ({ ...prev, notas: result.notes! }));
        }
      } finally {
        busy = false;
      }
    }

    void reconcileInbox();
    const timer = window.setInterval(() => void reconcileInbox(), INBOX_RECONCILE_MS);
    function onVisibility() {
      if (document.visibilityState === "visible") void reconcileInbox();
    }
    window.addEventListener("online", onVisibility);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("online", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [notesRef, setCatalog]);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const health = await probeNotionSyncHealth();
      if (cancelled) return;
      if (!health.ok && health.error === "API de sincronização indisponível") {
        setNotionHealth("down");
        return;
      }
      setNotionHealth(health.hasToken ? "ok" : "no-token");
    }
    void check();
    const timer = window.setInterval(() => void check(), HEALTH_PULL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const notionPullActive = FLASHCARD_SYNC_MODES.includes(mode);
  const scopedSyncCards = useMemo(() => {
    if (mode === "inbox") return listInboxSyncCards(catalog.notas, cardIds);
    return listScopedFlashcards(catalog.notas, mode === "cards" ? cardIds : null);
  }, [catalog.notas, cardIds, mode]);

  useEffect(() => {
    if (!notionPullActive || !scopedSyncCards.length) return;
    let cancelled = false;
    let busy = false;
    const persistSeed = mode === "calendar" || mode === "inbox";
    const cards = scopedSyncCards;

    async function pullFromNotion() {
      if (busy || cancelled || document.visibilityState === "hidden") return;
      busy = true;
      try {
        await flushFlashcardQueue();
        const result = await pullFlashcardStates(cards, {
          persist: persistSeed,
          notes: notesRef.current,
        });
        if (!cancelled && result.notes && result.updated) {
          setCatalog((prev) => ({ ...prev, notas: result.notes! }));
        }
      } finally {
        busy = false;
      }
    }

    void pullFromNotion();
    const timer = window.setInterval(() => void pullFromNotion(), NOTION_PULL_MS);
    function onVisibility() {
      if (document.visibilityState === "visible") void pullFromNotion();
    }
    window.addEventListener("online", onVisibility);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("online", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [notionPullActive, scopedSyncCards, mode, notesRef, setCatalog]);

  return { notionHealth };
}
