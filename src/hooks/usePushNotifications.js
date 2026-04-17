import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const publicVapidKey = 'BL5BrGEM2zhmHGSJc9pfo_cDjCJvR_nJVCZFbREaSuHMPE6oq3Nv9RyvBkOjROE-Gbb1PBufWkIOIMX4TQsXHMQ';
const supabase = createClient(
  'https://yqapipzwmgvuzduqnsps.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYXBpcHp3bWd2dXpkdXFuc3BzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3Mzk0OTgsImV4cCI6MjA5MTMxNTQ5OH0.-1kBSjzOWvXOAJm-gI1Nk81AAvGKxqUfDrif90dkGCU'
);

export function usePushNotifications(userId) {
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/push-sw.js').then(registration => {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
            }).then(subscription => {
              supabase.from('push_subscriptions').upsert({
                user_id: userId,
                endpoint: subscription.endpoint,
                keys: subscription.toJSON().keys,
              });
            });
          }
        });
      });
    }
  }, [userId]);
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}
