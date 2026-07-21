"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { stripFurigana } from "@/lib/furigana";

interface ReadAloudButtonProps {
  text: string;
}

const noopSubscribe = () => () => {};

/** Web Speech API による音声読み上げボタン */
export function ReadAloudButton({ text }: ReadAloudButtonProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSupported = useSyncExternalStore(
    noopSubscribe,
    () => "speechSynthesis" in window,
    () => false,
  );

  // アンマウント時に読み上げを停止
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggle = useCallback(() => {
    if (!isSupported) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(stripFurigana(text));
    utterance.lang = "ja-JP";
    utterance.rate = 0.9;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, [isSupported, isSpeaking, text]);

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isSpeaking}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-primary/30 bg-primary-soft px-4 py-2 text-sm font-bold text-primary-dark transition hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
    >
      <span aria-hidden>{isSpeaking ? "⏹" : "🔊"}</span>
      {isSpeaking ? "読み上げをとめる" : "読み上げる"}
    </button>
  );
}
