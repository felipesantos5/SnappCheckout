import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { format, subDays, isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar"; // Certifique-se de ter este componente
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, ShoppingBag, Info } from "lucide-react";
import { API_URL } from "@/config/BackendUrl";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Sale } from "@/types/sale";
import { formatCurrency } from "@/helper/formatCurrency";
import { formatDate } from "@/helper/formatDate";
import { getCountryName } from "@/helper/getCountryFlag";
import { CountryFlag } from "../CountryFlag";

type DateRangeFilter = "all" | "today" | "week" | "month" | "custom";

export function RecentSalesTable() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados de Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Reduzi para 10 para caber melhor com detalhes

  // Estados de Filtro
  const [filterType, setFilterType] = useState<DateRangeFilter>("week"); // Padrão: Última semana
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  // Fetch Inicial (Idealmente, filtros devem ser passados para o Backend para performance)
  // Por enquanto, faremos a filtragem no Client-Side conforme os dados que temos.
  useEffect(() => {
    const fetchSales = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`${API_URL}/sales`);
        if (Array.isArray(response.data)) {
          // Ordenar por data mais recente primeiro
          const sortedSales = response.data.sort((a: Sale, b: Sale) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setSales(sortedSales);
        } else {
          setSales([]);
        }
      } catch (error) {
        toast.error("Erro ao carregar vendas", {
          description: "Não foi possível buscar o histórico de vendas.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSales();
  }, []);

  // --- Lógica de Filtragem ---
  const filteredSales = useMemo(() => {
    if (filterType === "all") return sales;

    const now = new Date();
    let start = startOfDay(now);
    let end = endOfDay(now);

    if (filterType === "today") {
      // Já configurado acima
    } else if (filterType === "week") {
      start = startOfDay(subDays(now, 7));
    } else if (filterType === "month") {
      start = startOfDay(subDays(now, 30));
    } else if (filterType === "custom") {
      if (!dateRange.from) return sales;
      start = startOfDay(dateRange.from);
      end = endOfDay(dateRange.to || dateRange.from);
    }

    return sales.filter((sale) => {
      const saleDate = parseISO(sale.createdAt);
      return isWithinInterval(saleDate, { start, end });
    });
  }, [sales, filterType, dateRange]);

  // --- Paginação dos Filtrados ---
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSales = filteredSales.slice(startIndex, startIndex + itemsPerPage);

  // Resetar página quando filtro muda
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, dateRange]);

  return (
    <Card className="w-full shadow-md border-gray-200">
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold text-foreground">Vendas Recentes</CardTitle>
            <CardDescription>Gerencie suas transações e acompanhe o desempenho.</CardDescription>
          </div>

          {/* Área de Filtros */}
          <div className="flex items-center gap-2">
            <Select value={filterType} onValueChange={(val) => setFilterType(val as DateRangeFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Últimos 7 dias</SelectItem>
                <SelectItem value="month">Últimos 30 dias</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
                <SelectItem value="all">Todo o período</SelectItem>
              </SelectContent>
            </Select>

            {filterType === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("w-60 justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM", { locale: ptBR })} - {format(dateRange.to, "dd/MM", { locale: ptBR })}
                        </>
                      ) : (
                        format(dateRange.from, "dd/MM", { locale: ptBR })
                      )
                    ) : (
                      <span>Selecione a data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range: any) => setDateRange(range)} // Tipagem 'any' rápida para compatibilidade shadcn
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-center w-16">País</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Oferta / Itens</TableHead>
                <TableHead className="text-center">Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                    <p className="text-sm text-gray-500 mt-2">Carregando transações...</p>
                  </TableCell>
                </TableRow>
              ) : paginatedSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
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
                          {sale.status === "succeeded" ? "Aprovada" : sale.status === "refunded" ? "Reembolsada" : "Pendente"}
                        </Badge>
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
          <div className="flex items-center justify-between mt-4 border-t pt-4">
            <div className="text-sm text-muted-foreground">
              Mostrando {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredSales.length)} de {filteredSales.length}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8"
              >
                Próxima
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
