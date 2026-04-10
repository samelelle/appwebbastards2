import { useEffect, useState } from 'react';
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
  const [devBypassEnabled, setDevBypassEnabled] = useState(() => {
    if (!canUseDevBypass) return false;
    const stored = safeGetStorageItem(devBypassStorageKey);
    if (stored === 'false') return false;
    if (stored === 'true') return true;
    return true;
  });
  const [session, setSession] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(() => devBypassEnabled || !hasSupabaseConfig);

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

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setIsAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setIsAuthReady(true);
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
    <Router>
      <ScrollToTopOnRouteChange />
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
              {(canCurrentUserAccessMeetings() || devBypassEnabled) ? <Riunioni /> : <Navigate to="/" replace />}
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
    </Router>
  );
}

export default App;
