# Card de Faturamento Total da Oferta

## Data: 2025-11-28

## Contexto
Adicionado card destacado na página de analytics mostrando o **faturamento total histórico** de uma oferta específica, sem filtro de data.

---

## Objetivo

Permitir que o vendedor veja rapidamente quanto uma oferta faturou **desde sua criação**, independente dos filtros de data aplicados nos outros cards.

### Diferença entre os cards:

| Card | Descrição | Filtro de Data |
|------|-----------|----------------|
| **Faturamento Total** 🆕 | Receita desde a criação da oferta | ❌ Nenhum (histórico completo) |
| **Vendas Aprovadas** | Vendas no período selecionado | ✅ Sim (hoje, 7 dias, 30 dias, personalizado) |

---

## Implementação

### 1. **Backend - Novo Endpoint**

**Arquivo:** `api/src/controllers/metrics.controller.ts`

#### Nova Função: `handleGetOfferTotalRevenue` (linhas 350-399)

```typescript
/**
 * Retorna o faturamento total de uma oferta específica (histórico completo)
 * Protegido: Apenas para o dono da oferta
 */
export const handleGetOfferTotalRevenue = async (req: Request, res: Response) => {
  try {
    const ownerId = req.userId!;
    const offerId = req.query.offerId as string;

    if (!offerId) {
      return res.status(400).json({ error: "offerId é obrigatório" });
    }

    // Verifica se a oferta pertence ao usuário
    const offer = await Offer.findOne({ _id: offerId, ownerId });
    if (!offer) {
      return res.status(404).json({ error: "Oferta não encontrada" });
    }

    // Busca TODAS as vendas aprovadas dessa oferta (sem filtro de data)
    const sales = await Sale.find({
      offerId: new mongoose.Types.ObjectId(offerId),
      status: "succeeded",
    })
      .select("totalAmountInCents currency")
      .lean();

    // Calcula o faturamento total convertido para BRL
    let totalRevenueInBRL = 0;
    await Promise.all(
      sales.map(async (sale) => {
        const amountInBRL = await convertToBRL(sale.totalAmountInCents, sale.currency || "BRL");
        totalRevenueInBRL += amountInBRL;
      })
    );

    const totalSales = sales.length;

    res.status(200).json({
      offerId,
      offerName: offer.name,
      totalRevenue: totalRevenueInBRL, // Em centavos BRL
      totalSales,
      averageTicket: totalSales > 0 ? totalRevenueInBRL / totalSales : 0,
    });
  } catch (error) {
    console.error("Erro ao buscar faturamento total da oferta:", error);
    res.status(500).json({ error: { message: (error as Error).message } });
  }
};
```

**Características:**
- ✅ Sem filtro de data - busca TODAS as vendas
- ✅ Apenas vendas aprovadas (`status: "succeeded"`)
- ✅ Conversão automática para BRL
- ✅ Calcula ticket médio histórico
- ✅ Validação de propriedade da oferta

---

### 2. **Backend - Nova Rota**

**Arquivo:** `api/src/routes/metrics.routes.ts` (linha 17)

```typescript
router.get("/offer-total-revenue", protectRoute, metricsController.handleGetOfferTotalRevenue);
```

**Endpoint:**
```
GET /api/metrics/offer-total-revenue?offerId=507f1f77bcf86cd799439011
```

**Resposta:**
```json
{
  "offerId": "507f1f77bcf86cd799439011",
  "offerName": "Curso de JavaScript",
  "totalRevenue": 1250000,
  "totalSales": 125,
  "averageTicket": 10000
}
```

**Valores em centavos:**
- `totalRevenue`: 1.250.000 centavos = R$ 12.500,00
- `averageTicket`: 10.000 centavos = R$ 100,00

---

### 3. **Frontend - Interface TypeScript**

**Arquivo:** `admin/src/pages/dashboard/OfferAnalyticsPage.tsx` (linhas 28-34)

```typescript
interface TotalRevenueData {
  offerId: string;
  offerName: string;
  totalRevenue: number;     // Em centavos BRL
  totalSales: number;        // Total de vendas aprovadas
  averageTicket: number;     // Em centavos BRL
}
```

---

### 4. **Frontend - State Management**

**Arquivo:** `admin/src/pages/dashboard/OfferAnalyticsPage.tsx` (linhas 42, 112-134)

#### Estado:
```typescript
const [totalRevenueData, setTotalRevenueData] = useState<TotalRevenueData | null>(null);
```

#### useEffect para buscar dados:
```typescript
useEffect(() => {
  const fetchTotalRevenue = async () => {
    if (!token || !id) return;

    try {
      const response = await fetch(`${API_URL}/metrics/offer-total-revenue?offerId=${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Falha ao buscar faturamento total");

      const totalData: TotalRevenueData = await response.json();
      setTotalRevenueData(totalData);
    } catch (err) {
      console.error("Erro ao buscar faturamento total:", err);
      // Não exibe erro para não quebrar a página
    }
  };

  fetchTotalRevenue();
}, [token, id]);
```

**Características:**
- Executa uma vez quando a página carrega
- Independente dos filtros de data
- Não quebra a página se falhar (fail-safe)

---

### 5. **Frontend - Card Visual**

**Arquivo:** `admin/src/pages/dashboard/OfferAnalyticsPage.tsx` (linhas 205-220)

```tsx
{/* Card de Faturamento Total (Histórico Completo) */}
{totalRevenueData && (
  <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-green-800">
        Faturamento Total da Oferta
      </CardTitle>
      <DollarSign className="h-5 w-5 text-green-600" />
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-green-700">
        {formatCurrency(totalRevenueData.totalRevenue / 100)}
      </div>
      <p className="text-xs text-green-600 mt-1">
        {totalRevenueData.totalSales} vendas aprovadas • Ticket médio: {formatCurrency(totalRevenueData.averageTicket / 100)}
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        📊 Histórico completo desde a criação da oferta
      </p>
    </CardContent>
  </Card>
)}
```

**Design:**
- ✅ Borda verde para destaque
- ✅ Gradiente verde suave no background
- ✅ Ícone de dólar
- ✅ Valor grande e destacado
- ✅ Informações secundárias (vendas e ticket médio)
- ✅ Legenda explicativa

---

## Layout na Página

```
┌─────────────────────────────────────────────────────┐
│ Header (Nome da oferta + Filtros de data)          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 💚 FATURAMENTO TOTAL DA OFERTA                      │ ← NOVO CARD
│ R$ 12.500,00                                        │
│ 125 vendas aprovadas • Ticket médio: R$ 100,00     │
│ 📊 Histórico completo desde a criação da oferta    │
└─────────────────────────────────────────────────────┘

┌─────────┬─────────┬─────────┬─────────┐
│ Views   │ Checkout│ Vendas  │ Conv %  │ ← Cards filtrados por data
└─────────┴─────────┴─────────┴─────────┘

┌─────────────────────────────────────────────────────┐
│ Gráfico de Funil                                    │
└─────────────────────────────────────────────────────┘
```

---

## Exemplo Visual

### Card Renderizado:

```
╔═══════════════════════════════════════════════════╗
║ Faturamento Total da Oferta              💲      ║
║                                                   ║
║ R$ 12.500,00                                     ║
║                                                   ║
║ 125 vendas aprovadas • Ticket médio: R$ 100,00  ║
║ 📊 Histórico completo desde a criação da oferta  ║
╚═══════════════════════════════════════════════════╝
```

**Cores:**
- Borda: Verde claro (`border-green-200`)
- Background: Gradiente verde (`from-green-50 to-emerald-50`)
- Título: Verde escuro (`text-green-800`)
- Valor: Verde forte (`text-green-700`)
- Ícone: Verde médio (`text-green-600`)

---

## Fluxo Completo

### 1. Usuário Acessa a Página
```
GET /offers/507f1f77bcf86cd799439011/analytics
```

### 2. Frontend Faz 2 Requisições Paralelas

**Requisição 1:** Métricas filtradas por data
```
GET /api/metrics/funnel?startDate=2025-11-01&endDate=2025-11-28
```

**Requisição 2:** Faturamento total (histórico completo)
```
GET /api/metrics/offer-total-revenue?offerId=507f1f77bcf86cd799439011
```

### 3. Backend Processa

**Para faturamento total:**
```typescript
// 1. Valida que a oferta pertence ao usuário
const offer = await Offer.findOne({ _id: offerId, ownerId });

// 2. Busca TODAS as vendas aprovadas (sem filtro de data)
const sales = await Sale.find({
  offerId: offerId,
  status: "succeeded",
});

// 3. Calcula total convertendo para BRL
let totalRevenueInBRL = 0;
for (const sale of sales) {
  totalRevenueInBRL += await convertToBRL(sale.totalAmountInCents, sale.currency);
}

// 4. Retorna dados
return {
  totalRevenue: totalRevenueInBRL,
  totalSales: sales.length,
  averageTicket: totalRevenueInBRL / sales.length,
};
```

### 4. Frontend Renderiza

```tsx
// Card só aparece se houver dados
{totalRevenueData && (
  <Card className="...verde...">
    {formatCurrency(totalRevenueData.totalRevenue / 100)}
  </Card>
)}
```

---

## Casos de Uso

### Caso 1: Oferta Nova (sem vendas)
```json
{
  "totalRevenue": 0,
  "totalSales": 0,
  "averageTicket": 0
}
```
**Renderização:**
```
R$ 0,00
0 vendas aprovadas • Ticket médio: R$ 0,00
```

### Caso 2: Oferta com 100 vendas de R$ 99,90
```json
{
  "totalRevenue": 999000,
  "totalSales": 100,
  "averageTicket": 9990
}
```
**Renderização:**
```
R$ 9.990,00
100 vendas aprovadas • Ticket médio: R$ 99,90
```

### Caso 3: Oferta com vendas em múltiplas moedas
```
Vendas:
- 50x R$ 100,00 (BRL)
- 30x $50,00 (USD cotação: R$ 5,00)

Total em BRL:
- BRL: 50 × 100 = R$ 5.000,00
- USD: 30 × 50 × 5 = R$ 7.500,00
- TOTAL: R$ 12.500,00
```

---

## Diferenças Importantes

### Card de Faturamento Total vs Card de Vendas Aprovadas

| Aspecto | Faturamento Total | Vendas Aprovadas |
|---------|-------------------|------------------|
| **Período** | Desde a criação | Filtro de data ativo |
| **Descrição** | "Histórico completo" | "Receita: R$ X" |
| **Visual** | Verde destacado | Cinza padrão |
| **Posição** | Topo (card isolado) | Grid com outros KPIs |
| **Atualização** | Na montagem da página | Quando muda o filtro |

---

## Segurança

### Validações Implementadas:

1. **Autenticação:**
   ```typescript
   router.get("/offer-total-revenue", protectRoute, ...);
   ```

2. **Autorização:**
   ```typescript
   const offer = await Offer.findOne({ _id: offerId, ownerId });
   if (!offer) return res.status(404).json({ error: "Oferta não encontrada" });
   ```

3. **Validação de Parâmetros:**
   ```typescript
   if (!offerId) {
     return res.status(400).json({ error: "offerId é obrigatório" });
   }
   ```

**Proteções:**
- ✅ Usuário só vê faturamento de suas próprias ofertas
- ✅ Token JWT obrigatório
- ✅ Validação de propriedade no banco de dados

---

## Performance

### Otimizações:

1. **Query eficiente:**
   ```typescript
   .select("totalAmountInCents currency") // Busca apenas campos necessários
   .lean() // Retorna objeto JavaScript puro (mais rápido)
   ```

2. **Conversão paralela:**
   ```typescript
   await Promise.all(sales.map(async (sale) => { ... }))
   ```

3. **Cache no frontend:**
   - Dados carregados uma vez
   - Não recarrega ao mudar filtro de data dos outros cards

---

## Testes

### 1. Teste Manual - Backend
```bash
# Com token válido
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:4242/api/metrics/offer-total-revenue?offerId=507f1f77bcf86cd799439011"
```

**Resposta esperada:**
```json
{
  "offerId": "507f1f77bcf86cd799439011",
  "offerName": "Minha Oferta",
  "totalRevenue": 500000,
  "totalSales": 50,
  "averageTicket": 10000
}
```

### 2. Teste Manual - Frontend
1. Acesse `/offers/{id}/analytics`
2. Verifique se o card verde aparece no topo
3. Mude o filtro de data
4. Confirme que o card verde **não muda**
5. Verifique que os outros cards **mudam**

### 3. Teste de Erro
```bash
# Tentar acessar oferta de outro usuário
curl -H "Authorization: Bearer <TOKEN_USER_A>" \
  "http://localhost:4242/api/metrics/offer-total-revenue?offerId=<OFFER_USER_B>"
```

**Resposta esperada:**
```json
{
  "error": "Oferta não encontrada"
}
```

---

## Arquivos Modificados

1. `api/src/controllers/metrics.controller.ts` - Lines 350-399 (nova função)
2. `api/src/routes/metrics.routes.ts` - Line 17 (nova rota)
3. `admin/src/pages/dashboard/OfferAnalyticsPage.tsx` - Lines 9, 28-34, 42, 112-134, 205-220

---

## Próximas Melhorias (Sugestões)

1. **Gráfico de Evolução Temporal:**
   - Faturamento acumulado ao longo do tempo
   - Linha de tendência

2. **Breakdown por Produto:**
   - Quanto veio do produto principal
   - Quanto veio dos order bumps
   - Quanto veio de upsells

3. **Comparação com Metas:**
   - Meta mensal definida pelo usuário
   - Progresso em porcentagem
   - Projeção baseada na média diária

4. **Export de Dados:**
   - Botão para baixar CSV com todas as vendas
   - Relatório em PDF

---

## Conclusão

O card de **Faturamento Total** agora está disponível na página de analytics, mostrando:

✅ Receita total histórica da oferta
✅ Total de vendas aprovadas
✅ Ticket médio histórico
✅ Visual destacado em verde
✅ Independente dos filtros de data

**Status:** Implementado e funcional 🚀
