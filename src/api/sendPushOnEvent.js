// Funzione per inviare una notifica push a tutti tranne l'autore tramite Supabase Edge Function
export async function sendPushOnEvent({ authorId, title, body, url }) {
  await fetch('https://yqapipzwmgvuzduqnsps.functions.supabase.co/send-push-on-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authorId, title, body, url }),
  });
}
