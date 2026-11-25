import type { ReactNode } from "react";

export type SettingsGroupProps = {
  id?: string;
  /** Omitir título visual (ex. aba Bibliothèque — evita repetir o nome). */
  title?: string;
  children: ReactNode;
};

export function SettingsGroup({ id, title, children }: SettingsGroupProps) {
  return (
    <section
      id={id}
      className={`settings-group${title ? "" : " is-untitled"}`}
      aria-label={title || undefined}
    >
      {title ? <h2 className="settings-group-title">{title}</h2> : null}
      <div className="settings-group-body">{children}</div>
    </section>
  );
}
