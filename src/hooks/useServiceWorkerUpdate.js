import { useCallback, useEffect, useRef, useState } from 'react';

export default function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const updateTriggeredRef = useRef(false);
  const registrationRef = useRef(null);

  const watchInstallingWorker = useCallback((worker) => {
    if (!worker) return;

    console.log('[SW DEBUG] watchInstallingWorker:', worker.state);
    worker.onstatechange = () => {
      console.log('[SW DEBUG] newWorker state:', worker.state);
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        console.log('[SW DEBUG] New service worker installed and controller exists, update available!');
        setUpdateAvailable(true);
      }
    };
  }, []);

  const attachRegistration = useCallback((reg, source = 'unknown') => {
    if (!reg) return;

    registrationRef.current = reg;
    console.log(`[SW DEBUG] Registration attached from ${source}:`, reg);

    if (reg.waiting) {
      console.log('[SW DEBUG] Service worker already waiting at attach, update available!');
      setUpdateAvailable(true);
    }

    if (reg.installing) {
      watchInstallingWorker(reg.installing);
    }

    reg.onupdatefound = () => {
      const newWorker = reg.installing;
      console.log('[SW DEBUG] onupdatefound: newWorker', newWorker);
      watchInstallingWorker(newWorker);
    };
  }, [watchInstallingWorker]);

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
        attachRegistration(reg, 'getRegistration');
      });
      const registeredHandler = (event) => {
        attachRegistration(event.detail?.registration ?? null, 'main-register');
      };
      const visHandler = () => {
        if (document.visibilityState === 'visible') {
          console.log('[SW DEBUG] visibilitychange: visible, checking for update');
          checkForUpdate();
        }
      };
      const pageShowHandler = () => {
        console.log('[SW DEBUG] pageshow: checking for update');
        checkForUpdate();
      };
      document.addEventListener('visibilitychange', visHandler);
      window.addEventListener('pageshow', pageShowHandler);
      window.addEventListener('bb-sw-registered', registeredHandler);

      // Listener per messaggi dal service worker
      const swMessageHandler = (event) => {
        if (event.data && event.data.type === 'SW_UPDATE_AVAILABLE') {
          console.log('[SW DEBUG] Ricevuto messaggio SW_UPDATE_AVAILABLE');
          setUpdateAvailable(true);
        }
      };
      navigator.serviceWorker.addEventListener('message', swMessageHandler);

      // Polling periodico per forzare il check anche su schermate statiche (es. manutenzione)
      const intervalId = setInterval(() => {
        console.log('[SW DEBUG] Polling for update...');
        checkForUpdate();
      }, 20000); // ogni 20 secondi

      return () => {
        document.removeEventListener('visibilitychange', visHandler);
        window.removeEventListener('pageshow', pageShowHandler);
        window.removeEventListener('bb-sw-registered', registeredHandler);
        navigator.serviceWorker.removeEventListener('message', swMessageHandler);
        clearInterval(intervalId);
      };
    }
  }, [attachRegistration, checkForUpdate]);

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
