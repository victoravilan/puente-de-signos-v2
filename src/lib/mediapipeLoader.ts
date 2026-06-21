/**
 * Loads MediaPipe Hands from a CDN at runtime. Returns a singleton promise
 * resolving to the global `Hands` constructor. Avoids bundling the WASM
 * binaries with Vite (they need to be served from a known URL).
 */

declare global {
  interface Window {
    Hands?: any;
    Holistic?: any;
    drawConnectors?: any;
    drawLandmarks?: any;
    HAND_CONNECTIONS?: any;
    HOLISTIC_CONNECTIONS?: any;
    FACEMESH_TESSELATION?: any;
  }
}

const HANDS_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915";
const HOLISTIC_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675236886";
const DRAW_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if ((existing as any)._loaded) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load " + src)));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.onload = () => { (s as any)._loaded = true; resolve(); };
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

let handsPromise: Promise<any> | null = null;
let holisticPromise: Promise<any> | null = null;

export function loadMediaPipeHands(): Promise<any> {
  if (handsPromise) return handsPromise;
  handsPromise = (async () => {
    await loadScript(`${HANDS_CDN}/hands.js`);
    await loadScript(`${DRAW_BASE}/drawing_utils.js`);
    if (!window.Hands) throw new Error("MediaPipe Hands failed to initialize");
    const hands = new window.Hands({
      locateFile: (file: string) => `${HANDS_CDN}/${file}`,
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    return hands;
  })();
  return handsPromise;
}

export function loadMediaPipeHolistic(): Promise<any> {
  if (holisticPromise) return holisticPromise;
  holisticPromise = (async () => {
    await loadScript(`${HOLISTIC_CDN}/holistic.js`);
    await loadScript(`${DRAW_BASE}/drawing_utils.js`);
    if (!window.Holistic) throw new Error("MediaPipe Holistic failed to initialize");
    const holistic = new window.Holistic({
      locateFile: (file: string) => `${HOLISTIC_CDN}/${file}`,
    });
    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    return holistic;
  })();
  return holisticPromise;
}
