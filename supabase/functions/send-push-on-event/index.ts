import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const SUPABASE_URL = 'https://yqapipzwmgvuzduqnsps.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYXBpcHp3bWd2dXpkdXFuc3BzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTczOTQ5OCwiZXhwIjoyMDkxMzE1NDk4fQ.maFqfRJQr0uD8DMCqHDQT9DDljrI53TPAdzEcK51eZA';

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
  const { data } = await supabase.from('push_subscriptions').select('*').neq('user_id', authorId);
  if (data) {
    for (const sub of data) {
      try {
        await fetch(sub.endpoint, {
          method: 'POST',
          headers: { TTL: '60' },
          body: JSON.stringify({ title, body, url }),
        });
      } catch (_) {}
    }
  }
  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
});