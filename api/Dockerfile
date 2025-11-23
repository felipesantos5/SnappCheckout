#
# ---- Estágio 1: Build (Compilação) ----
# Usamos a imagem node completa como 'builder'
FROM node:20-slim AS builder
WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./

# Instala TODAS as dependências (incluindo devDependencies como 'typescript')
RUN npm install

# Copia o resto do código-fonte (src, tsconfig.json, etc)
COPY . .

# Roda o script de build (que executa "npx tsc")
RUN npm run build

# O resultado compilado estará em /app/dist

# ---- Estágio 2: Produção ----
# Começa de uma imagem limpa
FROM node:20-slim
WORKDIR /app

# Copia os package.json de novo
COPY package*.json ./

# Instala APENAS dependências de produção
# Isso torna a imagem final muito menor
RUN npm install --omit=dev

# Copia o código compilado (dist) do estágio 'builder'
COPY --from=builder /app/dist ./dist

# Exponha a porta
EXPOSE 4242

# Executa o JavaScript compilado
# O script "start" do seu package.json já é "node dist/server.js"
CMD ["npm", "start"]