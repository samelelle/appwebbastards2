import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo POST' });
  }

  const { title, body, url } = req.body || {};
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

  const { data, error } = await supabase.from('push_subscriptions').select('*');
  if (error) {
    return res.status(500).json({ error: 'Errore Supabase', details: error });
  }

  let results = [];
  for (const sub of data) {
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
