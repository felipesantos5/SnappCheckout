// src/pages/dashboard/StripeRefreshPage.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function StripeRefreshPage() {
  const navigate = useNavigate();

  useEffect(() => {
    toast.error("O link de conexão expirou.", {
      description: "Por favor, tente novamente.",
    });
    // Redireciona imediatamente de volta
    navigate("/");
  }, [navigate]);

  return (
    <div className="flex items-center justify-center pt-10">
      <p>O link expirou. Redirecionando...</p>
    </div>
  );
}
