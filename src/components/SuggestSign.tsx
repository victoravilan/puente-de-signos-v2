import { useState } from "react";
import type { LangDef } from "../i18n";
import { t } from "../i18n";

interface Props {
  lang: LangDef;
}

export default function SuggestSign({ lang }: Props) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = () => {
    if (!text.trim()) return;
    // In a real app, this would send to a backend
    // For now, we store locally and show confirmation
    const existing = JSON.parse(localStorage.getItem("puente-signos-sugerencias") || "[]");
    existing.push({ text: text.trim(), lang: lang.code, date: Date.now() });
    localStorage.setItem("puente-signos-sugerencias", JSON.stringify(existing));
    setSent(true);
    setText("");
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="glass rounded-3xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl">💡</span>
        <div>
          <h3 className="text-base font-bold">{t(lang.code, "suggest")}</h3>
          <p className="text-xs text-white/60">{t(lang.code, "suggestDesc")}</p>
        </div>
      </div>

      {sent ? (
        <div className="rounded-xl bg-emerald-500/20 p-4 text-center text-sm text-emerald-200 ring-1 ring-emerald-400/30">
          ✅ {t(lang.code, "suggestSent")}
        </div>
      ) : (
        <>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={t(lang.code, "suggestPlaceholder")}
            rows={2}
            className="w-full resize-none rounded-xl bg-black/30 p-3 text-sm outline-none placeholder:text-white/40"
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="mt-2 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-2.5 text-sm font-bold text-white shadow active:scale-95 disabled:opacity-40"
          >
            📤 {t(lang.code, "send")}
          </button>
        </>
      )}
    </div>
  );
}
