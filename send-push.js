require('dotenv').config();
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

// Controlla che tutte le variabili siano presenti
function toEnv(name) {
  if (!process.env[name]) {
    console.error(`Variabile ${name} mancante in .env`);
    process.exit(1);
  }
}
toEnv('SUPABASE_URL');
toEnv('SUPABASE_SERVICE_ROLE_KEY');
toEnv('VAPID_PUBLIC_KEY');
toEnv('VAPID_PRIVATE_KEY');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

webpush.setVapidDetails(
  'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function sendPushToAll({ title, body, url }) {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*');
  if (error) {
    console.error('Errore Supabase:', error);
    return;
  }
  for (const sub of data) {
    const subscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };
    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({ title, body, url })
      );
      console.log('Notifica inviata a', sub.user_id);
    } catch (err) {
      console.error('Errore invio push:', err);
    }
  }
}

// Esegui da linea di comando: node send-push.js "Titolo" "Messaggio" "https://url-opzionale"
const title = process.argv[2] || 'Titolo di test';
const body = process.argv[3] || 'Messaggio di test';
const url = process.argv[4] || '';

sendPushToAll({ title, body, url });
