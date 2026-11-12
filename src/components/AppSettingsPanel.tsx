import { YvIcon } from "./YvIcon";
import { resolveTheme, themePrefLabel, type ThemePref } from "../theme";

type AppSettingsPanelProps = {
  active: boolean;
  themePref: ThemePref;
  onCycleTheme: () => void;
};

export function AppSettingsPanel({ active, themePref, onCycleTheme }: AppSettingsPanelProps) {
  const themeResolved = resolveTheme(themePref);
  return (
    <div
      id="panel-settings"
      role="tabpanel"
      aria-labelledby="tab-settings"
      hidden={!active}
      className="pane-body bible-shell-panel bible-settings-panel"
    >
      <header className="bible-shell-panel-head">
        <h2 className="bible-shell-panel-title">Réglages</h2>
      </header>
      <ul className="bible-settings-list">
        <li>
          <button type="button" className="bible-settings-row" onClick={onCycleTheme}>
            <YvIcon
              name={themeResolved === "light" ? "light_mode" : "dark_mode"}
              className="bible-settings-row-icon"
            />
            <span className="bible-settings-row-body">
              <span className="bible-settings-row-label">Apparence</span>
              <span className="bible-settings-row-value">{themePrefLabel(themePref)}</span>
            </span>
            <YvIcon name="chevron_right" className="bible-settings-row-chevron" />
          </button>
        </li>
      </ul>
      <p className="bible-settings-foot muted">
        Biblos — Segond 21, Bible haïtienne 1998, références croisées (TSKE / Strong).
      </p>
    </div>
  );
}
