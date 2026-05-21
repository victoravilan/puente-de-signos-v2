import { useState } from "react";
import type { LangDef } from "../i18n";
import { t } from "../i18n";
import { SignHand, LSE_ALPHABET } from "../signAlphabet";

interface Props { lang: LangDef; }

export default function AlphabetView({ lang }: Props) {
  const letters = Object.keys(LSE_ALPHABET);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="glass rounded-3xl p-4">
        <h2 className="mb-1 text-xl font-bold">🤟 {t(lang.code, "alphabet")}</h2>
        <p className="text-sm text-white/70">
          LSE — Lengua de Signos Española · {t(lang.code, "learn")}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {letters.map(l => (
          <button
            key={l}
            onClick={() => setSelected(l)}
            className="group flex flex-col items-center gap-1 rounded-2xl bg-white/5 p-2 ring-1 ring-white/10 transition hover:bg-white/10 active:scale-95"
          >
            <SignHand letter={l} size={120} showLabel={false} />
            <div className="text-lg font-bold">{l}</div>
          </button>
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="glass w-full max-w-md rounded-3xl p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-2xl font-bold">{t(lang.code, "letter")} {selected}</h3>
              <button onClick={() => setSelected(null)} className="rounded-full bg-white/10 px-3 py-1">✕</button>
            </div>
            <div className="flex justify-center">
              <SignHand letter={selected} size={280} active />
            </div>
            {LSE_ALPHABET[selected].notes && (
              <p className="mt-3 rounded-xl bg-black/30 p-3 text-sm text-white/80">
                {LSE_ALPHABET[selected].notes}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
