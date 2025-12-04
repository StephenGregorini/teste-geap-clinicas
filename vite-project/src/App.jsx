import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import Logo from "./assets/logo_escuro.svg";

export default function App() {
  // CAMPOS
  const [uf, setUf] = useState("");
  const [cidade, setCidade] = useState("");
  const [especialidade, setEspecialidade] = useState("");

  // LISTAS
  const [listaUFs, setListaUFs] = useState([]);
  const [listaCidades, setListaCidades] = useState([]);
  const [listaEspecialidades, setListaEspecialidades] = useState([]);

  // SUGESTÕES
  const [sugUF, setSugUF] = useState([]);
  const [sugCidade, setSugCidade] = useState([]);
  const [sugEsp, setSugEsp] = useState([]);

  // DROPDOWNS
  const [openUF, setOpenUF] = useState(false);
  const [openCidade, setOpenCidade] = useState(false);
  const [openEsp, setOpenEsp] = useState(false);

  // RESULTADOS
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);

  // REFS PARA FECHAR AO CLICAR FORA
  const ufRef = useRef();
  const cidadeRef = useRef();
  const espRef = useRef();

  // =====================================================================
  // FECHAR DROPDOWNS AO CLICAR FORA
  // =====================================================================
  useEffect(() => {
    function handleClickOutside(e) {
      if (ufRef.current && !ufRef.current.contains(e.target)) setOpenUF(false);
      if (cidadeRef.current && !cidadeRef.current.contains(e.target)) setOpenCidade(false);
      if (espRef.current && !espRef.current.contains(e.target)) setOpenEsp(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // =====================================================================
  // CARREGAR LISTA DE UF (única)
  // =====================================================================
  useEffect(() => {
    async function loadUF() {
      const { data } = await supabase.from("clinicas").select("uf");
      const ufs = [...new Set(data.map((x) => x.uf))].sort();
      setListaUFs(ufs);
    }
    loadUF();
  }, []);

  // =====================================================================
  // AO SELECIONAR UF → Buscar cidades válidas
  // =====================================================================
  async function carregarCidadesPorUF(ufSelecionada) {
    const { data } = await supabase
      .from("clinicas")
      .select("cidade")
      .ilike("uf", ufSelecionada);

    const cidades = [...new Set(data.map((x) => x.cidade))].sort();
    setListaCidades(cidades);
  }

  // =====================================================================
  // AO SELECIONAR CIDADE → Buscar especialidades válidas
  // =====================================================================
  async function carregarEspecialidades(ufSel, cidadeSel) {
    const { data } = await supabase
      .from("vw_clinicas_especialidades")
      .select("especialidade")
      .ilike("uf", ufSel)
      .ilike("cidade", cidadeSel);

    const esp = [...new Set(data.map((x) => x.especialidade))].sort();
    setListaEspecialidades(esp);
  }

  // =====================================================================
  // FILTROS
  // =====================================================================

  // UF
  function selecionarUF(u) {
    setUf(u);
    setOpenUF(false);

    // limpar dependentes
    setCidade("");
    setEspecialidade("");
    setListaCidades([]);
    setListaEspecialidades([]);

    carregarCidadesPorUF(u);
  }

  // CIDADE
  function selecionarCidade(c) {
    setCidade(c);
    setOpenCidade(false);

    // limpar dependente
    setEspecialidade("");
    setListaEspecialidades([]);

    carregarEspecialidades(uf, c);
  }

  // ESPECIALIDADE
  function selecionarEspecialidade(e) {
    setEspecialidade(e);
    setOpenEsp(false);
  }

  // =====================================================================
  // BUSCAR CLÍNICAS
  // =====================================================================
  async function buscar() {
    setLoading(true);
    setResultados([]);

    let q = supabase.from("vw_clinicas_especialidades").select("*");

    if (uf) q = q.ilike("uf", uf);
    if (cidade) q = q.ilike("cidade", cidade);
    if (especialidade) q = q.ilike("especialidade", `%${especialidade}%`);

    const { data } = await q;
    setLoading(false);

    const agrupado = {};
    data.forEach((c) => {
      if (!agrupado[c.clinica_id]) {
        agrupado[c.clinica_id] = { ...c, especialidades: [] };
      }
      agrupado[c.clinica_id].especialidades.push(c.especialidade);
    });

    setResultados(Object.values(agrupado));
  }

  // =====================================================================
  // UI
  // =====================================================================
  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center p-10 text-slate-200">

        {/* LOGO */}
        <div className="flex flex-col items-center mb-10">
    <img src={Logo} alt="MedSimples" className="h-14 opacity-95" />
  </div>


      <h1 className="text-3xl font-bold text-sky-400 mb-8 text-center">
        🏥 Busca de Clínicas GEAP
      </h1>

      {/* FORM */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 w-full max-w-2xl space-y-6 shadow-xl">

        {/* UF */}
        <div className="relative" ref={ufRef}>
          <label className="text-slate-300 text-sm">UF</label>
          <input
            className="w-full mt-1 p-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 cursor-pointer"
            readOnly
            placeholder="Selecione o estado"
            value={uf}
            onClick={() => {
              setOpenUF(!openUF);
              setOpenCidade(false);
              setOpenEsp(false);
              setSugUF(listaUFs);
            }}
          />

          {openUF && (
            <ul className="absolute z-30 bg-slate-900 border border-slate-700 rounded-lg w-full mt-1 max-h-64 overflow-y-auto shadow-xl">
              {listaUFs.map((u) => (
                <li
                  key={u}
                  className="p-2 hover:bg-slate-700 cursor-pointer"
                  onClick={() => selecionarUF(u)}
                >
                  {u}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* CIDADE */}
        <div className="relative" ref={cidadeRef}>
          <label className="text-slate-300 text-sm">Cidade</label>
          <input
            className={`w-full mt-1 p-3 border rounded-lg ${
              uf
                ? "bg-slate-800 border-slate-700 text-slate-100 cursor-pointer"
                : "bg-slate-800/40 border-slate-700/40 text-slate-600 cursor-not-allowed"
            }`}
            placeholder={uf ? "Selecione a cidade" : "Selecione UF primeiro"}
            readOnly
            disabled={!uf}
            value={cidade}
            onClick={() => {
              if (!uf) return;
              setOpenCidade(!openCidade);
              setOpenUF(false);
              setOpenEsp(false);
              setSugCidade(listaCidades);
            }}
          />

          {openCidade && uf && (
            <ul className="absolute z-30 bg-slate-900 border border-slate-700 rounded-lg w-full mt-1 max-h-64 overflow-y-auto shadow-xl">
              {listaCidades.map((c) => (
                <li
                  key={c}
                  className="p-2 hover:bg-slate-700 cursor-pointer"
                  onClick={() => selecionarCidade(c)}
                >
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ESPECIALIDADE */}
        <div className="relative" ref={espRef}>
          <label className="text-slate-300 text-sm">Especialidade</label>
          <input
            className={`w-full mt-1 p-3 border rounded-lg ${
              cidade
                ? "bg-slate-800 border-slate-700 text-slate-100 cursor-pointer"
                : "bg-slate-800/40 border-slate-700/40 text-slate-600 cursor-not-allowed"
            }`}
            readOnly
            disabled={!cidade}
            placeholder={
              cidade ? "Selecione especialidade" : "Selecione cidade primeiro"
            }
            value={especialidade}
            onClick={() => {
              if (!cidade) return;
              setOpenEsp(!openEsp);
              setOpenUF(false);
              setOpenCidade(false);
              setSugEsp(listaEspecialidades);
            }}
          />

          {openEsp && cidade && (
            <ul className="absolute z-30 bg-slate-900 border border-slate-700 rounded-lg w-full mt-1 max-h-64 overflow-y-auto shadow-xl">
              {listaEspecialidades.map((e) => (
                <li
                  key={e}
                  className="p-2 hover:bg-slate-700 cursor-pointer"
                  onClick={() => selecionarEspecialidade(e)}
                >
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* BOTÃO */}
        <button
          onClick={buscar}
          className="w-full bg-sky-500 hover:bg-sky-600 text-slate-900 font-semibold p-3 rounded-lg shadow-lg transition"
          disabled={!uf || !cidade}
        >
          Buscar Clínicas
        </button>
      </div>

      {/* RESULTADOS */}
      <div className="mt-10 w-full max-w-4xl space-y-4">
        {loading && (
          <p className="text-slate-400 text-lg animate-pulse">
            Carregando resultados...
          </p>
        )}

        {resultados.map((c) => (
          <div
            key={c.clinica_id}
            className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-xl"
          >
            <h2 className="text-xl font-bold text-sky-300">{c.nome_fantasia}</h2>

            <p className="text-slate-400 text-sm">
              {c.logradouro} {c.numero || ""}, {c.bairro}
            </p>
            <p className="text-slate-400 text-sm">
              {c.cidade} - {c.uf}
            </p>

            <p className="mt-3 text-sky-200 text-sm">
              <span className="font-semibold text-sky-400">
                Especialidades:
              </span>{" "}
              {c.especialidades.join(", ")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
