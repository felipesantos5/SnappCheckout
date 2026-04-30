import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface PayPalBillingRulesDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function PayPalBillingRulesDialog({ open, onClose }: PayPalBillingRulesDialogProps) {
  const [accepted, setAccepted] = useState(false);

  const handleClose = () => {
    setAccepted(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Regras de uso do PayPal</DialogTitle>
          <DialogDescription>
            Leia atentamente antes de continuar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p>
              <span className="font-medium text-foreground">Periodo gratuito:</span> Voce tem{" "}
              <strong>30 dias gratuitos</strong> para testar o PayPal na plataforma.
            </p>
            <p>
              <span className="font-medium text-foreground">Taxa apos o trial:</span> Ao fim dos 30 dias, e cobrada
              uma taxa de <strong>3% sobre o faturamento PayPal</strong> do ciclo.
            </p>
            <p>
              <span className="font-medium text-foreground">Forma de cobranca:</span> A taxa e cobrada via{" "}
              <strong>Stripe Checkout</strong>, de forma segura.
            </p>
            <p>
              <span className="font-medium text-foreground">Bloqueio por inadimplencia:</span> Se a taxa nao for
              paga, o PayPal sera <strong>bloqueado em todos os seus checkouts</strong> ate a regularizacao.
            </p>
            <p>
              <span className="font-medium text-foreground">Renovacao automatica:</span> Apos o pagamento, um novo
              ciclo de <strong>30 dias</strong> e iniciado automaticamente. Se o faturamento for R$ 0, o ciclo renova
              sem cobranca.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="accept-terms"
            checked={accepted}
            onCheckedChange={(v) => setAccepted(!!v)}
          />
          <Label htmlFor="accept-terms" className="text-sm cursor-pointer">
            Li e aceito os termos de uso do PayPal
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button disabled={!accepted} onClick={handleClose}>
            Entendi e Aceito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
