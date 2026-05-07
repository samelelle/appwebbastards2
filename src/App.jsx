
import React, { useEffect, useState } from 'react';
import useServiceWorkerUpdate from './hooks/useServiceWorkerUpdate';
import { useLocation } from 'react-router-dom';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import './carnivalee-font.css';
import ScrollToTopOnRouteChange from './components/ScrollToTopOnRouteChange';
import { fetchSharedMaintenanceMode, getCachedMaintenanceMode, updateSharedMaintenanceMode } from './lib/maintenanceMode';
import { canCurrentUserAccessMeetings } from './lib/meetingAccess';
import { hasSupabaseConfig, supabase } from './lib/supabaseClient';
import Eventi from './pages/Eventi';
import Foto from './pages/Foto';
import Home from './pages/Home';
import Login from './pages/Login';
import Mappa from './pages/Mappa';
import Riunioni from './pages/Riunioni';
import Rubrica from './pages/Rubrica';
import QrCodeShare from './components/QrCodeShare';
import ApprovaRegistrazione from './pages/ApprovaRegistrazione';
import { subscribeUserToPush } from './lib/pushSubscription';

const devBypassStorageKey = 'bb-dev-bypass-auth';
const canUseDevBypass = import.meta.env.VITE_DEV_BYPASS_AUTH !== 'false';

function safeGetStorageItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorageItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors on restricted browsers/contexts.
  }
}

function safeRemoveStorageItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors on restricted browsers/contexts.
  }
}

function ProtectedRoute({ isReady, isAuthenticated, children }) {
  if (!isReady) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#111', color: '#fff' }}>
        Caricamento...
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.replace('https://appwebbastards2-3g9t.vercel.app/login');
    return null;
  }

  return children;
}


function App() {
  const { updateAvailable, updateApp, checkForUpdate } = useServiceWorkerUpdate();
  console.log('[APP DEBUG] updateAvailable:', updateAvailable);
  return (
    <Router>
      <ScrollToTopOnRouteChange />
      <AppRoutes updateAvailable={updateAvailable} updateApp={updateApp} checkForUpdate={checkForUpdate} />
    </Router>
  );
}

function AppRoutes({ updateAvailable, updateApp, checkForUpdate }) {
  const location = useLocation();
  const [maintenanceMode, setMaintenanceModeState] = useState(getCachedMaintenanceMode());

  useEffect(() => {
    let active = true;

    async function syncMaintenanceMode() {
      const nextMode = await fetchSharedMaintenanceMode();
      if (active) {
        setMaintenanceModeState(nextMode);
      }
    }

    syncMaintenanceMode();
    const intervalId = window.setInterval(syncMaintenanceMode, 15000);
    window.addEventListener('focus', syncMaintenanceMode);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', syncMaintenanceMode);
    };
  }, []);

  useEffect(() => {
    if (!maintenanceMode) {
      checkForUpdate();
    }
  }, [maintenanceMode, checkForUpdate]);
  // Modalità sviluppo locale disabilitata: sempre false
  const [devBypassEnabled, setDevBypassEnabled] = useState(false);
  // Stato per email utente
  const [userEmail, setUserEmail] = useState('');
  const [session, setSession] = useState(null);
  // isAuthReady parte sempre da false: la Home non viene mai mostrata senza login
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Aggiorna la rubrica ogni volta che cambia schermata
  useEffect(() => {
    let active = true;
    async function refreshAll() {
      try {
        // Rubrica
        const { data: iscritti, error: errIscritti } = await supabase.from('iscritti').select('*');
        if (!errIscritti && Array.isArray(iscritti) && active) {
          localStorage.setItem('bb-rubrica', JSON.stringify(iscritti));
        }
        // Events
        const { data: events, error: errEvents } = await supabase.from('events').select('*');
        if (!errEvents && Array.isArray(events) && active) {
          localStorage.setItem('bb-events', JSON.stringify(events));
        }
        // Meetings
        const { data: meetings, error: errMeetings } = await supabase.from('meetings').select('*');
        if (!errMeetings && Array.isArray(meetings) && active) {
          localStorage.setItem('bb-riunioni', JSON.stringify(meetings));
        }
      } catch {}
    }
    if (!devBypassEnabled && hasSupabaseConfig && supabase) {
      refreshAll();
    }
    return () => { active = false; };
  }, [location.pathname]);


  // Disabilita completamente la modalità sviluppo locale
  useEffect(() => {
    setDevBypassEnabled(false);
    safeRemoveStorageItem(devBypassStorageKey);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
  // ...riga rimossa, export default App va solo alla fine del file
    const updateViewportVars = () => {
      const viewportHeight = Math.max(window.innerHeight || 0, window.visualViewport?.height || 0);
      root.style.setProperty('--bb-app-height', `${Math.round(viewportHeight)}px`);
      root.style.setProperty('--bb-vh', `${viewportHeight * 0.01}px`);
    };

    updateViewportVars();

    window.addEventListener('resize', updateViewportVars);
    window.addEventListener('orientationchange', updateViewportVars);
    window.visualViewport?.addEventListener('resize', updateViewportVars);
    window.visualViewport?.addEventListener('scroll', updateViewportVars);

    return () => {
      window.removeEventListener('resize', updateViewportVars);
      window.removeEventListener('orientationchange', updateViewportVars);
      window.visualViewport?.removeEventListener('resize', updateViewportVars);
      window.visualViewport?.removeEventListener('scroll', updateViewportVars);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function syncRubricaAndUser(session) {
      try {
        const { data, error } = await supabase
          .from('iscritti')
          .select('*');
        if (!error && Array.isArray(data)) {
          localStorage.setItem('bb-rubrica', JSON.stringify(data));
          if (session?.user?.email) {
            setUserEmail(session.user.email);
            const current = data.find(iscritto => (iscritto.email && iscritto.email.toLowerCase() === session.user.email.toLowerCase()));
            if (current && current.id) {
              localStorage.setItem('bb-my-iscritto-id', String(current.id));
              localStorage.setItem('bb-current-chat-user-id', String(current.id));
              subscribeUserToPush();
              return;
            }
          }
          if (session?.user?.id) {
            const current = data.find(iscritto => String(iscritto.id) === String(session.user.id));
            if (current && current.id) {
              localStorage.setItem('bb-my-iscritto-id', String(current.id));
              localStorage.setItem('bb-current-chat-user-id', String(current.id));
              subscribeUserToPush();
            }
          }
        }
      } catch {}
    }

    if (!hasSupabaseConfig || !supabase) {
      setSession(null);
      setUserEmail('');
      setIsAuthReady(true);
      return;
    }

    supabase.auth.getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        if (data.session) {
          // Verifica server-side che l'utente esista ancora
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (!mounted) return;
          if (userError || !userData?.user) {
            // Token non valido o utente eliminato: forza logout
            try { await supabase.auth.signOut(); } catch {}
            localStorage.removeItem('bb-my-iscritto-id');
            localStorage.removeItem('bb-current-chat-user-id');
            localStorage.removeItem('bb-rubrica');
            localStorage.removeItem('bb-chat-hide-msg-ids');
            localStorage.removeItem('bb-rubrica-seen-categories');
            sessionStorage.clear();
            setSession(null);
            setUserEmail('');
            setIsAuthReady(true);
            return;
          }
          setSession(data.session);
          setUserEmail(data.session.user?.email || '');
          setIsAuthReady(true);
          syncRubricaAndUser(data.session);
        } else {
          setSession(null);
          setUserEmail('');
          setIsAuthReady(true);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setUserEmail('');
        setIsAuthReady(true);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setUserEmail(nextSession?.user?.email || '');
      setIsAuthReady(true);
      if (nextSession) {
        syncRubricaAndUser(nextSession);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [devBypassEnabled]);

  // L'utente mmonthz@gmail.com ha sempre i permessi DEV
  const isDevUser = userEmail && userEmail.toLowerCase() === 'mmonthz@gmail.com';
  // L'utente è autenticato solo se esiste una sessione valida
  const isAuthenticated = Boolean(session?.user);

  useEffect(() => {
    if (!userEmail) {
      safeRemoveStorageItem('bb-user-email');
      return;
    }
    safeSetStorageItem('bb-user-email', userEmail);
  }, [userEmail]);

  // Polling: verifica se l'utente autenticato esiste ancora nella tabella iscritti
  useEffect(() => {
    if (!isAuthenticated || !session?.user?.email) return;
    let intervalId;
    let stopped = false;
    async function checkUserStillExists() {
      try {
        const { data, error } = await supabase
          .from('iscritti')
          .select('id')
          .ilike('email', session.user.email);
        if ((!data || data.length === 0) && !error) {
          try { await supabase.auth.signOut(); } catch {}
          localStorage.removeItem('bb-my-iscritto-id');
          localStorage.removeItem('bb-current-chat-user-id');
          localStorage.removeItem('bb-rubrica');
          localStorage.removeItem('bb-chat-hide-msg-ids');
          localStorage.removeItem('bb-rubrica-seen-categories');
          sessionStorage.clear();
          stopped = true;
          window.location.replace('/login');
        }
      } catch {}
    }
    intervalId = setInterval(() => {
      if (!stopped) checkUserStillExists();
    }, 15000);
    return () => { clearInterval(intervalId); stopped = true; };
  }, [isAuthenticated, session?.user?.email]);

  async function handleLogout() {
    if (devBypassEnabled) return;
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  function handleToggleDevBypass() {
    if (!canUseDevBypass) return;
    setDevBypassEnabled(prev => !prev);
    setIsAuthReady(true);
  }

  function handleEnableDevBypass() {
    if (!canUseDevBypass) return;
    setDevBypassEnabled(true);
    setIsAuthReady(true);
  }

  async function handleToggleMaintenance() {
    const nextValue = !maintenanceMode;
    setMaintenanceModeState(nextValue);

    try {
      await updateSharedMaintenanceMode(nextValue);
    } catch {
      setMaintenanceModeState(await fetchSharedMaintenanceMode());
    }
  }

  return (
    <>
      {/* Overlay/modal di aggiornamento forzato se disponibile nuova versione */}
      {updateAvailable && !maintenanceMode && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.85)', color: 'white', zIndex: 99999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontSize: 22
        }}>
          <h2 style={{marginBottom: 16}}>Nuova versione disponibile</h2>
          <p style={{marginBottom: 24}}>Per continuare, aggiorna l'applicazione.</p>
          <button onClick={updateApp} style={{ fontSize: 20, padding: '1em 2em', borderRadius: 8, border: 'none', background: '#fff', color: '#222', cursor: 'pointer', fontWeight: 700 }}>
            Aggiorna
          </button>
        </div>
      )}
      {/* Tasto DEV per attivare/disattivare manutenzione */}
      {/* Il tasto manutenzione ora va inserito in Home.jsx dove serve */}
      <Routes>
        <Route path="/admin/approva" element={<ApprovaRegistrazione />} />
        <Route
          path="/login"
          element={(
            <Login
              isAuthenticated={isAuthenticated}
              hasSupabaseConfig={hasSupabaseConfig}
              isDevBypassEnabled={isDevUser || devBypassEnabled}
              canToggleDevMode={isDevUser ? false : canUseDevBypass}
              onEnableDevMode={handleEnableDevBypass}
            />
          )}
        />
        <Route
          path="/"
          element={(
            <ProtectedRoute isReady={isAuthReady} isAuthenticated={isAuthenticated}>
              <Home
                onLogout={handleLogout}
                userEmail={isDevUser ? 'mmonthz@gmail.com' : (devBypassEnabled ? 'Modalita sviluppo locale' : (session?.user?.email || ''))}
                isDevMode={isDevUser || devBypassEnabled}
                isMaintenanceMode={maintenanceMode}
                canToggleMaintenance={isDevUser}
                onToggleMaintenance={handleToggleMaintenance}
                canToggleDevMode={isDevUser ? false : canUseDevBypass}
                onToggleDevMode={handleToggleDevBypass}
              />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/rubrica"
          element={(
            <ProtectedRoute isReady={isAuthReady} isAuthenticated={isAuthenticated}>
              {maintenanceMode && !isDevUser
                ? <Navigate to="/" replace />
                : <Rubrica isDevMode={isDevUser || devBypassEnabled} maintenanceMode={maintenanceMode} />}
            </ProtectedRoute>
          )}
        />
        <Route
          path="/eventi"
          element={(
            <ProtectedRoute isReady={isAuthReady} isAuthenticated={isAuthenticated}>
              {maintenanceMode && !isDevUser
                ? <Navigate to="/" replace />
                : <Eventi isDevMode={isDevUser || devBypassEnabled} />}
            </ProtectedRoute>
          )}
        />
        <Route
          path="/riunioni"
          element={(
            <ProtectedRoute isReady={isAuthReady} isAuthenticated={isAuthenticated}>
              {maintenanceMode && !isDevUser
                ? <Navigate to="/" replace />
                : ((canCurrentUserAccessMeetings() || isDevUser || devBypassEnabled) ? <Riunioni isDevMode={isDevUser || devBypassEnabled} /> : <Navigate to="/" replace />)}
            </ProtectedRoute>
          )}
        />
        <Route
          path="/foto"
          element={(
            <ProtectedRoute isReady={isAuthReady} isAuthenticated={isAuthenticated}>
              {maintenanceMode && !isDevUser ? <Navigate to="/" replace /> : <Foto />}
            </ProtectedRoute>
          )}
        />
        <Route
          path="/mappa"
          element={(
            <ProtectedRoute isReady={isAuthReady} isAuthenticated={isAuthenticated}>
              {maintenanceMode && !isDevUser ? <Navigate to="/" replace /> : <Mappa />}
            </ProtectedRoute>
          )}
        />
        <Route
          path="/qrcode"
          element={(
            <ProtectedRoute isReady={isAuthReady} isAuthenticated={isAuthenticated}>
              {maintenanceMode && !isDevUser ? <Navigate to="/" replace /> : <QrCodeShare />}
            </ProtectedRoute>
          )}
        />
      </Routes>
    </>
  );
}

export default App;
