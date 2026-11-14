/**
 * Superfície Convex Bottom Bar — Wave Curve simétrica sob o hub radial.
 * 1 SVG unit = 1 CSS px. Ápice em cx = width/2, y = 0.
 * Onda sobe (DOME_RISE - HUB_RADIUS) acima do topo do botão.
 */

import { useEffect, useMemo, useRef, useState } from "react";

/** Diâmetro do hub (deve bater com --mode-tabs-hub-size). */
export const CONVEX_HUB_SIZE_PX = 50;
/** Raio do hub. */
export const CONVEX_HUB_RADIUS_PX = CONVEX_HUB_SIZE_PX / 2;
/** @deprecated use CONVEX_HUB_RADIUS_PX */
export const CONVEX_DOME_HALF_PX = CONVEX_HUB_RADIUS_PX;
/**
 * Elevação do ápice até a linha plana (flatY).
 * Com hub radius 25 → onda sobe 9px acima do topo do botão.
 */
export const CONVEX_DOME_RISE_PX = 34;
/** Meia-largura da onda (curva fechada / arredondada). */
export const CONVEX_WAVE_SPREAD_PX = 68;
/** Altura do corpo plano abaixo da linha (px). */
export const CONVEX_BAR_BODY_PX = 62;
/** Altura total do SVG / chrome (rise + body). */
export const CONVEX_BAR_HEIGHT_PX = CONVEX_DOME_RISE_PX + CONVEX_BAR_BODY_PX;
/** Offset Y do topo do hub relativamente ao ápice (rise - radius). */
export const CONVEX_HUB_TOP_OFFSET_PX =
  CONVEX_DOME_RISE_PX - CONVEX_HUB_RADIUS_PX;

/** Offset dos handles Bézier para tangentes horizontais (spread * 0.52). */
const WAVE_HANDLE_FACTOR = 0.52;

type ConvexBottomBarSurfaceProps = {
  className?: string;
};

function buildConvexPaths(width: number): { fill: string; stroke: string } {
  const w = Math.max(width, 1);
  const flatY = CONVEX_DOME_RISE_PX;
  const apexY = 0;
  const h = CONVEX_BAR_HEIGHT_PX;
  const cx = w / 2;
  const spread = Math.min(CONVEX_WAVE_SPREAD_PX, Math.max(0, cx - 4));
  const left = cx - spread;
  const right = cx + spread;
  const hOff = spread * WAVE_HANDLE_FACTOR;

  /* Wave: flat → L → ápice → R → flat; dy = 0 nos três nós. cx = w/2. */
  const top = [
    `M 0 ${flatY}`,
    `L ${left} ${flatY}`,
    `C ${left + hOff} ${flatY}, ${cx - hOff} ${apexY}, ${cx} ${apexY}`,
    `C ${cx + hOff} ${apexY}, ${right - hOff} ${flatY}, ${right} ${flatY}`,
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
  const vbH = CONVEX_BAR_HEIGHT_PX;

  return (
    <div
      ref={rootRef}
      className={className ? `convex-bottom-bar ${className}` : "convex-bottom-bar"}
      style={{ height: vbH }}
      aria-hidden
    >
      <svg
        className="convex-bottom-bar-svg"
        width={width}
        height={vbH}
        viewBox={`0 0 ${width} ${vbH}`}
        preserveAspectRatio="xMidYMin meet"
        aria-hidden
      >
        <path className="convex-bottom-bar-fill" d={paths.fill} fill="currentColor" />
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
