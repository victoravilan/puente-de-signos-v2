import { useCallback, useEffect, useRef, useState } from "react";
import type { LangDef } from "../i18n";
import { t } from "../i18n";
import { useTTS } from "../hooks/useSpeech";
import { loadMediaPipeHands } from "../lib/mediapipeLoader";
import {
  classifyHand,
  LetterStabilizer,
  type Landmark,
} from "../lib/handClassifier";

interface Props {
  lang: LangDef;
  onTranscript?: (line: string) => void;
  canInstall?: boolean;
  onInstall?: () => void;
}

type Status = "idle" | "loading" | "ready" | "error";

export default function CameraToText({ lang, onTranscript, canInstall, onInstall }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handsRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const tipTrailRef = useRef<Landmark[]>([]);
  const stabilizerRef = useRef<LetterStabilizer | null>(null);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [letter, setLetter] = useState<string>("");
  const [confidence, setConfidence] = useState(0);
  const [transcript, setTranscript] = useState<string>("");
  const [currentWord, setCurrentWord] = useState<string>("");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [handDetected, setHandDetected] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);

  const { speak, speaking } = useTTS();

  // Refs to keep latest values inside callbacks without re-binding hands
  const facingRef = useRef(facing);
  const showSkeletonRef = useRef(showSkeleton);
  useEffect(() => { facingRef.current = facing; }, [facing]);
  useEffect(() => { showSkeletonRef.current = showSkeleton; }, [showSkeleton]);

  /* ------------------------------------------------------------------ */
  /* Hand-results processing                                            */
  /* ------------------------------------------------------------------ */
  const onHandResults = useCallback((results: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    // Match canvas to video size
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Mirror horizontally if front camera (so drawings line up with mirrored video)
    if (facingRef.current === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    const hand = results.multiHandLandmarks?.[0] as Landmark[] | undefined;
    if (hand && hand.length === 21) {
      setHandDetected(true);

      if (showSkeletonRef.current && window.drawConnectors && window.drawLandmarks) {
        try {
          window.drawConnectors(ctx, hand, window.HAND_CONNECTIONS, {
            color: "#a5b4fc",
            lineWidth: 4,
          });
          window.drawLandmarks(ctx, hand, {
            color: "#fbbf24",
            lineWidth: 1,
            radius: 4,
          });
        } catch { /* ignore drawing errors */ }
      }

      // Update tip trail (use index tip for Z, pinky tip for J – we just track
      // one representative point; classifier reads the whole trail)
      const tip = hand[8]; // index tip
      tipTrailRef.current.push({ x: tip.x, y: tip.y, z: tip.z });
      if (tipTrailRef.current.length > 15) tipTrailRef.current.shift();

      const cls = classifyHand(hand, { recentTipTrail: tipTrailRef.current });
      setLetter(cls.letter);
      setConfidence(Math.round(cls.confidence * 100));
      stabilizerRef.current?.push(cls);
    } else {
      setHandDetected(false);
      setLetter("");
      setConfidence(0);
      tipTrailRef.current = [];
      stabilizerRef.current?.push({
        letter: "", confidence: 0,
        fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
      });
    }
    ctx.restore();
  }, []);

  /* ------------------------------------------------------------------ */
  /* Camera lifecycle                                                   */
  /* ------------------------------------------------------------------ */
  const stopStream = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch {}
      videoRef.current.srcObject = null;
    }
  }, []);

  const startStream = useCallback(async (which: "user" | "environment") => {
    setError(null);
    setStatus("loading");
    try {
      // 1. Load MediaPipe (cached after first call)
      const hands = await loadMediaPipeHands();
      hands.onResults(onHandResults);
      handsRef.current = hands;

      // 2. Stop any previous stream BEFORE requesting a new one
      stopStream();

      // 3. Request camera. Try exact facing first, fall back to ideal.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: which }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        // Some devices (desktops, single-cam phones) don't support `exact`
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: which },
          audio: false,
        });
      }
      streamRef.current = stream;

      const video = videoRef.current!;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();

      // 4. Start the per-frame send loop
      const sendLoop = async () => {
        if (!streamRef.current || !handsRef.current || !videoRef.current) return;
        if (videoRef.current.readyState >= 2) {
          try {
            await handsRef.current.send({ image: videoRef.current });
          } catch { /* ignore transient errors */ }
        }
        rafRef.current = requestAnimationFrame(sendLoop);
      };
      rafRef.current = requestAnimationFrame(sendLoop);

      setStatus("ready");
      setActive(true);
    } catch (e: any) {
      console.error("Camera error:", e);
      setError(e?.message || t(lang.code, "cameraDenied"));
      setStatus("error");
      setActive(false);
      stopStream();
    }
  }, [lang.code, onHandResults, stopStream]);

  const handleStart = () => startStream(facing);

  const handleStop = () => {
    stopStream();
    setActive(false);
    setStatus("idle");
    setLetter("");
    setHandDetected(false);
  };

  const handleSwitch = async () => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    if (active) {
      await startStream(next);
    }
  };

  // Set up stabilizer once
  useEffect(() => {
    stabilizerRef.current = new LetterStabilizer(8, 0.55, (ltr) => {
      setCurrentWord((prev) => prev + ltr);
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopStream(), [stopStream]);

  /* ------------------------------------------------------------------ */
  /* Word / sentence handling                                           */
  /* ------------------------------------------------------------------ */
  const commitWord = () => {
    const w = currentWord.trim();
    if (!w) return;
    setTranscript((prev) => (prev ? prev + " " + w : w));
    onTranscript?.(w);
    if (autoSpeak) speak(w, lang, 1);
    setCurrentWord("");
    stabilizerRef.current?.reset();
  };

  const backspace = () => setCurrentWord((w) => w.slice(0, -1));

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */
  return (
    <div className="flex flex-col gap-4">
      {/* Install banner for Option A */}
      {canInstall && onInstall && (
        <button
          onClick={onInstall}
          className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 px-4 py-3 text-left ring-1 ring-emerald-400/30 backdrop-blur hover:from-emerald-500/30 hover:to-cyan-500/30 active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/90 text-xl shadow-lg">⬇</div>
            <div>
              <div className="text-sm font-bold leading-tight">{t(lang.code, "install")}</div>
              <div className="text-[11px] text-white/70">{t(lang.code, "installSub")}</div>
            </div>
          </div>
          <div className="text-xl opacity-70">›</div>
        </button>
      )}

      {/* Video viewport */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-black shadow-2xl ring-1 ring-white/10">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: facing === "user" ? "scaleX(-1)" : "none" }}
        />
        {/* Overlay canvas for skeleton */}
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />

        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-slate-900/80 to-slate-950 p-6 text-center">
            <div className="text-6xl">🤟</div>
            <div className="max-w-xs text-sm text-white/80">{t(lang.code, "handGuide")}</div>
            {status === "loading" && (
              <div className="flex items-center gap-2 text-indigo-300">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent" />
                <span className="text-xs">Cargando modelo IA…</span>
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-red-500/30 px-3 py-2 text-xs text-red-100">{error}</div>
            )}
            <button
              onClick={handleStart}
              disabled={status === "loading"}
              className="rounded-2xl bg-indigo-500 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 active:scale-95 disabled:opacity-50"
            >
              ▶ {t(lang.code, "startCamera")}
            </button>
          </div>
        )}

        {active && (
          <>
            {/* Hand-frame guide */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className={`h-[70%] w-[70%] rounded-3xl border-2 border-dashed transition-colors ${handDetected ? "border-emerald-400/80" : "border-indigo-300/50"} shadow-[0_0_40px_rgba(99,102,241,0.35)_inset]`} />
            </div>

            {/* Top status bar */}
            <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
              <div className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs">
                <span className="pulse-dot inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="font-bold tracking-wider">{t(lang.code, "rec")}</span>
              </div>
              <div className={`rounded-full px-3 py-1.5 text-xs font-semibold ${handDetected ? "bg-emerald-500/80" : "bg-black/60"}`}>
                {handDetected ? "✋ " + (lang.code === "es" ? "Mano OK" : "Hand OK") : (lang.code === "es" ? "Sin mano" : "No hand")}
              </div>
              <div className="rounded-full bg-black/60 px-3 py-1.5 text-xs">
                {lang.flag} {lang.name}
              </div>
            </div>

            {/* Detected letter overlay */}
            {letter && (
              <div key={letter} className="sign-pop absolute bottom-28 left-1/2 -translate-x-1/2 rounded-2xl bg-indigo-500/95 px-6 py-3 text-4xl font-extrabold text-white shadow-xl">
                {letter}
                <div className="mt-1 text-center text-[10px] font-medium opacity-80">
                  {confidence}% {t(lang.code, "detected")}
                </div>
              </div>
            )}

            {/* Current word being spelled */}
            <div className="absolute bottom-20 left-3 right-3 rounded-xl bg-black/70 px-3 py-2 text-center backdrop-blur">
              <div className="text-[10px] uppercase tracking-wider text-white/50">
                {lang.code === "es" ? "Letras detectadas" : "Detected letters"}
              </div>
              <div className="font-mono text-xl font-bold tracking-[0.3em] text-emerald-300">
                {currentWord || "—"}
              </div>
            </div>

            {/* Bottom controls */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-2">
              <button
                onClick={() => setShowSkeleton((v) => !v)}
                className={`grid h-11 w-11 place-items-center rounded-full text-white backdrop-blur active:scale-95 ${showSkeleton ? "bg-amber-500/80" : "bg-white/15"}`}
                title="Skeleton"
              >🦴</button>
              <button
                onClick={handleSwitch}
                className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur active:scale-95"
                aria-label={t(lang.code, "switchCamera")}
              >🔄</button>
              <button
                onClick={handleStop}
                className="grid h-14 w-14 place-items-center rounded-full bg-red-500 text-white shadow-lg active:scale-95"
                aria-label={t(lang.code, "stopCamera")}
              >■</button>
              <button
                onClick={backspace}
                className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur active:scale-95"
              >⌫</button>
              <button
                onClick={() => setAutoSpeak((v) => !v)}
                className={`grid h-11 w-11 place-items-center rounded-full text-white backdrop-blur active:scale-95 ${autoSpeak ? "bg-emerald-500/80" : "bg-white/15"}`}
                aria-label={t(lang.code, "voiceOn")}
              >{autoSpeak ? "🔊" : "🔇"}</button>
            </div>
          </>
        )}
      </div>

      {/* Action row */}
      {active && (
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentWord((w) => w + " ")}
            className="flex-1 rounded-xl bg-white/10 py-2 text-sm font-semibold active:scale-95"
          >␣ {lang.code === "es" ? "Espacio" : "Space"}</button>
          <button
            onClick={commitWord}
            disabled={!currentWord.trim()}
            className="flex-1 rounded-xl bg-emerald-500 py-2 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
          >✓ {lang.code === "es" ? "Añadir palabra" : "Add word"}</button>
          <button
            onClick={() => { setCurrentWord(""); stabilizerRef.current?.reset(); }}
            className="rounded-xl bg-white/10 px-3 py-2 text-sm active:scale-95"
          >✕</button>
        </div>
      )}

      {/* Transcript */}
      <div className="glass rounded-3xl p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">
            {t(lang.code, "transcript")}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => transcript && speak(transcript, lang)}
              disabled={!transcript || speaking}
              className="rounded-lg bg-indigo-500/80 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
            >🔊 {t(lang.code, "speak")}</button>
            <button
              onClick={async () => {
                if (!transcript) return;
                if (navigator.share) {
                  try { await navigator.share({ title: t(lang.code, "appName"), text: transcript }); } catch {}
                } else {
                  await navigator.clipboard.writeText(transcript);
                }
              }}
              disabled={!transcript}
              className="rounded-lg bg-white/10 px-3 py-1 text-xs disabled:opacity-40"
            >📤 {t(lang.code, "share")}</button>
            <button
              onClick={() => setTranscript("")}
              className="rounded-lg bg-white/10 px-3 py-1 text-xs"
            >{t(lang.code, "clear")}</button>
          </div>
        </div>
        <div
          dir={lang.rtl ? "rtl" : "ltr"}
          className="min-h-[80px] whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-lg leading-relaxed"
        >
          {transcript || <span className="text-white/40">…</span>}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-white/50">
          {lang.code === "es"
            ? "💡 Mantén una letra ~1 s para confirmarla. Pulsa “Espacio” entre palabras y “Añadir palabra” para enviarla al texto."
            : "💡 Hold a letter ~1 s to confirm it. Tap “Space” between words and “Add word” to commit it."}
        </p>
      </div>
    </div>
  );
}
