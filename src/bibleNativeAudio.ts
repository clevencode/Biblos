/**
 * Playback nativo Android (ExoPlayer / Media3) via @mediagrid/capacitor-native-audio.
 * Notificação + FGS mediaPlayback são geridos pelo plugin (useForNotification).
 * Web/iOS: não usar — manter HTMLAudioElement.
 */
import { Capacitor } from "@capacitor/core";
import { AudioPlayer } from "@mediagrid/capacitor-native-audio";

export type NativeAudioStatus = "playing" | "paused" | "stopped";

export type NativeAudioHandlers = {
  onReady?: (duration: number) => void;
  onStatus?: (status: NativeAudioStatus) => void;
  onTime?: (currentTime: number) => void;
  onEnd?: () => void;
};

export type NativePrepareParams = {
  audioId: string;
  url: string;
  title: string;
  artist: string;
  albumTitle?: string;
  resumeAt?: number;
};

let activeId: string | null = null;
let preparedUrl: string | null = null;
let ready = false;
let handlers: NativeAudioHandlers = {};
let timePoll: number | null = null;
let notifPermissionAsked = false;
/** Invalida prepares em voo quando há destroy / novo prepare. */
let prepareEpoch = 0;

export function isNativeBibleAudio(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function isNativeBibleAudioReady(): boolean {
  return Boolean(activeId && ready);
}

/** Android 13+: POST_NOTIFICATIONS via Capawesome (sem arrancar FGS de playback). */
export async function ensureNativeAudioNotificationPermission(): Promise<void> {
  if (!isNativeBibleAudio() || notifPermissionAsked) return;
  notifPermissionAsked = true;
  try {
    const { ForegroundService } = await import(
      "@capawesome-team/capacitor-android-foreground-service"
    );
    const status = await ForegroundService.checkPermissions();
    if (status.display !== "granted") {
      await ForegroundService.requestPermissions();
    }
  } catch {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch {
      /* ignore */
    }
  }
}

function stopTimePoll() {
  if (timePoll != null) {
    window.clearInterval(timePoll);
    timePoll = null;
  }
}

function startTimePoll() {
  stopTimePoll();
  if (!activeId) return;
  timePoll = window.setInterval(() => {
    if (!activeId) return;
    void AudioPlayer.getCurrentTime({ audioId: activeId })
      .then(({ currentTime }) => {
        if (Number.isFinite(currentTime)) handlers.onTime?.(currentTime);
      })
      .catch(() => undefined);
  }, 250);
}

async function destroyCurrent(): Promise<void> {
  prepareEpoch += 1;
  stopTimePoll();
  const id = activeId;
  ready = false;
  preparedUrl = null;
  activeId = null;
  if (!id) return;
  try {
    await AudioPlayer.stop({ audioId: id });
  } catch {
    /* ignore */
  }
  try {
    await AudioPlayer.destroy({ audioId: id });
  } catch {
    /* ignore */
  }
}

/**
 * Prepara (ou troca) a fonte HTTPS e fica pronto para play.
 * Deve ser chamado com a Activity em foreground (Android 12+ FGS).
 * Resume seek completa **antes** de marcar ready (evita play na posição 0).
 */
export async function prepareNativeBibleAudio(
  params: NativePrepareParams,
  nextHandlers: NativeAudioHandlers = {},
): Promise<void> {
  if (!isNativeBibleAudio()) {
    throw new Error("Native bible audio only on Android");
  }
  handlers = nextHandlers;

  const sameSource =
    activeId === params.audioId && preparedUrl === params.url && ready;

  if (sameSource) {
    if (params.resumeAt != null && params.resumeAt > 2) {
      await AudioPlayer.seek({
        audioId: params.audioId,
        timeInSeconds: params.resumeAt,
      });
      handlers.onTime?.(params.resumeAt);
    }
    return;
  }

  await destroyCurrent();
  const epoch = prepareEpoch;

  const audioId = params.audioId;
  activeId = audioId;
  preparedUrl = params.url;
  ready = false;

  await AudioPlayer.create({
    audioId,
    audioSource: params.url,
    albumTitle: params.albumTitle || "Segond 21",
    artistName: params.artist,
    friendlyTitle: params.title,
    useForNotification: true,
    showSeekBackward: true,
    showSeekForward: true,
    seekBackwardTime: 15,
    seekForwardTime: 30,
  });
  if (epoch !== prepareEpoch || activeId !== audioId) return;

  let resolveReady!: () => void;
  let rejectReady!: (err: Error) => void;
  const readyGate = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  await AudioPlayer.onAudioReady({ audioId }, async () => {
    if (epoch !== prepareEpoch || activeId !== audioId) return;
    try {
      const { duration } = await AudioPlayer.getDuration({ audioId });
      if (epoch !== prepareEpoch || activeId !== audioId) return;

      let seekTo: number | null = null;
      if (params.resumeAt != null && params.resumeAt > 2) {
        seekTo =
          Number.isFinite(duration) && duration > 0
            ? Math.min(params.resumeAt, Math.max(0, duration - 1))
            : params.resumeAt;
        await AudioPlayer.seek({ audioId, timeInSeconds: seekTo });
        if (epoch !== prepareEpoch || activeId !== audioId) return;
        handlers.onTime?.(seekTo);
      }

      handlers.onReady?.(
        Number.isFinite(duration) && duration > 0 ? duration : 0,
      );
      ready = true;
      resolveReady();
    } catch (err) {
      handlers.onReady?.(0);
      ready = true;
      resolveReady();
      void err;
    }
  });

  await AudioPlayer.onAudioEnd({ audioId }, () => {
    if (activeId !== audioId) return;
    stopTimePoll();
    handlers.onStatus?.("stopped");
    handlers.onEnd?.();
  });

  await AudioPlayer.onPlaybackStatusChange({ audioId }, ({ status }) => {
    if (activeId !== audioId) return;
    handlers.onStatus?.(status);
    if (status === "playing") startTimePoll();
    else stopTimePoll();
  });

  await AudioPlayer.initialize({ audioId });
  if (epoch !== prepareEpoch || activeId !== audioId) {
    rejectReady(new Error("Native audio prepare superseded"));
    return;
  }

  const timeout = window.setTimeout(() => {
    rejectReady(new Error("Native audio failed to become ready"));
  }, 45000);

  try {
    await readyGate;
  } catch (err) {
    if (epoch !== prepareEpoch) return;
    throw err;
  } finally {
    window.clearTimeout(timeout);
  }

  if (epoch !== prepareEpoch || activeId !== audioId || !ready) {
    throw new Error("Native audio failed to become ready");
  }
}

export async function playNativeBibleAudio(): Promise<void> {
  if (!activeId || !ready) throw new Error("Native audio not ready");
  await AudioPlayer.play({ audioId: activeId });
  startTimePoll();
  handlers.onStatus?.("playing");
}

export async function pauseNativeBibleAudio(): Promise<void> {
  if (!activeId) return;
  await AudioPlayer.pause({ audioId: activeId });
  stopTimePoll();
  handlers.onStatus?.("paused");
}

export async function stopNativeBibleAudio(): Promise<void> {
  if (!activeId) return;
  const id = activeId;
  try {
    await AudioPlayer.stop({ audioId: id });
  } catch {
    /* ignore */
  }
  stopTimePoll();
  handlers.onStatus?.("stopped");
}

export async function seekNativeBibleAudio(seconds: number): Promise<void> {
  if (!activeId || !Number.isFinite(seconds)) return;
  await AudioPlayer.seek({
    audioId: activeId,
    timeInSeconds: Math.max(0, seconds),
  });
  handlers.onTime?.(Math.max(0, seconds));
}

export async function getNativeBibleAudioTime(): Promise<number> {
  if (!activeId) return 0;
  try {
    const { currentTime } = await AudioPlayer.getCurrentTime({ audioId: activeId });
    return Number.isFinite(currentTime) ? currentTime : 0;
  } catch {
    return 0;
  }
}

export async function isNativeBibleAudioPlaying(): Promise<boolean> {
  if (!activeId) return false;
  try {
    const { isPlaying } = await AudioPlayer.isPlaying({ audioId: activeId });
    return Boolean(isPlaying);
  } catch {
    return false;
  }
}

export function getNativeActiveAudioId(): string | null {
  return activeId;
}

export function getNativePreparedUrl(): string | null {
  return preparedUrl;
}

export async function destroyNativeBibleAudio(): Promise<void> {
  await destroyCurrent();
}
