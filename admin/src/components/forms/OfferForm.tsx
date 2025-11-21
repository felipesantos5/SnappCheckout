// src/components/forms/OfferForm.tsx
"use client";

import { useState } from "react";
import { useForm, useFieldArray, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "axios";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, ChevronDown, Settings, CreditCard, Box, Layers, ArrowUpCircle, Link as LinkIcon, Code, Copy, Check } from "lucide-react";
import { ImageUpload } from "./ImageUpload";
import { API_URL } from "@/config/BackendUrl";
import { MoneyInput } from "./MoneyInput";

// --- COMPONENTE DE INPUT DE MOEDA ---
// interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
//   value: number | undefined | string;
//   onChange: (value: number) => void;
// }

// const MoneyInput = ({ value, onChange, className, ...props }: MoneyInputProps) => {
//   const formatCurrency = (val: number | string | undefined) => {
//     if (val === undefined || val === "") return "";
//     const numberVal = Number(val);
//     if (isNaN(numberVal)) return "";

//     return new Intl.NumberFormat("pt-BR", {
//       style: "currency",
//       currency: "BRL",
//       minimumFractionDigits: 2,
//     }).format(numberVal);
//   };

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const rawValue = e.target.value.replace(/\D/g, "");
//     const numberValue = Number(rawValue) / 100;
//     onChange(numberValue);
//   };

//   return (
//     <Input
//       {...props}
//       type="text"
//       inputMode="numeric"
//       className={className}
//       value={formatCurrency(value)}
//       onChange={handleChange}
//       placeholder="R$ 0,00"
//     />
//   );
// };

// --- COMPONENTE DE SEÇÃO (ACCORDION) ---
interface FormSectionProps {
  title: string;
  icon?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

const FormSection = ({ title, icon, description, children, defaultOpen = false, badge }: FormSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="w-full overflow-hidden border shadow-sm">
      <div
        className="flex items-center justify-between p-4 cursor-pointer bg-card hover:bg-accent/5 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          {icon && <div className="text-primary">{icon}</div>}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold leading-none">{title}</h3>
              {badge && <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-primary/10 text-primary">{badge}</span>}
            </div>
            {description && <p className="text-sm text-muted-foreground hidden md:block">{description}</p>}
          </div>
        </div>
        <div className={`transition-transform duration-200 text-muted-foreground ${isOpen ? "rotate-180" : ""}`}>
          <ChevronDown className="h-5 w-5" />
        </div>
      </div>

      {isOpen && (
        <div className="animate-in slide-in-from-top-2 fade-in duration-200">
          <Separator />
          <div className="p-5 space-y-6 bg-card/50">{children}</div>
        </div>
      )}
    </Card>
  );
};

// --- SCRIPT MINIMALISTA COM UI EMBUTIDA ---
const UpsellScriptDialog = () => {
  const [copied, setCopied] = useState(false);

  const scriptCode = `
<style>
  .chk-btn { height: 40px; width: 100%; max-width: 500px; border: none; border-radius: 5px; font-size: 16px; font-weight: bold; cursor: pointer; transition: opacity 0.2s; display: block; margin: 10px auto; }
  .chk-btn:hover { opacity: 0.9; }
  .chk-buy { background-color: #22c55e; color: white; }
  .chk-refuse { background-color: #ef4444; color: white; }
</style>

<button onclick="handleUpsell(true)" class="chk-btn chk-buy">SIM, QUERO ADICIONAR!</button>
<button onclick="handleUpsell(false)" class="chk-btn chk-refuse">NÃO, QUERO RECUSAR</button>

<script>
  async function handleUpsell(isBuy) {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) return alert('Erro: Link inválido (Token ausente).');

    const btn = event.target;
    const originalText = btn.innerText;
    
    // Bloqueia ambos os botões
    document.getElementById('btn-upsell-yes').disabled = true;
    document.getElementById('btn-upsell-no').disabled = true;
    btn.innerText = "PROCESSANDO...";

    try {
      const endpoint = isBuy ? 'one-click-upsell' : 'upsell-refuse';
      
      const res = await fetch("https://backend.snappcheckout.com.br/api" + '/payments/' + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      
      const data = await res.json();

      if (data.success) {
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else {
          // Fallback se não tiver página de obrigado configurada
          alert(data.message || (isBuy ? 'Compra realizada!' : 'Oferta recusada.'));
        }
      } else {
        throw new Error(data.message || 'Erro desconhecido');
      }
      
    } catch (e) {
      alert(e.message || 'Erro de conexão. Tente novamente.');
      // Reativa os botões em caso de erro
      document.getElementById('btn-upsell-yes').disabled = false;
      document.getElementById('btn-upsell-no').disabled = false;
      btn.innerText = originalText;
    }
  }
</script>`.trim();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copiado!");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2 mt-4 border-dashed border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100">
          <Code className="w-4 h-4" />
          Pegar Script de Integração
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        {" "}
        {/* Aumentado para max-w-3xl */}
        <DialogHeader>
          <DialogTitle>Integração One-Click</DialogTitle>
          <DialogDescription>Copie e cole este código onde deseja que os botões apareçam.</DialogDescription>
        </DialogHeader>
        <div className="relative mt-2 group">
          <Button size="sm" onClick={copyToClipboard} className="absolute top-2 right-2 h-7 text-xs">
            {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          {/* CORREÇÃO AQUI: Adicionado whitespace-pre-wrap, break-all e max-h com overflow */}
          <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg text-xs font-mono border border-slate-800 max-h-[400px] overflow-auto whitespace-pre-wrap break-all">
            {scriptCode}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// --- Schema de Validação (Zod) ---
const optionalUrl = z.string().url({ message: "URL inválida." }).optional().or(z.literal(""));

const productSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(3, { message: "Nome do produto é obrigatório." }),
  headline: z.string().optional(),
  description: z.string().optional(),
  imageUrl: optionalUrl,
  priceInCents: z.coerce.number().min(0.5, { message: "Preço deve ser ao menos R$ 0,50." }),
  compareAtPriceInCents: z.coerce.number().optional(),
  customId: z.string().optional(),
});

const upsellSchema = z.object({
  enabled: z.boolean().default(false),
  name: z.string().optional(),
  price: z.coerce.number().min(0, { message: "Preço deve ser maior ou igual a 0." }).optional(),
  redirectUrl: optionalUrl,
  customId: z.string().optional(),
});

const membershipWebhookSchema = z.object({
  enabled: z.boolean().default(false),
  url: optionalUrl,
  authToken: z.string().optional(),
});

const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, { message: "Cor inválida" })
  .optional()
  .or(z.literal(""));

const offerFormSchema = z.object({
  name: z.string().min(3, { message: "Nome do link é obrigatório." }),
  bannerImageUrl: optionalUrl,
  thankYouPageUrl: optionalUrl,
  currency: z.string().default("BRL"),
  language: z.string().default("pt"),
  collectAddress: z.boolean().default(false),
  collectPhone: z.boolean().default(true),
  primaryColor: colorSchema,
  buttonColor: colorSchema,
  mainProduct: productSchema,
  utmfyWebhookUrl: optionalUrl,
  upsell: upsellSchema,
  membershipWebhook: membershipWebhookSchema,
  orderBumps: z.array(productSchema).optional(),
});

export type OfferFormInput = z.input<typeof offerFormSchema>;
export type OfferFormOutput = z.infer<typeof offerFormSchema>;
export type OfferFormData = OfferFormInput & { _id?: string };

interface OfferFormProps {
  onSuccess: () => void;
  initialData?: OfferFormData;
  offerId?: string;
}

export function OfferForm({ onSuccess, initialData, offerId }: OfferFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isEditMode = !!offerId;

  const form = useForm<OfferFormData>({
    resolver: zodResolver(offerFormSchema),
    defaultValues: initialData || {
      name: "",
      bannerImageUrl: "",
      thankYouPageUrl: "",
      currency: "BRL",
      language: "pt",
      collectAddress: false,
      utmfyWebhookUrl: "",
      upsell: {
        enabled: false,
        name: "",
        price: 0,
        redirectUrl: "",
      },
      mainProduct: {
        name: "",
        description: "",
        imageUrl: "",
        priceInCents: 0,
      },
      membershipWebhook: {
        enabled: false,
        url: "",
        authToken: "",
      },
      primaryColor: "#374151",
      buttonColor: "#2563EB",
      orderBumps: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "orderBumps",
  });

  async function onSubmit(values: OfferFormData) {
    setIsLoading(true);

    const transformPrices = (data: OfferFormOutput) => {
      const cleanSubDoc = (doc: { priceInCents: number; compareAtPriceInCents?: number; _id?: string; [key: string]: any }) => {
        const { _id, ...rest } = doc;
        const priceInCents = Math.round(doc.priceInCents * 100);
        const compareAtPriceInCents =
          typeof doc.compareAtPriceInCents === "number" && doc.compareAtPriceInCents > 0 ? Math.round(doc.compareAtPriceInCents * 100) : undefined;

        return { ...rest, priceInCents, compareAtPriceInCents };
      };

      return {
        ...data,
        mainProduct: cleanSubDoc(data.mainProduct),
        orderBumps: data.orderBumps?.map(cleanSubDoc),
      };
    };

    const dataToSubmit = transformPrices(values as OfferFormOutput);

    try {
      if (isEditMode) {
        await axios.put(`${API_URL}/offers/${offerId}`, dataToSubmit);
      } else {
        await axios.post(`${API_URL}/offers`, dataToSubmit);
      }
      onSuccess();
    } catch (error) {
      toast.error(isEditMode ? "Falha ao atualizar link." : "Falha ao criar link.", {
        description: (error as any).response?.data?.error?.message || (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  const CustomIdInput = ({ name }: { name: Path<OfferFormData> }) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }: any) => (
        <FormItem>
          <FormLabel>
            ID customizado <span className="text-xs text-muted-foreground">(Opcional)</span>
          </FormLabel>
          <FormControl>
            <Input placeholder="Ex: curso-xyz-123" {...field} value={field.value || ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const ColorInput = ({ field }: { field: any }) => (
    <div className="flex items-center gap-2">
      <FormControl>
        <Input type="color" className="w-12 h-10 p-1 cursor-pointer shrink-0 rounded-md border" {...field} />
      </FormControl>
      <FormControl>
        <Input type="text" placeholder="#2563EB" className="font-mono w-28 uppercase" {...field} />
      </FormControl>
    </div>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 w-full max-w-4xl mx-auto">
        {/* --- 1. CONFIGURAÇÕES GERAIS --- */}
        <FormSection
          title="Configurações Gerais"
          icon={<Settings className="w-5 h-5" />}
          description="Informações básicas, links e idioma da sua oferta."
          defaultOpen={true}
        >
          <div className="grid gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel>Nome da Oferta</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Lançamento Produto X" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="thankYouPageUrl"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel>URL da Página de Obrigado (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://seusite.com/obrigado" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>Para onde o cliente será redirecionado se não houver Upsell ou se recusar.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bannerImageUrl"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel>Banner do Checkout</FormLabel>
                  <FormControl>
                    <ImageUpload value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }: any) => (
                  <FormItem>
                    <FormLabel>Moeda</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a moeda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="BRL">BRL (Real Brasileiro)</SelectItem>
                        <SelectItem value="USD">USD (Dólar Americano)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="language"
                render={({ field }: any) => (
                  <FormItem>
                    <FormLabel>Idioma do Checkout</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o idioma" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pt">🇧🇷 Português</SelectItem>
                        <SelectItem value="en">🇺🇸 English</SelectItem>
                        <SelectItem value="fr">🇫🇷 Français</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </FormSection>

        {/* --- 2. APARÊNCIA E DADOS --- */}
        <FormSection
          title="Personalização do Checkout"
          icon={<CreditCard className="w-5 h-5" />}
          description="Cores e dados que serão solicitados ao cliente."
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="primaryColor"
                render={({ field }: any) => (
                  <FormItem>
                    <FormLabel>Cor Principal</FormLabel>
                    <ColorInput field={field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="buttonColor"
                render={({ field }: any) => (
                  <FormItem>
                    <FormLabel>Cor do Botão</FormLabel>
                    <ColorInput field={field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="collectAddress"
                render={({ field }: any) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-white">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Coletar Endereço</FormLabel>
                      <FormDescription>Obrigatório para produtos físicos.</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="collectPhone"
                render={({ field }: any) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-white">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Coletar Telefone</FormLabel>
                      <FormDescription>Útil para recuperação de carrinho.</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </div>
        </FormSection>

        {/* --- 3. PRODUTO PRINCIPAL --- */}
        <FormSection
          title="Produto Principal"
          icon={<Box className="w-5 h-5" />}
          description="Configure o produto principal que será vendido."
          defaultOpen={true}
        >
          <div className="grid gap-6">
            <FormField
              control={form.control}
              name="mainProduct.name"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel>Nome do Produto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Curso Completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MoneyInput form={form} name="mainProduct.priceInCents" label="Preço" placeholder="0,00" />
              <MoneyInput form={form} name="mainProduct.compareAtPriceInCents" label="Preço" placeholder="0,00" />
            </div>

            <CustomIdInput name="mainProduct.customId" />

            <FormField
              control={form.control}
              name="mainProduct.imageUrl"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel>Imagem do Produto (Capa)</FormLabel>
                  <FormControl>
                    <ImageUpload value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        {/* --- 4. ORDER BUMPS --- */}
        <FormSection
          title="Order Bumps"
          icon={<Layers className="w-5 h-5" />}
          description="Produtos complementares oferecidos no checkout."
          badge={fields.length > 0 ? `${fields.length} Ativos` : undefined}
        >
          <div className="space-y-6">
            {fields.length === 0 && (
              <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">Nenhum Order Bump configurado.</div>
            )}

            {fields.map((field: any, index: number) => (
              <div key={field.id} className="p-4 rounded-lg border bg-white relative space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <div className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    Order Bump
                  </h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`orderBumps.${index}.name`}
                    render={({ field }: any) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Ebook Bônus" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <MoneyInput form={form} name={`orderBumps.${index}.priceInCents`} label="Preço" placeholder="0,00" />
                </div>

                <FormField
                  control={form.control}
                  name={`orderBumps.${index}.headline`}
                  render={({ field }: any) => (
                    <FormItem>
                      <FormLabel>Headline (Call to Action)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Sim! Quero turbinar minha compra!" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <CustomIdInput name={`orderBumps.${index}.customId`} />
                <FormField
                  control={form.control}
                  name={`orderBumps.${index}.imageUrl`}
                  render={({ field }: any) => (
                    <FormItem>
                      <FormLabel>Imagem</FormLabel>
                      <FormControl>
                        <ImageUpload value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed"
              onClick={() => append({ name: "", headline: "", description: "", priceInCents: 9.9, imageUrl: "" })}
            >
              + Adicionar Order Bump
            </Button>
          </div>
        </FormSection>

        {/* --- 5. UPSELL (PÓS-COMPRA) --- */}
        <FormSection
          title="Upsell (One-Click)"
          icon={<ArrowUpCircle className="w-5 h-5" />}
          description="Oferta especial exibida após a compra aprovada."
          badge={form.watch("upsell.enabled") ? "Ativado" : undefined}
        >
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="upsell.enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-white">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Habilitar Upsell</FormLabel>
                    <FormDescription>O cliente será redirecionado para esta oferta APÓS pagar.</FormDescription>
                  </div>
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch("upsell.enabled") && (
              <div className="space-y-4 p-4 bg-muted/20 rounded-lg border animate-in fade-in slide-in-from-top-2">
                <FormField
                  control={form.control}
                  name="upsell.name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Oferta</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Pacote VIP" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MoneyInput form={form} name="upsell.price" label="Preço" placeholder="0,00" />
                  <FormField
                    control={form.control}
                    name="upsell.redirectUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL da Página de Upsell</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <CustomIdInput name="upsell.customId" />

                {/* --- BOTÃO DE GERAR SCRIPT (AQUI) --- */}
                <UpsellScriptDialog />
              </div>
            )}
          </div>
        </FormSection>

        {/* --- 6. INTEGRAÇÕES --- */}
        <FormSection title="Integrações" icon={<LinkIcon className="w-5 h-5" />} description="Conecte com ferramentas externas (Webhooks).">
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="utmfyWebhookUrl"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel>Webhook UTMfy</FormLabel>
                  <FormControl>
                    <Input placeholder="https://webhook.utmfy.com/..." {...field} />
                  </FormControl>
                  <FormDescription>URL para enviar eventos de venda.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="membershipWebhook.enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Integração de Área de Membros (Husky)</FormLabel>
                      <FormDescription>Entrega automática de acesso via Webhook.</FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {form.watch("membershipWebhook.enabled") && (
                <div className="pl-7 space-y-4">
                  <FormField
                    control={form.control}
                    name="membershipWebhook.url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL do Webhook</FormLabel>
                        <FormControl>
                          <Input placeholder="https://api.husky-app.com/..." {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="membershipWebhook.authToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token de Autenticação</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Bearer Token" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          </div>
        </FormSection>

        <div className="sticky bottom-4 z-10 ">
          <Button type="submit" size="lg" className="w-full shadow-lg mt-4" disabled={isLoading}>
            {isLoading ? "Salvando..." : isEditMode ? "Atualizar Configurações" : "Salvar Oferta"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
