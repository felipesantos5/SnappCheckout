// src/components/checkout/CheckoutForm.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStripe, useElements, CardNumberElement } from "@stripe/react-stripe-js";
import type { PaymentRequest, PaymentRequestPaymentMethodEvent } from "@stripe/stripe-js";
import { Loader2, CheckCircle } from "lucide-react";

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
import { getCookie } from "../../helper/getCookie";
import { detectPlatform, isMobile } from "../../utils/platformDetection";

interface CheckoutFormProps {
  offerData: OfferData;
  checkoutSessionId: string;
  generateEventId: () => string;
}

export const CheckoutForm: React.FC<CheckoutFormProps> = ({ offerData, checkoutSessionId }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { button, buttonForeground } = useTheme();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estado de Sucesso
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  const [method, setMethod] = useState<"creditCard" | "pix" | "wallet">("creditCard");
  const [selectedBumps, setSelectedBumps] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [totalAmount, setTotalAmount] = useState(offerData.mainProduct.priceInCents);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [walletLabel, setWalletLabel] = useState<string | null>(null);

  // REF para controlar se InitiateCheckout já foi disparado
  const initiateCheckoutFired = useRef(false);

  // Armazena event_ids gerados para cada evento
  const initiateCheckoutEventId = useRef<string | null>(null);
  const addPaymentInfoEventId = useRef<string | null>(null);

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

  // Dispara InitiateCheckout uma única vez quando o componente carrega
  useEffect(() => {
    if (!initiateCheckoutFired.current && window.fbq) {
      // Gera um event_id único para InitiateCheckout baseado no checkoutSessionId
      const eventId = `${checkoutSessionId}_initiate_checkout`;
      initiateCheckoutEventId.current = eventId;

      window.fbq(
        "track",
        "InitiateCheckout",
        {
          content_name: offerData.mainProduct.name,
          content_ids: [offerData.mainProduct._id],
          content_type: "product",
          value: offerData.mainProduct.priceInCents / 100,
          currency: offerData.currency.toUpperCase(),
        },
        { eventID: eventId }
      );

      initiateCheckoutFired.current = true;
      console.log(`🔵 Facebook Event: InitiateCheckout [eventID: ${eventId}]`);
    }
  }, [offerData, checkoutSessionId]);

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

  // Configuração simplificada da Carteira Digital - Deixa o Stripe decidir tudo
  useEffect(() => {
    console.log("🔍 [WALLET] Setup iniciado");

    if (!stripe) {
      console.log("⏳ [WALLET] Aguardando Stripe carregar...");
      return;
    }

    console.log("✅ [WALLET] Stripe carregado");
    console.log("📱 [WALLET] User Agent:", navigator.userAgent);
    console.log("📱 [WALLET] Plataforma detectada:", detectPlatform());
    console.log("📱 [WALLET] É mobile:", isMobile());

    // Normaliza configurações
    const normalizedCurrency = offerData.currency.toLowerCase();
    const countryCode = normalizedCurrency === "brl" ? "BR" : "US";

    console.log("💰 [WALLET] Moeda:", normalizedCurrency, "| País:", countryCode);

    // Cria PaymentRequest - Stripe decide internamente se Apple/Google Pay está disponível
    const pr = stripe.paymentRequest({
      country: countryCode,
      currency: normalizedCurrency,
      total: {
        label: offerData.mainProduct.name,
        amount: totalAmount,
      },
      requestPayerName: true,
      requestPayerEmail: true,
      requestPayerPhone: offerData.collectPhone,
    });

    console.log("💳 [WALLET] PaymentRequest criado, verificando disponibilidade...");

    // Stripe verifica se carteiras digitais estão disponíveis
    pr.canMakePayment().then((result) => {
      console.log("🔎 [WALLET] Resultado canMakePayment:", result);

      if (!result) {
        console.log("❌ [WALLET] Nenhuma carteira digital disponível");
        return;
      }

      console.log("✅ [WALLET] Carteira disponível!");
      console.log("   - Apple Pay:", result.applePay);
      console.log("   - Google Pay:", result.googlePay);

      // Define o label baseado no que o Stripe confirmou
      let label = t.payment.wallet; // Padrão genérico

      if (result.applePay) {
        label = t.payment.applePay;
        console.log("🍎 [WALLET] Usando Apple Pay");
      } else if (result.googlePay) {
        label = t.payment.googlePay;
        console.log("🤖 [WALLET] Usando Google Pay");
      } else {
        console.log("💳 [WALLET] Usando label genérico");
      }

      // Configura a carteira para uso
      setWalletLabel(label);
      setPaymentRequest(pr);
      console.log("✅ [WALLET] Configuração concluída com sucesso!");
    }).catch((error) => {
      console.error("❌ [WALLET] Erro ao verificar disponibilidade:", error);
    });

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
            setPaymentIntentId(paymentIntent.id);
            setPaymentSucceeded(true);
          }
        }
      } catch (err: any) {
        ev.complete("fail");
        setErrorMessage(err.message || "Erro inesperado");
      }
    });
  }, [stripe, offerData, selectedBumps, totalAmount, utmData, t]);

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

  // --- LÓGICA DE SUCESSO E REDIRECIONAMENTO ---
  useEffect(() => {
    if (paymentSucceeded && paymentIntentId) {
      const timer = setTimeout(async () => {
        // 1. PRIORIDADE: Upsell Habilitado
        if (offerData.upsell?.enabled) {
          try {
            // Gera token para upsell
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
              const params = new URLSearchParams();
              params.append("token", data.token);
              window.location.href = `${offerData.upsell?.redirectUrl}?${params.toString()}`;
              return;
            }
          } catch (error) {
            console.error("Falha ao gerar token de upsell, verificando fallback.", error);
          }
        }

        // 2. PRIORIDADE: Página de Obrigado Customizada do Cliente
        // (Só executa se não houver upsell ou se o upsell falhar/estiver desabilitado)
        if (offerData.thankYouPageUrl) {
          window.location.href = offerData.thankYouPageUrl;
          return;
        }

        // 3. PRIORIDADE: Página de Sucesso Padrão (Interna)
        const params = new URLSearchParams();
        params.append("offerName", offerData.mainProduct.name);
        navigate(`/success?${params.toString()}`);
      }, 2000); // Delay de 2 segundos para exibir o check

      return () => clearTimeout(timer);
    }
  }, [paymentSucceeded, paymentIntentId, offerData, navigate]);

  const handleToggleBump = (bumpId: string) => {
    setSelectedBumps((prev) => {
      if (prev.includes(bumpId)) {
        return prev.filter((id) => id !== bumpId);
      } else {
        return [...prev, bumpId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      setErrorMessage("Sistema de pagamento não carregado. Recarregue a página.");
      return;
    }

    setErrorMessage(null);

    // Coleta dados antes de qualquer loading
    const emailInput = document.getElementById("email") as HTMLInputElement;
    const nameInput = document.getElementById("name") as HTMLInputElement;
    const phoneInput = document.getElementById("phone") as HTMLInputElement;
    const cardNameInput = document.getElementById("card-name") as HTMLInputElement;

    const email = emailInput?.value;
    const fullName = nameInput?.value;
    const phone = phoneInput?.value || "";
    const cardName = cardNameInput?.value || "";

    // Coleta dados de endereço (se collectAddress estiver ativado)
    const addressData = offerData.collectAddress
      ? {
          zipCode: (document.getElementById("address-zipCode") as HTMLInputElement)?.value || "",
          street: (document.getElementById("address-street") as HTMLInputElement)?.value || "",
          number: (document.getElementById("address-number") as HTMLInputElement)?.value || "",
          complement: (document.getElementById("address-complement") as HTMLInputElement)?.value || "",
          neighborhood: (document.getElementById("address-neighborhood") as HTMLInputElement)?.value || "",
          city: (document.getElementById("address-city") as HTMLInputElement)?.value || "",
          state: (document.getElementById("address-state") as HTMLInputElement)?.value || "",
          country: (document.getElementById("address-country") as HTMLInputElement)?.value || "",
        }
      : null;

    // Validações básicas
    if (!email || !fullName) {
      setErrorMessage("Preencha todos os campos obrigatórios.");
      return;
    }

    // Validação básica do elemento do cartão
    const cardElement = elements.getElement(CardNumberElement);
    if (method === "creditCard" && !cardElement) {
      setErrorMessage("Erro interno: Campo de cartão não inicializado.");
      return;
    }

    // ATIVA LOADING (Isso agora só exibe o overlay, NÃO desmonta o form)
    setLoading(true);

    // Dispara evento AddPaymentInfo do Facebook com event_id único
    if (window.fbq) {
      const eventId = `${checkoutSessionId}_add_payment_info`;
      addPaymentInfoEventId.current = eventId;

      window.fbq(
        "track",
        "AddPaymentInfo",
        {
          content_name: offerData.mainProduct.name,
          content_ids: [offerData.mainProduct._id],
          content_type: "product",
          value: totalAmount / 100,
          currency: offerData.currency.toUpperCase(),
        },
        { eventID: eventId }
      );

      console.log(`🔵 Facebook Event: AddPaymentInfo [eventID: ${eventId}]`);
    }

    // Coleta cookies do Facebook (não usa useMemo aqui pois estamos dentro de um handler)
    const fbCookies = {
      fbc: getCookie("_fbc"),
      fbp: getCookie("_fbp"),
    };

    try {
      const clientIp = await getClientIP();

      // Gera event_id para o evento Purchase (será usado no backend CAPI)
      const purchaseEventId = `${checkoutSessionId}_purchase`;

      const payload = {
        offerSlug: offerData.slug,
        selectedOrderBumps: selectedBumps,
        contactInfo: { email, name: fullName, phone },
        addressInfo: addressData,
        metadata: {
          ...utmData,
          ip: clientIp,
          userAgent: navigator.userAgent,
          fbc: fbCookies.fbc,
          fbp: fbCookies.fbp,
          // Envia os event_ids para o backend usar no CAPI
          initiateCheckoutEventId: initiateCheckoutEventId.current,
          addPaymentInfoEventId: addPaymentInfoEventId.current,
          purchaseEventId: purchaseEventId,
        },
      };

      if (method === "creditCard") {
        const res = await fetch(`${API_URL}/payments/create-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error?.message || "Erro ao criar pagamento");
        }

        const { clientSecret, error: backendError } = await res.json();
        if (backendError) throw new Error(backendError.message);

        // O Stripe Elements ainda existe no DOM por baixo do overlay
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement!, // Non-null assertion seguro pois validamos acima
            billing_details: { name: cardName, email, phone },
          },
          receipt_email: email,
        });

        if (error) throw error;

        if (paymentIntent.status === "succeeded") {
          setPaymentIntentId(paymentIntent.id);
          setPaymentSucceeded(true);
        } else {
          throw new Error(`Pagamento não aprovado. Status: ${paymentIntent.status}`);
        }
      } else if (method === "pix") {
        setErrorMessage(t.messages.pixNotImplemented);
        setLoading(false);
      }
    } catch (error: any) {
      console.error("[ERROR] Erro no checkout:", error);
      setErrorMessage(error.message || t.messages.error);
      setLoading(false);
    }
  };

  if (paymentSucceeded) {
    return (
      <div className="min-h-screen w-full bg-white flex items-center justify-center z-50">
        <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75"></div>
            <div className="relative bg-white rounded-full p-2">
              <CheckCircle className="h-24 w-24 text-green-500" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Sucesso!</h2>
          <p className="text-gray-500 text-lg animate-pulse">Finalizando seu pedido...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {loading && (
        <div className="fixed inset-0 bg-white/80 z-60 flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />
            <p className="text-gray-600 font-medium animate-pulse">{t.buttons.processing}</p>
          </div>
        </div>
      )}
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

            <ContactInfo showPhone={offerData.collectPhone} offerID={offerData._id} />
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
