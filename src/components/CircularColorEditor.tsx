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
 * Éditeur circulaire HSV (teinte × saturation).
 * La luminosité suit automatiquement le thème (tons foncés en light, clairs en dark).
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
  const value = themeDefaultValue(theme);

  const [h, setH] = useState(210);
  const [s, setS] = useState(0.7);

  useEffect(() => {
    if (!open) return;
    const hsv = hexToHsv(initialHex);
    setH(hsv.h);
    setS(clamp01(hsv.s));
  }, [open, initialHex]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawWheel(ctx, WHEEL_SIZE, value);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const hex = hsvToHex(h, s, value);
  const label = verseColorHueLabel(hex);

  const thumbStyle = (() => {
    const cx = WHEEL_SIZE / 2;
    const cy = WHEEL_SIZE / 2;
    const rad = (h * Math.PI) / 180;
    /* Garde le centre du point dans le disque peint (échelle CSS via %). */
    const maxR = Math.max(0, RADIUS - 1);
    const r = Math.min(clamp01(s), 1) * maxR;
    const x = cx + Math.cos(rad) * r;
    const y = cy + Math.sin(rad) * r;
    return {
      left: `${(x / WHEEL_SIZE) * 100}%`,
      top: `${(y / WHEEL_SIZE) * 100}%`,
    };
  })();

  function pickAtClient(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
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
      ? "Tons clairs · adaptés au thème sombre"
      : "Tons foncés · adaptés au thème clair";

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

        <p className="circular-color-tone-hint">{toneHint}</p>

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
