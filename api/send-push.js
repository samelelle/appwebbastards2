import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo POST' });
  }

  const { title, body, url, exclude_user_id, targetCategories, type, chatCategory } = req.body || {};
  if (!title || !body) {
    return res.status(400).json({ error: 'title e body obbligatori' });
  }

  // Prendi le chiavi dalle environment variables di Vercel
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  webpush.setVapidDetails(
    'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  // Recupera tutte le push subscriptions e le info utenti
  const { data: subscriptions, error: errSubs } = await supabase.from('push_subscriptions').select('*');
  if (errSubs) {
    return res.status(500).json({ error: 'Errore Supabase', details: errSubs });
  }
  const { data: iscritti, error: errIscritti } = await supabase.from('iscritti').select('*');
  if (errIscritti) {
    return res.status(500).json({ error: 'Errore Supabase iscritti', details: errIscritti });
  }

  // Funzione per normalizzare categoria
  function normalizeCategory(val) {
    return String(val || '').trim().toLowerCase();
  }

  // Determina se un utente può ricevere la notifica
  function canReceive(user) {
    // Se exclude_user_id, escludi
    if (exclude_user_id && String(user.id) === String(exclude_user_id)) return false;

    // Se targetCategories è passato, filtra per categoria
    if (Array.isArray(targetCategories) && targetCategories.length > 0) {
      const userCats = [];
      if (Array.isArray(user.categorie)) userCats.push(...user.categorie.map(normalizeCategory));
      if (user.categoria) userCats.push(normalizeCategory(user.categoria));
      return userCats.some(cat => targetCategories.includes(cat));
    }

    // Se type è "riunione", solo full/viminale
    if (type === 'riunione') {
      const userCats = [];
      if (Array.isArray(user.categorie)) userCats.push(...user.categorie.map(normalizeCategory));
      if (user.categoria) userCats.push(normalizeCategory(user.categoria));
      return userCats.some(cat => cat === 'full' || cat === 'viminale');
    }

    // Se type è "chat" e chatCategory è passato, solo chi ha quella categoria
    if (type === 'chat' && chatCategory) {
      const userCats = [];
      if (Array.isArray(user.categorie)) userCats.push(...user.categorie.map(normalizeCategory));
      if (user.categoria) userCats.push(normalizeCategory(user.categoria));
      return userCats.includes(normalizeCategory(chatCategory));
    }

    // Default: tutti
    return true;
  }

  let results = [];
  for (const sub of subscriptions) {
    const user = iscritti.find(u => String(u.id) === String(sub.user_id));
    if (!user || !canReceive(user)) continue;
    let keys = sub.keys;
    if (typeof keys === 'string') {
      try { keys = JSON.parse(keys); } catch { continue; }
    }
    if (!keys || !keys.p256dh || !keys.auth) continue;
    const subscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth }
    };
    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({ title, body, url })
      );
      results.push({ user_id: sub.user_id, status: 'ok' });
    } catch (err) {
      results.push({ user_id: sub.user_id, status: 'error', error: err.message });
    }
  }

  res.json({ success: true, results });
}
