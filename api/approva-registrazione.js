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
  const { id, ruolo, categorie, iscrittoId } = req.body || {};
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

  const normalizedPendingEmail = String(pending.email || '').trim().toLowerCase();
  if (!normalizedPendingEmail) {
    return res.status(400).json({ error: 'Email non valida nella richiesta pending' });
  }

  const finalRuolo = (ruolo || pending.ruolo || '').trim();
  const finalCategorie = Array.isArray(categorie) && categorie.length ? categorie : [finalRuolo].filter(Boolean);

  // 2. (Opzionale) Collega ad un iscritto esistente scelto dall'admin
  let linkedIscrittoId = null;
  if (iscrittoId !== undefined && iscrittoId !== null && String(iscrittoId).trim() !== '') {
    const numericId = Number(iscrittoId);
    if (!Number.isFinite(numericId)) {
      return res.status(400).json({ error: 'iscrittoId non valido (atteso numero)' });
    }

    const { data: existingIscritto, error: existingIscrittoError } = await supabase
      .from('iscritti')
      .select('id')
      .eq('id', numericId)
      .single();
    if (existingIscrittoError || !existingIscritto) {
      return res.status(404).json({ error: 'Iscritto non trovato', details: existingIscrittoError?.message });
    }

    const { data: updatedIscritto, error: updateError } = await supabase
      .from('iscritti')
      .update({
        email: normalizedPendingEmail,
        ruolo: finalRuolo || null,
        cognome: pending.cognome,
        nome: pending.nome,
        telefono: pending.telefono,
        categorie: finalCategorie,
      })
      .eq('id', numericId)
      .select('id')
      .single();

    if (updateError || !updatedIscritto) {
      return res.status(500).json({ error: 'Errore aggiornamento iscritto esistente', details: updateError?.message });
    }

    linkedIscrittoId = updatedIscritto.id;
  }

  // 2. Crea utente su Supabase Auth
  const { data: user, error: userError } = await supabase.auth.admin.createUser({
    email: normalizedPendingEmail,
    password: pending.password,
    email_confirm: true,
    user_metadata: linkedIscrittoId ? { iscritto_id: linkedIscrittoId } : undefined,
  });
  if (userError) {
    return res.status(500).json({ error: 'Errore creazione utente', details: userError.message });
  }

  // 3. Se non abbiamo agganciato un record esistente, aggiorna/crea in iscritti basandoti sulla email
  if (!linkedIscrittoId) {
    const { data: existingByEmail } = await supabase
      .from('iscritti')
      .select('id, email')
      .ilike('email', normalizedPendingEmail)
      .maybeSingle();

    if (existingByEmail?.id) {
      const { data: updated, error: updateError } = await supabase
        .from('iscritti')
        .update({
          email: normalizedPendingEmail,
          ruolo: finalRuolo || null,
          cognome: pending.cognome,
          nome: pending.nome,
          telefono: pending.telefono,
          categorie: finalCategorie,
        })
        .eq('id', existingByEmail.id)
        .select('id')
        .single();
      if (updateError || !updated) {
        return res.status(500).json({ error: 'Utente creato, ma errore aggiornando iscritti', details: updateError?.message });
      }
      linkedIscrittoId = updated.id;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('iscritti')
        .insert([
          {
            email: normalizedPendingEmail,
            ruolo: finalRuolo || null,
            cognome: pending.cognome,
            nome: pending.nome,
            telefono: pending.telefono,
            categorie: finalCategorie,
          },
        ])
        .select('id')
        .single();
      if (insertError || !inserted) {
        return res.status(500).json({ error: 'Utente creato, ma errore su iscritti', details: insertError?.message });
      }
      linkedIscrittoId = inserted.id;
    }
  }

  // 4. Elimina la richiesta pending
  await supabase.from('pending_registrations').delete().eq('id', id);

  // 5. Aggiorna metadata utente se abbiamo recuperato/creato un iscritto dopo createUser
  if (linkedIscrittoId && !userError) {
    try {
      await supabase.auth.admin.updateUserById(user.user.id, {
        user_metadata: { ...(user.user.user_metadata || {}), iscritto_id: linkedIscrittoId },
      });
    } catch {
      // Non bloccare il flusso: l'app puÃ² comunque agganciarsi per email.
    }
  }

  return res.status(200).json({ success: true, iscrittoId: linkedIscrittoId, authUserId: user.user.id });
}
