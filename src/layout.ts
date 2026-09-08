import { useEffect, useState } from "react";

/**
 * Layout contract (Material window size classes adapted to StudyOS):
 * - Compact  ≤ --bp-narrow (860): chrome mobile, uma vista de cada vez
 * - Medium   861–1279: página + vista; lista↔cartão em ecrãs sucessivos (não split)
 * - Expanded ≥ --bp-split (1280): lista | cartão lado a lado (master–detail)
 * Keep CSS vars --bp-narrow / --bp-split in sync.
 */
export const NARROW_MAX_PX = 860;
export const SPLIT_MIN_PX = 1280;

export const NARROW_MEDIA_QUERY = `(max-width: ${NARROW_MAX_PX}px)`;
export const SPLIT_MEDIA_QUERY = `(min-width: ${SPLIT_MIN_PX}px)`;

function useMediaQuery(query: string, initial = false): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return initial;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Viewport compacto (≤860px). */
export function useNarrow(): boolean {
  return useMediaQuery(NARROW_MEDIA_QUERY);
}

/**
 * Master–detail lista|cartão só em ecrãs expanded (≥1200px).
 * Em medium, preferir list↔detail (como Gmail/Material em janelas médias).
 */
export function useSplitLayout(): boolean {
  return useMediaQuery(SPLIT_MEDIA_QUERY);
}
