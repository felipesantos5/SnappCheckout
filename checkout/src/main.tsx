import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";

// Lazy load do Toaster para evitar problemas de inicialização circular
const Toaster = lazy(() => import("./components/ui/Toaster").then(mod => ({ default: mod.Toaster })));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
