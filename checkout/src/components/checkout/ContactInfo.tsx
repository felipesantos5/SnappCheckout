import React, { useState, useRef } from "react";
import { Input } from "../ui/Input";
import { useTranslation } from "../../i18n/I18nContext";
import { useTheme } from "../../context/ThemeContext";
import { API_URL } from "../../config/BackendUrl";

interface ContactInfoProps {
  showPhone?: boolean;
  showDocument?: boolean;
  offerID: string;
  abTestId?: string | null;
}

export const ContactInfo: React.FC<ContactInfoProps> = ({ showPhone = true, showDocument = false, offerID, abTestId }) => {
  const { t } = useTranslation();
  const { textColor } = useTheme(); // Hook do tema
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const checkoutStartedSent = useRef(false); // Flag para evitar múltiplas chamadas

  const handleEmailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;

    // Só dispara quando o email tem pelo menos 3 caracteres antes do @ e contém @
    // Exemplo: "abc@" já seria suficiente para contar como checkout iniciado
    if (email.length >= 4 && email.includes("@") && !checkoutStartedSent.current) {
      checkoutStartedSent.current = true;

      try {
        // Tracking padrão da oferta (contador no model Offer)
        fetch(`${API_URL}/offers/checkout-started`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offerId: offerID }),
        }).catch((err) => console.error("Erro tracking offer:", err));

        // Tracking de métrica initiate_checkout (para o dashboard de analytics)
        fetch(`${API_URL}/metrics/track`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offerId: offerID,
            type: "initiate_checkout",
          }),
        }).catch((err) => console.error("Erro tracking initiate_checkout:", err));

        // Tracking do Teste A/B (se houver)
        if (abTestId) {
          fetch(`${API_URL}/abtests/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              abTestId,
              offerId: offerID,
              type: "initiate_checkout",
            }),
          }).catch((err) => console.error("Erro tracking AB Test:", err));
        }
      } catch (error) {
        console.error("Erro ao registrar checkout iniciado:", error);
      }
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/\D/g, "");
    value = value.slice(0, 11);

    if (value.length > 10) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    } else if (value.length > 6) {
      value = value.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{0,4})/, "($1) $2");
    } else if (value.length > 0) {
      value = value.replace(/^(\d{0,2})/, "($1");
    }

    setPhone(value);
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");

    // Limite para CNPJ
    if (value.length > 14) value = value.slice(0, 14);

    // Máscara CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00)
    if (value.length <= 11) {
      // CPF
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      // CNPJ
      value = value.replace(/^(\d{2})(\d)/, "$1.$2");
      value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
      value = value.replace(/\.(\d{3})(\d)/, ".$1/$2");
      value = value.replace(/(\d{4})(\d)/, "$1-$2");
    }

    setDocument(value);
  };

  return (
    <div className="w-full mt-4">
      <h2
        className="text-lg font-semibold mb-4"
        style={{ color: textColor }} // Cor do texto dinâmica
      >
        {t.contact.title}
      </h2>
      <div className="space-y-4">
        <Input
          label={t.contact.email}
          id="email"
          type="email"
          required
          placeholder={t.contact.emailPlaceholder}
          onChange={handleEmailChange}
        />
        <Input label={t.contact.name} id="name" type="text" required placeholder={t.contact.namePlaceholder} />
        {showPhone && (
          <Input
            label={t.contact.phone || "Telefone"}
            onChange={handlePhoneChange}
            value={phone}
            id="phone"
            type="tel"
            maxLength={15}
            placeholder={t.contact.phonePlaceholder || "(00) 00000-0000"}
          />
        )}
        {showDocument && (
          <Input
            label="CPF / CNPJ"
            onChange={handleDocumentChange}
            value={document}
            id="document"
            type="text"
            maxLength={18}
            placeholder="000.000.000-00"
            required
          />
        )}
      </div>
    </div>
  );
};
