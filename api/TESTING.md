# 🧪 Guia de Testes - Sistema de Pagamentos

Este documento explica como garantir que o sistema de checkout está funcionando corretamente e pronto para processar pagamentos.

## 🎯 Por que testar?

O fluxo de pagamento é **CRÍTICO**. Um bug aqui significa:
- ❌ Perda de vendas
- ❌ Clientes frustrados
- ❌ Dinheiro perdido

Por isso, temos múltiplas camadas de testes.

---

## 📋 Tipos de Testes

### 1. **Teste Rápido (30 segundos)** ⚡

Execute antes de fazer deploy ou quando suspeitar de problemas:

```bash
node scripts/test-payment-flow.js
```

**O que verifica:**
- ✅ API está online
- ✅ MongoDB conectado
- ✅ Stripe respondendo
- ✅ Checkout acessível
- ✅ Variáveis de ambiente configuradas

**Quando usar:**
- Antes de fazer deploy
- Após mudanças no código de pagamento
- Debugging de problemas

---

### 2. **Health Check Endpoint** 🏥

Monitore continuamente a saúde do sistema:

```bash
curl http://localhost:4242/api/health
```

**Resposta esperada:**
```json
{
  "status": "healthy",
  "checks": {
    "database": { "status": "up", "responseTime": 15 },
    "stripe": { "status": "up", "responseTime": 234 },
    "payments": {
      "status": "operational",
      "canProcessPayments": true
    }
  }
}
```

**Integre com monitoramento:**
- UptimeRobot
- Pingdom
- New Relic
- Datadog

Configure alertas se `canProcessPayments: false`!

---

### 3. **Testes E2E (End-to-End)** 🤖

Simula um cliente real completando uma compra.

#### Instalação:

```bash
cd checkout
npm install -D @playwright/test
npx playwright install chromium
```

#### Executar:

```bash
# Roda todos os testes E2E
npm run test:e2e

# Roda apenas o teste crítico de pagamento
npx playwright test checkout.spec.ts

# Modo debug (com interface visual)
npx playwright test --debug

# Modo headed (vê o browser funcionando)
npx playwright test --headed
```

#### O que testa:

✅ Carregamento da página
✅ Validação de formulário
✅ **Processamento de pagamento com cartão de teste**
✅ Rejeição de cartão inválido
✅ Cálculo de total com order bumps
✅ Performance (< 3 segundos para carregar)
✅ Resiliência a perda de conexão

**IMPORTANTE:** Este é o teste mais próximo da experiência real do cliente!

---

### 4. **Testes de API** 🔌

Testa os endpoints de pagamento diretamente.

#### Instalação:

```bash
cd api
npm install -D jest supertest @types/jest @types/supertest
```

#### Executar:

```bash
npm run test
```

#### O que testa:

✅ Criação de Payment Intent
✅ Validação de oferta inexistente
✅ Cálculo correto de total com bumps
✅ Aplicação de taxa de 5%
✅ Processamento de webhooks
✅ Tratamento de erros e timeouts

---

## 🎴 Cartões de Teste (Stripe)

**Para TESTES, use chave `pk_test_...` e estes cartões:**

| Cenário | Número do Cartão | Resultado |
|---------|------------------|-----------|
| ✅ Sucesso | `4242 4242 4242 4242` | Sempre aprovado |
| ❌ Recusado | `4000 0000 0000 0002` | Sempre recusado |
| 🔐 3D Secure | `4000 0025 0000 3155` | Requer autenticação |
| 💳 Insufficient | `4000 0000 0000 9995` | Saldo insuficiente |

**Dados adicionais (qualquer valor funciona):**
- Validade: Qualquer data futura (ex: 12/34)
- CVC: Qualquer 3 dígitos (ex: 123)
- CEP: Qualquer 5 dígitos (ex: 12345)

⚠️ **NUNCA use cartões reais em modo teste!**

---

## 🚀 Estratégia de Teste Recomendada

### Antes de Fazer Deploy:

1. **Execute teste rápido:**
   ```bash
   node scripts/test-payment-flow.js
   ```

2. **Se passou, execute testes E2E:**
   ```bash
   cd checkout && npm run test:e2e
   ```

3. **Teste manual (5 minutos):**
   - Abra checkout real
   - Use cartão `4242 4242 4242 4242`
   - Complete uma compra de teste
   - Verifique se apareceu em /sales

### Monitoramento Contínuo (Produção):

Configure alerts no seu monitoramento para:

```bash
# A cada 5 minutos
curl https://api.seusistema.com/api/health/payments
```

Se retornar `"ready": false`, **ALERTAR IMEDIATAMENTE**.

---

## 🐛 Debugging de Problemas

### Problema: "Pagamento fica carregando infinito"

1. **Abra console do navegador (F12)**
2. Procure por logs `[DEBUG]` ou `[ERROR]`
3. Verifique se há erros de rede (aba Network)

**Possíveis causas:**
- Backend não está rodando (`npm run dev` na pasta api)
- Stripe key incorreta (test vs live)
- Firewall bloqueando conexão

### Problema: "Cartão sempre recusado"

**Causa mais comum:** Usando cartão de teste com chave LIVE.

**Solução:**
- Se testando: Use `pk_test_...` + cartão `4242...`
- Se produção: Use `pk_live_...` + cartão real

### Problema: "Webhook não funciona"

1. **Verifique assinatura:**
   ```bash
   echo $STRIPE_WEBHOOK_SECRET
   ```

2. **Teste local com Stripe CLI:**
   ```bash
   stripe listen --forward-to localhost:4242/api/webhooks/stripe
   ```

3. **Simule evento:**
   ```bash
   stripe trigger payment_intent.succeeded
   ```

---

## 📊 Métricas de Sucesso

**Testes devem passar:**
- ✅ 100% dos testes E2E críticos
- ✅ Health check retornando `canProcessPayments: true`
- ✅ Tempo de resposta < 2s para criar Payment Intent

**Em produção:**
- Taxa de sucesso de pagamentos: > 95%
- Tempo médio para processar: < 5s
- Uptime: > 99.9%

---

## 🆘 Precisa de Ajuda?

Se os testes estão falhando:

1. Leia os logs de erro cuidadosamente
2. Verifique o arquivo `.env`
3. Confirme que backend está rodando
4. Teste com cartão `4242 4242 4242 4242`
5. Abra um issue no GitHub com:
   - Output completo do teste
   - Screenshot do erro
   - Ambiente (test/prod)

---

## ✅ Checklist Pré-Deploy

- [ ] `node scripts/test-payment-flow.js` passou
- [ ] Testes E2E passaram
- [ ] Testei manualmente com cartão teste
- [ ] Health check configurado no monitoramento
- [ ] Webhooks validados com Stripe CLI
- [ ] Variáveis de ambiente corretas (test vs live)
- [ ] Alertas configurados para `canProcessPayments: false`

**Só faça deploy se TODOS os itens estiverem marcados!** ✅
