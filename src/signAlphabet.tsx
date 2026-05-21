// React import not needed with new JSX transform

/**
 * SVG hand renderer for the LSE (Spanish Sign Language) manual alphabet.
 * Each letter is described as a fingers-state config + optional motion arrow.
 * The drawing is stylized (cartoon hand) rather than anatomically accurate,
 * but each letter follows the LSE descriptions provided by the user.
 *
 *  Fingers state per finger:
 *   "ext"   -> fully extended
 *   "fold"  -> folded (curled into palm)
 *   "half"  -> half-bent
 *   "hook"  -> hooked (claw)
 *   "side"  -> extended sideways
 */

type FState = "ext" | "fold" | "half" | "hook" | "side";

export interface HandConfig {
  thumb:  FState;
  index:  FState;
  middle: FState;
  ring:   FState;
  pinky:  FState;
  rotate?: number;        // overall rotation
  motion?: "J" | "Z" | "circle" | "wave" | null;
  thumbAcross?: boolean;  // thumb crosses the palm (T, M, N)
  notes?: string;
}

const SKIN = "#f4c8a3";
const SKIN_DARK = "#d99a72";
const NAIL = "#fff1e6";

/** Configuration for every letter in LSE manual alphabet */
export const LSE_ALPHABET: Record<string, HandConfig> = {
  A: { thumb: "side", index: "fold", middle: "fold", ring: "fold", pinky: "fold" },
  B: { thumb: "fold", index: "ext",  middle: "ext",  ring: "ext",  pinky: "ext"  },
  C: { thumb: "hook", index: "hook", middle: "hook", ring: "hook", pinky: "hook" },
  D: { thumb: "hook", index: "ext",  middle: "fold", ring: "fold", pinky: "fold", notes: "Pulgar e índice forman 'O' parcial" },
  E: { thumb: "fold", index: "hook", middle: "hook", ring: "hook", pinky: "hook" },
  F: { thumb: "hook", index: "hook", middle: "ext",  ring: "ext",  pinky: "ext"  },
  G: { thumb: "fold", index: "ext",  middle: "fold", ring: "fold", pinky: "fold", rotate: 90 },
  H: { thumb: "fold", index: "ext",  middle: "ext",  ring: "fold", pinky: "fold", rotate: 90 },
  I: { thumb: "fold", index: "fold", middle: "fold", ring: "fold", pinky: "ext"  },
  J: { thumb: "fold", index: "fold", middle: "fold", ring: "fold", pinky: "ext", motion: "J" },
  K: { thumb: "ext",  index: "ext",  middle: "ext",  ring: "fold", pinky: "fold" },
  L: { thumb: "ext",  index: "ext",  middle: "fold", ring: "fold", pinky: "fold" },
  M: { thumb: "fold", index: "half", middle: "half", ring: "half", pinky: "fold", thumbAcross: true },
  N: { thumb: "fold", index: "half", middle: "half", ring: "fold", pinky: "fold", thumbAcross: true },
  Ñ: { thumb: "fold", index: "half", middle: "half", ring: "fold", pinky: "fold", thumbAcross: true, motion: "wave" },
  O: { thumb: "hook", index: "hook", middle: "hook", ring: "hook", pinky: "hook", notes: "Dedos formando círculo" },
  P: { thumb: "ext",  index: "ext",  middle: "ext",  ring: "fold", pinky: "fold", rotate: 180 },
  Q: { thumb: "hook", index: "ext",  middle: "fold", ring: "fold", pinky: "fold", rotate: 180 },
  R: { thumb: "fold", index: "ext",  middle: "ext",  ring: "fold", pinky: "fold", notes: "Índice y corazón cruzados" },
  S: { thumb: "fold", index: "fold", middle: "fold", ring: "fold", pinky: "fold" },
  T: { thumb: "ext",  index: "fold", middle: "fold", ring: "fold", pinky: "fold", thumbAcross: true },
  U: { thumb: "fold", index: "ext",  middle: "ext",  ring: "fold", pinky: "fold" },
  V: { thumb: "fold", index: "ext",  middle: "ext",  ring: "fold", pinky: "fold", notes: "Separados en V" },
  W: { thumb: "fold", index: "ext",  middle: "ext",  ring: "ext",  pinky: "fold" },
  X: { thumb: "fold", index: "hook", middle: "fold", ring: "fold", pinky: "fold" },
  Y: { thumb: "ext",  index: "fold", middle: "fold", ring: "fold", pinky: "ext"  },
  Z: { thumb: "fold", index: "ext",  middle: "fold", ring: "fold", pinky: "fold", motion: "Z" },
};

/* --------- Drawing helpers --------- */

interface FingerProps {
  x: number; y: number;          // base position
  length: number;                 // base length
  width: number;                  // base width
  state: FState;
  angle?: number;                 // base direction (degrees, 0 = up)
  isThumb?: boolean;
  thumbAcross?: boolean;
}

function Finger({ x, y, length, width, state, angle = 0, isThumb, thumbAcross }: FingerProps) {
  // Determine geometry
  let l = length;
  let bend1 = 0;  // first joint bend
  let bend2 = 0;  // second joint bend
  let extra = 0;  // overall offset away from palm

  switch (state) {
    case "ext":  bend1 = 0;  bend2 = 0;   l = length; break;
    case "fold": bend1 = 75; bend2 = 80;  l = length * 0.55; break;
    case "half": bend1 = 45; bend2 = 30;  l = length * 0.78; break;
    case "hook": bend1 = 30; bend2 = 55;  l = length * 0.85; break;
    case "side": bend1 = 0;  bend2 = 0;   l = length; extra = 0; break;
  }

  // For thumb crossing palm
  let extraRotate = 0;
  if (isThumb && thumbAcross) extraRotate = -30;

  return (
    <g transform={`translate(${x} ${y}) rotate(${angle + extraRotate})`}>
      {/* Lower segment */}
      <rect
        x={-width / 2}
        y={-l * 0.5}
        width={width}
        height={l * 0.5}
        rx={width / 2}
        fill={SKIN}
        stroke={SKIN_DARK}
        strokeWidth={1.4}
      />
      {/* Upper segment with bend */}
      <g transform={`translate(0 ${-l * 0.5}) rotate(${-bend1})`}>
        <rect
          x={-width / 2}
          y={-l * 0.5}
          width={width}
          height={l * 0.5}
          rx={width / 2}
          fill={SKIN}
          stroke={SKIN_DARK}
          strokeWidth={1.4}
        />
        {/* Tip with second bend (nail) */}
        <g transform={`translate(0 ${-l * 0.5}) rotate(${-bend2})`}>
          <ellipse cx={0} cy={-width * 0.2} rx={width * 0.55} ry={width * 0.45} fill={NAIL} stroke={SKIN_DARK} strokeWidth={1} />
        </g>
      </g>
      {extra ? null : null}
    </g>
  );
}

interface SignHandProps {
  letter: string;
  size?: number;
  showLabel?: boolean;
  className?: string;
  active?: boolean;   // adds glow
}

export function SignHand({ letter, size = 220, showLabel = true, className, active }: SignHandProps) {
  const upper = letter.toUpperCase();
  const cfg = LSE_ALPHABET[upper];

  if (!cfg) {
    // unknown letter (digit, space, punctuation) – show character bubble
    return (
      <div
        className={className}
        style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      >
        <div
          className="glass rounded-3xl flex items-center justify-center text-4xl font-bold text-white/90"
          style={{ width: size * 0.8, height: size * 0.8 }}
        >
          {letter === " " ? "␣" : letter}
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 220 240"
        width="100%"
        height="100%"
        style={{ filter: active ? "drop-shadow(0 0 14px rgba(99,102,241,.55))" : "drop-shadow(0 6px 14px rgba(0,0,0,.35))" }}
      >
        {/* Background plate */}
        <defs>
          <radialGradient id="bgGrad" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0b1226" />
          </radialGradient>
          <linearGradient id="palmGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fcd6b3" />
            <stop offset="100%" stopColor="#e9a877" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="212" height="232" rx="22" fill="url(#bgGrad)" />

        <g transform={`translate(110 140) rotate(${cfg.rotate ?? 0})`}>
          {/* Wrist */}
          <rect x={-26} y={50} width={52} height={36} rx={10} fill={SKIN} stroke={SKIN_DARK} strokeWidth={1.5} />
          <rect x={-26} y={70} width={52} height={6} fill={SKIN_DARK} opacity={0.35} />
          {/* Palm */}
          <path
            d="M -42 50 Q -50 -10 -28 -40 Q 0 -55 28 -40 Q 50 -10 42 50 Z"
            fill="url(#palmGrad)"
            stroke={SKIN_DARK}
            strokeWidth={1.8}
          />
          {/* Fingers (positions along palm top) */}
          <Finger x={-26} y={-30} length={70} width={14} state={cfg.index}  angle={-8} />
          <Finger x={-8}  y={-40} length={78} width={14} state={cfg.middle} angle={-2} />
          <Finger x={11}  y={-38} length={72} width={14} state={cfg.ring}   angle={4}  />
          <Finger x={28}  y={-28} length={60} width={13} state={cfg.pinky}  angle={12} />
          {/* Thumb (side) */}
          <Finger
            x={-38} y={20}
            length={52} width={16}
            state={cfg.thumb}
            angle={-70}
            isThumb
            thumbAcross={cfg.thumbAcross}
          />
        </g>

        {/* Motion arrows */}
        {cfg.motion === "J" && (
          <path d="M150 70 Q 180 100 160 140 Q 140 170 110 165" stroke="#a5b4fc" strokeWidth="3" fill="none" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="0.8s" repeatCount="indefinite" />
          </path>
        )}
        {cfg.motion === "Z" && (
          <path d="M50 60 L 170 60 L 50 120 L 170 120" stroke="#a5b4fc" strokeWidth="3" fill="none" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="0.8s" repeatCount="indefinite" />
          </path>
        )}
        {cfg.motion === "wave" && (
          <path d="M50 60 Q 80 40 110 60 T 170 60" stroke="#a5b4fc" strokeWidth="3" fill="none">
            <animate attributeName="d"
              values="M50 60 Q 80 40 110 60 T 170 60;
                      M50 60 Q 80 80 110 60 T 170 60;
                      M50 60 Q 80 40 110 60 T 170 60"
              dur="1.4s" repeatCount="indefinite" />
          </path>
        )}

        {showLabel && (
          <g>
            <rect x="14" y="14" width="42" height="32" rx="10" fill="rgba(99,102,241,0.85)" />
            <text x="35" y="36" textAnchor="middle" fontSize="20" fontWeight="800" fill="white" fontFamily="ui-sans-serif, system-ui">
              {upper}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

/* Tokenize a sentence into "letters" usable by the hand renderer.
   We strip diacritics for non-LSE letters but keep Ñ. */
export function toSignTokens(text: string): string[] {
  // Normalize: keep Ñ, remove other accents
  const normalized = text
    .replace(/[áàäâ]/gi, (m) => (m === m.toUpperCase() ? "A" : "a"))
    .replace(/[éèëê]/gi, (m) => (m === m.toUpperCase() ? "E" : "e"))
    .replace(/[íìïî]/gi, (m) => (m === m.toUpperCase() ? "I" : "i"))
    .replace(/[óòöô]/gi, (m) => (m === m.toUpperCase() ? "O" : "o"))
    .replace(/[úùüû]/gi, (m) => (m === m.toUpperCase() ? "U" : "u"));
  return Array.from(normalized.toUpperCase());
}
