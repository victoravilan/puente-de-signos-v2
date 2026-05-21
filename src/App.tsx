import { useEffect, useState } from "react";
import { LANGUAGES, t, type LangCode } from "./i18n";
import CameraToText from "./components/CameraToText";
import TextToSign from "./components/TextToSign";
import Teleprompter, { type ConvoLine } from "./components/Teleprompter";
import AlphabetView from "./components/AlphabetView";
import Dictionary from "./components/Dictionary";
import { usePWAInstall } from "./hooks/usePWAInstall";

type Tab = "home" | "cam" | "tts" | "tp" | "abc" | "dict";

const LOGO_SRC = "./icon-512.png";

export default function App() {
  const { isInstalled, canInstall, promptInstall, isIOS } = usePWAInstall();
  const [tab, setTab] = useState<Tab>("home");
  const [langCode, setLangCode] = useState<LangCode>("es");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [lines, setLines] = useState<ConvoLine[]>([]);
  const lang = LANGUAGES.find(l => l.code === langCode)!;

  // Apply RTL to <html> for Arabic
  useEffect(() => {
    document.documentElement.dir = lang.rtl ? "rtl" : "ltr";
    document.documentElement.lang = lang.code;
  }, [lang]);

  // Add a CSS class on <body> when running as installed PWA so
  // we can tweak safe areas and hide the bottom nav.
  useEffect(() => {
    document.body.classList.toggle("pwa-installed", isInstalled);
  }, [isInstalled]);

  // When installed, make Option A (Camera) the default screen
  useEffect(() => {
    if (isInstalled) {
      setTab("cam");
    }
  }, [isInstalled]);

  const addLine = (who: "you" | "them", text: string) => {
    setLines(prev => [...prev, { id: Date.now() + Math.random(), who, text, ts: Date.now() }]);
  };

  const handleInstall = async () => {
    if (isIOS) {
      setShowIosHelp(true);
      return;
    }
    const outcome = await promptInstall();
    // If the browser hasn't fired beforeinstallprompt yet (e.g., first load),
    // fall back to showing instructions so the user sees the action.
    if (!outcome) {
      setShowIosHelp(true);
    }
  };

  return (
    <div
      className={`relative mx-auto flex min-h-screen max-w-md flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 ${isInstalled ? "pb-6" : "pb-24"}`}
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: isInstalled ? "calc(env(safe-area-inset-bottom) + 1.5rem)" : undefined }}
    >
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur">
        <button onClick={() => setTab("home")} className="flex items-center gap-2 active:scale-95">
          <img
            src={LOGO_SRC}
            alt="Puente de signos"
            className="h-10 w-10 rounded-xl shadow-lg shadow-indigo-500/30 ring-1 ring-white/10"
          />
          <div className="text-left">
            <div className="text-base font-extrabold leading-tight">{t(lang.code, "appName")}</div>
            <div className="text-[10px] uppercase tracking-wider text-white/50">{t(lang.code, "tagline")}</div>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {canInstall && (
            <button
              onClick={handleInstall}
              title={t(lang.code, "install")}
              className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2 text-xs font-bold shadow-lg shadow-emerald-500/30 active:scale-95"
            >
              <span>⬇</span>
              <span className="hidden xs:inline sm:inline">{t(lang.code, "installShort")}</span>
            </button>
          )}
          <button
            onClick={() => setShowLangPicker(true)}
            className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold ring-1 ring-white/10 active:scale-95"
          >
            <span className="text-lg">{lang.flag}</span>
            <span className="opacity-60">▾</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4">
        {tab === "home" && (
          <Home
            lang={lang}
            go={setTab}
            canInstall={canInstall}
            isInstalled={isInstalled}
            onInstall={handleInstall}
          />
        )}
        {tab === "cam" && (
          <CameraToText
            lang={lang}
            onTranscript={(line) => addLine("them", line)}
            canInstall={canInstall && !isInstalled}
            onInstall={handleInstall}
          />
        )}
        {tab === "tts" && (
          <TextToSign lang={lang} onMessage={(line) => addLine("you", line)} />
        )}
        {tab === "tp" && (
          <Teleprompter lang={lang} lines={lines} onClear={() => setLines([])} />
        )}
        {tab === "abc" && <AlphabetView lang={lang} />}
        {tab === "dict" && <Dictionary lang={lang} />}
      </main>

      {/* Bottom nav: hidden when installed (PWA) */}
      {!isInstalled && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-white/10 bg-slate-950/95 backdrop-blur"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="grid grid-cols-5">
            <NavBtn icon="🏠" label={t(lang.code, "home")}        active={tab === "home"} onClick={() => setTab("home")} />
            <NavBtn icon="📷" label={t(lang.code, "camToText")}   active={tab === "cam"}  onClick={() => setTab("cam")} />
            <NavBtn icon="✋" label={t(lang.code, "textToSign")}  active={tab === "tts"}  onClick={() => setTab("tts")} />
            <NavBtn icon="📖" label={t(lang.code, "dictionary")}  active={tab === "dict"} onClick={() => setTab("dict")} />
            <NavBtn icon="🔤" label={t(lang.code, "alphabet")}    active={tab === "abc"}  onClick={() => setTab("abc")} />
          </div>
        </nav>
      )}

      {/* Floating quick-action menu when installed (replaces bottom nav) */}
      {isInstalled && tab !== "home" && (
        <button
          onClick={() => setTab("home")}
          className="fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-2xl shadow-xl shadow-indigo-500/40 active:scale-95"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          aria-label={t(lang.code, "home")}
        >
          🏠
        </button>
      )}

      {/* Language picker modal */}
      {showLangPicker && (
        <div
          onClick={() => setShowLangPicker(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="glass w-full max-w-md rounded-3xl p-4"
          >
            <h3 className="mb-3 text-lg font-bold">{t(lang.code, "chooseLang")}</h3>
            <div className="grid grid-cols-1 gap-2">
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  onClick={() => { setLangCode(l.code); setShowLangPicker(false); }}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left ${l.code === langCode ? "bg-indigo-500/40 ring-1 ring-indigo-300/60" : "bg-white/5 hover:bg-white/10"}`}
                >
                  <span className="text-2xl">{l.flag}</span>
                  <div className="flex-1">
                    <div className="font-semibold">{l.name}</div>
                    <div className="text-xs text-white/60">{l.bcp47}</div>
                  </div>
                  {l.code === langCode && <span>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* iOS install instructions modal */}
      {showIosHelp && (
        <div
          onClick={() => setShowIosHelp(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="glass w-full max-w-md rounded-3xl p-5 text-center"
          >
            <img src={LOGO_SRC} alt="" className="mx-auto mb-3 h-16 w-16 rounded-2xl shadow-lg" />
            <h3 className="mb-1 text-lg font-bold">{t(lang.code, "iosInstallTitle")}</h3>
            <p className="mb-4 text-sm text-white/70">{t(lang.code, "installSub")}</p>
            <ul className="mb-5 space-y-2 text-left text-sm">
              {isIOS ? (
                <>
                  <li className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                    <span className="text-2xl">⬆️</span>
                    <span>{t(lang.code, "iosStep1")}</span>
                  </li>
                  <li className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                    <span className="text-2xl">➕</span>
                    <span>{t(lang.code, "iosStep2")}</span>
                  </li>
                  <li className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                    <span className="text-2xl">✅</span>
                    <span>{t(lang.code, "iosStep3")}</span>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                    <span className="text-2xl">⋮</span>
                    <span>Abre el menú del navegador (⋮)</span>
                  </li>
                  <li className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                    <span className="text-2xl">⬇️</span>
                    <span>Toca “Instalar aplicación” o “Añadir a pantalla de inicio”</span>
                  </li>
                  <li className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                    <span className="text-2xl">✅</span>
                    <span>Confirma y abre desde el icono</span>
                  </li>
                </>
              )}
            </ul>
            <button
              onClick={() => setShowIosHelp(false)}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3 font-bold active:scale-95"
            >
              {t(lang.code, "gotIt")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavBtn({ icon, label, active, onClick }: {
  icon: string; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 py-2 text-[10px] transition ${active ? "text-indigo-300" : "text-white/60"}`}
    >
      <span className={`text-xl transition ${active ? "scale-110" : ""}`}>{icon}</span>
      <span className="truncate px-1">{label}</span>
    </button>
  );
}

/* ----------------- Home ----------------- */

function Home({
  lang,
  go,
  canInstall,
  isInstalled,
  onInstall,
}: {
  lang: ReturnType<typeof currentLang>;
  go: (t: Tab) => void;
  canInstall: boolean;
  isInstalled: boolean;
  onInstall: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Hero */}
      <section className="glass relative overflow-hidden rounded-3xl p-6 text-center">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-500/30 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="relative">
          <img src={LOGO_SRC} alt="Puente de signos" className="mx-auto mb-3 h-24 w-24 rounded-3xl shadow-2xl shadow-indigo-500/40 ring-1 ring-white/10" />
          <h1 className="text-2xl font-extrabold">{t(lang.code, "welcome")}</h1>
          <p className="mt-2 text-sm text-white/70">{t(lang.code, "intro")}</p>
          <button
            onClick={() => go("cam")}
            className="mt-5 rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3 text-base font-bold shadow-lg shadow-indigo-500/30 active:scale-95"
          >▶ {t(lang.code, "cta")}</button>
        </div>
      </section>

      {/* Install banner — only if installable and NOT installed */}
      {canInstall && (
        <button
          onClick={onInstall}
          className="group relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-4 text-left shadow-xl shadow-emerald-500/30 active:scale-[0.98]"
        >
          <div className="absolute -right-6 -top-6 text-8xl opacity-20 transition group-hover:scale-110">📲</div>
          <div className="relative flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20 text-2xl backdrop-blur">⬇</div>
            <div className="flex-1">
              <div className="text-base font-extrabold leading-tight">{t(lang.code, "install")}</div>
              <div className="text-xs text-white/85">{t(lang.code, "installSub")}</div>
            </div>
            <span className="text-xl">›</span>
          </div>
        </button>
      )}

      {isInstalled && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200 ring-1 ring-emerald-400/30">
          <span className="text-lg">✅</span>
          <span className="font-semibold">{t(lang.code, "installed")}</span>
        </div>
      )}

      {/* Quick actions */}
      <section className="grid grid-cols-2 gap-3">
        <Tile color="from-sky-500 to-indigo-600" icon="📷" label={t(lang.code, "camToText")} onClick={() => go("cam")} />
        <Tile color="from-fuchsia-500 to-pink-600" icon="✋" label={t(lang.code, "textToSign")} onClick={() => go("tts")} />
        <Tile color="from-violet-500 to-purple-600" icon="📖" label={t(lang.code, "dictionary")} onClick={() => go("dict")} />
        <Tile color="from-emerald-500 to-teal-600" icon="🔤" label={t(lang.code, "alphabet")} onClick={() => go("abc")} />
        <Tile color="from-amber-500 to-orange-600" icon="📺" label={t(lang.code, "teleprompter")} onClick={() => go("tp")} />
        <Tile color="from-rose-500 to-red-600" icon="💡" label={t(lang.code, "suggest")} onClick={() => go("dict")} />
      </section>

      {/* About */}
      <section className="glass rounded-3xl p-5">
        <h2 className="mb-2 text-lg font-bold">📚 {t(lang.code, "aboutTitle")}</h2>
        <p className="text-sm leading-relaxed text-white/75">{t(lang.code, "aboutBody")}</p>
        <p className="mt-3 rounded-xl bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100/90 ring-1 ring-amber-300/30">
          ⚠️ {t(lang.code, "note")}
        </p>
      </section>

      {/* Footer */}
      <footer className="space-y-1 pt-2 text-center">
        <div className="text-[12px] font-medium text-white/70">
          Creado por Victor M.F. Avilan
        </div>
        <div className="text-[11px] text-white/40">
          Todos los derechos reservados. Valor Agregado 2026
        </div>
      </footer>
    </div>
  );
}

function Tile({ color, icon, label, onClick }: { color: string; icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group relative aspect-square overflow-hidden rounded-3xl bg-gradient-to-br ${color} p-4 text-left shadow-lg active:scale-95`}
    >
      <div className="absolute -bottom-4 -right-4 text-7xl opacity-30 transition group-hover:scale-110">{icon}</div>
      <div className="relative flex h-full flex-col justify-between">
        <div className="text-3xl">{icon}</div>
        <div className="text-base font-bold leading-tight text-white drop-shadow">{label}</div>
      </div>
    </button>
  );
}

// helper type to satisfy TS
function currentLang() { return LANGUAGES[0]; }
