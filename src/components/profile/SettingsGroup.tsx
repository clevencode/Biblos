import type { ReactNode } from "react";

export type SettingsGroupProps = {
  id?: string;
  title: string;
  children: ReactNode;
};

export function SettingsGroup({ id, title, children }: SettingsGroupProps) {
  return (
    <section id={id} className="settings-group" aria-label={title}>
      <h2 className="settings-group-title">{title}</h2>
      <div className="settings-group-body">{children}</div>
    </section>
  );
}
