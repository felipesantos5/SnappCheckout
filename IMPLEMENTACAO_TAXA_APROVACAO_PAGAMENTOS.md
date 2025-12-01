# Implementação: Taxa de Aprovação de Pagamentos

## Data: 2025-11-28

## Contexto
Implementado sistema completo para rastrear **todas as tentativas de pagamento** (aprovadas e negadas) via webhooks do Stripe, permitindo calcular a **taxa de aprovação real** do checkout.

---

## Objetivo

Anteriormente, apenas pagamentos **aprovados** (succeeded) eram salvos no banco. Agora, **todos os pagamentos** são registrados, incluindo os que falharam, permitindo calcular:

### Métricas Antigas (Incompletas):
- ✅ Taxa de Conversão: `(Vendas / Visitantes) * 100`
- ✅ Taxa de Checkout: `(Vendas / Checkouts Iniciados) * 100`

### Nova Métrica (Completa):
- 🆕 **Taxa de Aprovação de Pagamentos**: `(Pagamentos Aprovados / Total de Tentativas) * 100`

Esta métrica é essencial para identificar problemas com:
- Cartões recusados
- Fraudes
- Problemas de integração com gateways de pagamento
- Otimização de aprovação

---

## Implementações Realizadas

### 1. **Modelo Sale - Novo Status "failed"**

**Arquivo:** `api/src/models/sale.model.ts`

#### Mudanças:

**Interface ISale (linha 29-31):**
```typescript
// ANTES
status: "succeeded" | "pending" | "refunded";

// DEPOIS
status: "succeeded" | "pending" | "refunded" | "failed";
failureReason?: string; // Motivo da falha (código de erro do Stripe)
failureMessage?: string; // Mensagem de erro legível
```

**Schema (linha 66-73):**
```typescript
// ANTES
status: {
  type: String,
  enum: ["succeeded", "pending", "refunded"],
  default: "pending",
},

// DEPOIS
status: {
  type: String,
  enum: ["succeeded", "pending", "refunded", "failed"],
  default: "pending",
},

failureReason: { type: String, default: "" },
failureMessage: { type: String, default: "" },
```

**Campos adicionados:**
- `failureReason`: Código do erro do Stripe (ex: `card_declined`, `insufficient_funds`)
- `failureMessage`: Mensagem legível para humanos

---

### 2. **Webhook Handler - payment_intent.payment_failed**

**Arquivo:** `api/src/webhooks/stripe/handlers/payment-intent.handler.ts`

#### Nova Função: `handlePaymentIntentFailed` (linhas 11-175)

Funcionalidade completa:

1. **Extrai dados do pagamento falhado**
   - Metadata (offerSlug, cliente, etc.)
   - Informações do erro do Stripe

2. **Busca informações adicionais**
   - Oferta relacionada
   - Dados do cliente (se disponível)
   - País de origem

3. **Monta lista de itens**
   - Produto principal
   - Order bumps
   - Upsells

4. **Extrai informações do erro**
```typescript
const lastPaymentError = paymentIntent.last_payment_error;
const failureReason = lastPaymentError?.code || paymentIntent.cancellation_reason || "unknown";
const failureMessage = lastPaymentError?.message || "Pagamento recusado";
```

5. **Salva no banco com status "failed"**
```typescript
const sale = await Sale.create({
  ownerId: offer.ownerId,
  offerId: offer._id,
  stripePaymentIntentId: paymentIntent.id,
  customerName: finalCustomerName,
  customerEmail: finalCustomerEmail,
  totalAmountInCents: paymentIntent.amount,
  platformFeeInCents: 0, // Sem fee pois não foi aprovado
  status: "failed",
  failureReason: failureReason,
  failureMessage: failureMessage,
  items,
});
```

**Idempotência:**
- Verifica se a venda já existe antes de criar
- Se já existe, apenas atualiza o status para "failed"

**Logs detalhados:**
```
❌ Pagamento FALHOU: pi_3abc123xyz
   - Cliente: cliente@email.com
   - Valor: 99.90 BRL
   - Motivo: card_declined
   - Mensagem: Your card was declined
✅ Tentativa de venda falhada 507f1f77bcf86cd799439011 registrada no banco.
```

---

### 3. **Router de Webhooks - Integração do Handler**

**Arquivo:** `api/src/webhooks/stripe/handlers/index.ts`

**Mudanças (linhas 1-20):**

```typescript
// ANTES
import { handlePaymentIntentSucceeded } from "./payment-intent.handler";

case "payment_intent.payment_failed":
  console.log(`⚠️  Pagamento falhou: ${event.data.object.id}`);
  // Aqui você pode implementar lógica adicional se necessário
  break;

// DEPOIS
import { handlePaymentIntentSucceeded, handlePaymentIntentFailed } from "./payment-intent.handler";

case "payment_intent.payment_failed":
  console.log(`❌ Pagamento FALHOU - Processando...`);
  await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
  break;
```

---

### 4. **Métricas do Dashboard - Nova KPI**

**Arquivo:** `api/src/controllers/metrics.controller.ts`

#### Query de Vendas Falhadas (linhas 393-416)

**ANTES:**
```typescript
const [allSales, allMetrics] = await Promise.all([
  Sale.find({
    ownerId: new mongoose.Types.ObjectId(ownerId),
    status: "succeeded",
    createdAt: { $gte: startDate, $lte: endDate },
  }).lean(),
  // ...
]);
```

**DEPOIS:**
```typescript
const [allSales, allFailedSales, allMetrics] = await Promise.all([
  // Vendas aprovadas
  Sale.find({
    ownerId: new mongoose.Types.ObjectId(ownerId),
    status: "succeeded",
    createdAt: { $gte: startDate, $lte: endDate },
  }).lean(),

  // Vendas falhadas (para calcular taxa de aprovação)
  Sale.find({
    ownerId: new mongoose.Types.ObjectId(ownerId),
    status: "failed",
    createdAt: { $gte: startDate, $lte: endDate },
  }).lean(),

  // Métricas de checkout
  CheckoutMetric.find({ /* ... */ }).lean(),
]);
```

#### Cálculo da Taxa de Aprovação (linhas 450-453)

```typescript
// NOVA MÉTRICA: Taxa de Aprovação de Pagamentos (Aprovados / Total de Tentativas)
const totalFailedSales = allFailedSales.length;
const totalPaymentAttempts = totalSales + totalFailedSales; // Total de tentativas de pagamento
const paymentApprovalRate = totalPaymentAttempts > 0 ? (totalSales / totalPaymentAttempts) * 100 : 0;
```

#### Período Anterior para Comparação (linhas 600-658)

```typescript
const [previousSales, previousFailedSales, previousMetrics] = await Promise.all([
  Sale.find({ status: "succeeded", /* ... */ }).lean(),
  Sale.find({ status: "failed", /* ... */ }).lean(), // NOVO
  CheckoutMetric.find({ /* ... */ }).lean(),
]);

// Taxa de aprovação de pagamentos do período anterior
const previousTotalFailedSales = previousFailedSales.length;
const previousTotalPaymentAttempts = previousTotalSales + previousTotalFailedSales;
const previousPaymentApprovalRate = previousTotalPaymentAttempts > 0
  ? (previousTotalSales / previousTotalPaymentAttempts) * 100
  : 0;
```

#### Resposta da API (linhas 666-692)

**Novos campos retornados:**
```typescript
res.status(200).json({
  kpis: {
    // ... campos existentes ...

    // NOVA MÉTRICA: Taxa de Aprovação de Pagamentos
    paymentApprovalRate, // % de pagamentos aprovados do total de tentativas
    totalPaymentAttempts, // Total de tentativas (aprovadas + negadas)
    totalFailedPayments: totalFailedSales, // Total de pagamentos negados

    // ... outras métricas ...

    // Comparação com período anterior
    paymentApprovalRateChange: calculateChangePercentage(paymentApprovalRate, previousPaymentApprovalRate),
  },
  // ...
});
```

---

## Fluxo Completo

### 1. Cliente Tenta Fazer Pagamento
- Frontend chama `POST /api/payments/create-intent`
- Backend cria PaymentIntent no Stripe
- Cliente confirma pagamento no Stripe Elements

### 2a. Pagamento Aprovado (Fluxo Existente)
```
Stripe → payment_intent.succeeded webhook
  → handlePaymentIntentSucceeded()
    → Sale.create({ status: "succeeded", ... })
    → Envia Purchase para Facebook
    → Envia webhooks (UTMfy, Membership, etc.)
```

### 2b. Pagamento Negado (Novo Fluxo)
```
Stripe → payment_intent.payment_failed webhook
  → handlePaymentIntentFailed()
    → Sale.create({
        status: "failed",
        failureReason: "card_declined",
        failureMessage: "Your card was declined",
        ...
      })
    → Log detalhado do erro
```

### 3. Dashboard Calcula Métricas
```typescript
// Busca todas as vendas (aprovadas + negadas)
const approvedSales = await Sale.find({ status: "succeeded" });
const failedSales = await Sale.find({ status: "failed" });

// Calcula taxa de aprovação
const totalAttempts = approvedSales.length + failedSales.length;
const approvalRate = (approvedSales.length / totalAttempts) * 100;

// Exemplo: 85 aprovadas + 15 negadas = 85% de aprovação
```

---

## Exemplos de Erros Capturados

### Códigos Comuns de Erro do Stripe:

| `failureReason` | Descrição |
|-----------------|-----------|
| `card_declined` | Cartão recusado pelo banco |
| `insufficient_funds` | Fundos insuficientes |
| `expired_card` | Cartão expirado |
| `incorrect_cvc` | CVC incorreto |
| `processing_error` | Erro de processamento |
| `authentication_required` | Requer autenticação 3D Secure |
| `fraudulent` | Transação marcada como fraude |

### Exemplo de Registro no Banco:

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "ownerId": "507f191e810c19729de860ea",
  "offerId": "507f191e810c19729de860eb",
  "stripePaymentIntentId": "pi_3abc123xyz",
  "customerEmail": "cliente@email.com",
  "customerName": "João Silva",
  "totalAmountInCents": 9990,
  "platformFeeInCents": 0,
  "status": "failed",
  "failureReason": "card_declined",
  "failureMessage": "Your card was declined",
  "items": [
    {
      "name": "Produto Principal",
      "priceInCents": 9990,
      "isOrderBump": false
    }
  ],
  "createdAt": "2025-11-28T10:30:00.000Z"
}
```

---

## Métricas Disponíveis no Dashboard

### KPIs Atuais:

1. **Visitantes** (`totalVisitors`)
2. **Checkouts Iniciados** (`checkoutsInitiated`)
3. **Vendas Aprovadas** (`totalSales`)
4. **Vendas Negadas** (`totalFailedPayments`) 🆕
5. **Total de Tentativas** (`totalPaymentAttempts`) 🆕

### Taxas Calculadas:

1. **Taxa de Conversão** (Visitantes → Vendas)
   ```
   (totalSales / totalVisitors) * 100
   ```

2. **Taxa de Checkout** (Iniciados → Vendas)
   ```
   (totalSales / checkoutsInitiated) * 100
   ```

3. **Taxa de Aprovação** (Tentativas → Aprovados) 🆕
   ```
   (totalSales / totalPaymentAttempts) * 100
   ```

### Exemplo de Funil Completo:

```
1000 Visitantes
  ↓ (40% taxa de iniciação de checkout)
400 Checkouts Iniciados
  ↓ (75% taxa de envio de pagamento)
300 Tentativas de Pagamento
  ↓ (85% taxa de aprovação) ← NOVA MÉTRICA
255 Vendas Aprovadas
45 Vendas Negadas
  ↓
Taxa de Conversão Final: 25.5% (255/1000)
```

---

## Como Testar

### 1. Simular Pagamento Aprovado
```bash
# Cartão de teste do Stripe
4242 4242 4242 4242
```
**Resultado:** Cria Sale com `status: "succeeded"`

### 2. Simular Pagamento Negado
```bash
# Cartão que sempre é recusado
4000 0000 0000 0002
```
**Resultado:** Cria Sale com `status: "failed"`, `failureReason: "card_declined"`

### 3. Simular Fundos Insuficientes
```bash
4000 0000 0000 9995
```
**Resultado:** `failureReason: "insufficient_funds"`

### 4. Verificar no Dashboard
```
GET /api/metrics/dashboard-overview?days=7
```

**Resposta esperada:**
```json
{
  "kpis": {
    "totalSales": 85,
    "totalFailedPayments": 15,
    "totalPaymentAttempts": 100,
    "paymentApprovalRate": 85.0,
    "paymentApprovalRateChange": 5.2
  }
}
```

---

## Logs do Sistema

### Pagamento Aprovado:
```
✅ Pagamento APROVADO
✅ Venda 507f1f77bcf86cd799439011 salva com sucesso.
🔵 Enviando evento Facebook Purchase para 2 pixel(s)
```

### Pagamento Negado:
```
❌ Pagamento FALHOU - Processando...
❌ Pagamento FALHOU: pi_3abc123xyz
   - Cliente: cliente@email.com
   - Valor: 99.90 BRL
   - Motivo: card_declined
   - Mensagem: Your card was declined
✅ Tentativa de venda falhada 507f1f77bcf86cd799439011 registrada no banco.
```

---

## Vantagens da Implementação

1. **Visibilidade Total**: Rastreia 100% das tentativas de pagamento
2. **Diagnóstico**: Identifica motivos específicos de falhas
3. **Otimização**: Permite melhorar a taxa de aprovação
4. **Tendências**: Comparação com período anterior
5. **Segurança**: Detecta padrões de fraude
6. **Compliance**: Registro completo para auditoria

---

## Arquivos Modificados

1. `api/src/models/sale.model.ts` - Lines 29-31, 66-73
2. `api/src/webhooks/stripe/handlers/payment-intent.handler.ts` - Lines 11-175 (nova função)
3. `api/src/webhooks/stripe/handlers/index.ts` - Lines 1-20
4. `api/src/controllers/metrics.controller.ts` - Lines 393-416, 450-453, 600-658, 666-692

---

## Próximos Passos (Sugestões)

### 1. Dashboard Frontend
- Adicionar card com "Taxa de Aprovação de Pagamentos"
- Gráfico de aprovação vs negação ao longo do tempo
- Lista de motivos mais comuns de falha

### 2. Alertas
- Notificação quando taxa de aprovação cair abaixo de threshold
- Email para vendedor quando muitos pagamentos falharem

### 3. Análise Avançada
- Segmentação por tipo de cartão (Visa, Mastercard, etc.)
- Taxa de aprovação por país
- Horários com maior taxa de falha

### 4. Retry Automático
- Sistema de retry inteligente para alguns tipos de erro
- Link de "tentar novamente" para cliente

---

## Conclusão

O sistema agora possui **rastreamento completo de todas as tentativas de pagamento**, permitindo:

✅ Cálculo preciso da taxa de aprovação
✅ Identificação de problemas no gateway
✅ Otimização da conversão de pagamentos
✅ Análise detalhada de motivos de falha

**Status:** Pronto para produção 🚀
