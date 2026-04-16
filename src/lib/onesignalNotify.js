// onesignalNotify.js
import OneSignal from 'react-onesignal';

export function sendOneSignalNotification({title, message, url}) {
  OneSignal.sendSelfNotification(
    title,
    message,
    url || window.location.href,
    undefined,
    {
      notificationType: 'webpush',
    }
  );
}
