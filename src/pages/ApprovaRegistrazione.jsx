import { useEffect, useState } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function ApprovaRegistrazione() {
  const [searchParams] = useSearchParams();
  const [pending, setPending] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [session, setSession] = useState(null);
  const [ruolo, setRuolo] = useState('');
  const [categorie, setCategorie] = useState([]);

  const id = searchParams.get('id');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    console.log('DEBUG: id ricevuto per approvazione:', id);
    supabase
      .from('pending_registrations')
      .select('id, email, ruolo, cognome, nome, telefono, documento')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        console.log('DEBUG: risultato query pending_registrations:', { data, error });
        if (error || !data) {
          setError('Richiesta non trovata.');
        } else {
          setPending(data);
          setRuolo(data.ruolo || '');
        }
        setLoading(false);
      });
  }, [id]);

  if (!id) return <div>ID mancante.</div>;
  if (loading) return <div>Caricamento...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  // Solo admin
  const adminEmail = 'mmonthz@gmail.com';


  async function handleApprove() {
    setError('');
    setSuccess('');
    // Chiamata API backend per approvazione
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/approva-registrazione', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ruolo, categorie }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Errore approvazione');
        return;
      }
      setSuccess('Utente approvato e iscritto creato!');
    } catch (err) {
      setError('Errore di rete o server: ' + err.message);
    }
  }


  const handleReject = async () => {
    setLoading(true);
    await supabase.from('pending_registrations').delete().eq('id', id);
    setLoading(false);
    setSuccess('Richiesta rifiutata. Nessun utente creato.');
    setTimeout(() => window.location.href = '/', 2000);
  };

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', background: '#222', color: '#fff', padding: 24, borderRadius: 12 }}>
      <h2>Approvazione Registrazione</h2>
      <div><b>Email:</b> {pending.email}</div>
      <div><b>Ruolo:</b> <input value={ruolo} onChange={e => setRuolo(e.target.value)} /></div>
      <div><b>Cognome:</b> {pending.cognome}</div>
      <div><b>Nome:</b> {pending.nome}</div>
      <div><b>Telefono:</b> {pending.telefono}</div>
      <div><b>Documento:</b> {pending.documento}</div>
      <div style={{ margin: '12px 0' }}>
        <b>Categorie:</b> <select multiple value={categorie} onChange={e => setCategorie(Array.from(e.target.selectedOptions, o => o.value))} style={{width:'100%',marginTop:4}}>
  <option value="Full">Full</option>
  <option value="Prospect">Prospect</option>
  <option value="Viminale">Viminale</option>
</select>
      </div>
      <button onClick={handleApprove} style={{ padding: '10px 24px', background: '#0c0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', marginRight: 12 }}>Approva</button>
      <button onClick={handleReject} disabled={loading} style={{background: '#e74c3c', color: 'white', padding: '10px 24px', border: 'none', borderRadius: 8, fontWeight: 'bold'}}>Rifiuta</button>
      {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}
      {success && <div style={{ color: 'lime', marginTop: 12 }}>{success}</div>}
    </div>
  );
}
