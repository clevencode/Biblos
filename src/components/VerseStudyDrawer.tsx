/**
 * Painel de estudo embutido no sheet de seleção de versículos.
 * Abas: Contexte / Références / Application (sem Notes, sem dialog próprio).
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { YvIcon } from "./YvIcon";
import { loadVerseStudy, type VerseStudyBundle } from "../bible/studyQueries";
import type { TskeRef } from "../bible/tske";
import {
  languageForVersion,
  universalVerseKey,
  verseStudyKey,
} from "../bible/readingScope";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import { hydrateCrossRefTexts } from "../bible/crossRefPassageText";
import { ensureVerseIndex } from "../bible/verseIndexCache";
import { useUiLocale } from "../i18n/UiLocaleContext";
import type { YouVersionBook } from "../youversion/client";

/** Scroll da lista Référence por verso — sobrevive à troca de tab Verset/Référence. */
const refsListScrollByKey = new Map<string, number>();

function getRefsListScroll(scopedKey: string): number {
  return refsListScrollByKey.get(scopedKey) ?? 0;
}

function setRefsListScroll(scopedKey: string, scrollTop: number): void {
  refsListScrollByKey.set(scopedKey, Math.max(0, scrollTop));
}

export type VerseStudyTab = "context" | "refs" | "application";

export type VerseStudyPanelProps = {
  versionId: BibleTextVersionId;
  bookId: string;
  chapterId: string;
  verse: number;
  books: YouVersionBook[];
  /** Tab Référence visível — usado para restaurar scroll da lista. */
  active?: boolean;
  /**
   * Chip «Aller à …» na lista Référence → mesmo contrato DiscoveryJump
   * (USFM → ParsedPassage → navigateToParsedPassage no BibleReaderView).
   */
  onOpenRef?: (usfm: string) => void;
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

/** Lista Référence como chips Discovery («Aller à …» + preview inline). */
function RefList({
  cards,
  onJump,
  emptyLabel,
}: {
  cards: RefCard[];
  onJump?: (usfm: string) => void;
  emptyLabel: string;
}) {
  if (!cards.length) {
    return <p className="bible-study-empty muted">{emptyLabel}</p>;
  }
  return (
    <div className="bible-yv-pick-jumps bible-study-ref-jumps" role="group" aria-label="Références">
      {cards.map((item) => {
        const canJump = Boolean(item.usfm && onJump);
        return (
          <button
            key={item.key}
            type="button"
            className="bible-yv-pick-jump bible-study-ref-jump"
            disabled={!canJump}
            onClick={() => {
              if (!item.usfm || !onJump) return;
              onJump(item.usfm);
            }}
          >
            <YvIcon name="menu_book" opsz={20} className="bible-yv-pick-jump-icon" />
            <span className="bible-study-ref-copy">
              <span className="bible-yv-pick-jump-label">Aller à {item.label}</span>
              {item.preview ? (
                <span className="bible-study-ref-preview muted">{item.preview}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function VerseStudyPanel({
  versionId,
  bookId,
  chapterId,
  verse,
  books,
  active = true,
  onOpenRef,
}: VerseStudyPanelProps) {
  const { t } = useUiLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<VerseStudyBundle | null>(null);
  const [previewByUsfm, setPreviewByUsfm] = useState<Record<string, string>>(
    {},
  );
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

  const targetScrollTop = getRefsListScroll(scopedKey);

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
              onJump={onOpenRef}
              emptyLabel={t("study.refsEmpty")}
            />
          )}
        </div>
      </div>
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
