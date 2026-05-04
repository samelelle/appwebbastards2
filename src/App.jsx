
import React, { useEffect, useState } from 'react';
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
    return <Navigate to="/login" replace />;
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

          let current = null;
          if (session?.user?.email) {
            setUserEmail(session.user.email);
            current = data.find(iscritto => (iscritto.email && iscritto.email.toLowerCase() === session.user.email.toLowerCase()));
          } else if (session?.user?.id) {
            current = data.find(iscritto => String(iscritto.id) === String(session.user.id));
          }

          if (current?.id) {
            localStorage.setItem('bb-my-iscritto-id', String(current.id));
            localStorage.setItem('bb-current-chat-user-id', String(current.id));
            subscribeUserToPush();
            return;
          }

          // User has a valid auth session but is no longer in the iscritti table
          // (registration was removed). Force sign-out so they are redirected to login.
          if (mounted && supabase && (session?.user?.email || session?.user?.id)) {
            await supabase.auth.signOut();
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
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setUserEmail(data.session?.user?.email || '');
        setIsAuthReady(true);
        if (data.session) {
          syncRubricaAndUser(data.session);
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

  return (
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
              <Rubrica isDevMode={isDevUser || devBypassEnabled} />
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

  );
}

export default App;
