// src/pages/dashboard/SettingsPage.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import axios from "axios";
import { API_URL } from "@/config/BackendUrl";
import { Loader2, Save, Key, Bell } from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalClientSecret, setPaypalClientSecret] = useState("");
  const [automaticNotifications, setAutomaticNotifications] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setFetching(true);
      const response = await axios.get(`${API_URL}/settings`);
      setPaypalClientId(response.data.paypalClientId || "");
      setPaypalClientSecret(response.data.paypalClientSecret || "");
      setAutomaticNotifications(response.data.automaticNotifications ?? false);
    } catch (error: any) {
      toast.error("Erro ao carregar configurações", {
        description: error.response?.data?.error || error.message,
      });
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await axios.put(`${API_URL}/settings`, {
        paypalClientId,
        paypalClientSecret,
        automaticNotifications,
      });
      toast.success("Configurações salvas com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao salvar configurações", {
        description: error.response?.data?.error || error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground mt-2">Gerencie as configurações da sua conta</p>
      </div>

      <div className="space-y-6">
        {/* Card de Notificações */}
        {/* Card de Credenciais PayPal */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <CardTitle>Credenciais PayPal</CardTitle>
            </div>
            <CardDescription>Configure suas credenciais do PayPal para aceitar pagamentos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="paypalClientId">PayPal Client ID</Label>
              <Input
                id="paypalClientId"
                type="text"
                placeholder="Ex: AeB1234..."
                value={paypalClientId}
                onChange={(e) => setPaypalClientId(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Encontre seu Client ID no{" "}
                <a
                  href="https://developer.paypal.com/dashboard/applications/live"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  PayPal Developer Dashboard
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paypalClientSecret">PayPal Client Secret</Label>
              <Input
                id="paypalClientSecret"
                type="password"
                placeholder="••••••••"
                value={paypalClientSecret}
                onChange={(e) => setPaypalClientSecret(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">Mantenha seu Client Secret seguro e nunca o compartilhe</p>
            </div>
          </CardContent>
        </Card>

        {/* Botão de Salvar */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading} className="gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
