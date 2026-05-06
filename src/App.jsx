
import React, { useEffect, useState } from 'react';
// Chiave localStorage per modalità manutenzione
const maintenanceStorageKey = 'bb-maintenance-mode';
// Funzioni sicure per localStorage modalità manutenzione
function getMaintenanceMode() {
  try {
    return localStorage.getItem(maintenanceStorageKey) === '1';
  } catch {
    return false;
  }
}

function setMaintenanceMode(enabled) {
  try {
    if (enabled) {
      localStorage.setItem(maintenanceStorageKey, '1');
    } else {
      localStorage.removeItem(maintenanceStorageKey);
    }
  } catch {}
}
import { useLocation } from 'react-router-dom';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import './carnivalee-font.css';
import ScrollToTopOnRouteChange from './components/ScrollToTopOnRouteChange';
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
  return (
    <Router>
      <ScrollToTopOnRouteChange />
      <AppRoutes />
    </Router>
  );
}

function AppRoutes() {
  const location = useLocation();
    // Stato modalità manutenzione globale
    const [maintenanceMode, setMaintenanceModeState] = useState(getMaintenanceMode());
    // Aggiorna stato se cambia in localStorage (multi-tab)
    useEffect(() => {
      const handler = (e) => {
        if (e.key === maintenanceStorageKey) {
          setMaintenanceModeState(getMaintenanceMode());
        }
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    }, []);

    // Componente tasto manutenzione DEV

  // Componente MaintenanceToggleButton ora a livello modulo
  import React from 'react';
  export function MaintenanceToggleButton() {
    // Questi valori vanno letti direttamente qui
    const isDevUser = (() => {
      try {
        const email = localStorage.getItem('bb-user-email') || '';
        return email.toLowerCase() === 'mmonthz@gmail.com';
      } catch { return false; }
    })();
    const maintenanceMode = (() => {
      try {
        return localStorage.getItem('bb-maintenance-mode') === '1';
      } catch { return false; }
    })();
    const [mode, setMode] = React.useState(maintenanceMode);
    React.useEffect(() => {
      const handler = () => setMode(localStorage.getItem('bb-maintenance-mode') === '1');
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    }, []);
    if (!isDevUser) return null;
    return (
      <button
        style={{
          margin: '18px auto 0 auto',
          display: 'block',
          background: mode ? '#ff6600' : '#222',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '8px 18px',
          fontWeight: 700,
          fontSize: '1.1rem',
          boxShadow: '0 2px 8px #0006',
          cursor: 'pointer',
        }}
        onClick={() => {
          const newValue = !mode;
          if (newValue) {
            localStorage.setItem('bb-maintenance-mode', '1');
          } else {
            localStorage.removeItem('bb-maintenance-mode');
          }
          setMode(newValue);
        }}
      >
        {mode ? 'DISATTIVA MANUTENZIONE' : 'ATTIVA MANUTENZIONE'}
      </button>
    );
  }
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

  // Se modalità manutenzione attiva e NON DEV, mostra schermata blocco
  if (maintenanceMode && !isDevUser) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111', color: '#fff', fontSize: '1.5rem' }}>
        <div style={{ marginBottom: 32, fontSize: '2.2rem', color: '#ff6600' }}>🛠️ In manutenzione</div>
        <div>L'app è temporaneamente non disponibile.<br />Riprova più tardi.</div>
      </div>
    );
  }

  return (
    <>
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
              <Rubrica isDevMode={isDevUser || devBypassEnabled} maintenanceMode={maintenanceMode} />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/eventi"
          element={(
            <ProtectedRoute isReady={isAuthReady} isAuthenticated={isAuthenticated}>
              <Eventi isDevMode={isDevUser || devBypassEnabled} />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/riunioni"
          element={(
            <ProtectedRoute isReady={isAuthReady} isAuthenticated={isAuthenticated}>
              {(canCurrentUserAccessMeetings() || isDevUser || devBypassEnabled) ? <Riunioni isDevMode={isDevUser || devBypassEnabled} /> : <Navigate to="/" replace />}
            </ProtectedRoute>
          )}
        />
        <Route
          path="/foto"
          element={(
            <ProtectedRoute isReady={isAuthReady} isAuthenticated={isAuthenticated}>
              <Foto />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/mappa"
          element={(
            <ProtectedRoute isReady={isAuthReady} isAuthenticated={isAuthenticated}>
              <Mappa />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/qrcode"
          element={(
            <ProtectedRoute isReady={isAuthReady} isAuthenticated={isAuthenticated}>
              <QrCodeShare />
            </ProtectedRoute>
          )}
        />
      </Routes>
    </>
  );
}

export default App;
