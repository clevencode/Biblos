export type BibleAudioEpisode = {
  usfm: string;
  title: string;
  audioUrl: string;
  duration: string | null;
  guid: string | null;
};

export type BibleAudioCatalog = {
  ok: boolean;
  error?: string;
  source?: string;
  podcast?: string;
  scope?: string;
  books?: Record<string, BibleAudioEpisode>;
  count?: number;
};

const AUDIO_POS_KEY = "biblos-bible-audio-pos";

export async function fetchBibleAudioCatalog(): Promise<BibleAudioCatalog> {
  try {
    const res = await fetch("/api/bible-audio");
    return (await res.json()) as BibleAudioCatalog;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      books: {},
      count: 0,
    };
  }
}

export function loadAudioPositions(): Record<string, number> {
  try {
    const raw = localStorage.getItem(AUDIO_POS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveAudioPosition(usfm: string, seconds: number) {
  try {
    const all = loadAudioPositions();
    if (!Number.isFinite(seconds) || seconds < 2) {
      delete all[usfm];
    } else {
      all[usfm] = Math.floor(seconds);
    }
    localStorage.setItem(AUDIO_POS_KEY, JSON.stringify(all));
  } catch {
    /* private mode */
  }
}
