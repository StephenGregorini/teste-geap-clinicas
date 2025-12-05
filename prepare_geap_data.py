import pandas as pd
import json
from pathlib import Path

BASE_DIR = Path(".")
DIREX_FILE = BASE_DIR / "DIREX GEAP Credenciados CSV Template 2208 - com especialidades.xlsx"
CLINICAS_JSON_CSV = BASE_DIR / "geap_clinicas_localidade_json.csv"


def canonical_label(e: str) -> str:
    """
    Normaliza o nome da especialidade (modelo 1: nome limpo).
    Ex: 'cancerologista cirurgíco' -> 'Cancerologista Cirúrgico'
        '(medicina)' -> 'Medicina'
        'alergista e imunologista' -> 'Alergista e Imunologista'
    """
    e = (e or "").strip()
    if not e:
        return e

    # Correções específicas
    if e == "(medicina)":
        return "Medicina"
    if e.lower() == "cancerologista cirurgíco":
        return "Cancerologista Cirúrgico"

    # Title-case, preservando preposições minúsculas
    s = e.lower()
    preps = {"de", "da", "do", "das", "dos", "e", "em", "para", "por"}
    words = s.split()
    norm_words = []
    for w in words:
        if w in preps:
            norm_words.append(w)
        else:
            norm_words.append(w.capitalize())
    return " ".join(norm_words)


def main():
    print("Lendo arquivos de origem...")
    cred = pd.read_excel(DIREX_FILE, sheet_name="Credenciados")
    clinicas = pd.read_csv(CLINICAS_JSON_CSV)

    # ============================
    # Juntar complemento + contato
    # ============================
    cred_subset = cred[
        [
            "CNPJ (só números)",
            "Complemento do Endereço Fiscal",
            "Telefone do contato responsável",
            "E-mail do contato responsável",
        ]
    ].copy()
    cred_subset.columns = ["cnpj", "complemento_oficial", "telefone", "email"]

    merged = clinicas.merge(cred_subset, on="cnpj", how="left")

    # Complemento final = já existente OU o do DIREX, se o primeiro estiver vazio
    merged["complemento_final"] = merged["complemento"]
    mask = merged["complemento_final"].isna() | (
        merged["complemento_final"].astype(str).str.strip() == ""
    )
    merged.loc[mask, "complemento_final"] = merged.loc[mask, "complemento_oficial"]

    # ============================
    # CSV 1: CLÍNICAS
    # ============================
    clinicas_table = merged[
        [
            "cnpj",
            "razao_social",
            "nome_fantasia",
            "logradouro",
            "numero",
            "complemento_final",
            "bairro",
            "cidade",
            "uf",
            "telefone",
            "email",
        ]
    ].copy()

    clinicas_table.rename(columns={"complemento_final": "complemento"}, inplace=True)

    # Telefone como string (sem notação científica)
    clinicas_table["telefone"] = clinicas_table["telefone"].apply(
        lambda x: "" if pd.isna(x) else str(int(x))
    )

    clinicas_table.to_csv("clinicas.csv", index=False, encoding="utf-8-sig")
    print("Gerado clinicas.csv")

    # ============================
    # CSV 2: CLÍNICAS_ESPECIALIDADES (normalizado)
    # ============================
    mapping = {}
    all_rows = []

    for _, row in merged.iterrows():
        cnpj = row["cnpj"]
        dados = row["dados_cbo"]
        if pd.isna(dados):
            continue

        try:
            obj = json.loads(dados)
        except Exception:
            continue

        for cbo, info in obj.items():
            prof = (info.get("profissao") or "").strip()
            esps = info.get("especialidades") or []
            for esp in esps:
                esp_orig = (esp or "").strip()
                if not esp_orig:
                    continue
                if esp_orig not in mapping:
                    mapping[esp_orig] = canonical_label(esp_orig)
                all_rows.append(
                    {
                        "cnpj": cnpj,
                        "cbo": cbo,
                        "profissao": prof,
                        "especialidade_original": esp_orig,
                        "especialidade": mapping[esp_orig],
                    }
                )

    espec_df = pd.DataFrame(all_rows).drop_duplicates(
        subset=["cnpj", "cbo", "especialidade"]
    )

    espec_df.to_csv(
        "clinicas_especialidades.csv", index=False, encoding="utf-8-sig"
    )
    print("Gerado clinicas_especialidades.csv")

    # ============================
    # CSV 3: DICIONÁRIO DE NORMALIZAÇÃO (auditoria)
    # ============================
    norm_rows = [
        {"especialidade_original": k, "especialidade": v}
        for k, v in sorted(mapping.items(), key=lambda kv: kv[0].lower())
    ]
    pd.DataFrame(norm_rows).to_csv(
        "especialidades_normalizadas.csv", index=False, encoding="utf-8-sig"
    )
    print("Gerado especialidades_normalizadas.csv")


if __name__ == "__main__":
    main()
