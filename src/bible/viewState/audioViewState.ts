export type AudioViewState =
  | { status: "idle"; hasAudio: boolean }
  | { status: "buffering"; hasAudio: boolean }
  | { status: "playing"; hasAudio: boolean; currentTime: number; duration: number }
  | { status: "error"; hasAudio: boolean; message: string };

export function deriveAudioViewState(input: {
  hasAudio: boolean;
  playing: boolean;
  busy: boolean;
  currentTime: number;
  duration: number;
  error?: string | null;
}): AudioViewState {
  if (input.error) {
    return { status: "error", hasAudio: input.hasAudio, message: input.error };
  }
  if (input.busy) {
    return { status: "buffering", hasAudio: input.hasAudio };
  }
  if (input.playing) {
    return {
      status: "playing",
      hasAudio: input.hasAudio,
      currentTime: input.currentTime,
      duration: input.duration,
    };
  }
  return { status: "idle", hasAudio: input.hasAudio };
}
