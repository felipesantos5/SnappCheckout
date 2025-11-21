// src/pages/TestUpsellPage.tsx
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_URL } from "../config/BackendUrl";

export const TestUpsellPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"waiting" | "processing" | "success" | "error">("waiting");
  const [message, setMessage] = useState("");

  // --- SIMULAÇÃO DO SCRIPT DO CLIENTE ---
  const handleUpsellAction = async (isBuy: boolean) => {
    if (!token) {
      alert("Erro: Token de sessão não encontrado na URL.");
      return;
    }

    setStatus("processing");

    try {
      const endpoint = isBuy ? "one-click-upsell" : "upsell-refuse";

      // Chamada direta à API (igual ao script)
      const res = await fetch(`${API_URL}/payments/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus("success");
        if (data.redirectUrl) {
          setMessage(`Sucesso! Redirecionando para: ${data.redirectUrl}`);
          // Em produção, o script faria: window.location.href = data.redirectUrl;
          setTimeout(() => {
            window.location.href = data.redirectUrl;
          }, 2000);
        } else {
          setMessage(data.message || "Ação concluída (Sem URL de redirecionamento configurada).");
        }
      } else {
        setStatus("error");
        setMessage(data.message || "Erro ao processar.");
      }
    } catch (error: any) {
      setStatus("error");
      setMessage("Erro de conexão com a API.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8 text-center border border-gray-200">
        <div className="mb-6">
          <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
            Ambiente de Teste de Integração
          </span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">Espere! Oferta Especial (Upsell)</h1>
        <p className="text-gray-600 mb-8 text-lg">
          Esta página simula o site do seu cliente. O token recebido foi:
          <br />
          <code className="bg-gray-100 px-2 py-1 rounded text-sm text-blue-600 break-all mt-2 block">
            {token || "Nenhum token encontrado na URL"}
          </code>
        </p>

        {/* --- ÁREA QUE SIMULA O SCRIPT INJETADO --- */}
        <div className="space-y-4 p-6 bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <p className="text-sm text-slate-500 font-mono mb-4">Simulação dos Botões do Script:</p>

          <button
            onClick={() => handleUpsellAction(true)}
            disabled={status === "processing" || !token}
            className="w-full max-w-[500px] h-[45px] mx-auto bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center uppercase tracking-wide"
          >
            {status === "processing" ? "Processando..." : "SIM, ADICIONAR AO MEU PEDIDO"}
          </button>

          <button
            onClick={() => handleUpsellAction(false)}
            disabled={status === "processing" || !token}
            className="w-full max-w-[500px] h-[45px] mx-auto bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center uppercase tracking-wide"
          >
            NÃO, QUERO RECUSAR ESSA OFERTA
          </button>
        </div>
        {/* ----------------------------------------- */}

        {/* Feedback Visual */}
        {message && (
          <div
            className={`mt-6 p-4 rounded-lg border ${
              status === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"
            }`}
          >
            <p className="font-medium">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
};
