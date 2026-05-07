import { useCallback, useEffect, useRef, useState } from 'react';

export default function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const updateTriggeredRef = useRef(false);
  const registrationRef = useRef(null);

  const checkForUpdate = useCallback(async () => {
    const reg = registrationRef.current;
    if (!reg) return false;

    await reg.update();
    console.log('[SW DEBUG] checkForUpdateAndWaiting: regRef', reg);

    if (reg.waiting) {
      console.log('[SW DEBUG] Service worker in waiting state, update available!');
      setUpdateAvailable(true);
      return true;
    }

    console.log('[SW DEBUG] No waiting service worker found');
    return false;
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return;
        registrationRef.current = reg;
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
          checkForUpdate();
        }
      };
      document.addEventListener('visibilitychange', visHandler);

      // Polling periodico per forzare il check anche su schermate statiche (es. manutenzione)
      const intervalId = setInterval(() => {
        console.log('[SW DEBUG] Polling for update...');
        checkForUpdate();
      }, 20000); // ogni 20 secondi

      return () => {
        document.removeEventListener('visibilitychange', visHandler);
        clearInterval(intervalId);
      };
    }
  }, [checkForUpdate]);

  const updateApp = () => {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg && reg.waiting) {
        const handleControllerChange = () => {
          if (updateTriggeredRef.current) return;
          updateTriggeredRef.current = true;
          navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
          window.location.reload();
        };

        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.setTimeout(() => {
          if (!updateTriggeredRef.current) {
            updateTriggeredRef.current = true;
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
            window.location.reload();
          }
        }, 4000);
      } else {
        window.location.reload();
      }
    });
  };

  return { updateAvailable, updateApp, checkForUpdate };
}
