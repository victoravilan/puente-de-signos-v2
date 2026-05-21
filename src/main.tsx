import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Remove Arena hosting branding (injected by arena.site)
const removeArenaBranding = () => {
  const selectors = [
    '[class*="arena"]', '[id*="arena"]',
    'a[href*="arena.site"]', 'a[href*="arena.so"]',
    'div[class*="badge"]', 'div[class*="powered"]',
    'iframe[src*="arena"]'
  ];
  
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      const text = el.textContent?.toLowerCase() || '';
      if (text.includes('arena') || text.includes('hecho con') || text.includes('made with')) {
        (el as HTMLElement).style.display = 'none';
        el.remove();
      }
    });
  });
};

// Run immediately and on mutations
removeArenaBranding();
const observer = new MutationObserver(removeArenaBranding);
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('load', () => setTimeout(removeArenaBranding, 500));
