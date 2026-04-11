import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MobileBottomNav from '../components/MobileBottomNav';
import MobilePageShell from '../components/MobilePageShell';
import useIsMobile from '../hooks/useIsMobile';
import { addMeeting, deleteMeeting, getMeetings, updateMeeting } from '../lib/sharedDataApi';

function Riunioni({ isDevMode = false }) {
  const isMobile = useIsMobile();
  const [riunioni, setRiunioni] = useState([]);
  const [syncError, setSyncError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllMeetingsList, setShowAllMeetingsList] = useState(false);

  function parseMeetingDate(dateString) {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  function toMeetingDateTime(riunione) {
    if (!riunione?.data) return null;
    const timePart = riunione.ora && riunione.ora.length >= 4 ? riunione.ora : '23:59';
    return new Date(`${riunione.data}T${timePart}`);
  }

  const now = new Date();
  const prossimaRiunione = riunioni
    .map((r, idx) => ({ ...r, idx }))
    .filter(r => {
      const dt = toMeetingDateTime(r);
      if (!dt) return false;
      return dt >= now;
    })
    .sort((a, b) => toMeetingDateTime(a) - toMeetingDateTime(b))[0];

  const [showProssima, setShowProssima] = useState(false);
  const [detailMeeting, setDetailMeeting] = useState(null);
  const [form, setForm] = useState({ data: '', ora: '', ordine: '' });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ data: '', ora: '', ordine: '' });
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  useEffect(() => {
    let mounted = true;

    async function loadMeetings() {
      try {
        setSyncError('');
        const loaded = await getMeetings();
        if (mounted) setRiunioni(loaded);
      } catch {
        if (mounted) setSyncError('Errore sincronizzazione Riunioni: fallback locale attivo.');
      }
    }

    loadMeetings();
    return () => {
      mounted = false;
    };
  }, []);

  function goToPrevMonth() {
    setSelectedMonth(prev => {
      if (prev === 0) {
        setSelectedYear(y => y - 1);
        return 11;
      }
      return prev - 1;
    });
  }

  function goToNextMonth() {
    setSelectedMonth(prev => {
      if (prev === 11) {
        setSelectedYear(y => y + 1);
        return 0;
      }
      return prev + 1;
    });
  }

  function goToCurrentMonth() {
    setSelectedMonth(today.getMonth());
    setSelectedYear(today.getFullYear());
  }

  const filteredRiunioni = riunioni.filter(r => {
    if (!r.data) return false;
    const d = parseMeetingDate(r.data);
    if (!d) return false;

    if (!showAllMeetingsList) {
      const inSelectedMonth = d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      if (!inSelectedMonth) return false;
    }

    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    const haystack = [
      r.ordine || '',
      r.data || '',
      r.ora || '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });

  function handleInput(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleAddRiunione(e) {
    e.preventDefault();
    if (!form.data || !form.ordine.trim()) {
      setSyncError('Compila data e ordine del giorno prima di salvare la riunione.');
      return;
    }
    try {
      const created = await addMeeting({ data: form.data, ora: form.ora || '', ordine: form.ordine });
      setRiunioni(prev => [...prev, created]);
      setForm({ data: '', ora: '', ordine: '' });
      setSyncError('');
    } catch {
      setSyncError('Errore salvataggio riunione. Riprova.');
    }
  }

  async function handleDelete(meetingId) {
    const confirmed = window.confirm('Vuoi eliminare davvero questa riunione?');
    if (!confirmed) return;

    try {
      await deleteMeeting(meetingId);
      // Refresh from source of truth to avoid stale "prossima riunione" on some devices.
      const refreshed = await getMeetings();
      setRiunioni(refreshed);
      if (editId === meetingId) setEditId(null);
      if (showProssima) setShowProssima(false);
      setSyncError('');
    } catch {
      setSyncError('Errore eliminazione riunione. Riprova.');
    }
  }

  function handleEdit(riunione) {
    setEditId(riunione.id);
    setEditForm({ ora: '', ...riunione });
  }

  function handleEditInput(e) {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  }

  async function handleUpdateRiunione(e) {
    e.preventDefault();
    if (!editId) return;
    if (!editForm.data || !editForm.ordine?.trim()) {
      setSyncError('Compila data e ordine del giorno prima di salvare la modifica.');
      return;
    }
    try {
      const updatedMeeting = await updateMeeting(editId, editForm);
      if (updatedMeeting) {
        setRiunioni(prev => prev.map(item => (item.id === editId ? updatedMeeting : item)));
      }
      setEditId(null);
      setSyncError('');
    } catch {
      setSyncError('Errore aggiornamento riunione. Riprova.');
    }
  }

  const formatDateEuropean = dateString => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  };

  const formatMeetingTime = timeString => {
    if (!timeString) return 'N/D';
    return timeString;
  };

  function handleSearch() {
    setSearchQuery(searchText.trim());
    setSearchText('');
  }

  return (
    <div
      className="bb-page riunioni-screen"
      style={{ height: 'var(--bb-app-height, 100dvh)', background: '#111', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: isMobile ? 0 : '48px', paddingBottom: 0, position: isMobile ? 'fixed' : 'relative', inset: isMobile ? 0 : 'auto', overflow: 'hidden', overflowX: 'hidden', width: '100%' }}
    >
      <MobilePageShell title="RIUNIONI B.B." />
      {!isMobile && <Link to="/" className="bb-back-btn">&#8592; Home</Link>}
      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: '24px' }}>
          <h1 className="bb-title" style={{ margin: 0 }}>RIUNIONI B.B.</h1>
        </div>
      )}

      <div
        className="riunioni-content"
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'flex-start',
          gap: isMobile ? 'clamp(8px, 2.4vw, 14px)' : '32px',
          marginTop: isMobile ? '0' : '3cm',
          marginBottom: '0',
          width: '100%',
          maxWidth: '1100px',
          justifyContent: isMobile ? 'flex-start' : 'center',
          padding: isMobile ? '0 clamp(10px, 3vw, 16px) 16px' : 0,
          boxSizing: 'border-box',
          flex: isMobile ? '0 0 auto' : '1 1 auto',
          height: isMobile ? 'calc(100dvh - var(--bb-mobile-bottom-nav-height, 94px) - 8px)' : 'auto',
          maxHeight: isMobile ? 'calc(100dvh - var(--bb-mobile-bottom-nav-height, 94px) - 8px)' : 'none',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingTop: isMobile ? 'calc(var(--bb-mobile-shell-height, 94px) + clamp(16px, 4.4vw, 30px))' : 0,
          paddingBottom: isMobile ? 'calc(var(--bb-mobile-bottom-nav-height, 94px) + clamp(16px, 4.4vw, 30px))' : 0,
        }}
      >
          <div className="riunioni-main-column" style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 'clamp(8px, 2.2vw, 10px)' : '18px', maxWidth: '100%', width: '100%', boxSizing: 'border-box', minWidth: 0 }}>
          {syncError && <div style={{ color: '#ffb366', fontSize: isMobile ? '0.84rem' : '0.9rem' }}>{syncError}</div>}
          <div className="riunioni-toolbar" style={{ background: '#222', borderRadius: '12px', padding: isMobile ? 'clamp(8px, 2.6vw, 12px)' : '10px 18px', display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2.2vw, 12px)', width: '100%', justifyContent: 'center', boxSizing: 'border-box', flexWrap: 'wrap', overflowX: 'hidden' }}>
            <button onClick={goToPrevMonth} style={{ background: '#fff', color: '#222', border: '1px solid #bbb', borderRadius: '6px', padding: isMobile ? '2px 8px' : '2px 10px', fontSize: isMobile ? '0.88em' : '0.95em', cursor: 'pointer' }}>{'<'}</button>
            <span style={{ fontWeight: 600, fontSize: isMobile ? 'clamp(0.88rem, 3.3vw, 1rem)' : 'clamp(0.95rem, 3.6vw, 1.1rem)', color: '#ff6600', textAlign: 'center', flex: '1 1 140px', minWidth: 0, wordBreak: 'break-word', lineHeight: 1.1 }}>{['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][selectedMonth]} {selectedYear}</span>
            <button onClick={goToNextMonth} style={{ background: '#fff', color: '#222', border: '1px solid #bbb', borderRadius: '6px', padding: isMobile ? '2px 8px' : '2px 10px', fontSize: isMobile ? '0.88em' : '0.95em', cursor: 'pointer' }}>{'>'}</button>
            <button onClick={goToCurrentMonth} style={{ background: '#ff6600', color: '#fff', border: 'none', borderRadius: '6px', padding: isMobile ? '2px 8px' : '2px 10px', fontSize: isMobile ? '0.88em' : '0.95em', cursor: 'pointer', marginLeft: '8px' }}>Oggi</button>
          </div>

          <div style={{ width: '100%', background: '#222', borderRadius: '12px', padding: isMobile ? '8px' : '10px 12px', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Cerca nelle riunioni (es. parola, data, ora)"
              style={{ flex: 1, padding: isMobile ? '8px' : '9px', borderRadius: '8px', border: '1px solid #555', background: '#111', color: '#fff', boxSizing: 'border-box' }}
            />
            <button
              type="button"
              className="bb-add-btn"
              onClick={handleSearch}
              style={{ marginLeft: 0, width: 'auto', minWidth: '78px', alignSelf: 'stretch' }}
            >
              Cerca
            </button>
          </div>

          <form className="riunioni-form" onSubmit={handleAddRiunione} style={{ background: '#222', borderRadius: '12px', padding: isMobile ? 'clamp(10px, 2.6vw, 12px)' : '18px', width: '100%', maxWidth: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: isMobile ? '7px' : '10px', boxSizing: 'border-box', overflowX: 'hidden' }}>
            <label style={{ fontWeight: 600, fontSize: isMobile ? 'clamp(0.84rem, 2.8vw, 0.94rem)' : 'clamp(0.9rem, 3vw, 1rem)' }}>Data riunione:</label>
            <input className="bb-date-input" name="data" type="date" value={form.data} onChange={handleInput} style={{ padding: isMobile ? '6px' : '7px', borderRadius: '6px', fontSize: isMobile ? '1rem' : 'clamp(0.95rem, 3vw, 1rem)', width: '100%', boxSizing: 'border-box' }} />
            <label style={{ fontWeight: 600, fontSize: isMobile ? 'clamp(0.84rem, 2.8vw, 0.94rem)' : 'clamp(0.9rem, 3vw, 1rem)' }}>Ora riunione:</label>
            <input className="bb-time-input" name="ora" type="time" value={form.ora} onChange={handleInput} style={{ padding: isMobile ? '6px' : '7px', borderRadius: '6px', fontSize: isMobile ? '1rem' : 'clamp(0.95rem, 3vw, 1rem)', width: '100%', boxSizing: 'border-box' }} />
            <label style={{ fontWeight: 600, fontSize: isMobile ? 'clamp(0.84rem, 2.8vw, 0.94rem)' : 'clamp(0.9rem, 3vw, 1rem)' }}>Ordine del giorno:</label>
            <textarea name="ordine" value={form.ordine} onChange={handleInput} placeholder="Ordine del giorno" style={{ padding: isMobile ? '6px' : '7px', borderRadius: '6px', border: 'none', minHeight: isMobile ? '44px' : '48px', fontSize: isMobile ? '1rem' : 'clamp(0.95rem, 3vw, 1rem)', resize: 'vertical', width: '100%', boxSizing: 'border-box' }} />
            <button className="bb-event-btn" type="submit" style={{ marginTop: '8px', fontSize: isMobile ? 'clamp(0.84rem, 2.9vw, 0.92rem)' : 'clamp(0.92rem, 3vw, 1rem)', padding: isMobile ? '7px 0' : '8px 0', borderRadius: '6px', width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>Aggiungi riunione</button>
          </form>

          <div className="riunioni-list-area" style={{ width: '100%', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <h2 style={{ color: '#ff6600', fontSize: isMobile ? '1rem' : '1.1rem', margin: 0, textAlign: 'left' }}>
                {showAllMeetingsList ? 'Tutte le riunioni inserite' : 'Riunioni del mese'}
              </h2>
              <button
                type="button"
                className="bb-add-btn"
                onClick={() => setShowAllMeetingsList(prev => !prev)}
                style={{ width: 'auto', minWidth: '126px', padding: '4px 10px', fontSize: isMobile ? '0.76rem' : '0.8rem', marginTop: 0 }}
              >
                {showAllMeetingsList ? 'Vedi mese corrente' : 'Mostra tutte'}
              </button>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {filteredRiunioni.length === 0 && (
                <li style={{ color: '#bbb', fontSize: isMobile ? '0.86em' : '0.92em', textAlign: 'left' }}>
                  {searchQuery.trim()
                    ? 'Nessuna riunione trovata per la ricerca.'
                    : (showAllMeetingsList ? 'Nessuna riunione inserita.' : 'Nessuna riunione nel mese selezionato.')}
                </li>
              )}
              {filteredRiunioni.map(r => {
                return (
                  <li
                    key={r.id}
                    style={{
                      background: '#222',
                      borderRadius: '6px',
                      marginBottom: '6px',
                      padding: isMobile ? '5px 7px' : '6px 8px',
                      color: '#fff',
                      boxShadow: '0 1px 3px #0005',
                      position: 'relative',
                      fontSize: isMobile ? '0.84em' : '0.92em',
                      minHeight: '32px',
                      lineHeight: 1.2,
                      textAlign: 'left',
                    }}
                  >
                    {editId === r.id ? (
                      <form onSubmit={handleUpdateRiunione} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <input className="bb-date-input" name="data" type="date" value={editForm.data} onChange={handleEditInput} style={{ padding: '4px', borderRadius: '4px', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }} />
                        <input className="bb-time-input" name="ora" type="time" value={editForm.ora || ''} onChange={handleEditInput} style={{ padding: '4px', borderRadius: '4px', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }} />
                        <textarea name="ordine" value={editForm.ordine} onChange={handleEditInput} placeholder="Ordine del giorno" style={{ padding: '4px', borderRadius: '4px', border: 'none', minHeight: '28px', fontSize: '1rem', resize: 'vertical', width: '100%', boxSizing: 'border-box' }} />
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                          <button type="submit" style={{ background: '#ff6600', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 10px', fontSize: '0.85em', cursor: 'pointer' }}>Salva</button>
                          <button type="button" onClick={() => setEditId(null)} style={{ background: '#bbb', color: '#222', border: 'none', borderRadius: '4px', padding: '2px 10px', fontSize: '0.85em', cursor: 'pointer' }}>Annulla</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div style={{ fontSize: '0.98em' }}><b>Data:</b> {formatDateEuropean(r.data)}</div>
                        <div style={{ fontSize: '0.98em', marginTop: '2px' }}><b>Ora:</b> {formatMeetingTime(r.ora)}</div>
                        <div style={{ marginTop: '3px', whiteSpace: 'pre-line', fontSize: '0.92em' }}><b>Ordine del giorno:</b><br />{r.ordine}</div>
                        <div
                          style={{
                            position: isMobile ? 'static' : 'absolute',
                            top: isMobile ? 'auto' : 6,
                            right: isMobile ? 'auto' : 8,
                            display: 'flex',
                            flexWrap: isMobile ? 'wrap' : 'nowrap',
                            gap: '4px',
                            marginTop: isMobile ? '6px' : 0,
                          }}
                        >
                          <button onClick={() => setDetailMeeting(r)} style={{ background: '#5a4bff', color: '#fff', border: 'none', borderRadius: '4px', padding: isMobile ? '2px 6px' : '1px 7px', fontSize: '0.85em', cursor: 'pointer' }}>Dettaglio</button>
                          {isDevMode && (
                            <>
                              <button onClick={() => handleEdit(r)} style={{ background: '#ffb366', color: '#222', border: 'none', borderRadius: '4px', padding: isMobile ? '2px 6px' : '1px 7px', fontSize: '0.85em', cursor: 'pointer' }}>Modifica</button>
                              <button onClick={() => handleDelete(r.id)} style={{ background: '#ff4444', color: '#fff', border: 'none', borderRadius: '4px', padding: isMobile ? '2px 6px' : '1px 7px', fontSize: '0.85em', cursor: 'pointer' }}>Elimina</button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="riunioni-summary" style={{ background: '#222', borderRadius: '12px', padding: isMobile ? '12px 18px' : '14px 22px', minWidth: 0, maxWidth: isMobile ? '100%' : '320px', width: isMobile ? '100%' : 'auto', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', boxShadow: '0 2px 12px #0008', boxSizing: 'border-box' }}>
          <div style={{ fontWeight: 700, fontSize: isMobile ? '1em' : '1.08em', color: '#ff6600', marginBottom: '6px' }}>Prossima riunione</div>
          {prossimaRiunione ? (
            <>
              <div style={{ fontSize: isMobile ? '0.96em' : '1.05em', marginBottom: '4px' }}><b>Data:</b> {formatDateEuropean(prossimaRiunione.data)}</div>
              <div style={{ fontSize: isMobile ? '0.96em' : '1.05em', marginBottom: '8px' }}><b>Ora:</b> {formatMeetingTime(prossimaRiunione.ora)}</div>
              <button onClick={() => setShowProssima(true)} style={{ background: '#ffb366', color: '#222', border: 'none', borderRadius: '5px', padding: isMobile ? '3px 12px' : '3px 14px', fontSize: isMobile ? '0.9em' : '0.98em', cursor: 'pointer', fontWeight: 600 }}>Apri info</button>
            </>
          ) : (
            <div style={{ color: '#bbb', fontSize: isMobile ? '0.9em' : '0.98em' }}>Nessuna riunione futura</div>
          )}
        </div>
      </div>

      {showProssima && prossimaRiunione && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
          }}
        >
          <div className="riunioni-modal" style={{ background: '#222', color: '#fff', borderRadius: '16px', padding: '32px', width: 'min(90vw, 320px)', maxWidth: '90vw', boxShadow: '0 4px 24px #000a', position: 'relative', boxSizing: 'border-box' }}>
            <button onClick={() => setShowProssima(false)} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', color: '#ff6600', fontSize: '2rem', cursor: 'pointer' }} title="Chiudi">&times;</button>
            <h2 style={{ color: '#ff6600', marginTop: 0 }}>Prossima riunione</h2>
            <div style={{ marginBottom: '12px' }}><b>Data:</b> {formatDateEuropean(prossimaRiunione.data)}</div>
            <div style={{ marginBottom: '12px' }}><b>Ora:</b> {formatMeetingTime(prossimaRiunione.ora)}</div>
            <div style={{ marginBottom: '12px', whiteSpace: 'pre-line' }}><b>Ordine del giorno:</b><br />{prossimaRiunione.ordine}</div>
          </div>
        </div>
      )}

      {detailMeeting && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3100,
          }}
        >
          <div style={{ background: '#222', color: '#fff', borderRadius: '16px', padding: '32px', width: 'min(90vw, 360px)', maxWidth: '90vw', boxShadow: '0 4px 24px #000a', position: 'relative', boxSizing: 'border-box' }}>
            <button onClick={() => setDetailMeeting(null)} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', color: '#ff6600', fontSize: '2rem', cursor: 'pointer' }} title="Chiudi">&times;</button>
            <h2 style={{ color: '#ff6600', marginTop: 0 }}>Dettaglio riunione</h2>
            <div style={{ marginBottom: '12px' }}><b>Data:</b> {formatDateEuropean(detailMeeting.data)}</div>
            <div style={{ marginBottom: '12px' }}><b>Ora:</b> {formatMeetingTime(detailMeeting.ora)}</div>
            <div style={{ marginBottom: '12px', whiteSpace: 'pre-line' }}><b>Ordine del giorno:</b><br />{detailMeeting.ordine}</div>
          </div>
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}

export default Riunioni;
