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
    supabase
      .from('pending_registrations')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
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
  if (!session || session.user.email !== adminEmail) {
    return <div>Accesso negato. Solo l'amministratore può approvare.</div>;
  }

  async function handleApprove() {
    setError('');
    setSuccess('');
    // 1. Crea utente su Supabase Auth
    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email: pending.email,
      password: pending.password,
      email_confirm: true,
    });
    if (userError) {
      setError('Errore creazione utente: ' + userError.message);
      return;
    }
    // 2. Inserisci in iscritti
    const { error: iscrittiError } = await supabase.from('iscritti').insert([
      {
        email: pending.email,
        ruolo: ruolo,
        cognome: pending.cognome,
        nome: pending.nome,
        telefono: pending.telefono,
        categorie: categorie.length ? categorie : [ruolo],
      },
    ]);
    if (iscrittiError) {
      setError('Utente creato, ma errore su iscritti: ' + iscrittiError.message);
      return;
    }
    // 3. Elimina la richiesta pending
    await supabase.from('pending_registrations').delete().eq('id', id);
    setSuccess('Utente approvato e iscritto creato!');
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', background: '#222', color: '#fff', padding: 24, borderRadius: 12 }}>
      <h2>Approvazione Registrazione</h2>
      <div><b>Email:</b> {pending.email}</div>
  const handleReject = async () => {
    setLoading(true);
    // Elimina la richiesta pending
    await supabase.from('pending_registrations').delete().eq('id', id);
    setLoading(false);
    setSuccess('Richiesta rifiutata. Nessun utente creato.');
    setTimeout(() => navigate('/'), 2000);
  };
      <div><b>Ruolo:</b> <input value={ruolo} onChange={e => setRuolo(e.target.value)} /></div>
      <div><b>Cognome:</b> {pending.cognome}</div>
      <div><b>Nome:</b> {pending.nome}</div>
      <div><b>Telefono:</b> {pending.telefono}</div>
      <div><b>Documento:</b> {pending.documento}</div>
      <div style={{ margin: '12px 0' }}>
        <b>Categorie:</b> <input value={categorie.join(',')} onChange={e => setCategorie(e.target.value.split(',').map(s => s.trim()))} placeholder="es: Full, Viminale" />
      </div>
      <button onClick={handleApprove} style={{ padding: '10px 24px', background: '#0c0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold' }}>Approva</button>
      {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}
      {success && <div style={{ color: 'lime', marginTop: 12 }}>{success}</div>}
    </div>
  );
}
      <button onClick={handleReject} disabled={loading} style={{background: '#e74c3c', color: 'white'}}>Rifiuta</button>
