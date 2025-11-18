// src/pages/dashboard/StripeReturnPage.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function StripeReturnPage() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  // 1. A lógica inteira agora está dentro de um useEffect
  //    que roda APENAS UMA VEZ.
  useEffect(() => {
    // 2. Define uma função async interna
    const handleStripeReturn = async () => {
      toast.success("Conta Stripe conectada!", {
        description: "Estamos atualizando seus dados...",
      });

      try {
        // 3. ESPERA (await) o refresh do usuário terminar
        await refreshUser();

        // 4. Se terminou com sucesso, avisa e redireciona
        toast.success("Dados atualizados!", {
          description: "Redirecionando para o dashboard.",
        });

        // 5. Redireciona para o root (/)
        navigate("/");
      } catch (error) {
        toast.error("Erro ao atualizar seus dados.", {
          description: "Por favor, recarregue a página ou tente novamente.",
        });
        // (Não redireciona, deixa o usuário ver o erro)
      }
    };

    // 6. Chama a função
    handleStripeReturn();

    // 7. Array de dependência VAZIO: Isso garante que o efeito
    //    rode apenas UMA VEZ quando a página carregar.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Este JSX é mostrado ENQUANTO o useEffect acima está rodando
  return (
    <div className="flex items-center justify-center pt-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Conexão Bem-Sucedida!</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Finalizando conexão... Não feche esta página.</p>
        </CardContent>
      </Card>
    </div>
  );
}
