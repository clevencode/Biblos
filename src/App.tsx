import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import seed from "./data/seed.json";
import { CalendarView } from "./components/CalendarView";
import { FlashcardDeck } from "./components/FlashcardDeck";
import { InboxView } from "./components/InboxView";
import { ModeTabIcon } from "./components/ModeTabIcon";
import { TodayView } from "./components/TodayView";
import { PlanGallery } from "./components/PlanGallery";
import { BibleReaderView } from "./components/BibleReaderView";
import type { Catalog, CalendarCardItem, CenterMode, InboxCard, ReadingPlan } from "./types";
import {
  buildCalendarEvents,
  buildInbox,
  listAllFlashcards,
  planCardIds,
} from "./catalog";
import { mergeCard } from "./cardOverrides";
import { hydrateCatalogFromCache } from "./catalogSync";
import {
  ensurePlanStart,
  loadPlanProgress,
  markDayRead,
  nextUnreadJour,
} from "./planProgress";
import { useNotionSync } from "./useNotionSync";
import { useNarrow, useSplitLayout } from "./layout";
import { isPassageReminder } from "./passageReminder";

const UI_KEY = "biblos-ui";
const seedCatalog = hydrateCatalogFromCache(seed as Catalog);

const modes: { id: CenterMode; label: string }[] = [
  { id: "today", label: "Thème" },
  { id: "bible", label: "Lecture" },
  { id: "cards", label: "Cartes" },
  { id: "inbox", label: "Inbox" },
  { id: "calendar", label: "Calendrier" },
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
    const value = initialUi.mode;
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
  const [retentionTick, setRetentionTick] = useState(0);

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
  const calendar = useMemo(
    () => buildCalendarEvents(notes, scopedCardIds),
    [scopedCardIds, notes, retentionTick],
  );

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
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector(".prop-select-menu")) return;
      if (home) {
        event.preventDefault();
        leaveGalerie();
        return;
      }
      if (mode === "today") {
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

  function leaveGalerie() {
    setHome(false);
  }

  function pickPlan(plan: ReadingPlan) {
    setPlanId(plan.id);
    setHome(false);
    setMode("today");
  }

  function openPassageInBible(reference: string) {
    const ref = reference.trim();
    if (!ref) return;
    setHome(false);
    setBibleFocusRef(ref);
    setBibleFocusSeq((value) => value + 1);
    setMode("bible");
  }

  function openCalendarCard(item: CalendarCardItem) {
    if (isPassageReminder(item.title, item.cardCategory)) {
      openPassageInBible(item.title);
      return;
    }
    setHome(false);
    setCardFocusId(item.id);
    setCardFocusSeq((value) => value + 1);
    setMode("cards");
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

  function onTabKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const items = modes.map((item) => item.id);
    const index = Math.max(0, items.indexOf(mode));
    const next = items[(index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length];
    setHome(false);
    setMode(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  const activeModeLabel = modes.find((item) => item.id === mode)?.label ?? "";

  const planChrome = (
    <div className="biblos-plan-chrome">
      <div className="biblos-plan-chrome-brand">
        <span className="biblos-plan-kicker">Biblos</span>
        <span className="biblos-plan-chrome-sep" aria-hidden="true">
          ·
        </span>
        <button type="button" className="biblos-plan-kicker biblos-plan-galerie-link" onClick={goHome}>
          Galerie de Plan
        </button>
      </div>
      {plans.length ? (
        <label className="biblos-plan-picker">
          <span className="sr-only">Nom du plan</span>
          {plans.length === 1 ? (
            <span className="biblos-plan-name" title={activePlan?.nome}>
              {activePlan?.nome}
            </span>
          ) : (
            <select value={activePlan?.id ?? ""} onChange={(event) => setPlanId(event.target.value)}>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.nome}
                </option>
              ))}
            </select>
          )}
        </label>
      ) : (
        <p className="biblos-plan-empty muted">Aucun plan synchronisé</p>
      )}
    </div>
  );

  const themePanel = (
    <TodayView plan={activePlan} onSelectGalerie={goHome} />
  );

  return (
    <div className={`app biblos-shell${home ? " is-home" : ""}${narrow ? " is-narrow" : ""}`}>
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
        className={`workspace${home ? " is-home" : ""}${!home && narrow ? " is-mobile-vista" : ""}`}
      >
        {home ? (
          <div className="caderno-shell">
            <div className="caderno-main" id="galerie-home" aria-label="Galerie de Plan">
              {!narrow ? (
                <PlanGallery
                  plans={plans}
                  selectedId={activePlan?.id ?? null}
                  onPick={pickPlan}
                  onClose={leaveGalerie}
                />
              ) : null}
            </div>
            <aside className="search-filter-rail panel-nota" aria-label={narrow ? "Galerie" : "Thème"}>
              <div className="search-filter-body panel-nota-body">
                {narrow ? (
                  <PlanGallery
                    embedded
                    plans={plans}
                    selectedId={activePlan?.id ?? null}
                    onPick={pickPlan}
                    onClose={leaveGalerie}
                  />
                ) : (
                  themePanel
                )}
              </div>
            </aside>
          </div>
        ) : (
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
                          setHome(false);
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
                {mode !== "bible" && mode !== "today" ? planChrome : null}
                {narrow ? (
                  <p className="tab-section-title" id="tab-section-title">
                    {activeModeLabel}
                  </p>
                ) : null}
                <div className="graph-pane-body">
                  <div
                    id="panel-today"
                    role="tabpanel"
                    aria-labelledby="tab-today"
                    hidden={mode !== "today"}
                    className="pane-body"
                  >
                    {themePanel}
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
                      active={!home && mode === "cards"}
                      selectedId={cardFocusId}
                      focusSeq={cardFocusSeq}
                      splitLayout={splitLayout}
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
                      active={!home && mode === "inbox"}
                      splitLayout={splitLayout}
                      onOpenPassage={openInboxItem}
                    />
                  </div>
                  <div
                    id="panel-calendar"
                    role="tabpanel"
                    aria-labelledby="tab-calendar"
                    hidden={mode !== "calendar"}
                    className="pane-body"
                  >
                    <CalendarView
                      cards={calendar.cards}
                      cardCounts={calendar.cardCounts}
                      onPickCard={openCalendarCard}
                      active={!home && mode === "calendar"}
                      splitLayout={splitLayout}
                      plan={activePlan}
                      progress={planProgress}
                      planJour={todayJour}
                      onMarkRead={handleMarkRead}
                      onOpenPassage={openPassageInBible}
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
