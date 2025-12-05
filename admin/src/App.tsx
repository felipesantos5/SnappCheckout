// src/App.tsx
import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

import { DashboardLayout } from "./layout/DashboardLayout";
import { OffersPage } from "./pages/dashboard/OffersPage";
import { OfferCreatePage } from "./pages/dashboard/OfferCreatePage";
import { OfferEditPage } from "./pages/dashboard/OfferEditPage";
import { StripeReturnPage } from "./pages/dashboard/StripeReturnPage";
import { StripeRefreshPage } from "./pages/dashboard/StripeRefreshPage";
import { DashboardOverview } from "./pages/dashboard/DashboardOverview";
import OfferAnalyticsPage from "./pages/dashboard/OfferAnalyticsPage";
import SettingsPage from "./pages/dashboard/SettingsPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardOverview />} />
        <Route path="offers" element={<OffersPage />} />
        <Route path="offers/new" element={<OfferCreatePage />} />
        <Route path="offers/:id" element={<OfferEditPage />} />
        <Route path="offers/:id/analytics" element={<OfferAnalyticsPage />} />

        {/* 2. ADICIONE AS ROTAS DE CALLBACK DO STRIPE */}
        {/* (Elas batem com as URLs do backend stripe.controller.ts) */}
        <Route path="dashboard/stripe-return" element={<StripeReturnPage />} />
        <Route path="dashboard/stripe-refresh" element={<StripeRefreshPage />} />

        <Route path="settings" element={<SettingsPage />} />

        <Route path="*" element={<div>Página não encontrada</div>} />
      </Route>
    </Routes>
  );
}

export default App;
