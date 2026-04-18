
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

Deno.serve(async (req) => {
  // Gestione preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }
  let dataJson = {};
  try {
    dataJson = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const { authorId, title, body, url } = dataJson;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  // Qui puoi aggiungere logica per scrivere su Supabase o altro
  // Ad esempio, puoi loggare la richiesta o salvare una notifica
  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
});