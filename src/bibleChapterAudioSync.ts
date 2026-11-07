export type TranscriptSegment = {
  id: number;
  start: number;
  end: number;
  text: string;
};

export type ChapterTranscript = {
  segments: TranscriptSegment[];
  language?: string;
  provider?: string;
};

export type VerseAudioCue = {
  verse: number;
  start: number;
  end: number;
};

export type ChapterAudioSyncPack = {
  audioUrl: string;
  transcriptUrl: string;
};

/** Pilote sync texte ↔ audio (transcription Gladia). */
const CHAPTER_SYNC_PACKS: Record<string, Record<string, ChapterAudioSyncPack>> = {
  JHN: {
    "1": {
      audioUrl: "/s21-audio-sync/jhn/Jean_Chapitre_1.mp3",
      transcriptUrl: "/s21-audio-sync/jhn/1.transcript.json",
    },
  },
};

export function chapterAudioSyncPack(
  bookId: string,
  chapterId: string,
): ChapterAudioSyncPack | null {
  const book = CHAPTER_SYNC_PACKS[bookId.toUpperCase()];
  if (!book) return null;
  return book[chapterId] ?? null;
}

export function normalizeAlignText(raw: string): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`"«»]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function skipIntroSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  let i = 0;
  while (i < segments.length) {
    const n = normalizeAlignText(segments[i].text);
    if (/^chapitre (un|deux|trois|\d+)/.test(n) || n === "chapitre un") {
      i++;
      continue;
    }
    break;
  }
  return segments.slice(i);
}

/**
 * Aligne chaque verset S21 aux segments de transcription (heuristique gloutonne).
 */
export function buildVerseAudioCues(
  verses: { number: number; text: string }[],
  transcript: ChapterTranscript,
): VerseAudioCue[] {
  const segments = skipIntroSegments(transcript.segments || []);
  if (!segments.length || !verses.length) return [];

  const cues: VerseAudioCue[] = [];
  let segIdx = 0;

  for (const verse of verses) {
    const target = normalizeAlignText(verse.text);
    if (!target) continue;
    if (segIdx >= segments.length) break;

    const startSeg = segIdx;
    let acc = "";
    const targetNeed = Math.max(12, Math.min(target.length, Math.floor(target.length * 0.72)));

    while (segIdx < segments.length && acc.length < targetNeed) {
      acc += ` ${normalizeAlignText(segments[segIdx].text)}`;
      segIdx++;
      if (segIdx - startSeg >= 24) break;
    }

    const endSeg = Math.max(startSeg, segIdx - 1);
    cues.push({
      verse: verse.number,
      start: segments[startSeg].start,
      end: segments[endSeg].end,
    });
  }

  return cues;
}

export async function fetchChapterTranscript(url: string): Promise<ChapterTranscript | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as ChapterTranscript;
    if (!Array.isArray(data.segments)) return null;
    return data;
  } catch {
    return null;
  }
}

export function verseAtTime(cues: VerseAudioCue[], seconds: number): number | null {
  if (!cues.length || !Number.isFinite(seconds)) return null;
  const t = Math.max(0, seconds);
  for (const cue of cues) {
    if (t >= cue.start - 0.05 && t < cue.end + 0.12) return cue.verse;
  }
  let last: VerseAudioCue | null = null;
  for (const cue of cues) {
    if (cue.start <= t) last = cue;
    else break;
  }
  return last?.verse ?? cues[0]?.verse ?? null;
}
