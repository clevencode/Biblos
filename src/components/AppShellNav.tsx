import {
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ModeTabIcon } from "./ModeTabIcon";
import { SHELL_TABS, type ShellTab } from "../shellNav";
import { clearShellRadialOpen } from "../shellRadial";
import { useUiLocale } from "../i18n/UiLocaleContext";

type AppShellNavProps = {
  active: ShellTab;
  onSelect: (tab: ShellTab) => void;
  immersiveHidden?: boolean;
};

/**
 * Navbar: pill horizontal flutuante (Home · Plan · Bible). Sem radial.
 */
export function AppShellNav({
  active,
  onSelect,
  immersiveHidden = false,
}: AppShellNavProps) {
  const { t } = useUiLocale();

  /* Garante que `data-radial-open` legado não fica preso após hot reload. */
  useEffect(() => {
    clearShellRadialOpen();
  }, []);

  function onTablistKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const ids = SHELL_TABS.map((item) => item.id);
    const index = Math.max(0, ids.indexOf(active));
    const next =
      ids[
        (index + (event.key === "ArrowRight" ? 1 : -1) + ids.length) %
          ids.length
      ]!;
    onSelect(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  return (
    <nav
      className={`mode-tabs${immersiveHidden ? " is-immersive-hidden" : ""}`}
      data-immersive-hidden={immersiveHidden ? "true" : undefined}
      aria-hidden={immersiveHidden || undefined}
    >
      <div
        className="mode-tabs-pill"
        role="tablist"
        aria-label={t("shell.nav")}
        onKeyDown={onTablistKey}
      >
        {SHELL_TABS.map((item) => {
          const label = t(item.labelKey);
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              className={`mode-tabs-item${selected ? " is-on" : ""}`}
              aria-selected={selected}
              aria-controls={`panel-${item.id}`}
              tabIndex={immersiveHidden ? -1 : selected ? 0 : -1}
              disabled={immersiveHidden}
              title={label}
              onClick={() => onSelect(item.id)}
            >
              <ModeTabIcon name={item.id} active={selected} />
              <span className="mode-tab-label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
