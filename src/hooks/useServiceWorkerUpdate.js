import { useCallback, useEffect, useRef, useState } from 'react';

export default function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const updateTriggeredRef = useRef(false);
  const registrationRef = useRef(null);
  const loadedBuildVersionRef = useRef('');

  const getScriptFileName = useCallback((scriptUrl) => {
    if (!scriptUrl) return '';
    try {
      const url = new URL(scriptUrl, window.location.origin);
      const parts = url.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || '';
    } catch {
      return '';
    }
  }, []);

  const fetchManifestVersion = useCallback(async () => {
    const response = await fetch('/sw-manifest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('sw-manifest.json request failed');
    const data = await response.json();
    return {
      sw: typeof data?.sw === 'string' ? data.sw : '',
      version: typeof data?.version === 'string' ? data.version : '',
    };
  }, []);

  const checkManifestVersion = useCallback(async ({ initialize = false } = {}) => {
    let manifest = { sw: '', version: '' };
    try {
      manifest = await fetchManifestVersion();
    } catch {
      return false;
    }

    const manifestVersion = manifest.version || manifest.sw;

    if (!loadedBuildVersionRef.current) {
      const controllerVersion = getScriptFileName(navigator.serviceWorker.controller?.scriptURL);
      loadedBuildVersionRef.current = manifestVersion || controllerVersion;
      console.log('[SW DEBUG] Loaded build version initialized as:', loadedBuildVersionRef.current);
    }

    if (initialize) {
      loadedBuildVersionRef.current = loadedBuildVersionRef.current || manifestVersion;
      return false;
    }

    if (manifestVersion && loadedBuildVersionRef.current && manifestVersion !== loadedBuildVersionRef.current) {
      console.log('[SW DEBUG] Manifest version differs from loaded version:', loadedBuildVersionRef.current, manifestVersion);
      setUpdateAvailable(true);
      return true;
    }

    return false;
  }, [fetchManifestVersion, getScriptFileName]);

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
    let manifestHasUpdate = false;

    manifestHasUpdate = await checkManifestVersion();

    if (!reg) return manifestHasUpdate;

    await reg.update();
    console.log('[SW DEBUG] checkForUpdateAndWaiting: regRef', reg);

    if (reg.waiting) {
      console.log('[SW DEBUG] Service worker in waiting state, update available!');
      setUpdateAvailable(true);
      return true;
    }

    if (reg.installing) {
      watchInstallingWorker(reg.installing);
    }

    console.log('[SW DEBUG] No waiting service worker found');
    return manifestHasUpdate;
  }, [checkManifestVersion, watchInstallingWorker]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      checkManifestVersion({ initialize: true });
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
      window.addEventListener('focus', pageShowHandler);

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
        window.removeEventListener('focus', pageShowHandler);
        navigator.serviceWorker.removeEventListener('message', swMessageHandler);
        clearInterval(intervalId);
      };
    }
  }, [attachRegistration, checkForUpdate, checkManifestVersion]);

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
