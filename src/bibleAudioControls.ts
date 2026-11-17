/**
 * Contrôles média natifs (notification / écran verrouillé) — audio persistant Android.
 */
import { Capacitor } from "@capacitor/core";

export type BibleAudioControlHandlers = {
  onPlay: () => void;
  onPause: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
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

let listening = false;
let created = false;
let lastKey = "";
let notifPermissionAsked = false;

function nativeReady(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

async function getControls() {
  const mod = await import("capacitor-music-controls-plugin");
  return mod.CapacitorMusicControls;
}

/** Android 13+: pede POST_NOTIFICATIONS via Notification API do WebView. */
async function ensureNotificationPermission(): Promise<void> {
  if (!nativeReady() || notifPermissionAsked) return;
  notifPermissionAsked = true;
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch {
    /* WebView sem Notification API */
  }
}

function handleMessage(message: string, handlers: BibleAudioControlHandlers) {
  switch (message) {
    case "music-controls-play":
      handlers.onPlay();
      break;
    case "music-controls-pause":
      handlers.onPause();
      break;
    case "music-controls-toggle-play-pause": {
      handlers.onPlay();
      break;
    }
    case "music-controls-skip-forward":
    case "music-controls-next":
      handlers.onSkipForward();
      break;
    case "music-controls-skip-backward":
    case "music-controls-previous":
      handlers.onSkipBackward();
      break;
    case "music-controls-destroy":
    case "music-controls-headset-unplugged":
      handlers.onDestroy?.();
      break;
    default:
      break;
  }
}

/** Branche les écouteurs notification (une fois). */
export async function bindBibleAudioControls(
  handlers: BibleAudioControlHandlers,
): Promise<() => void> {
  if (!nativeReady()) return () => undefined;
  if (listening) return () => undefined;
  listening = true;

  await ensureNotificationPermission();
  const MusicControls = await getControls();

  const iosHandle = await MusicControls.addListener("controlsNotification", (info) => {
    handleMessage(String(info?.message || ""), handlers);
  });

  const onAndroidEvent = (event: Event) => {
    const detail = event as Event & { message?: string; position?: number };
    handleMessage(String(detail.message || ""), handlers);
  };
  document.addEventListener("controlsNotification", onAndroidEvent);

  return () => {
    listening = false;
    void iosHandle.remove();
    document.removeEventListener("controlsNotification", onAndroidEvent);
  };
}

/** Affiche / met à jour la notification média (foreground service). */
export async function syncBibleAudioControls(payload: ControlsPayload): Promise<void> {
  if (!nativeReady()) return;
  try {
    await ensureNotificationPermission();
    const MusicControls = await getControls();
    const key = `${payload.track}|${payload.artist}|${Math.round(payload.duration)}`;
    if (!created || key !== lastKey) {
      await MusicControls.create({
        track: payload.track,
        artist: payload.artist,
        album: payload.album || "Segond 21",
        isPlaying: payload.isPlaying,
        dismissable: true,
        hasPrev: false,
        hasNext: false,
        hasClose: true,
        hasSkipForward: true,
        hasSkipBackward: true,
        skipForwardInterval: 30,
        skipBackwardInterval: 15,
        hasScrubbing: false,
        duration: Math.max(0, Math.floor(payload.duration || 0)),
        elapsed: Math.max(0, Math.floor(payload.elapsed || 0)),
        ticker: `Biblos · ${payload.track}`,
        notificationIcon: "ic_launcher",
      });
      created = true;
      lastKey = key;
      return;
    }
    MusicControls.updateElapsed({
      elapsed: Math.max(0, Math.floor(payload.elapsed || 0)),
      isPlaying: payload.isPlaying,
    });
  } catch (err) {
    created = false;
    lastKey = "";
    console.warn("[bible-audio] syncBibleAudioControls", err);
  }
}

export async function clearBibleAudioControls(): Promise<void> {
  if (!nativeReady() || !created) return;
  created = false;
  lastKey = "";
  try {
    const MusicControls = await getControls();
    await MusicControls.destroy();
  } catch (err) {
    console.warn("[bible-audio] clearBibleAudioControls", err);
  }
}
