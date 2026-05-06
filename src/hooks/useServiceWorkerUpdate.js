import { useEffect, useState } from 'react';

export default function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let regRef = null;
    async function checkForUpdateAndWaiting() {
      if (regRef) {
        await regRef.update();
        console.log('[SW DEBUG] checkForUpdateAndWaiting: regRef', regRef);
        if (regRef.waiting) {
          console.log('[SW DEBUG] Service worker in waiting state, update available!');
          setUpdateAvailable(true);
        } else {
          console.log('[SW DEBUG] No waiting service worker found');
        }
      }
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return;
        regRef = reg;
        console.log('[SW DEBUG] Registration found:', reg);
        if (reg.waiting) {
          console.log('[SW DEBUG] Service worker already waiting at load, update available!');
          setUpdateAvailable(true);
        }
        reg.onupdatefound = () => {
          const newWorker = reg.installing;
          console.log('[SW DEBUG] onupdatefound: newWorker', newWorker);
          if (newWorker) {
            newWorker.onstatechange = () => {
              console.log('[SW DEBUG] newWorker state:', newWorker.state);
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW DEBUG] New service worker installed and controller exists, update available!');
                setUpdateAvailable(true);
              }
            };
          }
        };
      });
      const visHandler = () => {
        if (document.visibilityState === 'visible') {
          console.log('[SW DEBUG] visibilitychange: visible, checking for update');
          checkForUpdateAndWaiting();
        }
      };
      document.addEventListener('visibilitychange', visHandler);

      // Polling periodico per forzare il check anche su schermate statiche (es. manutenzione)
      const intervalId = setInterval(() => {
        console.log('[SW DEBUG] Polling for update...');
        checkForUpdateAndWaiting();
      }, 20000); // ogni 20 secondi

      return () => {
        document.removeEventListener('visibilitychange', visHandler);
        clearInterval(intervalId);
      };
    }
  }, []);

  const updateApp = () => {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg && reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      } else {
        window.location.reload();
      }
    });
  };

  return { updateAvailable, updateApp };
}
