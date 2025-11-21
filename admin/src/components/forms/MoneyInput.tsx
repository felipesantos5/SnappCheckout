import { useState, useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface MoneyInputProps {
  form: UseFormReturn<any>;
  name: string;
  label: string;
  placeholder?: string;
  disabled?: boolean;
}

export const MoneyInput = ({ form, name, label, placeholder, disabled }: MoneyInputProps) => {
  // Estado local para controlar o que é exibido no input (texto com R$)
  const [displayValue, setDisplayValue] = useState("");

  // Função para formatar centavos em Real (R$ 10,00)
  const formatCurrency = (cents: number | undefined | null) => {
    if (cents === undefined || cents === null) return "";
    return (cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  // Sincroniza o valor do formulário com o display inicial
  useEffect(() => {
    const value = form.getValues(name);
    setDisplayValue(formatCurrency(value));
  }, [form, name]); // Dependência segura

  // Quando o usuário digita
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;

    // Permite apenas números e uma vírgula
    // Ex: "100" ou "100,50"
    const sanitizedValue = rawValue.replace(/[^0-9,]/g, "");

    // Atualiza o visual imediatamente para o usuário não sentir "travado"
    setDisplayValue(rawValue);

    // Converte para número (float) para calcular centavos
    // Substitui vírgula por ponto para o JS entender
    const floatValue = parseFloat(sanitizedValue.replace(",", "."));

    if (!isNaN(floatValue)) {
      // Converte para centavos (Inteiro) e atualiza o formulário
      // Ex: 100,50 vira 10050
      const cents = Math.round(floatValue * 100);
      form.setValue(name, cents, { shouldValidate: true });
    } else {
      // Se limpar o campo, define como 0 ou undefined
      form.setValue(name, 0, { shouldValidate: true });
    }
  };

  // Quando o usuário sai do campo (Blur)
  const handleBlur = () => {
    const currentFormValue = form.getValues(name);
    // Reformata para ficar bonito (Ex: user digitou "10" -> vira "R$ 10,00")
    setDisplayValue(formatCurrency(currentFormValue));
  };

  // Quando o usuário foca no campo
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Remove o "R$" e espaços para facilitar a edição
    // Se for R$ 10,00 vira 10,00
    const currentString = displayValue
      .replace("R$", "")
      .replace(/\s/g, "")
      .replace(".", "") // Tira ponto de milhar se houver
      .trim();

    setDisplayValue(currentString);
    e.target.select(); // Seleciona tudo para facilitar substituir
  };

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              // Sobrescrevemos o value e onChange do field original
              value={displayValue}
              onChange={handleChange}
              onBlur={() => {
                handleBlur();
                field.onBlur(); // Chama o blur original do react-hook-form
              }}
              onFocus={handleFocus}
              placeholder={placeholder}
              disabled={disabled}
              autoComplete="off"
              className="font-mono" // Fonte monoespaçada ajuda a alinhar números
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
