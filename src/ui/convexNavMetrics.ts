/** Diâmetro do hub radial (deve bater com --mode-tabs-hub-size). */
export const CONVEX_HUB_SIZE_PX = 50;
/** Raio do hub. */
export const CONVEX_HUB_RADIUS_PX = CONVEX_HUB_SIZE_PX / 2;
/** Elevação do ápice até a linha plana (métrica histórica da barra convexa). */
export const CONVEX_DOME_RISE_PX = 34;
/** Altura do corpo plano abaixo da linha (px). */
export const CONVEX_BAR_BODY_PX = 62;
/** Altura total do chrome (rise + body). */
export const CONVEX_BAR_HEIGHT_PX = CONVEX_DOME_RISE_PX + CONVEX_BAR_BODY_PX;
/** Offset Y do topo do hub relativamente ao ápice (rise - radius). */
export const CONVEX_HUB_TOP_OFFSET_PX =
  CONVEX_DOME_RISE_PX - CONVEX_HUB_RADIUS_PX;
