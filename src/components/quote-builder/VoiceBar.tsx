"use client";

import { useEffect, useState } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

type VoiceBarProps = {
  idleLabel: string;
  onFinal: (text: string) => void;
};

export function VoiceBar({ idleLabel, onFinal }: VoiceBarProps) {
  const [label, setLabel] = useState(idleLabel);
  const { toggle, isRecording, supported } = useSpeechRecognition(onFinal, {
    onInterim: (preview) => setLabel(preview || "Listening..."),
  });

  useEffect(() => {
    if (!isRecording) setLabel(idleLabel);
  }, [isRecording, idleLabel]);

  if (!supported) return null;

  return (
    <div
      className={`voice-bar${isRecording ? " rec" : ""}`}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="vdot" />
      <span className="voice-bar-lbl">
        {isRecording ? label : idleLabel}
      </span>
    </div>
  );
}
