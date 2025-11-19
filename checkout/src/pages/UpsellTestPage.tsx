// src/pages/UpsellTestPage.tsx
import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { API_URL } from "../config/BackendUrl"; //

export const UpsellTestPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  // ESTE É O SCRIPT QUE O SEU CLIENTE VAI USAR
  // Estamos simulando ele rodando dentro do React com useEffect
  useEffect(() => {
    const initOneClickScript = () => {
      // 1. Configuração (No site do cliente, ele vai definir isso ou você passará o script pronto)
      const ENDPOINT = `${API_URL}/payments/one-click-upsell`;

      // 2. Captura o token da URL (igual ao script externo)
      const urlParams = new URLSearchParams(window.location.search);
      const scriptToken = urlParams.get("token");

      if (!scriptToken) {
        console.warn("Script Upsell: Token não encontrado na URL.");
        return;
      }

      // 3. Busca todos os botões com o atributo data-one-click-buy
      const buttons = document.querySelectorAll("[data-one-click-buy]") as NodeListOf<HTMLButtonElement>;

      buttons.forEach((button) => {
        // Evita adicionar múltiplos listeners se o useEffect rodar 2x
        if (button.getAttribute("data-script-attached") === "true") return;
        button.setAttribute("data-script-attached", "true");

        button.addEventListener("click", async (e) => {
          e.preventDefault();

          const originalText = button.innerText;
          button.innerText = "Processando...";
          button.disabled = true;
          button.style.opacity = "0.7";
          button.style.cursor = "not-allowed";

          try {
            // Nota: Não enviamos mais o 'upsellSlug', pois o backend pega da sessão segura
            const response = await fetch(ENDPOINT, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ token: scriptToken }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
              button.innerText = "Compra Aprovada! ✅";
              button.style.backgroundColor = "#10B981"; // Verde
              button.style.borderColor = "#10B981";

              // Opcional: Redirecionar
              setTimeout(() => {
                alert("Redirecionando para página de obrigado...");
                // window.location.href = "/obrigado";
              }, 1000);
            } else {
              throw new Error(data.message || "Pagamento não autorizado.");
            }
          } catch (error: any) {
            console.error(error);
            button.innerText = "Erro: Tente novamente";
            button.style.backgroundColor = "#EF4444"; // Vermelho
            button.disabled = false;
            button.style.opacity = "1";
            button.style.cursor = "pointer";

            // Reseta o botão após 3 segundos
            setTimeout(() => {
              button.innerText = originalText;
              button.style.backgroundColor = ""; // Volta ao original (classe CSS)
            }, 3000);
          }
        });
      });
    };

    initOneClickScript();
  }, [token]); // Roda sempre que o token mudar ou a página carregar

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4 text-gray-800">Simulação Site do Cliente</h1>
        <p className="text-gray-600 mb-6">
          Esta página não usa lógica React no botão. Ela usa o <strong>Script Vanilla JS</strong> injetado via DOM.
        </p>

        {!token && <div className="bg-yellow-100 text-yellow-800 p-3 rounded mb-4 text-sm">⚠️ Nenhum token na URL. O script não será ativado.</div>}

        <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg">
          <h3 className="font-bold text-lg mb-2">Oferta Especial: Ebook Premium</h3>
          <p className="text-sm text-gray-500 mb-4">Adicione ao seu pedido por apenas o preço configurado na oferta.</p>

          {/* O CLIENTE SÓ PRECISA COLOCAR O ATRIBUTO: data-one-click-buy 
            As classes do Tailwind aqui são apenas para estilização visual.
          */}
          <button
            data-one-click-buy
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition-all"
          >
            Sim! Adicionar ao meu pedido
          </button>
        </div>

        <p className="mt-8 text-xs text-gray-400">
          Este botão funciona identificando o atributo <code>data-one-click-buy</code>
        </p>
      </div>
    </div>
  );
};
