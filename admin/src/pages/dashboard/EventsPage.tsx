import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API_URL } from "@/config/BackendUrl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, XCircle, Eye, ChevronLeft, ChevronRight, Webhook, X, ExternalLink, Copy } from "lucide-react";
import { formatDate } from "@/helper/formatDate";

interface IntegrationEvent {
  _id: string;
  type: "membership_webhook" | "generic_webhook" | "utmfy" | "facebook_capi";
  event: string;
  status: "success" | "failed";
  destinationUrl?: string;
  responseStatus?: number;
  errorMessage?: string;
  customerEmail?: string;
  customerName?: string;
  sentAt: string;
  offerId?: { _id: string; name: string; slug: string } | null;
}

interface IntegrationEventDetail extends IntegrationEvent {
  payload?: string;
  saleId?: string;
}

const typeConfig: Record<string, { label: string; color: string }> = {
  membership_webhook: {
    label: "Webhook Membros",
    color: "bg-purple-500/10 text-purple-700 border-purple-500/20",
  },
  generic_webhook: {
    label: "Webhook Generico",
    color: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  },
  utmfy: {
    label: "UTMfy",
    color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
  facebook_capi: {
    label: "Facebook CAPI",
    color: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
  },
};

const statusConfig = {
  success: {
    label: "Sucesso",
    color: "bg-green-500/10 text-green-700 border-green-500/20",
    icon: <CheckCircle className="w-3 h-3" />,
  },
  failed: {
    label: "Falhou",
    color: "bg-red-500/10 text-red-700 border-red-500/20",
    icon: <XCircle className="w-3 h-3" />,
  },
};

const PERIOD_OPTIONS = [
  { value: "1", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7", label: "Ultimos 7 dias" },
  { value: "30", label: "Ultimos 30 dias" },
  { value: "90", label: "Ultimos 3 meses" },
  { value: "all", label: "Tudo" },
];

function getPeriodDates(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  if (period === "all") {
    return { startDate: "", endDate: "" };
  }
  if (period === "yesterday") {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }
  if (period === "1") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { startDate: start.toISOString(), endDate: endOfToday.toISOString() };
  }
  const days = parseInt(period);
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return { startDate: start.toISOString(), endDate: endOfToday.toISOString() };
}

export function EventsPage() {
  const [logs, setLogs] = useState<IntegrationEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("30");

  const [detailLog, setDetailLog] = useState<IntegrationEventDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [metrics, setMetrics] = useState({
    total: 0,
    success: 0,
    failed: 0,
    membership: 0,
    generic: 0,
  });

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    p.set("page", page.toString());
    p.set("limit", limit.toString());
    const { startDate, endDate } = getPeriodDates(period);
    if (startDate) p.set("startDate", startDate);
    if (endDate) p.set("endDate", endDate);
    if (search) p.set("search", search);
    return p;
  }, [page, period, search]);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/integration-events?${buildParams()}`);
      const data = res.data?.data || [];
      const meta = res.data?.meta || { total: 0 };
      setLogs(data);
      setTotal(meta.total || 0);

      const { startDate, endDate } = getPeriodDates(period);
      const allParams = new URLSearchParams({ limit: "10000", page: "1" });
      if (startDate) allParams.set("startDate", startDate);
      if (endDate) allParams.set("endDate", endDate);
      const allRes = await axios.get(`${API_URL}/integration-events?${allParams}`);
      const allData: IntegrationEvent[] = allRes.data?.data || [];
      setMetrics({
        total: allData.length,
        success: allData.filter((l) => l.status === "success").length,
        failed: allData.filter((l) => l.status === "failed").length,
        membership: allData.filter((l) => l.type === "membership_webhook").length,
        generic: allData.filter((l) => l.type === "generic_webhook").length,
      });
    } catch {
      toast.error("Erro ao buscar logs de eventos");
    } finally {
      setIsLoading(false);
    }
  }, [buildParams, period]);

  useEffect(() => {
    fetchLogs();
  }, [page]);

  useEffect(() => {
    setPage(1);
    fetchLogs();
  }, [period, search]);

  const openDetail = async (log: IntegrationEvent) => {
    setIsLoadingDetail(true);
    try {
      const res = await axios.get(`${API_URL}/integration-events/${log._id}`);
      setDetailLog(res.data);
    } catch {
      toast.error("Erro ao carregar detalhes do evento");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Eventos de Integracao</h1>
          <p className="text-sm text-muted-foreground mt-1">Historico de todos os disparos de webhooks e integracoes</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Email, nome ou evento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-[200px] text-sm"
          />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[155px] h-9">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metricas */}
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
            <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Sucesso</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-green-700">{metrics.success}</div>
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
        <Card className="border-purple-500/20">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Webhook Membros</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-purple-700">{metrics.membership}</div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Webhook Generico</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-blue-700">{metrics.generic}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Carregando..." : `${total} ${total === 1 ? "evento" : "eventos"} encontrados`}
        </p>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[140px]">Data</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Oferta</TableHead>
                  <TableHead className="w-[160px]">Tipo</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[60px] text-center">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Webhook className="h-8 w-8 opacity-30" />
                        <p className="text-sm">Nenhum evento encontrado com os filtros aplicados.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const tc = typeConfig[log.type] || { label: log.type, color: "bg-gray-500/10 text-gray-700 border-gray-500/20" };
                    const sc = statusConfig[log.status];
                    return (
                      <TableRow key={log._id} className="hover:bg-muted/50">
                        <TableCell className="text-sm text-muted-foreground">{formatDate(log.sentAt)}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{log.event}</div>
                          {log.destinationUrl && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={log.destinationUrl}>
                              {log.destinationUrl}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{log.customerName || "—"}</div>
                          <div className="text-xs text-muted-foreground">{log.customerEmail || "—"}</div>
                        </TableCell>
                        <TableCell>
                          {log.offerId ? (
                            <div className="text-sm truncate max-w-[160px]">{log.offerId.name}</div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`gap-1 ${tc.color}`}>
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
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(log)} disabled={isLoadingDetail}>
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

        {/* Paginacao */}
        {!isLoading && logs.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Pagina {page} de {totalPages}
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

      {/* Modal de detalhes */}
      {detailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-background rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Header do modal */}
            <div className="flex items-start justify-between p-4 border-b shrink-0">
              <div className="space-y-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`gap-1 ${(typeConfig[detailLog.type] || { color: "" }).color}`}>
                    {(typeConfig[detailLog.type] || { label: detailLog.type }).label}
                  </Badge>
                  <Badge variant="outline" className={`gap-1 ${statusConfig[detailLog.status].color}`}>
                    {statusConfig[detailLog.status].icon}
                    {statusConfig[detailLog.status].label}
                  </Badge>
                  {detailLog.responseStatus && (
                    <Badge variant="outline" className="gap-1">
                      HTTP {detailLog.responseStatus}
                    </Badge>
                  )}
                </div>
                <p className="font-semibold text-sm">{detailLog.event}</p>
                <div className="flex flex-col sm:flex-row sm:gap-4 text-xs text-muted-foreground">
                  {detailLog.customerEmail && (
                    <span>
                      <span className="font-medium">Para:</span>{" "}
                      {detailLog.customerName ? `${detailLog.customerName} <${detailLog.customerEmail}>` : detailLog.customerEmail}
                    </span>
                  )}
                  <span>
                    <span className="font-medium">Em:</span> {formatDate(detailLog.sentAt)}
                  </span>
                </div>
                {detailLog.offerId && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Oferta:</span> {detailLog.offerId.name}
                  </div>
                )}
                {detailLog.destinationUrl && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{detailLog.destinationUrl}</span>
                  </div>
                )}
                {detailLog.status === "failed" && detailLog.errorMessage && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
                    <XCircle className="h-3 w-3 shrink-0" />
                    <span>{detailLog.errorMessage}</span>
                  </div>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setDetailLog(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Payload */}
            {detailLog.payload && (
              <div className="flex-1 overflow-auto p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payload Enviado</p>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => copyToClipboard(detailLog.payload!)}>
                    <Copy className="h-3 w-3" />
                    Copiar
                  </Button>
                </div>
                <pre className="bg-muted rounded-lg p-4 text-xs overflow-auto max-h-[400px] whitespace-pre-wrap break-all">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(detailLog.payload), null, 2);
                    } catch {
                      return detailLog.payload;
                    }
                  })()}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
