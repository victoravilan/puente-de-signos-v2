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
  const [isInitializing, setIsInitializing] = useState(true);
  const lang = LANGUAGES.find(l => l.code === langCode)!;

  // Initializing delay for professional splash feel
  useEffect(() => {
    const timer = setTimeout(() => setIsInitializing(false), 2000);
    return () => clearTimeout(timer);
  }, []);

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
    if (!outcome) {
      setShowIosHelp(true);
    }
  };

  if (isInitializing) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 overflow-hidden">
        <div className="relative">
          <div className="relative z-10 h-32 w-32 animate-[float_3s_ease-in-out_infinite]">
             <img src={LOGO_SRC} alt="Loading..." className="h-full w-full rounded-[2rem] shadow-[0_0_50px_rgba(99,102,241,0.4)] ring-1 ring-white/20" />
          </div>
          <div className="absolute inset-0 -z-0 h-32 w-32 scale-150 animate-pulse rounded-full bg-indigo-500/20 blur-3xl" />
        </div>
        <div className="mt-12 flex flex-col items-center gap-2">
          <h1 className="text-2xl font-black tracking-[0.3em] text-white">PUENTE</h1>
          <h2 className="text-sm font-light tracking-[0.5em] text-indigo-300/80">DE SIGNOS</h2>
        </div>
        <div className="mt-10 h-1 w-48 overflow-hidden rounded-full bg-white/5">
          <div className="h-full animate-loading bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: "100%" }} />
        </div>
        <div className="absolute bottom-10 text-[10px] font-medium tracking-widest text-white/20 uppercase">
          Powered by Valor Agregado AI
        </div>
      </div>
    );
  }

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
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero Section - High End */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-slate-900/50 p-8 text-center ring-1 ring-white/10 shadow-2xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-fuchsia-600/10 blur-[80px]" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-600/10 blur-[80px]" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-6 h-28 w-28 rounded-[2rem] bg-gradient-to-br from-indigo-500 to-fuchsia-500 p-[2px] shadow-2xl">
            <div className="h-full w-full rounded-[1.9rem] bg-slate-950 p-4">
              <img src={LOGO_SRC} alt="Puente de signos" className="h-full w-full object-contain" />
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">{t(lang.code, "welcome")}</h1>
          <p className="mt-3 max-w-[240px] text-sm leading-relaxed text-slate-400 font-medium">
            {t(lang.code, "intro")}
          </p>
          <button
            onClick={() => go("cam")}
            className="mt-8 flex items-center gap-3 rounded-2xl bg-white px-8 py-4 text-sm font-black text-slate-950 shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all active:scale-95 active:shadow-none"
          >
            <span className="text-lg">✨</span>
            {t(lang.code, "cta").toUpperCase()}
          </button>
        </div>
      </section>

      {/* Grid Actions */}
      <section className="grid grid-cols-2 gap-4">
        <Tile
          color="bg-indigo-600"
          icon="📷"
          label={t(lang.code, "camToText")}
          description="Interpretación IA"
          onClick={() => go("cam")}
        />
        <Tile
          color="bg-fuchsia-600"
          icon="✋"
          label={t(lang.code, "textToSign")}
          description="Aprender signos"
          onClick={() => go("tts")}
        />
        <Tile
          color="bg-slate-800"
          icon="📖"
          label={t(lang.code, "dictionary")}
          description="LSE Catálogo"
          onClick={() => go("dict")}
        />
        <Tile
          color="bg-slate-800"
          icon="🔤"
          label={t(lang.code, "alphabet")}
          description="Dactilológico"
          onClick={() => go("abc")}
        />
      </section>

      {/* Secondary Actions */}
      <div className="grid grid-cols-1 gap-3">
         <button
           onClick={() => go("tp")}
           className="glass flex items-center justify-between rounded-3xl p-5 transition-all active:scale-[0.98] ring-1 ring-white/5"
         >
           <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/20 text-2xl">📺</div>
              <div className="text-left">
                <div className="text-sm font-bold text-white">{t(lang.code, "teleprompter")}</div>
                <div className="text-[11px] text-slate-500 font-medium">Modo conversación asistida</div>
              </div>
           </div>
           <span className="text-xl text-slate-600">›</span>
         </button>
      </div>

      {/* Info Card */}
      <section className="glass rounded-[2rem] p-6 ring-1 ring-white/5 shadow-inner">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">📚</span>
          <h2 className="text-sm font-bold tracking-wide uppercase text-white/80">{t(lang.code, "aboutTitle")}</h2>
        </div>
        <p className="text-xs leading-relaxed text-slate-400 font-medium">{t(lang.code, "aboutBody")}</p>
      </section>

      {/* Footer */}
      <footer className="py-6 flex flex-col items-center gap-1 opacity-40">
        <div className="h-[1px] w-12 bg-white/20 mb-4" />
        <div className="text-[10px] font-bold tracking-[0.2em] text-white">VICTOR M.F. AVILAN</div>
        <div className="text-[9px] font-medium text-white/50 tracking-widest uppercase">VALOR AGREGADO © 2026</div>
      </footer>
    </div>
  );
}

function Tile({ color, icon, label, description, onClick }: { color: string; icon: string; label: string; description: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-start justify-between overflow-hidden rounded-[2rem] p-6 text-left transition-all active:scale-95 shadow-xl ${color} ring-1 ring-white/10`}
    >
      <div className="absolute -right-4 -top-4 text-8xl opacity-10 transition-transform duration-700 group-hover:scale-125 group-hover:rotate-12 select-none">
        {icon}
      </div>

      <div className="relative z-10 flex h-full flex-col justify-between gap-8 w-full">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-2xl backdrop-blur-md shadow-inner ring-1 ring-white/20">
          {icon}
        </div>
        <div>
          <div className="text-sm font-black leading-tight text-white drop-shadow-md">{label}</div>
          <div className="mt-1 text-[10px] font-medium text-white/60 tracking-wide">{description}</div>
        </div>
      </div>
    </button>
  );
}

// helper type to satisfy TS
function currentLang() { return LANGUAGES[0]; }
