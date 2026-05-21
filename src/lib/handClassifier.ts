/**
 * Sign-language letter classifier based on MediaPipe Hands landmarks.
 *
 * MediaPipe returns 21 landmarks per hand (x, y, z normalized to image).
 * Indices:
 *   0  = wrist
 *   1-4   = thumb (CMC, MCP, IP, TIP)
 *   5-8   = index (MCP, PIP, DIP, TIP)
 *   9-12  = middle
 *   13-16 = ring
 *   17-20 = pinky
 *
 * We compute geometric features (which fingers are extended, thumb position,
 * relative finger tip distances) and apply rule-based heuristics that map to
 * the LSE one-handed dactylological alphabet described in the brief.
 *
 * This is intentionally rule-based (not ML) so it is fully offline, fast,
 * and explainable. Accuracy is best for static letters; J, Z and Ñ require
 * motion which we approximate by tracking tip trajectories over time.
 */

export interface Landmark { x: number; y: number; z: number; }
export type Hand = Landmark[]; // length 21

export interface Classification {
  letter: string;
  confidence: number; // 0..1
  fingers: { thumb: boolean; index: boolean; middle: boolean; ring: boolean; pinky: boolean };
}

const dist = (a: Landmark, b: Landmark) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Returns true if a finger is "extended" (tip is far from MCP relative to PIP). */
function fingerExtended(hand: Hand, mcp: number, pip: number, tip: number): boolean {
  const dMcpTip = dist(hand[mcp], hand[tip]);
  const dMcpPip = dist(hand[mcp], hand[pip]);
  return dMcpTip > dMcpPip * 1.5;
}

/** Thumb extended: tip is far from index MCP (sideways) */
function thumbExtended(hand: Hand): boolean {
  return dist(hand[4], hand[5]) > dist(hand[2], hand[5]) * 1.15;
}

/** Compute set of extended fingers + extra geometry. */
export function getFingerState(hand: Hand) {
  const index = fingerExtended(hand, 5, 6, 8);
  const middle = fingerExtended(hand, 9, 10, 12);
  const ring = fingerExtended(hand, 13, 14, 16);
  const pinky = fingerExtended(hand, 17, 18, 20);
  const thumb = thumbExtended(hand);

  // Hand size for normalization
  const handSize = dist(hand[0], hand[9]) || 0.0001;

  // Useful relative distances
  const tipThumbIndex = dist(hand[4], hand[8]) / handSize;
  const tipThumbMiddle = dist(hand[4], hand[12]) / handSize;
  const tipIndexMiddle = dist(hand[8], hand[12]) / handSize;

  // Index curvature (for X – curled hook)
  const indexCurl =
    dist(hand[5], hand[8]) / (dist(hand[5], hand[6]) + dist(hand[6], hand[7]) + dist(hand[7], hand[8]));

  return {
    thumb, index, middle, ring, pinky,
    tipThumbIndex, tipThumbMiddle, tipIndexMiddle,
    indexCurl,
    handSize,
  };
}

/**
 * Rule-based classifier mapping finger configurations to LSE letters.
 * Returns best match with a confidence score.
 */
export function classifyHand(hand: Hand, motion?: { recentTipTrail: Landmark[] }): Classification {
  const f = getFingerState(hand);
  const ext = [f.thumb, f.index, f.middle, f.ring, f.pinky];
  const count = ext.filter(Boolean).length;

  // Helper – does hand match a given finger pattern?
  const match = (t: boolean, i: boolean, m: boolean, r: boolean, p: boolean): number => {
    let score = 0;
    if (f.thumb === t) score++;
    if (f.index === i) score++;
    if (f.middle === m) score++;
    if (f.ring === r) score++;
    if (f.pinky === p) score++;
    return score / 5;
  };

  // Candidate letters – tuples (letter, base score, modifier)
  const candidates: Array<{ letter: string; score: number }> = [];

  // A : closed fist, thumb out (to the side)
  candidates.push({ letter: "A", score: match(true, false, false, false, false) });

  // B : flat hand, all 4 fingers extended together, thumb folded across palm
  candidates.push({ letter: "B", score: match(false, true, true, true, true) * (f.tipIndexMiddle < 0.4 ? 1 : 0.7) });

  // C : curved hand "C" shape – fingers slightly bent, thumb apart
  // Approx: thumb extended + index/middle slightly curled + thumb-index gap moderate
  if (f.thumb && f.tipThumbIndex > 0.6 && f.tipThumbIndex < 1.4 && f.indexCurl < 0.85) {
    candidates.push({ letter: "C", score: 0.75 });
  }

  // D : index up, thumb+middle form circle (others down)
  if (f.index && !f.middle && !f.ring && !f.pinky && f.tipThumbMiddle < 0.5) {
    candidates.push({ letter: "D", score: 0.85 });
  }

  // E : all fingers curled into palm, thumb across – almost closed
  if (count === 0 && f.indexCurl > 0.85) {
    candidates.push({ letter: "E", score: 0.7 });
  }

  // F : thumb+index circle, other 3 fingers extended
  if (f.middle && f.ring && f.pinky && f.tipThumbIndex < 0.4) {
    candidates.push({ letter: "F", score: 0.9 });
  }

  // G : fist with index pointing sideways (horizontal)
  if (f.index && !f.middle && !f.ring && !f.pinky && !f.thumb) {
    // Distinguish from D: G is horizontal – check index direction
    const indexVec = { x: hand[8].x - hand[5].x, y: hand[8].y - hand[5].y };
    const horizontal = Math.abs(indexVec.x) > Math.abs(indexVec.y);
    candidates.push({ letter: horizontal ? "G" : "D", score: 0.78 });
  }

  // H : index + middle extended together, horizontal
  if (f.index && f.middle && !f.ring && !f.pinky && f.tipIndexMiddle < 0.35) {
    candidates.push({ letter: "H", score: 0.7 });
  }

  // I : only pinky extended
  if (f.pinky && !f.index && !f.middle && !f.ring) {
    candidates.push({ letter: "I", score: 0.92 });
  }

  // K : index + middle in V, thumb at base between them
  if (f.index && f.middle && !f.ring && !f.pinky && f.tipIndexMiddle > 0.4 && f.thumb) {
    candidates.push({ letter: "K", score: 0.78 });
  }

  // L : thumb + index at right angle
  if (f.thumb && f.index && !f.middle && !f.ring && !f.pinky && f.tipThumbIndex > 0.9) {
    candidates.push({ letter: "L", score: 0.92 });
  }

  // M : fist, thumb under three fingers (3 fingers over thumb) – approximate as closed hand
  if (count === 0 && f.indexCurl > 0.8 && f.indexCurl < 0.92) {
    candidates.push({ letter: "M", score: 0.55 });
  }

  // N : like M but two fingers (very hard to distinguish without depth)
  if (count === 0 && f.indexCurl > 0.78 && f.indexCurl < 0.88) {
    candidates.push({ letter: "N", score: 0.5 });
  }

  // O : fingers and thumb form circle
  if (!f.index && !f.middle && !f.ring && !f.pinky && f.tipThumbIndex < 0.45 && f.indexCurl < 0.9) {
    candidates.push({ letter: "O", score: 0.7 });
  }

  // P : like K but pointing down
  if (f.index && f.middle && !f.ring && !f.pinky && f.thumb) {
    const indexVec = hand[8].y - hand[5].y;
    if (indexVec > 0) candidates.push({ letter: "P", score: 0.7 });
  }

  // Q : like G but pointing down
  if (f.index && !f.middle && !f.ring && !f.pinky && f.thumb) {
    const indexVec = hand[8].y - hand[5].y;
    if (indexVec > 0) candidates.push({ letter: "Q", score: 0.65 });
  }

  // R : index + middle crossed
  if (f.index && f.middle && !f.ring && !f.pinky && f.tipIndexMiddle < 0.15) {
    candidates.push({ letter: "R", score: 0.72 });
  }

  // S : closed fist, thumb in front
  if (count === 0 && !f.thumb) {
    candidates.push({ letter: "S", score: 0.7 });
  }

  // T : thumb between index and middle (fist)
  if (count === 0 && f.tipThumbIndex < 0.3 && f.tipThumbMiddle < 0.4) {
    candidates.push({ letter: "T", score: 0.6 });
  }

  // U : index + middle together, extended up
  if (f.index && f.middle && !f.ring && !f.pinky && f.tipIndexMiddle < 0.25 && !f.thumb) {
    candidates.push({ letter: "U", score: 0.85 });
  }

  // V : index + middle separated
  if (f.index && f.middle && !f.ring && !f.pinky && f.tipIndexMiddle > 0.35 && !f.thumb) {
    candidates.push({ letter: "V", score: 0.9 });
  }

  // W : index + middle + ring extended, separated
  if (f.index && f.middle && f.ring && !f.pinky) {
    candidates.push({ letter: "W", score: 0.92 });
  }

  // X : index curled (hook), rest closed
  if (!f.middle && !f.ring && !f.pinky && f.indexCurl > 0.7 && f.indexCurl < 0.95) {
    candidates.push({ letter: "X", score: 0.7 });
  }

  // Y : thumb + pinky extended (phone shape)
  if (f.thumb && f.pinky && !f.index && !f.middle && !f.ring) {
    candidates.push({ letter: "Y", score: 0.95 });
  }

  // Motion-based: J (drawing J with pinky), Z (drawing Z with index)
  if (motion && motion.recentTipTrail.length > 8) {
    const trail = motion.recentTipTrail;
    const xs = trail.map(p => p.x);
    const ys = trail.map(p => p.y);
    const dx = Math.max(...xs) - Math.min(...xs);
    const dy = Math.max(...ys) - Math.min(...ys);
    const moving = dx > 0.08 || dy > 0.08;

    if (moving) {
      // J : pinky-only and movement
      if (f.pinky && !f.index && !f.middle && !f.ring) {
        candidates.push({ letter: "J", score: 0.88 });
      }
      // Z : index-only and movement
      if (f.index && !f.middle && !f.ring && !f.pinky && !f.thumb) {
        candidates.push({ letter: "Z", score: 0.85 });
      }
      // Ñ : like N + small movement
      if (count === 0) {
        candidates.push({ letter: "Ñ", score: 0.55 });
      }
    }
  }

  if (candidates.length === 0) {
    return {
      letter: "",
      confidence: 0,
      fingers: { thumb: f.thumb, index: f.index, middle: f.middle, ring: f.ring, pinky: f.pinky },
    };
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return {
    letter: best.letter,
    confidence: Math.min(0.99, best.score),
    fingers: { thumb: f.thumb, index: f.index, middle: f.middle, ring: f.ring, pinky: f.pinky },
  };
}

/**
 * Smooths a stream of letter classifications: only commits a letter when
 * the same letter has been observed for `minFrames` consecutive frames
 * with confidence above `minConf`. Calls onCommit once per stable letter,
 * and prevents repeats unless the hand "resets" (no detection) in between.
 */
export class LetterStabilizer {
  private buffer: string[] = [];
  private lastCommitted: string = "";
  private idleFrames = 0;
  constructor(
    private minFrames = 8,
    private minConf = 0.6,
    private onCommit: (letter: string) => void = () => {},
  ) {}

  push(c: Classification) {
    if (!c.letter || c.confidence < this.minConf) {
      this.idleFrames++;
      this.buffer = [];
      // After ~12 idle frames, allow same letter to repeat
      if (this.idleFrames > 12) this.lastCommitted = "";
      return;
    }
    this.idleFrames = 0;
    this.buffer.push(c.letter);
    if (this.buffer.length > this.minFrames) this.buffer.shift();
    if (this.buffer.length === this.minFrames) {
      const allSame = this.buffer.every(l => l === c.letter);
      if (allSame && c.letter !== this.lastCommitted) {
        this.lastCommitted = c.letter;
        this.onCommit(c.letter);
      }
    }
  }

  reset() {
    this.buffer = [];
    this.lastCommitted = "";
    this.idleFrames = 0;
  }
}
