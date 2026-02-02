// src/components/checkout/CheckoutForm.tsx
import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useStripe, useElements, CardNumberElement } from "@stripe/react-stripe-js";
import type { PaymentRequest, PaymentRequestPaymentMethodEvent } from "@stripe/stripe-js";
import { Loader2, CheckCircle, Lock } from "lucide-react";

import type { OfferData } from "../../pages/CheckoutSlugPage";
import { OrderSummary } from "./OrderSummary";
import { ContactInfo } from "./ContactInfo";
import { PaymentMethods } from "./PaymentMethods";
import { PixDisplay } from "./PixDisplay";
import { Banner } from "./Banner";

// Lazy load componentes não críticos para melhorar performance inicial
const AddressInfo = lazy(() => import("./AddressInfo").then((module) => ({ default: module.AddressInfo })));
const OrderBump = lazy(() => import("./OrderBump").then((module) => ({ default: module.OrderBump })));
const PayPalPayment = lazy(() => import("./PayPalPayment").then((module) => ({ default: module.PayPalPayment })));
import { API_URL } from "../../config/BackendUrl";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "../../i18n/I18nContext";
import { getClientIP } from "../../service/getClientIP";
import { getCookie } from "../../helper/getCookie";
import { detectPlatform } from "../../utils/platformDetection";
import { formatCurrency } from "../../helper/formatCurrency";

interface CheckoutFormProps {
  offerData: OfferData;
  checkoutSessionId: string;
  generateEventId: () => string;
  abTestId: string | null;
}

export const CheckoutForm: React.FC<CheckoutFormProps> = ({ offerData, checkoutSessionId, abTestId }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  // --- NOVO: Pega cores do tema ---
  const { button, buttonForeground, backgroundColor, textColor } = useTheme();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estado de Sucesso
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [saleId, setSaleId] = useState<string | null>(null); // Para PayPal
  const [paypalRedirectUrl, setPaypalRedirectUrl] = useState<string | null>(null); // URL de redirecionamento do backend para PayPal

  // Estados para PIX
  const [pixData, setPixData] = useState<{
    qrCode: string;
    qrCodeUrl: string;
    orderId: string;
    saleId: string;
    expiresAt: string;
  } | null>(null);

  const [method, setMethod] = useState<"creditCard" | "pix" | "wallet" | "paypal">(() => {
    if (offerData.stripe_card_enabled === false) {
      if (offerData.pagarme_pix_enabled) return "pix";
      if (offerData.paypalEnabled) return "paypal";
    }
    return "creditCard";
  });
  const [selectedBumps, setSelectedBumps] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [totalAmount, setTotalAmount] = useState(offerData.mainProduct.priceInCents);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [walletLabel, setWalletLabel] = useState<string | null>(null);
  const [paypalClientId, setPaypalClientId] = useState<string | null>(null);

  // Armazena event_ids gerados para cada evento
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

  // Reseta método de pagamento se PayPal não estiver habilitado
  useEffect(() => {
    if (method === "paypal" && !offerData.paypalEnabled) {
      setMethod("creditCard");
    }
  }, [method, offerData.paypalEnabled]);

  // Reseta método de pagamento se Stripe (Cartão) não estiver habilitado
  useEffect(() => {
    if (method === "creditCard" && offerData.stripe_card_enabled === false) {
      // Prioriza PIX, depois PayPal, senão mantém (não há opção)
      if (offerData.pagarme_pix_enabled) {
        setMethod("pix");
      } else if (offerData.paypalEnabled) {
        setMethod("paypal");
      }
    }
  }, [method, offerData.stripe_card_enabled, offerData.pagarme_pix_enabled, offerData.paypalEnabled]);

  // Busca o PayPal Client ID quando PayPal está habilitado
  useEffect(() => {
    if (offerData.paypalEnabled && offerData._id) {
      fetch(`${API_URL}/paypal/client-id/${offerData._id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.clientId) {
            setPaypalClientId(data.clientId);
          }
        })
        .catch((err) => console.error("Failed to fetch PayPal client ID:", err));
    }
  }, [offerData.paypalEnabled, offerData._id]);

  // Configuração simplificada da Carteira Digital - Deixa o Stripe decidir tudo
  useEffect(() => {
    if (!stripe || offerData.stripe_card_enabled === false) {
      setPaymentRequest(null);
      return;
    }

    // Normaliza configurações
    const normalizedCurrency = offerData.currency.toLowerCase();
    const countryCode = normalizedCurrency === "brl" ? "BR" : "US";

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

    // Stripe verifica se carteiras digitais estão disponíveis
    pr.canMakePayment()
      .then((result) => {
        if (!result) {
          return;
        }

        // Detecta plataforma para priorizar corretamente
        const platform = detectPlatform();
        let label = t.payment.wallet; // Padrão genérico

        // PRIORIZA baseado na plataforma para evitar confusão
        if (platform === "ios") {
          // iPhone/iPad SEMPRE mostra Apple Pay (mesmo que o Stripe reporte as duas)
          label = t.payment.applePay;
        } else if (platform === "android") {
          // Android SEMPRE mostra Google Pay
          label = t.payment.googlePay;
        } else {
          // Desktop/Outros - usa o que o Stripe reportou
          if (result.applePay) {
            label = t.payment.applePay;
          } else if (result.googlePay) {
            label = t.payment.googlePay;
          } else {
          }
        }

        // Configura a carteira para uso
        setWalletLabel(label);
        setPaymentRequest(pr);
      })
      .catch((_error) => { });

    pr.on("paymentmethod", async (ev: PaymentRequestPaymentMethodEvent) => {
      try {
        setLoading(true);
        const clientIp = await getClientIP();

        // Coleta cookies do Facebook
        const fbCookies = {
          fbc: getCookie("_fbc"),
          fbp: getCookie("_fbp"),
        };

        // Gera event_id para o evento Purchase
        const purchaseEventId = `${checkoutSessionId}_applepay_purchase`;

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
            fbc: fbCookies.fbc,
            fbp: fbCookies.fbp,
            purchaseEventId: purchaseEventId,
            abTestId: abTestId ?? null, // A/B test tracking
          },
        };

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

        if (backendError) {
          ev.complete("fail");
          setErrorMessage(backendError.message);
          setLoading(false);
          return;
        }

        // Para Apple Pay/Google Pay, usa confirmCardPayment com o payment_method
        const { error: confirmError, paymentIntent } = await stripe!.confirmCardPayment(clientSecret, {
          payment_method: ev.paymentMethod.id,
        });

        if (confirmError) {
          ev.complete("fail");
          setErrorMessage(confirmError.message || "Erro no pagamento");
          setLoading(false);
        } else {
          ev.complete("success");

          if (paymentIntent?.status === "succeeded") {
            setPaymentIntentId(paymentIntent.id);
            setPaymentSucceeded(true);
          } else if (paymentIntent?.status === "requires_action") {
            // Tenta completar a ação
            const { error: actionError } = await stripe!.confirmCardPayment(clientSecret);
            if (actionError) {
              ev.complete("fail");
              setErrorMessage(actionError.message || "Erro na autenticação");
              setLoading(false);
            } else {
              ev.complete("success");
              setPaymentIntentId(paymentIntent.id);
              setPaymentSucceeded(true);
            }
          } else {
            ev.complete("fail");
            setErrorMessage(`Pagamento não aprovado. Status: ${paymentIntent?.status}`);
            setLoading(false);
          }
        }
      } catch (err: any) {
        ev.complete("fail");
        setErrorMessage(err.message || "Erro inesperado");
        setLoading(false);
      }
    });
  }, [stripe, offerData.stripe_card_enabled, offerData.currency, offerData.mainProduct.name, offerData.collectPhone, selectedBumps, totalAmount, utmData, t]);

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
    if (paymentSucceeded && (paymentIntentId || saleId)) {
      const timer = setTimeout(async () => {
        // 1. PRIORIDADE: PayPal - Usa URL do backend (upsell com vault ou thank you page)
        if (saleId && !paymentIntentId) {
          if (paypalRedirectUrl) {
            window.location.href = paypalRedirectUrl;
            return;
          }
          // Fallback: Se backend não retornou URL, usa thank you page da oferta
          if (offerData.thankYouPageUrl) {
            window.location.href = offerData.thankYouPageUrl;
            return;
          }
        }

        // 2. PRIORIDADE: Upsell Habilitado (somente Stripe)
        if (offerData.upsell?.enabled && offerData.upsell?.redirectUrl) {
          // Stripe: Gera token para one-click upsell
          if (paymentIntentId) {
            try {
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
                window.location.href = `${offerData.upsell.redirectUrl}?${params.toString()}`;
                return;
              }
            } catch (error) {
              console.error("Erro ao gerar token de upsell:", error);
              // Em caso de erro, continua para thank you page
            }
          }
        }

        // 3. PRIORIDADE: Página de Obrigado Customizada do Cliente
        // (Só executa se não houver upsell ou se o upsell falhar/estiver desabilitado)
        if (offerData.thankYouPageUrl) {
          window.location.href = offerData.thankYouPageUrl;
          return;
        }

        // 4. PRIORIDADE: Página de Sucesso Padrão (Interna)
        const params = new URLSearchParams();
        params.append("offerName", offerData.mainProduct.name);
        params.append("lang", offerData.language || "pt"); // Passa a linguagem
        navigate(`/success?${params.toString()}`);
      }, 2000); // Delay de 2 segundos para exibir o check

      return () => clearTimeout(timer);
    }
  }, [paymentSucceeded, paymentIntentId, saleId, paypalRedirectUrl, offerData, navigate]);

  const handleToggleBump = (bumpId: string) => {
    setSelectedBumps((prev) => {
      if (prev.includes(bumpId)) {
        return prev.filter((id) => id !== bumpId);
      } else {
        return [...prev, bumpId];
      }
    });
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
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
    const documentInput = document.getElementById("document") as HTMLInputElement;
    const cardNameInput = document.getElementById("card-name") as HTMLInputElement;

    const email = emailInput?.value;
    const fullName = nameInput?.value;
    const phone = phoneInput?.value || "";
    const documentValue = documentInput?.value || "";
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
        contactInfo: { email, name: fullName, phone, document: documentValue },
        addressInfo: addressData,
        metadata: {
          ...utmData,
          ip: clientIp,
          userAgent: navigator.userAgent,
          fbc: fbCookies.fbc,
          fbp: fbCookies.fbp,
          // Envia os event_ids para o backend usar no CAPI
          addPaymentInfoEventId: addPaymentInfoEventId.current,
          purchaseEventId: purchaseEventId,
          // A/B test tracking
          abTestId: abTestId ?? null, // null é serializado, undefined é omitido
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
        // Lógica PIX - Chama backend Pagar.me
        const res = await fetch(`${API_URL}/payments/pagarme/pix`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error?.message || "Erro ao gerar PIX");
        }

        const pixResponse = await res.json();

        if (!pixResponse.success) {
          throw new Error(pixResponse.error?.message || "Erro ao gerar PIX");
        }

        // Armazena dados do PIX para exibir o QR Code
        setPixData({
          qrCode: pixResponse.qrCode,
          qrCodeUrl: pixResponse.qrCodeUrl,
          orderId: pixResponse.orderId,
          saleId: pixResponse.saleId,
          expiresAt: pixResponse.expiresAt,
        });

        setLoading(false);
      }
    } catch (error: any) {
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
        </div>
      </div>
    );
  }

  if (pixData) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center p-4 animate-in fade-in duration-500"
        style={{ backgroundColor: backgroundColor }}
      >
        <div className="w-full max-w-md">
          <PixDisplay
            qrCode={pixData.qrCode}
            qrCodeUrl={pixData.qrCodeUrl}
            orderId={pixData.orderId}
            amount={totalAmount}
            currency={offerData.currency}
            expiresAt={pixData.expiresAt}
            saleId={pixData.saleId}
            onSuccess={() => setPaymentSucceeded(true)}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      {loading && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center backdrop-blur-sm"
          style={{ backgroundColor: `${backgroundColor}CC` }} // Cor de fundo com opacidade 80% (CC hex)
        >
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />
            <p className="font-medium animate-pulse" style={{ color: textColor }}>
              {t.buttons.processing}
            </p>
          </div>
        </div>
      )}
      <Banner imageUrl={offerData.bannerImageUrl} secondaryBannerImageUrl={offerData.secondaryBannerImageUrl} />

      {/* Container Principal com Fundo e Texto Customizados */}
      <div className="min-h-screen pb-4 md:py-8" style={{ backgroundColor: backgroundColor, color: textColor }}>
        {/* Container centralizado */}
        <div className="max-w-7xl mx-auto px-4">
          {/* Formulário (Card) */}
          <form
            onSubmit={handleCardSubmit}
            className="rounded-xl shadow-lg p-6"
            style={{ backgroundColor: backgroundColor }} // Mantém consistência ou "flat" design se for igual
          >
            {/* OrderSummary no Mobile - Logo abaixo do banner */}
            <div className="lg:hidden mb-2">
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
            </div>

            {/* Grid 2 colunas: mobile = 1 col, desktop = 2 cols */}
            <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-8">
              {/* COLUNA ESQUERDA: Formulário de Checkout */}
              <div className="space-y-6">
                <ContactInfo
                  showPhone={offerData.collectPhone}
                  showDocument={offerData.collectDocument}
                  offerID={offerData._id}
                  abTestId={abTestId}
                />

                {offerData.collectAddress && (
                  <Suspense fallback={<div className="animate-pulse bg-gray-100 h-40 rounded-lg"></div>}>
                    <AddressInfo />
                  </Suspense>
                )}

                <PaymentMethods
                  method={method}
                  setMethod={setMethod}
                  paymentRequest={paymentRequest}
                  walletLabel={walletLabel}
                  paypalEnabled={offerData.paypalEnabled}
                  pagarmePixEnabled={offerData.pagarme_pix_enabled}
                  stripeCardEnabled={offerData.stripe_card_enabled}
                />

                {/* Order Bumps aparecem na esquerda em mobile, escondidos em desktop */}
                <div className="lg:hidden mb-2">
                  <Suspense fallback={<div className="animate-pulse bg-gray-100 h-32 rounded-lg"></div>}>
                    <OrderBump
                      bumps={offerData.orderBumps}
                      selectedBumps={selectedBumps}
                      onToggleBump={handleToggleBump}
                      currency={offerData.currency}
                    />
                  </Suspense>
                </div>

                {/* Botão PayPal - Mobile */}
                {method === "paypal" && offerData.paypalEnabled && paypalClientId && (
                  <div className="lg:hidden mb-2">
                    <Suspense fallback={<div className="animate-pulse bg-gray-100 h-12 rounded-lg" />}>
                      <PayPalPayment
                        amount={totalAmount}
                        currency={offerData.currency}
                        offerId={offerData._id}
                        paypalClientId={paypalClientId}
                        enableVault={!!offerData.upsell?.enabled}
                        abTestId={abTestId}
                        purchaseEventId={`${checkoutSessionId}_paypal_purchase`}
                        selectedOrderBumps={selectedBumps}
                        onSuccess={(paypalSaleId: string, purchaseEventId: string, redirectUrl?: string) => {
                          if (window.fbq) {
                            window.fbq(
                              "track",
                              "Purchase",
                              {
                                content_name: offerData.mainProduct.name,
                                content_ids: [offerData.mainProduct._id],
                                content_type: "product",
                                value: totalAmount / 100,
                                currency: offerData.currency.toUpperCase(),
                                order_id: paypalSaleId,
                              },
                              { eventID: purchaseEventId }
                            );
                          }
                          setSaleId(paypalSaleId);
                          setPaypalRedirectUrl(redirectUrl || null);
                          setPaymentSucceeded(true);
                        }}
                        onError={(msg) => setErrorMessage(msg)}
                        onSwitchPaymentMethod={() => setMethod("creditCard")}
                      />
                    </Suspense>
                  </div>
                )}
              </div>

              {/* COLUNA DIREITA: Resumo do Pedido + Botão */}
              <div className="lg:sticky lg:top-4 lg:self-start space-y-6">
                {/* Resumo do Produto - Desktop Only */}
                <div className="hidden lg:block ">
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

                  {/* Order Bumps aparecem aqui em desktop */}
                  <div className="mt-6">
                    <Suspense fallback={<div className="animate-pulse bg-gray-100 h-32 rounded-lg"></div>}>
                      <OrderBump
                        bumps={offerData.orderBumps}
                        selectedBumps={selectedBumps}
                        onToggleBump={handleToggleBump}
                        currency={offerData.currency}
                      />
                    </Suspense>
                  </div>

                  {/* Botão PayPal - Desktop */}
                  {method === "paypal" && offerData.paypalEnabled && paypalClientId && (
                    <div className="mt-6">
                      <Suspense fallback={<div className="animate-pulse bg-gray-100 h-12 rounded-lg" />}>
                        <PayPalPayment
                          amount={totalAmount}
                          currency={offerData.currency}
                          offerId={offerData._id}
                          paypalClientId={paypalClientId}
                          enableVault={!!offerData.upsell?.enabled}
                          abTestId={abTestId}
                          purchaseEventId={`${checkoutSessionId}_paypal_purchase`}
                          selectedOrderBumps={selectedBumps}
                          onSuccess={(paypalSaleId: string, purchaseEventId: string, redirectUrl?: string) => {
                            if (window.fbq) {
                              window.fbq(
                                "track",
                                "Purchase",
                                {
                                  content_name: offerData.mainProduct.name,
                                  content_ids: [offerData.mainProduct._id],
                                  content_type: "product",
                                  value: totalAmount / 100,
                                  currency: offerData.currency.toUpperCase(),
                                  order_id: paypalSaleId,
                                },
                                { eventID: purchaseEventId }
                              );
                            }
                            setSaleId(paypalSaleId);
                            setPaypalRedirectUrl(redirectUrl || null);
                            setPaymentSucceeded(true);
                          }}
                          onError={(msg) => setErrorMessage(msg)}
                          onSwitchPaymentMethod={() => setMethod("creditCard")}
                        />
                      </Suspense>
                    </div>
                  )}
                </div>

                {/* Botão e Trust Badges - Mobile e Desktop */}
                {method !== "wallet" && method !== "paypal" && (
                  <button
                    type="submit"
                    disabled={!stripe || loading || paymentSucceeded}
                    className="w-full font-bold py-[12px] px-6 rounded-md text-lg transition-all duration-300 disabled:opacity-50 hover:opacity-90 cursor-pointer shadow-lg hover:shadow-xl relative overflow-hidden group"
                    style={{
                      backgroundColor: loading || paymentSucceeded ? "#ccc" : button,
                      color: buttonForeground,
                      opacity: loading || paymentSucceeded ? 0.7 : 1,
                    }}
                  >
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-linear-to-r from-transparent via-white/20 to-transparent"></div>
                    <span className="relative flex items-center justify-center gap-2 whitespace-nowrap">
                      {loading || paymentSucceeded ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          {t.buttons.processing}
                        </>
                      ) : (
                        <>
                          <Lock className="h-5 w-5" />
                          <span>
                            {method === "pix" ? t.buttons.submitPix : `${t.buttons.submit} - ${formatCurrency(totalAmount, offerData.currency)}`}
                          </span>
                        </>
                      )}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Mensagem de Erro (fora do grid, abaixo de tudo) */}
            {errorMessage && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-red-700 text-sm font-medium">{errorMessage}</p>
                    <button onClick={() => setErrorMessage(null)} className="text-red-600 text-xs underline mt-1 hover:text-red-800">
                      Tentar novamente
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  );
};
