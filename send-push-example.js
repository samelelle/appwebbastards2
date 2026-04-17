// Esempio di invio notifiche push dal backend
const { sendNotificationToAllExcept } = require('./send-push');

// ID di chi ha generato l'evento/messaggio (da escludere)
const autoreEvento = 'user123'; // <-- Cambia con il vero user.id

// Payload della notifica
const payload = {
  title: 'Nuovo evento!',
  body: 'È stato aggiunto un nuovo evento nel calendario.',
  url: 'https://appwebbastards2-3g9t.vercel.app/',
};

sendNotificationToAllExcept(autoreEvento, payload)
  .then(() => console.log('Notifiche inviate!'))
  .catch(err => console.error('Errore invio notifiche:', err));