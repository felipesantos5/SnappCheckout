import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useStripe, useElements, CardNumberElement } from "@stripe/react-stripe-js";
import type { PaymentRequest, PaymentRequestPaymentMethodEvent } from "@stripe/stripe-js";

// Tipos
import type { OfferData } from "../../pages/CheckoutSlugPage";
import { OrderSummary } from "./OrderSummary";
import { ContactInfo } from "./ContactInfo";
import { AddressInfo } from "./AddressInfo";
import { PaymentMethods } from "./PaymentMethods";
import { OrderBump } from "./OrderBump";
import { Banner } from "./Banner";
import { API_URL } from "../../config/BackendUrl";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "../../i18n/I18nContext";
import { getClientIP } from "../../service/getClientIP";

interface CheckoutFormProps {
  offerData: OfferData;
}

export const CheckoutForm: React.FC<CheckoutFormProps> = ({ offerData }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { button, buttonForeground } = useTheme();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estado de Sucesso
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null); // NOVO: Guarda o ID para o Upsell

  const [method, setMethod] = useState<"creditCard" | "pix" | "wallet">("creditCard");
  const [selectedBumps, setSelectedBumps] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [totalAmount, setTotalAmount] = useState(offerData.mainProduct.priceInCents);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [walletLabel, setWalletLabel] = useState<string | null>(null);

  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);

  const utmData = useMemo(() => {
    return {
      utm_source: urlParams.get("utm_source") || null,
      utm_medium: urlParams.get("utm_medium") || null,
      utm_campaign: urlParams.get("utm_campaign") || null,
      utm_term: urlParams.get("utm_term") || null,
      utm_content: urlParams.get("utm_content") || null,
    };
  }, [urlParams]);

  // Atualiza o total baseado em bumps e quantidade
  useEffect(() => {
    let newTotal = offerData.mainProduct.priceInCents * quantity;

    selectedBumps.forEach((bumpId) => {
      const bump = offerData.orderBumps.find((b) => b?._id === bumpId);
      if (bump) {
        newTotal += bump.priceInCents;
      }
    });

    setTotalAmount(newTotal);
  }, [selectedBumps, quantity, offerData]);

  // Configuração da Carteira Digital (Apple/Google Pay)
  useEffect(() => {
    if (!stripe) return;

    const pr = stripe.paymentRequest({
      country: "BR",
      currency: offerData.currency.toLowerCase(),
      total: {
        label: offerData.mainProduct.name,
        amount: totalAmount,
      },
      requestPayerName: true,
      requestPayerEmail: true,
      requestPayerPhone: offerData.collectPhone,
    });

    pr.canMakePayment().then((result) => {
      if (result) {
        setPaymentRequest(pr);
        if (result.applePay) setWalletLabel("Apple Pay");
        else if (result.googlePay) setWalletLabel("Google Pay");
        else setWalletLabel("Carteira Digital");
      }
    });

    // Handler: Pagamento via Carteira
    pr.on("paymentmethod", async (ev: PaymentRequestPaymentMethodEvent) => {
      try {
        const clientIp = await getClientIP();

        const payload = {
          offerSlug: offerData.slug,
          selectedOrderBumps: selectedBumps,
          contactInfo: {
            email: ev.payerEmail,
            name: ev.payerName,
            phone: ev.payerPhone || "",
          },
          metadata: {
            ...utmData,
            ip: clientIp,
            userAgent: navigator.userAgent,
          },
        };

        const res = await fetch(`${API_URL}/payments/create-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const { clientSecret, error: backendError } = await res.json();

        if (backendError) {
          ev.complete("fail");
          setErrorMessage(backendError.message);
          return;
        }

        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false }
        );

        if (confirmError) {
          ev.complete("fail");
          setErrorMessage(confirmError.message || "Erro no pagamento");
        } else {
          ev.complete("success");
          if (paymentIntent?.status === "succeeded") {
            setPaymentIntentId(paymentIntent.id); // Salva o ID
            setPaymentSucceeded(true);
          }
        }
      } catch (err: any) {
        ev.complete("fail");
        setErrorMessage(err.message || "Erro inesperado");
      }
    });
  }, [stripe, offerData, selectedBumps, totalAmount, utmData]);

  useEffect(() => {
    if (paymentRequest) {
      paymentRequest.update({
        total: {
          label: offerData.mainProduct.name,
          amount: totalAmount,
        },
      });
    }
  }, [totalAmount, paymentRequest, offerData.mainProduct.name]);

  // --- LÓGICA DE SUCESSO E REDIRECIONAMENTO (UPSELL) ---
  useEffect(() => {
    const handleSuccessRedirect = async () => {
      if (paymentSucceeded && paymentIntentId) {
        // Verifica se existe link de upsell configurado
        if (offerData.upsell?.enabled) {
          try {
            // 1. Solicita o Token de Sessão Segura ao Backend
            const response = await fetch(`${API_URL}/payments/upsell-token`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentIntentId: paymentIntentId,
                offerSlug: offerData.slug,
              }),
            });

            const data = await response.json();

            if (data.token) {
              // 2. Se tiver token, redireciona para o site do cliente com o token na URL
              const params = new URLSearchParams();
              params.append("token", data.token);

              // Redirecionamento externo
              window.location.href = `${offerData.upsell?.redirectUrl}?${params.toString()}`;
              return;
            }
          } catch (error) {
            console.error("Falha ao gerar token de upsell, usando fallback.", error);
          }
        }

        // Fallback: Se não tiver upsell ou der erro, vai para página de sucesso interna
        const params = new URLSearchParams();
        params.append("offerName", offerData.mainProduct.name);
        navigate(`/success?${params.toString()}`);
      }
    };

    handleSuccessRedirect();
  }, [paymentSucceeded, paymentIntentId, offerData, navigate]);

  // Toggle Bump
  const handleToggleBump = (bumpId: string) => {
    setSelectedBumps((prev) => {
      if (prev.includes(bumpId)) {
        return prev.filter((id) => id !== bumpId); // Remove
      } else {
        return [...prev, bumpId]; // Adiciona
      }
    });
  };

  // Submit do formulário (Cartão de Crédito / PIX)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setErrorMessage(null);

    // Coleta de dados (Mantido igual)
    const email = (document.getElementById("email") as HTMLInputElement).value;
    const fullName = (document.getElementById("name") as HTMLInputElement).value;
    const phoneElement = document.getElementById("phone") as HTMLInputElement | null;
    const phone = phoneElement ? phoneElement.value : "";

    const clientIp = await getClientIP();

    const payload = {
      offerSlug: offerData.slug,
      selectedOrderBumps: selectedBumps,
      contactInfo: { email, name: fullName, phone },
      metadata: { ...utmData, ip: clientIp, userAgent: navigator.userAgent },
    };

    try {
      if (method === "creditCard") {
        // 1. Cria a intenção de pagamento
        const res = await fetch(`${API_URL}/payments/create-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const { clientSecret, error: backendError } = await res.json();
        if (backendError) throw new Error(backendError.message);

        const cardElement = elements.getElement(CardNumberElement);
        if (!cardElement) throw new Error(t.messages.cardElementNotFound);

        const cardName = (document.getElementById("card-name") as HTMLInputElement).value;

        // 2. Confirma o pagamento no Stripe
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: { name: cardName, email: email, phone: phone },
          },
          receipt_email: email,
        });

        if (error) throw error;

        // 3. Pagamento Aprovado! Lógica de Redirecionamento Inteligente
        if (paymentIntent.status === "succeeded") {
          try {
            // Tenta gerar o token de Upsell (Verifica se existe upsell ativo)
            const upsellRes = await fetch(`${API_URL}/payments/upsell-token`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentIntentId: paymentIntent.id,
                offerSlug: offerData.slug,
              }),
            });

            const upsellData = await upsellRes.json();

            // SE tiver Upsell configurado, redireciona para a página externa do cliente com o token
            if (upsellRes.ok && upsellData.redirectUrl) {
              window.location.href = upsellData.redirectUrl;
              return; // Interrompe a função aqui para o navegador carregar a nova página
            }
          } catch (err) {
            // Se falhar a verificação de upsell, apenas loga e segue para o sucesso padrão
            console.error("Erro ao verificar upsell, seguindo fluxo normal:", err);
          }

          // FALLBACK: Se não tiver upsell ou der erro, vai para a página de sucesso interna
          // setPaymentSucceeded(true); // Se você usa useEffect para algo local
          navigate(`/success?offerSlug=${offerData.slug}&paymentId=${paymentIntent.id}`);
        }
      } else if (method === "pix") {
        setErrorMessage(t.messages.pixNotImplemented);
      }
    } catch (error: any) {
      console.error("Erro no checkout:", error);
      setErrorMessage(error.message || t.messages.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Banner imageUrl={offerData.bannerImageUrl} />
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-lg mx-auto bg-white rounded-xl shadow-xl p-4 pt-0">
          <form onSubmit={handleSubmit}>
            <OrderSummary
              productName={offerData.mainProduct.name}
              productImageUrl={offerData.mainProduct.imageUrl}
              totalAmountInCents={totalAmount}
              basePriceInCents={offerData.mainProduct.priceInCents}
              currency={offerData.currency}
              quantity={quantity}
              setQuantity={setQuantity}
              originalPriceInCents={offerData.mainProduct.compareAtPriceInCents}
              discountPercentage={offerData.mainProduct.discountPercentage}
            />

            <ContactInfo showPhone={offerData.collectPhone} />

            {offerData.collectAddress && <AddressInfo />}

            <PaymentMethods method={method} setMethod={setMethod} paymentRequest={paymentRequest} walletLabel={walletLabel} />

            <OrderBump bumps={offerData.orderBumps} selectedBumps={selectedBumps} onToggleBump={handleToggleBump} currency={offerData.currency} />

            <button
              type="submit"
              disabled={!stripe || loading || paymentSucceeded}
              className="w-full mt-8 bg-button text-button-foreground font-bold py-3 px-4 rounded-lg text-lg transition-colors disabled:opacity-50 hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: loading || paymentSucceeded ? "#ccc" : button,
                color: buttonForeground,
                opacity: loading || paymentSucceeded ? 0.7 : 1,
              }}
            >
              {loading || paymentSucceeded ? t.buttons.processing : method === "pix" ? t.buttons.submitPix : t.buttons.submit}
            </button>

            {errorMessage && <div className="text-red-500 text-sm text-center mt-4">{errorMessage}</div>}
          </form>
        </div>
      </div>
    </>
  );
};
