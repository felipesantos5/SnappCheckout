import nodemailer from "nodemailer";

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

  await transporter.sendMail({
    from: `"${smtp.fromName || smtp.fromEmail}" <${smtp.fromEmail}>`,
    to,
    subject: emailSubject,
    html,
  });
};
