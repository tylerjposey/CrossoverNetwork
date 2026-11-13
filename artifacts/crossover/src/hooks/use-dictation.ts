import { useEffect, useRef, useState } from 'react';
import { browserRecognition, createDictation } from '@/lib/dictation';

export function useDictation(text: string, setText: (text: string) => void, maxLength: number) {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('');
  const latest = useRef({ text, setText });
  latest.current = { text, setText };
  const controller = useRef<ReturnType<typeof createDictation> | null>(null);

  useEffect(() => {
    const RecognitionClass = browserRecognition();
    setSupported(Boolean(RecognitionClass));
    if (!RecognitionClass) return;
    const dictation = createDictation({
      RecognitionClass,
      getText: () => latest.current.text,
      setText: (next) => {
        // Keep consecutive recognition events in sync even before React renders.
        latest.current.text = next;
        latest.current.setText(next);
      },
      maxLength,
      setActive,
      setMessage,
    });
    controller.current = dictation;
    return () => {
      controller.current = null;
      dictation.dispose();
    };
  }, [maxLength]);

  return {
    supported, active, message,
    start: () => controller.current?.start(),
    stop: () => controller.current?.stop(),
  };
}
