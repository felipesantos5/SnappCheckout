import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpCircle, Zap, ShoppingBag, CheckCircle2, XCircle } from "lucide-react";
import { API_URL } from "@/config/BackendUrl";
import { formatCurrency } from "@/helper/formatCurrency";
import { useAuth } from "@/context/AuthContext"; // Importar contexto de Auth se precisar de token
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { CountryFlag } from "../CountryFlag";

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
  status: "succeeded" | "pending" | "refunded" | "failed";
  items: SaleItem[];
  failureMessage?: string;
  failureReason?: string;
  createdAt: string;
  isUpsell: boolean;
  ip?: string;
  country?: string;
  paymentMethod?: "stripe" | "paypal";
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
            <TableHead>Plataforma</TableHead>
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
                ) : (
                  <Badge variant="secondary">{sale.status}</Badge>
                )}
              </TableCell>

              <TableCell className="text-center">
                {sale.paymentMethod === "paypal" ? (
                  <svg className="h-6 w-6 mx-auto" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7.076 21.337H2.470a0.641 0.641 0 01-0.633-0.74L4.944 3.72a0.773 0.773 0 010.761-0.654h6.95c2.3 0 3.91 0.487 4.787 1.447 0.817 0.894 1.11 2.213 0.869 3.918l-0.014 0.087c-0.514 3.289-2.278 4.96-5.239 4.96H9.65a0.641 0.641 0 00-0.633 0.54l-0.752 4.768-0.213 1.35a0.334 0.334 0 01-0.33 0.284L7.076 21.337z" fill="#253B80"/>
                    <path d="M17.588 8.604c-0.586 3.762-2.575 5.67-5.918 5.67H9.645a0.772 0.772 0 00-0.762 0.65l-0.966 6.121a0.405 0.405 0 000.4 0.343h2.862a0.677 0.677 0 000.669-0.571l0.028-0.142 0.53-3.36 0.034-0.184a0.677 0.677 0 010.669-0.571h0.42c2.728 0 4.866-1.108 5.489-4.314 0.26-1.338 0.125-2.455-0.563-3.24-0.208-0.237-0.466-0.432-0.768-0.586l0.054 0.184z" fill="#179BD7"/>
                    <path d="M16.544 8.05a5.65 5.65 0 00-0.696-0.155 8.783 8.783 0 00-1.397-0.1h-4.237a0.676 0.676 0 00-0.669 0.571L8.67 13.565l-0.027 0.172a0.772 0.772 0 010.762-0.65h1.587c3.343 0 5.96-1.358 6.726-5.286 0.023-0.116 0.042-0.229 0.058-0.338-0.192-0.101-0.397-0.19-0.619-0.264a5.99 5.99 0 00-0.614-0.15z" fill="#222D65"/>
                  </svg>
                ) : (
                  <svg className="h-6 w-6 mx-auto" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.664 2.084-1.664 1.753 0 3.104.962 3.104.962l1.138-1.913s-1.425-1.165-4.088-1.165c-3.215 0-5.42 1.863-5.42 4.357 0 1.988 1.544 3.333 3.79 4.08 1.805.593 2.826 1.165 2.826 2.235 0 .93-.759 1.759-2.132 1.759-1.816 0-3.53-1.094-3.53-1.094l-1.283 1.913s1.735 1.378 4.611 1.378c3.354 0 5.536-1.752 5.536-4.426 0-2.168-1.563-3.41-3.28-4.013z" fill="#6772E5"/>
                  </svg>
                )}
              </TableCell>

              <TableCell>
                <div className="font-medium">
                  {formatCurrency(sale.totalAmountInCents, sale.currency || "BRL")}
                  {/* Se falhou, mostrar texto explicativo pequeno */}
                  {sale.status === "failed" && <span className="block text-[10px] text-red-500 font-normal mt-0.5">Não cobrado</span>}
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
