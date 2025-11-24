// src/pages/dashboard/OfferCreatePage.tsx
import { useNavigate } from "react-router-dom";
import { OfferForm } from "@/components/forms/OfferForm";
import { toast } from "sonner";

export function OfferCreatePage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl m-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Criar Novo Link de Checkout</h1>
      </div>

      <OfferForm
        onSuccess={() => {
          toast.success("Oferta criada com sucesso!");
          navigate("/offers");
        }}
      />
    </div>
  );
}
