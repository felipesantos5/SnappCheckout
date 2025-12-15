import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Check, Copy, Globe, HelpCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const DnsInstructionsDialog = ({ domain }: { domain?: string }) => {
  const [copiedCname, setCopiedCname] = useState(false);

  const cnameTarget = "proxy.snappcheckout.com";

  const copyCnameToClipboard = () => {
    navigator.clipboard.writeText(cnameTarget);
    setCopiedCname(true);
    setTimeout(() => setCopiedCname(false), 2000);
    toast.success("Copiado!");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg" className="gap-2 h-[36px]">
          <HelpCircle className="w-4 h-4" />
          Como Configurar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Configurar Domínio Customizado
          </DialogTitle>
          <DialogDescription>
            Siga os passos abaixo para apontar seu domínio para o checkout.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Passo 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</div>
              <h4 className="font-semibold">Acesse o painel DNS do seu domínio</h4>
            </div>
            <p className="text-sm text-muted-foreground ml-8">
              Acesse o painel de controle do seu provedor de domínio (Cloudflare, GoDaddy, Registro.br, etc.)
            </p>
          </div>

          {/* Passo 2 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</div>
              <h4 className="font-semibold">Crie um registro CNAME</h4>
            </div>
            <div className="ml-8 space-y-3">
              <div className="bg-muted/50 p-4 rounded-lg border space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Tipo</p>
                    <p className="font-mono text-sm bg-background px-2 py-1 rounded border">CNAME</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Nome/Host</p>
                    <p className="font-mono text-sm bg-background px-2 py-1 rounded border">
                      {domain ? domain.split('.')[0] : 'checkout'}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Valor/Destino</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm bg-background px-2 py-1 rounded border flex-1">{cnameTarget}</p>
                    <Button type="button" size="sm" variant="outline" onClick={copyCnameToClipboard} className="h-8">
                      {copiedCname ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Passo 3 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</div>
              <h4 className="font-semibold">Aguarde a propagação</h4>
            </div>
            <p className="text-sm text-muted-foreground ml-8">
              A propagação DNS pode levar de alguns minutos até 24 horas. Após isso, seu checkout estará disponível
              {domain && <span className="font-medium"> em <code className="bg-muted px-1 rounded">https://{domain}</code></span>}.
            </p>
          </div>

          {/* Aviso Cloudflare */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>⚠️ Cloudflare:</strong> Se você usa Cloudflare, deixe o proxy <strong>desativado</strong> (nuvem cinza)
              para que o certificado SSL seja emitido corretamente.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};