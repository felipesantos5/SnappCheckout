import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement, PaymentRequestButtonElement } from "@stripe/react-stripe-js";
import type { PaymentRequest, PaymentRequestPaymentMethodEvent, StripeElementStyle } from "@stripe/stripe-js";
import { Loader2, CheckCircle, ChevronDown, Plus, Lock, CreditCard, Check } from "lucide-react";

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
import { PhoneInput } from "../../components/checkout/PhoneInput";

const PayPalPayment = lazy(() => import("../../components/checkout/PayPalPayment").then((m) => ({ default: m.PayPalPayment })));


const PixIcon: React.FC<{ color?: string }> = ({ color = "#6b7280" }) => (
  <svg className="h-5 w-5" viewBox="0 0 512 512" fill={color}>
    <path d="M242.4 292.5C247.8 287.1 257.1 287.1 262.5 292.5L339.5 369.5C353.7 383.7 372.6 391.5 392.6 391.5H407.7L310.6 488.6C280.3 518.1 231.1 518.1 200.8 488.6L103.3 391.2H112.6C132.6 391.2 151.5 383.4 165.7 369.2L242.4 292.5zM262.5 218.9C257.1 224.3 247.8 224.3 242.4 218.9L165.7 142.2C151.5 127.1 132.6 120.2 112.6 120.2H103.3L200.7 22.8C231.1-7.6 280.3-7.6 310.6 22.8L407.7 119.9H392.6C372.6 119.9 353.7 127.7 339.5 141.9L262.5 218.9zM112.6 142.7C126.4 142.7 139.1 148.3 149.7 158.1L226.4 234.8C233.6 241.1 243 245.6 252.5 245.6C261.9 245.6 271.3 241.1 278.5 234.8L355.5 157.8C365.3 148.1 378.8 142.5 392.6 142.5H430.3L488.6 200.8C518.9 231.1 518.9 280.3 488.6 310.6L430.3 368.9H392.6C378.8 368.9 365.3 363.3 355.5 353.5L278.5 276.5C264.6 262.6 240.3 262.6 226.4 276.5L149.7 353.2C139.1 363 126.4 368.6 112.6 368.6H80.78L22.76 310.6C-7.586 280.3-7.586 231.1 22.76 200.8L80.78 142.7H112.6z" />
  </svg>
);

const HublaInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & {
    primary: string;
    borderColor?: string;
    focusBorderColor?: string;
  }
> = ({ primary, borderColor = "#e5e7eb", focusBorderColor, className = "", style, onFocus, onBlur, ...props }) => (
  <input
    {...props}
    className={`w-full px-4 border rounded-md text-sm outline-none transition-colors duration-150 focus:relative focus:z-10 placeholder:text-[#6b7280] ${className}`}
    style={{ borderColor, height: "48px", ...style } as React.CSSProperties}
    onFocus={(e) => { e.currentTarget.style.borderColor = focusBorderColor ?? primary; onFocus?.(e); }}
    onBlur={(e) => { e.currentTarget.style.borderColor = borderColor; onBlur?.(e); }}
  />
);

const StripeFieldWrapper: React.FC<{
  label?: string;
  children: React.ReactNode;
  primary: string;
  right?: React.ReactNode;
  className?: string;
  isFocused?: boolean;
  borderColor?: string;
  focusBorderColor?: string;
  labelColor?: string;
}> = ({ label, children, primary, right, className = "", isFocused = false, borderColor = "#e5e7eb", focusBorderColor, labelColor = "#9ca3af" }) => (
  <div
    className={`border rounded-md mb-0 px-4 transition-colors duration-150 ${className}`}
    style={{
      borderColor: isFocused ? (focusBorderColor ?? primary) : borderColor,
      minHeight: "48px",
      paddingTop: label || right ? "6px" : "0px",
      paddingBottom: label || right ? "6px" : "0px",
    } as React.CSSProperties}
  >
    {(label || right) && (
      <div className="flex items-center justify-between mb-1">
        {label && <span className="text-xs" style={{ color: labelColor }}>{label}</span>}
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
  const { button, buttonForeground, backgroundColor, foregroundColor, primary } = useTheme();
  const { t } = useTranslation();

  const isDark = useMemo(() => {
    try {
      const hex = backgroundColor.replace("#", "");
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 < 128;
    } catch { return false; }
  }, [backgroundColor]);

  const inputBorder = isDark ? "#2c2c2c" : "#e5e7eb";
  const inputFocusBorder = isDark ? "#ffffff" : primary;
  const cardBg = isDark ? "#1a1a1a" : "#ffffff";
  const cardBorder = isDark ? "#2c2c2c" : "#e5e7eb";
  const mutedColor = isDark ? "#9ca3af" : "#6b7280";

  const stripeStyle = useMemo((): StripeElementStyle => ({
    base: { color: foregroundColor, fontFamily: "inherit", fontSize: "14px", "::placeholder": { color: "#6b7280" } },
    invalid: { color: "#EF4444", iconColor: "#EF4444" },
  }), [foregroundColor]);

  const stripeStyleCentered = useMemo((): StripeElementStyle => ({
    base: { color: foregroundColor, fontFamily: "inherit", fontSize: "14px", lineHeight: "48px", textAlign: "left", "::placeholder": { color: "#6b7280" } },
    invalid: { color: "#EF4444", iconColor: "#EF4444" },
  }), [foregroundColor]);

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
  const [phoneDialCode, setPhoneDialCode] = useState("+55");
  const [docValue, setDocValue] = useState("");
  const checkoutStartedSent = useRef(false);
  const nameUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI state
  const [showDetails, setShowDetails] = useState(false);
  const [couponExpanded, setCouponExpanded] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercent: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0); // em centavos

  // Payment method
  const isSubscription = offerData.paymentType === "subscription";
  const effectivePaypalEnabled = isSubscription ? false : offerData.paypalEnabled;
  const effectivePixEnabled = false; // Pagar.me PIX — OCULTO TEMPORARIAMENTE

  const [method, setMethod] = useState<"creditCard" | "pix" | "wallet" | "paypal">(() => {
    if (offerData.stripe_card_enabled === false && !isSubscription) {
      if (effectivePixEnabled) return "pix";
      if (effectivePaypalEnabled) return "paypal";
    }
    return "creditCard";
  });

  const [selectedBumps, setSelectedBumps] = useState<string[]>([]);
  const [totalAmount, setTotalAmount] = useState(offerData.mainProduct.priceInCents);
  const [focusedStripeField, setFocusedStripeField] = useState<string | null>(null);
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
    // Aplica desconto do cupom no total exibido
    setTotalAmount(Math.max(newTotal - couponDiscount, 0));
  }, [selectedBumps, offerData, couponDiscount]);

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

  const handleApplyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;

    setCouponLoading(true);
    setCouponError(null);

    try {
      const res = await fetch(`${API_URL}/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerSlug: offerData.slug, code }),
      });
      const data = await res.json();

      if (data.valid) {
        const baseTotal =
          offerData.mainProduct.priceInCents +
          selectedBumps.reduce((acc, bumpId) => {
            const bump = offerData.orderBumps.find((b) => b?._id === bumpId);
            return acc + (bump?.priceInCents || 0);
          }, 0);
        const discount = Math.floor(baseTotal * (data.discountPercent / 100));
        setAppliedCoupon({ code, discountPercent: data.discountPercent });
        setCouponDiscount(discount);
        setCouponExpanded(false);
        setCouponInput("");
      } else {
        setCouponError(data.message || "Cupom invalido.");
      }
    } catch {
      setCouponError("Erro ao validar cupom. Tente novamente.");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponError(null);
    setCouponInput("");
    setCouponExpanded(false);
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
        couponCode: appliedCoupon?.code || null,
        contactInfo: {
          email: contactEmail,
          name: contactName,
          phone: phone ? `${phoneDialCode}${phone}` : "",
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
            <p className="text-sm font-medium animate-pulse" style={{ color: foregroundColor }}>
              {t.buttons.processing}
            </p>
          </div>
        </div>
      )}

      {/* Full-width banner */}
      {offerData.bannerImageUrl && (
        <div className="w-full overflow-hidden max-w-md m-auto" style={{ maxHeight: "192px" }}>
          <img
            src={offerData.bannerImageUrl}
            alt="Banner da oferta"
            className="w-full h-full object-fill max-h-48"
            fetchPriority="high"
            loading="eager"
          />
        </div>
      )}

      {/* Main content */}
      <div className="pb-4" style={{ backgroundColor, color: foregroundColor }}>
        <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
          {/* Product card */}
          {(() => {
            const mainPrice = offerData.mainProduct.priceInCents;
            const mainOriginal = offerData.mainProduct.originalPriceInCents ?? mainPrice;
            const bumpsSubtotal = selectedBumps.reduce((acc, id) => {
              const b = offerData.orderBumps.find((x) => x._id === id);
              return acc + (b?.priceInCents ?? 0);
            }, 0);
            const bumpsOriginal = selectedBumps.reduce((acc, id) => {
              const b = offerData.orderBumps.find((x) => x._id === id);
              return acc + (b?.originalPriceInCents ?? b?.priceInCents ?? 0);
            }, 0);
            const subtotal = mainPrice + bumpsSubtotal;
            const originalTotal = mainOriginal + bumpsOriginal;
            const savings = originalTotal - totalAmount;

            return (
              <div className="border rounded-lg shadow-sm overflow-hidden" style={{ borderColor: cardBorder, backgroundColor: cardBg }}>
                {showDetails ? (
                  /* EXPANDED */
                  <div className="p-3">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold" style={{ color: foregroundColor }}>
                        {t.orderSummary.purchaseDetails}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowDetails(false)}
                        className="flex items-center gap-1 text-xs transition-colors"
                        style={{ color: foregroundColor }}
                      >
                        {t.orderSummary.hide}
                        <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                      </button>
                    </div>

                    {/* Main product row */}
                    <div className={`flex items-center gap-2 py-2 border-b`} style={{ borderColor: cardBorder }}>
                      {offerData.mainProduct.imageUrl && (
                        <img
                          src={offerData.mainProduct.imageUrl}
                          alt={offerData.mainProduct.name}
                          className="w-10 h-10 rounded object-cover shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-snug line-clamp-2" style={{ color: foregroundColor }}>
                          {offerData.mainProduct.name}
                        </p>
                        {offerData.paymentType === "subscription" && offerData.subscriptionInterval && (
                          <span
                            className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5"
                            style={{ backgroundColor: `${foregroundColor}10`, color: foregroundColor }}
                          >
                            {t.orderSummary.subscriptionBadge}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        {mainOriginal > mainPrice && (
                          <p className="text-[10px] line-through" style={{ color: `${foregroundColor}60` }}>
                            {formatCurrency(mainOriginal, offerData.currency)}
                          </p>
                        )}
                        <p className="text-xs font-semibold" style={{ color: foregroundColor }}>
                          {formatCurrency(mainPrice, offerData.currency)}
                          {offerData.paymentType === "subscription" && offerData.subscriptionInterval && (
                            <span className="text-[10px] font-medium" style={{ opacity: 0.7 }}>
                              {t.orderSummary.interval[offerData.subscriptionInterval]}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Selected order bump rows */}
                    {selectedBumps.map((id) => {
                      const bump = offerData.orderBumps.find((x) => x._id === id);
                      if (!bump) return null;
                      const bOriginal = bump.originalPriceInCents ?? bump.priceInCents;
                      return (
                        <div key={id} className={`flex items-center gap-2 py-2 border-b`} style={{ borderColor: cardBorder }}>
                          {bump.imageUrl && <img src={bump.imageUrl} alt={bump.name} className="w-10 h-10 rounded object-cover shrink-0" />}
                          <p className="flex-1 text-xs leading-snug line-clamp-2" style={{ color: foregroundColor }}>
                            {bump.name}
                          </p>
                          <div className="text-right shrink-0 ml-2">
                            {bOriginal > bump.priceInCents && (
                              <p className="text-[10px] line-through" style={{ color: `${foregroundColor}60` }}>
                                {formatCurrency(bOriginal, offerData.currency)}
                              </p>
                            )}
                            <p className="text-xs font-semibold" style={{ color: foregroundColor }}>
                              {formatCurrency(bump.priceInCents, offerData.currency)}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    {/* Subtotal */}
                    <div className="flex items-center justify-between mt-3 text-xs" style={{ color: `${foregroundColor}80` }}>
                      <span>{t.orderSummary.subtotal}</span>
                      <span>{formatCurrency(subtotal, offerData.currency)}</span>
                    </div>

                    {/* Savings */}
                    {savings > 0 && (
                      <div className="flex items-center justify-between mt-1 text-xs font-medium text-green-500">
                        <span>{t.orderSummary.youSave}</span>
                        <span>- {formatCurrency(savings, offerData.currency)}</span>
                      </div>
                    )}

                    {/* Coupon */}
                    {offerData.coupons?.enabled && (
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: cardBorder }}>
                        {appliedCoupon ? (
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-green-500">
                              {t.orderSummary.couponApplied} "{appliedCoupon.code}" — {appliedCoupon.discountPercent}%
                            </span>
                            <button
                              type="button"
                              onClick={handleRemoveCoupon}
                              className="text-xs underline"
                              style={{ color: `${foregroundColor}60` }}
                            >
                              {t.orderSummary.remove}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder={t.orderSummary.couponPlaceholder}
                                value={couponInput}
                                onChange={(e) => {
                                  setCouponInput(e.target.value);
                                  setCouponError(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleApplyCoupon();
                                  }
                                }}
                                className="flex-1 px-3 py-2 rounded-md text-sm outline-none uppercase placeholder:text-[#6b7280] border transition-colors"
                                style={{ borderColor: inputBorder, backgroundColor: cardBg, color: foregroundColor }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = inputFocusBorder; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = inputBorder; }}
                                disabled={couponLoading}
                              />
                              <button
                                type="button"
                                onClick={handleApplyCoupon}
                                disabled={couponLoading || !couponInput.trim()}
                                className="px-4 py-2 text-xs font-semibold rounded-md transition-colors disabled:opacity-50 text-white"
                                style={{ backgroundColor: "#6b7280" }}
                              >
                                {couponLoading ? "..." : t.orderSummary.apply}
                              </button>
                            </div>
                            {couponError && <p className="text-xs text-red-500">{couponError}</p>}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Total hoje */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: cardBorder }}>
                      <span className="text-sm font-bold" style={{ color: foregroundColor }}>
                        {t.orderSummary.totalToday}
                      </span>
                      <span className="text-sm font-bold" style={{ color: foregroundColor }}>
                        {formatCurrency(totalAmount, offerData.currency)}
                        {offerData.paymentType === "subscription" && offerData.subscriptionInterval && (
                          <span className="text-xs font-medium" style={{ opacity: 0.7 }}>
                            {t.orderSummary.interval[offerData.subscriptionInterval]}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* COLLAPSED */
                  <div className="p-3 flex items-start gap-3">
                    {offerData.mainProduct.imageUrl && (
                      <img
                        src={offerData.mainProduct.imageUrl}
                        alt={offerData.mainProduct.name}
                        className="w-12 h-12 rounded-md object-cover shrink-0 border"
                        style={{ borderColor: cardBorder }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: foregroundColor }}>
                          {offerData.mainProduct.name}
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowDetails(true)}
                          className="flex items-center gap-0.5 text-xs shrink-0 transition-colors"
                          style={{ color: foregroundColor }}
                        >
                          <ChevronDown className="h-6 w-6" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {selectedBumps.length === 0 && mainOriginal > mainPrice && (
                          <p className="text-xs line-through" style={{ color: `${foregroundColor}60` }}>
                            {formatCurrency(mainOriginal, offerData.currency)}
                          </p>
                        )}
                        <p className="text-sm font-bold" style={{ color: primary }}>
                          {formatCurrency(totalAmount, offerData.currency)}
                          {offerData.paymentType === "subscription" && offerData.subscriptionInterval && (
                            <span className="text-xs font-medium" style={{ opacity: 0.7 }}>
                              {t.orderSummary.interval[offerData.subscriptionInterval]}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Main form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Contact section */}
            <div>
              <h2
                className="mb-2 text-[15px] md:text-sm font-medium text-zinc-700 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-300"
                style={{ color: foregroundColor }}
              >
                {t.contact.title}
              </h2>
              <div className="space-y-[-1px]">
                <HublaInput
                  id="name"
                  type="text"
                  placeholder={t.contact.namePlaceholder}
                  required
                  value={contactName}
                  className="rounded-b-none"
                  onChange={handleNameChange}
                  primary={primary}
                  borderColor={inputBorder}
                  focusBorderColor={inputFocusBorder}
                />
                <HublaInput
                  id="email"
                  type="email"
                  placeholder={t.contact.emailPlaceholder}
                  required
                  value={contactEmail}
                  className="rounded-none"
                  onChange={handleEmailChange}
                  primary={primary}
                  borderColor={inputBorder}
                  focusBorderColor={inputFocusBorder}
                />
                {offerData.collectPhone && (
                  <PhoneInput
                    value={phone}
                    dialCode={phoneDialCode}
                    onPhoneChange={setPhone}
                    onDialCodeChange={setPhoneDialCode}
                    placeholder={t.contact.phonePlaceholder}
                    primary={primary}
                    className="rounded-t-none"
                    textColor={foregroundColor}
                    inputBackground={backgroundColor}
                    borderColor={inputBorder}
                    focusBorderColor={inputFocusBorder}
                  />
                )}
              </div>
            </div>

            {/* Payment method tabs — only shown when more than 1 method */}
            {availableMethodsCount > 1 && (
              <div>
                <h2 className="text-lg md:text-base font-medium my-1.5 text-zinc-800 dark:text-zinc-100" style={{ color: foregroundColor }}>
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
                        borderColor: method === "creditCard" ? inputFocusBorder : inputBorder,
                        borderWidth: method === "creditCard" ? "2px" : "1px",
                        backgroundColor: method === "creditCard" ? `${inputFocusBorder}18` : backgroundColor,
                      }}
                    >
                      <CreditCard className="h-5 w-5" style={{ color: method === "creditCard" ? inputFocusBorder : mutedColor }} />
                      <span className="text-xs font-medium" style={{ color: method === "creditCard" ? inputFocusBorder : mutedColor }}>
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
                        borderColor: method === "pix" ? inputFocusBorder : inputBorder,
                        borderWidth: method === "pix" ? "2px" : "1px",
                        backgroundColor: method === "pix" ? `${inputFocusBorder}18` : backgroundColor,
                      }}
                    >
                      <PixIcon color={method === "pix" ? inputFocusBorder : mutedColor} />
                      <span className="text-xs font-medium" style={{ color: method === "pix" ? inputFocusBorder : mutedColor }}>
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
                        borderColor: method === "paypal" ? inputFocusBorder : inputBorder,
                        borderWidth: method === "paypal" ? "2px" : "1px",
                        backgroundColor: method === "paypal" ? `${inputFocusBorder}18` : backgroundColor,
                      }}
                    >
                      <div style={{ opacity: method === "paypal" ? 1 : 0.5 }}>
                        <PayPalIcon className="h-5 w-auto" />
                      </div>
                      <span className="text-xs font-medium" style={{ color: method === "paypal" ? inputFocusBorder : mutedColor }}>
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
                        borderColor: method === "wallet" ? inputFocusBorder : inputBorder,
                        borderWidth: method === "wallet" ? "2px" : "1px",
                        backgroundColor: method === "wallet" ? `${inputFocusBorder}18` : backgroundColor,
                      }}
                    >
                      {walletLabel === t.payment.applePay ? <AppleyPayIcon className="h-6 w-auto" /> : <GooglePayIcon className="h-6 w-auto" />}
                      <span className="text-xs font-medium" style={{ color: method === "wallet" ? inputFocusBorder : mutedColor }}>
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
                  isFocused={focusedStripeField === "card-number"}
                  borderColor={inputBorder}
                  focusBorderColor={inputFocusBorder}
                  labelColor={mutedColor}
                  right={
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="25" height="8" viewBox="0 0 25 8">
                        <path
                          fill-rule="evenodd"
                          clip-rule="evenodd"
                          d="M6.12526 7.75825H4.00494L2.41495 1.69237C2.33949 1.41334 2.17925 1.16667 1.94354 1.0504C1.35531 0.75823 0.707118 0.525705 0 0.408431V0.174895H3.41567C3.88708 0.174895 4.24064 0.525705 4.29957 0.933129L5.12454 5.30865L7.24383 0.174895H9.30522L6.12526 7.75825ZM10.4838 7.75825H8.48129L10.1302 0.174895H12.1327L10.4838 7.75825ZM14.7234 2.27571C14.7823 1.86728 15.1359 1.63374 15.5483 1.63374C16.1965 1.57511 16.9026 1.69238 17.4919 1.98354L17.8454 0.35081C17.2562 0.117274 16.608 0 16.0198 0C14.0762 0 12.662 1.05041 12.662 2.50824C12.662 3.61728 13.6637 4.19961 14.3708 4.55042C15.1359 4.90021 15.4305 5.13375 15.3716 5.48355C15.3716 6.00825 14.7823 6.24178 14.1941 6.24178C13.4869 6.24178 12.7798 6.06688 12.1327 5.77471L11.7791 7.40845C12.4862 7.69962 13.2512 7.81689 13.9584 7.81689C16.1376 7.87451 17.4919 6.82512 17.4919 5.25001C17.4919 3.26647 14.7234 3.15021 14.7234 2.27571V2.27571ZM24.5 7.75825L22.91 0.174895H21.2022C20.8486 0.174895 20.4951 0.408431 20.3772 0.75823L17.4329 7.75825H19.4943L19.9058 6.65021H22.4386L22.6743 7.75825H24.5ZM21.4968 2.21708L22.085 5.07512H20.4361L21.4968 2.21708Z"
                          className="h-4 w-6 fill-[#172B85]"
                        ></path>
                      </svg>
                      <svg className="h-4 w-6" xmlns="http://www.w3.org/2000/svg" width="23" height="14" viewBox="0 0 23 14" fill="none">
                        <path
                          fill-rule="evenodd"
                          clip-rule="evenodd"
                          d="M11.25 12.1569C10.0584 13.1852 8.51276 13.806 6.82377 13.806C3.05511 13.806 0 10.7154 0 6.90299C0 3.09057 3.05511 0 6.82377 0C8.51276 0 10.0584 0.620752 11.25 1.64903C12.4416 0.620752 13.9872 0 15.6762 0C19.4449 0 22.5 3.09057 22.5 6.90299C22.5 10.7154 19.4449 13.806 15.6762 13.806C13.9872 13.806 12.4416 13.1852 11.25 12.1569Z"
                          className="fill-[#ED0006] dark:fill-[#ED0006]"
                        ></path>
                        <path
                          fill-rule="evenodd"
                          clip-rule="evenodd"
                          d="M11.25 12.1569C12.7172 10.8908 13.6475 9.0068 13.6475 6.90299C13.6475 4.79917 12.7172 2.91517 11.25 1.64903C12.4416 0.620752 13.9872 0 15.6762 0C19.4449 0 22.5 3.09057 22.5 6.90299C22.5 10.7154 19.4449 13.806 15.6762 13.806C13.9872 13.806 12.4416 13.1852 11.25 12.1569Z"
                          className="fill-[#F9A000] dark:fill-[#F9A000]"
                        ></path>
                        <path
                          fill-rule="evenodd"
                          clip-rule="evenodd"
                          d="M11.25 1.64905C12.7172 2.91518 13.6476 4.79917 13.6476 6.90297C13.6476 9.00678 12.7172 10.8908 11.25 12.1569C9.78287 10.8908 8.85254 9.00678 8.85254 6.90297C8.85254 4.79917 9.78287 2.91518 11.25 1.64905Z"
                          className="fill-[#FF5E00] dark:fill-[#FF5E00]"
                        ></path>
                      </svg>
                      <svg xmlns="http://www.w3.org/2000/svg" width="29" height="8" viewBox="0 0 29 8" fill="none">
                        <path
                          fill-rule="evenodd"
                          clip-rule="evenodd"
                          d="M3.18111 0L0 7.24674H3.80824L4.28035 6.09131H5.35949L5.8316 7.24674H10.0234V6.36488L10.3969 7.24674H12.5652L12.9387 6.34624V7.24674H21.6566L22.7166 6.12132L23.7092 7.24674L28.1868 7.25606L24.9957 3.6436L28.1868 0H23.7786L22.7467 1.10463L21.7854 0H12.3016L11.4872 1.87045L10.6537 0H6.85343V0.851856L6.43068 0H3.18111ZM16.1994 1.02905H21.2055L22.7367 2.73162L24.3172 1.02905H25.8484L23.5219 3.64258L25.8484 6.226H24.2477L22.7166 4.50364L21.128 6.226H16.1994V1.02905ZM17.4356 3.05497V2.10571V2.1048H20.5593L21.9223 3.62291L20.4989 5.14932H17.4356V4.113H20.1667V3.05497H17.4356ZM3.91799 1.02905H5.7743L7.88433 5.94311V1.02905H9.91784L11.5476 4.5524L13.0496 1.02905H15.073V6.22906H13.8418L13.8317 2.15436L12.0368 6.22906H10.9355L9.13052 2.15436V6.22906H6.59773L6.11756 5.06329H3.52338L3.04421 6.22804H1.68717L3.91799 1.02905ZM3.96634 3.9856L4.82101 1.90886L5.6747 3.9856H3.96634Z"
                          className="h-4 w-6 fill-[#1F72CD]"
                        ></path>
                      </svg>
                      <div className="relative">
                        <div className="transition-opacity duration-500 opacity-0 absolute">
                          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="10" viewBox="0 0 28 10" fill="none">
                            <path
                              d="M7.91765 5.55557C7.63702 6.90825 6.41869 7.9254 4.95846 7.9254C4.62344 7.9254 4.30095 7.8717 4.00007 7.77275L3.32935 9.74073C3.84122 9.909 4.38889 10 4.95846 10C7.44054 10 9.51097 8.27036 9.98808 5.9719L7.91765 5.55557Z"
                              fill="#EC412A"
                            ></path>
                            <path
                              fill-rule="evenodd"
                              clip-rule="evenodd"
                              d="M19.9526 1.11116V6.80143L20.9737 7.21073L20.4906 8.33306L19.4808 7.92715C19.2538 7.83194 19.1001 7.68687 18.9833 7.52303C18.8712 7.3554 18.7881 7.12628 18.7881 6.81709V1.11116H19.9526ZM12.208 5.34038C12.2334 3.71313 13.6192 2.41419 15.3007 2.43911C16.7279 2.46076 17.9105 3.42743 18.2211 4.71313L12.7011 6.99451C12.3804 6.5205 12.1982 5.95024 12.208 5.34038ZM13.471 5.56851C13.4635 5.50024 13.4581 5.43023 13.4601 5.3596C13.476 4.40088 14.2918 3.63587 15.2826 3.65176C15.8218 3.65872 16.3006 3.89751 16.6243 4.26709L13.471 5.56851ZM16.5081 6.62488C16.1754 6.93782 15.7243 7.12848 15.2262 7.12163C14.8847 7.1161 14.5684 7.01726 14.2994 6.85256L13.6325 7.88002C14.0892 8.15916 14.6277 8.32432 15.2082 8.33301C16.0533 8.34516 16.8235 8.02416 17.3835 7.49414L16.5081 6.62488ZM24.2025 3.65168C24.0036 3.65168 23.8124 3.68276 23.6338 3.74073L23.2365 2.58939C23.5397 2.49147 23.8645 2.43828 24.2025 2.43828C25.6773 2.43828 26.9077 3.45134 27.1898 4.79709L25.9598 5.03956C25.7941 4.24755 25.0703 3.65168 24.2025 3.65168ZM22.183 7.59358L23.0141 6.68477C22.6429 6.367 22.4092 5.90289 22.4092 5.38559C22.4092 4.86881 22.6429 4.40494 23.0138 4.0874L22.1821 3.17859C21.5515 3.71857 21.1543 4.50758 21.1543 5.38559C21.1543 6.2647 21.5518 7.05343 22.183 7.59358ZM24.2024 7.12011C25.0694 7.12011 25.7931 6.52475 25.9598 5.7339L27.1894 5.97741C26.9059 7.32171 25.6759 8.3334 24.2024 8.3334C23.8642 8.3334 23.539 8.28003 23.2349 8.18165L23.6332 7.03071C23.8121 7.08851 24.0034 7.12011 24.2024 7.12011Z"
                              className="fill-[#000000]"
                            ></path>
                            <path
                              d="M1.53441 8.88894L2.77447 7.28777C2.22095 6.72789 1.87158 5.9105 1.87158 4.9994C1.87158 4.08898 2.22062 3.27159 2.77399 2.71214L1.53327 1.11116C0.592714 2.06238 0 3.45184 0 4.9994C0 6.54776 0.593582 7.93772 1.53441 8.88894"
                              fill="#1BA7DE"
                            ></path>
                            <path
                              d="M3.99912 2.22531C4.29998 2.12667 4.62183 2.07312 4.95671 2.07312C6.41823 2.07312 7.63733 3.09154 7.91702 4.44444L9.98808 4.03018C9.51287 1.73084 7.44106 0 4.95671 0C4.38792 0 3.84043 0.0908977 3.32935 0.258344L3.99912 2.22531Z"
                              fill="#FECA2F"
                            ></path>
                          </svg>
                        </div>
                      </div>
                    </div>
                  }
                >
                  <CardNumberElement
                    id="card-number"
                    options={{ style: stripeStyle, disableLink: offerData.stripe_link_enabled === false }}
                    onFocus={() => setFocusedStripeField("card-number")}
                    onBlur={() => setFocusedStripeField(null)}
                  />
                </StripeFieldWrapper>

                {/* Expiry + CVV side by side */}
                <div className="grid grid-cols-2">
                  <StripeFieldWrapper
                    primary={primary}
                    className="border-t-0 rounded-br-none rounded-t-none border-r-0"
                    isFocused={focusedStripeField === "card-expiry"}
                    borderColor={inputBorder}
                    focusBorderColor={inputFocusBorder}
                  >
                    <CardExpiryElement
                      id="card-expiry"
                      options={{ style: stripeStyleCentered }}
                      onFocus={() => setFocusedStripeField("card-expiry")}
                      onBlur={() => setFocusedStripeField(null)}
                    />
                  </StripeFieldWrapper>
                  <StripeFieldWrapper
                    primary={primary}
                    className="border-t-0 rounded-bl-none rounded-t-none"
                    isFocused={focusedStripeField === "card-cvv"}
                    borderColor={inputBorder}
                    focusBorderColor={inputFocusBorder}
                  >
                    <CardCvcElement
                      id="card-cvv"
                      options={{ style: stripeStyleCentered }}
                      onFocus={() => setFocusedStripeField("card-cvv")}
                      onBlur={() => setFocusedStripeField(null)}
                    />
                  </StripeFieldWrapper>
                </div>

                {/* Cardholder name */}
                <h2
                  className="mb-2 mt-5 text-[15px] md:text-sm font-medium text-zinc-700 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-300"
                  style={{ color: foregroundColor }}
                >
                  {t.creditCard.cardholderName}
                </h2>
                <HublaInput id="hubla-card-name" type="text" placeholder={t.creditCard.cardholderNamePlaceholder} primary={primary} borderColor={inputBorder} focusBorderColor={inputFocusBorder} />

                {/* Document */}
                {offerData.collectDocument && (
                  <div>
                    <h2
                      className="mb-2 mt-[11px] text-[15px] md:text-sm font-medium text-zinc-700 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-300"
                      style={{ color: foregroundColor }}
                    >
                      {t.creditCard.document}
                    </h2>
                    <HublaInput
                      id="document"
                      type="text"
                      placeholder="CPF/CNPJ"
                      value={docValue}
                      onChange={handleDocumentChange}
                      maxLength={18}
                      primary={primary}
                      borderColor={inputBorder}
                      focusBorderColor={inputFocusBorder}
                    />
                  </div>
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

            {/* Order bumps — Hubla style */}
            {offerData.orderBumps.length > 0 && (
              <div className="space-y-3">
                {offerData.orderBumps.map((bump) => {
                  const isSelected = selectedBumps.includes(bump._id);
                  return (
                    <div key={bump._id} className="rounded-md overflow-hidden border shadow-sm" style={{ borderColor: cardBorder }}>
                      {/* Colored header — green when selected */}
                      <div
                        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors duration-300"
                        style={{ backgroundColor: isSelected ? "#16a34a" : primary }}
                        onClick={() => handleToggleBump(bump._id)}
                      >
                        {isSelected ? <Check className="h-4 w-4 text-white shrink-0" /> : <ChevronDown className="h-4 w-4 text-white shrink-0" />}
                        <span className="text-white text-xs font-bold uppercase tracking-wide leading-snug">
                          {isSelected ? t.orderBump.addedToCart : bump.name}
                        </span>
                      </div>

                      {/* Body */}
                      <div className="p-3 space-y-2" style={{ backgroundColor }}>
                        {/* Checkbox row + description */}
                        <label className="flex items-start gap-2 cursor-pointer" onClick={() => handleToggleBump(bump._id)}>
                          <div
                            className="mt-0.5 h-4 w-4 border-2 rounded-sm shrink-0 flex items-center justify-center transition-colors"
                            style={
                              isSelected
                                ? { backgroundColor: "#16a34a", borderColor: "#16a34a" }
                                : { backgroundColor: "transparent", borderColor: inputBorder }
                            }
                          >
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>
                          {bump.description && (
                            <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: foregroundColor }}>
                              {bump.description}
                            </p>
                          )}
                        </label>

                        {/* Product card: image + price */}
                        <div className="flex items-center gap-3 border rounded p-2" style={{ borderColor: cardBorder, backgroundColor: cardBg }}>
                          {bump.imageUrl && <img src={bump.imageUrl} alt={bump.name} className="w-14 h-14 object-cover rounded shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-xs font-medium leading-snug line-clamp-2" style={{ color: foregroundColor }}>
                              {bump.name}
                            </p>
                            {bump.originalPriceInCents && bump.originalPriceInCents > bump.priceInCents ? (
                              <p className="text-xs mt-0.5" style={{ color: `${foregroundColor}80` }}>
                                De {formatCurrency(bump.originalPriceInCents, offerData.currency)} por apenas:
                              </p>
                            ) : null}
                            <p className="text-sm font-bold mt-0.5">{formatCurrency(bump.priceInCents, offerData.currency)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Submit button */}
            {method !== "wallet" && method !== "paypal" && (
              <>
                <button
                  type="submit"
                  disabled={!stripe || loading || paymentSucceeded || !isContactValid}
                  className="inline-flex items-center w-full justify-center whitespace-nowrap font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300 bg-zinc-900 text-zinc-50 hover:bg-zinc-900/90 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90 h-11 rounded-md px-8 text-lg md:text-base relative overflow-hidden"
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
                <div className="flex items-center self-center gap-2 justify-center mb-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    className="lucide lucide-lock-keyhole h-4 w-4"
                    style={{ color: primary }}
                  >
                    <circle cx="12" cy="16" r="1"></circle>
                    <rect x="3" y="10" width="18" height="12" rx="2"></rect>
                    <path d="M7 10V7a5 5 0 0 1 10 0v3"></path>
                  </svg>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">{t.buttons.secureTransaction}</span>
                </div>
              </>
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
