import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpCircle, Zap, ShoppingBag, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { API_URL } from "@/config/BackendUrl";
import { formatCurrency } from "@/helper/formatCurrency";
import { useAuth } from "@/context/AuthContext"; // Importar contexto de Auth se precisar de token
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { CountryFlag } from "../CountryFlag";
import { PaypalIcon } from "../icons/paypal";
import { StripeIcon } from "../icons/stripe";
import { PixIcon } from "../icons/pix";

interface SaleItem {
  name: string;
  isOrderBump: boolean;
}

interface Sale {
  _id: string;
  offerId: any;
  customerName: string;
  customerEmail: string;
  totalAmountInCents: number;
  currency: string;
  status: "succeeded" | "pending" | "refunded" | "failed" | "abandoned";
  items: SaleItem[];
  failureMessage?: string;
  failureReason?: string;
  createdAt: string;
  isUpsell: boolean;
  ip?: string;
  country?: string;
  paymentMethod?: "stripe" | "paypal" | "pagarme";
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

interface SalesHistoryTableProps {
  offerId: string;
}

export function SalesHistoryTable({ offerId }: SalesHistoryTableProps) {
  const { token } = useAuth(); // Usar token para autenticação
  const [sales, setSales] = useState<Sale[]>([]);
  // const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!offerId || !token) return;

    const fetchSales = async () => {
      // setIsLoading(true);
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
        // setIsLoading(false);
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
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Oferta</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Plataforma</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead className="text-right">Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => (
            <TableRow key={sale._id}>
              <TableCell>
                <div className="flex flex-col">
                  <div className="flex">
                    <CountryFlag countryCode={sale.country} />
                    <span className="font-medium text-foreground">{sale.customerName}</span>
                  </div>
                  <div className="flex items-center mt-1 text-xs text-muted-foreground gap-2">
                    <span className="flex items-center bg-muted px-1.5 py-0.5 rounded">{sale.ip || "IP Oculto"}</span>
                    <span>{sale.customerEmail}</span>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <TableCell>{getSaleTypeIcon(sale)}</TableCell>
              </TableCell>

              <TableCell>
                {/* Lógica de Renderização de Status Melhorada */}
                {sale.status === "succeeded" ? (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Aprovada
                  </Badge>
                ) : sale.status === "failed" ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="destructive" className="cursor-help">
                          <XCircle className="w-3 h-3 mr-1" /> Falhou
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-semibold text-red-400">Motivo: {sale.failureReason}</p>
                        <p className="text-xs">{sale.failureMessage}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : sale.status === "pending" ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="border-yellow-400 text-yellow-600 bg-yellow-50 cursor-help">
                          <Clock className="w-3 h-3 mr-1" /> Iniciada
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Cliente iniciou o checkout mas ainda não concluiu</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : sale.status === "abandoned" ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="border-orange-400 text-orange-600 bg-orange-50 cursor-help">
                          <AlertCircle className="w-3 h-3 mr-1" /> Abandonada
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Cliente abandonou o checkout sem concluir</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : sale.status === "refunded" ? (
                  <Badge variant="secondary" className="border-gray-400 text-gray-600">
                    Reembolsada
                  </Badge>
                ) : (
                  <Badge variant="secondary">{sale.status}</Badge>
                )}
              </TableCell>

              <TableCell className="text-center">
                {sale.paymentMethod === "stripe" && <StripeIcon className="h-5 w-5 mx-auto" />}
                {sale.paymentMethod === "paypal" && <PaypalIcon className="h-5 w-5 mx-auto" />}
                {sale.paymentMethod === "pagarme" && <PixIcon className="h-5 w-5 mx-auto" />}
              </TableCell>

              <TableCell>
                <div className="font-medium">
                  {formatCurrency(sale.totalAmountInCents, sale.currency || "BRL")}
                  {/* Se falhou ou pendente, mostrar texto explicativo pequeno */}
                  {sale.status === "failed" && <span className="block text-[10px] text-red-500 font-normal mt-0.5">Não cobrado</span>}
                  {(sale.status === "pending" || sale.status === "abandoned") && <span className="block text-[10px] text-yellow-600 font-normal mt-0.5">Aguardando</span>}
                </div>
              </TableCell>

              <TableCell className="text-right text-muted-foreground">{formatDate(sale.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
