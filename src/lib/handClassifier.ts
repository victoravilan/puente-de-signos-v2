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

export interface HolisticResults {
  leftHandLandmarks?: Hand;
  rightHandLandmarks?: Hand;
  poseLandmarks?: Landmark[];
  faceLandmarks?: Landmark[];
}

export interface NonManualMarkers {
  browsRaised: boolean;
  browsFurrowed: boolean;
  mouthOpen: boolean;
  mouthO: boolean;
  leaningLeft: boolean;
  leaningRight: boolean;
}

export interface Classification {
  letter: string;
  confidence: number;
  fingers: { thumb: boolean; index: boolean; middle: boolean; ring: boolean; pinky: boolean };
  word?: string;
  nmm?: NonManualMarkers;
}

const dist = (a: Landmark, b: Landmark) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/**
 * NEW: Analyzes facial landmarks for non-manual markers (NMM)
 */
export function getNonManualMarkers(face: Landmark[], pose?: Landmark[]): NonManualMarkers {
  // Brows: indices 105 (left) and 334 (right) for inner, 70 (left) and 300 (right) for outer
  // Reference point: eye inner corners 133 (left) and 362 (right)
  const leftBrowDist = dist(face[105], face[133]);
  const rightBrowDist = dist(face[334], face[362]);
  const browsRaised = leftBrowDist > 0.04 || rightBrowDist > 0.04;

  const browCenterDist = dist(face[105], face[334]);
  const browsFurrowed = browCenterDist < 0.03;

  // Mouth: 13 (upper lip), 14 (lower lip), 78 (left corner), 308 (right corner)
  const mouthOpenDist = dist(face[13], face[14]);
  const mouthWidth = dist(face[78], face[308]);
  const mouthOpen = mouthOpenDist > 0.03;
  const mouthO = mouthWidth < 0.04 && mouthOpen;

  // Lean: Pose shoulders 11 (left), 12 (right)
  let leaningLeft = false;
  let leaningRight = false;
  if (pose && pose[11] && pose[12]) {
    const shoulderMidX = (pose[11].x + pose[12].x) / 2;
    const noseX = pose[0].x;
    const diff = noseX - shoulderMidX;
    leaningLeft = diff < -0.05;
    leaningRight = diff > 0.05;
  }

  return { browsRaised, browsFurrowed, mouthOpen, mouthO, leaningLeft, leaningRight };
}

/**
 * Rule-based classifier mapping finger configurations to LSE letters.
 */

const dist3d = (a: Landmark, b: Landmark) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

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
    wrist: hand[0]
  };
}

/**
 * Rule-based classifier mapping finger configurations to LSE letters.
 */
export function classifyHand(hand: Hand, motion?: { recentTipTrail: Landmark[] }): Classification {
  const f = getFingerState(hand);
  const ext = [f.thumb, f.index, f.middle, f.ring, f.pinky];
  const count = ext.filter(Boolean).length;

  const match = (t: boolean, i: boolean, m: boolean, r: boolean, p: boolean): number => {
    let score = 0;
    if (f.thumb === t) score++;
    if (f.index === i) score++;
    if (f.middle === m) score++;
    if (f.ring === r) score++;
    if (f.pinky === p) score++;
    return score / 5;
  };

  const candidates: Array<{ letter: string; score: number }> = [];

  // A, B, C, D, E, F, G, H, I, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y logic...
  // (Keeping existing logic for brevity in this snippet, but it's part of the file)
  candidates.push({ letter: "A", score: match(true, false, false, false, false) });
  candidates.push({ letter: "B", score: match(false, true, true, true, true) * (f.tipIndexMiddle < 0.4 ? 1 : 0.7) });
  if (f.thumb && f.tipThumbIndex > 0.6 && f.tipThumbIndex < 1.4 && f.indexCurl < 0.85) candidates.push({ letter: "C", score: 0.75 });
  if (f.index && !f.middle && !f.ring && !f.pinky && f.tipThumbMiddle < 0.5) candidates.push({ letter: "D", score: 0.85 });
  if (count === 0 && f.indexCurl > 0.85) candidates.push({ letter: "E", score: 0.7 });
  if (f.middle && f.ring && f.pinky && f.tipThumbIndex < 0.4) candidates.push({ letter: "F", score: 0.9 });
  if (f.index && !f.middle && !f.ring && !f.pinky && !f.thumb) {
    const indexVec = { x: hand[8].x - hand[5].x, y: hand[8].y - hand[5].y };
    candidates.push({ letter: Math.abs(indexVec.x) > Math.abs(indexVec.y) ? "G" : "D", score: 0.78 });
  }
  if (f.index && f.middle && !f.ring && !f.pinky && f.tipIndexMiddle < 0.35) candidates.push({ letter: "H", score: 0.7 });
  if (f.pinky && !f.index && !f.middle && !f.ring) candidates.push({ letter: "I", score: 0.92 });
  if (f.index && f.middle && !f.ring && !f.pinky && f.tipIndexMiddle > 0.4 && f.thumb) candidates.push({ letter: "K", score: 0.78 });
  if (f.thumb && f.index && !f.middle && !f.ring && !f.pinky && f.tipThumbIndex > 0.9) candidates.push({ letter: "L", score: 0.92 });
  if (count === 0 && f.indexCurl > 0.8 && f.indexCurl < 0.92) candidates.push({ letter: "M", score: 0.55 });
  if (count === 0 && f.indexCurl > 0.78 && f.indexCurl < 0.88) candidates.push({ letter: "N", score: 0.5 });
  if (!f.index && !f.middle && !f.ring && !f.pinky && f.tipThumbIndex < 0.45 && f.indexCurl < 0.9) candidates.push({ letter: "O", score: 0.7 });
  if (f.index && f.middle && !f.ring && !f.pinky && f.thumb && (hand[8].y - hand[5].y) > 0) candidates.push({ letter: "P", score: 0.7 });
  if (f.index && !f.middle && !f.ring && !f.pinky && f.thumb && (hand[8].y - hand[5].y) > 0) candidates.push({ letter: "Q", score: 0.65 });
  if (f.index && f.middle && !f.ring && !f.pinky && f.tipIndexMiddle < 0.15) candidates.push({ letter: "R", score: 0.72 });
  if (count === 0 && !f.thumb) candidates.push({ letter: "S", score: 0.7 });
  if (count === 0 && f.tipThumbIndex < 0.3 && f.tipThumbMiddle < 0.4) candidates.push({ letter: "T", score: 0.6 });
  if (f.index && f.middle && !f.ring && !f.pinky && f.tipIndexMiddle < 0.25 && !f.thumb) candidates.push({ letter: "U", score: 0.85 });
  if (f.index && f.middle && !f.ring && !f.pinky && f.tipIndexMiddle > 0.35 && !f.thumb) candidates.push({ letter: "V", score: 0.9 });
  if (f.index && f.middle && f.ring && !f.pinky) candidates.push({ letter: "W", score: 0.92 });
  if (!f.middle && !f.ring && !f.pinky && f.indexCurl > 0.7 && f.indexCurl < 0.95) candidates.push({ letter: "X", score: 0.7 });
  if (f.thumb && f.pinky && !f.index && !f.middle && !f.ring) candidates.push({ letter: "Y", score: 0.95 });

  if (motion && motion.recentTipTrail.length > 8) {
    const trail = motion.recentTipTrail;
    const dx = Math.max(...trail.map(p=>p.x)) - Math.min(...trail.map(p=>p.x));
    const dy = Math.max(...trail.map(p=>p.y)) - Math.min(...trail.map(p=>p.y));
    if (dx > 0.08 || dy > 0.08) {
      if (f.pinky && !f.index && !f.middle && !f.ring) candidates.push({ letter: "J", score: 0.88 });
      if (f.index && !f.middle && !f.ring && !f.pinky && !f.thumb) candidates.push({ letter: "Z", score: 0.85 });
      if (count === 0) candidates.push({ letter: "Ñ", score: 0.55 });
    }
  }

  if (candidates.length === 0) return { letter: "", confidence: 0, fingers: { thumb: f.thumb, index: f.index, middle: f.middle, ring: f.ring, pinky: f.pinky } };
  candidates.sort((a, b) => b.score - a.score);
  return { letter: candidates[0].letter, confidence: Math.min(0.99, candidates[0].score), fingers: { thumb: f.thumb, index: f.index, middle: f.middle, ring: f.ring, pinky: f.pinky } };
}

/**
 * NEW: Gesture Classifier for whole words (LSE)
 * This uses Holistic data to recognize movements relative to the body/face.
 */
export class GestureEngine {
  private history: HolisticResults[] = [];
  private readonly MAX_HISTORY = 30; // ~1 second of video

  push(results: HolisticResults): string | null {
    this.history.push(results);
    if (this.history.length > this.MAX_HISTORY) this.history.shift();
    if (this.history.length < 10) return null;

    // Detect Non-Manual Markers (Expression)
    const last = results;
    let suffix = "";
    if (last.faceLandmarks) {
      const nmm = getNonManualMarkers(last.faceLandmarks, last.poseLandmarks);
      if (nmm.browsRaised) suffix = "?"; // Typical for questions
    }

    const word = this.checkGracias() ||
                 this.checkHola() ||
                 this.checkSi() ||
                 this.checkNo() ||
                 this.checkNoticias() ||
                 this.checkBien() ||
                 this.checkAyuda() ||
                 this.checkTiempo() ||
                 this.checkUrgente() ||
                 this.checkPorFavor() ||
                 this.checkEntender();

    if (word) {
      this.history = [];
      return word + suffix;
    }
    return null;
  }

  private checkTiempo(): string | null {
    // TIEMPO (LSE): Right index taps left wrist.
    const last = this.history[this.history.length - 1];
    const rHand = last.rightHandLandmarks;
    const lHand = last.leftHandLandmarks;
    if (rHand && lHand) {
      const d = dist(rHand[8], lHand[0]); // Right index tip to left wrist
      if (d < 0.12) {
        const rf = getFingerState(rHand);
        if (rf.index && !rf.middle) return "TIEMPO";
      }
    }
    return null;
  }

  private checkUrgente(): string | null {
    // URGENTE (LSE): Rapid fluttering of fingers near chest.
    const trail = this.history.map(h => h.rightHandLandmarks?.[0]).filter(Boolean) as Landmark[];
    if (trail.length > 20) {
      const dx = Math.max(...trail.map(p=>p.x)) - Math.min(...trail.map(p=>p.x));
      const dy = Math.max(...trail.map(p=>p.y)) - Math.min(...trail.map(p=>p.y));
      // Look for rapid small oscillations (jitter)
      let jitter = 0;
      for(let i=1; i<trail.length; i++) jitter += dist(trail[i], trail[i-1]);
      if (jitter > 0.4 && dx < 0.2 && dy < 0.2) return "URGENTE";
    }
    return null;
  }

  private checkPorFavor(): string | null {
    // POR FAVOR (LSE): Hand flat on chest moving in circle.
    const trail = this.history.map(h => h.rightHandLandmarks?.[0]).filter(Boolean) as Landmark[];
    if (trail.length > 20) {
      const dx = Math.max(...trail.map(p=>p.x)) - Math.min(...trail.map(p=>p.x));
      const dy = Math.max(...trail.map(p=>p.y)) - Math.min(...trail.map(p=>p.y));
      if (dx > 0.1 && dy > 0.1) {
        // Simple circular check: check if it returns near start
        const dStartEnd = dist(trail[0], trail[trail.length-1]);
        if (dStartEnd < 0.1) return "POR FAVOR";
      }
    }
    return null;
  }

  private checkEntender(): string | null {
    // ENTENDER (LSE): Index finger flicking up from forehead.
    const last = this.history[this.history.length - 1];
    const first = this.history[0];
    const forehead = last.faceLandmarks?.[10];
    const indexTip = last.rightHandLandmarks?.[8];
    const startIndexTip = first.rightHandLandmarks?.[8];

    if (forehead && indexTip && startIndexTip) {
      const dStart = dist(startIndexTip, forehead);
      const moveUp = (startIndexTip.y - indexTip.y) > 0.1;
      if (dStart < 0.15 && moveUp) return "ENTENDER";
    }
    return null;
  }

  private checkBien(): string | null {
    // BIEN (LSE): Hand moves from mouth to front/center.
    const last = this.history[this.history.length - 1];
    const first = this.history[0];
    const mouth = last.faceLandmarks?.[13]; // upper lip center
    const hand = last.rightHandLandmarks?.[0]; // wrist
    const startHand = first.rightHandLandmarks?.[0];

    if (mouth && hand && startHand) {
      const dStart = dist(startHand, mouth);
      const moveForward = (hand.z - startHand.z) < -0.04;
      const rf = last.rightHandLandmarks;
      if (dStart < 0.15 && moveForward && rf) {
         const f = getFingerState(rf);
         if (f.thumb && !f.index) return "BIEN";
      }
    }
    return null;
  }

  private checkAyuda(): string | null {
    // AYUDA (LSE): Right fist rests on left open palm.
    const last = this.history[this.history.length - 1];
    const rHand = last.rightHandLandmarks;
    const lHand = last.leftHandLandmarks;
    if (rHand && lHand) {
      const d = dist(rHand[0], lHand[0]);
      if (d < 0.15) {
        const rf = getFingerState(rHand);
        const lf = getFingerState(lHand);
        if (!rf.index && lf.index && lf.middle) return "AYUDA";
      }
    }
    return null;
  }

  private checkGracias(): string | null {
    const last = this.history[this.history.length - 1];
    const first = this.history[0];
    const chinIdx = 152;
    const chin = last.faceLandmarks?.[chinIdx];
    const hand = last.rightHandLandmarks?.[0];
    const startHand = first.rightHandLandmarks?.[0];

    if (chin && hand && startHand) {
      const dStart = dist(startHand, chin);
      const moveOut = (hand.z - startHand.z) < -0.05;
      const moveDown = (hand.y - startHand.y) > 0.08;
      if (dStart < 0.2 && moveDown && moveOut) return "GRACIAS";
    }
    return null;
  }

  private checkHola(): string | null {
    const last = this.history[this.history.length - 1];
    const forehead = last.faceLandmarks?.[10];
    const hand = last.rightHandLandmarks?.[8];

    if (forehead && hand) {
      const d = dist(hand, forehead);
      const trail = this.history.map(h => h.rightHandLandmarks?.[8]).filter(Boolean) as Landmark[];
      if (trail.length > 10) {
        const dx = trail[trail.length-1].x - trail[0].x;
        if (d < 0.25 && Math.abs(dx) > 0.12) return "HOLA";
      }
    }
    return null;
  }

  private checkSi(): string | null {
    const trail = this.history.map(h => h.rightHandLandmarks?.[0]).filter(Boolean) as Landmark[];
    if (trail.length > 15) {
      const ys = trail.map(p => p.y);
      const dy = Math.max(...ys) - Math.min(...ys);
      if (dy > 0.05 && dy < 0.15) {
        let changes = 0;
        for(let i=1; i<ys.length-1; i++) {
          if ((ys[i] > ys[i-1] && ys[i] > ys[i+1]) || (ys[i] < ys[i-1] && ys[i] < ys[i+1])) changes++;
        }
        if (changes >= 2) return "SÍ";
      }
    }
    return null;
  }

  private checkNo(): string | null {
    const last = this.history[this.history.length - 1];
    const hand = last.rightHandLandmarks;
    if (hand) {
      const trail = this.history.map(h => {
        if (!h.rightHandLandmarks) return null;
        return dist(h.rightHandLandmarks[8], h.rightHandLandmarks[4]);
      }).filter(d => d !== null) as number[];

      const maxD = Math.max(...trail);
      const minD = Math.min(...trail);
      if (maxD - minD > 0.1) return "NO";
    }
    return null;
  }

  private checkNoticias(): string | null {
    const last = this.history[this.history.length - 1];
    const rHand = last.rightHandLandmarks?.[0];
    const lHand = last.leftHandLandmarks?.[0];
    if (rHand && lHand) {
      const d = dist(rHand, lHand);
      const trailR = this.history.map(h => h.rightHandLandmarks?.[0]).filter(Boolean) as Landmark[];
      if (d < 0.3 && trailR.length > 10) {
        const dx = Math.max(...trailR.map(p=>p.x)) - Math.min(...trailR.map(p=>p.x));
        const dy = Math.max(...trailR.map(p=>p.y)) - Math.min(...trailR.map(p=>p.y));
        if (dx > 0.05 && dy > 0.05) return "NOTICIAS";
      }
    }
    return null;
  }
}

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
    if (c.word) {
       this.onCommit(c.word);
       this.reset();
       return;
    }
    if (!c.letter || c.confidence < this.minConf) {
      this.idleFrames++;
      this.buffer = [];
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
