/**
 * Gaveta de estudo versículo a versículo.
 * Chave: versionId:usfm:chapter:verse (+ universal usfm:chapter:verse).
 */

import { useEffect, useId, useRef, useState } from "react";
import { YvIcon } from "./YvIcon";
import { loadVerseStudy, type VerseStudyBundle } from "../bible/studyQueries";
import type { TskeRef } from "../bible/tske";
import {
  loadVerseNote,
  saveVerseNote,
} from "../bible/verseNotes";
import {
  languageForVersion,
  universalVerseKey,
  verseStudyKey,
  versionBadgeFor,
} from "../bible/readingScope";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import { useUiLocale } from "../i18n/UiLocaleContext";
import type { UiCopyKey } from "../i18n/uiCopy";

export type VerseStudyTab =
  | "context"
  | "refs"
  | "application"
  | "notes";

export type VerseStudyDrawerProps = {
  open: boolean;
  onClose: () => void;
  versionId: BibleTextVersionId;
  bookId: string;
  chapterId: string;
  verse: number;
  refLabel: string;
  /** Abre referência cruzada na mesma versão ativa. */
  onOpenRef: (usfm: string) => void;
  initialTab?: VerseStudyTab;
};

const TAB_KEYS: Array<{ id: VerseStudyTab; labelKey: UiCopyKey }> = [
  { id: "context", labelKey: "study.context" },
  { id: "refs", labelKey: "study.refs" },
  { id: "application", labelKey: "study.application" },
  { id: "notes", labelKey: "study.notes" },
];

function RefList({
  refs,
  onOpenRef,
  emptyLabel,
}: {
  refs: TskeRef[];
  onOpenRef: (usfm: string) => void;
  emptyLabel: string;
}) {
  if (!refs.length) {
    return <p className="bible-study-empty muted">{emptyLabel}</p>;
  }
  return (
    <ul className="bible-study-ref-list" role="list">
      {refs.map((item) => (
        <li key={item.usfm ?? item.label}>
          <button
            type="button"
            className="bible-study-ref"
            disabled={!item.usfm}
            onClick={() => {
              if (item.usfm) onOpenRef(item.usfm);
            }}
          >
            <YvIcon name="menu_book" className="bible-study-ref-icon" />
            <span className="bible-study-ref-label">{item.label}</span>
            {item.usfm ? (
              <YvIcon name="chevron_right" className="bible-study-ref-chevron" />
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function VerseStudyDrawer({
  open,
  onClose,
  versionId,
  bookId,
  chapterId,
  verse,
  refLabel,
  onOpenRef,
  initialTab = "refs",
}: VerseStudyDrawerProps) {
  const { t } = useUiLocale();
  const titleId = useId();
  const noteId = useId();
  const [tab, setTab] = useState<VerseStudyTab>(initialTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<VerseStudyBundle | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSavedAt, setNoteSavedAt] = useState<string | null>(null);
  const reqGen = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scopedKey = verseStudyKey(versionId, bookId, chapterId, verse);
  const universalKey = universalVerseKey(bookId, chapterId, verse);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
  }, [open, initialTab, scopedKey]);

  useEffect(() => {
    if (!open) return;
    const gen = ++reqGen.current;
    setBusy(true);
    setError(null);
    setBundle(null);
    void loadVerseStudy(bookId, chapterId, verse)
      .then((data) => {
        if (gen !== reqGen.current) return;
        setBundle(data);
      })
      .catch((err) => {
        if (gen !== reqGen.current) return;
        setError(err instanceof Error ? err.message : t("study.loadError"));
      })
      .finally(() => {
        if (gen === reqGen.current) setBusy(false);
      });
  }, [open, bookId, chapterId, verse, t]);

  useEffect(() => {
    if (!open) return;
    const existing = loadVerseNote(versionId, bookId, chapterId, verse);
    setNoteText(existing?.text ?? "");
    setNoteSavedAt(existing?.updatedAt ?? null);
  }, [open, versionId, bookId, chapterId, verse]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function scheduleSave(next: string) {
    setNoteText(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const record = saveVerseNote(
        {
          versionId,
          usfm: bookId,
          chapter: Number(chapterId),
          verse,
        },
        next,
      );
      setNoteSavedAt(record.text ? record.updatedAt : null);
    }, 450);
  }

  if (!open) return null;

  const heading = bundle?.tske?.heading;
  const refs = bundle?.tske?.refs ?? [];
  const badge = versionBadgeFor(versionId);
  const language = languageForVersion(versionId);

  return (
    <div
      className="bible-search-sheet bible-study-sheet verse-study-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-study-key={scopedKey}
      data-universal-key={universalKey}
      data-language={language}
    >
      <header className="bible-search-sheet-head bible-history-sheet-head">
        <button
          type="button"
          className="bible-search-sheet-back"
          onClick={onClose}
          aria-label={t("study.close")}
        >
          <YvIcon name="chevron_left" className="bible-search-sheet-back-icon" />
        </button>
        <h2 className="bible-search-sheet-title" id={titleId}>
          {t("study.title")}
        </h2>
        <span className="bible-search-sheet-spacer" aria-hidden />
      </header>

      <div className="bible-search-sheet-meta" aria-live="polite">
        <span className="bible-history-version-badge" data-version={versionId}>
          {badge}
        </span>
        <span>{refLabel}</span>
      </div>

      <div className="verse-study-tabs" role="tablist" aria-label={t("study.tabs")}>
        {TAB_KEYS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className={`verse-study-tab${tab === item.id ? " is-on" : ""}`}
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      <div className="verse-study-panel" role="tabpanel">
        {tab === "context" ? (
          <div className="verse-study-block">
            {heading ? (
              <p className="bible-study-heading">{heading}</p>
            ) : (
              <p className="bible-study-empty muted">{t("study.contextEmpty")}</p>
            )}
          </div>
        ) : null}

        {tab === "refs" ? (
          <div className="verse-study-block">
            {busy ? (
              <p className="bible-study-status muted" aria-hidden>
                …
              </p>
            ) : error ? (
              <p className="bible-search-sheet-error" role="alert">
                {error}
              </p>
            ) : (
              <RefList
                refs={refs}
                onOpenRef={onOpenRef}
                emptyLabel={t("study.refsEmpty")}
              />
            )}
          </div>
        ) : null}

        {tab === "application" ? (
          <div className="verse-study-block">
            <p className="bible-study-empty muted">{t("study.appEmpty")}</p>
          </div>
        ) : null}

        {tab === "notes" ? (
          <div className="verse-study-block verse-study-notes">
            <label className="sr-only" htmlFor={noteId}>
              {t("study.notesLabel")}
            </label>
            <textarea
              id={noteId}
              className="verse-study-notes-input"
              rows={8}
              value={noteText}
              onChange={(e) => scheduleSave(e.target.value)}
              placeholder={t("study.notesPlaceholder")}
            />
            <p className="verse-study-notes-meta muted">
              {noteSavedAt ? t("study.notesSaved") : t("study.notesDraft")}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
