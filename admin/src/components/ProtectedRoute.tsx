// src/components/ProtectedRoute.tsx
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!token && !isLoading) {
    // Redireciona para o login, guardando a página que ele tentou acessar
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se tem token, renderiza a rota protegida
  return <>{children}</>;
}
