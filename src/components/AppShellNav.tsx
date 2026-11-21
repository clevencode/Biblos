import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { CONVEX_HUB_SIZE_PX } from "../ui/convexNavMetrics";
import { ModeTabIcon } from "./ModeTabIcon";
import { RadialUiBackdrop } from "./RadialUiBackdrop";
import { YvIcon } from "./YvIcon";
import { SHELL_TABS, type ShellTab } from "../shellNav";
import {
  clearShellRadialOpen,
  setShellRadialOpen,
  subscribeShellRadial,
} from "../shellRadial";
import { useUiLocale } from "../i18n/UiLocaleContext";

type AppShellNavProps = {
  active: ShellTab;
  onSelect: (tab: ShellTab) => void;
  immersiveHidden?: boolean;
  /** Conta / préférences — item do arco radial (+ hub quando aberto). */
  accountOpen?: boolean;
  onToggleAccount?: () => void;
};

type RadialDest = ShellTab | "account";

type RadialItem = {
  id: RadialDest;
  labelKey: "shell.plan" | "shell.bible" | "shell.profile";
  panelId: string;
};

/**
 * Leque superior simétrico: centro em -90° (topo CSS), span 128°,
 * passo constante → espelho L/R com folga entre pills.
 */
function arcAnglesDeg(
  count: number,
  spanDeg = 128,
  centerDeg = -90,
): number[] {
  if (count <= 1) return [centerDeg];
  const start = centerDeg - spanDeg / 2;
  const step = spanDeg / (count - 1);
  return Array.from({ length: count }, (_, i) => start + i * step);
}

const RADIUS_PX = 94;

const ACCOUNT_ITEM: RadialItem = {
  id: "account",
  labelKey: "shell.profile",
  panelId: "panel-account",
};

function shellTabItem(
  tab: (typeof SHELL_TABS)[number],
): RadialItem {
  return {
    id: tab.id,
    labelKey: tab.labelKey,
    panelId: `panel-${tab.id}`,
  };
}

export function AppShellNav({
  active,
  onSelect,
  immersiveHidden = false,
  accountOpen = false,
  onToggleAccount,
}: AppShellNavProps) {
  const { t } = useUiLocale();
  const rootId = useId();
  const menuId = `${rootId}-menu`;
  const hubRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const hubDest: RadialDest = accountOpen ? "account" : active;
  const hubLabel =
    hubDest === "account"
      ? t("shell.profile")
      : t(
          SHELL_TABS.find((item) => item.id === active)?.labelKey ??
            "shell.bible",
        );
  /** Destinos no arco = tabs shell + conta, sem duplicar o hub. */
  const arcItems = useMemo(() => {
    const tabs = SHELL_TABS.map(shellTabItem);
    const all: RadialItem[] = onToggleAccount
      ? [...tabs, ACCOUNT_ITEM]
      : tabs;
    return all.filter((item) => item.id !== hubDest);
  }, [hubDest, onToggleAccount]);

  const arcAngles = useMemo(
    () => arcAnglesDeg(arcItems.length),
    [arcItems.length],
  );

  useEffect(() => {
    setShellRadialOpen(open);
  }, [open]);

  /** Back stack / Esc pode fechar o radial via setShellRadialOpen(false). */
  useEffect(() => {
    return subscribeShellRadial((radialOpen) => {
      if (!radialOpen) setOpen(false);
    });
  }, []);

  useEffect(() => {
    return () => clearShellRadialOpen();
  }, []);

  useEffect(() => {
    if (!open) return;
    hubRef.current?.focus({ preventScroll: true });
  }, [open]);

  /**
   * Single modal: toque na topbar do leitor cede o radial
   * (não preventDefault — a ação da topbar segue).
   */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".bible-yv-top")) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  function onArcKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!open) return;
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const ids = arcItems.map((item) => item.id);
    if (!ids.length) return;
    const focused = document.activeElement?.id?.replace(/^shell-dest-/, "") as
      | RadialDest
      | undefined;
    const index = Math.max(0, focused ? ids.indexOf(focused) : 0);
    const next =
      ids[
        (index + (event.key === "ArrowRight" ? 1 : -1) + ids.length) %
          ids.length
      ]!;
    document.getElementById(`shell-dest-${next}`)?.focus();
  }

  function closeRadial() {
    setOpen(false);
  }

  function selectDest(id: RadialDest) {
    setOpen(false);
    if (id === "account") {
      if (!accountOpen) onToggleAccount?.();
      return;
    }
    onSelect(id);
  }

  function renderDestIcon(id: RadialDest, activeIcon: boolean) {
    if (id === "account") {
      return (
        <YvIcon
          name="person"
          className={`mode-tab-icon${activeIcon ? " is-active" : ""}`}
        />
      );
    }
    return <ModeTabIcon name={id} active={activeIcon} />;
  }

  return (
    <>
      {/* Irmão de .mode-tabs (não filho): fixed cobre o viewport;
          z-index abaixo da barra/arco. */}
      <RadialUiBackdrop
        isOpen={open}
        onClose={closeRadial}
        closeLabel={t("common.close")}
      />

      <nav
        className={`mode-tabs${open ? " is-open" : ""}${
          immersiveHidden ? " is-immersive-hidden" : ""
        }${accountOpen ? " is-account-open" : ""}`}
        id={rootId}
        aria-label={t("shell.nav")}
        data-immersive-hidden={immersiveHidden ? "true" : undefined}
        style={
          {
            ["--mode-tabs-hub-size" as string]: `${CONVEX_HUB_SIZE_PX}px`,
          } as CSSProperties
        }
      >
        <span id="shell-label-plan" className="sr-only">
          {t("shell.plan")}
        </span>
        <span id="shell-label-bible" className="sr-only">
          {t("shell.bible")}
        </span>
        <span id="shell-label-account" className="sr-only">
          {t("shell.profile")}
        </span>
        <div className="mode-tabs-chrome is-hub-only">
          <div className="mode-tabs-stage">
            <div
              id={menuId}
              className="mode-tabs-arc"
              role="menu"
              aria-label={t("shell.nav")}
              aria-hidden={!open}
              onKeyDown={onArcKey}
            >
              {arcItems.map((item, i) => {
                const label = t(item.labelKey);
                const angleDeg = arcAngles[i] ?? -90;
                const rad = (angleDeg * Math.PI) / 180;
                const x = Math.cos(rad) * RADIUS_PX;
                const y = Math.sin(rad) * RADIUS_PX;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    id={`shell-dest-${item.id}`}
                    className="mode-tabs-item"
                    style={
                      {
                        ["--radial-x" as string]: `${x}px`,
                        ["--radial-y" as string]: `${y}px`,
                        ["--roulette-i" as string]: String(i),
                      } as CSSProperties
                    }
                    aria-label={label}
                    title={label}
                    tabIndex={open ? 0 : -1}
                    aria-hidden={!open}
                    onClick={() => selectDest(item.id)}
                  >
                    {renderDestIcon(item.id, false)}
                    <span className="mode-tab-label">{label}</span>
                  </button>
                );
              })}
            </div>

            <button
              ref={hubRef}
              type="button"
              className="mode-tabs-hub"
              aria-expanded={open}
              aria-controls={menuId}
              aria-haspopup="menu"
              aria-current={!open ? "page" : undefined}
              aria-label={
                open ? t("common.close") : `${t("shell.nav")} · ${hubLabel}`
              }
              title={open ? t("common.close") : hubLabel}
              onClick={() => {
                setOpen((v) => !v);
              }}
            >
              {open ? (
                <YvIcon name="close" className="mode-tabs-hub-close" />
              ) : (
                renderDestIcon(hubDest, true)
              )}
            </button>

            <span
              className="mode-tabs-hub-caption"
              aria-hidden={open || immersiveHidden}
            >
              {hubLabel}
            </span>
          </div>
        </div>
      </nav>
    </>
  );
}
