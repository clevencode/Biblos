import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { ModeTabIcon } from "./ModeTabIcon";
import { SHELL_TABS, type ShellTab } from "../shellNav";

type AppShellNavProps = {
  active: ShellTab;
  onSelect: (tab: ShellTab) => void;
  immersiveHidden?: boolean;
};

export function AppShellNav({ active, onSelect, immersiveHidden = false }: AppShellNavProps) {
  function onTabKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const ids = SHELL_TABS.map((item) => item.id);
    const index = Math.max(0, ids.indexOf(active));
    const next =
      ids[(index + (event.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length];
    onSelect(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  return (
    <div
      className={`mode-tabs${immersiveHidden ? " is-immersive-hidden" : ""}`}
      data-immersive-hidden={immersiveHidden ? "true" : undefined}
    >
      <div
        className="mode-tabs-nav"
        role="tablist"
        aria-label="Navigation"
        onKeyDown={onTabKey}
      >
        {SHELL_TABS.map((item) => {
          const on = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              className={on ? "is-on" : ""}
              aria-selected={on}
              aria-controls={`panel-${item.id}`}
              title={item.label}
              tabIndex={on ? 0 : -1}
              onClick={() => onSelect(item.id)}
            >
              <ModeTabIcon name={item.id} active={on} />
              <span className="mode-tab-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
