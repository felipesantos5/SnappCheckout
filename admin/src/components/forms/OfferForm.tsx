// src/components/forms/OfferForm.tsx
"use client";

import React, { useState } from "react";
import { useForm, useFieldArray, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "axios";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Trash2,
  ChevronDown,
  Settings,
  CreditCard,
  Box,
  Layers,
  ArrowUpCircle,
  Link as LinkIcon,
  Code,
  Copy,
  Check,
  Plus,
  Eye,
  EyeOff,
  Bell,
  LayoutTemplate,
  Mail,
} from "lucide-react";
import { ImageUpload } from "./ImageUpload";
import { API_URL } from "@/config/BackendUrl";
import { MoneyInput } from "./MoneyInput";

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
      <div className="flex items-center justify-between p-4 cursor-pointer bg-card transition-colors" onClick={() => setIsOpen(!isOpen)}>
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
        <div className={`transition - transform duration - 200 text - muted - foreground ${isOpen ? "rotate-180" : ""} `}>
          <ChevronDown className="h-5 w-5" />
        </div>
      </div>

      {isOpen && (
        <div className="overflow-hidden">
          <Separator />
          <div className="p-5 space-y-6 bg-card/50">{children}</div>
        </div>
      )}
    </Card>
  );
};

// --- MODAL: APENAS O SCRIPT ---
const UpsellScriptOnlyDialog = () => {
  const [copied, setCopied] = useState(false);

  // Usa a URL do backend da variável de ambiente
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:4242";
  const scriptCode = `< script src = "${backendUrl}/api/v1/upsell.js" async ></script > `.trim();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copiado!");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2 border-dashed border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100">
          <Code className="w-4 h-4" />
          Pegar Script
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Script de Integração</DialogTitle>
          <DialogDescription>Copie e cole este script no &lt;head&gt; ou antes do &lt;/body&gt; da sua página.</DialogDescription>
        </DialogHeader>
        <div className="relative mt-2 group">
          <Button size="sm" onClick={copyToClipboard} className="absolute top-2 right-2 h-7 text-xs">
            {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg text-xs font-mono border border-slate-800 max-h-[400px] overflow-auto whitespace-pre-wrap break-all">
            {scriptCode}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// --- MODAL: APENAS OS BOTÕES ---
const UpsellButtonsOnlyDialog = () => {
  const [copied, setCopied] = useState(false);

  const buttonsCode = `
  <button class="chk-buy" style = "background:#3CB371; color:white; font-weight:700; padding:10px; width:100%; max-width:500px; border-radius: 10px; font-size:16px; border:0; margin-bottom:16px;" >
    SIM, QUERO COMPRAR
</button >

  <button class="chk-refuse" style="background:unset;color:red; padding:10px; width:100%; max-width:500px; border:0; text-decoration: underline;">
    NÃO, OBRIGADO
  </button>
`.trim();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(buttonsCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copiado!");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2 border-dashed border-yellow-500 bg-yellow-400 text-yellow-100 hover:bg-yellow-100">
          <Code className="w-4 h-4" />
          Pegar Código dos Botões
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Código dos Botões</DialogTitle>
          <DialogDescription>Copie e cole este código onde deseja que os botões de aceitar/recusar apareçam.</DialogDescription>
        </DialogHeader>
        <div className="relative mt-2 group">
          <Button size="sm" onClick={copyToClipboard} className="absolute top-2 right-2 h-7 text-xs">
            {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg text-xs font-mono border border-slate-800 max-h-[400px] overflow-auto whitespace-pre-wrap break-all">
            {buttonsCode}
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

const downsellBaseSchema = z.object({
  name: z.string().optional(),
  price: z.coerce.number().min(0, { message: "Preço deve ser maior ou igual a 0." }).optional(),
  redirectUrl: optionalUrl,
  customId: z.string().optional(),
  fallbackCheckoutUrl: optionalUrl,
});

const downsellSchema = downsellBaseSchema.extend({
  downsell: downsellBaseSchema.optional(),
});

const upsellStepSchema = z.object({
  name: z.string().optional(),
  price: z.coerce.number().min(0, { message: "Preço deve ser maior ou igual a 0." }).optional(),
  redirectUrl: optionalUrl,
  customId: z.string().optional(),
  fallbackCheckoutUrl: optionalUrl,
  downsell: downsellSchema.optional(),
});

const upsellSchema = z.object({
  enabled: z.boolean().default(false),
  name: z.string().optional(),
  price: z.coerce.number().min(0, { message: "Preço deve ser maior ou igual a 0." }).optional(),
  redirectUrl: optionalUrl,
  customId: z.string().optional(),
  fallbackCheckoutUrl: optionalUrl,
  downsell: downsellSchema.optional(),
  paypalOneClickEnabled: z.boolean().default(false),
  steps: z.array(upsellStepSchema).optional(),
});

const membershipWebhookSchema = z.object({
  enabled: z.boolean().default(false),
  url: optionalUrl,
  authToken: z.string().optional(),
});

const autoNotificationsSchema = z.object({
  enabled: z.boolean().default(false),
  genderFilter: z.enum(["all", "male", "female"]).default("all"),
  region: z.enum(["pt", "en", "es", "fr"]).default("pt"),
  intervalSeconds: z.coerce.number().min(1).default(10),
  soundEnabled: z.boolean().default(true),
});

const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, { message: "Cor inválida" })
  .optional()
  .or(z.literal(""));

const facebookPixelSchema = z.object({
  pixelId: z.string().min(1, { message: "Pixel ID é obrigatório." }),
  accessToken: z.string().min(1, { message: "Token de acesso é obrigatório." }),
});

const layoutTypeSchema = z.enum(["classic", "modern", "minimal"]).default("classic");

const offerFormSchema = z.object({
  name: z.string().min(3, { message: "Nome do link é obrigatório." }),
  group: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  layoutType: layoutTypeSchema,
  bannerImageUrl: optionalUrl,
  secondaryBannerImageUrl: optionalUrl,
  thankYouPageUrl: optionalUrl,
  backRedirectUrl: optionalUrl,
  currency: z.string().default("BRL"),
  language: z.string().default("pt"),
  collectAddress: z.boolean().default(false),

  collectPhone: z.boolean().default(true),
  collectDocument: z.boolean().default(false),
  paypalEnabled: z.boolean().default(false),
  pagarme_pix_enabled: z.boolean().default(false),
  stripe_card_enabled: z.boolean().default(true),
  customDomain: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        // Valida formato de domínio
        const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
        return domainRegex.test(val.trim());
      },
      { message: "Domínio inválido. Use o formato: checkout.seudominio.com.br" },
    ),

  // Cores
  primaryColor: colorSchema,
  buttonColor: colorSchema,
  backgroundColor: colorSchema, // NOVO
  textColor: colorSchema, // NOVO

  mainProduct: productSchema,
  utmfyWebhookUrl: optionalUrl, // Mantido para retrocompatibilidade
  utmfyWebhookUrls: z.array(z.string().url({ message: "URL inválida." }).or(z.literal(""))).optional(),
  facebookPixelId: z.string().optional(), // Mantido para retrocompatibilidade
  facebookAccessToken: z.string().optional(), // Mantido para retrocompatibilidade
  facebookPixels: z
    .array(facebookPixelSchema)
    .optional()
    .refine(
      (pixels) => {
        if (!pixels || pixels.length === 0) return true;
        const pixelIds = pixels.map((p) => p.pixelId.trim()).filter((id) => id !== "");
        const uniqueIds = new Set(pixelIds);
        return pixelIds.length === uniqueIds.size;
      },
      {
        message: "IDs de Pixel duplicados encontrados. Cada Pixel ID deve ser único.",
      },
    ),
  upsell: upsellSchema,
  membershipWebhook: membershipWebhookSchema,
  autoNotifications: autoNotificationsSchema,
  orderBumps: z.array(productSchema).optional(),
  emailNotification: z.object({
    enabled: z.boolean().default(false),
    subject: z.string().optional(),
    heading: z.string().optional(),
    body: z.string().optional(),
    imageUrl: optionalUrl,
    pdfUrl: optionalUrl,
  }).optional(),
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
  const [categories, setCategories] = useState<any[]>([]);
  const isEditMode = !!offerId;

  React.useEffect(() => {
    axios
      .get(`${API_URL}/categories`)
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  const form = useForm<OfferFormData>({
    resolver: zodResolver(offerFormSchema),
    defaultValues: initialData || {
      name: "",
      group: "",
      categoryId: "none",
      layoutType: "classic",
      bannerImageUrl: "",
      secondaryBannerImageUrl: "",
      thankYouPageUrl: "",
      backRedirectUrl: "",
      currency: "BRL",
      language: "pt",

      collectAddress: false,
      collectDocument: false,
      paypalEnabled: false,
      pagarme_pix_enabled: false,
      stripe_card_enabled: true,
      utmfyWebhookUrl: "",
      utmfyWebhookUrls: [],
      facebookPixelId: "",
      facebookAccessToken: "",
      facebookPixels: [],
      customDomain: "",
      upsell: {
        enabled: false,
        name: "",
        price: 0,
        redirectUrl: "",
        paypalOneClickEnabled: false,
        steps: [],
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
      // Cores - Valores padrão
      primaryColor: "#374151",
      buttonColor: "#2563EB",
      backgroundColor: "#ffffff", // NOVO - Fundo branco por padrão
      textColor: "#374151", // NOVO - Texto cinza escuro
      autoNotifications: {
        enabled: false,
        genderFilter: "all" as const,
        region: "pt" as const,
        intervalSeconds: 10,
        soundEnabled: true,
      },
      orderBumps: [],
      emailNotification: {
        enabled: false,
        subject: "",
        heading: "",
        body: "",
        imageUrl: "",
        pdfUrl: "",
      },
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "orderBumps",
  });

  const {
    fields: utmfyUrlFields,
    append: appendUtmfyUrl,
    remove: removeUtmfyUrl,
  } = useFieldArray({
    control: form.control,
    name: "utmfyWebhookUrls" as "orderBumps",
  });

  const {
    fields: facebookPixelFields,
    append: appendFacebookPixel,
    remove: removeFacebookPixel,
  } = useFieldArray({
    control: form.control,
    name: "facebookPixels" as "orderBumps",
  });

  const {
    fields: upsellStepFields,
    append: appendUpsellStepRaw,
    remove: removeUpsellStepRaw,
  } = useFieldArray({
    control: form.control,
    name: "upsell.steps" as any,
  });

  // Estado local para controlar visibilidade do card de downsell (confiável para re-render)
  const [showDownsell1, setShowDownsell1] = useState(!!(initialData?.upsell?.downsell?.name || initialData?.upsell?.downsell?.redirectUrl));
  const [showDownsell1Nested, setShowDownsell1Nested] = useState(
    !!(initialData?.upsell?.downsell?.downsell?.name || initialData?.upsell?.downsell?.downsell?.redirectUrl),
  );
  const [stepsDownsellVisible, setStepsDownsellVisible] = useState<boolean[]>(() =>
    (initialData?.upsell?.steps || []).map((s: any) => !!(s?.downsell?.name || s?.downsell?.redirectUrl)),
  );
  const [stepsNestedDownsellVisible, setStepsNestedDownsellVisible] = useState<boolean[]>(() =>
    (initialData?.upsell?.steps || []).map((s: any) => !!(s?.downsell?.downsell?.name || s?.downsell?.downsell?.redirectUrl)),
  );

  const appendUpsellStep = (data: any) => {
    appendUpsellStepRaw(data);
    setStepsDownsellVisible((prev) => [...prev, false]);
    setStepsNestedDownsellVisible((prev) => [...prev, false]);
  };

  const removeUpsellStep = (index: number) => {
    removeUpsellStepRaw(index);
    setStepsDownsellVisible((prev) => prev.filter((_, i) => i !== index));
    setStepsNestedDownsellVisible((prev) => prev.filter((_, i) => i !== index));
  };

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
        upsell: {
          ...data.upsell,
          price: data.upsell?.price ? Math.round(data.upsell.price * 100) : 0,
          downsell:
            data.upsell?.downsell?.name || data.upsell?.downsell?.redirectUrl
              ? {
                  ...data.upsell.downsell,
                  price: data.upsell.downsell?.price ? Math.round(data.upsell.downsell.price * 100) : 0,
                  downsell:
                    data.upsell.downsell?.downsell?.name || data.upsell.downsell?.downsell?.redirectUrl
                      ? {
                          ...data.upsell.downsell.downsell,
                          price: data.upsell.downsell.downsell?.price ? Math.round(data.upsell.downsell.downsell.price * 100) : 0,
                        }
                      : undefined,
                }
              : undefined,
          steps:
            data.upsell?.steps?.map((step) => ({
              ...step,
              price: step.price ? Math.round(step.price * 100) : 0,
              downsell:
                step.downsell?.name || step.downsell?.redirectUrl
                  ? {
                      ...step.downsell,
                      price: step.downsell?.price ? Math.round(step.downsell.price * 100) : 0,
                      downsell:
                        step.downsell?.downsell?.name || step.downsell?.downsell?.redirectUrl
                          ? {
                              ...step.downsell.downsell,
                              price: step.downsell.downsell?.price ? Math.round(step.downsell.downsell.price * 100) : 0,
                            }
                          : undefined,
                    }
                  : undefined,
            })) || [],
        },
        utmfyWebhookUrls: data.utmfyWebhookUrls?.filter((url) => url && url.trim() !== ""),
        facebookPixels: data.facebookPixels?.filter(
          (pixel) => pixel.pixelId && pixel.pixelId.trim() !== "" && pixel.accessToken && pixel.accessToken.trim() !== "",
        ),
      };
    };

    const valuesCopy = { ...values };
    if (valuesCopy.categoryId === "none" || valuesCopy.categoryId === "") {
      valuesCopy.categoryId = null as any;
    }

    const dataToSubmit = transformPrices(valuesCopy as OfferFormOutput);

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
              name="categoryId"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel>Pasta/Categoria (Opcional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma pasta" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma (Outras Ofertas)</SelectItem>
                      {categories.map((cat: any) => (
                        <SelectItem key={cat._id} value={cat._id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Organize suas ofertas em pastas para melhor visualização.</FormDescription>
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
              name="backRedirectUrl"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel>URL de Redirecionamento ao Voltar (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://seusite.com/oferta-especial" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>
                    Quando o cliente tentar voltar do checkout, será redirecionado para esta URL (ex: oferta com desconto).
                  </FormDescription>
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

            <FormField
              control={form.control}
              name="secondaryBannerImageUrl"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel>Banner Secundário (Opcional)</FormLabel>
                  <FormControl>
                    <ImageUpload value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormDescription>Banner adicional para exibir no checkout.</FormDescription>
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
                      <FormControl className="w-full">
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a moeda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="BRL">BRL (Real Brasileiro)</SelectItem>
                        <SelectItem value="USD">USD (Dólar Americano)</SelectItem>
                        <SelectItem value="EUR">EUR (Euro)</SelectItem>
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
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o idioma" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pt">🇧🇷 Português</SelectItem>
                        <SelectItem value="en">🇺🇸 English</SelectItem>
                        <SelectItem value="fr">
                          <div className="flex items-center gap-2">
                            <span className="text-lg leading-none">🇫🇷</span>
                            <span>Français</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="es">🇪🇸 Español</SelectItem>
                        <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                        <SelectItem value="it">🇮🇹 Italiano</SelectItem>
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
          description="Layout, cores e dados que serao solicitados ao cliente."
        >
          <div className="space-y-6">
            {/* Layout do Checkout */}
            <FormField
              control={form.control}
              name="layoutType"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <LayoutTemplate className="w-4 h-4" />
                    Layout do Checkout
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || "classic"}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o layout" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="classic">Classic (Padrao)</SelectItem>
                      <SelectItem value="modern">Modern</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Escolha o estilo visual do seu checkout.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

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
              {/* --- NOVOS CAMPOS --- */}
              <FormField
                control={form.control}
                name="backgroundColor"
                render={({ field }: any) => (
                  <FormItem>
                    <FormLabel>Cor do Fundo</FormLabel>
                    <ColorInput field={field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="textColor"
                render={({ field }: any) => (
                  <FormItem>
                    <FormLabel>Cor do Texto</FormLabel>
                    <ColorInput field={field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* --------------------- */}
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="collectAddress"
                render={({ field }: any) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-card">
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
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-card">
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
              <FormField
                control={form.control}
                name="collectDocument"
                render={({ field }: any) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-card">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Coletar CPF/CNPJ</FormLabel>
                      {/* <FormDescription>Obrigatório para pagamentos PIX via Pagar.me.</FormDescription> */}
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paypalEnabled"
                render={({ field }: any) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-card">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Habilitar PayPal</FormLabel>
                      <FormDescription>Permitir pagamentos via PayPal.</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pagarme_pix_enabled"
                render={({ field }: any) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-card">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Habilitar PIX via Pagar.me</FormLabel>
                      <FormDescription>
                        Permitir pagamentos via PIX. Certifique-se de configurar suas credenciais {""}
                        <a href="/dashboard/settings" className="text-primary hover:underline">
                          configurações da conta
                        </a>
                        .
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stripe_card_enabled"
                render={({ field }: any) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-card">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Habilitar Cartão de Crédito (Stripe)</FormLabel>
                      <FormDescription>
                        Permitir pagamentos via Cartão de Crédito. Certifique-se de configurar suas credenciais {""}
                        <a href="/dashboard/settings" className="text-primary hover:underline">
                          configurações da conta
                        </a>
                        .
                      </FormDescription>
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
              <MoneyInput form={form} name="mainProduct.priceInCents" label="Preço" placeholder="0,00" currency={form.watch("currency")} />
              <MoneyInput
                form={form}
                name="mainProduct.compareAtPriceInCents"
                label="Preço antigo"
                placeholder="0,00"
                currency={form.watch("currency")}
              />
            </div>

            <CustomIdInput name="mainProduct.customId" />

            <FormField
              control={form.control}
              name="mainProduct.imageUrl"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel>Imagem do Produto</FormLabel>
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
              <div key={field.id} className="p-4 rounded-lg border bg-card relative space-y-4">
                <div className="flex items-center justify-between gap-2">
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
                  <MoneyInput
                    form={form}
                    name={`orderBumps.${index}.priceInCents`}
                    label="Preço"
                    placeholder="0,00"
                    currency={form.watch("currency")}
                  />
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

                <FormField
                  control={form.control}
                  name={`orderBumps.${index}.description`}
                  render={({ field }: any) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Ex: Aprenda técnicas avançadas com este ebook exclusivo&#10;&#10;Você pode usar:&#10;- Listas com -&#10;- Quebras de linha&#10;- **Negrito** e *itálico*"
                          className="min-h-[100px] resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">Suporta Markdown: **negrito**, *itálico*, listas com -, quebras de linha</FormDescription>
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
          title="Funil de Upsell (One-Click)"
          icon={<ArrowUpCircle className="w-5 h-5" />}
          description="Ofertas exibidas em sequência após a compra aprovada."
          badge={
            form.watch("upsell.enabled")
              ? `Ativado (${1 + (upsellStepFields?.length || 0)} ${1 + (upsellStepFields?.length || 0) === 1 ? "etapa" : "etapas"})`
              : undefined
          }
        >
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="upsell.enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-4 rounded-lg border p-4 bg-card">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Habilitar Funil de Upsell</FormLabel>
                    <FormDescription>Crie um funil com uma ou mais ofertas exibidas em sequência após a compra.</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {form.watch("upsell.enabled") && (
              <div className="space-y-0 animate-in fade-in slide-in-from-top-2">
                {/* === UPSELL #1 === */}
                <div className="relative">
                  <div className="space-y-4 p-4 bg-card rounded-lg border-2 border-border shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-md">UPSELL</span>
                        <span className="text-sm font-medium">Upsell Offer #1</span>
                      </div>
                    </div>

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
                      <MoneyInput form={form} name="upsell.price" label="Preço" placeholder="0,00" currency={form.watch("currency")} />
                      <FormField
                        control={form.control}
                        name="upsell.redirectUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>URL da Página</FormLabel>
                            <FormControl>
                              <Input placeholder="https://..." {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <CustomIdInput name="upsell.customId" />
                  </div>

                  {/* --- Downsell do Upsell #1 --- */}
                  {showDownsell1 ? (
                    <div className="ml-8 mt-0 relative">
                      <div className="absolute -top-1 left-4 w-px h-4 bg-red-300" />
                      <div className="absolute top-3 left-0 w-4 h-px bg-red-300" />
                      <div className="pt-4">
                        <div className="space-y-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border-2 border-red-200 dark:border-red-900 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-md">DOWNSELL</span>
                              <span className="text-sm font-medium">Downsell Offer #1</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                form.setValue("upsell.downsell" as any, { name: "", price: 0, redirectUrl: "", customId: "" });
                                setShowDownsell1(false);
                              }}
                              className="shrink-0 text-destructive hover:text-destructive h-8 w-8"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-red-600 dark:text-red-400">Exibido quando o cliente recusar o Upsell #1</p>

                          <FormField
                            control={form.control}
                            name={"upsell.downsell.name" as any}
                            render={({ field }: any) => (
                              <FormItem>
                                <FormLabel>Nome da Oferta</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: Oferta especial reduzida" {...field} value={field.value || ""} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <MoneyInput form={form} name="upsell.downsell.price" label="Preço" placeholder="0,00" currency={form.watch("currency")} />
                            <FormField
                              control={form.control}
                              name={"upsell.downsell.redirectUrl" as any}
                              render={({ field }: any) => (
                                <FormItem>
                                  <FormLabel>URL da Página</FormLabel>
                                  <FormControl>
                                    <Input placeholder="https://..." {...field} value={field.value || ""} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <CustomIdInput name={"upsell.downsell.customId" as any} />

                          {/* --- Downsell aninhado do Downsell #1 --- */}
                          {showDownsell1Nested ? (
                            <div className="ml-8 mt-0 relative">
                              <div className="absolute -top-1 left-4 w-px h-4 bg-orange-300" />
                              <div className="absolute top-3 left-0 w-4 h-px bg-orange-300" />
                              <div className="pt-4">
                                <div className="space-y-4 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border-2 border-orange-200 dark:border-orange-900 shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-md">DOWNSELL</span>
                                      <span className="text-sm font-medium">Downsell Encadeado #1</span>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        form.setValue("upsell.downsell.downsell" as any, { name: "", price: 0, redirectUrl: "", customId: "" });
                                        setShowDownsell1Nested(false);
                                      }}
                                      className="shrink-0 text-destructive hover:text-destructive h-8 w-8"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                  <p className="text-xs text-orange-600 dark:text-orange-400">Exibido quando o cliente recusar o Downsell #1</p>

                                  <FormField
                                    control={form.control}
                                    name={"upsell.downsell.downsell.name" as any}
                                    render={({ field }: any) => (
                                      <FormItem>
                                        <FormLabel>Nome da Oferta</FormLabel>
                                        <FormControl>
                                          <Input placeholder="Ex: Oferta mínima especial" {...field} value={field.value || ""} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <MoneyInput form={form} name="upsell.downsell.downsell.price" label="Preço" placeholder="0,00" currency={form.watch("currency")} />
                                    <FormField
                                      control={form.control}
                                      name={"upsell.downsell.downsell.redirectUrl" as any}
                                      render={({ field }: any) => (
                                        <FormItem>
                                          <FormLabel>URL da Página</FormLabel>
                                          <FormControl>
                                            <Input placeholder="https://..." {...field} value={field.value || ""} />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                  <CustomIdInput name={"upsell.downsell.downsell.customId" as any} />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="ml-8 mt-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-dashed border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-xs"
                                onClick={() => setShowDownsell1Nested(true)}
                              >
                                <Plus className="w-3 h-3 mr-1" /> Adicionar Downsell Encadeado
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="ml-8 mt-2 mb-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-dashed border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs"
                        onClick={() => setShowDownsell1(true)}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Adicionar Downsell
                      </Button>
                    </div>
                  )}
                </div>

                {/* --- Conector visual entre steps --- */}
                <div className="flex justify-center py-2">
                  <div className="w-px h-6 bg-border" />
                </div>

                {/* === UPSELLS ADICIONAIS === */}
                {upsellStepFields.map((field, index) => (
                  <div key={field.id}>
                    <div className="relative">
                      <div className="space-y-4 p-4 bg-card rounded-lg border-2 border-border shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-md">UPSELL</span>
                            <span className="text-sm font-medium">Upsell Offer #{index + 2}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeUpsellStep(index)}
                            className="shrink-0 text-destructive hover:text-destructive h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <FormField
                          control={form.control}
                          name={`upsell.steps.${index}.name` as any}
                          render={({ field }: any) => (
                            <FormItem>
                              <FormLabel>Nome da Oferta</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: Mentoria Exclusiva" {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <MoneyInput
                            form={form}
                            name={`upsell.steps.${index}.price`}
                            label="Preço"
                            placeholder="0,00"
                            currency={form.watch("currency")}
                          />
                          <FormField
                            control={form.control}
                            name={`upsell.steps.${index}.redirectUrl` as any}
                            render={({ field }: any) => (
                              <FormItem>
                                <FormLabel>URL da Página</FormLabel>
                                <FormControl>
                                  <Input placeholder="https://..." {...field} value={field.value || ""} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <CustomIdInput name={`upsell.steps.${index}.customId` as any} />
                      </div>

                      {/* --- Downsell deste step --- */}
                      {stepsDownsellVisible[index] ? (
                        <div className="ml-8 mt-0 relative">
                          <div className="absolute -top-1 left-4 w-px h-4 bg-red-300" />
                          <div className="absolute top-3 left-0 w-4 h-px bg-red-300" />
                          <div className="pt-4">
                            <div className="space-y-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border-2 border-red-200 dark:border-red-900 shadow-sm">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-md">DOWNSELL</span>
                                  <span className="text-sm font-medium">Downsell Offer #{index + 2}</span>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    form.setValue(`upsell.steps.${index}.downsell` as any, { name: "", price: 0, redirectUrl: "", customId: "" });
                                    setStepsDownsellVisible((prev) => {
                                      const n = [...prev];
                                      n[index] = false;
                                      return n;
                                    });
                                  }}
                                  className="shrink-0 text-destructive hover:text-destructive h-8 w-8"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                              <p className="text-xs text-red-600 dark:text-red-400">Exibido quando o cliente recusar o Upsell #{index + 2}</p>

                              <FormField
                                control={form.control}
                                name={`upsell.steps.${index}.downsell.name` as any}
                                render={({ field }: any) => (
                                  <FormItem>
                                    <FormLabel>Nome da Oferta</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Ex: Oferta especial reduzida" {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <MoneyInput
                                  form={form}
                                  name={`upsell.steps.${index}.downsell.price`}
                                  label="Preço"
                                  placeholder="0,00"
                                  currency={form.watch("currency")}
                                />
                                <FormField
                                  control={form.control}
                                  name={`upsell.steps.${index}.downsell.redirectUrl` as any}
                                  render={({ field }: any) => (
                                    <FormItem>
                                      <FormLabel>URL da Página</FormLabel>
                                      <FormControl>
                                        <Input placeholder="https://..." {...field} value={field.value || ""} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                              <CustomIdInput name={`upsell.steps.${index}.downsell.customId` as any} />

                              {/* --- Downsell aninhado deste step --- */}
                              {stepsNestedDownsellVisible[index] ? (
                                <div className="ml-8 mt-0 relative">
                                  <div className="absolute -top-1 left-4 w-px h-4 bg-orange-300" />
                                  <div className="absolute top-3 left-0 w-4 h-px bg-orange-300" />
                                  <div className="pt-4">
                                    <div className="space-y-4 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border-2 border-orange-200 dark:border-orange-900 shadow-sm">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-md">DOWNSELL</span>
                                          <span className="text-sm font-medium">Downsell Encadeado #{index + 2}</span>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => {
                                            form.setValue(`upsell.steps.${index}.downsell.downsell` as any, { name: "", price: 0, redirectUrl: "", customId: "" });
                                            setStepsNestedDownsellVisible((prev) => {
                                              const n = [...prev];
                                              n[index] = false;
                                              return n;
                                            });
                                          }}
                                          className="shrink-0 text-destructive hover:text-destructive h-8 w-8"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                      <p className="text-xs text-orange-600 dark:text-orange-400">Exibido quando o cliente recusar o Downsell #{index + 2}</p>

                                      <FormField
                                        control={form.control}
                                        name={`upsell.steps.${index}.downsell.downsell.name` as any}
                                        render={({ field }: any) => (
                                          <FormItem>
                                            <FormLabel>Nome da Oferta</FormLabel>
                                            <FormControl>
                                              <Input placeholder="Ex: Oferta mínima especial" {...field} value={field.value || ""} />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <MoneyInput
                                          form={form}
                                          name={`upsell.steps.${index}.downsell.downsell.price`}
                                          label="Preço"
                                          placeholder="0,00"
                                          currency={form.watch("currency")}
                                        />
                                        <FormField
                                          control={form.control}
                                          name={`upsell.steps.${index}.downsell.downsell.redirectUrl` as any}
                                          render={({ field }: any) => (
                                            <FormItem>
                                              <FormLabel>URL da Página</FormLabel>
                                              <FormControl>
                                                <Input placeholder="https://..." {...field} value={field.value || ""} />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                      </div>
                                      <CustomIdInput name={`upsell.steps.${index}.downsell.downsell.customId` as any} />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="ml-8 mt-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-dashed border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-xs"
                                    onClick={() =>
                                      setStepsNestedDownsellVisible((prev) => {
                                        const n = [...prev];
                                        n[index] = true;
                                        return n;
                                      })
                                    }
                                  >
                                    <Plus className="w-3 h-3 mr-1" /> Adicionar Downsell Encadeado
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="ml-8 mt-2 mb-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-dashed border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs"
                            onClick={() =>
                              setStepsDownsellVisible((prev) => {
                                const n = [...prev];
                                n[index] = true;
                                return n;
                              })
                            }
                          >
                            <Plus className="w-3 h-3 mr-1" /> Adicionar Downsell
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* --- Conector visual entre steps --- */}
                    <div className="flex justify-center py-2">
                      <div className="w-px h-6 bg-border" />
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed mb-6"
                  onClick={() => appendUpsellStep({ name: "", price: 0, redirectUrl: "", customId: "" } as any)}
                >
                  + Adicionar Upsell ao Funil
                </Button>

                {/* --- PAYPAL ONE-CLICK UPSELL --- */}
                {/* <FormField
                  control={form.control}
                  name="upsell.paypalOneClickEnabled"
                  render={({ field }: any) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-card">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>PayPal One-Click Upsell</FormLabel>
                        <FormDescription>
                          Habilita upsell com 1 clique usando PayPal Vault. <strong>Requer vault habilitado na sua conta PayPal.</strong> Se
                          desabilitado, o cliente será redirecionado para checkout normal.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                /> */}

                {/* --- BOTÕES DE GERAR SCRIPTS --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UpsellScriptOnlyDialog />
                  <UpsellButtonsOnlyDialog />
                </div>
              </div>
            )}
          </div>
        </FormSection>

        {/* --- 6. INTEGRAÇÕES --- */}
        <FormSection title="Integrações" icon={<LinkIcon className="w-5 h-5" />} description="Conecte com ferramentas externas (Webhooks).">
          <div className="space-y-6">
            {/* --- BLOCO FACEBOOK - Múltiplos Pixels --- */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">FACEBOOK</div>
                    <h4 className="font-medium text-sm">API de Conversões (CAPI)</h4>
                  </div>
                  <FormDescription className="mt-1">Adicione múltiplos pixels do Facebook (pode adicionar múltiplos).</FormDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendFacebookPixel({ pixelId: "", accessToken: "" } as any)}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Pixel
                </Button>
              </div>

              {facebookPixelFields.map((field, index) => (
                <div key={field.id} className="p-4 border rounded-md space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Pixel #{index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFacebookPixel(index)}
                      className="shrink-0 text-destructive hover:text-destructive h-8 w-8"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`facebookPixels.${index}.pixelId` as any}
                      render={({ field }: any) => (
                        <FormItem>
                          <FormLabel>ID do Pixel</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: 1234567890" {...field} />
                          </FormControl>
                          <FormDescription className="text-xs">ㅤ</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`facebookPixels.${index}.accessToken` as any}
                      render={({ field }: any) => (
                        <FormItem>
                          <FormLabel>Token de Acesso</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="EAAB..." {...field} />
                          </FormControl>
                          <FormDescription className="text-xs">Gerado no Gerenciador de Negócios.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}

              {facebookPixelFields.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                  <p className="text-sm text-muted-foreground mb-2">Nenhum pixel do Facebook configurado</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => appendFacebookPixel({ pixelId: "", accessToken: "" } as any)}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar primeiro pixel
                  </Button>
                </div>
              )}
            </div>

            <Separator />
            {/* Webhooks UTMfy - Múltiplas URLs */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <FormLabel>Webhooks UTMfy</FormLabel>
                  <FormDescription className="mt-1">URLs para enviar eventos de venda (pode adicionar múltiplas).</FormDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => appendUtmfyUrl("" as any)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar URL
                </Button>
              </div>

              {utmfyUrlFields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <FormField
                    control={form.control}
                    name={`utmfyWebhookUrls.${index}` as any}
                    render={({ field }: any) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder={`https://webhook.utmfy.com/...`} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeUtmfyUrl(index)}
                    className="shrink-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              {utmfyUrlFields.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                  <p className="text-sm text-muted-foreground mb-2">Nenhuma URL de webhook configurada</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => appendUtmfyUrl("" as any)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Adicionar primeira URL
                  </Button>
                </div>
              )}
            </div>

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
                    render={({ field }) => {
                      const [showToken, setShowToken] = React.useState(false);
                      const [copied, setCopied] = React.useState(false);

                      const handleCopy = async () => {
                        if (field.value) {
                          await navigator.clipboard.writeText(field.value);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }
                      };

                      return (
                        <FormItem>
                          <FormLabel>Token de Autenticação</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showToken ? "text" : "password"}
                                placeholder="Bearer Token"
                                {...field}
                                value={field.value || ""}
                                className="pr-20"
                              />
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  onClick={() => setShowToken(!showToken)}
                                >
                                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  onClick={handleCopy}
                                  disabled={!field.value}
                                >
                                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </FormSection>

        {/* <FormSection
          title="Domínio Customizado"
          icon={<Globe className="w-5 h-5" />}
          description="Use seu próprio domínio para o checkout."
          badge={form.watch("customDomain") ? "Configurado" : undefined}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <FormField
                control={form.control}
                name="customDomain"
                render={({ field }: any) => (
                  <FormItem className="flex-1">
                    <FormLabel>Domínio</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="checkout.seudominio.com.br"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Seu checkout ficará disponível em <code className="text-primary">https://{field.value || "checkout.seudominio.com.br"}</code>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="mt-[22px]">
                <DnsInstructionsDialog domain={form.watch("customDomain")} />
              </div>
            </div>

            {form.watch("customDomain") && (
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>✅ Domínio configurado:</strong> Após apontar o DNS,
                  seu checkout estará disponível em <code className="font-medium">https://{form.watch("customDomain")}</code>
                </p>
              </div>
            )}
          </div>
        </FormSection> */}

        {/* --- NOTIFICAÇÕES AUTOMÁTICAS --- */}
        <FormSection
          title="Notificações Automáticas"
          icon={<Bell className="w-5 h-5" />}
          description="Exiba notificações de 'vendas' para aumentar a prova social."
        >
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="autoNotifications.enabled"
              render={({ field }: any) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-card">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Ativar Notificações Automáticas</FormLabel>
                    <FormDescription>Exibe toasts simulando compras de outros clientes a cada 10 segundos.</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {form.watch("autoNotifications.enabled") && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="autoNotifications.genderFilter"
                    render={({ field }: any) => (
                      <FormItem>
                        <FormLabel>Filtro de Gênero dos Nomes</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecione o filtro" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">Todos os Nomes</SelectItem>
                            <SelectItem value="male">Apenas Masculinos</SelectItem>
                            <SelectItem value="female">Apenas Femininos</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="autoNotifications.region"
                    render={({ field }: any) => (
                      <FormItem>
                        <FormLabel>Região dos Nomes</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecione a região" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pt">🇧🇷 Português (Brasil)</SelectItem>
                            <SelectItem value="en">🇺🇸 English (USA)</SelectItem>
                            <SelectItem value="es">🇪🇸 Español (España)</SelectItem>
                            <SelectItem value="fr">🇫🇷 Français (France)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <FormField
                    control={form.control}
                    name="autoNotifications.intervalSeconds"
                    render={({ field }: any) => (
                      <FormItem>
                        <FormLabel>Intervalo entre Notificações (segundos)</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} max={60} placeholder="10" {...field} value={field.value || 10} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="autoNotifications.soundEnabled"
                    render={({ field }: any) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-card mt-6">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Ativar Som</FormLabel>
                          <FormDescription>Tocar um som quando a notificação aparecer.</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}
          </div>
        </FormSection>

        {/* Seção: Email de Confirmação */}
        <FormSection
          title="Email de Confirmação"
          icon={<Mail className="w-5 h-5" />}
          description="Envie um email automático ao cliente após a compra."
        >
          <div className="space-y-5">
            <FormField
              control={form.control}
              name="emailNotification.enabled"
              render={({ field }: any) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Ativar Email de Confirmação</FormLabel>
                    <FormDescription>
                      Ao ativar, um email será enviado ao cliente quando a compra for aprovada.
                      Configure o SMTP nas{" "}
                      <a href="/settings" className="text-primary hover:underline">
                        Configurações da conta
                      </a>.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-5 w-5 accent-primary cursor-pointer"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch("emailNotification.enabled") && (
              <>
                <FormField
                  control={form.control}
                  name="emailNotification.subject"
                  render={({ field }: any) => (
                    <FormItem>
                      <FormLabel>Assunto do Email</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          placeholder="Ex: Sua compra foi confirmada!"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                      </FormControl>
                      <FormDescription>Deixe em branco para usar o assunto padrão.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emailNotification.heading"
                  render={({ field }: any) => (
                    <FormItem>
                      <FormLabel>Título do Email</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          placeholder="Ex: Sua compra foi confirmada!"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emailNotification.body"
                  render={({ field }: any) => (
                    <FormItem>
                      <FormLabel>Mensagem</FormLabel>
                      <FormControl>
                        <textarea
                          {...field}
                          rows={4}
                          placeholder="Ex: Obrigado pela sua compra! Seu acesso será enviado em breve."
                          className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emailNotification.imageUrl"
                  render={({ field }: any) => (
                    <FormItem>
                      <FormLabel>Imagem (opcional)</FormLabel>
                      <FormControl>
                        <ImageUpload value={field.value || ""} onChange={field.onChange} />
                      </FormControl>
                      <FormDescription>Imagem exibida no topo do email.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emailNotification.pdfUrl"
                  render={({ field }: any) => (
                    <FormItem>
                      <FormLabel>Link para PDF / Material (opcional)</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          placeholder="https://..."
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                      </FormControl>
                      <FormDescription>Um botão de download será exibido no email com este link.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </div>
        </FormSection>

        {/* Botão Flutuante Fixo */}
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:left-64">
          <div className="max-w-4xl mx-auto">
            <Button type="submit" size="lg" className="w-full shadow-lg h-12 font-semibold" disabled={isLoading}>
              {isLoading ? "Salvando..." : isEditMode ? "Atualizar Configurações" : "Salvar Oferta"}
            </Button>
          </div>
        </div>

        {/* Espaçamento para compensar o botão fixo */}
        <div className="h-24" />
      </form>
    </Form>
  );
}
