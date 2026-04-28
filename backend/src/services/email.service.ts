import nodemailer from "nodemailer";
import { Resend } from "resend";
import EmailLog from "../models/email-log.model";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

interface SendPurchaseEmailParams {
  smtp: SmtpConfig;
  to: string;
  customerName: string;
  offerName: string;
  productName: string;
  totalAmountInCents: number;
  currency: string;
  language?: string;
  subject?: string;
  heading?: string;
  body?: string;
  imageUrl?: string;
  pdfUrl?: string;
  ownerId?: string;
  offerId?: string;
}

const EMAIL_TRANSLATIONS: Record<string, {
  htmlLang: string;
  title: string;
  headerConfirmed: string;
  greeting: string;
  defaultHeading: string;
  defaultBody: string;
  orderSummary: string;
  totalPaid: string;
  downloadMaterial: string;
  footer: string;
  defaultSubject: (productName: string) => string;
}> = {
  pt: {
    htmlLang: "pt-BR",
    title: "Confirmação de Compra",
    headerConfirmed: "Compra Confirmada",
    greeting: "Olá",
    defaultHeading: "Sua compra foi confirmada!",
    defaultBody: "Obrigado pela sua compra. Seu pedido foi processado com sucesso.",
    orderSummary: "Resumo do Pedido",
    totalPaid: "Total Pago",
    downloadMaterial: "Baixar Material",
    footer: "Este email foi enviado automaticamente. Por favor, não responda.",
    defaultSubject: (p) => `Sua compra de ${p} foi confirmada!`,
  },
  en: {
    htmlLang: "en",
    title: "Purchase Confirmation",
    headerConfirmed: "Purchase Confirmed",
    greeting: "Hello",
    defaultHeading: "Your purchase has been confirmed!",
    defaultBody: "Thank you for your purchase. Your order has been successfully processed.",
    orderSummary: "Order Summary",
    totalPaid: "Total Paid",
    downloadMaterial: "Download Material",
    footer: "This email was sent automatically. Please do not reply.",
    defaultSubject: (p) => `Your purchase of ${p} has been confirmed!`,
  },
  es: {
    htmlLang: "es",
    title: "Confirmación de Compra",
    headerConfirmed: "Compra Confirmada",
    greeting: "Hola",
    defaultHeading: "¡Tu compra ha sido confirmada!",
    defaultBody: "Gracias por tu compra. Tu pedido ha sido procesado con éxito.",
    orderSummary: "Resumen del Pedido",
    totalPaid: "Total Pagado",
    downloadMaterial: "Descargar Material",
    footer: "Este correo fue enviado automáticamente. Por favor, no respondas.",
    defaultSubject: (p) => `¡Tu compra de ${p} ha sido confirmada!`,
  },
  fr: {
    htmlLang: "fr",
    title: "Confirmation d'achat",
    headerConfirmed: "Achat Confirmé",
    greeting: "Bonjour",
    defaultHeading: "Votre achat a été confirmé !",
    defaultBody: "Merci pour votre achat. Votre commande a été traitée avec succès.",
    orderSummary: "Récapitulatif de la Commande",
    totalPaid: "Total Payé",
    downloadMaterial: "Télécharger le Matériel",
    footer: "Cet e-mail a été envoyé automatiquement. Merci de ne pas répondre.",
    defaultSubject: (p) => `Votre achat de ${p} a été confirmé !`,
  },
  de: {
    htmlLang: "de",
    title: "Kaufbestätigung",
    headerConfirmed: "Kauf Bestätigt",
    greeting: "Hallo",
    defaultHeading: "Ihr Kauf wurde bestätigt!",
    defaultBody: "Vielen Dank für Ihren Kauf. Ihre Bestellung wurde erfolgreich bearbeitet.",
    orderSummary: "Bestellübersicht",
    totalPaid: "Gesamt Bezahlt",
    downloadMaterial: "Material Herunterladen",
    footer: "Diese E-Mail wurde automatisch gesendet. Bitte nicht antworten.",
    defaultSubject: (p) => `Ihr Kauf von ${p} wurde bestätigt!`,
  },
  it: {
    htmlLang: "it",
    title: "Conferma Acquisto",
    headerConfirmed: "Acquisto Confermato",
    greeting: "Ciao",
    defaultHeading: "Il tuo acquisto è stato confermato!",
    defaultBody: "Grazie per il tuo acquisto. Il tuo ordine è stato elaborato con successo.",
    orderSummary: "Riepilogo Ordine",
    totalPaid: "Totale Pagato",
    downloadMaterial: "Scarica il Materiale",
    footer: "Questa email è stata inviata automaticamente. Si prega di non rispondere.",
    defaultSubject: (p) => `Il tuo acquisto di ${p} è stato confermato!`,
  },
};

const getTranslation = (language?: string) => {
  const lang = (language || "pt").toLowerCase().split("-")[0];
  return EMAIL_TRANSLATIONS[lang] || EMAIL_TRANSLATIONS["pt"];
};

const formatCurrency = (amountInCents: number, currency: string): string => {
  const amount = amountInCents / 100;
  const locale = currency.toLowerCase() === "brl" ? "pt-BR" : "en-US";
  const currencyCode = currency.toUpperCase();
  return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode }).format(amount);
};

const buildEmailHtml = (params: SendPurchaseEmailParams): string => {
  const {
    customerName,
    offerName,
    productName,
    totalAmountInCents,
    currency,
    language,
    heading,
    body,
    imageUrl,
    pdfUrl,
  } = params;

  const t = getTranslation(language);
  const firstName = customerName.split(" ")[0];
  const formattedAmount = formatCurrency(totalAmountInCents, currency);
  const displayHeading = heading || t.defaultHeading;
  const displayBody = body || t.defaultBody;

  return `<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2563EB 0%,#1d4ed8 100%);padding:36px 40px;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">✓ ${t.headerConfirmed}</p>
              <p style="margin:8px 0 0;font-size:15px;color:rgba(255,255,255,0.85);">${offerName}</p>
            </td>
          </tr>

          ${imageUrl ? `
          <!-- Product Image -->
          <tr>
            <td style="padding:0;">
              <img src="${imageUrl}" alt="${productName}" style="width:100%;max-height:280px;object-fit:cover;display:block;" />
            </td>
          </tr>` : ""}

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">${t.greeting}, ${firstName}!</p>
              <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">${displayHeading}</h2>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#4b5563;">${displayBody.replace(/\n/g, "<br/>")}</p>

              <!-- Order Summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">${t.orderSummary}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:14px;color:#374151;">${productName}</td>
                        <td align="right" style="font-size:14px;font-weight:600;color:#111827;">${formattedAmount}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 20px;background-color:#f0f4ff;border-top:1px solid #e5e7eb;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:14px;font-weight:600;color:#374151;">${t.totalPaid}</td>
                        <td align="right" style="font-size:16px;font-weight:700;color:#2563EB;">${formattedAmount}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${pdfUrl ? `
              <!-- PDF Download -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${pdfUrl}" target="_blank" style="display:inline-block;background-color:#2563EB;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
                      📄 ${t.downloadMaterial}
                    </a>
                  </td>
                </tr>
              </table>` : ""}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:13px;color:#9ca3af;">${t.footer}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// ---------------------------------------------------------------------------
// CART ABANDONMENT EMAIL
// ---------------------------------------------------------------------------

interface SendCartAbandonmentEmailParams {
  to: string;
  customerName: string;
  offerName: string;
  productName: string;
  priceInCents: number;
  currency: string;
  language?: string;
  checkoutUrl: string;
  ownerId?: string;
  offerId?: string;
}

const CART_ABANDONMENT_TRANSLATIONS: Record<string, {
  subject: (productName: string) => string;
  preheader: string;
  headline: string;
  body: (productName: string) => string;
  cta: string;
  footer: string;
}> = {
  pt: {
    subject: (p) => `Você esqueceu algo: ${p}`,
    preheader: "Seu carrinho ainda está esperando por você.",
    headline: "Você deixou algo para trás",
    body: (p) => `Percebemos que você iniciou a compra de <strong>${p}</strong> mas não finalizou. Não se preocupe, salvamos tudo para você!`,
    cta: "Finalizar Compra",
    footer: "Este email foi enviado automaticamente pelo Snapp. Por favor, não responda.",
  },
  en: {
    subject: (p) => `You left something behind: ${p}`,
    preheader: "Your cart is still waiting for you.",
    headline: "You left something behind",
    body: (p) => `We noticed you started purchasing <strong>${p}</strong> but didn't complete it. Don't worry, we saved everything for you!`,
    cta: "Complete Purchase",
    footer: "This email was sent automatically by Snapp. Please do not reply.",
  },
  es: {
    subject: (p) => `Olvidaste algo: ${p}`,
    preheader: "Tu carrito todavía te está esperando.",
    headline: "Dejaste algo atrás",
    body: (p) => `Notamos que comenzaste a comprar <strong>${p}</strong> pero no lo completaste. ¡No te preocupes, guardamos todo para ti!`,
    cta: "Finalizar Compra",
    footer: "Este correo fue enviado automáticamente por Snapp. Por favor, no respondas.",
  },
  fr: {
    subject: (p) => `Vous avez oublié quelque chose : ${p}`,
    preheader: "Votre panier vous attend encore.",
    headline: "Vous avez laissé quelque chose derrière",
    body: (p) => `Nous avons remarqué que vous avez commencé à acheter <strong>${p}</strong> mais n'avez pas finalisé. Ne vous inquiétez pas, nous avons tout sauvegardé pour vous !`,
    cta: "Finaliser l'achat",
    footer: "Cet e-mail a été envoyé automatiquement par Snapp. Merci de ne pas répondre.",
  },
  de: {
    subject: (p) => `Sie haben etwas vergessen: ${p}`,
    preheader: "Ihr Warenkorb wartet noch auf Sie.",
    headline: "Sie haben etwas zurückgelassen",
    body: (p) => `Wir haben bemerkt, dass Sie <strong>${p}</strong> kaufen wollten, aber nicht abgeschlossen haben. Keine Sorge, wir haben alles für Sie gespeichert!`,
    cta: "Kauf abschließen",
    footer: "Diese E-Mail wurde automatisch von Snapp gesendet. Bitte nicht antworten.",
  },
  it: {
    subject: (p) => `Hai dimenticato qualcosa: ${p}`,
    preheader: "Il tuo carrello ti sta ancora aspettando.",
    headline: "Hai lasciato qualcosa indietro",
    body: (p) => `Abbiamo notato che hai iniziato ad acquistare <strong>${p}</strong> ma non hai completato l'acquisto. Non preoccuparti, abbiamo salvato tutto per te!`,
    cta: "Completa l'acquisto",
    footer: "Questa email è stata inviata automaticamente da Snapp. Si prega di non rispondere.",
  },
};

const getCartAbandonmentTranslation = (language?: string) => {
  const lang = (language || "pt").toLowerCase().split("-")[0];
  return CART_ABANDONMENT_TRANSLATIONS[lang] || CART_ABANDONMENT_TRANSLATIONS["pt"];
};

const buildCartAbandonmentHtml = (params: SendCartAbandonmentEmailParams): string => {
  const { customerName, productName, priceInCents, currency, language, checkoutUrl } = params;
  const t = getCartAbandonmentTranslation(language);
  const firstName = customerName ? customerName.split(" ")[0] : "";
  const formattedPrice = formatCurrency(priceInCents, currency);
  const htmlLang = (language || "pt").toLowerCase().split("-")[0];

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t.subject(productName)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Preheader (hidden) -->
  <span style="display:none;max-height:0;overflow:hidden;">${t.preheader}</span>

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header com logo Snapp -->
          <tr>
            <td style="background-color:#0a0a0a;padding:28px 40px;text-align:center;">
              <p style="margin:0;font-size:32px;font-weight:800;letter-spacing:-1px;color:#ffffff;">Snap<span style="color:#fdbf08;">p</span></p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 0;">
              ${firstName ? `<p style="margin:0 0 12px;font-size:16px;color:#6b7280;">Olá, <strong style="color:#111827;">${firstName}</strong></p>` : ""}
              <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#111827;line-height:1.25;">${t.headline}</h1>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#4b5563;">${t.body(productName)}</p>
            </td>
          </tr>

          <!-- Card do produto -->
          <tr>
            <td style="padding:0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:15px;font-weight:600;color:#111827;">${productName}</td>
                        <td align="right" style="font-size:20px;font-weight:800;color:#111827;white-space:nowrap;">${formattedPrice}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:28px 40px 40px;text-align:center;">
              <a href="${checkoutUrl}" target="_blank"
                style="display:inline-block;background-color:#fdbf08;color:#0a0a0a;font-size:16px;font-weight:700;padding:16px 40px;border-radius:8px;text-decoration:none;letter-spacing:0.2px;">
                ${t.cta} →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 24px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">${t.footer}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const sendCartAbandonmentEmail = async (params: SendCartAbandonmentEmailParams): Promise<void> => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.SNAPP_FROM_EMAIL || "noreply@snappcheckout.com";
  const fromName = process.env.SNAPP_FROM_NAME || "Snapp";

  if (!resendApiKey) {
    throw new Error("Variável RESEND_API_KEY não configurada para email de abandono.");
  }

  const resend = new Resend(resendApiKey);

  const t = getCartAbandonmentTranslation(params.language);
  const subject = t.subject(params.productName);
  const html = buildCartAbandonmentHtml(params);

  let status: "sent" | "failed" = "sent";
  let errorMessage: string | undefined;

  try {
    const { error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: params.to,
      subject,
      html,
    });
    if (error) {
      throw new Error(error.message);
    }
  } catch (err: any) {
    status = "failed";
    errorMessage = err.message;
    throw err;
  } finally {
    if (params.ownerId) {
      EmailLog.create({
        ownerId: params.ownerId,
        offerId: params.offerId || undefined,
        type: "cart_abandonment",
        to: params.to,
        customerName: params.customerName,
        subject,
        htmlContent: html,
        status,
        errorMessage,
        sentAt: new Date(),
      }).catch(() => {});
    }
  }
};

// ---------------------------------------------------------------------------
// PURCHASE CONFIRMATION EMAIL
// ---------------------------------------------------------------------------

export const sendPurchaseConfirmationEmail = async (params: SendPurchaseEmailParams): Promise<void> => {
  const { smtp, to, customerName, productName, language, subject } = params;

  if (!smtp.host || !smtp.user || !smtp.pass || !smtp.fromEmail) {
    throw new Error("Configurações SMTP incompletas.");
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port || 587,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  const t = getTranslation(language);
  const emailSubject = subject || t.defaultSubject(productName);
  const html = buildEmailHtml(params);

  let status: "sent" | "failed" = "sent";
  let errorMessage: string | undefined;

  try {
    await transporter.sendMail({
      from: `"${smtp.fromName || smtp.fromEmail}" <${smtp.fromEmail}>`,
      to,
      subject: emailSubject,
      html,
    });
  } catch (err: any) {
    status = "failed";
    errorMessage = err.message;
    throw err;
  } finally {
    if (params.ownerId) {
      EmailLog.create({
        ownerId: params.ownerId,
        offerId: params.offerId || undefined,
        type: "purchase_confirmation",
        to,
        customerName,
        subject: emailSubject,
        htmlContent: html,
        status,
        errorMessage,
        sentAt: new Date(),
      }).catch(() => {});
    }
  }
};
