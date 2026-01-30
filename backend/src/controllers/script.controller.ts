import { Request, Response } from "express";

export const getUpsellScript = (req: Request, res: Response) => {
  const backendUrl = process.env.BACKEND_URL || "https://backend2.snappcheckout.com";

  const scriptContent = `
(function() {

  // 1. Injeta os Estilos Padrão (Opcional, o cliente pode querer estilizar do jeito dele)
  const style = document.createElement('style');
  style.innerHTML = \`
    .chk-btn-loading { opacity: 0.7; cursor: wait; pointer-events: none; }
  \`;
  document.head.appendChild(style);

  // 2. Função Principal de Processamento
  async function handleUpsellAction(isBuy, btnElement) {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      console.error("❌ Token de upsell não encontrado na URL.");
      alert('Erro: Link inválido (Token ausente).');
      return;
    }

    // Pega a URL de fallback do atributo data-fallback-url do botão
    const fallbackUrl = btnElement.getAttribute('data-fallback-url') || btnElement.dataset.fallbackUrl;

    const originalText = btnElement.innerText;
    btnElement.innerText = "PROCESSANDO...";
    btnElement.classList.add("chk-btn-loading");

    // Desabilita todos os botões de upsell para evitar duplo clique
    document.querySelectorAll('.chk-buy, .chk-refuse').forEach(b => b.disabled = true);

    try {
      const endpoint = isBuy ? 'one-click-upsell' : 'upsell-refuse';
      // Usa a URL da API configurada no servidor
     const apiUrl = "${backendUrl}/api";

      const res = await fetch(apiUrl + '/payments/' + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await res.json();

      if (data.success) {
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else {
          alert(data.message || (isBuy ? 'Compra realizada!' : 'Oferta recusada.'));
          // Se não tiver redirect, reabilita (caso raro)
          window.location.reload();
        }
      } else {
        // Se a requisição falhou E tem fallback URL configurada, redireciona
        if (isBuy && fallbackUrl && fallbackUrl.trim() !== '') {
          console.log('✅ Redirecionando para checkout alternativo:', fallbackUrl);
          window.location.href = fallbackUrl;
          return; // Importante: não executa o resto do código
        }

        // Se não tem fallback, mostra o erro normalmente
        throw new Error(data.message || 'Erro desconhecido');
      }

    } catch (e) {
      // Se deu erro E tem fallback URL configurada (e é botão de compra), redireciona
      if (isBuy && fallbackUrl && fallbackUrl.trim() !== '') {
        console.log('✅ Erro na requisição, redirecionando para checkout alternativo:', fallbackUrl);
        window.location.href = fallbackUrl;
        return;
      }

      // Se não tem fallback, mostra o erro
      alert(e.message || 'Erro de conexão. Tente novamente.');
      // Reabilita os botões em caso de erro
      document.querySelectorAll('.chk-buy, .chk-refuse').forEach(b => b.disabled = false);
      btnElement.innerText = originalText;
      btnElement.classList.remove("chk-btn-loading");
    }
  }

  // 3. Função para Inicializar Event Listeners
  function initUpsellButtons() {
    // Verifica se já inicializou (evita duplicação)
    if (window._chkUpsellInit) return;

    console.log('🚀 Inicializando Upsell Script...');

    // Encontra botões de compra
    const buyBtns = document.querySelectorAll('.chk-buy');
    console.log(\`✅ Encontrado(s) \${buyBtns.length} botão(ões) de compra (.chk-buy)\`);
    buyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleUpsellAction(true, e.target);
      });
    });

    // Encontra botões de recusa
    const refuseBtns = document.querySelectorAll('.chk-refuse');
    console.log(\`✅ Encontrado(s) \${refuseBtns.length} botão(ões) de recusa (.chk-refuse)\`);
    refuseBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleUpsellAction(false, e.target);
      });
    });

    // Marca como inicializado
    if (buyBtns.length > 0 || refuseBtns.length > 0) {
      window._chkUpsellInit = true;
      console.log('✅ Upsell Script inicializado com sucesso!');
    }
  }

  // 4. Auto-Inicialização Inteligente
  // Tenta inicializar imediatamente se o DOM já estiver pronto
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('📄 DOM já está pronto, inicializando imediatamente...');
    // Pequeno delay para garantir que elementos renderizados via JS estejam prontos
    setTimeout(initUpsellButtons, 100);
  } else {
    // Se não, espera o DOMContentLoaded
    console.log('⏳ Aguardando DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', initUpsellButtons);
  }

  // 5. MutationObserver - Observa novos botões adicionados dinamicamente
  const observer = new MutationObserver((mutations) => {
    let shouldInit = false;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          if (node.classList?.contains('chk-buy') ||
              node.classList?.contains('chk-refuse') ||
              node.querySelector?.('.chk-buy, .chk-refuse')) {
            shouldInit = true;
          }
        }
      });
    });

    if (shouldInit && !window._chkUpsellInit) {
      console.log('🔄 Novos botões detectados, reinicializando...');
      setTimeout(initUpsellButtons, 50);
    }
  });

  // Observa mudanças no body
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    // Se body ainda não existe, espera um pouco
    setTimeout(() => {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }, 100);
  }
})();
  `;

  // Retorna como Javascript
  res.setHeader("Content-Type", "application/javascript");
  res.send(scriptContent);
};
