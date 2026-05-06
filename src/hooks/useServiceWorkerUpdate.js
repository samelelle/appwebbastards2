import { useEffect, useState } from 'react';

export default function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let regRef = null;
    function checkForUpdate() {
      if (regRef) {
        regRef.update();
      }
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return;
        regRef = reg;
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
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForUpdate();
        }
      });
    }
    return () => {
      document.removeEventListener('visibilitychange', checkForUpdate);
    };
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
