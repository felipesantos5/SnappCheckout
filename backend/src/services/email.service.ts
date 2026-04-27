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
  subject?: string;
  heading?: string;
  body?: string;
  imageUrl?: string;
  pdfUrl?: string;
}

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
    heading,
    body,
    imageUrl,
    pdfUrl,
  } = params;

  const firstName = customerName.split(" ")[0];
  const formattedAmount = formatCurrency(totalAmountInCents, currency);
  const displayHeading = heading || "Sua compra foi confirmada!";
  const displayBody = body || "Obrigado pela sua compra. Seu pedido foi processado com sucesso.";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmação de Compra</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2563EB 0%,#1d4ed8 100%);padding:36px 40px;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">✓ Compra Confirmada</p>
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
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">Olá, ${firstName}!</p>
              <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">${displayHeading}</h2>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#4b5563;">${displayBody.replace(/\n/g, "<br/>")}</p>

              <!-- Order Summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Resumo do Pedido</p>
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
                        <td style="font-size:14px;font-weight:600;color:#374151;">Total Pago</td>
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
                      📄 Baixar Material
                    </a>
                  </td>
                </tr>
              </table>` : ""}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:13px;color:#9ca3af;">Este email foi enviado automaticamente. Por favor, não responda.</p>
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
  const { smtp, to, customerName, productName, subject } = params;

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

  const emailSubject = subject || `Sua compra de ${productName} foi confirmada!`;
  const html = buildEmailHtml(params);

  await transporter.sendMail({
    from: `"${smtp.fromName || smtp.fromEmail}" <${smtp.fromEmail}>`,
    to,
    subject: emailSubject,
    html,
  });
};
