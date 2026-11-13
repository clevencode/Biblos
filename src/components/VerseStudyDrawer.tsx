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
import {
  hydrateCrossRefTexts,
  resolveCrossRefPassageText,
} from "../bible/crossRefPassageText";
import { ensureVerseIndex } from "../bible/verseIndexCache";
import { useUiLocale } from "../i18n/UiLocaleContext";
import type { YouVersionBook } from "../youversion/client";

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
  versionId,
  onClose,
  closeLabel,
  loadingLabel,
  unavailableLabel,
}: {
  card: RefCard;
  versionId: BibleTextVersionId;
  onClose: () => void;
  closeLabel: string;
  loadingLabel: string;
  unavailableLabel: string;
}) {
  const titleId = useId();
  const [text, setText] = useState(card.preview);
  const [busy, setBusy] = useState(!card.preview.trim());

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (card.preview.trim()) {
      setText(card.preview);
      setBusy(false);
      return;
    }
    if (!card.usfm) {
      setText("");
      setBusy(false);
      return;
    }
    let cancelled = false;
    setBusy(true);
    void resolveCrossRefPassageText(versionId, card.usfm)
      .then((next) => {
        if (!cancelled) setText(next);
      })
      .catch(() => {
        if (!cancelled) setText("");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [card.preview, card.usfm, versionId]);

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
            {busy ? (
              <p className="bible-study-ref-modal-text muted" aria-busy="true">
                {loadingLabel}
              </p>
            ) : text ? (
              <p className="bible-study-ref-modal-text">{text}</p>
            ) : (
              <p className="bible-study-ref-modal-text muted" role="status">
                {unavailableLabel}
              </p>
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
    if (!refs.length) {
      setPreviewByUsfm({});
      return;
    }
    let cancelled = false;
    const usfms = refs.map((ref) => ref.usfm).filter(Boolean) as string[];
    void (async () => {
      try {
        let byKey: Map<string, string> | null = null;
        try {
          const index = await ensureVerseIndex(versionId);
          byKey = new Map<string, string>();
          for (const v of index.verses) {
            byKey.set(
              `${v.bookId.toUpperCase()}.${v.chapter}.${v.verse}`,
              v.raw,
            );
          }
        } catch {
          byKey = null;
        }
        if (cancelled) return;
        const next = await hydrateCrossRefTexts(versionId, usfms, byKey);
        if (!cancelled) setPreviewByUsfm(next);
      } catch {
        if (!cancelled) setPreviewByUsfm({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bundle, versionId]);

  const cards = useMemo((): RefCard[] => {
    return rawRefs.map((ref: TskeRef, i) => ({
      key: ref.usfm ?? `${ref.label}-${i}`,
      usfm: ref.usfm,
      label: localizeTskeRefLabel(ref.usfm, ref.label, titleById),
      preview: ref.usfm ? previewByUsfm[ref.usfm] ?? "" : "",
    }));
  }, [rawRefs, titleById, previewByUsfm]);

  const language = languageForVersion(versionId);

  return (
    <div
      className="verse-study-panel-host"
      data-study-key={scopedKey}
      data-universal-key={universalKey}
      data-language={language}
    >
      <p className="verse-study-section-title">{t("study.crossRefs")}</p>

      <div className="verse-study-panel" role="region" aria-label={t("study.crossRefs")}>
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
      </div>

      {activeRef ? (
        <RefTextModal
          card={activeRef}
          versionId={versionId}
          onClose={() => setActiveRef(null)}
          closeLabel={t("common.close")}
          loadingLabel={t("common.loading")}
          unavailableLabel={t("study.refUnavailable")}
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
