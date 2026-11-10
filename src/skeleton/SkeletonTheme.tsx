import {
  createContext,
  useContext,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";

export type SkeletonThemeConfig = {
  baseColor?: string;
  highlightColor?: string;
  borderRadius?: string | number;
  duration?: number;
};

const SkeletonThemeContext = createContext<SkeletonThemeConfig | null>(null);

export function useSkeletonTheme(): SkeletonThemeConfig {
  return useContext(SkeletonThemeContext) ?? {};
}

type SkeletonThemeProps = SkeletonThemeConfig & {
  children: ReactNode;
  className?: string;
};

/** Envolve a árvore React — define tokens CSS (--skeleton-*). */
export function SkeletonTheme({
  children,
  className = "",
  baseColor,
  highlightColor,
  borderRadius,
  duration,
}: SkeletonThemeProps) {
  const theme = useMemo<SkeletonThemeConfig>(
    () => ({ baseColor, highlightColor, borderRadius, duration }),
    [baseColor, highlightColor, borderRadius, duration],
  );

  const style = useMemo((): CSSProperties | undefined => {
    const next: Record<string, string | number> = {};
    if (baseColor) next["--skeleton-base"] = baseColor;
    if (highlightColor) next["--skeleton-highlight"] = highlightColor;
    if (borderRadius != null) next["--skeleton-radius"] = borderRadius;
    if (duration != null) next["--skeleton-duration"] = `${duration}s`;
    return Object.keys(next).length ? (next as CSSProperties) : undefined;
  }, [baseColor, highlightColor, borderRadius, duration]);

  const hasCustomStyle = style != null && Object.keys(style).length > 0;

  return (
    <SkeletonThemeContext.Provider value={theme}>
      {hasCustomStyle || className ? (
        <div className={`skeleton-theme${className ? ` ${className}` : ""}`} style={style}>
          {children}
        </div>
      ) : (
        children
      )}
    </SkeletonThemeContext.Provider>
  );
}
