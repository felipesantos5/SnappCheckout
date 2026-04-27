// src/pages/dashboard/SettingsPage.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import axios from "axios";
import { API_URL } from "@/config/BackendUrl";
import { Loader2, Save, Key, Eye, EyeOff, Wallet, Mail } from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalClientSecret, setPaypalClientSecret] = useState("");
  const [pagarmeApiKey, setPagarmeApiKey] = useState("");
  const [pagarmeEncryptionKey, setPagarmeEncryptionKey] = useState("");
  const [automaticNotifications, setAutomaticNotifications] = useState(false);
  const [showPagarmeApiKey, setShowPagarmeApiKey] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("");
  const [showSmtpPass, setShowSmtpPass] = useState(false);

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
      setSmtpHost(response.data.smtpHost || "");
      setSmtpPort(String(response.data.smtpPort || 587));
      setSmtpUser(response.data.smtpUser || "");
      setSmtpPass(response.data.smtpPass || "");
      setSmtpFromEmail(response.data.smtpFromEmail || "");
      setSmtpFromName(response.data.smtpFromName || "");
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
        smtpHost,
        smtpPort: Number(smtpPort),
        smtpUser,
        smtpPass,
        smtpFromEmail,
        smtpFromName,
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
          </CardContent>
        </Card>

        {/* Card de SMTP para envio de emails */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>Configurações de Email (SMTP)</CardTitle>
            </div>
            <CardDescription>
              Configure seu servidor SMTP para enviar emails de confirmação de compra aos seus clientes.
              Compatível com Gmail, SendGrid, Amazon SES e outros.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtpHost">Servidor SMTP (Host)</Label>
                <Input
                  id="smtpHost"
                  type="text"
                  placeholder="smtp.gmail.com"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPort">Porta</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  placeholder="587"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">587 (TLS) ou 465 (SSL)</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpUser">Usuário / Email</Label>
              <Input
                id="smtpUser"
                type="text"
                placeholder="seuemail@gmail.com"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPass">Senha / App Password</Label>
              <div className="relative">
                <Input
                  id="smtpPass"
                  type={showSmtpPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPass(!showSmtpPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Para Gmail, use uma{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  App Password
                </a>{" "}
                (autenticação em duas etapas deve estar ativa)
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtpFromEmail">Email do Remetente</Label>
                <Input
                  id="smtpFromEmail"
                  type="email"
                  placeholder="contato@seudominio.com"
                  value={smtpFromEmail}
                  onChange={(e) => setSmtpFromEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpFromName">Nome do Remetente</Label>
                <Input
                  id="smtpFromName"
                  type="text"
                  placeholder="Minha Empresa"
                  value={smtpFromName}
                  onChange={(e) => setSmtpFromName(e.target.value)}
                />
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
