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
import ABTestsPage from "./pages/dashboard/ABTestsPage";
import ABTestCreatePage from "./pages/dashboard/ABTestCreatePage";
import ABTestEditPage from "./pages/dashboard/ABTestEditPage";
import ABTestAnalyticsPage from "./pages/dashboard/ABTestAnalyticsPage";
import PaymentsPage from "./pages/dashboard/PaymentsPage";
import { AllSalesPage } from "./pages/dashboard/AllSalesPage";

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

        {/* Rotas de Testes A/B */}
        <Route path="abtests" element={<ABTestsPage />} />
        <Route path="abtests/new" element={<ABTestCreatePage />} />
        <Route path="abtests/:id" element={<ABTestEditPage />} />
        <Route path="abtests/:id/analytics" element={<ABTestAnalyticsPage />} />

        {/* Página de Pagamentos */}
        <Route path="payments" element={<PaymentsPage />} />

        {/* Página de Todas as Vendas */}
        <Route path="all-sales" element={<AllSalesPage />} />

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
