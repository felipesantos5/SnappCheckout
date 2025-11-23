# ---- Estágio 1: Build (Compilação) ----
FROM node:20-slim AS builder
WORKDIR /app

# Copia package.json E yarn.lock
COPY package.json yarn.lock ./

# Instala dependências usando Yarn (respeitando o lockfile)
RUN yarn install --frozen-lockfile

# Copia o resto do código
COPY . .

# Roda o build
RUN yarn build

# ---- Estágio 2: Produção ----
FROM node:20-slim
WORKDIR /app

COPY package.json yarn.lock ./

# Instala apenas dependências de produção
RUN yarn install --production --frozen-lockfile

# Copia o build do estágio anterior
COPY --from=builder /app/dist ./dist

EXPOSE 4242

# Inicia usando yarn ou node direto
CMD ["yarn", "start"]