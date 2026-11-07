import { useId, useLayoutEffect, useRef } from "react";
import { BibleSearchHighlight } from "./BibleSearchHighlight";
import { YvIcon } from "./YvIcon";
import type { DiscoveryBookHit } from "../bible/passageDiscovery/types";
import { useBookVerseDiscovery } from "../hooks/useBookVerseDiscovery";
import type { BibleSearchHit } from "../youversion/client";
import { buildDiscoveryVerseRowId } from "../bible/viewState/pickerViewState";

type BiblePassageDiscoveryBookRowProps = {
  hit: DiscoveryBookHit;
  searchQuery: string;
  hasQuery: boolean;
  currentBookId: string;
  loading: boolean;
  expanded: boolean;
  anchorVerseUsfm: string | null;
  verseScrollTop: number;
  onToggleExpand: (bookId: string | null) => void;
  onVerseListScroll: (bookId: string, scrollTop: number) => void;
  onPickBook: (id: string) => void;
  onPickVerse: (hit: BibleSearchHit) => void;
};

export function BiblePassageDiscoveryBookRow({
  hit,
  searchQuery,
  hasQuery,
  currentBookId,
  loading,
  expanded,
  anchorVerseUsfm,
  verseScrollTop,
  onToggleExpand,
  onVerseListScroll,
  onPickBook,
  onPickVerse,
}: BiblePassageDiscoveryBookRowProps) {
  const panelId = useId();
  const verseListRef = useRef<HTMLUListElement | null>(null);
  const on = hit.id.toUpperCase() === currentBookId.toUpperCase();
  const contentHits = (hit.count ?? 0) > 0;
  const expandable = hasQuery && contentHits;
  const { hits, total, busy, error } = useBookVerseDiscovery(
    searchQuery,
    expanded && expandable ? hit.id : null,
  );

  useLayoutEffect(() => {
    const ul = verseListRef.current;
    if (!ul || !expanded || busy) return;
    ul.scrollTop = verseScrollTop;
    if (verseScrollTop > 0) return;
    const anchor = anchorVerseUsfm?.toUpperCase() ?? "";
    if (!anchor.startsWith(`${hit.id.toUpperCase()}.`)) return;
    const btn = Array.from(ul.querySelectorAll<HTMLElement>("[data-discovery-usfm]")).find(
      (el) => el.getAttribute("data-discovery-usfm")?.toUpperCase() === anchor,
    );
    btn?.scrollIntoView({ block: "nearest" });
  }, [expanded, busy, hits.length, verseScrollTop, anchorVerseUsfm, hit.id]);

  function handleRowActivate() {
    if (expandable) {
      onToggleExpand(expanded ? null : hit.id);
      return;
    }
    onPickBook(hit.id);
  }

  function handlePickVerse(verseHit: BibleSearchHit) {
    if (verseListRef.current) {
      onVerseListScroll(hit.id, verseListRef.current.scrollTop);
    }
    onPickVerse(verseHit);
  }

  return (
    <div
      className={`bible-yv-pick-book-row${expanded ? " is-expanded" : ""}${expandable ? " is-expandable" : ""}`}
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
            {hit.count != null ? (
              <span className="bible-yv-pick-cell-count">{hit.count}</span>
            ) : null}
            <YvIcon
              name={expanded ? "expand_less" : "unfold_more"}
              opsz={24}
              className="bible-yv-pick-cell-expand-icon"
            />
          </span>
        ) : null}
      </button>

      {expandable && expanded ? (
        <div
          id={panelId}
          className="bible-yv-pick-verse-panel"
          role="group"
          aria-label={`Versets dans ${hit.title}`}
        >
          {busy ? (
            <>
              <p className="bible-yv-pick-verse-panel-busy bible-yv-muted" role="status">
                Chargement des versets…
              </p>
              <ul
                className="bible-yv-pick-verse-hits is-loading"
                aria-hidden
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <li key={buildDiscoveryVerseRowId(hit.id, i)}>
                    <div className="bible-yv-pick-verse-hit is-loading">
                      <span className="bible-yv-pick-verse-hit-ref is-opaque">
                        {i + 1}.{i + 1}
                      </span>
                      <span className="bible-yv-pick-verse-hit-snippet is-loading-line" />
                    </div>
                  </li>
                ))}
              </ul>
            </>
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
