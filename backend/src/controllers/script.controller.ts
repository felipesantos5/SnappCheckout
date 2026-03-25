import { Request, Response } from "express";

export const getUpsellScript = (req: Request, res: Response) => {
  const backendUrl = process.env.BACKEND_URL || "https://backend3.snappcheckout.com";

  const scriptContent = `
(function() {

  const style = document.createElement('style');
  style.innerHTML = \`.chk-btn-loading { opacity: 0.7; cursor: wait; pointer-events: none; }\`;
  document.head.appendChild(style);

  async function handleUpsellAction(isBuy, btnElement) {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const offerId = urlParams.get('offerId');
    const fallbackUrl = btnElement.getAttribute('data-fallback-url') || btnElement.dataset.fallbackUrl;
    const urlPaymentMethod = urlParams.get('payment_method');
    const paymentMethod = btnElement.getAttribute('data-payment-method') || btnElement.dataset.paymentMethod || urlPaymentMethod || 'stripe';

    if (!token && isBuy) {
      if (fallbackUrl && fallbackUrl.trim() !== '') {
        window.location.href = fallbackUrl;
      }
      return;
    }

    const originalText = btnElement.innerText;
    if (isBuy) {
      btnElement.innerText = "PROCESSANDO...";
    }
    btnElement.classList.add("chk-btn-loading");
    document.querySelectorAll('.chk-buy, .chk-refuse').forEach(b => b.disabled = true);

    try {
      const endpoint = isBuy ? 'one-click-upsell' : 'upsell-refuse';
      const apiUrl = "${backendUrl}/api";
      const baseRoute = paymentMethod === 'paypal' ? '/paypal/' : '/payments/';
      const fullUrl = apiUrl + baseRoute + endpoint;

      const res = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, offerId })
      });

      const data = await res.json();

      if (data.success) {
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else if (!isBuy) {
          window.location.reload();
        }
      } else {
        if (isBuy && fallbackUrl && fallbackUrl.trim() !== '') {
          window.location.href = fallbackUrl;
          return;
        }
        document.querySelectorAll('.chk-buy, .chk-refuse').forEach(b => b.disabled = false);
        btnElement.innerText = originalText;
        btnElement.classList.remove("chk-btn-loading");
      }

    } catch (e) {
      if (isBuy && fallbackUrl && fallbackUrl.trim() !== '') {
        window.location.href = fallbackUrl;
        return;
      }
      document.querySelectorAll('.chk-buy, .chk-refuse').forEach(b => b.disabled = false);
      btnElement.innerText = originalText;
      btnElement.classList.remove("chk-btn-loading");
    }
  }

  function initUpsellButtons() {
    if (window._chkUpsellInit) return;

    const buyBtns = document.querySelectorAll('.chk-buy');
    buyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleUpsellAction(true, e.currentTarget || e.target);
      });
    });

    const refuseBtns = document.querySelectorAll('.chk-refuse');
    refuseBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleUpsellAction(false, e.currentTarget || e.target);
      });
    });

    if (buyBtns.length > 0 || refuseBtns.length > 0) {
      window._chkUpsellInit = true;
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initUpsellButtons, 100);
  } else {
    document.addEventListener('DOMContentLoaded', initUpsellButtons);
  }

  const observer = new MutationObserver((mutations) => {
    let shouldInit = false;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
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

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    setTimeout(() => {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }, 100);
  }
})();
  `;

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.send(scriptContent);
};
