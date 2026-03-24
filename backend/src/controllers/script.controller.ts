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
    const offerId = urlParams.get('offerId');

    // Pega a URL de fallback do atributo data-fallback-url do botão
    const fallbackUrl = btnElement.getAttribute('data-fallback-url') || btnElement.dataset.fallbackUrl;

    // Pega o método de pagamento: prioridade data-attribute > URL query param > default stripe
    const urlPaymentMethod = urlParams.get('payment_method');
    const paymentMethod = btnElement.getAttribute('data-payment-method') || btnElement.dataset.paymentMethod || urlPaymentMethod || 'stripe';

    console.log('[CHK-Upsell] Ação iniciada:', {
      acao: isBuy ? 'COMPRAR' : 'RECUSAR',
      token: token ? token.substring(0, 8) + '...' : 'VAZIO',
      offerId: offerId || 'N/A',
      paymentMethod: paymentMethod,
      fallbackUrl: fallbackUrl || 'NÃO CONFIGURADA',
      urlCompleta: window.location.href
    });

    // Se não tem token e tem fallback URL (e é BUY), redireciona direto (one-click não disponível)
    if (!token && isBuy) {
      console.warn('[CHK-Upsell] Token AUSENTE na URL! One-click não disponível.');
      if (fallbackUrl && fallbackUrl.trim() !== '') {
        console.warn('[CHK-Upsell] Redirecionando para fallback (sem token):', fallbackUrl);
        window.location.href = fallbackUrl;
        return;
      }
      console.warn('[CHK-Upsell] Sem token E sem fallback URL. Botão ficará sem ação.');
      return;
    }

    const originalText = btnElement.innerText;
    if (isBuy) {
      btnElement.innerText = "PROCESSANDO...";
    }
    btnElement.classList.add("chk-btn-loading");

    // Desabilita todos os botões de upsell para evitar duplo clique
    document.querySelectorAll('.chk-buy, .chk-refuse').forEach(b => b.disabled = true);

    try {
      const endpoint = isBuy ? 'one-click-upsell' : 'upsell-refuse';
      // Usa a URL da API configurada no servidor
      const apiUrl = "${backendUrl}/api";

      // Define a rota baseado no método de pagamento
      const baseRoute = paymentMethod === 'paypal' ? '/paypal/' : '/payments/';

      const fullUrl = apiUrl + baseRoute + endpoint;
      console.log('[CHK-Upsell] Chamando API:', { url: fullUrl, token: token ? token.substring(0, 8) + '...' : 'VAZIO', offerId });

      const res = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, offerId })
      });

      console.log('[CHK-Upsell] Resposta HTTP:', { status: res.status, statusText: res.statusText });

      const data = await res.json();
      console.log('[CHK-Upsell] Resposta da API:', {
        success: data.success,
        message: data.message,
        redirectUrl: data.redirectUrl || 'NENHUMA',
        httpStatus: res.status
      });

      if (data.success) {
        if (data.redirectUrl) {
          console.log('[CHK-Upsell] SUCESSO - Redirecionando para:', data.redirectUrl);
          window.location.href = data.redirectUrl;
        } else {
          console.warn('[CHK-Upsell] Sucesso mas SEM redirectUrl | isBuy:', isBuy);
          // Se não tiver redirect e for recusa, o cliente provavelmente quer ir para o obrigado.
          // Como não temos a URL, tentamos um reload ou mantemos como está (silencioso).
          if (!isBuy) {
            // Se o cliente não colocou URL de redirecionamento na oferta, ele fica preso aqui?
            // Melhor recarregar para limpar parâmetros de token se houver.
            window.location.reload();
          }
        }
      } else {
        console.error('[CHK-Upsell] API retornou ERRO:', { message: data.message, status: data.status, httpStatus: res.status });

        // Se a requisição falhou E é compra, redireciona para fallback
        if (isBuy && fallbackUrl && fallbackUrl.trim() !== '') {
          console.warn('[CHK-Upsell] Redirecionando para fallback (erro API):', fallbackUrl);
          window.location.href = fallbackUrl;
          return;
        }

        // Se não tem fallback, apenas loga e reabilita (para não travar a página)
        console.error('[CHK-Upsell] Sem fallback configurada. Reabilitando botões.');
        document.querySelectorAll('.chk-buy, .chk-refuse').forEach(b => b.disabled = false);
        btnElement.innerText = originalText;
        btnElement.classList.remove("chk-btn-loading");
      }

    } catch (e) {
      console.error('[CHK-Upsell] ERRO DE CONEXÃO:', { message: e.message, name: e.name, stack: e.stack });

      // Se deu erro E tem fallback URL configurada (e é botão de compra), redireciona
      if (isBuy && fallbackUrl && fallbackUrl.trim() !== '') {
        console.warn('[CHK-Upsell] Redirecionando para fallback (erro conexão):', fallbackUrl);
        window.location.href = fallbackUrl;
        return;
      }

      // Se não tem fallback, apenas loga e reabilita
      console.error('[CHK-Upsell] Sem fallback configurada. Reabilitando botões.');
      document.querySelectorAll('.chk-buy, .chk-refuse').forEach(b => b.disabled = false);
      btnElement.innerText = originalText;
      btnElement.classList.remove("chk-btn-loading");
    }
  }

  // 3. Função para Inicializar Event Listeners
  function initUpsellButtons() {
    // Verifica se já inicializou (evita duplicação)
    if (window._chkUpsellInit) return;

    const urlParams = new URLSearchParams(window.location.search);
    console.log('[CHK-Upsell] Inicializando script...', {
      token: urlParams.get('token') ? urlParams.get('token').substring(0, 8) + '...' : 'AUSENTE',
      offerId: urlParams.get('offerId') || 'N/A',
      payment_method: urlParams.get('payment_method') || 'N/A (default stripe)',
      url: window.location.href
    });

    // Encontra botões de compra
    const buyBtns = document.querySelectorAll('.chk-buy');
    buyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleUpsellAction(true, e.currentTarget || e.target);
      });
    });

    // Encontra botões de recusa
    const refuseBtns = document.querySelectorAll('.chk-refuse');
    refuseBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleUpsellAction(false, e.currentTarget || e.target);
      });
    });

    console.log('[CHK-Upsell] Botões encontrados:', {
      compra: buyBtns.length,
      recusa: refuseBtns.length,
      buyFallbackUrls: Array.from(buyBtns).map(b => b.getAttribute('data-fallback-url') || 'NÃO CONFIGURADA'),
      refuseFallbackUrls: Array.from(refuseBtns).map(b => b.getAttribute('data-fallback-url') || 'NÃO CONFIGURADA')
    });

    // Marca como inicializado
    if (buyBtns.length > 0 || refuseBtns.length > 0) {
      window._chkUpsellInit = true;
      console.log('[CHK-Upsell] Script inicializado com sucesso!');
    } else {
      console.warn('[CHK-Upsell] Nenhum botão .chk-buy ou .chk-refuse encontrado no DOM. Aguardando MutationObserver...');
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
