// Esegui questo script con: node send-push-to-user.js
// Invia una notifica push solo all'user_id specificato

const fetch = require('node-fetch');

const API_URL = 'https://appwebbastards2-3g9t.vercel.app/api/send-push';
const userId = '0a68616b-3e87-4f1a-868d-42d396b7794b';

async function sendPushToUser() {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Test Notifica Singolo Utente',
      body: 'Questa è una notifica inviata solo a te!',
      url: '/',
      exclude_user_id: null,
      targetCategories: [],
      type: 'test',
      chatCategory: null
    })
  });
  const data = await res.json();
  console.log('Risposta API:', data);
}

sendPushToUser().catch(console.error);
