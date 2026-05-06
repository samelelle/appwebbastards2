import { useEffect, useState } from 'react';

export default function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let regRef = null;
    async function checkForUpdateAndWaiting() {
      if (regRef) {
        await regRef.update();
        // Se c'è già un worker waiting, mostra subito il banner
        if (regRef.waiting) {
          setUpdateAvailable(true);
        }
      }
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return;
        regRef = reg;
        // Se c'è già un worker waiting (es. dopo deploy), mostra subito il banner
        if (reg.waiting) {
          setUpdateAvailable(true);
        }
        reg.onupdatefound = () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.onstatechange = () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            };
          }
        };
      });
      const visHandler = () => {
        if (document.visibilityState === 'visible') {
          checkForUpdateAndWaiting();
        }
      };
      document.addEventListener('visibilitychange', visHandler);
      return () => {
        document.removeEventListener('visibilitychange', visHandler);
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
