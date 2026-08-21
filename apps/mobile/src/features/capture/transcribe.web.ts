// Live speech-to-text for the PWA via the Web Speech API (m-capture.jsx CapVoice).
// Real transcription where the platform can do it: a secure origin (https or
// localhost) and a browser that exposes SpeechRecognition. Elsewhere `supported`
// is false and the screen keeps its record-audio + AI-structure behaviour — the
// native path uses transcribe.ts (no built-in STT without a native module).

/** Minimal shape of the events we read — the DOM lib doesn't type SpeechRecognition. */
interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  0: SpeechAlternative;
  isFinal: boolean;
  length: number;
}
interface SpeechResultList {
  length: number;
  [index: number]: SpeechResult;
}
interface SpeechEvent {
  resultIndex: number;
  results: SpeechResultList;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined" || window.isSecureContext !== true) return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface Transcriber {
  readonly supported: boolean;
  /** Begin listening; `onText` receives the full transcript so far as it grows. */
  start(onText: (fullText: string) => void): void;
  stop(): void;
}

export function createTranscriber(): Transcriber {
  const Ctor = recognitionCtor();
  if (Ctor === null) return { supported: false, start: () => undefined, stop: () => undefined };

  let rec: Recognition | null = null;
  let finalText = "";
  return {
    supported: true,
    start(onText) {
      finalText = "";
      rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r === undefined) continue;
          const chunk = r[0].transcript;
          if (r.isFinal) finalText += chunk;
          else interim += chunk;
        }
        onText((finalText + interim).trimStart());
      };
      // A no-speech / permission error just ends the session; the audio recorder
      // (running in parallel) still captures the note as evidence.
      rec.onerror = () => rec?.stop();
      rec.start();
    },
    stop() {
      rec?.stop();
      rec = null;
    },
  };
}
