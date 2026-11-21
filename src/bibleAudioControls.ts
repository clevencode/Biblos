/**
 * Controles de notificação legados (Capgo / MusicControls) — desactivados no Android.
 * O playback nativo (@mediagrid) gere MediaSession + FGS mediaPlayback.
 * Mantido como no-op para não partir imports do BibleReaderView no web.
 */
import { Capacitor } from "@capacitor/core";
import { ensureNativeAudioNotificationPermission } from "./bibleNativeAudio";

export type BibleAudioControlHandlers = {
  onPlay: () => void;
  onPause: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  onSeekTo?: (seconds: number) => void;
  onDestroy?: () => void;
};

type ControlsPayload = {
  track: string;
  artist: string;
  album?: string;
  isPlaying: boolean;
  duration: number;
  elapsed: number;
};

function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

/** No-op no Android (mediagrid). Web: nada a fazer além de permissão se algum dia precisar. */
export async function bindBibleAudioControls(
  _handlers: BibleAudioControlHandlers,
): Promise<() => void> {
  if (isAndroidNative()) {
    await ensureNativeAudioNotificationPermission();
  }
  return () => undefined;
}

/** No-op — metadata/notificação vêm do AudioPlayer nativo. */
export async function syncBibleAudioControls(_payload: ControlsPayload): Promise<void> {
  /* intentionally empty */
}

export async function clearBibleAudioControls(): Promise<void> {
  /* intentionally empty — destroyNativeBibleAudio trata o FGS */
}
