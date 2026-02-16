#!/bin/sh
# healthcheck.sh - Script de verificação de saúde para Docker healthcheck
# Retorna 0 (sucesso) se saudável, 1 (falha) se não saudável
#
# Além de reportar ao Docker, este script também age como última linha de defesa:
# Se detectar muitas falhas consecutivas, força kill do processo Node.js
# para que o Docker restart policy traga o container de volta.

TIMEOUT=5
URL="http://localhost:4242/health"
FAIL_FILE="/tmp/healthcheck_failures"

# Inicializa arquivo de falhas se não existe
if [ ! -f "$FAIL_FILE" ]; then
    echo "0" > "$FAIL_FILE"
fi

# Faz a requisição e captura código de status
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$URL" 2>/dev/null)
CURL_EXIT=$?

# Determina se a checagem passou
if [ $CURL_EXIT -eq 0 ] && [ "$HTTP_CODE" = "200" ]; then
    # Sucesso - reseta contador de falhas
    echo "0" > "$FAIL_FILE"
    echo "HEALTHY: HTTP $HTTP_CODE"
    exit 0
fi

# Falha - incrementa contador
FAILURES=$(cat "$FAIL_FILE" 2>/dev/null || echo "0")
FAILURES=$((FAILURES + 1))
echo "$FAILURES" > "$FAIL_FILE"

# Se curl falhou completamente (processo não responde)
if [ $CURL_EXIT -ne 0 ]; then
    echo "UNHEALTHY: Falha ao conectar (curl exit=$CURL_EXIT) - falha $FAILURES consecutiva(s)"
else
    echo "UNHEALTHY: HTTP $HTTP_CODE - falha $FAILURES consecutiva(s)"
fi

# ÚLTIMA LINHA DE DEFESA: Se muitas falhas consecutivas,
# significa que o watchdog interno e o autoheal falharam.
# Força kill do processo Node.js para que Docker restart policy aja.
# 20 falhas * 15s intervalo = 5 minutos de falha contínua
if [ "$FAILURES" -ge 20 ]; then
    echo "CRITICAL: $FAILURES falhas consecutivas - forçando kill do processo Node.js"
    echo "0" > "$FAIL_FILE"
    # Kill all node processes inside the container
    killall -9 node 2>/dev/null || true
fi

exit 1
