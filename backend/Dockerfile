# backend/Dockerfile

# ---- Estágio 1: Build (Compilação) ----
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

# ---- Estágio 2: Produção ----
FROM node:20-slim
WORKDIR /app

# Instala curl para healthcheck e dumb-init para melhor handling de sinais
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./

RUN yarn install --production --frozen-lockfile

COPY --from=builder /app/dist ./dist

# Copia e configura script de healthcheck
COPY healthcheck.sh /healthcheck.sh
RUN chmod +x /healthcheck.sh

EXPOSE 4242

# Usa dumb-init para melhor propagação de sinais (SIGTERM, etc)
# Isso garante que o Node.js receba os sinais corretamente para graceful shutdown
ENTRYPOINT ["dumb-init", "--"]
CMD ["yarn", "start"]