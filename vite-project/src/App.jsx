import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import Logo from "./assets/logo_claro.svg";

import MapPanel from "./MapPanel";

export default function App() {
  // Estados dos filtros
  const [nomeClinica, setNomeClinica] = useState("");
  const [operadora, setOperadora] = useState("TODAS");
  const [especialidade, setEspecialidade] = useState("");
  const [uf, setUf] = useState("");
  const [cidade, setCidade] = useState("");

  // Estados para as listas dos filtros
  const [listaOperadoras, setListaOperadoras] = useState(["GEAP", "AMIL", "TODAS"]);
  const [listaEspecialidades, setListaEspecialidades] = useState([]);
  const [listaUFs, setListaUFs] = useState([]);
  const [listaCidades, setListaCidades] = useState([]);
  
  // Estados de UI e dados
  const [loading, setLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [selectedClinica, setSelectedClinica] = useState(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [userLocation, setUserLocation] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const mapWrapperRef = useRef(null);
  
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const ignoreNextSuggestionFetch = useRef(false);

  // Efeito para buscar sugestões de nome de clínica com debounce
  useEffect(() => {
    if (ignoreNextSuggestionFetch.current) {
      ignoreNextSuggestionFetch.current = false;
      return;
    }

    const handler = setTimeout(async () => {
      if (nomeClinica.length > 2) {
        const { data } = await supabase
          .from("vw_clinicas_busca")
          .select("nome_fantasia")
          .ilike("nome_fantasia", `%${nomeClinica}%`)
          .limit(5);
        
        if (data) {
          setNameSuggestions([...new Set(data.map(c => c.nome_fantasia))]);
        }
      } else {
        setNameSuggestions([]);
      }
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [nomeClinica]);

  // Carrega as listas de filtros iniciais (Especialidades e UFs)
  useEffect(() => {
    async function loadInitialFilters() {
      // Carrega todas as especialidades
      const { data: especialidadesData } = await supabase.from("vw_clinicas_busca").select("especialidade").not("especialidade", "is", null);
      if (especialidadesData) {
        const uniqueEspecialidades = [...new Set(especialidadesData.map(x => x.especialidade?.trim()))].filter(Boolean);
        setListaEspecialidades(uniqueEspecialidades.sort());
      }

      // Carrega todas as UFs
      const { data: ufsData } = await supabase.from("vw_clinicas_busca").select("uf").not("uf", "is", null);
      if (ufsData) {
        const uniqueUFs = [...new Set(ufsData.map(x => x.uf?.trim()))].filter(Boolean);
        setListaUFs(uniqueUFs.sort());
      }
    }
    loadInitialFilters();
  }, []); // Executa apenas uma vez

  // Carrega cidades quando uma UF é selecionada
  useEffect(() => {
    async function carregarCidadesPorUF(u) {
      if (!u) {
        setListaCidades([]);
        return;
      }
      let q = supabase.from("vw_clinicas_busca").select("cidade").eq("uf", u).not("cidade", "is", null);
      const { data } = await q;
      const unique = [...new Set(data.map(x => x.cidade?.trim()))].filter(Boolean);
      setListaCidades(unique.sort());
    }
    carregarCidadesPorUF(uf);
  }, [uf]);

  function selecionarEspecialidade(value) {
    setEspecialidade(value);
  }

  function selecionarUF(value) {
    setUf(value);
    setCidade("");
  }

  async function buscar() {
    setLoading(true);
    setSearchPerformed(true);
    let q = supabase.from("vw_clinicas_busca").select("*");
    
    if (operadora !== "TODAS") q = q.eq("operadora", operadora);
    if (nomeClinica) q = q.ilike("nome_fantasia", `%${nomeClinica}%`);
    if (especialidade) q = q.eq("especialidade", especialidade);
    if (uf) q = q.eq("uf", uf);
    if (cidade) q = q.eq("cidade", cidade);
    
    const { data } = await q;
    setLoading(false);

    // Nova lógica de agrupamento robusta
    const grouped = {};
    data.forEach(c => {
      if (!grouped[c.clinica_id]) {
        grouped[c.clinica_id] = { 
          ...c, 
          especialidades: new Set(),
          operadoras: new Set(),
        };
      }
      if (c.especialidade) grouped[c.clinica_id].especialidades.add(c.especialidade.trim());
      if (c.operadora) grouped[c.clinica_id].operadoras.add(c.operadora.trim());
    });

    const lista = Object.values(grouped).map(clinic => ({
      ...clinic,
      especialidades: Array.from(clinic.especialidades).sort(),
      operadoras: Array.from(clinic.operadoras).sort(),
    }));

    const listaFiltrada = lista.filter(c => c.latitude && c.longitude);

    setResultados(listaFiltrada);
    setVisibleCount(20);
    if (listaFiltrada.length > 0) setSelectedClinica(listaFiltrada[0]);
  }

  function clearSearch() {
    setNomeClinica("");
    setEspecialidade("");
    setUf("");
    setCidade("");
    setResultados([]);
    setSearchPerformed(false);
    setSelectedClinica(null);
  }

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

  const showClearButton = nomeClinica || especialidade || uf || cidade || searchPerformed;



  return (
    <div className="min-h-screen w-full bg-[#F5F6FA] text-[#0F1424] flex flex-col items-center pb-20">

      <header className="w-full bg-white py-4 shadow-sm flex justify-center">
        <div className="flex items-center gap-3">
          <img src={Logo} className="h-10" />
        </div>
      </header>

      <div className="w-full max-w-6xl mt-10 px-4">
        <div className="bg-white border border-[#E4E6EA] rounded-2xl shadow-md p-8 space-y-6">
          <h1 className="text-3xl font-bold text-center">Encontre a clínica ideal para você</h1>
          <p className="text-lg text-[#5A6275] text-center mb-6">
            Busque por nome, convênio, localidade e especialidade.
          </p>

          <div className="relative">
            <label className="font-medium">Nome da clínica (Opcional)</label>
            <input
              type="text"
              className="w-full p-3 border border-[#D7D9DF] rounded-xl mt-1"
              value={nomeClinica}
              onChange={(e) => setNomeClinica(e.target.value)}
              placeholder="Digite o nome da clínica"
            />
            {nameSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                <ul className="py-1">
                  {nameSuggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        ignoreNextSuggestionFetch.current = true;
                        setNomeClinica(suggestion);
                        setNameSuggestions([]);
                      }}
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="font-medium">Convênio</label>
              <select
                className="w-full p-3 border border-[#D7D9DF] rounded-xl mt-1"
                value={operadora}
                onChange={(e) => setOperadora(e.target.value)}
              >
                {listaOperadoras.map((op) => <option key={op} value={op}>{op === 'TODAS' ? 'Todos' : op}</option>)}
              </select>
            </div>
            <div>
              <label className="font-medium">Especialidade</label>
              <select
                className="w-full p-3 border border-[#D7D9DF] rounded-xl mt-1"
                value={especialidade}
                onChange={(e) => selecionarEspecialidade(e.target.value)}
              >
                <option value="">Todas</option>
                {listaEspecialidades.map((e) => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="font-medium">UF</label>
              <select
                className="w-full p-3 border border-[#D7D9DF] rounded-xl mt-1"
                value={uf}
                onChange={(e) => selecionarUF(e.target.value)}
              >
                <option value="">Todos</option>
                {listaUFs.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="font-medium">Cidade</label>
              <select
                className="w-full p-3 border border-[#D7D9DF] rounded-xl mt-1"
                disabled={!uf}
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
              >
                <option value="">Todas</option>
                {listaCidades.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <button
              onClick={buscar}
              className="w-full md:col-span-2 bg-[#0C77E1] hover:bg-[#0A66C7] text-white font-semibold p-4 rounded-xl"
            >
              Buscar Clínicas
            </button>
            <button
              type="button"
              onClick={handleNearMeClick}
              className="w-full bg-white hover:bg-gray-100 text-[#0C77E1] border border-[#0C77E1] font-semibold p-4 rounded-xl"
            >
              Usar minha localização
            </button>
          </div>
          
          {showClearButton && (
            <div className="text-center">
              <button onClick={clearSearch} className="text-sm text-gray-600 hover:text-black underline">
                Limpar busca
              </button>
            </div>
          )}
        </div>

        {searchPerformed && (
          <div className="mt-10 space-y-10">
            <div className="bg-white border border-[#E4E6EA] rounded-2xl shadow-sm">
              <button
                className="w-full p-5 flex justify-between items-center text-left font-semibold text-[#0F1424] bg-[#F7F8FA] border-b border-[#E4E6EA]"
                onClick={() => setMapOpen(!mapOpen)}
              >
                Mapa das Clínicas
                <span>{mapOpen ? "▲" : "▼"}</span>
              </button>

              <div
                ref={mapWrapperRef}
                className="transition-all duration-500 overflow-hidden"
                style={{ maxHeight: mapOpen ? "420px" : "0px", opacity: mapOpen ? 1 : 0 }}
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

            <div className="space-y-5">
              {loading && <p className="text-lg animate-pulse text-center">Carregando…</p>}

              {!loading && resultados.length === 0 && (
                <p className="text-center py-10 text-gray-500">Nenhuma clínica encontrada para os filtros selecionados.</p>
              )}

              {resultados.slice(0, visibleCount).map((c) => (
                <div
                  key={c.clinica_id}
                  className="bg-white border border-[#E4E6EA] rounded-2xl shadow-sm p-6"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-[#0C77E1]">{c.nome_fantasia}</h3>
                      <p className="text-[#5A6275] mt-1">{c.logradouro} {c.numero}, {c.bairro}</p>
                      <p className="text-[#5A6275]">{c.cidade}/{c.uf}</p>
                      <p className="text-sm text-[#5A6275] mt-2">
                        <strong className="text-[#0F1424]">Especialidades:</strong> {c.especialidades.join(", ")}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <strong className="text-[#0F1424] text-sm">Convênios:</strong>
                        {c.operadoras.map(op => (
                          <span key={op} className="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-1 rounded-full">{op}</span>
                        ))}
                      </div>
                    </div>

                    <button
                      className="px-4 h-10 bg-[#0C77E1] hover:bg-[#0A66C7] text-white rounded-xl whitespace-nowrap"
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
