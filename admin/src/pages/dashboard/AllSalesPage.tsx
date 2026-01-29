import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "@/config/BackendUrl";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Download, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/helper/formatCurrency";
import { formatDate } from "@/helper/formatDate";
import { getCountryFlag } from "@/helper/getCountryFlag";

interface Sale {
  _id: string;
  offerId: {
    _id: string;
    name: string;
    slug: string;
  } | null;
  totalAmountInCents: number;
  currency: string;
  status: "succeeded" | "failed" | "pending" | "refunded";
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  paymentMethod: string;
  paymentMethodType?: string;
  walletType?: "apple_pay" | "google_pay" | "samsung_pay" | null;
  country?: string;
  failureReason?: string;
  failureMessage?: string;
  createdAt: string;
  items?: Array<{
    name: string;
    priceInCents: number;
    isOrderBump: boolean;
  }>;
}

interface Offer {
  _id: string;
  name: string;
}

// Status com cores e descrições
const statusConfig = {
  succeeded: {
    label: "Aprovada",
    color: "bg-green-500/10 text-green-700 border-green-500/20",
    icon: "✓",
  },
  failed: {
    label: "Falhou",
    color: "bg-red-500/10 text-red-700 border-red-500/20",
    icon: "✕",
  },
  pending: {
    label: "Pendente",
    color: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
    icon: "⏱",
  },
  refunded: {
    label: "Reembolsada",
    color: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    icon: "↩",
  },
};

export function AllSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filtros
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [searchEmail, setSearchEmail] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterOfferId, setFilterOfferId] = useState<string>("all");
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all");
  const [filterWalletType, setFilterWalletType] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Buscar ofertas para o filtro
  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const response = await axios.get(`${API_URL}/offers`);
        setOffers(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error("Erro ao buscar ofertas:", error);
        setOffers([]);
      }
    };
    fetchOffers();
  }, []);

  // Buscar vendas
  const fetchSales = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterOfferId !== "all") params.append("offerId", filterOfferId);
      if (filterCountry !== "all") params.append("country", filterCountry);
      if (filterPaymentMethod !== "all") params.append("paymentMethod", filterPaymentMethod);
      if (filterWalletType !== "all") params.append("walletType", filterWalletType);
      if (searchEmail) params.append("email", searchEmail);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const response = await axios.get(`${API_URL}/sales?${params.toString()}`);
      const salesData = response.data?.data || [];
      const metaData = response.data?.meta || { total: 0 };

      setSales(Array.isArray(salesData) ? salesData : []);
      setTotal(metaData.total || 0);
    } catch (error) {
      toast.error("Erro ao buscar vendas", {
        description: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [page, filterStatus, filterOfferId, filterCountry, filterPaymentMethod, filterWalletType, startDate, endDate]);

  // Buscar ao pressionar Enter no campo de email
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setPage(1);
      fetchSales();
    }
  };

  // Exportar para CSV
  const handleExport = () => {
    if (!sales || sales.length === 0) {
      toast.error("Nenhuma venda para exportar");
      return;
    }

    try {
      const csvContent = [
        ["Data", "Status", "Cliente", "Email", "Oferta", "Valor", "Moeda", "País", "Método"].join(","),
        ...sales.map((sale) =>
          [
            new Date(sale.createdAt).toLocaleDateString(),
            statusConfig[sale.status]?.label || sale.status,
            sale.customerName || "",
            sale.customerEmail || "",
            sale.offerId?.name || "N/A",
            (sale.totalAmountInCents / 100).toFixed(2),
            (sale.currency || "BRL").toUpperCase(),
            sale.country || "N/A",
            sale.paymentMethod || "N/A",
          ].join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vendas-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      toast.success("Arquivo CSV exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar CSV:", error);
      toast.error("Erro ao exportar arquivo CSV");
    }
  };

  const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

  // Lista de países únicos (você pode expandir isso)
  const countries = ["BR", "US", "PT", "ES", "FR", "DE", "IT", "GB", "CA", "MX", "AR"];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Todas as Vendas</h1>
          <p className="text-muted-foreground">
            {isLoading ? "Carregando..." : `${total} ${total === 1 ? "venda" : "vendas"} encontradas`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchSales()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={sales.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Busca por Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Email do Cliente</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                className="pl-10"
              />
            </div>
          </div>

          {/* Filtro de Status */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="succeeded">✓ Aprovadas</SelectItem>
                <SelectItem value="failed">✕ Falhadas</SelectItem>
                <SelectItem value="pending">⏱ Pendentes</SelectItem>
                <SelectItem value="refunded">↩ Reembolsadas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro de Oferta */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Oferta</label>
            <Select value={filterOfferId} onValueChange={setFilterOfferId}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as ofertas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ofertas</SelectItem>
                {offers && offers.length > 0 ? (
                  offers.map((offer) => (
                    <SelectItem key={offer._id} value={offer._id}>
                      {offer.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    Nenhuma oferta encontrada
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro de País */}
          <div className="space-y-2">
            <label className="text-sm font-medium">País</label>
            <Select value={filterCountry} onValueChange={setFilterCountry}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os países" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os países</SelectItem>
                {countries.map((country) => (
                  <SelectItem key={country} value={country}>
                    <span
                      style={{
                        fontFamily:
                          '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif',
                      }}
                    >
                      {getCountryFlag(country)}
                    </span>{" "}
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro de Método de Pagamento */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Método de Pagamento</label>
            <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os métodos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os métodos</SelectItem>
                <SelectItem value="credit_card">💳 Cartão de Crédito</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro de Wallet Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Wallet Digital</label>
            <Select value={filterWalletType} onValueChange={setFilterWalletType}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as wallets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as wallets</SelectItem>
                <SelectItem value="apple_pay"> Apple Pay</SelectItem>
                <SelectItem value="google_pay">🅖 Google Pay</SelectItem>
                <SelectItem value="samsung_pay">Samsung Pay</SelectItem>
                <SelectItem value="none">Apenas Cartão Normal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data Inicial */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Data Inicial</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          {/* Data Final */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Data Final</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          {/* Botão Limpar Filtros */}
          <div className="space-y-2 flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSearchEmail("");
                setFilterStatus("all");
                setFilterOfferId("all");
                setFilterCountry("all");
                setFilterPaymentMethod("all");
                setFilterWalletType("all");
                setStartDate("");
                setEndDate("");
                setPage(1);
              }}
            >
              Limpar Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabela */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[120px]">Data</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Oferta</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-[80px] text-center">País</TableHead>
              <TableHead className="w-[120px]">Método</TableHead>
              <TableHead className="w-[150px]">Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-48 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : !sales || sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-48 text-center text-muted-foreground">
                  Nenhuma venda encontrada com os filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              sales.map((sale) => (
                <TableRow key={sale._id} className="hover:bg-muted/50">
                  {/* Data */}
                  <TableCell>
                    <div className="text-sm">{sale.createdAt ? formatDate(sale.createdAt) : "N/A"}</div>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge variant="outline" className={statusConfig[sale.status]?.color || ""}>
                      {statusConfig[sale.status]?.icon || ""} {statusConfig[sale.status]?.label || sale.status}
                    </Badge>
                  </TableCell>

                  {/* Cliente */}
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm">{sale.customerName}</div>
                      <div className="text-xs text-muted-foreground">{sale.customerEmail}</div>
                      {sale.customerPhone && <div className="text-xs text-muted-foreground">{sale.customerPhone}</div>}
                    </div>
                  </TableCell>

                  {/* Oferta */}
                  <TableCell>
                    {sale.offerId ? (
                      <div>
                        <div className="font-medium text-sm">{sale.offerId.name}</div>
                        <div className="text-xs text-muted-foreground">{sale.offerId.slug}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Oferta removida</span>
                    )}
                  </TableCell>

                  {/* Itens */}
                  <TableCell>
                    {sale.items && Array.isArray(sale.items) && sale.items.length > 0 ? (
                      <div className="space-y-1">
                        {sale.items.map((item, idx) => (
                          <div key={idx} className="text-xs">
                            <span className="font-medium">{item?.name || "Item"}</span>
                            {item?.isOrderBump && <Badge variant="secondary" className="ml-1 text-[10px] py-0 px-1">Bump</Badge>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>

                  {/* Valor */}
                  <TableCell className="text-right">
                    <div className="font-semibold">
                      {sale.totalAmountInCents && sale.currency
                        ? formatCurrency(sale.totalAmountInCents, sale.currency)
                        : "N/A"}
                    </div>
                  </TableCell>

                  {/* País */}
                  <TableCell className="text-center">
                    <div
                      className="text-2xl leading-none"
                      style={{
                        fontFamily:
                          '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif',
                        fontSize: "2rem",
                      }}
                    >
                      {getCountryFlag(sale.country || "BR")}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{sale.country || "N/A"}</div>
                  </TableCell>

                  {/* Método */}
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {/* Wallet Type (Apple Pay, Google Pay, etc) */}
                      {sale.walletType === "apple_pay" && (
                        <Badge variant="default" className="text-xs bg-black text-white hover:bg-black/90">
                           Apple Pay
                        </Badge>
                      )}
                      {sale.walletType === "google_pay" && (
                        <Badge variant="default" className="text-xs bg-blue-600 text-white hover:bg-blue-700">
                          🅖 Google Pay
                        </Badge>
                      )}
                      {sale.walletType === "samsung_pay" && (
                        <Badge variant="default" className="text-xs bg-blue-800 text-white hover:bg-blue-900">
                          Samsung Pay
                        </Badge>
                      )}

                      {/* Payment Method Fallback */}
                      {!sale.walletType && (
                        <Badge variant="secondary" className="text-xs">
                          {sale.paymentMethod === "credit_card" && "💳 Cartão"}
                          {sale.paymentMethod === "paypal" && "PayPal"}
                          {sale.paymentMethod === "pix" && "PIX"}
                          {sale.paymentMethodType === "card" && "💳 Cartão"}
                          {!["credit_card", "paypal", "pix", "card"].includes(sale.paymentMethod) &&
                           !["credit_card", "paypal", "pix", "card"].includes(sale.paymentMethodType || "") &&
                           (sale.paymentMethodType || sale.paymentMethod)}
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Detalhes */}
                  <TableCell>
                    {sale.status === "failed" && sale.failureMessage && (
                      <div className="text-xs text-red-600">
                        <div className="font-medium">{sale.failureReason}</div>
                        <div className="truncate max-w-[150px]" title={sale.failureMessage}>
                          {sale.failureMessage}
                        </div>
                      </div>
                    )}
                    {sale.status === "succeeded" && (
                      <div className="text-xs text-green-600 font-medium">Pagamento confirmado</div>
                    )}
                    {sale.status === "pending" && (
                      <div className="text-xs text-yellow-600 font-medium">Aguardando confirmação</div>
                    )}
                    {sale.status === "refunded" && (
                      <div className="text-xs text-blue-600 font-medium">Valor devolvido</div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Paginação */}
      {!isLoading && sales && sales.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages} ({total} {total === 1 ? "venda" : "vendas"})
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPage(page - 1)} disabled={page === 1}>
              Anterior
            </Button>
            <Button variant="outline" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
