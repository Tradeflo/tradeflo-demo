"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Minimal typing for Web Speech API (not in all TS lib.dom versions). */
type SpeechRecognitionResultList = {
  length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult:
    | ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type UseSpeechRecognitionOptions = {
  onInterim?: (preview: string) => void;
};

export function useSpeechRecognition(
  onFinal: (text: string) => void,
  options?: UseSpeechRecognitionOptions,
) {
  const [isRecording, setIsRecording] = useState(false);
  /** false on server + first client paint so SSR markup matches hydration. */
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalRef = useRef("");
  const onFinalRef = useRef(onFinal);
  const onInterimRef = useRef(options?.onInterim);
  onFinalRef.current = onFinal;
  onInterimRef.current = options?.onInterim;

  useEffect(() => {
    setSupported(!!getSpeechRecognition());
  }, []);

  const toggle = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;

    if (recRef.current && isRecording) {
      recRef.current.stop();
      return;
    }

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-CA";
    finalRef.current = "";

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let fin = finalRef.current;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript;
        else interim += r[0].transcript;
      }
      finalRef.current = fin;
      const preview = (fin + interim).trim();
      onInterimRef.current?.(preview || "Listening...");
    };

    rec.onend = () => {
      setIsRecording(false);
      recRef.current = null;
      const t = finalRef.current.trim();
      if (t) onFinalRef.current(t);
    };

    rec.onerror = () => {
      setIsRecording(false);
      recRef.current = null;
    };

    recRef.current = rec;
    setIsRecording(true);
    rec.start();
  }, [isRecording]);

  return { toggle, isRecording, supported };
}
