export type SpeechFailure = "unsupported" | "denied" | "no-match" | "aborted" | "error";

type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};

type RecognitionCtor = new () => SpeechRecognitionLike;

function failure(name: SpeechFailure): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

/** One single-shot recognition per call; resolves with the final transcript. */
export function listenOnce(): { result: Promise<string>; abort: () => void } {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) {
    return { result: Promise.reject(failure("unsupported")), abort: () => {} };
  }
  const recognition = new Ctor();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  let settled = false;
  const result = new Promise<string>((resolve, reject) => {
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };
    recognition.onresult = (event) => {
      const transcript =
        event.results[event.resultIndex]?.[0]?.transcript?.trim() ??
        event.results[0]?.[0]?.transcript?.trim() ??
        "";
      done(() => (transcript ? resolve(transcript) : reject(failure("no-match"))));
    };
    recognition.onerror = (event) => {
      const name: SpeechFailure =
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "denied"
          : event.error === "no-speech" || event.error === "no-match"
            ? "no-match"
            : event.error === "aborted"
              ? "aborted"
              : "error";
      done(() => reject(failure(name)));
    };
    recognition.onend = () => done(() => reject(failure("no-match")));
  });
  try {
    recognition.start();
  } catch {
    settled = true;
    return { result: Promise.reject(failure("error")), abort: () => {} };
  }
  return {
    result,
    abort: () => {
      settled = true;
      try {
        recognition.abort();
      } catch {
        // recognizer may not implement abort or may already be stopped
      }
    },
  };
}
