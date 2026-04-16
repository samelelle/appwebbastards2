// onesignalNotify.js
import OneSignal from 'react-onesignal';

export async function sendOneSignalNotification({ title, message, url }) {
  if (typeof OneSignal === 'undefined' || !OneSignal) return;
  try {
    await OneSignal.Slidedown.promptPush(); // mostra prompt se non già iscritto
    await OneSignal.sendNotification(
      {
        contents: { en: message },
        headings: { en: title },
        url: url || window.location.href,
      }
    );
  } catch (e) {
    // Silenzia errori
    console.warn('Errore invio notifica OneSignal:', e);
  }
}
