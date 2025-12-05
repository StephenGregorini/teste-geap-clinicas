import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// cria o client UMA vez só, fora do handler
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  try {
    const body = await req.json().catch(() => null);

    const { id, logradouro, numero, bairro, cidade, uf } = body ?? {};

    if (!id || !cidade || !uf || !logradouro) {
      return new Response(
        JSON.stringify({
          error: "Campos obrigatórios faltando (id, logradouro, cidade, uf)",
        }),
        { status: 400 },
      );
    }

    const partes = [
      logradouro,
      numero || "",
      bairro || "",
      `${cidade} - ${uf}`,
      "Brasil",
    ].filter(Boolean);

    const endereco = partes.join(", ");

    const query = encodeURIComponent(endereco);
    const nominatimUrl =
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`;

    const geoRes = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "MedSimples-GeoCoder/1.0 (contato@medsimples.com)",
      },
    });

    if (!geoRes.ok) {
      return new Response(
        JSON.stringify({
          id,
          endereco,
          error: `Erro ao chamar Nominatim: ${geoRes.status} ${geoRes.statusText}`,
        }),
        { status: 502 },
      );
    }

    const results = await geoRes.json();

    if (!Array.isArray(results) || results.length === 0) {
      return new Response(
        JSON.stringify({
          id,
          endereco,
          error: "Endereço não encontrado no Nominatim",
        }),
        { status: 404 },
      );
    }

    const { lat, lon, type } = results[0];

    const { error: updateError } = await supabase
      .from("stg_amil_clinicas")
      .update({
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
      })
      .eq("id", id);

    if (updateError) {
      return new Response(
        JSON.stringify({
          id,
          endereco,
          latitude: lat,
          longitude: lon,
          precision: type,
          error: updateError.message,
        }),
        { status: 500 },
      );
    }

    return new Response(
      JSON.stringify({
        id,
        endereco,
        latitude: lat,
        longitude: lon,
        precision: type,
        status: "updated",
      }),
      { status: 200 },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
      }),
      { status: 500 },
    );
  }
});
