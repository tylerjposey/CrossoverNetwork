// Small browser API boundary so microphone behavior can be tested without recording audio.
type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
export type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechResult> }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionConstructor = new () => Recognition;

export function browserRecognition(): RecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const browser = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

const MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access was not allowed. Allow it in your browser settings, or keep typing. If this preview blocks access, open the app in its own tab.',
  'service-not-allowed': 'Your browser blocked speech recognition. Try opening the app in its own tab, or keep typing.',
  'audio-capture': 'No microphone was found. Check your microphone, or keep typing.',
  'no-speech': 'No speech was detected. Tap Dictate to try again, or keep typing.',
  network: 'Speech recognition could not connect. Check your connection and try again, or keep typing.',
};

export function createDictation({
  RecognitionClass, getText, setText, setActive, setMessage, maxLength,
}: {
  RecognitionClass: RecognitionConstructor;
  getText: () => string;
  setText: (text: string) => void;
  setActive: (active: boolean) => void;
  setMessage: (message: string) => void;
  maxLength: number;
}) {
  let current: Recognition | null = null;
  let disposed = false;

  function release(recognition: Recognition) {
    recognition.onstart = recognition.onend = recognition.onerror = recognition.onresult = null;
    if (current === recognition) current = null;
  }

  function stop() {
    if (!current) return;
    try {
      // Keep accepting the last final result until onend fires.
      current.stop();
      setMessage('Finishing dictation…');
    } catch {
      const recognition = current;
      release(recognition);
      recognition.abort();
      setActive(false);
      setMessage('Dictation stopped. You can edit your text.');
    }
  }

  return {
    start() {
      if (disposed || current) return;
      if (getText().length >= maxLength) {
        setMessage('Your text has reached the 1,000-character limit. Edit it to make room before dictating.');
        return;
      }
      const seen = new Set<number>();
      let recognition: Recognition;
      try {
        recognition = new RecognitionClass();
      } catch {
        setMessage('Speech recognition could not start. You can still type your introduction.');
        return;
      }
      current = recognition;
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = false;
      setActive(true);
      setMessage('Waiting for microphone permission…');
      recognition.onstart = () => {
        if (current === recognition) setMessage('Listening… Speak about yourself, then tap Stop.');
      };
      recognition.onresult = (event) => {
        if (current !== recognition) return;
        const additions: string[] = [];
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result.isFinal || seen.has(i)) continue;
          seen.add(i);
          const transcript = result[0].transcript.trim();
          if (transcript) additions.push(transcript);
        }
        if (!additions.length) return;
        const text = getText();
        const combined = `${text}${text && !/\s$/.test(text) ? ' ' : ''}${additions.join(' ')}`;
        setText(combined.slice(0, maxLength));
        if (combined.length >= maxLength) {
          stop();
          setMessage('Reached the 1,000-character limit. Review and edit your text before building.');
        }
      };
      recognition.onerror = (event) => {
        if (current !== recognition) return;
        release(recognition);
        recognition.abort();
        setActive(false);
        setMessage(event.error === 'aborted'
          ? 'Dictation stopped. Your text is still here.'
          : MESSAGES[event.error] ?? 'Speech recognition stopped unexpectedly. Your text is still here; try again or keep typing.');
      };
      recognition.onend = () => {
        if (current !== recognition) return;
        release(recognition);
        setActive(false);
        // Preserve helpful errors, limit notices, and the last transcript.
        setMessage(getText().length >= maxLength
          ? 'Reached the 1,000-character limit. Review and edit your text before building.'
          : 'Dictation stopped. Review or edit your text before building.');
      };
      try {
        recognition.start();
      } catch {
        release(recognition);
        setActive(false);
        setMessage('Speech recognition could not start. Check microphone permissions, or keep typing.');
      }
    },
    stop,
    dispose() {
      disposed = true;
      if (!current) return;
      const recognition = current;
      release(recognition);
      recognition.abort();
    },
  };
}
