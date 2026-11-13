/**
 * Menu radial flutuante — navegação rápida no leitor.
 * Centro = abreviação da versão ativa; arco = ações.
 */

import { useEffect, useId, useState, type CSSProperties } from "react";
import { YvIcon } from "./YvIcon";
import type { BiblosIconName } from "../icons/registry";
import {
  bibleVersionDef,
  type BibleTextVersionId,
} from "../bible/bibleVersions";
import { useUiLocale } from "../i18n/UiLocaleContext";
import type { UiCopyKey } from "../i18n/uiCopy";

export type RadialNavbarAction =
  | "search_books"
  | "switch_version"
  | "history"
  | "study";

export type RadialNavbarProps = {
  versionId: BibleTextVersionId;
  floating?: boolean;
  onAction: (action: RadialNavbarAction) => void;
};

type ArcItem = {
  action: RadialNavbarAction;
  labelKey: UiCopyKey;
  icon: BiblosIconName;
  angleDeg: number;
};

const ARC: ArcItem[] = [
  { action: "search_books", labelKey: "radial.books", icon: "menu_book", angleDeg: -120 },
  { action: "switch_version", labelKey: "radial.version", icon: "sync", angleDeg: -75 },
  { action: "history", labelKey: "radial.history", icon: "history", angleDeg: -30 },
  { action: "study", labelKey: "radial.study", icon: "format_list_numbered", angleDeg: 15 },
];

const RADIUS_PX = 78;

export function RadialNavbar({
  versionId,
  floating = true,
  onAction,
}: RadialNavbarProps) {
  const { t } = useUiLocale();
  const rootId = useId();
  const [open, setOpen] = useState(false);
  const abbr = bibleVersionDef(versionId).abbreviation;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      className={`bible-radial-nav${floating ? " is-floating" : ""}${open ? " is-open" : ""}`}
      id={rootId}
    >
      {open ? (
        <button
          type="button"
          className="bible-radial-nav-scrim"
          aria-label={t("radial.close")}
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="bible-radial-nav-arc" aria-hidden={!open}>
        {ARC.map((item) => {
          const rad = (item.angleDeg * Math.PI) / 180;
          const x = Math.cos(rad) * RADIUS_PX;
          const y = Math.sin(rad) * RADIUS_PX;
          const label = t(item.labelKey);
          return (
            <button
              key={item.action}
              type="button"
              className="bible-radial-nav-item"
              style={
                {
                  ["--radial-x" as string]: `${x}px`,
                  ["--radial-y" as string]: `${y}px`,
                } as CSSProperties
              }
              tabIndex={open ? 0 : -1}
              aria-hidden={!open}
              aria-label={label}
              title={label}
              onClick={() => {
                setOpen(false);
                onAction(item.action);
              }}
            >
              <YvIcon name={item.icon} className="bible-radial-nav-item-icon" />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="bible-radial-nav-hub"
        aria-expanded={open}
        aria-controls={rootId}
        aria-label={`${t("radial.menu")} · ${abbr}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="bible-radial-nav-hub-abbr">{abbr}</span>
      </button>
    </div>
  );
}
