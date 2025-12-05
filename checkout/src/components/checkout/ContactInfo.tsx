import React, { useState, useRef } from "react";
import { Input } from "../ui/Input";
import { useTranslation } from "../../i18n/I18nContext";
import { useTheme } from "../../context/ThemeContext";
import { API_URL } from "../../config/BackendUrl";

interface ContactInfoProps {
  showPhone?: boolean;
  offerID: string;
}

export const ContactInfo: React.FC<ContactInfoProps> = ({ showPhone = true, offerID }) => {
  const { t } = useTranslation();
  const { textColor } = useTheme(); // Hook do tema
  const [phone, setPhone] = useState("");
  const checkoutStartedSent = useRef(false); // Flag para evitar múltiplas chamadas

  const handleEmailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;

    // Só dispara quando o email tem pelo menos 3 caracteres antes do @ e contém @
    // Exemplo: "abc@" já seria suficiente para contar como checkout iniciado
    if (email.length >= 4 && email.includes("@") && !checkoutStartedSent.current) {
      checkoutStartedSent.current = true;

      try {
        await fetch(`${API_URL}/offers/checkout-started`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offerId: offerID }),
        });
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
            label={t.contact.phone}
            onChange={handlePhoneChange}
            value={phone}
            id="phone"
            type="tel"
            maxLength={15}
            placeholder={t.contact.phonePlaceholder}
          />
        )}
      </div>
    </div>
  );
};
