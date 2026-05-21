import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

/**
 * Detects PWA install state and exposes the install prompt.
 * - `isInstalled`: true if the app is launched in standalone (installed) mode
 *   OR if it has been installed during this session.
 * - `canInstall`: true when the browser fired `beforeinstallprompt` and the app
 *   is not yet installed (i.e. an install button should be shown).
 * - `promptInstall()`: triggers the native install dialog.
 * - `isIOS`: true on iOS Safari (which has no programmatic prompt and needs
 *   manual "Add to Home Screen" instructions).
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => detectStandalone());
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS Safari (no beforeinstallprompt support)
    const ua = window.navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(iOS);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    // Watch standalone mode in real time (covers DevTools toggles + iOS)
    const mq = window.matchMedia("(display-mode: standalone)");
    const onMQ = () => setIsInstalled(detectStandalone());

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    if (mq.addEventListener) mq.addEventListener("change", onMQ);
    else mq.addListener(onMQ);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (mq.removeEventListener) mq.removeEventListener("change", onMQ);
      else mq.removeListener(onMQ);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    return choice.outcome;
  }, [deferredPrompt]);

  // On iOS we can still "offer install" via instructions even without prompt
  // Show button proactively on all browsers that support PWA (Chrome, Edge, Samsung Internet),
  // even before beforeinstallprompt fires — it will appear once criteria are met.
  // Fallback: if no prompt after 1.5s and not iOS, still allow showing the button so user sees it.
  const [showAnyway, setShowAnyway] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowAnyway(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const canInstall = !isInstalled && (deferredPrompt !== null || isIOS || showAnyway);

  return { isInstalled, canInstall, promptInstall, isIOS };
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // PWA standalone (Android / desktop)
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari home-screen launch
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  return false;
}
