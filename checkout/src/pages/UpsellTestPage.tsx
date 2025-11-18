import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { API_URL } from "../config/BackendUrl";

export const UpsellTestPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  // Pega o token da URL (ex: ?token=uuid-...)
  const token = searchParams.get("token");

  // CONFIGURAÇÃO DO TESTE
  // Você precisa criar uma oferta no seu banco com este slug e preço de R$ 1,00
  const UPSELL_SLUG_TESTE = "upsell-teste-1real";

  const handleOneClickBuy = async () => {
    if (!token) {
      setMessage("Token não encontrado na URL.");
      setStatus("error");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/payments/one-click-upsell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token, // O token seguro que veio da URL
          upsellSlug: UPSELL_SLUG_TESTE, // O produto que estamos comprando agora
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus("success");
        setMessage("Compra de Upsell Aprovada com Sucesso! (R$ 1,00)");

        // Opcional: Redirecionar para uma página de obrigado final após 2 segundos
        setTimeout(() => {
          navigate("/success?offerName=Upsell Teste");
        }, 2000);
      } else {
        setStatus("error");
        setMessage(data.message || "Falha no pagamento.");
      }
    } catch (error: any) {
      setStatus("error");
      setMessage("Erro de conexão: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4 text-gray-800">Página do Cliente (Teste)</h1>
        <p className="text-gray-600 mb-6">
          Esta página simula o site externo do seu cliente.
          <br />
          Oferta exclusiva por apenas <strong>R$ 1,00</strong>.
        </p>

        {!token && (
          <div className="bg-yellow-100 text-yellow-800 p-3 rounded mb-4 text-sm">
            ⚠️ Nenhum token detectado. Realize uma compra no checkout principal primeiro.
          </div>
        )}

        {status === "success" ? (
          <div className="bg-green-100 text-green-700 p-4 rounded-lg mb-4">✅ {message}</div>
        ) : (
          <>
            {status === "error" && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">❌ {message}</div>}

            <button
              id="btn-upsell-buy"
              onClick={handleOneClickBuy}
              disabled={loading || !token}
              className={`w-full py-3 px-4 rounded-lg text-white font-bold text-lg transition-all 
                ${loading || !token ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl"}`}
            >
              {loading ? "Processando..." : "Comprar com 1 Clique (R$ 1,00)"}
            </button>

            <p className="mt-4 text-xs text-gray-400">Ao clicar, usaremos o cartão salvo na compra anterior.</p>
          </>
        )}
      </div>
    </div>
  );
};
