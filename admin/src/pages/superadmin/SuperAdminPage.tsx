import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { API_URL } from "@/config/BackendUrl";
import { DollarSign, Users, Eye, TrendingUp, LogOut, RefreshCw, ChevronUp, ChevronDown, Percent, Check, X, CreditCard, ShieldCheck, ShieldOff, CalendarPlus, Ban, Unlock } from "lucide-react";
import { subDays, startOfDay, endOfDay, format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const TOKEN_KEY = "superadmin_token";

interface Stats {
  totalRevenue: number;
  totalPlatformFee: number;
  todayCheckoutAccesses: number;
  usersCount: number;
}

interface UserRow {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
  platformFeePercent: number;
  offersCount: number;
  totalRevenue: number;
}

interface PaypalBillingUser {
  _id: string;
  name: string;
  email: string;
  hasPaypalConfigured: boolean;
  billing: {
    status: "trial" | "active" | "blocked";
    trialStartDate: string | null;
    currentCycleStart: string | null;
    currentCycleEnd: string | null;
    lastPaymentDate: string | null;
    lastChargeAmountInCents: number;
    pendingFeeInCents: number;
  };
  paypalRevenueInCents: number;
  paidCycles: number;
}

type SortKey = "name" | "offersCount" | "totalRevenue";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-3 ${
        accent
          ? "bg-gradient-to-br from-yellow-400 to-yellow-500 border-yellow-400 text-white shadow-lg shadow-yellow-500/30"
          : "bg-card border-border"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${accent ? "text-white/90" : "text-muted-foreground"}`}>{title}</span>
        <Icon className={`w-4 h-4 ${accent ? "text-white/80" : "text-muted-foreground"}`} />
      </div>
      <div>
        <p className={`text-2xl font-bold ${accent ? "text-white" : ""}`}>{value}</p>
        {sub && <p className={`text-xs mt-0.5 ${accent ? "text-white/80" : "text-muted-foreground"}`}>{sub}</p>}
      </div>
    </div>
  );
}

// ---------- Login Screen ----------

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/superadmin/auth`, { password });
      sessionStorage.setItem(TOKEN_KEY, res.data.token);
      onLogin(res.data.token);
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : "Erro ao autenticar.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-yellow-400/10 border border-yellow-400/30 mb-4">
            <TrendingUp className="w-6 h-6 text-yellow-500" />
          </div>
          <h1 className="text-2xl font-bold">Super Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">Acesso restrito à plataforma</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Senha root</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400"
              placeholder="••••••••••••"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-lg bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Autenticando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

function periodLabel(period: string) {
  switch (period) {
    case "1": return "Hoje";
    case "yesterday": return "Ontem";
    case "7": return "Últ. 7 dias";
    case "30": return "Últ. 30 dias";
    case "custom": return "Personalizado";
    default: return "Tempo Total";
  }
}

// ---------- PayPal Billing Modal ----------

function statusBadge(status: string) {
  switch (status) {
    case "blocked":
      return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20"><Ban className="w-3 h-3" />Bloqueado</span>;
    case "trial":
      return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20"><ShieldCheck className="w-3 h-3" />Trial</span>;
    case "active":
      return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20"><Check className="w-3 h-3" />Ativo</span>;
    default:
      return <span className="text-xs text-muted-foreground">{status}</span>;
  }
}

function PaypalBillingModal({
  open,
  onClose,
  token,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
}) {
  const [users, setUsers] = useState<PaypalBillingUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "blocked" | "trial" | "active">("all");

  const headers = { Authorization: `Bearer ${token}` };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/superadmin/paypal-billing`, { headers });
      setUsers(res.data);
    } catch (err) {
      console.error("Erro ao buscar PayPal billing:", err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (open) fetchUsers();
  }, [open, fetchUsers]);

  const handleAction = async (userId: string, action: string, extraDays?: number) => {
    setActionLoading(`${userId}-${action}`);
    try {
      await axios.patch(
        `${API_URL}/superadmin/users/${userId}/paypal-billing`,
        { action, extraDays },
        { headers }
      );
      await fetchUsers();
    } catch (err) {
      console.error("Erro ao executar acao:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = users.filter((u) => filter === "all" || u.billing.status === filter);

  const counts = {
    all: users.length,
    blocked: users.filter((u) => u.billing.status === "blocked").length,
    trial: users.filter((u) => u.billing.status === "trial").length,
    active: users.filter((u) => u.billing.status === "active").length,
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-yellow-500" />
            Gerenciamento PayPal Billing
          </DialogTitle>
          <DialogDescription>
            Gerencie taxas, isenções e acesso ao PayPal dos clientes.
          </DialogDescription>
        </DialogHeader>

        {/* Filter Tabs */}
        <div className="flex gap-1 border-b border-border pb-2">
          {(["all", "blocked", "trial", "active"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                filter === f
                  ? "bg-yellow-400/20 text-yellow-600 border border-yellow-400/40"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {f === "all" ? "Todos" : f === "blocked" ? "Bloqueados" : f === "trial" ? "Trial" : "Ativos"}
              <span className="ml-1 opacity-60">({counts[f]})</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="space-y-3 py-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum usuario com PayPal configurado encontrado.
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {filtered.map((user) => {
                const b = user.billing;
                const isExpired = b.currentCycleEnd ? new Date(b.currentCycleEnd) < new Date() : false;
                const daysLeft = b.currentCycleEnd
                  ? Math.max(0, Math.ceil((new Date(b.currentCycleEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                  : 0;
                const isExempt = b.currentCycleEnd
                  ? new Date(b.currentCycleEnd).getFullYear() > new Date().getFullYear() + 5
                  : false;

                return (
                  <div
                    key={user._id}
                    className={`rounded-lg border p-4 space-y-3 ${
                      b.status === "blocked"
                        ? "border-red-500/30 bg-red-500/5"
                        : "border-border bg-card"
                    }`}
                  >
                    {/* User Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{user.name}</span>
                          {statusBadge(b.status)}
                          {isExempt && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20">
                              <ShieldOff className="w-3 h-3" />Isento
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {b.pendingFeeInCents > 0 && (
                          <p className="text-sm font-semibold text-red-500">
                            Taxa pendente: {formatBRL(b.pendingFeeInCents)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Receita PayPal (ciclo)</p>
                        <p className="font-medium">{formatBRL(user.paypalRevenueInCents)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Dias restantes</p>
                        <p className={`font-medium ${isExpired ? "text-red-500" : daysLeft <= 5 ? "text-yellow-500" : ""}`}>
                          {isExempt ? "Isento" : isExpired ? "Expirado" : `${daysLeft} dias`}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ciclos pagos</p>
                        <p className="font-medium">{user.paidCycles}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ultimo pagamento</p>
                        <p className="font-medium">
                          {b.lastPaymentDate
                            ? formatDistanceToNow(new Date(b.lastPaymentDate), { addSuffix: true, locale: ptBR })
                            : "Nunca"}
                        </p>
                      </div>
                    </div>

                    {/* Cycle dates */}
                    {b.currentCycleStart && b.currentCycleEnd && !isExempt && (
                      <p className="text-xs text-muted-foreground">
                        Ciclo: {format(new Date(b.currentCycleStart), "dd/MM/yyyy")} - {format(new Date(b.currentCycleEnd), "dd/MM/yyyy")}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border">
                      {b.status === "blocked" && (
                        <button
                          onClick={() => handleAction(user._id, "unblock")}
                          disabled={actionLoading === `${user._id}-unblock`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-green-500/10 text-green-600 border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                        >
                          <Unlock className="w-3 h-3" />
                          {actionLoading === `${user._id}-unblock` ? "..." : "Desbloquear (+30d)"}
                        </button>
                      )}

                      {!isExempt && (
                        <button
                          onClick={() => handleAction(user._id, "exempt")}
                          disabled={actionLoading === `${user._id}-exempt`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                        >
                          <ShieldOff className="w-3 h-3" />
                          {actionLoading === `${user._id}-exempt` ? "..." : "Isentar taxa"}
                        </button>
                      )}

                      {isExempt && (
                        <button
                          onClick={() => handleAction(user._id, "block")}
                          disabled={actionLoading === `${user._id}-block`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                          <Ban className="w-3 h-3" />
                          {actionLoading === `${user._id}-block` ? "..." : "Remover isencao"}
                        </button>
                      )}

                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          max="365"
                          placeholder="dias"
                          value={extendDays[user._id] || ""}
                          onChange={(e) => setExtendDays((prev) => ({ ...prev, [user._id]: e.target.value }))}
                          className="w-16 text-xs rounded border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        />
                        <button
                          onClick={() => {
                            const days = parseInt(extendDays[user._id] || "30", 10);
                            handleAction(user._id, "extend", days);
                          }}
                          disabled={actionLoading === `${user._id}-extend`}
                          className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                        >
                          <CalendarPlus className="w-3 h-3" />
                          {actionLoading === `${user._id}-extend` ? "..." : "Estender"}
                        </button>
                      </div>

                      {b.status !== "blocked" && !isExempt && (
                        <button
                          onClick={() => handleAction(user._id, "block")}
                          disabled={actionLoading === `${user._id}-block`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors disabled:opacity-50 ml-auto"
                        >
                          <Ban className="w-3 h-3" />
                          {actionLoading === `${user._id}-block` ? "..." : "Bloquear"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Dashboard Screen ----------

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("totalRevenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [period, setPeriod] = useState("all");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [editingFeeUserId, setEditingFeeUserId] = useState<string | null>(null);
  const [editingFeeValue, setEditingFeeValue] = useState("");
  const [paypalModalOpen, setPaypalModalOpen] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const getDateRange = (days: string) => {
    const now = new Date();
    if (days === "all") return {};
    if (days === "custom") {
      if (!customDateRange?.from || !customDateRange?.to) return {};
      return {
        startDate: startOfDay(customDateRange.from).toISOString(),
        endDate: endOfDay(customDateRange.to).toISOString(),
      };
    }
    const endDate = endOfDay(now).toISOString();
    if (days === "1") return { startDate: startOfDay(now).toISOString(), endDate };
    if (days === "yesterday") {
      const yesterday = subDays(now, 1);
      return { startDate: startOfDay(yesterday).toISOString(), endDate: endOfDay(yesterday).toISOString() };
    }
    if (days === "7") return { startDate: startOfDay(subDays(now, 6)).toISOString(), endDate };
    if (days === "30") return { startDate: startOfDay(subDays(now, 29)).toISOString(), endDate };
    return {};
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const dateParams = getDateRange(period);
      const params = new URLSearchParams(dateParams as Record<string, string>).toString();
      const query = params ? `?${params}` : "";

      const [statsRes, usersRes] = await Promise.all([
        axios.get(`${API_URL}/superadmin/stats${query}`, { headers }),
        axios.get(`${API_URL}/superadmin/users${query}`, { headers }),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        onLogout();
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, period, customDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sorted = [...users].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string" && typeof bv === "string") {
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const handleUpdateFee = async (userId: string) => {
    const value = parseFloat(editingFeeValue);
    if (isNaN(value) || value < 0 || value > 100) return;
    try {
      await axios.patch(`${API_URL}/superadmin/users/${userId}/fee`, { platformFeePercent: value }, { headers });
      setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, platformFeePercent: value } : u)));
      setEditingFeeUserId(null);
    } catch (err) {
      console.error("Erro ao atualizar taxa:", err);
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortDir === "desc" ? <ChevronDown className="w-3 h-3 inline ml-1" /> : <ChevronUp className="w-3 h-3 inline ml-1" />
    ) : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-yellow-500" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-none">Super Admin</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Visão geral da plataforma</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400"
            >
              <option value="1">Hoje</option>
              <option value="yesterday">Ontem</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="all">Tempo Total</option>
              <option value="custom">Personalizado</option>
            </select>
            {period === "custom" && (
              <div className="w-[220px]">
                <DateRangePicker value={customDateRange} onChange={setCustomDateRange} />
              </div>
            )}
            <button
              onClick={() => setPaypalModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted border border-border"
            >
              <CreditCard className="w-4 h-4" />
              PayPal
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* KPI Cards */}
        {loading && !stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card h-32 animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Faturado"
              value={formatBRL(stats.totalRevenue)}
              sub={periodLabel(period)}
              icon={DollarSign}
              accent
            />
            <StatCard
              title="Nossa Comissão"
              value={formatBRL(stats.totalPlatformFee)}
              sub="taxa da plataforma"
              icon={TrendingUp}
            />
            <StatCard
              title="Acessos Hoje"
              value={stats.todayCheckoutAccesses.toLocaleString("pt-BR")}
              sub="views nos checkouts"
              icon={Eye}
            />
            <StatCard
              title="Contas Ativas"
              value={stats.usersCount.toLocaleString("pt-BR")}
              sub="usuários cadastrados"
              icon={Users}
            />
          </div>
        ) : null}

        {/* Users Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-base">Contas</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{users.length} usuários cadastrados</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th
                    className="text-left px-5 py-3 font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                    onClick={() => handleSort("name")}
                  >
                    Nome <SortIcon col="name" />
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground whitespace-nowrap">E-mail</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    Taxa %
                  </th>
                  <th
                    className="text-right px-5 py-3 font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                    onClick={() => handleSort("offersCount")}
                  >
                    Ofertas <SortIcon col="offersCount" />
                  </th>
                  <th
                    className="text-right px-5 py-3 font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                    onClick={() => handleSort("totalRevenue")}
                  >
                    Faturado ({periodLabel(period)}) <SortIcon col="totalRevenue" />
                  </th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading && users.length === 0
                  ? [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {[...Array(6)].map((_, j) => (
                          <td key={j} className="px-5 py-4">
                            <div className="h-4 bg-muted rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : sorted.map((user) => (
                      <tr key={user._id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5 font-medium whitespace-nowrap">{user.name}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">{user.email}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums">
                          {editingFeeUserId === user._id ? (
                            <span className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={editingFeeValue}
                                onChange={(e) => setEditingFeeValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleUpdateFee(user._id);
                                  if (e.key === "Escape") setEditingFeeUserId(null);
                                }}
                                className="w-16 text-right rounded border border-input bg-background px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                autoFocus
                              />
                              <button onClick={() => handleUpdateFee(user._id)} className="text-green-500 hover:text-green-400">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditingFeeUserId(null)} className="text-muted-foreground hover:text-destructive">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => { setEditingFeeUserId(user._id); setEditingFeeValue(String(user.platformFeePercent ?? 3)); }}
                              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                              title="Clique para editar a taxa"
                            >
                              {user.platformFeePercent ?? 3}%
                              <Percent className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums">{user.offersCount}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums font-medium">{formatBRL(user.totalRevenue)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <a
                            href={`mailto:${user.email}`}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-border hover:bg-muted transition-colors"
                          >
                            Contatar
                          </a>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <PaypalBillingModal
        open={paypalModalOpen}
        onClose={() => setPaypalModalOpen(false)}
        token={token}
      />
    </div>
  );
}

// ---------- Main Page ----------

export function SuperAdminPage() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));

  const handleLogin = (t: string) => setToken(t);

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  if (!token) return <LoginScreen onLogin={handleLogin} />;
  return <Dashboard token={token} onLogout={handleLogout} />;
}
