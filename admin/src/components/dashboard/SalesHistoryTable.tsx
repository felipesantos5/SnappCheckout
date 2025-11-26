import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowUpCircle, Zap, ShoppingBag } from "lucide-react";
import { API_URL } from "@/config/BackendUrl";
import { formatCurrency } from "@/helper/formatCurrency";
import { useAuth } from "@/context/AuthContext"; // Importar contexto de Auth se precisar de token

interface SaleItem {
  name: string;
  isOrderBump: boolean;
}

interface Sale {
  _id: string;
  customerName: string;
  customerEmail: string;
  totalAmountInCents: number;
  currency: string;
  status: "succeeded" | "pending" | "refunded";
  items: SaleItem[];
  createdAt: string;
  isUpsell: boolean;
  ip?: string;
  country?: string;
}

// Helper para formatar data e hora
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

// Componente para renderizar a bandeira (usando API CDN pública para não pesar o bundle)
const CountryFlag = ({ countryCode }: { countryCode?: string }) => {
  if (!countryCode) return <span>🌐</span>;
  return (
    <img
      src={`https://flagcdn.com/24x18/${countryCode.toLowerCase()}.png`}
      alt={countryCode}
      className="inline-block mr-2 rounded-sm shadow-sm"
      title={countryCode}
    />
  );
};

interface SalesHistoryTableProps {
  offerId: string;
}

export function SalesHistoryTable({ offerId }: SalesHistoryTableProps) {
  const { token } = useAuth(); // Usar token para autenticação
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!offerId || !token) return;

    const fetchSales = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/sales/offer/${offerId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (Array.isArray(data)) {
          // Ordena por data (mais recente primeiro) caso o backend não garanta
          const sorted = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setSales(sorted);
        } else {
          setSales([]);
        }
      } catch (error) {
        toast.error("Erro ao carregar vendas.");
        setSales([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSales();
  }, [offerId, token]);

  const getSaleTypeIcon = (sale: Sale) => {
    if (sale.isUpsell) {
      return (
        <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50">
          <Zap className="w-3 h-3 mr-1" /> Upsell
        </Badge>
      );
    }

    const hasBump = sale.items.some((i) => i.isOrderBump);
    if (hasBump) {
      return (
        <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">
          <ArrowUpCircle className="w-3 h-3 mr-1" /> + Bump
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-muted-foreground">
        <ShoppingBag className="w-3 h-3 mr-1" /> Venda
      </Badge>
    );
  };

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle>Histórico de Transações</CardTitle>
        <CardDescription>Detalhamento de todas as vendas aprovadas para esta oferta.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente & IP</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
                  </TableCell>
                </TableRow>
              ) : sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Nenhuma venda registrada ainda.
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((sale) => (
                  <TableRow key={sale._id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{sale.customerName}</span>
                        <div className="flex items-center mt-1 text-xs text-muted-foreground gap-2">
                          <span className="flex items-center bg-muted px-1.5 py-0.5 rounded">
                            <CountryFlag countryCode={sale.country} />
                            {sale.ip || "IP Oculto"}
                          </span>
                          <span>{sale.customerEmail}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getSaleTypeIcon(sale)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(sale.createdAt)}</TableCell>
                    <TableCell className="text-right font-semibold text-green-700">{formatCurrency(sale.totalAmountInCents, sale.currency)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
