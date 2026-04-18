// genera-vapid.js
// Esegui: node genera-vapid.js
const webpush = require('web-push');
const vapidKeys = webpush.generateVAPIDKeys();
console.log('Chiave pubblica VAPID:', vapidKeys.publicKey);
console.log('Chiave privata VAPID:', vapidKeys.privateKey);