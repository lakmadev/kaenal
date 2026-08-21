// Base / native transcriber. React Native has no built-in speech-to-text, so live
// transcription is unsupported here without a native module (e.g. @react-native-
// voice/voice, which needs a dev build). `supported` is false and CapVoice keeps
// its record-audio + AI-structure flow. The web path (transcribe.web.ts) does real
// live transcription via the Web Speech API on a secure origin.

export interface Transcriber {
  readonly supported: boolean;
  start(onText: (fullText: string) => void): void;
  stop(): void;
}

export function createTranscriber(): Transcriber {
  return { supported: false, start: () => undefined, stop: () => undefined };
}
