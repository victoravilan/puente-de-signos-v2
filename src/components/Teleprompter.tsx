import { useEffect, useMemo, useRef, useState } from "react";
import type { LangDef } from "../i18n";
import { t } from "../i18n";

export interface ConvoLine {
  id: number;
  who: "you" | "them";
  text: string;
  ts: number;
}

interface Props {
  lang: LangDef;
  lines: ConvoLine[];
  onClear: () => void;
}

export default function Teleprompter({ lang, lines, onClear }: Props) {
  const [auto, setAuto] = useState(true);
  const [speed, setSpeed] = useState(40); // seconds per loop
  const [size, setSize] = useState(48);
  const containerRef = useRef<HTMLDivElement>(null);

  // Most recent message big
  const last = lines[lines.length - 1];

  // Compose the running text
  const running = useMemo(
    () => lines.map(l => `${l.who === "you" ? t(lang.code, "you") : t(lang.code, "them")}:  ${l.text}`).join("    •    "),
    [lines, lang.code],
  );

  // Auto-scroll list to bottom
  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [lines.length]);

  return (
    <div className="flex flex-col gap-4">
      {/* Big featured message */}
      <div className="glass relative flex min-h-[40vh] items-center justify-center overflow-hidden rounded-3xl p-6 text-center">
        {last ? (
          <div
            dir={lang.rtl ? "rtl" : "ltr"}
            style={{ fontSize: size, lineHeight: 1.15 }}
            className="font-bold tracking-tight text-white"
          >
            <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-300">
              {last.who === "you" ? t(lang.code, "you") : t(lang.code, "them")}
            </div>
            {last.text}
          </div>
        ) : (
          <div className="text-white/50">📺 {t(lang.code, "teleprompter")}</div>
        )}
      </div>

      {/* Marquee */}
      {auto && running && (
        <div className="glass relative h-20 overflow-hidden rounded-2xl">
          <div
            className="absolute inset-x-0 whitespace-nowrap text-3xl font-bold tracking-wide text-white"
            style={{
              animation: `marquee ${speed}s linear infinite`,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            {running}  {running}
          </div>
          <style>{`
            @keyframes marquee {
              from { transform: translate(0%, -50%); }
              to   { transform: translate(-50%, -50%); }
            }
          `}</style>
        </div>
      )}

      {/* Controls */}
      <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <button
          onClick={() => setAuto(a => !a)}
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${auto ? "bg-indigo-500" : "bg-white/10"}`}
        >{auto ? "⏸ Pause" : "▶ Play"}</button>
        <div className="flex items-center gap-2 text-sm">
          <span>{t(lang.code, "speed")}</span>
          <input type="range" min={15} max={90} value={speed} onChange={e => setSpeed(Number(e.target.value))} className="accent-indigo-400" />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>A</span>
          <input type="range" min={28} max={88} value={size} onChange={e => setSize(Number(e.target.value))} className="accent-indigo-400" />
          <span className="text-lg">A</span>
        </div>
        <div className="flex-1" />
        <button onClick={onClear} className="rounded-xl bg-white/10 px-3 py-2 text-sm">{t(lang.code, "clear")}</button>
      </div>

      {/* Conversation history */}
      <div ref={containerRef} className="glass max-h-[28vh] overflow-y-auto rounded-2xl p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/60">{t(lang.code, "transcript")}</h3>
        {lines.length === 0 ? (
          <div className="text-center text-sm text-white/40">…</div>
        ) : (
          <ul dir={lang.rtl ? "rtl" : "ltr"} className="flex flex-col gap-2">
            {lines.map(l => (
              <li key={l.id} className={`flex ${l.who === "you" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${l.who === "you" ? "bg-indigo-500/80" : "bg-white/10"}`}>
                  <div className="text-[10px] uppercase tracking-wider opacity-70">
                    {l.who === "you" ? t(lang.code, "you") : t(lang.code, "them")}
                  </div>
                  {l.text}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
