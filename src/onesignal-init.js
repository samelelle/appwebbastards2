// onesignal-init.js
import OneSignal from 'react-onesignal';

export async function initOneSignal() {
  await OneSignal.init({
    appId: '934b6cd9-e8c6-468e-8d3f-c1133c347092',
    notifyButton: { enable: true },
    allowLocalhostAsSecureOrigin: true,
  });
}
