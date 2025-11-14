// src/components/dashboard/CheckoutOfferSummary.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link2, Image as ImageIcon } from "lucide-react";
import type { OfferFormData } from "../forms/OfferForm";

const formatCurrency = (amount: number, currency: string = "BRL") => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency,
  }).format(amount);
};

interface CheckoutOfferSummaryProps {
  offer: OfferFormData;
  slug?: string;
}

export function CheckoutOfferSummary({ offer, slug }: CheckoutOfferSummaryProps) {
  const allProducts = [
    { ...(offer.mainProduct as any), type: "Principal" },
    ...(offer.orderBumps || []).map((bump) => ({ ...(bump as any), type: "Order Bump" })),
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{offer.name}</CardTitle>
        {slug && (
          <CardDescription className="flex items-center gap-2 pt-1">
            <Link2 className="h-4 w-4" />
            <span className="font-mono">/{slug}</span>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 1. Informações Gerais */}
        <div>
          <h3 className="text-lg font-semibold mb-2">Configurações Gerais</h3>
          <div className="flex items-center gap-6">
            <div className="flex-1 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Moeda</span>
                <Badge variant="outline">{offer.currency}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Banner</span>
                {offer.bannerImageUrl ? <Badge variant="secondary">Configurado</Badge> : <Badge variant="destructive">Nenhum</Badge>}
              </div>
            </div>
            {offer.bannerImageUrl ? (
              <Avatar className="h-16 w-16 rounded-md">
                <AvatarImage src={offer.bannerImageUrl} alt="Banner" />
                <AvatarFallback className="rounded-md">
                  <ImageIcon />
                </AvatarFallback>
              </Avatar>
            ) : null}
          </div>
        </div>

        {/* 2. Tabela de Produtos (Principal + Bumps) */}
        <div>
          <h3 className="text-lg font-semibold mb-2">Produtos e Preços</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allProducts.map((product, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Badge variant={product.type === "Principal" ? "default" : "secondary"}>{product.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 rounded-md">
                          <AvatarImage src={product.imageUrl} alt={product.name} />
                          <AvatarFallback className="rounded-md">
                            <ImageIcon />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{product.description || "Sem descrição"}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(product.priceInCents, offer.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
