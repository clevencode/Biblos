import { useEffect, useMemo, useRef, useState } from "react";
import { dateKey, todayKey } from "./calendar";
import {
  loadOverride,
  mergeCard,
  saveOverride,
  syncFlashcard,
  applyCardMark,
  archiveCardLearning,
  restartCardLearning,
  clearDirty,
  subscribeFlashcardRevision,
  type CardOverride,
  type SyncState,
} from "./flashcardSync";
import { isDue, studyQueue } from "./retention";
import type { Flashcard, RetentionMark } from "./types";

export type FlashcardSessionOptions = {
  active: boolean;
  /** Teclado da sessão (revelar/marcar/setas). Por omissão segue `active`. */
  enableKeys?: boolean;
  selectedId?: string | null;
  focusSeq?: number;
  /** Mantém a ordem recebida em vez de reordenar com studyQueue (ex.: Timeline). */
  preserveOrder?: boolean;
  /**
   * Après une note, retire la carte de la file figée (legacy due-only).
   * Défaut false — Timeline / Cartes gardent la carte à l’agenda.
   */
  dropAfterMark?: boolean;
  /** Inclui cartões Encerrado na fila (sessão Cartões / disciplina). */
  includeEncerrado?: boolean;
  /** Navigation / avance limitées au même jour de lembrete (Timeline). */
  dayScope?: boolean;
};

function cardIndex(cards: Flashcard[], id: string | null | undefined): number {
  if (!id) return 0;
  const next = cards.findIndex((card) => card.id === id);
  return next >= 0 ? next : 0;
}

/** Congela a ordem SRS; com includeEncerrado, encerrados ficam no fim. */
function freezeStudyOrder(
  merged: Flashcard[],
  frozenIds: string[] | null,
  includeEncerrado: boolean,
): { queue: Flashcard[]; ids: string[] } {
  const active = includeEncerrado
    ? studyQueue(merged.filter((card) => card.status !== "encerrado"))
    : studyQueue(merged);
  const closed = includeEncerrado
    ? merged
        .filter((card) => card.status === "encerrado")
        .sort((a, b) => a.frente.localeCompare(b.frente, "pt"))
    : [];
  const ordered = [...active, ...closed];

  if (!frozenIds) {
    return { queue: ordered, ids: ordered.map((card) => card.id) };
  }
  const byId = new Map(merged.map((card) => [card.id, card]));
  const queue: Flashcard[] = [];
  for (const id of frozenIds) {
    const card = byId.get(id);
    if (card) queue.push(card);
  }
  const seen = new Set(queue.map((card) => card.id));
  for (const card of ordered) {
    if (!seen.has(card.id)) queue.push(card);
  }
  return { queue, ids: frozenIds };
}

/**
 * Timeline / ordre figé: conserve les ids reçus; snapshots si une carte
 * disparaît du filtre parent (legacy due-only).
 */
function freezeInboxOrder(
  merged: Flashcard[],
  frozenIds: string[] | null,
  heldById: Map<string, Flashcard>,
): Flashcard[] {
  if (!frozenIds) return merged;
  const live = new Map(merged.map((card) => [card.id, card]));
  const queue: Flashcard[] = [];
  for (const id of frozenIds) {
    const fromLive = live.get(id);
    if (fromLive) {
      heldById.set(id, fromLive);
      queue.push(fromLive);
      continue;
    }
    const held = heldById.get(id);
    if (held) queue.push(mergeCard(held));
  }
  return queue;
}

export function useFlashcardSession(
  cards: Flashcard[],
  {
    active,
    enableKeys,
    selectedId = null,
    focusSeq = 0,
    preserveOrder = false,
    dropAfterMark,
    includeEncerrado = false,
    dayScope = false,
  }: FlashcardSessionOptions,
) {
  const keysOn = enableKeys ?? active;
  const removeAfterMark = dropAfterMark ?? false;
  /**
   * O cartão activo é identificado por id, nunca por índice. O índice é derivado
   * no próprio render, para que uma reordenação da fila (pull do Notion) não
   * produza um render intermédio a apontar para outro cartão.
   */
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Flip ligado ao id do cartão — nunca é herdado por outro cartão. */
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [local, setLocal] = useState<CardOverride | null>(null);
  const [sync, setSync] = useState<SyncState>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [sessionMark, setSessionMark] = useState<RetentionMark | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [frozenIds, setFrozenIds] = useState<string[] | null>(null);
  const advanceTimer = useRef<number>(0);
  const dragRef = useRef({ active: false, startX: 0, moved: false });
  const listRef = useRef<HTMLElement>(null);
  const queueRef = useRef<Flashcard[]>([]);
  const indexRef = useRef(0);
  const heldByIdRef = useRef<Map<string, Flashcard>>(new Map());
  const preserveOrderRef = useRef(preserveOrder);
  const removeAfterMarkRef = useRef(removeAfterMark);
  const dayScopeRef = useRef(dayScope);
  /** Impede duplo toque (ex.: Fácil×2) antes do React actualizar `sync`. */
  const markingRef = useRef(false);
  const live = useRef({ flipped: false, sync: "idle" as SyncState, card: null as Flashcard | null, total: 0 });
  preserveOrderRef.current = preserveOrder;
  removeAfterMarkRef.current = removeAfterMark;
  dayScopeRef.current = dayScope;

  const mergedCards = useMemo(() => {
    const merged = cards.map(mergeCard);
    if (includeEncerrado) return merged;
    return merged.filter((card) => card.status !== "encerrado");
  }, [cards, includeEncerrado]);

  const queue = useMemo(() => {
    if (preserveOrder) return freezeInboxOrder(mergedCards, frozenIds, heldByIdRef.current);
    return freezeStudyOrder(mergedCards, frozenIds, includeEncerrado).queue;
  }, [frozenIds, includeEncerrado, mergedCards, preserveOrder]);

  useEffect(() => {
    if ((frozenIds && frozenIds.length > 0) || !mergedCards.length) return;
    if (preserveOrder) {
      heldByIdRef.current = new Map(mergedCards.map((card) => [card.id, card]));
      setFrozenIds(mergedCards.map((card) => card.id));
      return;
    }
    setFrozenIds(freezeStudyOrder(mergedCards, null, includeEncerrado).ids);
  }, [frozenIds, includeEncerrado, mergedCards, preserveOrder]);

  useEffect(() => {
    if (!active) {
      setFrozenIds(null);
      heldByIdRef.current = new Map();
    }
  }, [active]);

  const total = queue.length;
  const dueCount = queue.filter((card) => isDue(card.lembrete)).length;

  /** Segue o cartão activo pelo id; se ele saiu da fila, mantém o mesmo slot. */
  const index = useMemo(() => {
    if (!queue.length) return 0;
    const at = activeId ? queue.findIndex((item) => item.id === activeId) : -1;
    if (at >= 0) return at;
    return Math.min(Math.max(indexRef.current, 0), queue.length - 1);
  }, [activeId, queue]);

  const source = queue[index];
  const card = useMemo(() => {
    if (!source) return null;
    const stored = local ?? loadOverride(source.id) ?? null;
    return stored ? { ...source, ...stored } : source;
  }, [local, source]);

  const dayPeers = useMemo(() => {
    if (!dayScope || !source) return null;
    const day = source.lembrete ? dateKey(source.lembrete) : null;
    if (!day) {
      return queue.filter((item) => !item.lembrete);
    }
    return queue.filter((item) => item.lembrete && dateKey(item.lembrete) === day);
  }, [dayScope, queue, source]);

  const slideQueue = dayPeers ?? queue;
  const slideIndex = useMemo(() => {
    if (!source) return 0;
    const at = slideQueue.findIndex((item) => item.id === source.id);
    return at >= 0 ? at : 0;
  }, [slideQueue, source]);

  const flipped = flippedId != null && flippedId === source?.id;
  const mark = sessionMark ?? card?.categoria ?? null;
  const canNav = slideQueue.length > 1;
  const canGoPrev = canNav;
  const canGoNext = canNav;

  queueRef.current = queue;
  indexRef.current = index;
  live.current = { flipped, sync, card, total };

  function goTo(next: number) {
    const length = queueRef.current.length;
    if (length <= 0) return;
    const clamped = ((next % length) + length) % length;
    window.clearTimeout(advanceTimer.current);
    indexRef.current = clamped;
    setActiveId(queueRef.current[clamped]?.id ?? null);
  }

  function goToId(id: string) {
    const next = queueRef.current.findIndex((item) => item.id === id);
    if (next >= 0) goTo(next);
  }

  function peersFor(card: Flashcard | null | undefined, q: Flashcard[]): Flashcard[] {
    if (!card) return q;
    const day = card.lembrete ? dateKey(card.lembrete) : null;
    if (!day) return q.filter((item) => !item.lembrete);
    return q.filter((item) => item.lembrete && dateKey(item.lembrete) === day);
  }

  /** Navegação livre (swipe / setas / botões): cicla le jour (Timeline) ou le baralho. */
  function go(delta: number) {
    const q = queueRef.current;
    if (q.length <= 1) return;
    if (dayScopeRef.current) {
      const current = q[indexRef.current];
      const peers = peersFor(current, q);
      if (peers.length > 1) {
        const at = peers.findIndex((item) => item.id === current?.id);
        if (at >= 0) {
          const next = peers[(at + delta + peers.length) % peers.length];
          goToId(next.id);
          return;
        }
      }
      return;
    }
    goTo(indexRef.current + delta);
  }

  /**
   * Après classer: avance vers la carte suivante.
   * dropAfterMark (Inbox): retire de la file figée.
   * dayScope (Timeline): reste sur le même jour de lembrete.
   */
  function advanceAfterMark(fromId: string) {
    const q = queueRef.current;
    const from = q.findIndex((item) => item.id === fromId);
    const fromCard = from >= 0 ? q[from] : null;
    let nextId: string | null = null;
    if (dayScopeRef.current && fromCard) {
      const peers = peersFor(fromCard, q);
      const at = peers.findIndex((item) => item.id === fromId);
      nextId = at >= 0 && at + 1 < peers.length ? peers[at + 1].id : null;
    } else {
      nextId = from >= 0 && from + 1 < q.length ? q[from + 1].id : null;
    }

    window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => {
      if (preserveOrderRef.current && removeAfterMarkRef.current) {
        heldByIdRef.current.delete(fromId);
        setFrozenIds((ids) => {
          if (!ids) return ids;
          const next = ids.filter((id) => id !== fromId);
          return next.length ? next : null;
        });
        if (nextId) {
          setActiveId(nextId);
          return;
        }
        setActiveId(null);
        heldByIdRef.current = new Map();
        setFlippedId(null);
        return;
      }

      if (!queueRef.current.some((item) => item.id === fromId) && !dayScopeRef.current) return;
      if (nextId && queueRef.current.some((item) => item.id === nextId)) {
        goToId(nextId);
        return;
      }
      setFlippedId(null);
    }, 280);
  }

  function toggleFlip() {
    const id = source?.id;
    if (!id) return;
    setFlippedId((current) => (current === id ? null : id));
  }

  function onSlidePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button > 0) return;
    dragRef.current = { active: true, startX: event.clientX, moved: false };
    setDragging(canNav);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onSlidePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    const delta = event.clientX - dragRef.current.startX;
    if (!canNav) return;
    if (Math.abs(delta) > 8) dragRef.current.moved = true;
    setDragX(delta);
  }

  function finishSlidePointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    const delta = event.clientX - dragRef.current.startX;
    const moved = dragRef.current.moved;
    dragRef.current.active = false;
    setDragging(false);
    setDragX(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (canNav && moved && Math.abs(delta) > 56) {
      go(delta > 0 ? -1 : 1);
      return;
    }
    if (!moved) toggleFlip();
  }

  async function applyOverride(fromId: string, url: string, next: CardOverride, advance = false) {
    saveOverride(fromId, next);
    setLocal(next);
    setSync("saving");
    setSyncError(null);
    live.current = { ...live.current, sync: "saving" };
    try {
      const result = await syncFlashcard({
        id: fromId,
        url,
        lembrete: next.lembrete,
        categoria: next.categoria,
        status: next.status,
      });
      if (result.ok) {
        clearDirty(fromId);
        setSync("saved");
        setSyncError(null);
        live.current = { ...live.current, sync: "saved" };
      } else {
        setSync("error");
        setSyncError(
          result.queued
            ? "Hors ligne — reste en file et synchronise sur un autre appareil bientôt"
            : (result.error ?? "Échec de la synchronisation Notion"),
        );
        live.current = { ...live.current, sync: "error" };
      }
      if (advance) advanceAfterMark(fromId);
    } finally {
      markingRef.current = false;
    }
  }

  function setMark(value: RetentionMark) {
    const current = live.current;
    // Uma classificação por verso (evita contagem dupla no mesmo toque).
    if (!current?.card || !current.flipped) return;
    if (current.card.status === "encerrado") return;
    if (markingRef.current || current.sync === "saving" || current.sync === "saved") return;
    const fromId = current.card.id;
    const fromCard = queueRef.current.find((item) => item.id === fromId) ?? current.card;
    const stored = loadOverride(fromId);
    markingRef.current = true;
    setSessionMark(value);
    setSync("saving");
    live.current = { ...live.current, sync: "saving" };
    void applyOverride(
      fromId,
      fromCard.url || "",
      applyCardMark(value, current.card, stored, todayKey()),
      true,
    );
  }

  function archiveCard() {
    const current = live.current;
    if (!current?.card || current.card.status === "encerrado") return;
    if (markingRef.current || current.sync === "saving") return;
    const fromId = current.card.id;
    const fromCard = queueRef.current.find((item) => item.id === fromId) ?? current.card;
    markingRef.current = true;
    setSessionMark(null);
    setSync("saving");
    live.current = { ...live.current, sync: "saving" };
    void applyOverride(fromId, fromCard.url || "", archiveCardLearning(todayKey()), true);
  }

  function restartLearning() {
    const current = live.current;
    if (!current?.card || current.card.status !== "encerrado") return;
    if (markingRef.current || current.sync === "saving") return;
    const fromId = current.card.id;
    const fromCard = queueRef.current.find((item) => item.id === fromId) ?? current.card;
    markingRef.current = true;
    setSessionMark(null);
    setSync("saving");
    live.current = { ...live.current, sync: "saving" };
    void applyOverride(fromId, fromCard.url || "", restartCardLearning(fromCard, todayKey()), false);
  }

  // Único ponto de reset: mudar de cartão limpa flip, marca, sync e override local.
  useEffect(() => {
    markingRef.current = false;
    setFlippedId(null);
    setSessionMark(null);
    setSync("idle");
    setSyncError(null);
    setLocal(source ? loadOverride(source.id) ?? null : null);
  }, [source?.id]);

  // Pull Notion (App) actualiza localStorage — refresca o cartão aberto sem marcar dirty.
  useEffect(() => {
    return subscribeFlashcardRevision(() => {
      if (live.current.sync === "saving") return;
      const currentId = live.current.card?.id;
      if (currentId) setLocal(loadOverride(currentId) ?? null);
    });
  }, []);

  // O índice já é derivado do id activo; aqui só se reancora o id ao cartão
  // realmente exibido (caso ele tenha saído da fila).
  useEffect(() => {
    const shownId = source?.id ?? null;
    if (shownId !== activeId) setActiveId(shownId);
  }, [activeId, source?.id]);

  useEffect(() => {
    if (!selectedId) return;
    indexRef.current = cardIndex(queueRef.current, selectedId);
    setActiveId(selectedId);
  }, [focusSeq, selectedId]);

  useEffect(() => {
    const activeItem = listRef.current?.querySelector<HTMLElement>(
      ".flash-plan-event.is-active",
    );
    activeItem?.scrollIntoView({ block: "nearest" });
  }, [index]);

  useEffect(() => {
    if (!keysOn) return;
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (
        target.closest(
          "input, textarea, a, .flash-mark, .flash-list, .flash-plan-scroller, .flash-list-scroller, .inbox-scroller",
        )
      )
        return;
      // Setas: permitem navegar mesmo com foco no viewport / botões de nav.
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
        return;
      }
      if (target.closest("button")) return;
      if (live.current.card?.status === "encerrado") {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          const id = live.current.card?.id;
          if (!id) return;
          setFlippedId((current) => (current === id ? null : id));
        }
        return;
      }
      if (live.current.flipped && (event.key === "1" || event.key === "a" || event.key === "A")) {
        event.preventDefault();
        setMark("encore");
        return;
      }
      if (live.current.flipped && (event.key === "2" || event.key === "d" || event.key === "D")) {
        event.preventDefault();
        setMark("dificil");
        return;
      }
      if (live.current.flipped && (event.key === "3" || event.key === "c" || event.key === "C")) {
        event.preventDefault();
        setMark("medio");
        return;
      }
      if (live.current.flipped && (event.key === "4" || event.key === "f" || event.key === "F")) {
        event.preventDefault();
        setMark("facil");
        return;
      }
      // Anki: Space/Enter révèle ; verso visible → Correct (Good).
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (live.current.flipped) {
          if (live.current.sync !== "saving") setMark("medio");
          return;
        }
        const id = live.current.card?.id;
        if (!id) return;
        setFlippedId(id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(advanceTimer.current);
    };
  }, [keysOn]);

  return {
    queue,
    slideQueue,
    slideIndex,
    dayScope,
    total,
    dueCount,
    index,
    card,
    flipped,
    flippedId,
    mark,
    sync,
    syncError,
    canNav,
    canGoPrev,
    canGoNext,
    dragX,
    dragging,
    listRef,
    goTo,
    goToId,
    go,
    toggleFlip,
    setMark,
    archiveCard,
    restartLearning,
    onSlidePointerDown,
    onSlidePointerMove,
    finishSlidePointer,
  };
}

export type FlashcardSession = ReturnType<typeof useFlashcardSession>;
