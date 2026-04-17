const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://yqapipzwmgvuzduqnsps.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYXBpcHp3bWd2dXpkdXFuc3BzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTczOTQ5OCwiZXhwIjoyMDkxMzE1NDk4fQ.maFqfRJQr0uD8DMCqHDQT9DDljrI53TPAdzEcK51eZA'
);

webpush.setVapidDetails(
  'mailto:tuamail@example.com',
  'BL5BrGEM2zhmHGSJc9pfo_cDjCJvR_nJVCZFbREaSuHMPE6oq3Nv9RyvBkOjROE-Gbb1PBufWkIOIMX4TQsXHMQ',
  'JKm31-uvJP1GSAglhLRkC0arcIzMX5mGmApzTxzQIJE'
);

async function sendNotificationToAllExcept(excludedUserId, payload) {
  const { data } = await supabase.from('push_subscriptions').select('*').neq('user_id', excludedUserId);
  if (!data) return;
  for (const sub of data) {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: sub.keys,
      }, JSON.stringify(payload));
    } catch (e) {
      // Gestisci errori (es. endpoint non valido)
    }
  }
}

// Esempio di invio
// sendNotificationToAllExcept('user_id_da_escludere', {
//   title: 'Nuovo evento!',
//   body: 'È stato aggiunto un nuovo evento.',
//   url: 'https://appwebbastards2-3g9t.vercel.app/',
// });

module.exports = { sendNotificationToAllExcept };
