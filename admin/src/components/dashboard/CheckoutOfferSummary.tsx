import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link2, Image as ImageIcon, ExternalLink, Globe, DollarSign, Phone, MapPin, CreditCard } from "lucide-react";
import type { OfferFormData } from "../forms/OfferForm";

const formatCurrency = (amount: number, currency: string = "BRL") => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency,
  }).format(amount);
};

// Mapeamento de códigos de idioma para nomes amigáveis
const languageNames: Record<string, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
};

interface CheckoutOfferSummaryProps {
  offer: OfferFormData;
  slug?: string;
}

export function CheckoutOfferSummary({ offer, slug }: CheckoutOfferSummaryProps) {
  // 1. Prepara a lista unificada de produtos (Principal + Bumps + Upsell)
  const allProducts = [
    { ...(offer.mainProduct as any), type: "Principal" },
    ...(offer.orderBumps || []).map((bump) => ({ ...(bump as any), type: "Order Bump" })),
  ];

  // 2. Adiciona o Upsell à lista se estiver habilitado
  if (offer.upsell?.enabled) {
    allProducts.push({
      name: offer.upsell.name || "Upsell",
      // Mapeamos 'price' (do schema do Upsell) para 'priceInCents' (usado na tabela)
      priceInCents: offer.upsell.price || 0,
      description: "Oferta de Upsell (1-Click)", // Descrição padrão pois Upsell não tem esse campo no form
      imageUrl: null, // Upsell não tem imagem no schema atual
      type: "Upsell",
    } as any);
  }

  // URL do checkout
  const checkoutUrl = slug ? `${import.meta.env.VITE_CHECKOUT_URL || 'https://pay.snappcheckout.com'}/${slug}` : null;

  return (
    <Card className="w-full">
      <CardHeader className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate">{offer.name}</CardTitle>
            {slug && (
              <CardDescription className="flex items-center gap-2 pt-1">
                <Link2 className="h-4 w-4 shrink-0" />
                <span className="font-mono truncate">/{slug}</span>
              </CardDescription>
            )}
          </div>
          {/* Botão para abrir oferta */}
          {checkoutUrl && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => window.open(checkoutUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Abrir Checkout</span>
              <span className="sm:hidden">Abrir</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 1. Informações Gerais */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Configurações Gerais</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Moeda */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Moeda</p>
                <p className="font-medium">{offer.currency}</p>
              </div>
            </div>
            
            {/* Idioma */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Idioma</p>
                <p className="font-medium">{languageNames[offer.language || 'pt'] || offer.language}</p>
              </div>
            </div>

            {/* Coleta Telefone */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="font-medium">{offer.collectPhone ? 'Sim' : 'Não'}</p>
              </div>
            </div>

            {/* Coleta Endereço */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Endereço</p>
                <p className="font-medium">{offer.collectAddress ? 'Sim' : 'Não'}</p>
              </div>
            </div>

            {/* PayPal */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">PayPal</p>
                <p className="font-medium">{offer.paypalEnabled ? 'Ativo' : 'Inativo'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Tabela de Produtos (Principal + Bumps + Upsell) */}
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
                      <Badge
                        variant={product.type === "Principal" ? "default" : "secondary"}
                        className={product.type === "Upsell" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200" : ""}
                      >
                        {product.type}
                      </Badge>
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
                          <div className="text-xs text-muted-foreground truncate max-w-[350px]">{product.description || "Sem descrição"}</div>
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
