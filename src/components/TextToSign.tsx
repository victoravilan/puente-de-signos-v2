import { useEffect, useMemo, useRef, useState } from "react";
import type { LangDef } from "../i18n";
import { t } from "../i18n";
import { SignHand, toSignTokens } from "../signAlphabet";
import { useSTT, useTTS } from "../hooks/useSpeech";

interface Props {
  lang: LangDef;
  onMessage?: (line: string) => void;
}

export default function TextToSign({ lang, onMessage }: Props) {
  const [text, setText] = useState("");
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const [speed, setSpeed] = useState(700); // ms per letter
  const tokens = useMemo(() => toSignTokens(text), [text]);
  const { speak } = useTTS();
  const { start, stop, listening, supported } = useSTT(lang, (chunk, isFinal) => {
    if (isFinal) setText(prev => (prev + " " + chunk).trim());
  });
  const timer = useRef<number | null>(null);

  // Playback loop
  useEffect(() => {
    if (!playing) {
      if (timer.current) window.clearTimeout(timer.current);
      return;
    }
    if (idx >= tokens.length) { setPlaying(false); return; }
    timer.current = window.setTimeout(() => setIdx(i => i + 1), speed);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [playing, idx, tokens.length, speed]);

  const start_ = () => { setIdx(0); setPlaying(true); };
  const pause_ = () => setPlaying(false);

  const onSend = () => {
    if (!text.trim()) return;
    onMessage?.(text.trim());
    speak(text.trim(), lang);
    start_();
  };

  const currentToken = tokens[Math.min(idx, tokens.length - 1)] || "";

  return (
    <div className="flex flex-col gap-4">
      {/* Big sign display */}
      <div className="glass relative flex aspect-[4/3] w-full items-center justify-center rounded-3xl p-6">
        {tokens.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-center text-white/60">
            <div className="text-6xl">✋</div>
            <div>{t(lang.code, "type")}</div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <SignHand letter={currentToken} size={260} active={playing} />
            <div className="flex items-center gap-1 text-2xl font-bold tracking-wider">
              {tokens.map((tk, i) => (
                <span key={i} className={
                  i === idx
                    ? "rounded-md bg-indigo-500 px-2 py-1 text-white"
                    : i < idx ? "text-white/80" : "text-white/30"
                }>
                  {tk === " " ? "·" : tk}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Playback controls */}
      <div className="glass flex items-center gap-3 rounded-2xl p-3">
        <button
          onClick={playing ? pause_ : start_}
          disabled={tokens.length === 0}
          className="grid h-12 w-12 place-items-center rounded-full bg-indigo-500 text-white shadow active:scale-95 disabled:opacity-40"
        >{playing ? "⏸" : "▶"}</button>
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-xs text-white/60">
            <span>{t(lang.code, "speed")}</span>
            <span>{(1000 / speed).toFixed(1)} /s</span>
          </div>
          <input
            type="range" min={300} max={1500} step={50}
            value={speed} onChange={e => setSpeed(Number(e.target.value))}
            className="w-full accent-indigo-400"
          />
        </div>
        <button
          onClick={() => { setText(""); setIdx(0); setPlaying(false); }}
          className="rounded-xl bg-white/10 px-3 py-2 text-sm"
        >{t(lang.code, "clear")}</button>
      </div>

      {/* Input */}
      <div className="glass rounded-2xl p-3">
        <textarea
          dir={lang.rtl ? "rtl" : "ltr"}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t(lang.code, "type")}
          rows={3}
          className="w-full resize-none rounded-xl bg-black/30 p-3 text-base outline-none placeholder:text-white/40"
        />
        <div className="mt-2 flex items-center gap-2">
          {supported && (
            <button
              onClick={listening ? stop : start}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${listening ? "bg-red-500" : "bg-white/10"}`}
            >
              {listening ? <><span className="pulse-dot inline-block h-2 w-2 rounded-full bg-white" /> {t(lang.code, "rec")}</> : <>🎤 {t(lang.code, "listen")}</>}
            </button>
          )}
          <button
            onClick={() => speak(text, lang)}
            disabled={!text.trim()}
            className="rounded-xl bg-white/10 px-3 py-2 text-sm disabled:opacity-40"
          >🔊 {t(lang.code, "speak")}</button>
          <button
            onClick={async () => {
              if (!text.trim()) return;
              if (navigator.share) {
                try { await navigator.share({ title: t(lang.code, "appName"), text }); } catch {}
              } else {
                await navigator.clipboard.writeText(text);
              }
            }}
            disabled={!text.trim()}
            className="rounded-xl bg-white/10 px-3 py-2 text-sm disabled:opacity-40"
          >📤 {t(lang.code, "share")}</button>
          <div className="flex-1" />
          <button
            onClick={onSend}
            disabled={!text.trim()}
            className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-40"
          >{t(lang.code, "send")} ✈</button>
        </div>
      </div>
    </div>
  );
}
