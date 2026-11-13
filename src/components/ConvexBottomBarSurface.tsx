/**
 * Superfície Convex Bottom Bar — chrome SVG sob o hub radial.
 * Domo = semicírculo com o mesmo raio do botão central (100% do hub).
 */

import { useEffect, useMemo, useRef, useState } from "react";

/** Diâmetro do hub (deve bater com --mode-tabs-hub-size). */
export const CONVEX_HUB_SIZE_PX = 56;
/** Raio do hub / meia-largura e elevação do domo (semicírculo exacto). */
export const CONVEX_HUB_RADIUS_PX = CONVEX_HUB_SIZE_PX / 2;
/** @deprecated use CONVEX_HUB_RADIUS_PX */
export const CONVEX_DOME_HALF_PX = CONVEX_HUB_RADIUS_PX;
/** Elevação = raio → ápice = topo do botão quando o centro está na linha plana. */
export const CONVEX_DOME_RISE_PX = CONVEX_HUB_RADIUS_PX;
/** Altura do corpo plano abaixo da linha (px). */
export const CONVEX_BAR_BODY_PX = 40;

/** Kappa para aproximar um quarto de círculo com cúbica de Bézier. */
const CIRCLE_KAPPA = 0.5522847498;

type ConvexBottomBarSurfaceProps = {
  className?: string;
};

function buildConvexPaths(width: number): { fill: string; stroke: string } {
  const r = CONVEX_HUB_RADIUS_PX;
  const w = Math.max(width, r * 2 + 8);
  const flatY = CONVEX_DOME_RISE_PX;
  const h = flatY + CONVEX_BAR_BODY_PX;
  const cx = w / 2;
  const k = CIRCLE_KAPPA;
  const left = cx - r;
  const right = cx + r;
  const apexY = flatY - r; /* = 0 quando rise === r */

  /* Semicírculo superior: (left,flat) → ápice → (right,flat), simétrico. */
  const top = [
    `M 0 ${flatY}`,
    `L ${left} ${flatY}`,
    `C ${left} ${flatY - r * k}, ${cx - r * k} ${apexY}, ${cx} ${apexY}`,
    `C ${cx + r * k} ${apexY}, ${right} ${flatY - r * k}, ${right} ${flatY}`,
    `L ${w} ${flatY}`,
  ].join(" ");

  const fill = `${top} L ${w} ${h} L 0 ${h} Z`;
  return { fill, stroke: top };
}

export function ConvexBottomBarSurface({ className }: ConvexBottomBarSurfaceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(390);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const next = el.getBoundingClientRect().width;
      if (next > 0) setWidth(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const paths = useMemo(() => buildConvexPaths(width), [width]);
  const vbH = CONVEX_DOME_RISE_PX + CONVEX_BAR_BODY_PX;

  return (
    <div
      ref={rootRef}
      className={className ? `convex-bottom-bar ${className}` : "convex-bottom-bar"}
      aria-hidden
    >
      <svg
        className="convex-bottom-bar-svg"
        width="100%"
        height={vbH}
        viewBox={`0 0 ${width} ${vbH}`}
        preserveAspectRatio="none"
      >
        <path className="convex-bottom-bar-fill" d={paths.fill} />
        <path
          className="convex-bottom-bar-stroke"
          d={paths.stroke}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
