import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, ChevronLeft, ChevronRight, ShoppingBag, Info } from "lucide-react";
import { API_URL } from "@/config/BackendUrl";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Sale } from "@/types/sale";
import { formatCurrency } from "@/helper/formatCurrency";
import { formatDate } from "@/helper/formatDate";
import { getCountryName } from "@/helper/getCountryFlag";
import { CountryFlag } from "../CountryFlag";
import { StripeIcon } from "../icons/stripe";
import { PaypalIcon } from "../icons/paypal";
import { PixIcon } from "../icons/pix";
import type { DateRange } from "react-day-picker";
import { useAuth } from "@/context/AuthContext";

interface RecentSalesTableProps {
  period?: string; // "1" (hoje), "7", "30", "90", "custom"
  customDateRange?: DateRange;
}

export function RecentSalesTable({ period = "7", customDateRange }: RecentSalesTableProps) {
  const { token } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados de Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch com filtro de data do backend para trazer TODAS as vendas do período
  useEffect(() => {
    if (!token) return;

    const fetchSales = async () => {
      setIsLoading(true);
      try {
        const now = new Date();
        let startDate: Date;
        let endDate: Date = endOfDay(now);

        if (period === "custom" && customDateRange?.from) {
          startDate = startOfDay(customDateRange.from);
          endDate = endOfDay(customDateRange.to || customDateRange.from);
        } else {
          const days = period === "1" ? 0 : period === "7" ? 6 : period === "30" ? 29 : 89;
          startDate = startOfDay(subDays(now, days));
        }

        const params = new URLSearchParams({
          limit: "1000",
          page: "1",
          status: "succeeded",
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        const response = await axios.get(`${API_URL}/sales?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const salesData = response.data?.data || response.data;

        if (Array.isArray(salesData)) {
          const sortedSales = salesData.sort((a: Sale, b: Sale) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setSales(sortedSales);
        } else {
          setSales([]);
        }
      } catch (error) {
        console.error("Erro ao carregar vendas:", error);
        toast.error("Erro ao carregar vendas", {
          description: "Não foi possível buscar o histórico de vendas.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSales();
  }, [token, period, customDateRange]);

  // Os dados já vêm filtrados do backend por período e status
  const filteredSales = sales;

  // --- Paginação dos Filtrados ---
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSales = filteredSales.slice(startIndex, startIndex + itemsPerPage);

  // Resetar página quando os dados mudam (novo período = novo fetch)
  useEffect(() => {
    setCurrentPage(1);
  }, [sales]);

  return (
    <Card className="w-full shadow-md border-gray-200 dark:border-gray-700 gap-0">
      <CardHeader className="pb-0 px-3 sm:px-6 pt-3 sm:pt-6 pt-0!">
        <div className="min-w-0">
          <CardTitle className="text-base sm:text-xl font-bold text-foreground">Vendas Recentes</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {isLoading ? (
              "Carregando..."
            ) : (
              <>
                Exibindo{" "}
                <span className="font-medium text-foreground">{filteredSales.length}</span>{" "}
                {filteredSales.length === 1 ? "venda aprovada" : "vendas aprovadas"}{" "}
                {period === "1"
                  ? "de hoje"
                  : period === "7"
                    ? "dos últimos 7 dias"
                    : period === "30"
                      ? "dos últimos 30 dias"
                      : period === "90"
                        ? "dos últimos 90 dias"
                        : "no período selecionado"}
              </>
            )}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-6 pt-0">
        <div className="rounded-lg border overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-center w-16">País</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Oferta / Itens</TableHead>
                <TableHead className="text-center">Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10">Plataforma</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                    <p className="text-sm text-gray-500 mt-2">Carregando transações...</p>
                  </TableCell>
                </TableRow>
              ) : paginatedSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    Nenhuma venda encontrada neste período.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSales.map((sale) => {
                  const hasOrderBump = sale.items.some((i) => i.isOrderBump);
                  const itemsCount = sale.items.length;

                  return (
                    <TableRow key={sale._id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(sale.createdAt)}</TableCell>

                      <TableCell className="text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>{sale.country && <CountryFlag countryCode={sale.country} />}</TooltipTrigger>
                            <TooltipContent>
                              <p>{getCountryName(sale.country)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium text-foreground">{sale.customerName}</div>
                        <div className="text-xs text-muted-foreground">{sale.customerEmail}</div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {sale.offerId ? (
                            <Link
                              to={`/offers/${sale.offerId._id}`}
                              className="font-medium text-yellow-500 hover:underline flex items-center gap-1 w-fit"
                            >
                              {sale.offerId.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground italic">Oferta Removida</span>
                          )}

                          {/* Detalhes dos Itens via Popover/Tooltip Simples */}
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <ShoppingBag className="h-3 w-3" />
                            {itemsCount} {itemsCount === 1 ? "item" : "itens"}
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 rounded-full hover:bg-muted">
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 bg-popover p-3 shadow-xl">
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm border-b pb-1">Resumo do Pedido</h4>
                                  {sale.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-sm items-center">
                                      <span className={item.isOrderBump ? "text-purple-600 font-medium" : "text-foreground"}>
                                        {item.isOrderBump && <span className="text-xs mr-1">[Bump]</span>}
                                        {item.name}
                                      </span>
                                      <span className="text-muted-foreground">{formatCurrency(item.priceInCents, sale.currency)}</span>
                                    </div>
                                  ))}
                                  <div className="flex justify-between font-bold text-sm pt-2 border-t mt-2">
                                    <span>Total</span>
                                    <span>{formatCurrency(sale.totalAmountInCents, sale.currency)}</span>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          {/* TAG DE UPSELL (Prioridade Alta) */}
                          {sale.isUpsell && (
                            <Badge
                              variant="outline"
                              className="border-yellow-200 bg-yellow-50 text-yellow-700 text-[10px] px-1 py-0 h-5 font-semibold"
                            >
                              ⚡ Upsell
                            </Badge>
                          )}

                          {/* TAG DE ORDER BUMP */}
                          {hasOrderBump && (
                            <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 text-[10px] px-1 py-0 h-5">
                              + Bump
                            </Badge>
                          )}

                          {/* TAG PADRÃO (Só aparece se não for upsell nem bump) */}
                          {!hasOrderBump && !sale.isUpsell && (
                            <Badge variant="secondary" className="text-[10px] h-5">
                              Padrão
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          className={cn(
                            "capitalize font-normal",
                            sale.status === "succeeded" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
                            sale.status === "pending" && "bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
                            sale.status === "refunded" && "bg-red-100 text-red-700 hover:bg-red-100 border-red-200"
                          )}
                          variant="outline"
                        >
                          {sale.status === "succeeded" ? (
                            <span className="flex flex-col items-center">
                              <span>Aprovada</span>
                              {/* {sale.updatedAt && (
                                <span className="text-[10px] opacity-70">
                                  {new Date(sale.updatedAt).toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )} */}
                            </span>
                          ) : sale.status === "refunded" ? (
                            "Reembolsada"
                          ) : (
                            "Pendente"
                          )}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-center">

                        {sale.paymentMethod === "paypal" ? (
                          <PaypalIcon />
                        ) : sale.paymentMethod === "pagarme" ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <PixIcon className="w-5 h-5" />
                          </div>
                        ) : (
                          <StripeIcon className="w-10" />
                        )}

                      </TableCell>

                      <TableCell className="text-right font-bold text-foreground">{formatCurrency(sale.totalAmountInCents, sale.currency)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        {filteredSales.length > 0 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-3 sm:mt-4 border-t pt-3 sm:pt-4">
            <div className="text-xs sm:text-sm text-muted-foreground">
              {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredSales.length)} de {filteredSales.length}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
              >
                <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline ml-1">Anterior</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
              >
                <span className="hidden sm:inline mr-1">Próxima</span>
                <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
