// src/components/ConnectStripeCard.tsx
import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { API_URL } from "@/config/BackendUrl";

export function ConnectStripeCard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // 1. Função que chama seu backend
  const handleOnboard = async () => {
    setIsLoading(true);
    try {
      // 2. Chama o backend para criar o link de onboarding
      // (O token de auth é enviado automaticamente pelo AuthContext/axios)
      const response = await axios.post(`${API_URL}/stripe/onboard-link`);

      if (response.data.url) {
        // 3. Redireciona o usuário para a URL do Stripe
        window.location.href = response.data.url;
      }
    } catch (error) {
      toast.error("Falha ao conectar com Stripe.", {
        description: (error as any).response?.data?.error?.message || (error as Error).message,
      });
      setIsLoading(false);
    }
  };

  // 4. Só renderiza se o usuário estiver carregado E não tiver completado
  if (!user || user.stripeOnboardingComplete) {
    return null;
  }

  return (
    <Card className="border-primary border-2 animate-pulse">
      <CardHeader>
        <CardTitle>Ative sua conta para vender</CardTitle>
        <CardDescription>
          Para começar a criar links de checkout e receber pagamentos, você precisa conectar sua conta Stripe. O processo é rápido e seguro.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button onClick={handleOnboard} disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Conectar com Stripe
        </Button>
      </CardFooter>
    </Card>
  );
}
