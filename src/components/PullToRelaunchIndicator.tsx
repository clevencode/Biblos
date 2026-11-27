import type { CSSProperties } from "react";
import {
  PULL_RELAUNCH_THRESHOLD,
  usePullToRelaunch,
} from "../hooks/usePullToRelaunch";
import { useUiLocale } from "../i18n/UiLocaleContext";
import { YvIcon } from "./YvIcon";

/** Indicador do gesto « puxar para relançar » (montar uma vez no shell). */
export function PullToRelaunchIndicator() {
  const { t } = useUiLocale();
  const { pull, phase } = usePullToRelaunch();
  if (phase === "idle") return null;

  const progress = Math.min(1, pull / PULL_RELAUNCH_THRESHOLD);
  const label =
    phase === "relaunching"
      ? t("pull.relaunching")
      : phase === "armed"
        ? t("pull.release")
        : t("pull.idle");

  return (
    <div
      className={`pull-relaunch is-${phase}`}
      style={
        {
          "--pull-y": `${pull}px`,
          "--pull-progress": progress,
        } as CSSProperties
      }
      role="status"
      aria-live="polite"
    >
      <span className="pull-relaunch-circle" aria-hidden>
        <YvIcon name="sync" className="pull-relaunch-icon" />
      </span>
      <span className="pull-relaunch-label">{label}</span>
    </div>
  );
}
