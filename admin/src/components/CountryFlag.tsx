import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Mapeamento de códigos de país (ISO 3166-1 alpha-2) para nomes completos
const countryNames: Record<string, string> = {
  BR: "Brasil",
  US: "Estados Unidos",
  GB: "Reino Unido",
  CA: "Canadá",
  AU: "Austrália",
  DE: "Alemanha",
  FR: "França",
  IT: "Itália",
  ES: "Espanha",
  PT: "Portugal",
  MX: "México",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colômbia",
  PE: "Peru",
  UY: "Uruguai",
  PY: "Paraguai",
  BO: "Bolívia",
  EC: "Equador",
  VE: "Venezuela",
  NL: "Holanda",
  BE: "Bélgica",
  CH: "Suíça",
  AT: "Áustria",
  SE: "Suécia",
  NO: "Noruega",
  DK: "Dinamarca",
  FI: "Finlândia",
  PL: "Polônia",
  CZ: "República Tcheca",
  HU: "Hungria",
  RO: "Romênia",
  GR: "Grécia",
  TR: "Turquia",
  RU: "Rússia",
  UA: "Ucrânia",
  JP: "Japão",
  CN: "China",
  KR: "Coreia do Sul",
  IN: "Índia",
  ID: "Indonésia",
  TH: "Tailândia",
  VN: "Vietnã",
  PH: "Filipinas",
  MY: "Malásia",
  SG: "Singapura",
  NZ: "Nova Zelândia",
  ZA: "África do Sul",
  EG: "Egito",
  NG: "Nigéria",
  KE: "Quênia",
  IL: "Israel",
  AE: "Emirados Árabes Unidos",
  SA: "Arábia Saudita",
  IE: "Irlanda",
};

export const CountryFlag = ({ countryCode }: { countryCode?: string }) => {
  if (!countryCode) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">🌐</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-popover text-popover-foreground border shadow-md">
            <p className="text-xs">País não identificado</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const countryName = countryNames[countryCode.toUpperCase()] || countryCode.toUpperCase();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <img
            src={`https://flagcdn.com/24x18/${countryCode.toLowerCase()}.png`}
            alt={countryName}
            className="inline-block mr-2 cursor-help"
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-popover text-popover-foreground border shadow-md">
          <p className="text-xs font-medium">{countryName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
