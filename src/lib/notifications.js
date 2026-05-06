export async function ensureNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';

  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function notifyUser(title, body) {
  // Blocca notifiche se modalità manutenzione attiva (tranne per DEV)
  try {
    const isMaintenance = localStorage.getItem('bb-maintenance-mode') === '1';
    const userEmail = localStorage.getItem('bb-user-email') || '';
    const isDev = userEmail.toLowerCase() === 'mmonthz@gmail.com';
    if (isMaintenance && !isDev) return;
  } catch {}
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    new Notification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: `${title}-${Date.now()}`,
    });
  } catch {
    // Ignore browser-specific notification failures.
  }
}
