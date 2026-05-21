/**
 * Loads MediaPipe Hands from a CDN at runtime. Returns a singleton promise
 * resolving to the global `Hands` constructor. Avoids bundling the WASM
 * binaries with Vite (they need to be served from a known URL).
 */

declare global {
  interface Window {
    Hands?: any;
    drawConnectors?: any;
    drawLandmarks?: any;
    HAND_CONNECTIONS?: any;
  }
}

const CDN_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915";
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

let loaderPromise: Promise<any> | null = null;

export function loadMediaPipeHands(): Promise<any> {
  if (loaderPromise) return loaderPromise;
  loaderPromise = (async () => {
    await loadScript(`${CDN_BASE}/hands.js`);
    await loadScript(`${DRAW_BASE}/drawing_utils.js`);
    if (!window.Hands) throw new Error("MediaPipe Hands failed to initialize");
    const hands = new window.Hands({
      locateFile: (file: string) => `${CDN_BASE}/${file}`,
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    return hands;
  })();
  return loaderPromise;
}
