import { useEffect, useRef, useState, useCallback } from "react";
import type { LangDef } from "../i18n";

/* ---------- Text-to-Speech ---------- */
export function useTTS() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const speak = useCallback((text: string, lang: LangDef, rate = 1) => {
    if (!text || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang.bcp47;
    u.rate = rate;
    // Pick best voice for that locale, prefer "natural" / "google" / "premium"
    const all = window.speechSynthesis.getVoices();
    const candidates = all.filter(v => v.lang.toLowerCase().startsWith(lang.code));
    const natural = candidates.find(v => /natural|google|premium|enhanced|neural/i.test(v.name));
    u.voice = natural ?? candidates[0] ?? null;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, []);

  const stop = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking, voices };
}

/* ---------- Speech-to-Text ---------- */
export function useSTT(lang: LangDef, onResult: (txt: string, isFinal: boolean) => void) {
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Available =
    typeof window !== "undefined" &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const start = useCallback(() => {
    if (!Available) {
      setError("not-supported");
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = lang.bcp47;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (final) onResult(final, true);
      if (interim) onResult(interim, false);
    };
    rec.onerror = (e: any) => setError(e.error || "error");
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
    setError(null);
  }, [lang, onResult, Available]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { start, stop, listening, error, supported: !!Available };
}
