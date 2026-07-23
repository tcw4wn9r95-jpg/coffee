import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./theme/global.css";

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Hold the splash for at least 1.5s from first paint, then fade it out.
(function dismissSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  const MIN = 1500;
  const start = (window as unknown as { __brunaStart?: number }).__brunaStart ?? Date.now();
  const wait = Math.max(0, MIN - (Date.now() - start));
  window.setTimeout(() => {
    splash.classList.add("hide");
    window.setTimeout(() => splash.remove(), 500);
  }, wait);
})();
