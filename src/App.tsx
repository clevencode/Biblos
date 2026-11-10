import { useCallback, useEffect, useRef, useState } from "react";
import { BibleReaderView } from "./components/BibleReaderView";
import { AppShellNav } from "./components/AppShellNav";
import { HomeShellPanel } from "./components/HomeShellPanel";
import { PlanShellPanel } from "./components/PlanShellPanel";
import { ProfileShellPanel } from "./components/ProfileShellPanel";
import { recordBibleRead, appendActivity } from "./activityLog";
import { consumeShareRefFromUrl } from "./shareVerse";
import { setVerseMarks } from "./verseMarks";
import { loadOrCreateProfile } from "./userProfile";
import { useNarrow } from "./layout";
import { BIBLE_COMPACT_TOOLS_MENU } from "./bible/bibleChromeLayout";
import {
  applyTheme,
  loadThemePref,
  nextThemePref,
  saveThemePref,
  watchSystemTheme,
  type ThemePref,
} from "./theme";
import { syncNativeChrome } from "./nativeChrome";
import { loadShellTab, saveShellTab, type ShellTab } from "./shellNav";
import type { BibleHistorySelect } from "./components/BibleHistorySheet";

function historyToFocusRef(ref: BibleHistorySelect): string {
  if (ref.verse != null) {
    return `${ref.bookId} ${ref.chapterId}.${ref.verse}`;
  }
  return `${ref.bookId} ${ref.chapterId}`;
}

export function App() {
  const narrow = useNarrow();
  const profile = loadOrCreateProfile();
  const [tab, setTab] = useState<ShellTab>(() => loadShellTab());
  const [bibleMounted, setBibleMounted] = useState(() => loadShellTab() === "bible");
  const [navHidden, setNavHidden] = useState(false);
  const [themePref, setThemePref] = useState<ThemePref>(() => loadThemePref());
  const [bibleFocusRef, setBibleFocusRef] = useState<string | null>(null);
  const [bibleFocusSeq, setBibleFocusSeq] = useState(0);
  const [activityTick, setActivityTick] = useState(0);
  const [offlineToast, setOfflineToast] = useState(false);
  const offlineToastSeen = useRef(false);
  const shareBooted = useRef(false);

  const bibleMode = tab === "bible";
  const bibleCompactTools = BIBLE_COMPACT_TOOLS_MENU && narrow && bibleMode;

  useEffect(() => {
    if (tab === "bible") setBibleMounted(true);
    saveShellTab(tab);
  }, [tab]);

  useEffect(() => {
    applyTheme(themePref);
    const stop = watchSystemTheme(() => applyTheme(themePref));
    return stop;
  }, [themePref]);

  useEffect(() => {
    void syncNativeChrome(applyTheme(themePref));
  }, [themePref]);

  useEffect(() => {
    if (shareBooted.current) return;
    shareBooted.current = true;
    const ref = consumeShareRefFromUrl();
    if (ref) {
      setTab("bible");
      setBibleFocusRef(ref);
      setBibleFocusSeq((n) => n + 1);
    }
  }, []);

  useEffect(() => {
    function onOffline() {
      if (offlineToastSeen.current) return;
      offlineToastSeen.current = true;
      setOfflineToast(true);
      window.setTimeout(() => setOfflineToast(false), 4200);
    }
    window.addEventListener("offline", onOffline);
    return () => window.removeEventListener("offline", onOffline);
  }, []);

  useEffect(() => {
    if (!bibleMode) setNavHidden(false);
  }, [bibleMode]);

  const selectTab = useCallback((next: ShellTab) => {
    setTab(next);
  }, []);

  const openBible = useCallback((ref?: string) => {
    if (ref) {
      setBibleFocusRef(ref);
      setBibleFocusSeq((n) => n + 1);
    }
    setTab("bible");
  }, []);

  const cycleTheme = useCallback(() => {
    const next = nextThemePref(themePref);
    setThemePref(next);
    saveThemePref(next);
    appendActivity("theme.change", { pref: next }, profile.id);
    setActivityTick((n) => n + 1);
  }, [profile.id, themePref]);

  function handleVerseMarked(payload: {
    color: string | null;
    verses: number[];
    bookId: string;
    chapterId: string;
    bookTitle: string;
  }) {
    const { color, verses, bookId, chapterId } = payload;
    if (!verses.length) return;
    setVerseMarks(bookId, chapterId, verses, color);
    if (color) {
      appendActivity(
        "verse.mark",
        { color, verseCount: verses.length },
        profile.id,
      );
      setActivityTick((n) => n + 1);
    }
  }

  return (
    <div
      className={`app biblos-shell skeleton-theme${
        narrow ? " is-narrow" : ""
      }${bibleMode ? " is-bible-mode" : ""}${bibleCompactTools ? " is-bible-compact-tools" : ""}`}
    >
      <a className="skip" href="#workspace">
        Aller au contenu
      </a>
      {offlineToast ? (
        <div className="offline-toast" role="status" aria-live="polite">
          <p>Hors ligne — tout reste enregistré sur cet appareil.</p>
          <button
            type="button"
            className="offline-toast-dismiss"
            aria-label="Fermer"
            onClick={() => setOfflineToast(false)}
          >
            ×
          </button>
        </div>
      ) : null}

      <main id="workspace" className={`workspace${narrow ? " is-mobile-vista" : ""}`}>
        <div className="note-shell">
          <div className="note-shell-main">
            <section className="graph-pane" aria-label="Contenu">
              <div className="graph-pane-body">
                <HomeShellPanel
                  active={tab === "home"}
                  activityTick={activityTick}
                  onOpenBible={(ref) => openBible(ref)}
                  onOpenPlan={() => selectTab("today")}
                />
                <PlanShellPanel
                  active={tab === "today"}
                  onOpenBible={() => selectTab("bible")}
                />
                <div
                  id="panel-bible"
                  role="tabpanel"
                  aria-labelledby="tab-bible"
                  hidden={!bibleMode}
                  className="pane-body"
                >
                  {bibleMounted ? (
                    <BibleReaderView
                      initialRef="Jean 3.16"
                      focusRef={bibleFocusRef}
                      focusSeq={bibleFocusSeq}
                      active={bibleMode}
                      compactViewport={narrow}
                      themePref={themePref}
                      onCycleTheme={cycleTheme}
                      onVerseMarked={handleVerseMarked}
                      onBibleRead={(payload) => {
                        const logged = recordBibleRead({
                          ...payload,
                          userId: profile.id,
                        });
                        if (logged) setActivityTick((n) => n + 1);
                      }}
                      onReadingHistoryChange={() => setActivityTick((n) => n + 1)}
                      onReadingChromeChange={narrow ? setNavHidden : undefined}
                      compactToolsMenu={bibleCompactTools}
                    />
                  ) : null}
                </div>
                <ProfileShellPanel
                  active={tab === "profile"}
                  activityTick={activityTick}
                  themePref={themePref}
                  onCycleTheme={cycleTheme}
                  onOpenPassage={(ref) => openBible(historyToFocusRef(ref))}
                  onHistoryChange={() => setActivityTick((n) => n + 1)}
                />
              </div>
            </section>
            <AppShellNav
              active={tab}
              onSelect={selectTab}
              immersiveHidden={bibleMode && navHidden}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
