import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import Logo from "./assets/logo_claro.svg";

import MapPanel from "./MapPanel";

export default function App() {
  const [step, setStep] = useState("inicio");
  const [operadora, setOperadora] = useState("GEAP");

  const [uf, setUf] = useState("");
  const [cidade, setCidade] = useState("");
  const [especialidade, setEspecialidade] = useState("");

  const [listaUFs, setListaUFs] = useState([]);
  const [listaCidades, setListaCidades] = useState([]);
  const [listaEspecialidades, setListaEspecialidades] = useState([]);

  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [selectedClinica, setSelectedClinica] = useState(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [userLocation, setUserLocation] = useState(null);

  const [mapOpen, setMapOpen] = useState(false);
  const mapWrapperRef = useRef(null);

  function handleNearMeClick() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setMapOpen(true);
          setTimeout(() => {
            mapWrapperRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 200);
        },
        (error) => {
          console.error("Erro ao obter a geolocalização", error);
          alert("Não foi possível obter sua localização. Verifique as permissões do seu navegador.");
        }
      );
    } else {
      alert("Geolocalização não é suportada por este navegador.");
    }
  }


  useEffect(() => {
    async function loadUF() {
      let q = supabase.from("vw_clinicas_busca").select("uf").not("uf", "is", null);
      if (operadora !== "TODAS") q = q.eq("operadora", operadora);

      const { data } = await q;

      const unique = [...new Set(data.map(x => x.uf?.trim()))].filter(Boolean);
      setListaUFs(unique.sort());
    }

    if (step === "busca") loadUF();
  }, [step, operadora]);

  async function carregarCidadesPorUF(u) {
    let q = supabase.from("vw_clinicas_busca").select("cidade").eq("uf", u);
    if (operadora !== "TODAS") q = q.eq("operadora", operadora);

    const { data } = await q;
    const unique = [...new Set(data.map(x => x.cidade?.trim()))].filter(Boolean);
    setListaCidades(unique.sort());
  }

  async function carregarEspecialidades(u, c) {
    let q = supabase
      .from("vw_clinicas_busca")
      .select("especialidade")
      .eq("uf", u)
      .eq("cidade", c);

    if (operadora !== "TODAS") q = q.eq("operadora", operadora);

    const { data } = await q;

    const unique = [...new Set(data.map(x => x.especialidade?.trim()))].filter(Boolean);
    setListaEspecialidades(unique.sort());
  }

  function selecionarUF(u) {
    setUf(u);
    setCidade("");
    setEspecialidade("");
    carregarCidadesPorUF(u);
  }

  function selecionarCidade(c) {
    setCidade(c);
    setEspecialidade("");
    carregarEspecialidades(uf, c);
  }

  async function buscar() {
    setLoading(true);

    let q = supabase.from("vw_clinicas_busca").select("*");
    if (operadora !== "TODAS") q = q.eq("operadora", operadora);
    if (uf) q = q.eq("uf", uf);
    if (cidade) q = q.eq("cidade", cidade);
    if (especialidade) q = q.ilike("especialidade", `%${especialidade}%`);

    const { data } = await q;
    setLoading(false);

    const grouped = {};
    data.forEach(c => {
      if (!grouped[c.clinica_id]) {
        grouped[c.clinica_id] = { ...c, especialidades: [] };
      }
      if (c.especialidade && !grouped[c.clinica_id].especialidades.includes(c.especialidade)) {
        grouped[c.clinica_id].especialidades.push(c.especialidade);
      }
    });

    const lista = Object.values(grouped);
    setResultados(lista);
    setVisibleCount(20);
    if (lista.length > 0) setSelectedClinica(lista[0]);
  }

  return (
    <div className="min-h-screen w-full bg-[#F5F6FA] text-[#0F1424] flex flex-col items-center pb-20">

      <header className="w-full bg-white py-4 shadow-sm flex justify-center">
        <div className="flex items-center gap-3">
          <img src={Logo} className="h-10" />
        </div>
      </header>

      <div className="w-full max-w-6xl mt-10 px-4">

        {step === "inicio" && (
          <div className="bg-white border border-[#E4E6EA] rounded-2xl shadow-md p-12">
            <h1 className="text-center text-4xl font-bold text-[#0F1424]">
              Encontre Clínicas
            </h1>

            <p className="text-center text-lg text-[#5A6275] mt-3 mb-12">
              Você possui algum convênio?
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button
                onClick={() => { setOperadora("GEAP"); setStep("busca"); }}
                className="bg-[#F2F3F5] hover:bg-[#E9EAED] text-[#0F1424] font-semibold py-5 rounded-2xl border border-[#E4E6EA]"
              >
                GEAP
              </button>

              <button
                onClick={() => { setOperadora("AMIL"); setStep("busca"); }}
                className="bg-[#F2F3F5] hover:bg-[#E9EAED] text-[#0F1424] font-semibold py-5 rounded-2xl border border-[#E4E6EA]"
              >
                AMIL
              </button>

              <button
                onClick={() => { setOperadora("TODAS"); setStep("busca"); }}
                className="bg-[#F2F3F5] hover:bg-[#E9EAED] text-[#0F1424] font-semibold py-5 rounded-2xl border border-[#D7D9DF]"
              >
                Nenhum / Outro
              </button>
            </div>
          </div>
        )}

        {step === "busca" && (
          <div className="space-y-10">

            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold">Buscar Clínicas</h2>
                <p className="mt-1 text-[#5A6275]">
                  Operadora selecionada:{" "}
                  <span className="text-[#0C77E1] font-semibold">
                    {operadora === "TODAS" ? "Todas" : operadora}
                  </span>
                </p>
              </div>

              <button
                onClick={() => setStep("inicio")}
                className="px-4 py-2 rounded-xl border border-[#D7D9DF] text-[#0F1424] bg-white hover:bg-[#F2F3F5]"
              >
                ← Trocar convênio
              </button>
            </div>

            <div className="bg-white border border-[#E4E6EA] rounded-2xl shadow-sm p-8 space-y-6">

              <div>
                <label className="font-medium">UF</label>
                <select
                  className="w-full p-3 border border-[#D7D9DF] rounded-xl mt-1"
                  value={uf}
                  onChange={(e) => selecionarUF(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {listaUFs.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>

              <div>
                <label className="font-medium">Cidade</label>
                <select
                  className="w-full p-3 border border-[#D7D9DF] rounded-xl mt-1"
                  disabled={!uf}
                  value={cidade}
                  onChange={(e) => selecionarCidade(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {listaCidades.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="font-medium">Especialidade</label>
                <select
                  className="w-full p-3 border border-[#D7D9DF] rounded-xl mt-1"
                  disabled={!cidade}
                  value={especialidade}
                  onChange={(e) => setEspecialidade(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {listaEspecialidades.map((e) => <option key={e}>{e}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={buscar}
                  className="w-full bg-[#0C77E1] hover:bg-[#0A66C7] text-white font-semibold p-4 rounded-xl"
                >
                  Buscar Clínicas
                </button>
                <button
                  type="button"
                  onClick={handleNearMeClick}
                  className="w-full bg-white hover:bg-gray-100 text-[#0C77E1] border border-[#0C77E1] font-semibold p-4 rounded-xl"
                >
                  Perto de mim
                </button>
              </div>
            </div>

            <div className="bg-white border border-[#E4E6EA] rounded-2xl shadow-sm">
              <button
                className="w-full p-5 flex justify-between items-center text-left font-semibold text-[#0F1424] bg-[#F7F8FA] border-b border-[#E4E6EA]"
                onClick={() => {
                  setMapOpen(!mapOpen);
                  setTimeout(() => {
                    mapWrapperRef.current?.scrollIntoView({ behavior: "smooth" });
                  }, 200);
                }}
              >
                Mapa das Clínicas
                <span>{mapOpen ? "▲" : "▼"}</span>
              </button>

              <div
                ref={mapWrapperRef}
                className="transition-all duration-500 overflow-hidden"
                style={{ maxHeight: mapOpen ? "420px" : "0px", opacity: mapOpen ? 1 : 0 }}
              >
                <div
                  ref={mapWrapperRef}
                  className="transition-all duration-500 overflow-hidden"
                  style={{ maxHeight: mapOpen ? "420px" : "0px" }}
                >
                  {mapOpen && (
                    <div className="p-4">
                      <MapPanel
                        clinicas={resultados}
                        selectedClinica={selectedClinica}
                        onSelect={setSelectedClinica}
                        userLocation={userLocation}
                      />
                    </div>
                  )}
                </div>

              </div>
            </div>

            <div className="space-y-5">
              {loading && <p className="text-lg animate-pulse">Carregando…</p>}

              {!loading && resultados.length === 0 && (
                <p className="text-center">Nenhuma clínica encontrada.</p>
              )}

              {resultados.slice(0, visibleCount).map((c) => (
                <div
                  key={c.clinica_id}
                  className="bg-white border border-[#E4E6EA] rounded-2xl shadow-sm p-6"
                >
                  <div className="flex justify-between">

                    <div>
                      <h3 className="text-xl font-bold text-[#0C77E1]">
                        {c.nome_fantasia}
                      </h3>

                      <p className="text-[#5A6275] mt-1">
                        {c.logradouro} {c.numero}, {c.bairro}
                      </p>

                      <p className="text-[#5A6275]">{c.cidade}/{c.uf}</p>

                      <p className="text-sm text-[#5A6275] mt-2">
                        <strong className="text-[#0F1424]">Especialidades:</strong>{" "}
                        {c.especialidades.join(", ")}
                      </p>
                    </div>

                    <button
                      className="px-4 py-2 bg-[#0C77E1] hover:bg-[#0A66C7] text-white rounded-xl"
                      onClick={() => {
                        setSelectedClinica(c);
                        setMapOpen(true);
                        setTimeout(() => {
                          mapWrapperRef.current?.scrollIntoView({ behavior: "smooth" });
                        }, 200);
                      }}
                    >
                      Ver no mapa
                    </button>

                  </div>
                </div>
              ))}

              {resultados.length > visibleCount && (
                <div className="flex justify-center">
                  <button
                    onClick={() => setVisibleCount(prev => prev + 20)}
                    className="w-full md:w-auto px-6 py-3 bg-[#0C77E1] hover:bg-[#0A66C7] text-white font-semibold rounded-xl"
                  >
                    Carregar Mais
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
