import { useEffect, useId, useMemo, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "@heroicons/react/24/outline";
import type { BibleAudioEpisode } from "../youversion/audio";

export type BibleAudioPlayerProps = {
  open: boolean;
  onClose: () => void;
  podcastTitle?: string;
  booksByUsfm: Record<string, BibleAudioEpisode>;
  /** Ordem canónica (USFM); episódios sem entrada no catálogo são omitidos. */
  bookOrder?: readonly string[];
  activeUsfm: string | null;
  playing: boolean;
  busy: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onPlayUsfm: (usfm: string) => void;
  onSeek: (seconds: number) => void;
  onSkip: (deltaSeconds: number) => void;
};

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function BibleAudioPlayer({
  open,
  onClose,
  podcastTitle = "Bible | Podcast.s21",
  booksByUsfm,
  bookOrder,
  activeUsfm,
  playing,
  busy,
  currentTime,
  duration,
  onTogglePlay,
  onPlayUsfm,
  onSeek,
  onSkip,
}: BibleAudioPlayerProps) {
  const titleId = useId();
  const seekRef = useRef<HTMLInputElement | null>(null);
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const episodes = useMemo(() => {
    const order =
      bookOrder?.length
        ? bookOrder
        : Object.keys(booksByUsfm).sort((a, b) => a.localeCompare(b));
    const list: BibleAudioEpisode[] = [];
    const seen = new Set<string>();
    for (const usfm of order) {
      const key = usfm.toUpperCase();
      const ep = booksByUsfm[key];
      if (!ep?.audioUrl || seen.has(key)) continue;
      seen.add(key);
      list.push(ep);
    }
    for (const [key, ep] of Object.entries(booksByUsfm)) {
      if (!ep?.audioUrl || seen.has(key.toUpperCase())) continue;
      seen.add(key.toUpperCase());
      list.push(ep);
    }
    return list;
  }, [booksByUsfm, bookOrder]);

  const active = activeUsfm
    ? booksByUsfm[activeUsfm.toUpperCase()] ?? null
    : null;

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const displayTime = seeking ? seekValue : currentTime;
  const progress =
    safeDuration > 0 ? Math.min(1, Math.max(0, displayTime / safeDuration)) : 0;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || seeking) return;
    setSeekValue(currentTime);
  }, [open, currentTime, seeking]);

  if (!open) return null;

  return (
    <div
      className="bible-audio-player"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <header className="bible-audio-player-head">
        <button
          type="button"
          className="bible-audio-player-close"
          onClick={onClose}
          aria-label="Fermer le lecteur"
        >
          ↓
        </button>
        <p id={titleId} className="bible-audio-player-podcast">
          {podcastTitle}
        </p>
        <span className="bible-audio-player-head-spacer" aria-hidden />
      </header>

      <div className="bible-audio-player-hero">
        <p className="bible-audio-player-eyebrow">Livre</p>
        <h2 className="bible-audio-player-title">
          {active?.title ?? "Choisir un livre"}
        </h2>
        {active?.duration ? (
          <p className="bible-audio-player-duration-meta">{active.duration}</p>
        ) : null}
      </div>

      <div className="bible-audio-player-transport">
        <div className="bible-audio-player-seek">
          <input
            ref={seekRef}
            type="range"
            className="bible-audio-player-range"
            min={0}
            max={safeDuration || 1}
            step={1}
            value={Math.min(displayTime, safeDuration || 1)}
            disabled={!active || safeDuration <= 0}
            aria-label="Position"
            style={{ ["--seek-progress" as string]: String(progress) }}
            onPointerDown={() => setSeeking(true)}
            onPointerUp={(event) => {
              const value = Number((event.target as HTMLInputElement).value);
              setSeeking(false);
              onSeek(value);
            }}
            onChange={(event) => {
              setSeekValue(Number(event.target.value));
            }}
          />
          <div className="bible-audio-player-times">
            <span>{formatClock(displayTime)}</span>
            <span>{formatClock(safeDuration)}</span>
          </div>
        </div>

        <div className="bible-audio-player-controls">
          <button
            type="button"
            className="bible-audio-player-skip"
            disabled={!active}
            onClick={() => onSkip(-15)}
            aria-label="Reculer de 15 secondes"
          >
            −15
          </button>
          <button
            type="button"
            className={`bible-audio-player-play${playing ? " is-playing" : ""}${busy ? " is-busy" : ""}`}
            disabled={!active || busy}
            onClick={onTogglePlay}
            aria-pressed={playing}
            aria-label={playing ? "Pause" : "Lecture"}
          >
            {playing ? (
              <PauseIcon className="bible-audio-player-icon" aria-hidden />
            ) : (
              <PlayIcon className="bible-audio-player-icon" aria-hidden />
            )}
          </button>
          <button
            type="button"
            className="bible-audio-player-skip"
            disabled={!active}
            onClick={() => onSkip(30)}
            aria-label="Avancer de 30 secondes"
          >
            +30
          </button>
        </div>
      </div>

      <div className="bible-audio-player-list-wrap">
        <p className="bible-audio-player-list-label">Livres</p>
        <ul className="bible-audio-player-list" role="listbox" aria-label="Catalogue audio">
          {episodes.map((ep) => {
            const on = activeUsfm?.toUpperCase() === ep.usfm.toUpperCase();
            return (
              <li key={ep.usfm}>
                <button
                  type="button"
                  className={`bible-audio-player-item${on ? " is-on" : ""}`}
                  role="option"
                  aria-selected={on}
                  onClick={() => onPlayUsfm(ep.usfm)}
                >
                  <span className="bible-audio-player-item-title">{ep.title}</span>
                  {ep.duration ? (
                    <span className="bible-audio-player-item-meta">{ep.duration}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
          {!episodes.length ? (
            <li className="bible-audio-player-empty">Aucun épisode disponible.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
