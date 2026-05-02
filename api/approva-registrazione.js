// /api/approva-registrazione.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo POST' });
  }
  const { id, ruolo, categorie } = req.body || {};
  if (!id) return res.status(400).json({ error: 'ID mancante' });

  // 1. Recupera la richiesta pending (inclusa password)
  const { data: pending, error } = await supabase
    .from('pending_registrations')
    .select('id, email, password, ruolo, cognome, nome, telefono, documento')
    .eq('id', id)
    .single();
  if (error || !pending) {
    return res.status(404).json({ error: 'Richiesta non trovata', details: error?.message });
  }

  // 2. Crea utente su Supabase Auth
  const { data: user, error: userError } = await supabase.auth.admin.createUser({
    email: pending.email,
    password: pending.password,
    email_confirm: true,
  });
  if (userError) {
    return res.status(500).json({ error: 'Errore creazione utente', details: userError.message });
  }

  // 3. Inserisci in iscritti
  const { error: iscrittiError } = await supabase.from('iscritti').insert([
    {
      email: pending.email,
      ruolo: ruolo || pending.ruolo,
      cognome: pending.cognome,
      nome: pending.nome,
      telefono: pending.telefono,
      categorie: categorie && categorie.length ? categorie : [ruolo || pending.ruolo],
    },
  ]);
  if (iscrittiError) {
    return res.status(500).json({ error: 'Utente creato, ma errore su iscritti', details: iscrittiError.message });
  }

  // 4. Elimina la richiesta pending
  await supabase.from('pending_registrations').delete().eq('id', id);

  return res.status(200).json({ success: true });
}
