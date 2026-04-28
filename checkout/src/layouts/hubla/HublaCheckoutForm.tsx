import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement, PaymentRequestButtonElement } from "@stripe/react-stripe-js";
import type { PaymentRequest, PaymentRequestPaymentMethodEvent, StripeElementStyle } from "@stripe/stripe-js";
import { Loader2, CheckCircle, ChevronDown, Plus, Lock, CreditCard } from "lucide-react";

import type { OfferData } from "../../pages/CheckoutSlugPage";
import { PixDisplay } from "../../components/checkout/PixDisplay";
import { AppleyPayIcon } from "../../components/icons/appleyPay";
import { GooglePayIcon } from "../../components/icons/googlePay";
import { PayPalIcon } from "../../components/icons/paypal";
import { API_URL } from "../../config/BackendUrl";
import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "../../i18n/I18nContext";
import { getClientIP } from "../../service/getClientIP";
import { getCookie } from "../../helper/getCookie";
import { detectPlatform } from "../../utils/platformDetection";
import { formatCurrency } from "../../helper/formatCurrency";
import type { LayoutProps } from "../LayoutLoader";

const PayPalPayment = lazy(() => import("../../components/checkout/PayPalPayment").then((m) => ({ default: m.PayPalPayment })));
const OrderBump = lazy(() => import("../../components/checkout/OrderBump").then((m) => ({ default: m.OrderBump })));

const STRIPE_STYLE: StripeElementStyle = {
  base: {
    color: "#374151",
    fontFamily: "inherit",
    fontSize: "14px",
    "::placeholder": { color: "#9CA3AF" },
  },
  invalid: { color: "#EF4444", iconColor: "#EF4444" },
};

const STRIPE_STYLE_CENTERED: StripeElementStyle = {
  base: {
    color: "#374151",
    fontFamily: "inherit",
    fontSize: "14px",
    textAlign: "left",
    "::placeholder": { color: "#9CA3AF" },
  },
  invalid: { color: "#EF4444", iconColor: "#EF4444" },
};

const PixIcon: React.FC<{ color?: string }> = ({ color = "#6b7280" }) => (
  <svg className="h-5 w-5" viewBox="0 0 512 512" fill={color}>
    <path d="M242.4 292.5C247.8 287.1 257.1 287.1 262.5 292.5L339.5 369.5C353.7 383.7 372.6 391.5 392.6 391.5H407.7L310.6 488.6C280.3 518.1 231.1 518.1 200.8 488.6L103.3 391.2H112.6C132.6 391.2 151.5 383.4 165.7 369.2L242.4 292.5zM262.5 218.9C257.1 224.3 247.8 224.3 242.4 218.9L165.7 142.2C151.5 127.1 132.6 120.2 112.6 120.2H103.3L200.7 22.8C231.1-7.6 280.3-7.6 310.6 22.8L407.7 119.9H392.6C372.6 119.9 353.7 127.7 339.5 141.9L262.5 218.9zM112.6 142.7C126.4 142.7 139.1 148.3 149.7 158.1L226.4 234.8C233.6 241.1 243 245.6 252.5 245.6C261.9 245.6 271.3 241.1 278.5 234.8L355.5 157.8C365.3 148.1 378.8 142.5 392.6 142.5H430.3L488.6 200.8C518.9 231.1 518.9 280.3 488.6 310.6L430.3 368.9H392.6C378.8 368.9 365.3 363.3 355.5 353.5L278.5 276.5C264.6 262.6 240.3 262.6 226.4 276.5L149.7 353.2C139.1 363 126.4 368.6 112.6 368.6H80.78L22.76 310.6C-7.586 280.3-7.586 231.1 22.76 200.8L80.78 142.7H112.6z" />
  </svg>
);

const HublaInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { primary: string }> = ({ primary, className = "", style, ...props }) => (
  <input
    {...props}
    className={`w-full px-4 py-3 border border-gray-200 rounded-md text-sm outline-none transition-colors duration-150 focus:border-[var(--hp)] ${className}`}
    style={{ "--hp": primary, ...style } as React.CSSProperties}
  />
);

const StripeFieldWrapper: React.FC<{
  label?: string;
  children: React.ReactNode;
  primary: string;
  right?: React.ReactNode;
  className?: string;
}> = ({ label, children, primary, right, className = "" }) => (
  <div
    className={`border border-gray-200 rounded-md mb-0 px-4 pt-2 pb-3 transition-colors duration-150 focus-within:border-[var(--hp)] ${className}`}
    style={{ "--hp": primary } as React.CSSProperties}
  >
    {(label || right) && (
      <div className="flex items-center justify-between mb-1">
        {label && <span className="text-xs text-gray-400">{label}</span>}
        {right}
      </div>
    )}
    {children}
  </div>
);

export const HublaCheckoutForm: React.FC<LayoutProps> = ({ offerData, checkoutSessionId, abTestId }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { button, buttonForeground, backgroundColor, textColor, primary } = useTheme();
  const { t } = useTranslation();

  // Payment state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [paypalRedirectUrl, setPaypalRedirectUrl] = useState<string | null>(null);
  const [pixData, setPixData] = useState<{
    qrCode: string;
    qrCodeUrl: string;
    orderId: string;
    saleId: string;
    expiresAt: string;
  } | null>(null);

  // Contact state
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [docValue, setDocValue] = useState("");
  const checkoutStartedSent = useRef(false);
  const nameUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI state
  const [showDetails, setShowDetails] = useState(false);
  const [couponExpanded, setCouponExpanded] = useState(false);

  // Payment method
  const isSubscription = offerData.paymentType === "subscription";
  const effectivePaypalEnabled = isSubscription ? false : offerData.paypalEnabled;
  const effectivePixEnabled = isSubscription ? false : offerData.pagarme_pix_enabled;

  const [method, setMethod] = useState<"creditCard" | "pix" | "wallet" | "paypal">(() => {
    if (offerData.stripe_card_enabled === false && !isSubscription) {
      if (effectivePixEnabled) return "pix";
      if (effectivePaypalEnabled) return "paypal";
    }
    return "creditCard";
  });

  const [selectedBumps, setSelectedBumps] = useState<string[]>([]);
  const [totalAmount, setTotalAmount] = useState(offerData.mainProduct.priceInCents);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [walletLabel, setWalletLabel] = useState<string | null>(null);
  const [paypalClientId, setPaypalClientId] = useState<string | null>(null);

  const addPaymentInfoEventId = useRef<string | null>(null);
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const utmData = useMemo(
    () => ({
      utm_source: urlParams.get("utm_source") || null,
      utm_medium: urlParams.get("utm_medium") || null,
      utm_campaign: urlParams.get("utm_campaign") || null,
      utm_term: urlParams.get("utm_term") || null,
      utm_content: urlParams.get("utm_content") || null,
    }),
    [urlParams],
  );

  const isContactValid = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return contactName.trim().length >= 2 && emailRegex.test(contactEmail.trim());
  }, [contactName, contactEmail]);

  // Count available methods (to decide whether to show tabs)
  const availableMethodsCount = useMemo(() => {
    let count = 0;
    if (offerData.stripe_card_enabled !== false) count++;
    if (effectivePixEnabled) count++;
    if (effectivePaypalEnabled) count++;
    if (paymentRequest && walletLabel) count++;
    return count;
  }, [offerData.stripe_card_enabled, effectivePixEnabled, effectivePaypalEnabled, paymentRequest, walletLabel]);

  // Update total based on bumps
  useEffect(() => {
    let newTotal = offerData.mainProduct.priceInCents;
    selectedBumps.forEach((bumpId) => {
      const bump = offerData.orderBumps.find((b) => b?._id === bumpId);
      if (bump) newTotal += bump.priceInCents;
    });
    setTotalAmount(newTotal);
  }, [selectedBumps, offerData]);

  // Reset method guards
  useEffect(() => {
    if (method === "paypal" && !effectivePaypalEnabled) setMethod("creditCard");
  }, [method, effectivePaypalEnabled]);

  useEffect(() => {
    if (method === "creditCard" && offerData.stripe_card_enabled === false) {
      if (effectivePixEnabled) setMethod("pix");
      else if (effectivePaypalEnabled) setMethod("paypal");
    }
  }, [method, offerData.stripe_card_enabled, effectivePixEnabled, effectivePaypalEnabled]);

  // Fetch PayPal client ID
  useEffect(() => {
    if (effectivePaypalEnabled && offerData._id) {
      fetch(`${API_URL}/paypal/client-id/${offerData._id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.clientId) setPaypalClientId(data.clientId);
        })
        .catch((err) => console.error("Failed to fetch PayPal client ID:", err));
    }
  }, [effectivePaypalEnabled, offerData._id]);

  // Set up Apple/Google Pay
  useEffect(() => {
    if (!stripe || offerData.stripe_card_enabled === false) {
      setPaymentRequest(null);
      return;
    }

    const normalizedCurrency = offerData.currency.toLowerCase();
    const countryCode = normalizedCurrency === "brl" ? "BR" : "US";

    const pr = stripe.paymentRequest({
      country: countryCode,
      currency: normalizedCurrency,
      total: { label: offerData.mainProduct.name, amount: totalAmount },
      requestPayerName: true,
      requestPayerEmail: true,
      requestPayerPhone: offerData.collectPhone,
    });

    pr.canMakePayment()
      .then((result) => {
        if (!result) return;

        const platform = detectPlatform();
        let label = t.payment.wallet;
        if (platform === "ios") label = t.payment.applePay;
        else if (platform === "android") label = t.payment.googlePay;
        else if (result.applePay) label = t.payment.applePay;
        else if (result.googlePay) label = t.payment.googlePay;

        setWalletLabel(label);
        setPaymentRequest(pr);
      })
      .catch(() => {});

    pr.on("paymentmethod", async (ev: PaymentRequestPaymentMethodEvent) => {
      try {
        setLoading(true);
        const clientIp = await getClientIP();
        const purchaseEventId = `${checkoutSessionId}_applepay_purchase`;
        const fbCookies = { fbc: getCookie("_fbc"), fbp: getCookie("_fbp") };

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
            purchaseEventId,
            abTestId: abTestId ?? null,
          },
        };

        const res = await fetch(`${API_URL}/payments/create-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error?.message || "Erro ao criar pagamento");
        }

        const { clientSecret, error: backendError } = await res.json();

        if (backendError) {
          ev.complete("fail");
          setErrorMessage(backendError.message);
          setLoading(false);
          return;
        }

        const { error: confirmError, paymentIntent } = await stripe!.confirmCardPayment(clientSecret, { payment_method: ev.paymentMethod.id });

        if (confirmError) {
          ev.complete("fail");
          setErrorMessage(confirmError.message || t.messages.paymentError);
          setLoading(false);
        } else {
          ev.complete("success");
          if (paymentIntent?.status === "succeeded") {
            setPaymentIntentId(paymentIntent.id);
            setPaymentSucceeded(true);
          } else if (paymentIntent?.status === "requires_action") {
            const { error: actionError } = await stripe!.confirmCardPayment(clientSecret);
            if (actionError) {
              ev.complete("fail");
              setErrorMessage(actionError.message || t.messages.authError);
              setLoading(false);
            } else {
              ev.complete("success");
              setPaymentIntentId(paymentIntent.id);
              setPaymentSucceeded(true);
            }
          } else {
            ev.complete("fail");
            setErrorMessage(t.messages.paymentNotApproved);
            setLoading(false);
          }
        }
      } catch (err: any) {
        ev.complete("fail");
        setErrorMessage(err.message || t.messages.unexpectedError);
        setLoading(false);
      }
    });
  }, [
    stripe,
    offerData.stripe_card_enabled,
    offerData.currency,
    offerData.mainProduct.name,
    offerData.collectPhone,
    selectedBumps,
    totalAmount,
    utmData,
    t,
  ]);

  // Update wallet total on amount change
  useEffect(() => {
    if (paymentRequest) {
      paymentRequest.update({
        total: { label: offerData.mainProduct.name, amount: totalAmount },
      });
    }
  }, [totalAmount, paymentRequest, offerData.mainProduct.name]);

  // Success redirect
  useEffect(() => {
    if (!paymentSucceeded || (!paymentIntentId && !saleId)) return;

    const timer = setTimeout(async () => {
      if (saleId && !paymentIntentId) {
        if (paypalRedirectUrl) {
          window.location.href = paypalRedirectUrl;
          return;
        }
        if (offerData.upsell?.enabled && offerData.upsell?.redirectUrl) {
          window.location.href = offerData.upsell.redirectUrl;
          return;
        }
        if (offerData.thankYouPageUrl) {
          window.location.href = offerData.thankYouPageUrl;
          return;
        }
        const p = new URLSearchParams();
        p.append("offerName", offerData.mainProduct.name);
        p.append("lang", offerData.language || "pt");
        navigate(`/success?${p.toString()}`);
        return;
      }

      if (offerData.upsell?.enabled && offerData.upsell?.redirectUrl && paymentIntentId) {
        try {
          const response = await fetch(`${API_URL}/payments/upsell-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentIntentId, offerSlug: offerData.slug }),
          });
          const data = await response.json();
          if (data.redirectUrl) {
            window.location.href = data.redirectUrl;
            return;
          }
        } catch {}
      }

      if (offerData.thankYouPageUrl) {
        window.location.href = offerData.thankYouPageUrl;
        return;
      }

      const p = new URLSearchParams();
      p.append("offerName", offerData.mainProduct.name);
      p.append("lang", offerData.language || "pt");
      navigate(`/success?${p.toString()}`);
    }, 2000);

    return () => clearTimeout(timer);
  }, [paymentSucceeded, paymentIntentId, saleId, paypalRedirectUrl, offerData, navigate]);

  // Contact handlers with tracking
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setContactEmail(email);

    if (email.length >= 4 && email.includes("@") && !checkoutStartedSent.current) {
      checkoutStartedSent.current = true;

      fetch(`${API_URL}/offers/checkout-started`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: offerData._id }),
      }).catch(() => {});

      fetch(`${API_URL}/metrics/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: offerData._id,
          type: "initiate_checkout",
          email,
          name: contactName,
        }),
      }).catch(() => {});

      if (abTestId) {
        fetch(`${API_URL}/abtests/track`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ abTestId, offerId: offerData._id, type: "initiate_checkout" }),
        }).catch(() => {});
      }
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setContactName(name);
    if (checkoutStartedSent.current && contactEmail && name.length >= 2) {
      if (nameUpdateTimer.current) clearTimeout(nameUpdateTimer.current);
      nameUpdateTimer.current = setTimeout(() => {
        fetch(`${API_URL}/metrics/track`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offerId: offerData._id,
            type: "initiate_checkout",
            email: contactEmail,
            name,
          }),
        }).catch(() => {});
      }, 1000);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "").slice(0, 11);
    if (value.length > 10) value = value.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    else if (value.length > 6) value = value.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    else if (value.length > 2) value = value.replace(/^(\d{2})(\d{0,4})/, "($1) $2");
    else if (value.length > 0) value = value.replace(/^(\d{0,2})/, "($1");
    setPhone(value);
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 14) value = value.slice(0, 14);
    if (value.length <= 11) {
      value = value
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      value = value
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    setDocValue(value);
  };

  const handleToggleBump = (bumpId: string) => {
    setSelectedBumps((prev) => (prev.includes(bumpId) ? prev.filter((id) => id !== bumpId) : [...prev, bumpId]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      setErrorMessage(t.messages.stripeNotLoaded);
      return;
    }
    setErrorMessage(null);

    if (!contactEmail || !contactName) {
      setErrorMessage(t.messages.requiredFields);
      return;
    }

    const cardElement = elements.getElement(CardNumberElement);
    if (method === "creditCard" && !cardElement) {
      setErrorMessage(t.messages.cardNotInitialized);
      return;
    }

    const cardNameInput = window.document.getElementById("hubla-card-name") as HTMLInputElement;
    const cardName = cardNameInput?.value || "";

    setLoading(true);

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
        { eventID: eventId },
      );
    }

    const fbCookies = { fbc: getCookie("_fbc"), fbp: getCookie("_fbp") };

    try {
      const clientIp = await getClientIP();
      const purchaseEventId = `${checkoutSessionId}_purchase`;

      const payload = {
        offerSlug: offerData.slug,
        selectedOrderBumps: selectedBumps,
        contactInfo: {
          email: contactEmail,
          name: contactName,
          phone,
          document: docValue,
        },
        metadata: {
          ...utmData,
          ip: clientIp,
          userAgent: navigator.userAgent,
          fbc: fbCookies.fbc,
          fbp: fbCookies.fbp,
          addPaymentInfoEventId: addPaymentInfoEventId.current,
          purchaseEventId,
          abTestId: abTestId ?? null,
        },
      };

      if (method === "creditCard") {
        const res = await fetch(`${API_URL}/payments/create-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error?.message || "Erro ao criar pagamento");
        }

        const { clientSecret, error: backendError } = await res.json();
        if (backendError) throw new Error(backendError.message);

        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement!,
            billing_details: { name: cardName, email: contactEmail, phone },
          },
          receipt_email: contactEmail,
        });

        if (error) throw error;

        if (paymentIntent.status === "succeeded") {
          setPaymentIntentId(paymentIntent.id);
          setPaymentSucceeded(true);
        } else {
          throw new Error(`Pagamento nao aprovado. Status: ${paymentIntent.status}`);
        }
      } else if (method === "pix") {
        const res = await fetch(`${API_URL}/payments/pagarme/pix`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error?.message || "Erro ao gerar PIX");
        }

        const pixResponse = await res.json();
        if (!pixResponse.success) throw new Error(pixResponse.error?.message || "Erro ao gerar PIX");

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

  // --- Render: Success ---
  if (paymentSucceeded) {
    return (
      <div className="min-h-screen w-full bg-white flex items-center justify-center">
        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75" />
            <div className="relative bg-white rounded-full p-2">
              <CheckCircle className="h-24 w-24 text-green-500" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Render: PIX QR ---
  if (pixData) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 animate-in fade-in duration-500" style={{ backgroundColor }}>
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

  // --- Render: Main ---
  return (
    <>
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: `${backgroundColor}CC` }}>
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-14 w-14 animate-spin" style={{ color: primary }} />
            <p className="text-sm font-medium animate-pulse" style={{ color: textColor }}>
              {t.buttons.processing}
            </p>
          </div>
        </div>
      )}

      {/* Full-width banner */}
      {offerData.bannerImageUrl && (
        <div className="w-full overflow-hidden" style={{ maxHeight: "260px" }}>
          <img src={offerData.bannerImageUrl} alt="Banner da oferta" className="w-full h-full object-cover" fetchPriority="high" loading="eager" />
        </div>
      )}

      {/* Main content */}
      <div className="min-h-screen pb-10" style={{ backgroundColor, color: textColor }}>
        <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
          {/* Product card */}
          <div className="border rounded-lg p-3 shadow-sm" style={{ borderColor: `${textColor}18`, backgroundColor: "white" }}>
            <div className="flex items-start gap-3">
              {offerData.mainProduct.imageUrl && (
                <img
                  src={offerData.mainProduct.imageUrl}
                  alt={offerData.mainProduct.name}
                  className="w-12 h-12 rounded-md object-cover shrink-0 border border-gray-100"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-snug text-gray-800 line-clamp-2">{offerData.mainProduct.name}</p>
                  <button
                    type="button"
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-0.5 text-xs text-gray-400 shrink-0 hover:text-gray-600 transition-colors"
                  >
                    Detalhes
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`} />
                  </button>
                </div>
                <p className="text-sm font-bold mt-1" style={{ color: primary }}>
                  {formatCurrency(totalAmount, offerData.currency)}
                </p>
              </div>
            </div>

            {showDetails && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                {offerData.mainProduct.description ? (
                  <p className="text-xs text-gray-500 leading-relaxed">{offerData.mainProduct.description}</p>
                ) : (
                  <p className="text-xs text-gray-400">Sem descricao disponivel.</p>
                )}
              </div>
            )}

            {/* Coupon row */}
            <div className="mt-2 pt-2 border-t border-gray-100">
              {!couponExpanded ? (
                <button
                  type="button"
                  onClick={() => setCouponExpanded(true)}
                  className="flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-75"
                  style={{ color: primary }}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar cupom
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Codigo do cupom"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm outline-none focus:border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={() => setCouponExpanded(false)}
                    className="px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Order bumps */}
          {offerData.orderBumps.length > 0 && (
            <Suspense fallback={null}>
              <OrderBump bumps={offerData.orderBumps} selectedBumps={selectedBumps} onToggleBump={handleToggleBump} currency={offerData.currency} />
            </Suspense>
          )}

          {/* Main form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Contact section */}
            <div>
              <h2 className="text-sm font-semibold mb-3" style={{ color: textColor }}>
                {t.contact.title}
              </h2>
              <div className="space-y-2">
                <HublaInput
                  id="name"
                  type="text"
                  placeholder={t.contact.namePlaceholder}
                  required
                  value={contactName}
                  onChange={handleNameChange}
                  primary={primary}
                />
                <HublaInput
                  id="email"
                  type="email"
                  placeholder={t.contact.emailPlaceholder}
                  required
                  value={contactEmail}
                  onChange={handleEmailChange}
                  primary={primary}
                />
                {offerData.collectPhone && (
                  <div
                    className="flex border border-gray-200 rounded-md overflow-hidden transition-colors duration-150 focus-within:border-[var(--hp)]"
                    style={{ "--hp": primary } as React.CSSProperties}
                  >
                    <div className="flex items-center gap-1 px-3 bg-gray-50 border-r border-gray-200 text-sm text-gray-500 shrink-0 select-none">
                      <span>🇧🇷</span>
                      <span className="text-xs">+55</span>
                    </div>
                    <input
                      id="phone"
                      type="tel"
                      placeholder={t.contact.phonePlaceholder || "(00) 00000-0000"}
                      value={phone}
                      onChange={handlePhoneChange}
                      maxLength={15}
                      className="flex-1 px-4 py-3 text-sm outline-none bg-white"
                      style={{ color: textColor }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Payment method tabs — only shown when more than 1 method */}
            {availableMethodsCount > 1 && (
              <div>
                <h2 className="text-sm font-semibold mb-3" style={{ color: textColor }}>
                  {t.payment.title}
                </h2>
                <div className="flex gap-2">
                  {/* Credit card */}
                  {offerData.stripe_card_enabled !== false && (
                    <button
                      type="button"
                      onClick={() => setMethod("creditCard")}
                      className="flex-1 flex flex-col gap-1.5 py-3 px-2 border rounded-md transition-all duration-200 text-left"
                      style={{
                        borderColor: method === "creditCard" ? primary : "#e5e7eb",
                        borderWidth: method === "creditCard" ? "2px" : "1px",
                        backgroundColor: method === "creditCard" ? `${primary}0d` : "white",
                      }}
                    >
                      <CreditCard className="h-5 w-5" style={{ color: method === "creditCard" ? primary : "#9ca3af" }} />
                      <span className="text-xs font-medium" style={{ color: method === "creditCard" ? primary : "#6b7280" }}>
                        {t.payment.creditCard}
                      </span>
                    </button>
                  )}

                  {/* PIX */}
                  {effectivePixEnabled && (
                    <button
                      type="button"
                      onClick={() => setMethod("pix")}
                      className="flex-1 flex flex-col text-left gap-1.5 py-3 px-2 border items-baseline rounded-md transition-all duration-200"
                      style={{
                        borderColor: method === "pix" ? primary : "#e5e7eb",
                        borderWidth: method === "pix" ? "2px" : "1px",
                        backgroundColor: method === "pix" ? `${primary}0d` : "white",
                      }}
                    >
                      <PixIcon color={method === "pix" ? primary : "#9ca3af"} />
                      <span className="text-xs font-medium" style={{ color: method === "pix" ? primary : "#6b7280" }}>
                        Pix
                      </span>
                    </button>
                  )}

                  {/* PayPal */}
                  {effectivePaypalEnabled && paypalClientId && (
                    <button
                      type="button"
                      onClick={() => setMethod("paypal")}
                      className="flex-1 flex flex-col text-left gap-1.5 py-3 px-2 border items-baseline rounded-md transition-all duration-200"
                      style={{
                        borderColor: method === "paypal" ? primary : "#e5e7eb",
                        borderWidth: method === "paypal" ? "2px" : "1px",
                        backgroundColor: method === "paypal" ? `${primary}0d` : "white",
                      }}
                    >
                      <div style={{ opacity: method === "paypal" ? 1 : 0.5 }}>
                        <PayPalIcon className="h-5 w-auto" />
                      </div>
                      <span className="text-xs font-medium" style={{ color: method === "paypal" ? primary : "#6b7280" }}>
                        PayPal
                      </span>
                    </button>
                  )}

                  {/* Wallet (Apple/Google Pay) */}
                  {paymentRequest && walletLabel && (
                    <button
                      type="button"
                      onClick={() => setMethod("wallet")}
                      className="flex-1 flex flex-col text-left gap-1.5 py-3 px-2 border items-baseline rounded-md transition-all duration-200"
                      style={{
                        borderColor: method === "wallet" ? primary : "#e5e7eb",
                        borderWidth: method === "wallet" ? "2px" : "1px",
                        backgroundColor: method === "wallet" ? `${primary}0d` : "white",
                      }}
                    >
                      {walletLabel === t.payment.applePay ? <AppleyPayIcon className="h-6 w-auto" /> : <GooglePayIcon className="h-6 w-auto" />}
                      <span className="text-xs font-medium" style={{ color: method === "wallet" ? primary : "#6b7280" }}>
                        {walletLabel}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Credit card form */}
            {method === "creditCard" && (
              <div className="space-y-2">
                {/* Card number with brand icons */}
                <StripeFieldWrapper
                  label={t.creditCard.cardNumber}
                  primary={primary}
                  className="rounded-b-none"
                  right={
                    <div className="flex gap-1 items-center">
                      <img src="https://assets.mycartpanda.com/cartx-ecomm-ui-assets/images/payment/visa.svg" className="h-4" alt="Visa" />
                      <img
                        src="https://assets.mycartpanda.com/cartx-ecomm-ui-assets/images/payment/mastercard.svg"
                        className="h-4"
                        alt="Mastercard"
                      />
                    </div>
                  }
                >
                  <CardNumberElement id="card-number" options={{ style: STRIPE_STYLE }} />
                </StripeFieldWrapper>

                {/* Expiry + CVV side by side */}
                <div className="grid grid-cols-2">
                  <StripeFieldWrapper primary={primary} className="border-t-0 rounded-b-none rounded-t-none border-r-0">
                    <CardExpiryElement id="card-expiry" options={{ style: STRIPE_STYLE_CENTERED }} />
                  </StripeFieldWrapper>
                  <StripeFieldWrapper primary={primary} className="border-t-0 rounded-b-none rounded-t-none">
                    <CardCvcElement id="card-cvv" options={{ style: STRIPE_STYLE_CENTERED }} />
                  </StripeFieldWrapper>
                </div>

                {/* Cardholder name */}
                <HublaInput id="hubla-card-name" type="text" placeholder={t.creditCard.cardholderNamePlaceholder} primary={primary} />

                {/* Document */}
                {offerData.collectDocument && (
                  <HublaInput
                    id="document"
                    type="text"
                    placeholder="CPF/CNPJ do titular do cartao"
                    value={docValue}
                    onChange={handleDocumentChange}
                    maxLength={18}
                    primary={primary}
                  />
                )}
              </div>
            )}

            {/* PIX info */}
            {method === "pix" && (
              <div className="p-4 bg-gray-50 rounded-md border border-gray-100 text-center space-y-1">
                <PixIcon color={primary} />
                <p className="text-sm text-gray-600 mt-2">Ao clicar em continuar, um QR Code PIX sera gerado para voce escanear.</p>
              </div>
            )}

            {/* Wallet button */}
            {method === "wallet" && paymentRequest && (
              <div className="h-12 w-full">
                <PaymentRequestButtonElement options={{ paymentRequest }} className="w-full h-full" />
              </div>
            )}

            {/* PayPal */}
            {method === "paypal" &&
              effectivePaypalEnabled &&
              paypalClientId &&
              (!isContactValid ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-md text-center">
                  <p className="text-amber-700 text-sm font-medium">
                    {t.messages?.fillRequiredFields || "Preencha seu nome e e-mail para continuar"}
                  </p>
                </div>
              ) : (
                <Suspense fallback={<div className="animate-pulse bg-gray-100 h-12 rounded-md" />}>
                  <PayPalPayment
                    amount={totalAmount}
                    currency={offerData.currency}
                    offerId={offerData._id}
                    paypalClientId={paypalClientId}
                    enableVault={!!offerData.upsell?.enabled}
                    abTestId={abTestId}
                    purchaseEventId={`${checkoutSessionId}_paypal_purchase`}
                    selectedOrderBumps={selectedBumps}
                    utmData={utmData}
                    onSuccess={(paypalSaleId: string, _purchaseEventId: string, redirectUrl?: string) => {
                      setSaleId(paypalSaleId);
                      setPaypalRedirectUrl(redirectUrl || null);
                      setPaymentSucceeded(true);
                    }}
                    onError={(msg) => setErrorMessage(msg)}
                    onSwitchPaymentMethod={() => setMethod("creditCard")}
                  />
                </Suspense>
              ))}

            {/* Submit button */}
            {method !== "wallet" && method !== "paypal" && (
              <button
                type="submit"
                disabled={!stripe || loading || paymentSucceeded || !isContactValid}
                className="w-full font-bold py-4 px-6 text-base rounded-xs transition-all duration-200 disabled:cursor-not-allowed relative overflow-hidden group"
                style={{
                  backgroundColor: loading || paymentSucceeded || !isContactValid ? "#d1d5db" : button,
                  color: loading || paymentSucceeded || !isContactValid ? "#9ca3af" : buttonForeground,
                }}
              >
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                <span className="relative flex items-center justify-center gap-2">
                  {loading || paymentSucceeded ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {t.buttons.processing}
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      {method === "pix" ? t.buttons.submitPix : `${t.buttons.submit} - ${formatCurrency(totalAmount, offerData.currency)}`}
                    </>
                  )}
                </span>
              </button>
            )}

            {/* Error */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-start gap-2">
                  <svg className="h-4 w-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-red-700 text-sm">{errorMessage}</p>
                    <button type="button" onClick={() => setErrorMessage(null)} className="text-red-600 text-xs underline mt-1 hover:text-red-800">
                      {t.messages.retry}
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
