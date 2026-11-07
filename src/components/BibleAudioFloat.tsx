import { useEffect, useState } from "react";
import { YvIcon } from "./YvIcon";

export type BibleAudioFloatProps = {
  hasAudio: boolean;
  playing: boolean;
  busy: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
};

export function BibleAudioFloat({
  hasAudio,
  playing,
  busy,
  currentTime,
  duration,
  onTogglePlay,
  onSeek,
}: BibleAudioFloatProps) {
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const displayTime = seeking ? seekValue : currentTime;
  const progress =
    safeDuration > 0 ? Math.min(1, Math.max(0, displayTime / safeDuration)) : 0;
  const progressVisible = playing || seeking;

  useEffect(() => {
    if (seeking) return;
    setSeekValue(currentTime);
  }, [currentTime, seeking]);

  return (
    <div
      className={`bible-yv-audio-float${progressVisible ? " is-playing" : ""}`}
      role="group"
      aria-label="Lecture audio"
    >
      <button
        type="button"
        className={`bible-yv-dock-play${playing ? " is-playing" : ""}${busy ? " is-busy" : ""}`}
        disabled={!hasAudio || busy}
        onClick={onTogglePlay}
        aria-pressed={playing}
        aria-label={playing ? "Pause" : "Lecture"}
        aria-controls={progressVisible ? "bible-audio-progress" : undefined}
      >
        {playing ? (
          <YvIcon name="pause" filled className="bible-yv-dock-icon bible-yv-dock-icon--play" />
        ) : (
          <YvIcon name="play_arrow" filled className="bible-yv-dock-icon bible-yv-dock-icon--play" />
        )}
      </button>
      <div
        className="bible-yv-audio-float-track"
        aria-hidden={progressVisible ? undefined : true}
        inert={progressVisible ? undefined : true}
      >
        <input
          id="bible-audio-progress"
          type="range"
          className="bible-yv-audio-float-range"
          min={0}
          max={safeDuration || 1}
          step={1}
          value={Math.min(displayTime, safeDuration || 1)}
          disabled={!hasAudio || safeDuration <= 0 || !progressVisible}
          tabIndex={progressVisible ? 0 : -1}
          aria-label="Progression"
          aria-valuemin={0}
          aria-valuemax={safeDuration || 0}
          aria-valuenow={Math.floor(displayTime)}
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
      </div>
    </div>
  );
}
