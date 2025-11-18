import React, { useState, useEffect, useMemo } from "react";
import { useStripe, useElements, CardNumberElement } from "@stripe/react-stripe-js";
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
  const { button, buttonForeground } = useTheme();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [method, setMethod] = useState<"creditCard" | "pix">("creditCard");
  const [selectedBumps, setSelectedBumps] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [totalAmount, setTotalAmount] = useState(offerData.mainProduct.priceInCents);

  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);

  const metadata = useMemo(() => {
    return {
      utm_source: urlParams.get("utm_source") || null,
      utm_medium: urlParams.get("utm_medium") || null,
      utm_campaign: urlParams.get("utm_campaign") || null,
      utm_term: urlParams.get("utm_term") || null,
      utm_content: urlParams.get("utm_content") || null,
      // Também adicionamos o UserAgent aqui, conforme discutimos
      userAgent: navigator.userAgent,
      // O IP não pode ser pego pelo frontend de forma confiável
      ip: null,
    };
  }, [urlParams]);

  useEffect(() => {
    let newTotal = offerData.mainProduct.priceInCents * quantity;

    selectedBumps.forEach((bumpId) => {
      // Usando optional chaining para segurança, caso o bump não seja encontrado
      const bump = offerData.orderBumps.find((b) => b?._id === bumpId);
      if (bump) {
        newTotal += bump.priceInCents;
      }
    });

    setTotalAmount(newTotal);
  }, [selectedBumps, quantity, offerData]);

  // --- NOVA LÓGICA DE REDIRECIONAMENTO ---
  // Este useEffect "escuta" a mudança do 'paymentSucceeded'
  useEffect(() => {
    // Se o pagamento foi bem-sucedido...
    if (paymentSucceeded) {
      // Pegamos o link de upsell da oferta
      const upsellUrl = offerData.upsellLink;

      // Verificamos se o link existe e parece ser uma URL válida
      if (upsellUrl && (upsellUrl.startsWith("http://") || upsellUrl.startsWith("https://"))) {
        console.log(`Pagamento bem-sucedido. Redirecionando para upsell: ${upsellUrl}`);

        // Redireciona o navegador do cliente
        window.location.href = upsellUrl;
      }

      // Se não houver upsellUrl, este useEffect não faz nada,
      // e o componente simplesmente re-renderiza para mostrar a tela
      // de sucesso padrão (definida no 'if (paymentSucceeded)' abaixo).
    }
  }, [paymentSucceeded, offerData.upsellLink]); // Depende do status e do link

  const handleToggleBump = (bumpId: string) => {
    setSelectedBumps((prev) => (prev.includes(bumpId) ? prev.filter((id) => id !== bumpId) : [...prev, bumpId]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setErrorMessage(null);

    const email = (document.getElementById("email") as HTMLInputElement).value;
    const fullName = (document.getElementById("name") as HTMLInputElement).value;
    const phone = (document.getElementById("phone") as HTMLInputElement).value;

    const clientIp = await getClientIP();

    const payload = {
      offerSlug: offerData.slug,
      selectedOrderBumps: selectedBumps,
      contactInfo: {
        email,
        name: fullName,
        phone,
      },

      metadata: {
        ...metadata,
        ip: clientIp,
        userAgent: navigator.userAgent,
      },
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
            billing_details: {
              name: cardName,
              email: email,
              phone: phone,
            },
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

  if (paymentSucceeded) {
    const upsellUrl = offerData.upsellLink;

    if (upsellUrl && (upsellUrl.startsWith("http://") || upsellUrl.startsWith("https://"))) {
      return (
        <div className="p-6 text-center">
          <h2 className="text-2xl font-bold text-gray-800">{t.messages.success}</h2>
          <p className="mt-2 text-gray-700">{t.messages.redirecting || "Redirecionando..."}</p>
        </div>
      );
    }

    // 2. Se NÃO TEMOS link, mostramos a tela de sucesso padrão.
    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl font-bold text-green-600">{t.messages.success}</h2>
        <p className="mt-2 text-gray-700">{t.messages.successDescription}</p>
      </div>
    );
  }

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

            <ContactInfo />

            {offerData.collectAddress && <AddressInfo />}

            <PaymentMethods method={method} setMethod={setMethod} />

            <OrderBump bumps={offerData.orderBumps} selectedBumps={selectedBumps} onToggleBump={handleToggleBump} currency={offerData.currency} />

            <button
              type="submit"
              disabled={!stripe || loading}
              className="w-full mt-8 bg-button text-button-foreground font-bold py-3 px-4 rounded-lg text-lg transition-colors disabled:opacity-50
                   hover:opacity-90 cursor-pointer"
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
