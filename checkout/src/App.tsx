// src/App.tsx
import { Routes, Route } from "react-router-dom";
import { CheckoutSlugPage } from "./pages/CheckoutSlugPage";
import { SuccessPage } from "./pages/SuccessPage";
import { UpsellTestPage } from "./pages/UpsellTestPage";

function App() {
  return (
    <Routes>
      <Route path="/c/:slug" element={<CheckoutSlugPage />} />
      <Route path="/success" element={<SuccessPage />} />
      <Route path="/test-upsell-client" element={<UpsellTestPage />} />

      <Route
        path="/"
        element={
          <div>
            <h1>Página Inicial</h1>
            <p>Vá para /c/[seu_slug] para ver um checkout.</p>
          </div>
        }
      />
      <Route
        path="*"
        element={
          <div>
            <h1>404 - Página Não Encontrada</h1>
          </div>
        }
      />
    </Routes>
  );
}

export default App;
