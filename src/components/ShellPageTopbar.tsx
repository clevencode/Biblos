import type { ReactNode } from "react";

type ShellPageTopbarProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  titleId?: string;
  /** Slot à esquerda (ex. botão retour no workspace plan). */
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Topbar shell (Accueil / Plan) — mesmo chrome que `.bible-yv-top`.
 * Não é page header: faixa sticky, safe-area, superfície navbar.
 */
export function ShellPageTopbar({
  title,
  subtitle,
  titleId,
  leading,
  actions,
  className = "",
}: ShellPageTopbarProps) {
  return (
    <div
      className={`shell-topbar bible-yv-top is-shell${className ? ` ${className}` : ""}`.trim()}
      role="banner"
    >
      {leading != null ? (
        <div className="shell-topbar-leading">{leading}</div>
      ) : null}
      <div className="shell-topbar-copy">
        {subtitle != null && subtitle !== "" ? (
          <p className="shell-topbar-kicker muted type-caption">{subtitle}</p>
        ) : null}
        <h1 id={titleId} className="shell-topbar-title">
          {title}
        </h1>
      </div>
      {actions != null ? (
        <div className="shell-topbar-actions bible-yv-top-tools">{actions}</div>
      ) : null}
    </div>
  );
}
