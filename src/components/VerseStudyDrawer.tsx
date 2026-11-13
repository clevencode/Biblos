/**
 * Painel de estudo embutido no sheet de seleção de versículos.
 * Abas: Contexte / Références / Application (sem Notes, sem dialog próprio).
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { YvIcon } from "./YvIcon";
import { loadVerseStudy, type VerseStudyBundle } from "../bible/studyQueries";
import type { TskeRef } from "../bible/tske";
import {
  languageForVersion,
  universalVerseKey,
  verseStudyKey,
} from "../bible/readingScope";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import { ensureVerseIndex } from "../bible/verseIndexCache";
import { useUiLocale } from "../i18n/UiLocaleContext";
import type { UiCopyKey } from "../i18n/uiCopy";
import type { YouVersionBook } from "../youversion/client";
import { parseUsfmParts } from "../youversion/client";

export type VerseStudyTab = "context" | "refs" | "application";

export type VerseStudyPanelProps = {
  versionId: BibleTextVersionId;
  bookId: string;
  chapterId: string;
  verse: number;
  books: YouVersionBook[];
  /** Reservado: navegação para a passagem (hoje o card abre modal de texto). */
  onOpenRef?: (usfm: string) => void;
  initialTab?: VerseStudyTab;
};

/** @deprecated Preferir VerseStudyPanel — mantido para compat. */
export type VerseStudyDrawerProps = VerseStudyPanelProps & {
  open: boolean;
  onClose: () => void;
  refLabel?: string;
};

/** Contesto / Application reservados — só Referências ativo por agora. */
const TAB_KEYS: Array<{
  id: VerseStudyTab;
  labelKey: UiCopyKey;
  enabled: boolean;
}> = [
  { id: "context", labelKey: "study.context", enabled: false },
  { id: "refs", labelKey: "study.refs", enabled: true },
  { id: "application", labelKey: "study.application", enabled: false },
];

const EMPTY_REFS: TskeRef[] = [];

type RefCard = {
  key: string;
  usfm: string | null;
  label: string;
  preview: string;
};

function bookTitleMap(books: YouVersionBook[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const book of books) {
    const id = String(book.id || "").toUpperCase();
    if (!id) continue;
    const title = String(book.title || book.fullTitle || id).trim();
    if (title) map.set(id, title);
  }
  return map;
}

/** Labels a partir do catálogo da versão ativa (não CANON_BOOKS FR). */
export function localizeTskeRefLabel(
  usfm: string | null,
  fallbackLabel: string,
  titleById: Map<string, string>,
): string {
  if (!usfm) return fallbackLabel;
  const raw = String(usfm).trim();
  const [bookRaw = "", chapterRaw = "", verseRaw = ""] = raw.split(".");
  const bookId = bookRaw.toUpperCase();
  if (!bookId || !chapterRaw) return fallbackLabel;
  const title = titleById.get(bookId) || bookId;
  if (!verseRaw) return `${title} ${chapterRaw}`;
  return `${title} ${chapterRaw}.${verseRaw}`;
}

function firstVerseKey(usfm: string): string | null {
  const parts = parseUsfmParts(usfm);
  if (!parts.bookId || !parts.chapterId || parts.verse == null) return null;
  return `${parts.bookId.toUpperCase()}.${parts.chapterId}.${parts.verse}`;
}

function RefList({
  cards,
  onSelect,
  emptyLabel,
}: {
  cards: RefCard[];
  onSelect: (card: RefCard) => void;
  emptyLabel: string;
}) {
  if (!cards.length) {
    return <p className="bible-study-empty muted">{emptyLabel}</p>;
  }
  return (
    <ul className="bible-study-ref-list is-compact" role="list">
      {cards.map((item) => (
        <li key={item.key}>
          <button
            type="button"
            className="bible-study-ref is-compact"
            disabled={!item.usfm && !item.preview}
            onClick={() => onSelect(item)}
          >
            <span className="bible-study-ref-copy">
              <span className="bible-study-ref-label">{item.label}</span>
              {item.preview ? (
                <span className="bible-study-ref-preview muted">{item.preview}</span>
              ) : null}
            </span>
            <YvIcon name="chevron_right" className="bible-study-ref-chevron" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function RefTextModal({
  card,
  onClose,
  closeLabel,
}: {
  card: RefCard;
  onClose: () => void;
  closeLabel: string;
}) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="bible-study-ref-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        className="bible-study-ref-modal-scrim"
        aria-label={closeLabel}
        onClick={onClose}
      />
      <div className="bible-study-ref-modal-card">
        <div className="bible-study-ref-modal-surface">
          <header className="bible-study-ref-modal-head">
            <h3 className="bible-study-ref-modal-title" id={titleId}>
              {card.label}
            </h3>
            <button
              type="button"
              className="bible-study-ref-modal-close"
              onClick={onClose}
              aria-label={closeLabel}
            >
              <YvIcon name="close" className="bible-study-ref-modal-close-icon" />
            </button>
          </header>
          <div className="bible-study-ref-modal-body">
            {card.preview ? (
              <p className="bible-study-ref-modal-text">{card.preview}</p>
            ) : (
              <p className="bible-study-ref-modal-text muted">{card.label}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function VerseStudyPanel({
  versionId,
  bookId,
  chapterId,
  verse,
  books,
  initialTab = "refs",
}: VerseStudyPanelProps) {
  const { t } = useUiLocale();
  const [tab, setTab] = useState<VerseStudyTab>("refs");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<VerseStudyBundle | null>(null);
  const [previewByUsfm, setPreviewByUsfm] = useState<Record<string, string>>(
    {},
  );
  const [activeRef, setActiveRef] = useState<RefCard | null>(null);
  const reqGen = useRef(0);

  const scopedKey = verseStudyKey(versionId, bookId, chapterId, verse);
  const universalKey = universalVerseKey(bookId, chapterId, verse);
  const titleById = useMemo(() => bookTitleMap(books), [books]);

  useEffect(() => {
    void initialTab;
    setTab("refs");
    setActiveRef(null);
  }, [initialTab, scopedKey]);

  useEffect(() => {
    const gen = ++reqGen.current;
    setBusy(true);
    setError(null);
    setBundle(null);
    void loadVerseStudy(bookId, chapterId, verse)
      .then((data) => {
        if (gen !== reqGen.current) return;
        setBundle(data);
        setError(null);
      })
      .catch(() => {
        if (gen !== reqGen.current) return;
        // Dados TSKE ausentes / HTML fallback → empty state, sem stack técnica.
        setBundle({ tske: null });
        setError(null);
      })
      .finally(() => {
        if (gen === reqGen.current) setBusy(false);
      });
  }, [bookId, chapterId, verse]);

  const rawRefs = bundle?.tske?.refs ?? EMPTY_REFS;

  useEffect(() => {
    const refs = bundle?.tske?.refs ?? EMPTY_REFS;
    if (tab !== "refs" || !refs.length) {
      setPreviewByUsfm({});
      return;
    }
    let cancelled = false;
    void ensureVerseIndex(versionId)
      .then((index) => {
        if (cancelled) return;
        const byKey = new Map<string, string>();
        for (const v of index.verses) {
          byKey.set(
            `${v.bookId.toUpperCase()}.${v.chapter}.${v.verse}`,
            v.raw,
          );
        }
        const next: Record<string, string> = {};
        for (const ref of refs) {
          if (!ref.usfm) continue;
          const key = firstVerseKey(ref.usfm);
          if (!key) continue;
          const text = byKey.get(key);
          if (text) next[ref.usfm] = text;
        }
        setPreviewByUsfm(next);
      })
      .catch(() => {
        if (!cancelled) setPreviewByUsfm({});
      });
    return () => {
      cancelled = true;
    };
  }, [tab, bundle, versionId]);

  const cards = useMemo((): RefCard[] => {
    return rawRefs.map((ref: TskeRef, i) => ({
      key: ref.usfm ?? `${ref.label}-${i}`,
      usfm: ref.usfm,
      label: localizeTskeRefLabel(ref.usfm, ref.label, titleById),
      preview: ref.usfm ? previewByUsfm[ref.usfm] ?? "" : "",
    }));
  }, [rawRefs, titleById, previewByUsfm]);

  const heading = bundle?.tske?.heading;
  const language = languageForVersion(versionId);

  return (
    <div
      className="verse-study-panel-host"
      data-study-key={scopedKey}
      data-universal-key={universalKey}
      data-language={language}
    >
      <div className="verse-study-tabs" role="tablist" aria-label={t("study.tabs")}>
        {TAB_KEYS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className={`verse-study-tab${tab === item.id ? " is-on" : ""}${
              item.enabled ? "" : " is-disabled"
            }`}
            aria-selected={tab === item.id}
            aria-disabled={!item.enabled}
            disabled={!item.enabled}
            onClick={() => {
              if (!item.enabled) return;
              setTab(item.id);
            }}
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
              <p className="bible-study-status muted" aria-busy="true">
                {t("common.loading")}
              </p>
            ) : error ? (
              <p className="bible-study-empty muted" role="status">
                {t("study.refsEmpty")}
              </p>
            ) : (
              <RefList
                cards={cards}
                onSelect={setActiveRef}
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
      </div>

      {activeRef ? (
        <RefTextModal
          card={activeRef}
          onClose={() => setActiveRef(null)}
          closeLabel={t("common.close")}
        />
      ) : null}
    </div>
  );
}

/** Compat: se ainda aberto como dialog, renderiza só o painel. */
export function VerseStudyDrawer({
  open,
  versionId,
  bookId,
  chapterId,
  verse,
  books = [],
  onOpenRef,
  initialTab,
}: VerseStudyDrawerProps) {
  if (!open) return null;
  return (
    <VerseStudyPanel
      versionId={versionId}
      bookId={bookId}
      chapterId={chapterId}
      verse={verse}
      books={books}
      onOpenRef={onOpenRef}
      initialTab={initialTab}
    />
  );
}
