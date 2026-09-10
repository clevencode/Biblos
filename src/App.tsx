import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import seed from "./data/seed.json";
import { FlashcardDeck } from "./components/FlashcardDeck";
import { InboxView } from "./components/InboxView";
import { ModeTabIcon } from "./components/ModeTabIcon";
import { TodayView } from "./components/TodayView";
import { PlanGallery } from "./components/PlanGallery";
import { BibleReaderView } from "./components/BibleReaderView";
import type { Catalog, CenterMode, Flashcard, InboxCard, ReadingPlan, Seed } from "./types";
import {
  buildInbox,
  listAllFlashcards,
  planCardIds,
} from "./catalog";
import { mergeCard } from "./cardOverrides";
import { hydrateCatalogFromCache, persistCatalogCache, removeCardFromCatalog } from "./catalogSync";
import {
  ensurePlanStart,
  ensureDayCompleted,
  loadPlanProgress,
  markDayRead,
  nextUnreadJour,
  resetPlanProgress,
} from "./planProgress";
import {
  createPlanReadingSession,
  currentPlanStep,
  isFirstPlanStep,
  isLastPlanStep,
  type PlanReadingSession,
} from "./planReading";
import { useNotionSync } from "./useNotionSync";
import { useNarrow, useSplitLayout } from "./layout";
import { isPassageReminder } from "./passageReminder";

const UI_KEY = "biblos-ui";
const seedCatalog = hydrateCatalogFromCache(seed as Catalog);

const modes: { id: CenterMode; label: string }[] = [
  { id: "today", label: "Galerie" },
  { id: "bible", label: "Lecture" },
  { id: "cards", label: "Cartes" },
  { id: "inbox", label: "Inbox" },
];

type UiSession = {
  home?: boolean;
  mode?: CenterMode;
  planId?: string;
};

function readUi(): UiSession {
  try {
    const raw = localStorage.getItem(UI_KEY) ?? sessionStorage.getItem(UI_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as UiSession & { materiaIds?: unknown };
    if (!localStorage.getItem(UI_KEY) && sessionStorage.getItem(UI_KEY)) {
      localStorage.setItem(UI_KEY, raw);
      sessionStorage.removeItem(UI_KEY);
    }
    return parsed && typeof parsed === "object"
      ? { home: parsed.home, mode: parsed.mode, planId: parsed.planId }
      : {};
  } catch {
    return {};
  }
}

function writeUi(session: UiSession) {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(session));
    sessionStorage.removeItem(UI_KEY);
  } catch {
    /* private mode / quota */
  }
}

function isMode(value: unknown): value is CenterMode {
  return modes.some((item) => item.id === value);
}

export function App() {
  const initialUi = readUi();
  const [catalog, setCatalog] = useState<Catalog>(() => seedCatalog);
  const notes = catalog.notas;
  const plans = catalog.plans;
  const [mode, setMode] = useState<CenterMode>(() => {
    const value = initialUi.mode as string | undefined;
    if (value === "calendar") return "cards";
    return isMode(value) ? value : "today";
  });
  const [home, setHome] = useState(() => initialUi.home ?? !initialUi.planId);
  const [planId, setPlanId] = useState(() => initialUi.planId ?? plans[0]?.id ?? "");
  const [planProgressTick, setPlanProgressTick] = useState(0);
  const [dismissNotionBanner, setDismissNotionBanner] = useState(false);
  const narrow = useNarrow();
  const splitLayout = useSplitLayout();
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const [cardFocusId, setCardFocusId] = useState<string | null>(null);
  const [cardFocusSeq, setCardFocusSeq] = useState(0);
  const [bibleFocusRef, setBibleFocusRef] = useState<string | null>(null);
  const [bibleFocusSeq, setBibleFocusSeq] = useState(0);
  const [planReading, setPlanReading] = useState<PlanReadingSession | null>(null);
  const [retentionTick, setRetentionTick] = useState(0);
  const [bibleChromeHidden, setBibleChromeHidden] = useState(false);

  const activePlan = useMemo(
    () => plans.find((plan) => plan.id === planId) ?? plans[0] ?? null,
    [planId, plans],
  );
  const scopedCardIds = useMemo(() => planCardIds(activePlan), [activePlan]);

  const cards = useMemo(
    () => listAllFlashcards(notes, scopedCardIds).map(mergeCard),
    [scopedCardIds, notes, retentionTick],
  );
  const inbox = useMemo(() => buildInbox(notes, scopedCardIds), [scopedCardIds, notes, retentionTick]);

  const planProgress = useMemo(() => {
    if (!activePlan) return null;
    void planProgressTick;
    return loadPlanProgress(activePlan.id) ?? ensurePlanStart(activePlan.id);
  }, [activePlan, planProgressTick]);

  const todayJour = useMemo(() => {
    if (!activePlan) return 1;
    return nextUnreadJour(activePlan, planProgress);
  }, [activePlan, planProgress]);

  const { notionHealth } = useNotionSync({
    catalog,
    setCatalog,
    notesRef,
    setRetentionTick,
    mode,
    cardIds: scopedCardIds,
    activePlan,
  });

  useEffect(() => {
    if (plans.length && !plans.some((plan) => plan.id === planId)) {
      setPlanId(plans[0].id);
    }
  }, [planId, plans]);

  useEffect(() => {
    writeUi({ home, mode, planId: activePlan?.id });
  }, [activePlan?.id, home, mode]);

  useEffect(() => {
    if (mode !== "bible") setBibleChromeHidden(false);
  }, [mode]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector(".prop-select-menu")) return;
      if (mode === "today" && !home) {
        event.preventDefault();
        goHome();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [home, mode]);

  function goHome() {
    setHome(true);
    setMode("today");
  }

  function pickPlan(plan: ReadingPlan) {
    setPlanId(plan.id);
    setHome(false);
    setMode("today");
  }

  function openPassageInBible(reference: string, opts?: { keepPlanReading?: boolean }) {
    const ref = reference.trim();
    if (!ref) return;
    if (!opts?.keepPlanReading) setPlanReading(null);
    setHome(false);
    setBibleFocusRef(ref);
    setBibleFocusSeq((value) => value + 1);
    setMode("bible");
  }

  function startPlanReading(jour: number, _passage: string) {
    if (!activePlan) return;
    const session = createPlanReadingSession({
      planId: activePlan.id,
      startJour: jour,
      days: activePlan.days,
    });
    if (!session) {
      if (_passage.trim()) openPassageInBible(_passage);
      return;
    }
    setPlanReading(session);
    const step = currentPlanStep(session);
    if (step) openPassageInBible(step.focusRef, { keepPlanReading: true });
  }

  function exitPlanReading() {
    setPlanReading(null);
    setHome(false);
    setMode("today");
  }

  function planReadingPrev() {
    if (!planReading || isFirstPlanStep(planReading)) return;
    const next = { ...planReading, index: planReading.index - 1 };
    setPlanReading(next);
    const step = currentPlanStep(next);
    if (step) openPassageInBible(step.focusRef, { keepPlanReading: true });
  }

  function planReadingAdvance() {
    if (!planReading) return;
    const current = currentPlanStep(planReading);
    if (isLastPlanStep(planReading)) {
      if (current) {
        ensureDayCompleted(planReading.planId, current.jour);
        setPlanProgressTick((value) => value + 1);
      }
      setPlanReading(null);
      setHome(false);
      setMode("today");
      return;
    }
    const next = { ...planReading, index: planReading.index + 1 };
    setPlanReading(next);
    const step = currentPlanStep(next);
    if (step) openPassageInBible(step.focusRef, { keepPlanReading: true });
  }

  function openInboxItem(item: InboxCard) {
    if (isPassageReminder(item.frente, item.cardCategory)) {
      openPassageInBible(item.frente);
      return;
    }
  }

  function handleMarkRead(jour: number) {
    if (!activePlan) return;
    markDayRead(activePlan.id, jour);
    setPlanProgressTick((value) => value + 1);
  }

  function handleRestartPlan() {
    if (!activePlan) return;
    resetPlanProgress(activePlan.id);
    setPlanProgressTick((value) => value + 1);
  }

  function handleFlashcardCreated(card: Flashcard) {
    setCatalog((current) => {
      const notas = [...(current.notas ?? [])];
      const bucketKey = String(card.cardCategory || "VERSECARD");
      const bucketId = `bucket-${bucketKey.toLowerCase()}`;
      let seed = notas.find((item) => item.nota.id === bucketId);
      if (!seed) {
        seed = {
          nota: {
            id: bucketId,
            titulo: bucketKey,
            url: "",
            criadoEm: card.criadoEm || new Date().toISOString(),
            cartoes: 0,
          },
          materia: { id: `cat-${bucketKey.toLowerCase()}`, nome: bucketKey },
          disciplina: { id: `disc-${bucketKey.toLowerCase()}`, nome: bucketKey },
          flashcards: [],
        };
        notas.push(seed);
      }
      const exists = seed.flashcards.some((item) => item.id === card.id || item.url === card.url);
      const flashcards = exists
        ? seed.flashcards.map((item) =>
            item.id === card.id || item.url === card.url ? { ...item, ...card } : item,
          )
        : [card, ...seed.flashcards];
      const nextSeed: Seed = {
        ...seed,
        flashcards,
        nota: { ...seed.nota, cartoes: flashcards.length },
      };
      const nextNotas = notas.map((item) => (item.nota.id === nextSeed.nota.id ? nextSeed : item));

      const plans = (current.plans ?? []).map((plan) => {
        if (!activePlan || plan.id !== activePlan.id) return plan;
        if (!plan.cardIds?.length) return plan;
        if (plan.cardIds.includes(card.id)) return plan;
        return { ...plan, cardIds: [card.id, ...plan.cardIds] };
      });

      const next = { ...current, notas: nextNotas, plans };
      persistCatalogCache(next);
      return next;
    });
    setRetentionTick((value) => value + 1);

    void (async () => {
      const { syncVerseCardToNotion, attachNotionUrlToCatalog } = await import("./verseCardSync");
      const result = await syncVerseCardToNotion(card);
      if (result.ok && result.url) {
        setCatalog((prev) => attachNotionUrlToCatalog(prev, card.id, result.url!));
      }
    })();
  }

  function handleRemoveCard(card: Flashcard) {
    const label = card.frente?.trim() || "cette carte";
    if (!window.confirm(`Supprimer « ${label} » ?`)) return;
    setCatalog((current) => removeCardFromCatalog(current, card.id));
    setRetentionTick((value) => value + 1);
    void (async () => {
      const { archiveRemoteVerseCard } = await import("./verseCardSync");
      await archiveRemoteVerseCard(card);
    })();
  }

  function onTabKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const items = modes.map((item) => item.id);
    const index = Math.max(0, items.indexOf(mode));
    const next = items[(index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length];
    if (next === "today") setHome(true);
    else setHome(false);
    setMode(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  const themePanel = (
    <TodayView
      plan={activePlan}
      progress={planProgress}
      planJour={todayJour}
      onSelectGalerie={goHome}
      onMarkRead={handleMarkRead}
      onOpenPassage={openPassageInBible}
      onStartPlanReading={startPlanReading}
      onRestartPlan={handleRestartPlan}
    />
  );

  return (
    <div
      className={`app biblos-shell${narrow ? " is-narrow" : ""}${mode === "bible" ? " is-bible-mode" : ""}${bibleChromeHidden ? " is-bible-chrome-hidden" : ""}`}
    >
      <a className="skip" href="#workspace">
        Aller au contenu
      </a>
      {!dismissNotionBanner && (notionHealth === "no-token" || notionHealth === "down") ? (
        <div className="sync-health-banner" role="status">
          <p>
            {notionHealth === "no-token"
              ? "Synchronisation Notion indisponible : NOTION_TOKEN manquant sur le serveur (Vercel)."
              : "API de synchronisation Notion indisponible sur cet hôte."}
          </p>
          <button type="button" className="sync-health-dismiss" onClick={() => setDismissNotionBanner(true)}>
            Fermer
          </button>
        </div>
      ) : null}

      <main
        id="workspace"
        className={`workspace${narrow ? " is-mobile-vista" : ""}`}
      >
        <div className="note-shell">
          <div className="note-shell-main">
            <div className="mode-tabs">
              <div
                className="mode-tabs-nav"
                role="tablist"
                aria-label="Vues"
                onKeyDown={onTabKey}
              >
                {modes.map((item) => {
                  const on = mode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      id={`tab-${item.id}`}
                      className={on ? "is-on" : ""}
                      aria-selected={on}
                      aria-controls={`panel-${item.id}`}
                      aria-label={item.label}
                      title={item.label}
                      tabIndex={on ? 0 : -1}
                      onClick={() => {
                        if (item.id === "today") setHome(true);
                        else setHome(false);
                        setMode(item.id);
                      }}
                    >
                      <ModeTabIcon name={item.id} active={on} />
                      <span className="mode-tab-label">{item.label}</span>
                      {item.id === "cards" && cards.length ? (
                        <span className="mode-tab-badge">{cards.length}</span>
                      ) : null}
                      {item.id === "inbox" && inbox.length ? (
                        <span className="mode-tab-badge">{inbox.length}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <section className="graph-pane" aria-label="Contenu">
              <div className="graph-pane-body">
                <div
                  id="panel-today"
                  role="tabpanel"
                  aria-labelledby="tab-today"
                  hidden={mode !== "today"}
                  className="pane-body"
                >
                  {home ? (
                    <PlanGallery
                      embedded={narrow}
                      plans={plans}
                      selectedId={activePlan?.id ?? null}
                      onPick={pickPlan}
                    />
                  ) : (
                    themePanel
                  )}
                </div>
                <div
                  id="panel-bible"
                  role="tabpanel"
                  aria-labelledby="tab-bible"
                  hidden={mode !== "bible"}
                  className="pane-body"
                >
                  <BibleReaderView
                    initialRef="Jean 3.16"
                    focusRef={bibleFocusRef}
                    focusSeq={bibleFocusSeq}
                    onBack={planReading ? exitPlanReading : () => setMode("today")}
                    planReading={
                      planReading
                        ? {
                            label: currentPlanStep(planReading)?.label ?? "",
                            isFirst: isFirstPlanStep(planReading),
                            isLast: isLastPlanStep(planReading),
                            verseStart: currentPlanStep(planReading)?.verseStart ?? null,
                            verseEnd: currentPlanStep(planReading)?.verseEnd ?? null,
                            onPrev: planReadingPrev,
                            onAdvance: planReadingAdvance,
                          }
                        : null
                    }
                    onFlashcardCreated={handleFlashcardCreated}
                    onReadingChromeChange={setBibleChromeHidden}
                  />
                </div>
                <div
                  id="panel-cards"
                  role="tabpanel"
                  aria-labelledby="tab-cards"
                  hidden={mode !== "cards"}
                  className="pane-body"
                >
                  <FlashcardDeck
                    key={activePlan?.id ?? "none"}
                    cards={cards}
                    active={mode === "cards"}
                    selectedId={cardFocusId}
                    focusSeq={cardFocusSeq}
                    splitLayout={splitLayout}
                    onRemoveCard={handleRemoveCard}
                  />
                </div>
                <div
                  id="panel-inbox"
                  role="tabpanel"
                  aria-labelledby="tab-inbox"
                  hidden={mode !== "inbox"}
                  className="pane-body"
                >
                  <InboxView
                    items={inbox}
                    active={mode === "inbox"}
                    splitLayout={splitLayout}
                    onOpenPassage={openInboxItem}
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
