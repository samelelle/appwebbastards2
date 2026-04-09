import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

function Login({ isAuthenticated, hasSupabaseConfig, isDevBypassEnabled, canToggleDevMode, onEnableDevMode }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (isDevBypassEnabled) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!supabase) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'login') {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (loginError) throw loginError;
      } else {
        const { error: registerError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (registerError) throw registerError;
        setSuccess('Registrazione completata. Se richiesto, conferma la mail e poi accedi.');
      }
    } catch (submitError) {
      setError(submitError?.message || 'Errore di autenticazione.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#111', color: '#fff', display: 'grid', placeItems: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: '#1d1d1d', borderRadius: '14px', padding: '22px 18px', boxSizing: 'border-box', border: '1px solid #333' }}>
        <h1 style={{ margin: '0 0 10px 0', color: '#ff6600', fontSize: '1.9rem', textAlign: 'center' }}>Accesso</h1>

        {!hasSupabaseConfig && (
          <div style={{ background: '#2a1c1c', color: '#ffb7b7', border: '1px solid #5d2c2c', borderRadius: '8px', padding: '10px', fontSize: '0.9rem', marginBottom: '12px' }}>
            Configura VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nel file .env per attivare il login.
          </div>
        )}

        {isDevBypassEnabled && (
          <div style={{ background: '#1d2a1d', color: '#b8f7b8', border: '1px solid #2f5d2f', borderRadius: '8px', padding: '10px', fontSize: '0.9rem', marginBottom: '12px' }}>
            Modalita sviluppo attiva: accesso senza login. Imposta VITE_DEV_BYPASS_AUTH=false per riattivare il login.
          </div>
        )}

        {canToggleDevMode && !isDevBypassEnabled && (
          <button
            type="button"
            onClick={onEnableDevMode}
            className="bb-add-btn"
            style={{ width: '100%', marginBottom: '12px', marginLeft: 0 }}
          >
            Entra come sviluppatore (bypass login)
          </button>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ textAlign: 'left', fontSize: '0.88rem' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{ padding: '10px', borderRadius: '8px', border: 'none', fontSize: '1rem' }}
            disabled={!hasSupabaseConfig || loading}
          />

          <label style={{ textAlign: 'left', fontSize: '0.88rem' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            style={{ padding: '10px', borderRadius: '8px', border: 'none', fontSize: '1rem' }}
            disabled={!hasSupabaseConfig || loading}
          />

          {error && <div style={{ color: '#ffb3b3', fontSize: '0.86rem', textAlign: 'left' }}>{error}</div>}
          {success && <div style={{ color: '#b8f7b8', fontSize: '0.86rem', textAlign: 'left' }}>{success}</div>}

          <button
            type="submit"
            className="bb-event-btn"
            disabled={!hasSupabaseConfig || loading}
            style={{ width: '100%', marginTop: '6px' }}
          >
            {loading ? 'Attendere...' : mode === 'login' ? 'Accedi' : 'Registrati'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(prev => (prev === 'login' ? 'register' : 'login'));
            setError('');
            setSuccess('');
          }}
          style={{ marginTop: '12px', background: 'none', border: 'none', color: '#ffb366', cursor: 'pointer', fontSize: '0.9rem' }}
          disabled={loading}
        >
          {mode === 'login' ? 'Non hai un account? Registrati' : 'Hai gia un account? Accedi'}
        </button>
      </div>
    </div>
  );
}

export default Login;