// src/components/dashboard/SalesHistoryTable.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { API_URL } from "@/config/BackendUrl";

// Interface para os dados da Venda (do backend)
interface Sale {
  _id: string;
  customerName: string;
  customerEmail: string;
  totalAmountInCents: number;
  status: "succeeded" | "pending" | "refunded";
  items: {
    name: string;
    isOrderBump: boolean;
  }[];
  createdAt: string; // Data em formato ISO string
}

// Helper para formatar moeda
const formatCurrency = (amountInCents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL", // TODO: Puxar a moeda da oferta
  }).format(amountInCents / 100);
};

// Helper para formatar data
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Props que o componente espera
interface SalesHistoryTableProps {
  offerId: string;
}

export function SalesHistoryTable({ offerId }: SalesHistoryTableProps) {
  const [sales, setSales] = useState<Sale[]>([]); // Inicia como array vazio
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!offerId) return;

    const fetchSales = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`${API_URL}/sales/offer/${offerId}`);

        // 2. CORREÇÃO DE DEFESA
        // Verifique se a resposta é realmente um array
        if (Array.isArray(response.data)) {
          setSales(response.data);
        } else {
          // Se não for (ex: API retornou { erro: ... } com status 200)
          console.error("API /sales/offer não retornou um array:", response.data);
          setSales([]); // Garante que 'sales' seja um array
        }
      } catch (error) {
        toast.error("Falha ao carregar histórico de vendas.", {
          description: (error as any).response?.data?.error?.message || (error as Error).message,
        });
        setSales([]); // Garante que 'sales' seja um array mesmo em caso de erro
      } finally {
        setIsLoading(false);
      }
    };

    fetchSales();
  }, [offerId]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Histórico de Vendas</CardTitle>
        <CardDescription>Exibindo as últimas vendas para esta oferta.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order Bump?</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : sales.length === 0 ? ( // Esta verificação agora é segura
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Nenhuma venda encontrada para esta oferta.
                  </TableCell>
                </TableRow>
              ) : (
                // 3. O .map() agora está seguro
                sales.map((sale) => {
                  const hasBump = sale.items.some((item) => item.isOrderBump);

                  return (
                    <TableRow key={sale._id}>
                      <TableCell>
                        <div className="font-medium">{sale.customerName}</div>
                        <div className="text-xs text-muted-foreground">{sale.customerEmail}</div>
                      </TableCell>
                      <TableCell>{formatDate(sale.createdAt)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={sale.status === "succeeded" ? "default" : sale.status === "refunded" ? "destructive" : "secondary"}
                          className={sale.status === "succeeded" ? "bg-green-600 text-white" : ""}
                        >
                          {sale.status === "succeeded" ? "Aprovada" : sale.status === "refunded" ? "Cancelada" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {hasBump ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(sale.totalAmountInCents)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
