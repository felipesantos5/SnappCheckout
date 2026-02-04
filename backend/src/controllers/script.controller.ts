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
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    // Pega a URL de fallback do atributo data-fallback-url do botão
    const fallbackUrl = btnElement.getAttribute('data-fallback-url') || btnElement.dataset.fallbackUrl;

    // Pega o método de pagamento: prioridade data-attribute > URL query param > default stripe
    const urlPaymentMethod = urlParams.get('payment_method');
    const paymentMethod = btnElement.getAttribute('data-payment-method') || btnElement.dataset.paymentMethod || urlPaymentMethod || 'stripe';

    console.log('🔵 [Upsell] URL completa:', window.location.href);
    console.log('🔵 [Upsell] Token encontrado:', token ? token.substring(0, 8) + '...' : 'NENHUM');
    console.log('🔵 [Upsell] Método de pagamento:', paymentMethod);

    // Se não tem token e tem fallback URL, redireciona direto (one-click não disponível)
    if (!token && isBuy) {
      if (fallbackUrl && fallbackUrl.trim() !== '') {
        console.log('⚠️ [Upsell] Sem token - redirecionando para checkout alternativo:', fallbackUrl);
        window.location.href = fallbackUrl;
        return;
      }
      // Se não tem fallback, não mostra erro (silencioso)
      console.warn('One-click não disponível e fallback URL não configurada.');
      return;
    }

    const originalText = btnElement.innerText;
    btnElement.innerText = "PROCESSANDO...";
    btnElement.classList.add("chk-btn-loading");

    // Desabilita todos os botões de upsell para evitar duplo clique
    document.querySelectorAll('.chk-buy, .chk-refuse').forEach(b => b.disabled = true);

    try {
      const endpoint = isBuy ? 'one-click-upsell' : 'upsell-refuse';
      // Usa a URL da API configurada no servidor
      const apiUrl = "${backendUrl}/api";

      // Define a rota baseado no método de pagamento
      const baseRoute = paymentMethod === 'paypal' ? '/paypal/' : '/payments/';

      console.log('🔵 [Upsell] Chamando endpoint:', apiUrl + baseRoute + endpoint);

      const res = await fetch(apiUrl + baseRoute + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await res.json();

      if (data.success) {
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else {
          // Se não tiver redirect, recarrega apenas se for recusa. 
          // Se for compra bem sucedida mas sem redirect (raro), algo está errado mas evitamos alert.
          if (!isBuy) {
            window.location.reload();
          } else {
            console.warn('Compra bem sucedida, mas sem redirect URL. Recarregando a página pode ser necessário.');
          }
        }
      } else {
        // Se a requisição falhou E é compra, redireciona para fallback
        if (isBuy && fallbackUrl && fallbackUrl.trim() !== '') {
          console.log('✅ Redirecionando para checkout alternativo:', fallbackUrl);
          window.location.href = fallbackUrl;
          return;
        }

        // Se não tem fallback, apenas loga e reabilita (para não travar a página)
        console.error('Erro na requisição:', data.message);
        document.querySelectorAll('.chk-buy, .chk-refuse').forEach(b => b.disabled = false);
        btnElement.innerText = originalText;
        btnElement.classList.remove("chk-btn-loading");
      }

    } catch (e) {
      // Se deu erro E tem fallback URL configurada (e é botão de compra), redireciona
      if (isBuy && fallbackUrl && fallbackUrl.trim() !== '') {
        console.log('✅ Erro na requisição, redirecionando para checkout alternativo:', fallbackUrl);
        window.location.href = fallbackUrl;
        return;
      }

      // Se não tem fallback, apenas loga e reabilita
      console.error('Erro de conexão:', e.message);
      document.querySelectorAll('.chk-buy, .chk-refuse').forEach(b => b.disabled = false);
      btnElement.innerText = originalText;
      btnElement.classList.remove("chk-btn-loading");
    }
  }

  // 3. Função para Inicializar Event Listeners
  function initUpsellButtons() {
    // Verifica se já inicializou (evita duplicação)
    if (window._chkUpsellInit) return;

    // Encontra botões de compra
    const buyBtns = document.querySelectorAll('.chk-buy');
    console.log(\`✅ Encontrado(s) \${buyBtns.length} botão(ões) de compra (.chk-buy)\`);
    buyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleUpsellAction(true, e.currentTarget || e.target);
      });
    });

    // Encontra botões de recusa
    const refuseBtns = document.querySelectorAll('.chk-refuse');
    console.log(\`✅ Encontrado(s) \${refuseBtns.length} botão(ões) de recusa (.chk-refuse)\`);
    refuseBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleUpsellAction(false, e.currentTarget || e.target);
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
    // Pequeno delay para garantir que elementos renderizados via JS estejam prontos
    setTimeout(initUpsellButtons, 100);
  } else {
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

  // Headers para evitar cache - SEMPRE busca a versão mais recente
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  // CORS - permite que qualquer domínio carregue o script
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.send(scriptContent);
};
