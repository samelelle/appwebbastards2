
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
  const [devBypassEnabled, setDevBypassEnabled] = useState(() => {
    if (!canUseDevBypass) return false;
    const stored = safeGetStorageItem(devBypassStorageKey);
    if (stored === 'false') return false;
    if (stored === 'true') return true;
    return true;
  });
  const [session, setSession] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(() => devBypassEnabled || !hasSupabaseConfig);

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
        // Eventi
        const { data: eventi, error: errEventi } = await supabase.from('eventi').select('*');
        if (!errEventi && Array.isArray(eventi) && active) {
          localStorage.setItem('bb-eventi', JSON.stringify(eventi));
        }
        // Riunioni
        const { data: riunioni, error: errRiunioni } = await supabase.from('riunioni').select('*');
        if (!errRiunioni && Array.isArray(riunioni) && active) {
          localStorage.setItem('bb-riunioni', JSON.stringify(riunioni));
        }
      } catch {}
    }
    if (!devBypassEnabled && hasSupabaseConfig && supabase) {
      refreshAll();
    }
    return () => { active = false; };
  }, [location.pathname]);


  useEffect(() => {
    if (!canUseDevBypass) {
      setDevBypassEnabled(false);
      safeRemoveStorageItem(devBypassStorageKey);
      return;
    }
    safeSetStorageItem(devBypassStorageKey, devBypassEnabled ? 'true' : 'false');
  }, [devBypassEnabled]);

  useEffect(() => {
    const root = document.documentElement;
  // ...riga rimossa, export default App va solo alla fine del file
    export default App;
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
    if (devBypassEnabled) {
      setIsAuthReady(true);
      return undefined;
    }

    if (!hasSupabaseConfig || !supabase) {
      return undefined;
    }

    let mounted = true;


    async function syncRubricaAndUser(session) {
      try {
        const { data, error } = await supabase
          .from('iscritti')
          .select('*');
        if (!error && Array.isArray(data)) {
          localStorage.setItem('bb-rubrica', JSON.stringify(data));
          // Cerca sempre per email se presente
          if (session?.user?.email) {
            const current = data.find(iscritto => (iscritto.email && iscritto.email.toLowerCase() === session.user.email.toLowerCase()));
            if (current && current.id) {
              localStorage.setItem('bb-my-iscritto-id', String(current.id));
              localStorage.setItem('bb-current-chat-user-id', String(current.id));
              return;
            }
          }
          // Fallback su id Supabase solo se non c'è match per email
          if (session?.user?.id) {
            const current = data.find(iscritto => String(iscritto.id) === String(session.user.id));
            if (current && current.id) {
              localStorage.setItem('bb-my-iscritto-id', String(current.id));
              localStorage.setItem('bb-current-chat-user-id', String(current.id));
            }
          }
        }
      } catch {}
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setIsAuthReady(true);
      if (data.session) syncRubricaAndUser(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setIsAuthReady(true);
      if (nextSession) syncRubricaAndUser(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [devBypassEnabled]);

  const isAuthenticated = devBypassEnabled || (!hasSupabaseConfig ? false : Boolean(session?.user));

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
        <Route
          path="/login"
          element={(
            <Login
              isAuthenticated={isAuthenticated}
              hasSupabaseConfig={hasSupabaseConfig}
              isDevBypassEnabled={devBypassEnabled}
              canToggleDevMode={canUseDevBypass}
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
                userEmail={devBypassEnabled ? 'Modalita sviluppo locale' : (session?.user?.email || '')}
                isDevMode={devBypassEnabled}
                canToggleDevMode={canUseDevBypass}
                onToggleDevMode={handleToggleDevBypass}
              />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/rubrica"
          element={(
            <ProtectedRoute isReady={isAuthReady} isAuthenticated={isAuthenticated}>
              <Rubrica isDevMode={devBypassEnabled} />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/eventi"
          element={(
            <ProtectedRoute isReady={isAuthReady} isAuthenticated={isAuthenticated}>
              <Eventi isDevMode={devBypassEnabled} />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/riunioni"
          element={(
            <ProtectedRoute isReady={isAuthReady} isAuthenticated={isAuthenticated}>
              {(canCurrentUserAccessMeetings() || devBypassEnabled) ? <Riunioni isDevMode={devBypassEnabled} /> : <Navigate to="/" replace />}
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
      </Routes>

  );
}

export default App;
