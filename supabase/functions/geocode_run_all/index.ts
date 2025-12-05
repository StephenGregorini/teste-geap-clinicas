import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

serve(async () => {
  const { data, error } = await supabase
    .from("stg_amil_clinicas")
    .select("id, logradouro, numero, bairro, cidade, uf")
    .is("latitude", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ total: data.length, stg_amil_clinicas: data }), {
    status: 200,
  });
});
