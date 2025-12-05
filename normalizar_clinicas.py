import pandas as pd
import numpy as np

# ============================
# CONFIG
# ============================
INPUT_FILE = "DIREX GEAP Credenciados CSV Template 2208 - com especialidades.xlsx"
OUTPUT_FILE = "clinicas_supabase_final.csv"

# ============================
# CARREGAR ABAS
# ============================
cred_esp = pd.read_excel(INPUT_FILE, sheet_name="Credenciados + Especialidade")
unid = pd.read_excel(INPUT_FILE, sheet_name="Unidades")

# ============================
# BASE PRINCIPAL = TODAS AS CLÍNICAS
# (uma por CNPJ, vindo da aba Credenciados + Especialidade)
# ============================
cred_esp_uniq = cred_esp.drop_duplicates(subset=["CNPJ (só números)"]).copy()

cred_esp_uniq.rename(columns={
    "CNPJ (só números)": "cnpj",
    "Razão Social": "razao_social",
    "Nome Fantasia": "nome_fantasia",
    "Logradouro do Endereço Fiscal": "logr_fiscal",
    "Número do Endereço Fiscal": "num_fiscal",
    "Complemento do Endereço Fiscal": "compl_fiscal",
    "Bairro do Endereço Fiscal": "bairro_fiscal",
    "Cidade do Endereço Fiscal": "cidade_fiscal",
    "UF do Endereço Fiscal": "uf_fiscal",
    "Telefone do contato responsável": "tel_resp",
    "E-mail do contato responsável": "email_resp",
}, inplace=True)

# ============================
# BASE DE UNIDADES = COMPLEMENTO (lat/long, telefone, etc.)
# ============================
unid.rename(columns={
    "CNPJ (só números)": "cnpj",
    "Logradouro": "logr_unid",
    "Número": "num_unid",
    "Complemento": "compl_unid",
    "Bairro": "bairro_unid",
    "Cidade": "cidade_unid",
    "UF (sigla)": "uf_unid",
    "Latitude (opcional), exemplo: -22.4353231": "latitude",
    "Longitude (opcional), exemplo: -22.4353231": "longitude",
    "Telefones contato (padrão DDD+número com 8 ou 9 dígitos, separado por vírgula exemplo: 11998732214, 1940142526)": "tel_unid",
    "E-mails (lista separada por vírgula)": "email_unid"
}, inplace=True)

cred_esp_uniq["cnpj"] = cred_esp_uniq["cnpj"].astype(str)
unid["cnpj"] = unid["cnpj"].astype(str)

# Se tiver mais de uma unidade por CNPJ, pega só a primeira
unid_uniq = unid.drop_duplicates(subset=["cnpj"]).copy()

# ============================
# MERGE: TODAS AS CLÍNICAS + DADOS DAS UNIDADES (QUANDO EXISTIR)
# ============================
merged = cred_esp_uniq.merge(unid_uniq, on="cnpj", how="left")

# ============================
# FUNÇÕES DE LIMPEZA / COALESCE
# ============================
def clean(col):
    return col.fillna("").astype(str).replace("nan", "").replace("NaN", "")

for col in [
    "logr_unid","num_unid","compl_unid","bairro_unid","cidade_unid","uf_unid",
    "logr_fiscal","num_fiscal","compl_fiscal","bairro_fiscal","cidade_fiscal","uf_fiscal",
    "tel_unid","email_unid","tel_resp","email_resp"
]:
    if col in merged.columns:
        merged[col] = clean(merged[col])

def coalesce(row, cols):
    for c in cols:
        v = row.get(c, "")
        if v not in ("", "nan", "NaN"):
            return v
    return ""

# Preferência: dados da aba Unidades, senão da aba Credenciados + Especialidade
merged["logradouro"]  = merged.apply(lambda r: coalesce(r, ["logr_unid","logr_fiscal"]), axis=1)
merged["numero"]      = merged.apply(lambda r: coalesce(r, ["num_unid","num_fiscal"]), axis=1)
merged["complemento"] = merged.apply(lambda r: coalesce(r, ["compl_unid","compl_fiscal"]), axis=1)
merged["bairro"]      = merged.apply(lambda r: coalesce(r, ["bairro_unid","bairro_fiscal"]), axis=1)
merged["cidade"]      = merged.apply(lambda r: coalesce(r, ["cidade_unid","cidade_fiscal"]), axis=1)
merged["uf"]          = merged.apply(lambda r: coalesce(r, ["uf_unid","uf_fiscal"]), axis=1)
merged["telefone"]    = merged.apply(lambda r: coalesce(r, ["tel_unid","tel_resp"]), axis=1)
merged["email"]       = merged.apply(lambda r: coalesce(r, ["email_unid","email_resp"]), axis=1)

# lat/long numéricas
merged["latitude"] = pd.to_numeric(merged.get("latitude", np.nan), errors="coerce")
merged["longitude"] = pd.to_numeric(merged.get("longitude", np.nan), errors="coerce")

# ============================
# ENDEREÇO COMPLETO
# ============================
def build_endereco(row):
    parts = []
    if row["logradouro"]:
        parts.append(str(row["logradouro"]))
    if row["numero"]:
        parts.append(str(row["numero"]))
    if row["bairro"]:
        parts.append(str(row["bairro"]))
    if row["cidade"]:
        parts.append(str(row["cidade"]))
    if row["uf"]:
        parts.append(str(row["uf"]).upper())
    if not parts:
        return ""
    return ", ".join(parts) + ", Brasil"

merged["endereco_completo"] = merged.apply(build_endereco, axis=1)

# ============================
# TABELA FINAL NO FORMATO DO SUPABASE
# ============================
final = merged[[
    "cnpj",
    "razao_social",
    "nome_fantasia",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "uf",
    "telefone",
    "email",
    "latitude",
    "longitude",
    "endereco_completo",
]]

final.to_csv(OUTPUT_FILE, index=False, encoding="utf-8-sig")

print("\n🎉 CSV FINAL GERADO COM SUCESSO!")
print(f"Arquivo: {OUTPUT_FILE}")
print(f"Linhas: {len(final)}")
