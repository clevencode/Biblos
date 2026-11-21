import type { ReactNode } from "react";
import { YvIcon } from "../YvIcon";

export type SettingsRowProps = {
  icon?: string;
  iconFilled?: boolean;
  label: string;
  value?: string;
  disabled?: boolean;
  danger?: boolean;
  chevron?: boolean;
  ready?: boolean;
  busy?: boolean;
  trailing?: ReactNode;
  onClick?: () => void;
  "aria-label"?: string;
};

export function SettingsRow({
  icon,
  iconFilled,
  label,
  value,
  disabled,
  danger,
  chevron,
  ready,
  busy,
  trailing,
  onClick,
  "aria-label": ariaLabel,
}: SettingsRowProps) {
  const className = [
    "settings-row",
    danger ? "is-danger" : "",
    ready ? "is-ready" : "",
    busy ? "is-busy" : "",
    onClick ? "" : "is-static",
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      {icon ? (
        <YvIcon
          name={icon}
          filled={iconFilled}
          className="settings-row-icon"
          opsz={20}
        />
      ) : null}
      <span className="settings-row-body">
        <span className="settings-row-label">{label}</span>
        {value ? (
          <span className="settings-row-value muted">{value}</span>
        ) : null}
      </span>
      {trailing}
      {chevron ? (
        <YvIcon name="chevron_right" className="settings-row-chevron" opsz={20} />
      ) : null}
    </>
  );

  if (!onClick) {
    return (
      <div className={className} role="status">
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {body}
    </button>
  );
}
