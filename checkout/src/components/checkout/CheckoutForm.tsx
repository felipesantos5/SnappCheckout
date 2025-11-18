import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useStripe, useElements, CardNumberElement, PaymentRequestButtonElement } from "@stripe/react-stripe-js";
import type { PaymentRequest, PaymentRequestPaymentMethodEvent } from "@stripe/stripe-js"; // Tipos do Stripe
// Tipos do Stripe
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
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [method, setMethod] = useState<"creditCard" | "pix">("creditCard");
  const [selectedBumps, setSelectedBumps] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [totalAmount, setTotalAmount] = useState(offerData.mainProduct.priceInCents);

  // [Alteração] Estado para armazenar o objeto de solicitação de pagamento (Wallet)
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);

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

  // [Alteração] Inicializa o Payment Request (Apple/Google Pay)
  useEffect(() => {
    if (!stripe) return;

    const pr = stripe.paymentRequest({
      country: "BR", // Ajuste conforme o país da conta Stripe conectada
      currency: offerData.currency.toLowerCase(),
      total: {
        label: offerData.mainProduct.name,
        amount: totalAmount,
      },
      requestPayerName: true,
      requestPayerEmail: true,
      requestPayerPhone: offerData.collectPhone,
    });

    // Verifica se o navegador suporta carteira digital
    pr.canMakePayment().then((result) => {
      if (result) {
        setPaymentRequest(pr);
      }
    });

    // Handler: Quando o usuário autoriza o pagamento na carteira (TouchID/FaceID)
    pr.on("paymentmethod", async (ev: PaymentRequestPaymentMethodEvent) => {
      try {
        // 1. Preparar payload usando dados retornados pela Wallet (ev.payer...)
        const clientIp = await getClientIP();

        const payload = {
          offerSlug: offerData.slug,
          selectedOrderBumps: selectedBumps,
          contactInfo: {
            email: ev.payerEmail, // Email vindo da Apple/Google
            name: ev.payerName, // Nome vindo da Apple/Google
            phone: ev.payerPhone || "",
          },
          metadata: {
            ...utmData,
            ip: clientIp,
            userAgent: navigator.userAgent,
          },
        };

        // 2. Criar PaymentIntent no backend
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

        // 3. Confirmar o pagamento no Stripe usando o método criado pela Wallet
        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false } // Deixe o Stripe lidar com confirmação extra se necessário
        );

        if (confirmError) {
          ev.complete("fail");
          setErrorMessage(confirmError.message || "Erro no pagamento");
        } else {
          // Sucesso!
          ev.complete("success");
          if (paymentIntent?.status === "succeeded") {
            setPaymentSucceeded(true);
          }
        }
      } catch (err: any) {
        ev.complete("fail");
        setErrorMessage(err.message || "Erro inesperado");
      }
    });
  }, [stripe]); // Executa uma vez quando o Stripe carrega (não inclua dependências que mudam muito aqui)

  // [Alteração] Atualiza o valor no botão da Wallet quando o usuário muda o carrinho
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

  // Efeito de redirecionamento para a página de sucesso
  useEffect(() => {
    if (paymentSucceeded) {
      const params = new URLSearchParams();

      // Adicionar upsellLink se existir
      if (offerData.upsellLink) {
        params.append("upsellLink", offerData.upsellLink);
      }

      // Adicionar nome da oferta
      params.append("offerName", offerData.mainProduct.name);

      // Navegar para a página de sucesso
      navigate(`/success?${params.toString()}`);
    }
  }, [paymentSucceeded, offerData.upsellLink, offerData.mainProduct.name, navigate]);

  // Toggle Bump (código existente)
  const handleToggleBump = (bumpId: string) => {
    setSelectedBumps((prev) => (prev.includes(bumpId) ? prev.filter((id) => id !== bumpId) : [...prev, bumpId]));
  };

  // Submit do formulário normal (código existente)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setErrorMessage(null);

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

        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: { name: cardName, email: email, phone: phone },
          },
          receipt_email: email,
        });

        if (error) throw error;

        if (paymentIntent.status === "succeeded") {
          setPaymentSucceeded(true);
        }
      } else if (method === "pix") {
        setErrorMessage(t.messages.pixNotImplemented);
      }
    } catch (error: any) {
      setErrorMessage(error.message || t.messages.error);
    }

    setLoading(false);
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

            {paymentRequest && (
              <div className="mb-6 mt-4">
                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Checkout Expresso</span>
                  </div>
                </div>
                {/* O botão precisa de altura definida para renderizar corretamente */}
                <div className="h-12 w-full">
                  <PaymentRequestButtonElement options={{ paymentRequest }} className="w-full h-full" />
                </div>
              </div>
            )}

            <ContactInfo showPhone={offerData.collectPhone} />

            {offerData.collectAddress && <AddressInfo />}

            <PaymentMethods method={method} setMethod={setMethod} />

            <OrderBump bumps={offerData.orderBumps} selectedBumps={selectedBumps} onToggleBump={handleToggleBump} currency={offerData.currency} />

            <button
              type="submit"
              disabled={!stripe || loading}
              className="w-full mt-8 bg-button text-button-foreground font-bold py-3 px-4 rounded-lg text-lg transition-colors disabled:opacity-50 hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: loading ? "#ccc" : button,
                color: buttonForeground,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? t.buttons.processing : method === "pix" ? t.buttons.submitPix : t.buttons.submit}
            </button>

            {errorMessage && <div className="text-red-500 text-sm text-center mt-4">{errorMessage}</div>}
          </form>
        </div>
      </div>
    </>
  );
};
