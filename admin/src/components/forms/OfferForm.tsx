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
import { Trash2 } from "lucide-react";
import { ImageUpload } from "./ImageUpload";
import { API_URL } from "@/config/BackendUrl";

// --- Schema de Validação (Zod) ---
const optionalUrl = z.string().url({ message: "URL inválida." }).optional().or(z.literal(""));

// Schema do Produto (com coerce para o preço do formulário)
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
  currency: z.string().default("BRL"), // Input: string | undefined, Output: string
  language: z.string().default("pt"), // Idioma da oferta (pt, en, fr)
  collectAddress: z.boolean().default(false), // Se deve coletar endereço
  collectPhone: z.boolean().default(true), // Se deve coletar telefone
  primaryColor: colorSchema,
  buttonColor: colorSchema,
  mainProduct: productSchema,
  utmfyWebhookUrl: optionalUrl,
  upsell: upsellSchema,
  membershipWebhook: membershipWebhookSchema,
  orderBumps: z.array(productSchema).optional(),
});

// --- INÍCIO DA CORREÇÃO ---

// 1. Definir e EXPORTAR os tipos de Input e Output
export type OfferFormInput = z.input<typeof offerFormSchema>;
export type OfferFormOutput = z.infer<typeof offerFormSchema>;

// 2. O tipo de dados do formulário (FormData) DEVE ser o INPUT
//    Ele será usado pelo useForm e pela página de Edição (initialData)
export type OfferFormData = OfferFormInput & { _id?: string };

// --- FIM DA CORREÇÃO ---

// Props do componente
interface OfferFormProps {
  onSuccess: () => void;
  initialData?: OfferFormData; // initialData agora é do tipo Input
  offerId?: string;
}

export interface SimpleOffer {
  _id: string;
  name: string;
  slug: string;
  price: number; // Apenas para mostrar no select "Nome (R$ 10,00)"
}

export function OfferForm({ onSuccess, initialData, offerId }: OfferFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isEditMode = !!offerId;

  const form = useForm<OfferFormData>({
    resolver: zodResolver(offerFormSchema),
    defaultValues: initialData || {
      name: "",
      bannerImageUrl: "",
      currency: "brl",
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

    // 1. Defina a função helper para transformar os preços
    const transformPrices = (data: OfferFormOutput) => {
      // Helper interno para limpar cada produto/bump
      const cleanSubDoc = (doc: { priceInCents: number; compareAtPriceInCents?: number; _id?: string; [key: string]: any }) => {
        const { _id, ...rest } = doc;

        // Multiplica o preço de venda
        const priceInCents = Math.round(doc.priceInCents * 100);

        // Multiplica o preço de comparação (se existir e for maior que zero)
        const compareAtPriceInCents =
          typeof doc.compareAtPriceInCents === "number" && doc.compareAtPriceInCents > 0 ? Math.round(doc.compareAtPriceInCents * 100) : undefined; // Garante que não envie 0

        return {
          ...rest,
          priceInCents,
          compareAtPriceInCents,
        };
      };

      // Retorna o objeto de dados completo e transformado
      return {
        ...data,
        mainProduct: cleanSubDoc(data.mainProduct),
        orderBumps: data.orderBumps?.map(cleanSubDoc),
      };
    };

    // 2. Chame a função helper PRIMEIRO para preparar os dados
    const dataToSubmit = transformPrices(values as OfferFormOutput);

    // 3. AGORA, faça a requisição com os dados prontos
    try {
      if (isEditMode) {
        // <-- CORREÇÃO: 'await' é essencial aqui
        await axios.put(`${API_URL}/offers/${offerId}`, dataToSubmit);
      } else {
        // <-- CORREÇÃO: 'await' é essencial aqui
        await axios.post(`${API_URL}/offers`, dataToSubmit);
      }

      // <-- CORREÇÃO: Isso agora só roda DEPOIS que o 'await' terminar
      onSuccess();
    } catch (error) {
      // O catch agora vai pegar erros da requisição
      toast.error(isEditMode ? "Falha ao atualizar link." : "Falha ao criar link.", {
        description: (error as any).response?.data?.error?.message || (error as Error).message,
      });
    } finally {
      // <-- CORREÇÃO: Isso agora só roda DEPOIS que o try/catch for concluído
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
            ID customizado <span className="text-xs text-gray-500">(Opcional)</span>
          </FormLabel>
          <FormControl>
            <Input placeholder="Ex: curso-xyz-123" {...field} value={field.value || ""} />
          </FormControl>
          <FormDescription className="text-xs">Identificador usado na integração (Webhook/Área de Membros).</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const ColorInput = ({ field }: { field: any }) => (
    <div className="flex items-center gap-2 w-full max-w-full">
      <FormControl>
        <Input type="color" className="w-10 h-10 p-1 cursor-pointer shrink-0" {...field} />
      </FormControl>
      <FormControl>
        <Input type="text" placeholder="#2563EB" className="font-mono w-full max-w-[120px]" {...field} />
      </FormControl>
    </div>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 w-full overflow-x-hidden">
        {/* --- DADOS GERAIS --- */}
        <div className="space-y-4 rounded-md border p-4 w-full overflow-x-hidden">
          <FormField
            control={form.control}
            name="name"
            render={({ field }: any) => (
              <FormItem>
                <FormLabel>Nome do Link</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Lançamento Produto X" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bannerImageUrl"
            render={({ field }: any) => (
              <FormItem>
                <FormLabel>
                  Banner <span className="text-xs text-gray-500">(Opcional)</span>
                </FormLabel>
                <FormControl>
                  <ImageUpload value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <FormField
              control={form.control}
              name="currency"
              render={({ field }: any) => (
                <FormItem className="w-full">
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
                <FormItem className="w-full">
                  <FormLabel>Idioma</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl className="w-full">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <FormField
              control={form.control}
              name="collectAddress"
              render={({ field }: any) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Coletar endereço de entrega</FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="collectPhone"
              render={({ field }: any) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Coletar telefone</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </div>

          <Separator />
          <h4 className="text-md font-medium">Personalização</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <FormField
              control={form.control}
              name="primaryColor"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel>Cor Principal (Textos, Bordas)</FormLabel>
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
                  <FormLabel>Cor do Botão de Compra</FormLabel>
                  <ColorInput field={field} />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator />
          <div className="flex">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              <FormField
                control={form.control}
                name="utmfyWebhookUrl"
                render={({ field }: any) => (
                  <FormItem>
                    <FormLabel>
                      URL do Webhook UTMfy <span className="text-xs text-gray-500">(Opcional)</span>
                    </FormLabel>

                    <FormControl>
                      <Input placeholder="https://webhook.utmfy.com/..." {...field} />
                    </FormControl>
                    <FormMessage />
                    <FormDescription className="text-xs">Envia eventos para de venda para UTMFY</FormDescription>
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        <div className="rounded-md border p-4 space-y-4">
          <FormField
            control={form.control}
            name="membershipWebhook.enabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="font-semibold">Habilitar Integração de Entrega Husky (Webhook)</FormLabel>
                  <FormDescription>Envie dados da compra para áreas de membros automaticamente.</FormDescription>
                </div>
              </FormItem>
            )}
          />

          {form.watch("membershipWebhook.enabled") && (
            <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
              <FormField
                control={form.control}
                name="membershipWebhook.url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook</FormLabel>
                    <FormControl>
                      <Input placeholder="https://api.husky-app.com/api/webhook/native" {...field} value={field.value || ""} />
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
                    <FormLabel>Token de Autenticação (Bearer)</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Cole seu token aqui" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormDescription>O token será enviado no header Authorization.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>

        {/* --- PRODUTO PRINCIPAL --- */}
        <div className="space-y-4 rounded-md border p-4 w-full overflow-x-hidden">
          <h3 className="text-lg font-medium">Produto Principal</h3>
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
          <FormField
            control={form.control}
            name="mainProduct.priceInCents"
            render={({ field }: any) => (
              <FormItem>
                <FormLabel>Preço de Venda (Ex: 19,90)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="19.90"
                    {...field}
                    value={typeof field.value === "number" ? field.value : String(field.value ?? "")}
                  />
                </FormControl>
                <FormDescription>O valor final que o cliente pagará.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mainProduct.compareAtPriceInCents"
            render={({ field }: any) => (
              <FormItem>
                <FormLabel>
                  Preço Antigo / "De:" <span className="text-xs text-gray-500">(Opcional)</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01" // PADRONIZADO
                    placeholder="29.90" // PADRONIZADO
                    {...field}
                    value={typeof field.value === "number" ? field.value : String(field.value ?? "")}
                  />
                </FormControl>
                <FormDescription>Se preenchido, será mostrado "De R$ 29,90 por R$ 19,90".</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <CustomIdInput name="mainProduct.customId" />

          <FormField
            control={form.control}
            name="mainProduct.imageUrl"
            render={({ field }: any) => (
              <FormItem>
                <FormLabel>
                  Imagem do Produto <span className="text-xs text-gray-500">(Opcional)</span>
                </FormLabel>
                <FormControl>
                  <ImageUpload value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-md border p-4 space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider">Upsell Pós-Compra (1-Click)</h4>

            <FormField
              control={form.control}
              name="upsell.enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 bg-white p-3 rounded-md border">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="font-semibold">Habilitar Upsell Pós-Compra</FormLabel>
                    <FormDescription>Ao ativar, o cliente será redirecionado para uma oferta especial após a compra aprovada.</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {/* Renderiza os campos apenas se o Upsell estiver ativado */}
            {form.watch("upsell.enabled") && (
              <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                <FormField
                  control={form.control}
                  name="upsell.name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Oferta de Upsell</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Pacote VIP Completo" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormDescription>Nome descritivo da oferta de upsell.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="upsell.price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço do Upsell (Ex: 47.00)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="47.00"
                            {...field}
                            value={typeof field.value === "number" ? field.value : String(field.value ?? "")}
                          />
                        </FormControl>
                        <FormDescription>Valor que será cobrado no upsell.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="upsell.redirectUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL da Página de Upsell</FormLabel>
                        <FormControl>
                          <Input placeholder="https://seusite.com/oferta-especial" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription>Página para onde o cliente será redirecionado.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <CustomIdInput name="upsell.customId" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* --- ORDER BUMPS --- */}
        <div className="space-y-4 w-full overflow-x-hidden">
          <h3 className="text-lg font-medium">Order Bumps</h3>

          {fields.map((field: any, index: number) => (
            <div key={field.id} className="space-y-4 rounded-md border p-4 relative w-full overflow-x-hidden">
              <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => remove(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <h4 className="font-medium">Order Bump {index + 1}</h4>

              <FormField
                control={form.control}
                name={`orderBumps.${index}.name`}
                render={({ field }: any) => (
                  <FormItem>
                    <FormLabel>Nome do Bump</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Ebook Bônus" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`orderBumps.${index}.headline`}
                render={({ field }: any) => (
                  <FormItem>
                    <FormLabel>
                      Headline <span className="text-xs text-gray-500">(Opcional)</span>
                    </FormLabel>
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
                    <FormLabel>
                      Descrição <span className="text-xs text-gray-500">(Opcional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Aprenda técnicas avançadas com este material exclusivo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`orderBumps.${index}.priceInCents`}
                render={({ field }: any) => (
                  <FormItem>
                    <FormLabel>Preço (Ex: 9.90)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} value={typeof field.value === "number" ? field.value : String(field.value ?? "")} />
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
                    <FormLabel>
                      Imagem do Bump <span className="text-xs text-gray-500">(Opcional)</span>
                    </FormLabel>
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
            onClick={() =>
              append({
                name: "",
                headline: "",
                description: "",
                priceInCents: 9.9, // Este 'number' é assignável a 'unknown'
                imageUrl: "",
              })
            }
          >
            Adicionar Order Bump
          </Button>
        </div>

        <Separator />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Salvando..." : isEditMode ? "Atualizar Link" : "Salvar Link de Checkout"}
        </Button>
      </form>
    </Form>
  );
}
