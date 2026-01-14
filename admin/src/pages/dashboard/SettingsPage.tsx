// src/pages/dashboard/SettingsPage.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import axios from "axios";
import { API_URL } from "@/config/BackendUrl";
import { Loader2, Save, Key, Eye, EyeOff, Wallet } from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalClientSecret, setPaypalClientSecret] = useState("");
  const [pagarmeApiKey, setPagarmeApiKey] = useState("");
  const [pagarmeEncryptionKey, setPagarmeEncryptionKey] = useState("");
  const [automaticNotifications, setAutomaticNotifications] = useState(false);
  const [showPagarmeApiKey, setShowPagarmeApiKey] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setFetching(true);
      const response = await axios.get(`${API_URL}/settings`);
      setPaypalClientId(response.data.paypalClientId || "");
      setPaypalClientSecret(response.data.paypalClientSecret || "");
      setPagarmeApiKey(response.data.pagarme_api_key || "");
      setPagarmeEncryptionKey(response.data.pagarme_encryption_key || "");
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
        pagarme_api_key: pagarmeApiKey,
        pagarme_encryption_key: pagarmeEncryptionKey,
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

        {/* Card de Credenciais Pagar.me */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <CardTitle>Credenciais Pagar.me (PIX)</CardTitle>
            </div>
            <CardDescription>Configure suas credenciais da Pagar.me para aceitar pagamentos via PIX</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="pagarmeApiKey">Pagar.me API Key</Label>
              <div className="relative">
                <Input
                  id="pagarmeApiKey"
                  type={showPagarmeApiKey ? "text" : "password"}
                  placeholder="sk_test_..."
                  value={pagarmeApiKey}
                  onChange={(e) => setPagarmeApiKey(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPagarmeApiKey(!showPagarmeApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPagarmeApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Encontre sua API Key no{" "}
                <a
                  href="https://dashboard.pagar.me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Dashboard Pagar.me
                </a>{" "}
                → Configurações → Chaves de API
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pagarmeEncryptionKey">Pagar.me Encryption Key</Label>
              <Input
                id="pagarmeEncryptionKey"
                type="text"
                placeholder="ek_test_..."
                value={pagarmeEncryptionKey}
                onChange={(e) => setPagarmeEncryptionKey(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                A Encryption Key é necessária para processar pagamentos de forma segura
              </p>
            </div>

            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Importante</p>
                  <p>
                    As credenciais são validadas automaticamente ao salvar. Certifique-se de usar as chaves corretas
                    (teste ou produção) de acordo com seu ambiente.
                  </p>
                </div>
              </div>
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
