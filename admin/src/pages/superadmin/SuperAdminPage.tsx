import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { API_URL } from "@/config/BackendUrl";
import { DollarSign, Users, Eye, TrendingUp, LogOut, RefreshCw, ChevronUp, ChevronDown } from "lucide-react";

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
  offersCount: number;
  totalRevenue: number;
  weeklyRevenue: number;
}

type SortKey = "name" | "offersCount" | "totalRevenue" | "weeklyRevenue";

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

// ---------- Dashboard Screen ----------

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("totalRevenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes] = await Promise.all([
        axios.get(`${API_URL}/superadmin/stats`, { headers }),
        axios.get(`${API_URL}/superadmin/users`, { headers }),
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
  }, [token]);

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
          <div className="flex items-center gap-2">
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
              sub="todas as contas"
              icon={DollarSign}
              accent
            />
            <StatCard
              title="Nossa Comissão (5%)"
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
                    Faturado Total <SortIcon col="totalRevenue" />
                  </th>
                  <th
                    className="text-right px-5 py-3 font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                    onClick={() => handleSort("weeklyRevenue")}
                  >
                    Faturado (7d) <SortIcon col="weeklyRevenue" />
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
                        <td className="px-5 py-3.5 text-right tabular-nums">{user.offersCount}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums font-medium">{formatBRL(user.totalRevenue)}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums">
                          <span
                            className={
                              user.weeklyRevenue > 0
                                ? "text-green-600 dark:text-green-400 font-medium"
                                : "text-muted-foreground"
                            }
                          >
                            {formatBRL(user.weeklyRevenue)}
                          </span>
                        </td>
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
