import { useEffect, useState } from "react";

/**
 * Layout contract:
 * - Compact ≤ --bp-narrow (860): chrome mobile
 * Keep CSS var --bp-narrow in sync.
 */
export const NARROW_MAX_PX = 860;
export const NARROW_MEDIA_QUERY = `(max-width: ${NARROW_MAX_PX}px)`;

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
