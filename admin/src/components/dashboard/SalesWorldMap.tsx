import { useEffect, useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "react-tooltip";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// --- MAPA DE TRADUÇÃO (ISO 2 -> Nome no TopoJSON) ---
// O arquivo countries-110m usa nomes em inglês específicos.
// Adicionei os principais países de e-commerce. Adicione mais conforme precisar.
const ISO_TO_GEO_NAME: Record<string, string> = {
  // Américas
  US: "United States of America",
  BR: "Brazil",
  CA: "Canada",
  MX: "Mexico",
  AR: "Argentina",
  CO: "Colombia",
  CL: "Chile",
  PE: "Peru",
  UY: "Uruguay",
  EC: "Ecuador",
  VE: "Venezuela",
  // Europa Ocidental
  PT: "Portugal",
  GB: "United Kingdom",
  FR: "France",
  DE: "Germany",
  ES: "Spain",
  IT: "Italy",
  NL: "Netherlands",
  BE: "Belgium",
  CH: "Switzerland",
  AT: "Austria",
  IE: "Ireland",
  LU: "Luxembourg",
  // Europa do Norte
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  IS: "Iceland",
  // Europa Oriental
  PL: "Poland",
  CZ: "Czechia",
  RO: "Romania",
  HU: "Hungary",
  BG: "Bulgaria",
  SK: "Slovakia",
  HR: "Croatia",
  RS: "Serbia",
  UA: "Ukraine",
  BY: "Belarus",
  LT: "Lithuania",
  LV: "Latvia",
  EE: "Estonia",
  SI: "Slovenia",
  BA: "Bosnia and Herz.",
  AL: "Albania",
  MK: "Macedonia",
  GR: "Greece",
  // Ásia & Oceania
  JP: "Japan",
  CN: "China",
  IN: "India",
  KR: "South Korea",
  AU: "Australia",
  NZ: "New Zealand",
  IL: "Israel",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  TR: "Turkey",
  TH: "Thailand",
  PH: "Philippines",
  MY: "Malaysia",
  SG: "Singapore",
  ID: "Indonesia",
  // África
  ZA: "South Africa",
  NG: "Nigeria",
  EG: "Egypt",
  MA: "Morocco",
  KE: "Kenya",
  AO: "Angola",
  MZ: "Mozambique",
  // Outros
  RU: "Russia",
};

interface CountryData {
  name: string; // ISO 2 (BR, US, FR)
  value: number;
  count: number;
}

interface SalesWorldMapProps {
  data: CountryData[];
}

export function SalesWorldMap({ data }: SalesWorldMapProps) {
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Detecta se é desktop (>= 640px)
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 640);
    };

    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);

    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  // 1. Prepara os dados: Mapa de calor
  const maxRevenue = useMemo(() => Math.max(...data.map((d) => d.value), 0), [data]);

  const colorScale = scaleLinear<string>()
    .domain([0, maxRevenue || 1])
    .range(["#F3F4F6", "#EAB308"]); // Cinza -> Amarelo

  // 2. Mapa otimizado para busca rápida
  const dataMap = useMemo(() => {
    const map = new Map();
    data.forEach((d) => {
      map.set(d.name.toUpperCase(), d); // Garante uppercase para bater com a chave
    });
    return map;
  }, [data]);

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base sm:text-lg">Vendas por Região</CardTitle>
      </CardHeader>
      1
      <CardContent className="flex flex-col gap-2 sm:gap-3 flex-1 p-3 sm:p-6 pt-0 pb-0!">
        {/* --- MAPA MUNDI --- */}
        <div className="w-full h-[180px] sm:h-[280px] bg-slate-50/50 dark:bg-slate-800/20 rounded-lg border border-slate-100 dark:border-slate-700 relative overflow-hidden flex items-center justify-center">
          {mounted && (
            <>
              <ComposableMap projectionConfig={{ rotate: [-10, 0, 0], scale: 120 }} width={1000} height={850}>
                <ZoomableGroup center={[16, 0]} maxZoom={4} zoom={2} minZoom={2}>
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const geoName = geo.properties.name;
                        const countryData = Array.from(dataMap.values()).find((d) => {
                          const mappedName = ISO_TO_GEO_NAME[d.name.toUpperCase()];
                          return mappedName === geoName;
                        });

                        const revenue = countryData ? countryData.value : 0;
                        const fillColor = revenue > 0 ? colorScale(revenue) : "#E5E7EB";

                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            data-tooltip-id="my-tooltip"
                            data-tooltip-content={`${geoName}: ${countryData ? formatCurrency(countryData.value) : "Sem vendas"}`}
                            style={{
                              default: {
                                fill: fillColor,
                                outline: "none",
                                stroke: "#FFFFFF",
                                strokeWidth: 0.5,
                              },
                              hover: {
                                fill: revenue > 0 ? "#CA8A04" : "#D1D5DB",
                                outline: "none",
                                cursor: "pointer",
                              },
                              pressed: {
                                outline: "none",
                              },
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>
              <Tooltip id="my-tooltip" />
            </>
          )}
        </div>

        {/* --- LISTA DE PAÍSES --- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* Mobile: 6 países (2 cols x 3 rows) | Desktop: 9 países (3 cols x 3 rows) */}
          {data.slice(0, isDesktop ? 9 : 6).map((country, idx) => (
            <div key={idx} className="flex items-center gap-2 p-1.5 sm:p-2 rounded-md bg-muted/30">
              <img src={`https://flagcdn.com/w40/${country.name.toLowerCase()}.png`} alt={country.name} className="w-5 h-3.5 sm:w-7 sm:h-5 rounded object-contain shrink-0" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs font-semibold text-foreground uppercase">{country.name}</span>
                <span className="text-[10px] sm:text-xs font-bold text-chart-1">{formatCurrency(country.value)}</span>
              </div>
            </div>
          ))}
        </div>
        {data.length === 0 && <div className="text-center py-4 text-muted-foreground text-xs sm:text-sm">Nenhuma venda registrada.</div>}
      </CardContent>
    </Card>
  );
}
