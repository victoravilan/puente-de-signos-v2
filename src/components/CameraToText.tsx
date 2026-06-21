import { useCallback, useEffect, useRef, useState } from "react";
import type { LangDef } from "../i18n";
import { t } from "../i18n";
import { useTTS } from "../hooks/useSpeech";
import { loadMediaPipeHolistic } from "../lib/mediapipeLoader";
import {
  classifyHand,
  GestureEngine,
  LetterStabilizer,
  getNonManualMarkers,
  type Landmark,
  type HolisticResults,
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
  const holisticRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const tipTrailRef = useRef<Landmark[]>([]);
  const stabilizerRef = useRef<LetterStabilizer | null>(null);
  const gestureEngineRef = useRef<GestureEngine>(new GestureEngine());

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [letter, setLetter] = useState<string>("");
  const [expression, setExpression] = useState<string>("");
  const [confidence, setConfidence] = useState(0);
  const [transcriptWords, setTranscriptWords] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState<string>("");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [handDetected, setHandDetected] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);

  const { speak, speaking } = useTTS();

  const transcript = transcriptWords.join(" ");

  const facingRef = useRef(facing);
  const showSkeletonRef = useRef(showSkeleton);
  useEffect(() => { facingRef.current = facing; }, [facing]);
  useEffect(() => { showSkeletonRef.current = showSkeleton; }, [showSkeleton]);

  /* ------------------------------------------------------------------ */
  /* Holistic results processing                                        */
  /* ------------------------------------------------------------------ */
  const onResults = useCallback((results: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    if (facingRef.current === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    // DRAWING
    if (showSkeletonRef.current && window.drawConnectors && window.drawLandmarks) {
      // Draw Pose
      if (results.poseLandmarks) {
        window.drawConnectors(ctx, results.poseLandmarks, [
          [11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24]
        ], { color: "#ffffff50", lineWidth: 2 });
      }
      // Draw Hands
      if (results.rightHandLandmarks) {
        window.drawConnectors(ctx, results.rightHandLandmarks, window.HAND_CONNECTIONS, { color: "#fbbf24", lineWidth: 3 });
        window.drawLandmarks(ctx, results.rightHandLandmarks, { color: "#fbbf24", radius: 2 });
      }
      if (results.leftHandLandmarks) {
        window.drawConnectors(ctx, results.leftHandLandmarks, window.HAND_CONNECTIONS, { color: "#a5b4fc", lineWidth: 3 });
        window.drawLandmarks(ctx, results.leftHandLandmarks, { color: "#a5b4fc", radius: 2 });
      }
      // Draw Face (simplified)
      if (results.faceLandmarks) {
        // Draw lips and eyes only for brevity/performance
        const lips = [61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95,185,40,39,37,0,267,269,270,409,291];
        lips.forEach(idx => {
            const p = results.faceLandmarks[idx];
            ctx.fillStyle = "#ff000050";
            ctx.beginPath();
            ctx.arc(p.x * w, p.y * h, 1, 0, 2*Math.PI);
            ctx.fill();
        });
      }
    }

    // GESTURE & LETTER CLASSIFICATION
    const rightHand = results.rightHandLandmarks as Landmark[] | undefined;
    const holisticData: HolisticResults = {
      rightHandLandmarks: rightHand,
      leftHandLandmarks: results.leftHandLandmarks,
      poseLandmarks: results.poseLandmarks,
      faceLandmarks: results.faceLandmarks
    };

    // 0. Update facial expression status
    if (results.faceLandmarks) {
       const nmm = getNonManualMarkers(results.faceLandmarks, results.poseLandmarks);
       if (nmm.browsRaised) setExpression(lang.code === "es" ? "Pregunta" : "Question");
       else if (nmm.browsFurrowed) setExpression(lang.code === "es" ? "Concentrado" : "Focused");
       else if (nmm.mouthO) setExpression(lang.code === "es" ? "Sorpresa" : "Surprise");
       else setExpression("");
    }

    // 1. Check for whole words first
    const detectedWord = gestureEngineRef.current.push(holisticData);
    if (detectedWord) {
      const translated = t(lang.code, detectedWord);
      setTranscriptWords(prev => [...prev, translated]);
      if (autoSpeak) speak(translated, lang, 1);

      // Visual feedback for word detection
      setLetter("✨ " + translated);
      setConfidence(100);

      // Reset current word spelling to avoid mixing
      setCurrentWord("");
      stabilizerRef.current?.reset();

      // Trigger a small haptic feedback if available (Android/PWA)
      if (navigator.vibrate) navigator.vibrate(50);
    }

    // 2. Otherwise fallback to letter classification
    else if (rightHand) {
      setHandDetected(true);
      const tip = rightHand[8];
      tipTrailRef.current.push({ x: tip.x, y: tip.y, z: tip.z });
      if (tipTrailRef.current.length > 15) tipTrailRef.current.shift();

      const cls = classifyHand(rightHand, { recentTipTrail: tipTrailRef.current });
      setLetter(cls.letter);
      setConfidence(Math.round(cls.confidence * 100));
      stabilizerRef.current?.push(cls);
    } else {
      setHandDetected(false);
      if (!detectedWord) setLetter("");
      setConfidence(0);
      tipTrailRef.current = [];
      stabilizerRef.current?.push({
        letter: "", confidence: 0,
        fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
      });
    }
    ctx.restore();
  }, [lang, autoSpeak, speak]);

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
      const holistic = await loadMediaPipeHolistic();
      holistic.onResults(onResults);
      holisticRef.current = holistic;

      stopStream();

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: which }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
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

      const sendLoop = async () => {
        if (!streamRef.current || !holisticRef.current || !videoRef.current) return;
        if (videoRef.current.readyState >= 2) {
          try {
            await holisticRef.current.send({ image: videoRef.current });
          } catch { /* ignore */ }
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
  }, [lang.code, onResults, stopStream]);

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

  useEffect(() => {
    stabilizerRef.current = new LetterStabilizer(8, 0.55, (ltr) => {
      setCurrentWord((prev) => prev + ltr);
    });
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const commitWord = () => {
    const w = currentWord.trim();
    if (!w) return;
    setTranscriptWords((prev) => [...prev, w]);
    onTranscript?.(w);
    if (autoSpeak) speak(w, lang, 1);
    setCurrentWord("");
    stabilizerRef.current?.reset();
  };

  const backspace = () => setCurrentWord((w) => w.slice(0, -1));

  return (
    <div className="flex flex-col gap-4">
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

      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-black shadow-2xl ring-1 ring-white/10">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover opacity-90"
          style={{ transform: facing === "user" ? "scaleX(-1)" : "none" }}
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />

        {/* Scanning Effect */}
        {active && (
           <div className="pointer-events-none absolute inset-x-0 h-1 bg-indigo-500/50 blur-[2px] shadow-[0_0_15px_rgba(99,102,241,0.8)] animate-scan" />
        )}

        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-slate-900/80 to-slate-950 p-6 text-center">
            <div className="text-6xl">🤟</div>
            <div className="max-w-xs text-sm text-white/80">{t(lang.code, "handGuide")}</div>
            {status === "loading" && (
              <div className="flex items-center gap-2 text-indigo-300">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent" />
                <span className="text-xs">Cargando IA de Cuerpo Completo…</span>
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
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className={`h-[85%] w-[85%] rounded-3xl border-2 border-dashed transition-colors ${handDetected ? "border-emerald-400/80" : "border-indigo-300/50"}`} />
            </div>

            <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
              <div className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs">
                <span className="pulse-dot inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="font-bold tracking-wider">LIVE</span>
              </div>
              <div className={`rounded-full px-3 py-1.5 text-xs font-semibold ${handDetected ? "bg-emerald-500/80" : "bg-black/60"}`}>
                {handDetected ? "✋ OK" : (lang.code === "es" ? "Busca manos/cara" : "Seeking hand/face")}
              </div>
              {expression && (
                <div className="animate-bounce rounded-full bg-fuchsia-500/90 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                  {expression}
                </div>
              )}
            </div>

            {letter && (
              <div key={letter} className={`sign-pop absolute bottom-28 left-1/2 -translate-x-1/2 rounded-2xl px-6 py-3 text-4xl font-extrabold text-white shadow-xl ${letter.includes("✨") ? "bg-fuchsia-600 ring-2 ring-fuchsia-300" : "bg-indigo-500/95"}`}>
                {letter}
                <div className="mt-1 text-center text-[10px] font-medium opacity-80">
                  {confidence}% {t(lang.code, "detected")}
                </div>
              </div>
            )}

            <div className="absolute bottom-20 left-3 right-3 rounded-xl bg-black/70 px-3 py-2 text-center backdrop-blur">
              <div className="font-mono text-xl font-bold tracking-[0.3em] text-emerald-300">
                {currentWord || "—"}
              </div>
            </div>

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-2">
              <button
                onClick={() => setShowSkeleton((v) => !v)}
                className={`grid h-11 w-11 place-items-center rounded-full text-white backdrop-blur active:scale-95 ${showSkeleton ? "bg-amber-500/80" : "bg-white/15"}`}
              >🦴</button>
              <button
                onClick={handleSwitch}
                className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur active:scale-95"
              >🔄</button>
              <button
                onClick={handleStop}
                className="grid h-14 w-14 place-items-center rounded-full bg-red-500 text-white shadow-lg active:scale-95"
              >■</button>
              <button
                onClick={backspace}
                className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur active:scale-95"
              >⌫</button>
              <button
                onClick={() => setAutoSpeak((v) => !v)}
                className={`grid h-11 w-11 place-items-center rounded-full text-white backdrop-blur active:scale-95 ${autoSpeak ? "bg-emerald-500/80" : "bg-white/15"}`}
              >{autoSpeak ? "🔊" : "🔇"}</button>
            </div>
          </>
        )}
      </div>

      {active && (
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentWord((w) => w + " ")}
            className="flex-1 rounded-xl bg-white/10 py-2 text-sm font-semibold active:scale-95"
          >␣ Espacio</button>
          <button
            onClick={commitWord}
            disabled={!currentWord.trim()}
            className="flex-1 rounded-xl bg-emerald-500 py-2 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
          >✓ Palabra</button>
        </div>
      )}

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
            >🔊</button>
            <button
              onClick={() => setTranscriptWords([])}
              className="rounded-lg bg-white/10 px-3 py-1 text-xs"
            >🗑️</button>
          </div>
        </div>
        <div
          dir={lang.rtl ? "rtl" : "ltr"}
          className="flex min-h-[100px] flex-wrap gap-2 rounded-2xl bg-black/30 p-3"
        >
          {transcriptWords.length > 0 ? (
            transcriptWords.map((w, i) => (
              <span key={i} className="animate-signPop rounded-xl bg-indigo-500/20 px-3 py-1 text-sm font-medium text-indigo-200 ring-1 ring-indigo-400/30">
                {w}
              </span>
            ))
          ) : (
            <span className="text-sm italic text-white/30">Esperando traducción…</span>
          )}
        </div>
      </div>
    </div>
  );
}
