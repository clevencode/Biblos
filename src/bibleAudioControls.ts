/**
 * Contrôles média natifs (notification / écran verrouillé) — audio persistant Android.
 * APK: Capgo Media Session (FGS mediaPlayback) ; MusicControls en fallback.
 */
import { Capacitor } from "@capacitor/core";

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

type MediaBackend = "capgo" | "music-controls" | "none";

let listening = false;
let created = false;
let lastKey = "";
let notifPermissionAsked = false;
let backend: MediaBackend | null = null;
let musicListening = false;
let bindPromise: Promise<() => void> | null = null;
let pendingHandlers: BibleAudioControlHandlers | null = null;

function nativeReady(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function resolveBackend(): Promise<MediaBackend> {
  if (backend) return backend;
  if (!nativeReady()) {
    backend = "none";
    return backend;
  }
  try {
    await import("@capgo/capacitor-media-session");
    backend = "capgo";
  } catch {
    try {
      await import("capacitor-music-controls-plugin");
      backend = "music-controls";
    } catch {
      backend = "none";
    }
  }
  return backend;
}

async function getCapgo() {
  const mod = await import("@capgo/capacitor-media-session");
  return mod.MediaSession;
}

async function getMusicControls() {
  const mod = await import("capacitor-music-controls-plugin");
  return mod.CapacitorMusicControls;
}

/** Android 13+: POST_NOTIFICATIONS via Capawesome FGS (nativo), fallback Notification web. */
async function ensureNotificationPermission(): Promise<void> {
  if (!nativeReady() || notifPermissionAsked) return;
  notifPermissionAsked = true;
  try {
    const { ForegroundService } = await import(
      "@capawesome-team/capacitor-android-foreground-service"
    );
    const status = await ForegroundService.checkPermissions();
    if (status.display !== "granted") {
      await ForegroundService.requestPermissions();
    }
    return;
  } catch {
    /* Capawesome indisponível */
  }
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch {
    /* WebView sem Notification API */
  }
}

function handleMusicMessage(message: string, handlers: BibleAudioControlHandlers) {
  switch (message) {
    case "music-controls-play":
      handlers.onPlay();
      break;
    case "music-controls-pause":
      handlers.onPause();
      break;
    case "music-controls-toggle-play-pause":
      handlers.onPlay();
      break;
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

async function bindCapgo(handlers: BibleAudioControlHandlers): Promise<() => void> {
  const MediaSession = await getCapgo();
  const actions = [
    "play",
    "pause",
    "seekbackward",
    "seekforward",
    "previoustrack",
    "nexttrack",
    "stop",
    "seekto",
  ] as const;

  await MediaSession.setActionHandler({ action: "play" }, () => {
    handlers.onPlay();
  });
  await MediaSession.setActionHandler({ action: "pause" }, () => {
    handlers.onPause();
  });
  await MediaSession.setActionHandler({ action: "seekbackward" }, () => {
    handlers.onSkipBackward();
  });
  await MediaSession.setActionHandler({ action: "seekforward" }, () => {
    handlers.onSkipForward();
  });
  await MediaSession.setActionHandler({ action: "previoustrack" }, () => {
    handlers.onSkipBackward();
  });
  await MediaSession.setActionHandler({ action: "nexttrack" }, () => {
    handlers.onSkipForward();
  });
  await MediaSession.setActionHandler({ action: "stop" }, () => {
    handlers.onDestroy?.();
  });
  await MediaSession.setActionHandler({ action: "seekto" }, (details) => {
    if (details.seekTime == null || !Number.isFinite(details.seekTime)) return;
    handlers.onSeekTo?.(details.seekTime);
  });

  return () => {
    listening = false;
    for (const action of actions) {
      void MediaSession.setActionHandler({ action }, null);
    }
  };
}

async function bindMusicControls(
  handlers: BibleAudioControlHandlers,
): Promise<() => void> {
  if (musicListening) return () => undefined;
  musicListening = true;
  const MusicControls = await getMusicControls();

  const iosHandle = await MusicControls.addListener("controlsNotification", (info) => {
    handleMusicMessage(String(info?.message || ""), handlers);
  });

  const onAndroidEvent = (event: Event) => {
    const detail = event as Event & { message?: string };
    handleMusicMessage(String(detail.message || ""), handlers);
  };
  document.addEventListener("controlsNotification", onAndroidEvent);

  return () => {
    listening = false;
    musicListening = false;
    void iosHandle.remove();
    document.removeEventListener("controlsNotification", onAndroidEvent);
  };
}

/** Branche les écouteurs notification (une fois). */
export async function bindBibleAudioControls(
  handlers: BibleAudioControlHandlers,
): Promise<() => void> {
  if (!nativeReady()) return () => undefined;
  pendingHandlers = handlers;
  if (listening && bindPromise) {
    await bindPromise;
    return () => {
      listening = false;
    };
  }
  if (listening) return () => undefined;
  listening = true;

  bindPromise = (async () => {
    await ensureNotificationPermission();
    const mode = await resolveBackend();

    if (mode === "capgo") {
      try {
        return await bindCapgo(handlers);
      } catch (err) {
        console.warn("[bible-audio] Capgo bind failed, MusicControls fallback", err);
        backend = "music-controls";
        return bindMusicControls(handlers);
      }
    }
    if (mode === "music-controls") {
      return bindMusicControls(handlers);
    }
    listening = false;
    return () => undefined;
  })();

  try {
    return await bindPromise;
  } finally {
    bindPromise = null;
  }
}

async function syncCapgo(payload: ControlsPayload): Promise<void> {
  const MediaSession = await getCapgo();
  const key = `${payload.track}|${payload.artist}|${Math.round(payload.duration)}`;
  const meta = {
    title: payload.track || "Biblos",
    artist: payload.artist || "Segond 21",
    album: payload.album || "Segond 21",
  };

  /* Sempre metadata antes do state — o OS pode ocultar o card sem title. */
  await MediaSession.setMetadata(meta);
  created = true;
  lastKey = key;

  const playbackState = payload.isPlaying ? "playing" : "paused";
  await MediaSession.setPlaybackState({ playbackState });

  const duration = Math.max(0, payload.duration || 0);
  const position = Math.max(
    0,
    Math.min(duration > 0 ? duration : payload.elapsed || 0, payload.elapsed || 0),
  );
  if (Number.isFinite(duration) && duration > 0) {
    await MediaSession.setPositionState({
      duration,
      position,
      playbackRate: 1,
    });
  }

  /*
   * Capgo arranca o FGS de forma assíncrona no 1.º 'playing'.
   * Um 2.º sync curto actualiza o serviço já ligado (metadata + botões).
   */
  if (payload.isPlaying) {
    await delay(350);
    await MediaSession.setMetadata(meta);
    await MediaSession.setPlaybackState({ playbackState: "playing" });
    if (Number.isFinite(duration) && duration > 0) {
      await MediaSession.setPositionState({
        duration,
        position,
        playbackRate: 1,
      });
    }
  }
}

async function syncMusicControls(payload: ControlsPayload): Promise<void> {
  const MusicControls = await getMusicControls();
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
}

/** Affiche / met à jour la notification média (foreground service). */
export async function syncBibleAudioControls(payload: ControlsPayload): Promise<void> {
  if (!nativeReady()) return;
  try {
    await ensureNotificationPermission();
    if (pendingHandlers && !listening) {
      await bindBibleAudioControls(pendingHandlers);
    }
    const mode = await resolveBackend();
    if (mode === "capgo") {
      await syncCapgo(payload);
      return;
    }
    if (mode === "music-controls") {
      await syncMusicControls(payload);
    }
  } catch (err) {
    created = false;
    lastKey = "";
    console.warn("[bible-audio] syncBibleAudioControls", err);
    if (backend === "capgo") {
      backend = "music-controls";
      try {
        await syncMusicControls(payload);
      } catch (fallbackErr) {
        console.warn("[bible-audio] MusicControls fallback failed", fallbackErr);
      }
    }
  }
}

export async function clearBibleAudioControls(): Promise<void> {
  if (!nativeReady() || !created) return;
  created = false;
  lastKey = "";
  try {
    const mode = await resolveBackend();
    if (mode === "capgo") {
      const MediaSession = await getCapgo();
      await MediaSession.setPlaybackState({ playbackState: "none" });
      return;
    }
    if (mode === "music-controls") {
      const MusicControls = await getMusicControls();
      await MusicControls.destroy();
    }
  } catch (err) {
    console.warn("[bible-audio] clearBibleAudioControls", err);
  }
}
