#!/bin/bash

# ----------------------------------------------
# CONFIGURAÇÕES
# ----------------------------------------------

PROJECT_ID="khgzapvzpropersfzenq"
FUNCTION_URL="https://$PROJECT_ID.functions.supabase.co/geocode_run_all"

# ❗ COLOQUE AQUI O SERVICE ROLE KEY (não o anon!)
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoZ3phcHZ6cHJvcGVyc2Z6ZW5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc4OTU4MiwiZXhwIjoyMDgwMzY1NTgyfQ.ImI2Hj4njAuPtNoBGAc3e_BBKCngPnpMLp76a5jPkHs"

# Lista de UF (caso queira limitar, só tirar daqui)
UFS=("AC" "AL" "AM" "AP" "BA" "CE" "DF" "ES" "GO" "MA" "MG" "MS" "MT" "PA" "PB" "PE" "PI" "PR" "RJ" "RN" "RO" "RR" "RS" "SC" "SE" "SP" "TO")

echo ""
echo "=========================w============================"
echo "     INICIANDO PROCESSO DE GEOCODIFICAÇÃO EM MASSA"
echo "====================================================="
echo ""

for UF in "${UFS[@]}"; do

  echo "▶ Chamando geocode_run_all para UF = $UF"

  curl -s -L -X POST "$FUNCTION_URL" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    --data "{\"uf\": \"$UF\"}"

  echo ""
  echo "⏳ Aguardando 5 segundos antes da próxima UF..."
  sleep 5
  echo ""
done

echo ""
echo "====================================================="
echo " FINALIZADO! TODAS AS UF FORAM PROCESSADAS COM SUCESSO."
echo "====================================================="
echo ""
