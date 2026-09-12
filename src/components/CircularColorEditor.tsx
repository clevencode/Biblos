import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  formatVerseColorHex,
  hexToHsv,
  hsvToHex,
  themeDefaultValue,
  verseColorHueLabel,
} from "../verseColors";
import type { ResolvedTheme } from "../theme";

const WHEEL_SIZE = 220;
const WHEEL_PAD = 12;
const RADIUS = WHEEL_SIZE / 2 - WHEEL_PAD;

export type CircularColorEditorProps = {
  open: boolean;
  initialHex: string;
  theme: ResolvedTheme;
  onClose: () => void;
  onConfirm: (hex: string) => void;
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function hsvToRgbBytes(h: number, s: number, v: number): [number, number, number] {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hh < 60) [rp, gp, bp] = [c, x, 0];
  else if (hh < 120) [rp, gp, bp] = [x, c, 0];
  else if (hh < 180) [rp, gp, bp] = [0, c, x];
  else if (hh < 240) [rp, gp, bp] = [0, x, c];
  else if (hh < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return [
    Math.round((rp + m) * 255),
    Math.round((gp + m) * 255),
    Math.round((bp + m) * 255),
  ];
}

function drawWheel(ctx: CanvasRenderingContext2D, size: number, value: number) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - WHEEL_PAD;
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = (y * size + x) * 4;
      if (dist > radius) {
        data[i + 3] = 0;
        continue;
      }
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const h = (angle + 360) % 360;
      const s = clamp01(dist / radius);
      const [r, g, b] = hsvToRgbBytes(h, s, value);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * Éditeur circulaire HSV (roue hue×saturation + curseur valeur).
 * Light → tons plutôt foncés ; dark → tons plutôt clairs (défaut),
 * curseur de luminosité pour toute la gamme.
 */
export function CircularColorEditor({
  open,
  initialHex,
  theme,
  onClose,
  onConfirm,
}: CircularColorEditorProps) {
  const titleId = useId();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragging = useRef(false);
  const defaultV = themeDefaultValue(theme);

  const [h, setH] = useState(210);
  const [s, setS] = useState(0.7);
  const [v, setV] = useState(defaultV);

  useEffect(() => {
    if (!open) return;
    const hsv = hexToHsv(initialHex);
    setH(hsv.h);
    setS(hsv.s);
    /* Si la couleur initiale est neutre / défaut, privilégier le V du thème. */
    const lumOk =
      theme === "dark" ? hsv.v >= 0.55 : hsv.v <= 0.7;
    setV(lumOk ? hsv.v : defaultV);
  }, [open, initialHex, theme, defaultV]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawWheel(ctx, WHEEL_SIZE, v);
  }, [open, v]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const hex = hsvToHex(h, s, v);
  const label = verseColorHueLabel(hex);

  const thumbStyle = (() => {
    const cx = WHEEL_SIZE / 2;
    const cy = WHEEL_SIZE / 2;
    const rad = (h * Math.PI) / 180;
    const r = s * RADIUS;
    return {
      left: cx + Math.cos(rad) * r,
      top: cy + Math.sin(rad) * r,
    };
  })();

  function pickAtClient(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = WHEEL_SIZE / rect.width;
    const scaleY = WHEEL_SIZE / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const cx = WHEEL_SIZE / 2;
    const cy = WHEEL_SIZE / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, RADIUS);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    setH((angle + 360) % 360);
    setS(clamped / RADIUS);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    pickAtClient(event.clientX, event.clientY);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    pickAtClient(event.clientX, event.clientY);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    dragging.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  }

  if (!open) return null;

  const toneHint =
    theme === "dark"
      ? "Tons clairs pour le thème sombre"
      : "Tons foncés pour le thème clair";

  return (
    <div className="circular-color-editor-root" role="presentation">
      <button
        type="button"
        className="circular-color-editor-backdrop"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        className="circular-color-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="circular-color-editor-head">
          <p id={titleId} className="circular-color-editor-title">
            Couleur
          </p>
          <button
            type="button"
            className="circular-color-editor-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div
          className="circular-color-wheel-wrap"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <canvas
            ref={canvasRef}
            className="circular-color-wheel"
            width={WHEEL_SIZE}
            height={WHEEL_SIZE}
            aria-label="Roue de couleur"
          />
          <span
            className="circular-color-thumb"
            style={{
              left: thumbStyle.left,
              top: thumbStyle.top,
              background: hex,
            }}
            aria-hidden
          />
        </div>

        <label className="circular-color-value">
          <span className="circular-color-value-label">
            Luminosité
            <span className="circular-color-value-hint">{toneHint}</span>
          </span>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.01}
            value={v}
            aria-valuetext={`${Math.round(v * 100)}%`}
            onChange={(event) => setV(Number(event.target.value))}
          />
        </label>

        <div className="circular-color-footer">
          <span
            className="circular-color-preview"
            style={{ background: hex }}
            aria-hidden
          />
          <p className="circular-color-meta">
            {label} · {formatVerseColorHex(hex)}
          </p>
          <button
            type="button"
            className="circular-color-apply"
            onClick={() => onConfirm(hex)}
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
