import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API_URL } from "@/config/BackendUrl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw, Mail, ShoppingCart, CheckCircle, XCircle, Eye, ChevronLeft, ChevronRight, X, Send, AlertCircle } from "lucide-react";
import { formatDate } from "@/helper/formatDate";

interface EmailLog {
  _id: string;
  type: "purchase_confirmation" | "cart_abandonment";
  to: string;
  customerName: string;
  subject: string;
  status: "sent" | "failed";
  errorMessage?: string;
  sentAt: string;
  offerId?: { _id: string; name: string; slug: string } | null;
}

interface EmailLogWithHtml extends EmailLog {
  htmlContent: string;
}

interface Offer {
  _id: string;
  name: string;
}

const typeConfig = {
  purchase_confirmation: {
    label: "Confirmação de Compra",
    color: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    icon: <Mail className="w-3 h-3" />,
  },
  cart_abandonment: {
    label: "Recuperação de Carrinho",
    color: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    icon: <ShoppingCart className="w-3 h-3" />,
  },
};

const statusConfig = {
  sent: {
    label: "Enviado",
    color: "bg-green-500/10 text-green-700 border-green-500/20",
    icon: <CheckCircle className="w-3 h-3" />,
  },
  failed: {
    label: "Falhou",
    color: "bg-red-500/10 text-red-700 border-red-500/20",
    icon: <XCircle className="w-3 h-3" />,
  },
};

export function EmailsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Filtros
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedOffer, setSelectedOffer] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Preview modal
  const [previewLog, setPreviewLog] = useState<EmailLogWithHtml | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Métricas
  const [metrics, setMetrics] = useState({ total: 0, sent: 0, failed: 0, abandonment: 0, confirmation: 0 });

  useEffect(() => {
    axios
      .get(`${API_URL}/offers`)
      .then((r) => {
        setOffers(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => {});
  }, []);

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    p.set("page", page.toString());
    p.set("limit", limit.toString());
    if (selectedType !== "all") p.set("type", selectedType);
    if (selectedStatus !== "all") p.set("status", selectedStatus);
    if (selectedOffer !== "all") p.set("offerId", selectedOffer);
    if (startDate) p.set("startDate", new Date(startDate).toISOString());
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      p.set("endDate", end.toISOString());
    }
    if (search) p.set("search", search);
    return p;
  }, [page, selectedType, selectedStatus, selectedOffer, startDate, endDate, search]);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/email-logs?${buildParams()}`);
      const data = res.data?.data || [];
      const meta = res.data?.meta || { total: 0 };
      setLogs(data);
      setTotal(meta.total || 0);

      // Métricas rápidas a partir dos dados carregados (sem paginação, só da página atual para overview)
      const allRes = await axios.get(
        `${API_URL}/email-logs?limit=10000&page=1${selectedType !== "all" ? `&type=${selectedType}` : ""}${selectedStatus !== "all" ? `&status=${selectedStatus}` : ""}${selectedOffer !== "all" ? `&offerId=${selectedOffer}` : ""}`,
      );
      const allData: EmailLog[] = allRes.data?.data || [];
      setMetrics({
        total: allData.length,
        sent: allData.filter((l) => l.status === "sent").length,
        failed: allData.filter((l) => l.status === "failed").length,
        abandonment: allData.filter((l) => l.type === "cart_abandonment").length,
        confirmation: allData.filter((l) => l.type === "purchase_confirmation").length,
      });
    } catch (err) {
      toast.error("Erro ao buscar logs de email");
    } finally {
      setIsLoading(false);
    }
  }, [buildParams, selectedType, selectedStatus, selectedOffer]);

  useEffect(() => {
    fetchLogs();
  }, [page]);

  useEffect(() => {
    setPage(1);
    fetchLogs();
  }, [selectedType, selectedStatus, selectedOffer, startDate, endDate, search]);

  const openPreview = async (log: EmailLog) => {
    setIsLoadingPreview(true);
    try {
      const res = await axios.get(`${API_URL}/email-logs/${log._id}/html`);
      setPreviewLog(res.data);
    } catch {
      toast.error("Erro ao carregar preview do email");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedType("all");
    setSelectedStatus("all");
    setSelectedOffer("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Emails Enviados</h1>
          <p className="text-sm text-muted-foreground mt-1">Histórico de todos os emails enviados pela plataforma</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Card className="border-[#fdbf08]/20">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold">{metrics.total}</div>
          </CardContent>
        </Card>
        <Card className="border-green-500/20">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Enviados</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-green-700">{metrics.sent}</div>
          </CardContent>
        </Card>
        <Card className="border-red-500/20">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Falharam</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-red-600">{metrics.failed}</div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Confirmação</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-blue-700">{metrics.confirmation}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Recuperação</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-amber-700">{metrics.abandonment}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 items-start">
        {/* Filtros laterais */}
        <aside className="w-56 shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Filtros</span>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Buscar</Label>
            <Input placeholder="Email ou nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-sm" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</Label>
            <div className="space-y-1">
              {[
                { value: "all", label: "Todos" },
                { value: "purchase_confirmation", label: "Confirmação de Compra" },
                { value: "cart_abandonment", label: "Recuperação de Carrinho" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedType(opt.value)}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                    selectedType === opt.value ? "bg-[#fdbf08] text-black font-medium" : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
            <div className="space-y-1">
              {[
                { value: "all", label: "Todos" },
                { value: "sent", label: "Enviados" },
                { value: "failed", label: "Falharam" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedStatus(opt.value)}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                    selectedStatus === opt.value ? "bg-[#fdbf08] text-black font-medium" : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {offers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Oferta</Label>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                <button
                  onClick={() => setSelectedOffer("all")}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                    selectedOffer === "all" ? "bg-[#fdbf08] text-black font-medium" : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  Todas
                </button>
                {offers.map((o) => (
                  <button
                    key={o._id}
                    onClick={() => setSelectedOffer(o._id)}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors truncate ${
                      selectedOffer === o._id ? "bg-[#fdbf08] text-black font-medium" : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Período</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-sm" />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-sm" />
          </div>
        </aside>

        {/* Tabela */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Carregando..." : `${total} ${total === 1 ? "email" : "emails"} encontrados`}
            </p>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[140px]">Data</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead className="w-[180px]">Tipo</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[60px] text-center">Ver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-48 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-48 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Send className="h-8 w-8 opacity-30" />
                          <p className="text-sm">Nenhum email encontrado com os filtros aplicados.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => {
                      const tc = typeConfig[log.type];
                      const sc = statusConfig[log.status];
                      return (
                        <TableRow key={log._id} className="hover:bg-muted/50">
                          <TableCell className="text-sm text-muted-foreground">{formatDate(log.sentAt)}</TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{log.customerName || "—"}</div>
                            <div className="text-xs text-muted-foreground">{log.to}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm truncate max-w-[220px]">{log.subject}</div>
                            {log.offerId && <div className="text-xs text-muted-foreground truncate max-w-[220px]">{log.offerId.name}</div>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`gap-1 ${tc.color}`}>
                              {tc.icon}
                              {tc.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {log.status === "failed" && log.errorMessage ? (
                              <div title={log.errorMessage}>
                                <Badge variant="outline" className={`gap-1 ${sc.color} cursor-help`}>
                                  {sc.icon}
                                  {sc.label}
                                </Badge>
                              </div>
                            ) : (
                              <Badge variant="outline" className={`gap-1 ${sc.color}`}>
                                {sc.icon}
                                {sc.label}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPreview(log)} disabled={isLoadingPreview}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Paginação */}
          {!isLoading && logs.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de preview */}
      {previewLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-background rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col h-full">
            {/* Header do modal */}
            <div className="flex items-start justify-between p-4 border-b shrink-0">
              <div className="space-y-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`gap-1 ${typeConfig[previewLog.type].color}`}>
                    {typeConfig[previewLog.type].icon}
                    {typeConfig[previewLog.type].label}
                  </Badge>
                  <Badge variant="outline" className={`gap-1 ${statusConfig[previewLog.status].color}`}>
                    {statusConfig[previewLog.status].icon}
                    {statusConfig[previewLog.status].label}
                  </Badge>
                </div>
                <p className="font-semibold text-sm truncate">{previewLog.subject}</p>
                <div className="flex flex-col sm:flex-row sm:gap-4 text-xs text-muted-foreground">
                  <span>
                    <span className="font-medium">Para:</span>{" "}
                    {previewLog.customerName ? `${previewLog.customerName} <${previewLog.to}>` : previewLog.to}
                  </span>
                  <span>
                    <span className="font-medium">Em:</span> {formatDate(previewLog.sentAt)}
                  </span>
                </div>
                {previewLog.status === "failed" && previewLog.errorMessage && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{previewLog.errorMessage}</span>
                  </div>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setPreviewLog(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* iframe com o HTML do email */}
            <div className="flex-1 overflow-hidden rounded-b-xl">
              <iframe title="preview-email" srcDoc={previewLog.htmlContent} className="w-full h-full border-0" sandbox="allow-same-origin" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
