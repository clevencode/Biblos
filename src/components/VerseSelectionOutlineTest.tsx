/**
 * Sandbox isolado — VerseSelection outline (7bec49c):
 * tap → underline + dim; sheet em baixo sem scrim; acções stub.
 * Não partilha markup/CSS com Options de produção.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { isVerseSelectionOutlineTest } from "../bible/verseSelectionOutlineTest";

export type VsoVerse = {
  number: number;
  text: string;
};

const FIXTURE_REF = "LÉVITIQUE 7";
const FIXTURE_VERSES: VsoVerse[] = [
  {
    number: 1,
    text: "Voici la loi du sacrifice de culpabilité ; c’est une chose très sainte.",
  },
  {
    number: 2,
    text: "C’est à l’endroit où l’on égorge l’holocauste que sera égorgée la victime du sacrifice de culpabilité…",
  },
  {
    number: 3,
    text: "On présentera toute sa graisse : la queue, la graisse qui couvre les entrailles,",
  },
  {
    number: 4,
    text: "les deux rognons et la graisse qui les entoure, la graisse sur les muscles des flancs…",
  },
  {
    number: 5,
    text: "Le sacrificateur fera fumer cela sur l’autel en sacrifice consumé par le feu devant l’Éternel…",
  },
  {
    number: 6,
    text: "Tout mâle parmi les sacrificateurs en mangera ; on le mangera dans un lieu saint…",
  },
];

function sortUnique(nums: number[]): number[] {
  return [...new Set(nums)].sort((a, b) => a - b);
}

function formatSelRef(base: string, sel: number[]): string {
  if (!sel.length) return base;
  if (sel.length === 1) return `${base}.${sel[0]}`;
  const lo = sel[0]!;
  const hi = sel[sel.length - 1]!;
  const contiguous = sel.every((n, i) => n === lo + i);
  if (contiguous) return `${base}.${lo}–${hi}`;
  return `${base}.${sel.join(", ")}`;
}

type Props = {
  /** Override fixture (ex.: slice do capítulo real). */
  verses?: VsoVerse[];
  refLabel?: string;
};

export function VerseSelectionOutlineTest({
  verses = FIXTURE_VERSES,
  refLabel = FIXTURE_REF,
}: Props) {
  const enabled = isVerseSelectionOutlineTest();
  const [selection, setSelection] = useState<number[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selectedSet = useMemo(() => new Set(selection), [selection]);
  const sheetOpen = selection.length > 0;

  const toggle = useCallback((n: number) => {
    setMsg(null);
    setSelection((prev) => {
      if (prev.includes(n)) {
        const next = prev.filter((x) => x !== n);
        return next;
      }
      return sortUnique([...prev, n]);
    });
  }, []);

  const clear = useCallback(() => {
    setSelection([]);
    setMsg(null);
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const sheet = sheetRef.current;
    if (!root) return;
    if (!sheetOpen || !sheet) {
      root.style.removeProperty("--vso-sheet-h");
      return;
    }
    const apply = () => {
      root.style.setProperty("--vso-sheet-h", `${sheet.offsetHeight}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(sheet);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--vso-sheet-h");
    };
  }, [sheetOpen, selection.length, msg]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, clear]);

  if (!enabled || typeof document === "undefined") return null;

  const title = formatSelRef(refLabel, selection);

  return createPortal(
    <div
      ref={rootRef}
      className="vso-root"
      data-vso="outline"
      role="region"
      aria-label="VerseSelection outline test"
    >
      <header className="vso-banner">
        <span className="vso-banner-label">TEST · VerseSelection outline</span>
        <button type="button" className="vso-banner-close" onClick={clear} aria-label="Effacer">
          {sheetOpen ? "Effacer" : "·"}
        </button>
      </header>

      <div className="vso-passage">
        <h1 className="vso-book">{refLabel}</h1>
        <div
          className={`vso-verses${sheetOpen ? " is-dimming" : ""}`}
          role="list"
        >
          {verses.map((v) => {
            const on = selectedSet.has(v.number);
            return (
              <button
                key={v.number}
                type="button"
                role="listitem"
                className={`vso-verse${on ? " is-selected" : ""}`}
                aria-pressed={on}
                onClick={() => toggle(v.number)}
              >
                <span className="vso-verse-num" aria-hidden>
                  {v.number}
                </span>
                <span className="vso-verse-text">{v.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      {sheetOpen ? (
        <div
          ref={sheetRef}
          className="vso-sheet"
          role="dialog"
          aria-modal="false"
          aria-label="Actions verset"
          style={
            {
              ["--vso-tint" as string]: "var(--accent, #5b7cfa)",
            } as CSSProperties
          }
        >
          <div className="vso-sheet-head">
            <p className="vso-sheet-ref">{title}</p>
            <p className="vso-sheet-hint">
              {selection.length > 1
                ? `${selection.length} versets · tape pour ajouter ou retirer`
                : "Tape d’autres versets pour compléter la sélection"}
            </p>
          </div>
          {msg ? <p className="vso-sheet-msg">{msg}</p> : null}
          <div className="vso-sheet-actions" role="group" aria-label="Actions">
            <button
              type="button"
              className="vso-btn vso-btn-swatch"
              aria-label="Couleur (stub)"
              onClick={() => setMsg("Couleur · stub")}
            >
              +
            </button>
            <button
              type="button"
              className="vso-btn vso-btn-primary"
              onClick={() => setMsg("Marquer · stub")}
            >
              Marquer
            </button>
            <button
              type="button"
              className="vso-btn vso-btn-secondary"
              onClick={() => setMsg("Partager · stub")}
            >
              Partager
            </button>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
