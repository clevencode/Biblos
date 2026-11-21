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
  /** Conta / préférences — item da pilha (+ hub quando aberto). */
  accountOpen?: boolean;
  onToggleAccount?: () => void;
  /** Admin editorial (gated) — item da pilha. */
  adminOpen?: boolean;
  showAdmin?: boolean;
  onToggleAdmin?: () => void;
};

type RadialDest = ShellTab | "account" | "admin";

type RadialItem = {
  id: RadialDest;
  labelKey: "shell.plan" | "shell.bible" | "shell.profile" | "shell.admin";
  panelId: string;
};

const ACCOUNT_ITEM: RadialItem = {
  id: "account",
  labelKey: "shell.profile",
  panelId: "panel-account",
};

const ADMIN_ITEM: RadialItem = {
  id: "admin",
  labelKey: "shell.admin",
  panelId: "panel-admin",
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
  adminOpen = false,
  showAdmin = false,
  onToggleAdmin,
}: AppShellNavProps) {
  const { t } = useUiLocale();
  const rootId = useId();
  const menuId = `${rootId}-menu`;
  const hubRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const hubDest: RadialDest = adminOpen
    ? "admin"
    : accountOpen
      ? "account"
      : active;
  const hubLabel =
    hubDest === "admin"
      ? t("shell.admin")
      : hubDest === "account"
        ? t("shell.profile")
        : t(
            SHELL_TABS.find((item) => item.id === active)?.labelKey ??
              "shell.bible",
          );

  /**
   * Fluxo a partir do X (hub): Bible → Plan → Profile → Admin.
   * DOM = Bible…Admin; CSS column-reverse põe Bible junto ao X.
   */
  const stackItems = useMemo(() => {
    const tabs = SHELL_TABS.map(shellTabItem);
    const withAccount = onToggleAccount ? [...tabs, ACCOUNT_ITEM] : tabs;
    return showAdmin && onToggleAdmin
      ? [...withAccount, ADMIN_ITEM]
      : withAccount;
  }, [onToggleAccount, showAdmin, onToggleAdmin]);

  useEffect(() => {
    setShellRadialOpen(open);
  }, [open]);

  /** Back stack / Esc pode fechar via setShellRadialOpen(false). */
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
   * Single modal: toque na topbar do leitor cede a pilha
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

  function onStackKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!open) return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const ids = stackItems.map((item) => item.id);
    if (!ids.length) return;
    const focused = document.activeElement?.id?.replace(/^shell-dest-/, "") as
      | RadialDest
      | undefined;
    const index = Math.max(0, focused ? ids.indexOf(focused) : 0);
    /* column-reverse: índice 0 (Bible) junto ao X; ArrowUp sobe para Plan/Profile. */
    const delta = event.key === "ArrowUp" ? 1 : -1;
    const next = ids[(index + delta + ids.length) % ids.length]!;
    document.getElementById(`shell-dest-${next}`)?.focus();
  }

  function closeStack() {
    setOpen(false);
  }

  function selectDest(id: RadialDest) {
    setOpen(false);
    if (id === hubDest) return;
    if (id === "account") {
      onToggleAccount?.();
      return;
    }
    if (id === "admin") {
      onToggleAdmin?.();
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
    if (id === "admin") {
      return (
        <YvIcon
          name="settings"
          className={`mode-tab-icon${activeIcon ? " is-active" : ""}`}
        />
      );
    }
    return <ModeTabIcon name={id} active={activeIcon} />;
  }

  const overlayOpen = accountOpen || adminOpen;

  return (
    <>
      <RadialUiBackdrop
        isOpen={open}
        onClose={closeStack}
        closeLabel={t("common.close")}
      />

      <nav
        className={`mode-tabs is-hub-pill${open ? " is-open" : ""}${
          immersiveHidden ? " is-immersive-hidden" : ""
        }${overlayOpen ? " is-account-open" : ""}${
          adminOpen ? " is-admin-open" : ""
        }`}
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
        <span id="shell-label-admin" className="sr-only">
          {t("shell.admin")}
        </span>
        <div className="mode-tabs-chrome is-hub-only">
          <div className="mode-tabs-stage">
            <div
              id={menuId}
              className="mode-tabs-arc mode-tabs-stack"
              role="menu"
              aria-label={t("shell.nav")}
              aria-hidden={!open}
              onKeyDown={onStackKey}
            >
              {stackItems.map((item, i) => {
                const label = t(item.labelKey);
                const isCurrent = item.id === hubDest;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    id={`shell-dest-${item.id}`}
                    className={`mode-tabs-item mode-tabs-stack-item${
                      isCurrent ? " is-on" : ""
                    }`}
                    style={
                      {
                        ["--stack-i" as string]: String(i),
                      } as CSSProperties
                    }
                    aria-label={label}
                    aria-current={isCurrent ? "page" : undefined}
                    title={label}
                    tabIndex={open ? 0 : -1}
                    aria-hidden={!open}
                    onClick={() => selectDest(item.id)}
                  >
                    {renderDestIcon(item.id, isCurrent)}
                    <span className="mode-tab-label">{label}</span>
                  </button>
                );
              })}
            </div>

            <button
              ref={hubRef}
              type="button"
              className="mode-tabs-hub mode-tabs-hub-pill"
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
                <>
                  {renderDestIcon(hubDest, true)}
                  <span className="mode-tabs-hub-pill-label">{hubLabel}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
