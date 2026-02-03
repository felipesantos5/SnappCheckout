#!/bin/sh
# healthcheck.sh - Script de verificação de saúde para auto-heal
# Retorna 0 (sucesso) se saudável, 1 (falha) se não saudável

# Timeout de 5 segundos para a requisição
TIMEOUT=5
URL="http://localhost:4242/health"

# Faz a requisição e captura código de status
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$URL" 2>/dev/null)

# Verifica se curl executou com sucesso
if [ $? -ne 0 ]; then
    echo "UNHEALTHY: Falha ao conectar ao servidor"
    exit 1
fi

# Verifica código de status HTTP
if [ "$HTTP_CODE" = "200" ]; then
    echo "HEALTHY: HTTP $HTTP_CODE"
    exit 0
else
    echo "UNHEALTHY: HTTP $HTTP_CODE"
    exit 1
fi
