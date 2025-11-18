// src/pages/dashboard/DashboardOverview.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { ConnectStripeCard } from "@/components/ConnectStripeCard";
import { API_URL } from "@/config/BackendUrl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { RecentSalesTable } from "@/components/dashboard/RecentSalesTable";
import { Skeleton } from "@/components/ui/skeleton";

interface StripeBalance {
  available: { amount: number; currency: string }[];
  pending: { amount: number; currency: string }[];
}

export function DashboardOverview() {
  const { user, token } = useAuth();

  const [balance, setBalance] = useState<StripeBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!token) return;

      try {
        setIsLoading(true);
        const response = await axios.get(`${API_URL}/stripe/balance`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setBalance(response.data);
      } catch (err: any) {
        console.error("Erro ao buscar saldo:", err);
        setError(err.response?.data?.error || "Falha ao buscar saldo.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalance();
  }, [token]);

  const formatBalance = (balanceArray: { amount: number; currency: string }[]) => {
    if (!balanceArray || balanceArray.length === 0) {
      return "R$ 0,00";
    }
    const amountInCents = balanceArray[0].amount;
    const currency = balanceArray[0].currency.toUpperCase();

    const amount = (amountInCents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: currency,
    });
    return amount;
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <ConnectStripeCard />

      <h1 className="text-3xl font-bold">Bem-vindo, {user?.name || "Usuário"}!</h1>

      {/* --- NOVO: Grid de Cards de Saldo --- */}
      {/* {!user?.stripeOnboardingComplete && ( */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Disponível</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-3/4" />
            ) : error ? (
              <span className="text-xs text-red-500">{error}</span>
            ) : (
              <div className="text-2xl font-bold">{formatBalance(balance?.available || [])}</div>
            )}
          </CardContent>
        </Card>

        {/* --- NOVO: Card de Saldo Pendente --- */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Pendente</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-3/4" />
            ) : error ? (
              <span className="text-xs text-red-500">{error}</span>
            ) : (
              <div className="text-2xl font-bold">{formatBalance(balance?.pending || [])}</div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* )} */}
      {/* {!user?.stripeOnboardingComplete && } */}
      <RecentSalesTable />
    </div>
  );
}
