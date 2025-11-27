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
  US: "United States of America",
  BR: "Brazil",
  PT: "Portugal",
  GB: "United Kingdom",
  FR: "France",
  DE: "Germany",
  ES: "Spain",
  IT: "Italy",
  CA: "Canada",
  AU: "Australia",
  MX: "Mexico",
  AR: "Argentina",
  CO: "Colombia",
  CL: "Chile",
  PE: "Peru",
  JP: "Japan",
  CN: "China",
  IN: "India",
  RU: "Russia",
  ZA: "South Africa",
  // Adicione outros se notar algum país faltando cor
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

  useEffect(() => {
    setMounted(true);
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
    <Card className="col-span-1 lg:col-span-2 overflow-hidden flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Vendas por Região</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 flex-1">
        {/* --- MAPA MUNDI --- */}
        <div className="w-full h-[300px] bg-slate-50/50 rounded-lg border border-slate-100 relative overflow-hidden flex items-center justify-center">
          {mounted && (
            <>
              <ComposableMap projectionConfig={{ rotate: [-10, 0, 0], scale: 120 }} width={1000} height={850}>
                <ZoomableGroup center={[16, 0]} maxZoom={4} zoom={2} minZoom={2}>
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const geoName = geo.properties.name; // Ex: "Brazil", "United States of America"

                        // LÓGICA CORRIGIDA:
                        // 1. Procura no seu array 'data' algum item onde a tradução ISO -> Nome bata com o mapa
                        // Ex: Se data tem {name: "US"}, ISO_TO_GEO_NAME["US"] vira "United States of America".
                        // Isso bate exatamente com geoName.
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
        <div className="">
          <div className="overflow-y-auto pr-2 custom-scrollbar flex gap-3 flex-wrap">
            {data.slice(0, 6).map((country, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 p-2 rounded-md transition-colors ">
                <div className="flex items-center gap-2 flex-1">
                  <img src={`https://flagcdn.com/w40/${country.name.toLowerCase()}.png`} alt={country.name} className="w-7 h-5 rounded object-none" />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground uppercase">{country.name}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-foreground">{formatCurrency(country.value)}</div>
                  <div className="text-xs text-muted-foreground">{country.count} vendas</div>
                </div>
              </div>
            ))}

            {/* Indicador de países adicionais */}
            {data.length > 6 && (
              <div className="flex items-center justify-center w-full p-2">
                <span className="text-xs text-muted-foreground">+ {data.length - 6} outros países</span>
              </div>
            )}

            {data.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma venda registrada por região.</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
