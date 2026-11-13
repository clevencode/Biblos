import {
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  ConvexBottomBarSurface,
  CONVEX_BAR_BODY_PX,
  CONVEX_DOME_RISE_PX,
  CONVEX_HUB_SIZE_PX,
} from "./ConvexBottomBarSurface";
import { ModeTabIcon } from "./ModeTabIcon";
import { YvIcon } from "./YvIcon";
import { SHELL_TABS, type ShellTab } from "../shellNav";
import { useUiLocale } from "../i18n/UiLocaleContext";

type AppShellNavProps = {
  active: ShellTab;
  onSelect: (tab: ShellTab) => void;
  immersiveHidden?: boolean;
};

/**
 * Leque superior simétrico: centro em -90° (topo CSS), span 120°,
 * passo constante → espelho L/R perfeito.
 */
function arcAnglesDeg(
  count: number,
  spanDeg = 120,
  centerDeg = -90,
): number[] {
  if (count <= 1) return [centerDeg];
  const start = centerDeg - spanDeg / 2;
  const step = spanDeg / (count - 1);
  return Array.from({ length: count }, (_, i) => start + i * step);
}

const RADIUS_PX = 88;

export function AppShellNav({
  active,
  onSelect,
  immersiveHidden = false,
}: AppShellNavProps) {
  const { t } = useUiLocale();
  const rootId = useId();
  const [open, setOpen] = useState(false);
  const activeLabel = t(
    SHELL_TABS.find((item) => item.id === active)?.labelKey ?? "shell.bible",
  );

  /** Tab ativa só no hub fechado; no arco só as outras (sem duplicar). */
  const arcTabs = useMemo(
    () => SHELL_TABS.filter((item) => item.id !== active),
    [active],
  );
  const arcAngles = useMemo(
    () => arcAnglesDeg(arcTabs.length),
    [arcTabs.length],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (immersiveHidden) setOpen(false);
  }, [immersiveHidden]);

  function onArcKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!open) return;
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const ids = arcTabs.map((item) => item.id);
    if (!ids.length) return;
    const focused = document.activeElement?.id?.replace(/^tab-/, "") as
      | ShellTab
      | undefined;
    const index = Math.max(0, focused ? ids.indexOf(focused) : 0);
    const next =
      ids[(index + (event.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length]!;
    document.getElementById(`tab-${next}`)?.focus();
  }

  return (
    <div
      className={`mode-tabs${open ? " is-open" : ""}${immersiveHidden ? " is-immersive-hidden" : ""}`}
      id={rootId}
      data-immersive-hidden={immersiveHidden ? "true" : undefined}
      style={
        {
          ["--mode-tabs-dome-rise" as string]: `${CONVEX_DOME_RISE_PX}px`,
          ["--mode-tabs-bar-body" as string]: `${CONVEX_BAR_BODY_PX}px`,
          ["--mode-tabs-hub-size" as string]: `${CONVEX_HUB_SIZE_PX}px`,
        } as CSSProperties
      }
    >
      <div className="mode-tabs-chrome">
        <ConvexBottomBarSurface className="mode-tabs-convex" />

        {open ? (
          <button
            type="button"
            className="mode-tabs-scrim"
            aria-label={t("common.close")}
            onClick={() => setOpen(false)}
          />
        ) : null}

        <div className="mode-tabs-stage">
          <div
            className="mode-tabs-arc"
            role="tablist"
            aria-label={t("shell.nav")}
            aria-hidden={!open}
            onKeyDown={onArcKey}
          >
            {arcTabs.map((item, i) => {
              const label = t(item.labelKey);
              const angleDeg = arcAngles[i] ?? -90;
              const rad = (angleDeg * Math.PI) / 180;
              const x = Math.cos(rad) * RADIUS_PX;
              const y = Math.sin(rad) * RADIUS_PX;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`tab-${item.id}`}
                  className="mode-tabs-item"
                  style={
                    {
                      ["--radial-x" as string]: `${x}px`,
                      ["--radial-y" as string]: `${y}px`,
                    } as CSSProperties
                  }
                  aria-selected={false}
                  aria-controls={`panel-${item.id}`}
                  aria-label={label}
                  title={label}
                  tabIndex={open ? 0 : -1}
                  aria-hidden={!open}
                  onClick={() => {
                    setOpen(false);
                    onSelect(item.id);
                  }}
                >
                  <ModeTabIcon name={item.id} active={false} />
                  <span className="mode-tab-label">{label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="mode-tabs-hub"
            aria-expanded={open}
            aria-controls={rootId}
            aria-label={
              open ? t("common.close") : `${t("shell.nav")} · ${activeLabel}`
            }
            title={open ? t("common.close") : activeLabel}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <YvIcon name="close" className="mode-tabs-hub-close" />
            ) : (
              <ModeTabIcon name={active} active />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
