// src/App.tsx
import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";

// Lazy load páginas não críticas
const SuccessPage = lazy(() => import("./pages/SuccessPage"));
const TestUpsellPage = lazy(() => import("./pages/TestUpsellPage"));

// CheckoutSlugPage é carregada normalmente pois é a página principal
import { CheckoutSlugPage } from "./pages/CheckoutSlugPage";

// Loading fallback simples
const PageLoader = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      fontSize: "16px",
      color: "#666",
    }}
  >
    Carregando...
  </div>
);

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/c/:slug" element={<CheckoutSlugPage />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/upsell" element={<TestUpsellPage />} />

        <Route path="/" element={<div></div>} />
        <Route
          path="*"
          element={
            <div>
              <h1>404 - Página Não Encontrada</h1>
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}

export default App;
