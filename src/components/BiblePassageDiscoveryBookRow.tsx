import { useId, useLayoutEffect, useRef } from "react";
import { BibleSearchHighlight } from "./BibleSearchHighlight";
import { YvIcon } from "./YvIcon";
import type { DiscoveryBookHit } from "../bible/passageDiscovery/types";
import { useBookVerseDiscovery } from "../hooks/useBookVerseDiscovery";
import type { BibleTextVersionId } from "../bible/bibleVersions";
import type { BibleSearchHit } from "../youversion/client";

type BiblePassageDiscoveryBookRowProps = {
  hit: DiscoveryBookHit;
  searchQuery: string;
  hasQuery: boolean;
  textVersion: BibleTextVersionId;
  currentBookId: string;
  /** Capítulos do catálogo para este livro (acordeão sem query). */
  chapterIds: string[];
  /** Capítulo actual do leitor, se este for o livro sob consulta. */
  highlightChapterId: string;
  loading: boolean;
  expanded: boolean;
  anchorVerseUsfm: string | null;
  verseScrollTop: number;
  onToggleExpand: (bookId: string | null) => void;
  onVerseListScroll: (bookId: string, scrollTop: number) => void;
  onPickBook: (id: string) => void;
  onPickChapter: (bookId: string, chapterId: string) => void;
  onPickVerse: (hit: BibleSearchHit) => void;
  verseDiscoveryEnabled?: boolean;
  /** `false` no painel de palavras — cabeçalho só expande hits, não navega para o livro. */
  bookNavigateEnabled?: boolean;
};

export function BiblePassageDiscoveryBookRow({
  hit,
  searchQuery,
  hasQuery,
  textVersion,
  currentBookId,
  chapterIds,
  highlightChapterId,
  loading,
  expanded,
  anchorVerseUsfm,
  verseScrollTop,
  onToggleExpand,
  onVerseListScroll,
  onPickBook,
  onPickChapter,
  onPickVerse,
  verseDiscoveryEnabled = true,
  bookNavigateEnabled = true,
}: BiblePassageDiscoveryBookRowProps) {
  const panelId = useId();
  const verseListRef = useRef<HTMLUListElement | null>(null);
  const on = hit.id.toUpperCase() === currentBookId.toUpperCase();
  const contentHits = (hit.count ?? 0) > 0;
  /** Query com hits de conteúdo → acordeão de versículos. */
  const verseExpandable = verseDiscoveryEnabled && hasQuery && contentHits;
  /** Sem hits de versículo → acordeão de capítulos (também com filtro só por título). */
  const chapterExpandable =
    bookNavigateEnabled && !verseExpandable && chapterIds.length > 0;
  const expandable = verseExpandable || chapterExpandable;
  const { hits, total, busy, error } = useBookVerseDiscovery(
    searchQuery,
    expanded && verseExpandable ? hit.id : null,
    textVersion,
  );

  useLayoutEffect(() => {
    const ul = verseListRef.current;
    if (!ul || !expanded || !verseExpandable || busy) return;
    ul.scrollTop = verseScrollTop;
    if (verseScrollTop > 0) return;
    const anchor = anchorVerseUsfm?.toUpperCase() ?? "";
    if (!anchor.startsWith(`${hit.id.toUpperCase()}.`)) return;
    const btn = Array.from(
      ul.querySelectorAll<HTMLElement>("[data-discovery-usfm]"),
    ).find(
      (el) => el.getAttribute("data-discovery-usfm")?.toUpperCase() === anchor,
    );
    btn?.scrollIntoView({ block: "nearest" });
  }, [
    expanded,
    verseExpandable,
    busy,
    hits.length,
    verseScrollTop,
    anchorVerseUsfm,
    hit.id,
  ]);

  function handleRowActivate() {
    if (expandable) {
      onToggleExpand(expanded ? null : hit.id);
      return;
    }
    if (!bookNavigateEnabled) return;
    onPickBook(hit.id);
  }

  function handlePickVerse(verseHit: BibleSearchHit) {
    if (verseListRef.current) {
      onVerseListScroll(hit.id, verseListRef.current.scrollTop);
    }
    onPickVerse(verseHit);
  }

  const chapterCountLabel =
    chapterExpandable && chapterIds.length
      ? chapterIds.length
      : verseExpandable && hit.count != null
        ? hit.count
        : null;

  return (
    <div
      className={`bible-yv-pick-book-row${expanded ? " is-expanded" : ""}${expandable ? " is-expandable" : ""}${chapterExpandable ? " is-chapter-accordion" : ""}`}
    >
      <button
        id={`bible-pick-book-${hit.id}`}
        type="button"
        role="option"
        aria-selected={on}
        aria-expanded={expandable ? expanded : undefined}
        aria-controls={expandable ? panelId : undefined}
        className={`bible-yv-pick-cell is-book${on ? " is-on" : ""}`}
        onClick={handleRowActivate}
        disabled={loading}
      >
        <span className="bible-yv-pick-cell-label">{hit.title}</span>
        {expandable ? (
          <span className="bible-yv-pick-cell-expand-meta" aria-hidden>
            {chapterCountLabel != null ? (
              <span className="bible-yv-pick-cell-count">
                {chapterExpandable ? `(${chapterCountLabel})` : chapterCountLabel}
              </span>
            ) : null}
            <YvIcon
              name={expanded ? "keyboard_arrow_down" : "chevron_right"}
              opsz={24}
              className="bible-yv-pick-cell-expand-icon"
            />
          </span>
        ) : null}
      </button>

      {chapterExpandable && expanded ? (
        <div
          id={panelId}
          className="bible-yv-pick-chapter-panel"
          role="listbox"
          aria-label={`Chapitres de ${hit.title}`}
        >
          {chapterIds.map((id) => {
            const selected = id === highlightChapterId && on;
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`bible-yv-pick-cell${selected ? " is-on" : ""}`}
                onClick={() => onPickChapter(hit.id, id)}
                disabled={loading}
              >
                {id}
              </button>
            );
          })}
        </div>
      ) : null}

      {verseExpandable && expanded ? (
        <div
          id={panelId}
          className="bible-yv-pick-verse-panel"
          role="group"
          aria-label={`Versets dans ${hit.title}`}
        >
          {busy ? (
            <p className="bible-yv-pick-verse-panel-busy bible-yv-muted" role="status">
              Chargement des versets…
            </p>
          ) : error ? (
            <p className="bible-yv-pick-verse-panel-error bible-yv-muted" role="status">
              {error}
            </p>
          ) : hits.length ? (
            <>
              {total > hits.length ? (
                <p className="bible-yv-pick-verse-panel-cap bible-yv-muted">
                  {hits.length} sur {total} résultats
                </p>
              ) : null}
              <ul
                ref={verseListRef}
                className="bible-yv-pick-verse-hits"
                role="listbox"
                aria-label="Versets"
                onScroll={(event) => {
                  onVerseListScroll(hit.id, event.currentTarget.scrollTop);
                }}
              >
                {hits.map((verseHit) => {
                  const isAnchor =
                    anchorVerseUsfm != null &&
                    anchorVerseUsfm.toUpperCase().split("-")[0] ===
                      verseHit.usfm.toUpperCase().split("-")[0];
                  return (
                    <li key={verseHit.usfm}>
                      <button
                        type="button"
                        role="option"
                        data-discovery-usfm={verseHit.usfm.toUpperCase()}
                        className={`bible-yv-pick-verse-hit${isAnchor ? " is-anchor" : ""}`}
                        onClick={() => handlePickVerse(verseHit)}
                        disabled={loading}
                      >
                        <span className="bible-yv-pick-verse-hit-ref">
                          {verseHit.chapter}.{verseHit.verse}
                        </span>
                        <span className="bible-yv-pick-verse-hit-snippet">
                          <BibleSearchHighlight
                            text={verseHit.snippet || verseHit.text}
                            query={searchQuery}
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="bible-yv-pick-verse-panel-empty bible-yv-muted">Aucun verset</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
