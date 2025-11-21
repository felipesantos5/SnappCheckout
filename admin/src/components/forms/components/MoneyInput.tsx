import { Input } from "@/components/ui/input";

interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number | undefined | string;
  onChange: (value: number) => void;
}

export const MoneyInput = ({ value, onChange, className, ...props }: MoneyInputProps) => {
  // Converte o valor numérico para exibição (ex: 10.5 -> "10,5")
  const toDisplay = (val: number | string | undefined): string => {
    if (val === undefined || val === "" || val === 0) return "";
    const num = Number(val);
    if (isNaN(num)) return "";
    // Remove zeros desnecessários (10.00 -> "10", 10.50 -> "10,5")
    return String(num).replace(".", ",");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    // Remove o prefixo "R$ " se existir
    raw = raw.replace(/^R\$\s?/, "");

    // Permite apenas números, vírgula e ponto
    raw = raw.replace(/[^\d,\.]/g, "");

    // Substitui ponto por vírgula
    raw = raw.replace(/\./g, ",");

    // Garante apenas uma vírgula
    const parts = raw.split(",");
    if (parts.length > 2) {
      raw = parts[0] + "," + parts.slice(1).join("");
    }

    // Limita a 2 casas decimais
    if (parts.length === 2 && parts[1].length > 2) {
      raw = parts[0] + "," + parts[1].slice(0, 2);
    }

    // Converte para número
    const numberValue = parseFloat(raw.replace(",", ".")) || 0;
    onChange(numberValue);
  };

  const displayValue = toDisplay(value);

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      className={className}
      value={displayValue ? `R$ ${displayValue}` : ""}
      onChange={handleChange}
      placeholder="R$ 0,00"
    />
  );
};
