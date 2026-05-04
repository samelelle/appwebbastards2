import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

function Login({ isAuthenticated, hasSupabaseConfig, isDevBypassEnabled, canToggleDevMode, onEnableDevMode }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ruolo, setRuolo] = useState('');
  const [cognome, setCognome] = useState('');
  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [documento, setDocumento] = useState('');
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
        // Send registration info to backend for admin notification

        const registrationData = {
          email: email.trim(),
          password,
          ruolo: ruolo.trim(),
          cognome: cognome.trim(),
          nome: nome.trim(),
          telefono: telefono.trim(),
          documento: documento.trim(),
        };

        // Call backend endpoint to notify admin (to be implemented)
        await fetch('/api/register-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(registrationData),
        });

        // Optionally, you can still create a Supabase user in a disabled/pending state, or just wait for admin approval
        setSuccess('Registrazione inviata. Attendi approvazione dall\'amministratore.');
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

        {/* Nessuna modalità sviluppatore, nessun bypass login */}


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

          {mode === 'register' && (
            <>
              <label style={{ textAlign: 'left', fontSize: '0.88rem' }}>Ruolo</label>
              <input
                type="text"
                value={ruolo}
                onChange={e => setRuolo(e.target.value)}
                required
                style={{ padding: '10px', borderRadius: '8px', border: 'none', fontSize: '1rem' }}
                disabled={loading}
              />

              <label style={{ textAlign: 'left', fontSize: '0.88rem' }}>Cognome</label>
              <input
                type="text"
                value={cognome}
                onChange={e => setCognome(e.target.value)}
                required
                style={{ padding: '10px', borderRadius: '8px', border: 'none', fontSize: '1rem' }}
                disabled={loading}
              />

              <label style={{ textAlign: 'left', fontSize: '0.88rem' }}>Nome</label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                required
                style={{ padding: '10px', borderRadius: '8px', border: 'none', fontSize: '1rem' }}
                disabled={loading}
              />

              <label style={{ textAlign: 'left', fontSize: '0.88rem' }}>Telefono</label>
              <input
                type="tel"
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                required
                style={{ padding: '10px', borderRadius: '8px', border: 'none', fontSize: '1rem' }}
                disabled={loading}
              />

              <label style={{ textAlign: 'left', fontSize: '0.88rem' }}>Numero carta d'identità o patente</label>
              <input
                type="text"
                value={documento}
                onChange={e => setDocumento(e.target.value)}
                required
                style={{ padding: '10px', borderRadius: '8px', border: 'none', fontSize: '1rem' }}
                disabled={loading}
              />
            </>
          )}

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