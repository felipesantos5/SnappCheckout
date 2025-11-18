// src/components/ProtectedRoute.tsx
// src/components/ProtectedRoute.tsx
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    // TODO: Criar um componente de "Loading" (spinner)
    return <div>Carregando...</div>;
  }

  if (!token && !isLoading) {
    // Redireciona para o login, guardando a página que ele tentou acessar
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se tem token, renderiza a rota protegida
  return <>{children}</>;
}
