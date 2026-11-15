/**
 * Painel de estudo embutido no sheet de seleção de versículos.
 * Abas: Contexte / Références / Application (sem Notes, sem dialog próprio).
 */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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
import { parseUsfmLocation } from "../youversion/usfm";

/** Scroll da lista Référence por verso de estudo — sobrevive a Aller / Retourner. */
const refsListScrollByKey = new Map<string, number>();

export function getRefsListScroll(scopedKey: string): number {
  return refsListScrollByKey.get(scopedKey) ?? 0;
}

export function setRefsListScroll(scopedKey: string, scrollTop: number): void {
  refsListScrollByKey.set(scopedKey, Math.max(0, scrollTop));
}

export type VerseStudyTab = "context" | "refs" | "application";

export type VerseStudyPanelProps = {
  versionId: BibleTextVersionId;
  bookId: string;
  chapterId: string;
  verse: number;
  books: YouVersionBook[];
  /** Cadeia: Aller au verset → destino focado (+ Retourner). */
  onOpenRef?: (usfm: string) => void;
  /**
   * Tab Référence activa. O modal de versículo só renderiza neste escopo
   * (não vaza para Verset); o cartão activo persiste ao voltar a Référence.
   */
  active?: boolean;
  /** Scroll a restaurar após Retourner (prioritário sobre o Map). */
  restoreScrollTop?: number | null;
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
  onGoToChapter,
  closeLabel,
  goToPassageLabel,
  loadingLabel,
  unavailableLabel,
}: {
  card: RefCard;
  versionId: BibleTextVersionId;
  onClose: () => void;
  onGoToChapter?: (usfm: string) => void;
  closeLabel: string;
  goToPassageLabel: string;
  loadingLabel: string;
  unavailableLabel: string;
}) {
  const titleId = useId();
  const [text, setText] = useState(card.preview);
  const [busy, setBusy] = useState(!card.preview.trim());

  useEffect(() => {
    /* Capture: fecha só este modal; Options / Escape pai não engolem. */
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
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

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="bible-study-ref-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {/* Scrim visual só — fecho persistente: X ou Escape */}
      <div className="bible-study-ref-modal-scrim" aria-hidden="true" />
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
          {card.usfm && onGoToChapter ? (
            <footer className="bible-study-ref-modal-foot">
              <button
                type="button"
                className="bible-study-ref-modal-go"
                onClick={() => {
                  if (!card.usfm) return;
                  const target = card.usfm;
                  onClose();
                  onGoToChapter(target);
                }}
              >
                {goToPassageLabel}
              </button>
            </footer>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function VerseStudyPanel({
  versionId,
  bookId,
  chapterId,
  verse,
  books,
  onOpenRef,
  active = true,
  restoreScrollTop = null,
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
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollRestoredRef = useRef(false);

  const scopedKey = verseStudyKey(versionId, bookId, chapterId, verse);
  const universalKey = universalVerseKey(bookId, chapterId, verse);
  const titleById = useMemo(() => bookTitleMap(books), [books]);

  const rememberListScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setRefsListScroll(scopedKey, el.scrollTop);
  };

  useEffect(() => {
    const key = scopedKey;
    return () => {
      const el = listRef.current;
      if (el) setRefsListScroll(key, el.scrollTop);
    };
  }, [scopedKey]);

  useEffect(() => {
    const gen = ++reqGen.current;
    setBusy(true);
    setError(null);
    setBundle(null);
    setActiveRef(null);
    scrollRestoredRef.current = false;
    void loadVerseStudy(bookId, chapterId, verse)
      .then((data) => {
        if (gen !== reqGen.current) return;
        setBundle(data);
        setError(data.unavailable ? "load" : null);
      })
      .catch(() => {
        if (gen !== reqGen.current) return;
        setBundle({ tske: null, unavailable: true });
        setError("load");
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

  const targetScrollTop =
    restoreScrollTop != null && restoreScrollTop > 0
      ? restoreScrollTop
      : getRefsListScroll(scopedKey);

  useEffect(() => {
    scrollRestoredRef.current = false;
  }, [scopedKey, active, targetScrollTop]);

  useEffect(() => {
    if (!active || busy || error || !cards.length) return;
    const el = listRef.current;
    if (!el || targetScrollTop <= 0) return;

    const tryRestore = () => {
      if (scrollRestoredRef.current) return;
      if (el.scrollHeight >= targetScrollTop + el.clientHeight * 0.5) {
        el.scrollTop = targetScrollTop;
        setRefsListScroll(scopedKey, targetScrollTop);
        scrollRestoredRef.current = true;
      }
    };

    tryRestore();
    const observer = new ResizeObserver(tryRestore);
    observer.observe(el);
    return () => observer.disconnect();
  }, [
    active,
    busy,
    error,
    cards.length,
    scopedKey,
    targetScrollTop,
    previewByUsfm,
  ]);

  const modalGoLabel = (usfm: string | null) => {
    if (!usfm) return t("study.goToPassage");
    const loc = parseUsfmLocation(usfm);
    return loc?.verse == null ? t("study.goToChapter") : t("study.goToPassage");
  };

  return (
    <div
      className="verse-study-panel-host"
      data-study-key={scopedKey}
      data-universal-key={universalKey}
      data-language={language}
    >
      <p className="verse-study-section-title">{t("study.crossRefs")}</p>

      <div
        ref={listRef}
        className="verse-study-panel"
        role="region"
        aria-label={t("study.crossRefs")}
        onScroll={rememberListScroll}
      >
        <div className="verse-study-block">
          {busy ? (
            <p className="bible-study-status muted" aria-busy="true">
              {t("common.loading")}
            </p>
          ) : error ? (
            <p className="bible-study-empty muted" role="status">
              {t("study.loadError")}
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

      {/* Modal só no escopo Référence — estado activeRef sobrevive ao tab Verset */}
      {active && activeRef ? (
        <RefTextModal
          card={activeRef}
          versionId={versionId}
          onClose={() => setActiveRef(null)}
          onGoToChapter={onOpenRef}
          closeLabel={t("common.close")}
          goToPassageLabel={modalGoLabel(activeRef.usfm)}
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
    />
  );
}
