import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Solo POST" });
  }

  const { user_id, subscription } = req.body || {};
  const endpoint = subscription?.endpoint;
  const keys = subscription?.keys;

  if (!user_id || !endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({
      error: "Payload non valido",
      required: ["user_id", "subscription.endpoint", "subscription.keys.p256dh", "subscription.keys.auth"],
    });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Config mancante: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader && typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7);
    const { error: authError } = await supabase.auth.getUser(token);
    if (authError) {
      return res.status(401).json({ error: "Token non valido", details: authError.message });
    }
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: String(user_id),
        endpoint: String(endpoint),
        keys,
      },
      { onConflict: "user_id" }
    );

  if (error) {
    const message = String(error?.message || "");
    const code = String(error?.code || "");
    // Se non esiste un vincolo UNIQUE su endpoint, l'upsert fallisce.
    if (code === "42P10" || message.toLowerCase().includes("no unique") || message.toLowerCase().includes("on conflict")) {
      const { error: delError } = await supabase.from("push_subscriptions").delete().eq("user_id", String(user_id));
      if (delError) {
        return res.status(500).json({
          error: "Errore Supabase",
          message: delError.message,
          code: delError.code,
          details: delError.details,
          hint: delError.hint,
        });
      }
      const { error: insError } = await supabase.from("push_subscriptions").insert({
        user_id: String(user_id),
        endpoint: String(endpoint),
        keys,
      });
      if (insError) {
        return res.status(500).json({
          error: "Errore Supabase",
          message: insError.message,
          code: insError.code,
          details: insError.details,
          hint: insError.hint,
        });
      }
      return res.json({ success: true, via: "delete_insert" });
    }

    // Se esiste gia user_id come PK/UNIQUE, aggiorna la riga esistente.
    if (code === "23505" || message.toLowerCase().includes("duplicate key")) {
      const { error: updError } = await supabase
        .from("push_subscriptions")
        .update({ endpoint: String(endpoint), keys })
        .eq("user_id", String(user_id));
      if (!updError) {
        return res.json({ success: true, via: "update_on_duplicate" });
      }
      return res.status(500).json({
        error: "Errore Supabase",
        message: updError.message,
        code: updError.code,
        details: updError.details,
        hint: updError.hint,
      });
    }

    return res.status(500).json({
      error: "Errore Supabase",
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }

  return res.json({ success: true });
}
