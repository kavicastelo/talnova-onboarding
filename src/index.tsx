import { initAntiTamperShield } from "./security/antiTamperShield";
import "./index.css";
import "./i18n";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { App } from "./App";
import { registerServiceWorker } from "./serviceWorkerRegistration";

// Initialize enterprise anti-tamper, domain lock & DevTools shield
initAntiTamperShield();

registerServiceWorker();

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}