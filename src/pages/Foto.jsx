import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MobileBottomNav from '../components/MobileBottomNav';
import MobilePageShell from '../components/MobilePageShell';
import useIsMobile from '../hooks/useIsMobile';
import { supabase } from '../lib/supabaseClient';

function normalizeFotoItem(item) {
  if (!item) return item;
  return {
    ...item,
    mediaType: item.mediaType || item.media_type || (item.video ? 'video' : 'image'),
    created_at: item.created_at || item.createdAt || null,
  };
}

function Foto() {
  const [gruppoSelezionato, setGruppoSelezionato] = useState('');
  const isMobile = useIsMobile();
  const [editingDescriptionId, setEditingDescriptionId] = useState(null);
  const [editingDescriptionText, setEditingDescriptionText] = useState('');
  const [fotoItems, setFotoItems] = useState([]);
  const [commento, setCommento] = useState('');
  const [media, setMedia] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [gruppo, setGruppo] = useState('');
  const [nuovoGruppo, setNuovoGruppo] = useState('');
  const [erroreSalvataggio, setErroreSalvataggio] = useState('');
  const [erroreCaricamento, setErroreCaricamento] = useState('');

  useEffect(() => {
    if (gruppoSelezionato && gruppoSelezionato !== '__no_group__') {
      setGruppo(gruppoSelezionato);
      setNuovoGruppo('');
    } else if (!gruppoSelezionato) {
      setGruppo('');
      setNuovoGruppo('');
    }
  }, [gruppoSelezionato]);

  const gruppi = Array.from(new Set(fotoItems.map(f => f.gruppo).filter(Boolean)));

  useEffect(() => {
    fetchFoto();
  }, []);

  async function fetchFoto() {
    const { data, error } = await supabase
      .from('foto')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setErroreCaricamento(error.message || 'Errore durante il caricamento delle foto.');
      return;
    }

    setErroreCaricamento('');
    setFotoItems((data || []).map(normalizeFotoItem));
  }

  useEffect(() => {
    const rootEl = document.getElementById('root');
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    const prevRootOverflow = rootEl ? rootEl.style.overflow : '';

    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    if (rootEl) rootEl.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      if (rootEl) rootEl.style.overflow = prevRootOverflow;
    };
  }, []);

  function handleMediaChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setMedia(reader.result);
      setMediaType(isVideo ? 'video' : 'image');
    };
    reader.readAsDataURL(file);
  }

  async function handleAddFoto(e) {
    e.preventDefault();
    setErroreSalvataggio('');
    if (!media) {
      return;
    }

    let gruppoFinale = gruppo;
    if (nuovoGruppo.trim()) {
      gruppoFinale = nuovoGruppo.trim();
    }

    const nuovoItem = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      image: mediaType === 'image' ? media : null,
      video: mediaType === 'video' ? media : null,
      mediaType,
      commento: commento.trim(),
      gruppo: gruppoFinale,
      created_at: new Date().toISOString(),
    };

    if (!supabase) {
      setErroreSalvataggio('Errore di configurazione Supabase.');
      return;
    }

    const { error } = await supabase.from('foto').insert([nuovoItem]);
    if (error) {
      setErroreSalvataggio(error.message || 'Errore durante il salvataggio.');
      return;
    }

    const normalizedItem = normalizeFotoItem(nuovoItem);
    setFotoItems(prev => [normalizedItem, ...prev.filter(item => item.id !== normalizedItem.id)]);
    setErroreCaricamento('');
    setGruppoSelezionato(gruppoFinale || '__no_group__');

    fetchFoto();
    setMedia('');
    setMediaType('');
    setCommento('');
    setGruppo('');
    setNuovoGruppo('');
  }

  function handleStartEditDescription(item) {
    setEditingDescriptionId(item.id);
    setEditingDescriptionText(item.commento || '');
  }

  async function handleSaveDescription(itemId) {
    const { error } = await supabase
      .from('foto')
      .update({ commento: editingDescriptionText.trim() })
      .eq('id', itemId);
    if (!error) fetchFoto();
    setEditingDescriptionId(null);
    setEditingDescriptionText('');
  }

  async function handleDeleteDescription(itemId) {
    const { error } = await supabase
      .from('foto')
      .update({ commento: '' })
      .eq('id', itemId);
    if (!error) fetchFoto();
    if (editingDescriptionId === itemId) {
      setEditingDescriptionId(null);
      setEditingDescriptionText('');
    }
  }

  async function handleDeleteFoto(itemId) {
    const confirmed = window.confirm('Vuoi eliminare questa foto?');
    if (!confirmed) return;

    await supabase.from('foto').delete().eq('id', itemId);
    fetchFoto();
    if (editingDescriptionId === itemId) {
      setEditingDescriptionId(null);
      setEditingDescriptionText('');
    }
  }

  return (
    <div
      className="bb-page"
      style={{ height: 'var(--bb-app-height, 100dvh)', background: '#111', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: isMobile ? 0 : '48px', paddingBottom: 0, position: 'fixed', inset: 0, overflow: 'hidden' }}
    >
      <MobilePageShell title="FOTO" />
      {!isMobile && <Link to="/" className="bb-back-btn">&#8592; Home</Link>}
      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: '24px' }}>
          <h1 className="bb-title" style={{ margin: 0 }}>FOTO</h1>
        </div>
      )}

      <div style={{ width: '100%', maxWidth: '700px', padding: isMobile ? 'calc(var(--bb-mobile-shell-height, 94px) + clamp(18px, 4vw, 28px)) clamp(10px, 3vw, 16px) calc(var(--bb-mobile-bottom-nav-height, 94px) + clamp(18px, 4vw, 28px)) clamp(10px, 3vw, 16px)' : '0 16px 24px 16px', boxSizing: 'border-box', flex: isMobile ? '0 0 auto' : '1 1 auto', height: isMobile ? 'calc(100dvh - var(--bb-mobile-bottom-nav-height, 94px) - 8px)' : 'auto', maxHeight: isMobile ? 'calc(100dvh - var(--bb-mobile-bottom-nav-height, 94px) - 8px)' : 'none', overflowY: 'auto', overflowX: 'hidden' }}>
        <form onSubmit={handleAddFoto} style={{ background: '#222', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
          {erroreCaricamento && (
            <div style={{ color: '#ffb366', fontWeight: 600, marginBottom: '8px' }}>{erroreCaricamento}</div>
          )}
          {erroreSalvataggio && (
            <div style={{ color: '#ff4444', fontWeight: 600, marginBottom: '8px' }}>{erroreSalvataggio}</div>
          )}
          <label style={{ fontWeight: 600 }}>Gruppo</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={gruppo}
              onChange={e => setGruppo(e.target.value)}
              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontSize: '1rem' }}
              disabled={!!gruppoSelezionato && gruppoSelezionato !== '__no_group__'}
            >
              <option value="">Seleziona gruppo...</option>
              {gruppi.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <input
              type="text"
              value={nuovoGruppo}
              onChange={e => setNuovoGruppo(e.target.value)}
              placeholder="Nuovo gruppo"
              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontSize: '1rem' }}
              disabled={!!gruppoSelezionato && gruppoSelezionato !== '__no_group__'}
            />
          </div>

          <label style={{ fontWeight: 600 }}>Inserisci foto o video</label>
          <input type="file" accept="image/*,video/*" onChange={handleMediaChange} style={{ color: '#fff' }} />

          {media && mediaType === 'image' && (
            <img src={media} alt="anteprima foto" style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '8px' }} />
          )}
          {media && mediaType === 'video' && (
            <video src={media} controls style={{ width: '100%', maxHeight: '220px', borderRadius: '8px', background: '#000' }} />
          )}

          <label style={{ fontWeight: 600 }}>Commento breve</label>
          <textarea
            value={commento}
            onChange={e => setCommento(e.target.value)}
            placeholder="Scrivi un commento..."
            maxLength={180}
            style={{ padding: '8px', borderRadius: '6px', border: 'none', minHeight: '46px', resize: 'vertical', fontSize: '0.95rem' }}
          />
          <button className="bb-event-btn" type="submit" disabled={!media}>Salva</button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {!gruppoSelezionato && (
            <>
              {gruppi.length === 0 && fotoItems.length === 0 && <div style={{ color: '#bbb' }}>Nessuna foto inserita.</div>}
              {gruppi.map(gr => (
                <button
                  key={gr}
                  type="button"
                  style={{
                    background: '#191919',
                    color: '#ffb366',
                    fontWeight: 700,
                    fontSize: '1.1em',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '18px 10px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setGruppoSelezionato(gr)}
                >
                  {gr}
                </button>
              ))}
              {fotoItems.filter(item => !item.gruppo).length > 0 && (
                <button
                  type="button"
                  style={{
                    background: '#191919',
                    color: '#ffb366',
                    fontWeight: 700,
                    fontSize: '1.1em',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '18px 10px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setGruppoSelezionato('__no_group__')}
                >
                  Senza gruppo
                </button>
              )}
            </>
          )}
          {gruppoSelezionato && (
            <>
              <button
                type="button"
                style={{ marginBottom: '16px', background: '#222', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 18px', fontWeight: 700, fontSize: '1em', cursor: 'pointer' }}
                onClick={() => setGruppoSelezionato('')}
              >
                &#8592; Torna ai gruppi
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 700, color: '#ffb366', fontSize: '1.1em', marginBottom: '8px' }}>
                {gruppoSelezionato === '__no_group__' ? 'Senza gruppo' : gruppoSelezionato}
                {gruppoSelezionato !== '__no_group__' && (
                  <button
                    type="button"
                    style={{ background: '#ff4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '4px 12px', fontWeight: 600, fontSize: '0.95em', cursor: 'pointer' }}
                    onClick={async () => {
                      if (window.confirm('Vuoi eliminare tutte le foto di questo gruppo?')) {
                        await supabase.from('foto').delete().eq('gruppo', gruppoSelezionato);
                        fetchFoto();
                        setGruppoSelezionato('');
                      }
                    }}
                  >
                    Elimina gruppo
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {fotoItems
                  .filter(item =>
                    gruppoSelezionato === '__no_group__' ? !item.gruppo : item.gruppo === gruppoSelezionato
                  )
                  .map(item => (
                    <div key={item.id} style={{ background: '#222', borderRadius: '12px', padding: '10px' }}>
                      {item.mediaType === 'video' && item.video ? (
                        <video src={item.video} controls style={{ width: '100%', maxHeight: '260px', borderRadius: '8px', background: '#000' }} />
                      ) : (
                        <img src={item.image} alt="foto caricata" style={{ width: '100%', maxHeight: '260px', objectFit: 'cover', borderRadius: '8px' }} />
                      )}
                      {editingDescriptionId === item.id ? (
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <textarea
                            value={editingDescriptionText}
                            onChange={e => setEditingDescriptionText(e.target.value)}
                            placeholder="Modifica descrizione..."
                            maxLength={180}
                            style={{ padding: '8px', borderRadius: '6px', border: 'none', minHeight: '46px', resize: 'vertical', fontSize: '0.95rem', width: '100%', boxSizing: 'border-box' }}
                          />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button type="button" className="bb-event-btn" style={{ flex: 1, padding: '6px 0', fontSize: '0.85rem' }} onClick={() => handleSaveDescription(item.id)}>
                              Salva descrizione
                            </button>
                            <button type="button" className="bb-add-btn" style={{ flex: 1, padding: '6px 0', fontSize: '0.85rem', marginLeft: 0 }} onClick={() => { setEditingDescriptionId(null); setEditingDescriptionText(''); }}>
                              Annulla
                            </button>
                          </div>
                        </div>
                      ) : (
                        item.commento && <div style={{ marginTop: '8px', color: '#ffb366' }}>{item.commento}</div>
                      )}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <button type="button" className="bb-add-btn" style={{ padding: '5px 10px', fontSize: '0.8rem', marginLeft: 0 }} onClick={() => handleStartEditDescription(item)}>
                          Modifica descrizione
                        </button>
                        <button type="button" className="bb-event-btn" style={{ padding: '5px 10px', fontSize: '0.8rem' }} onClick={() => handleDeleteDescription(item.id)}>
                          Elimina descrizione
                        </button>
                        <button type="button" className="bb-event-btn" style={{ padding: '5px 10px', fontSize: '0.8rem', background: '#ff4444' }} onClick={() => handleDeleteFoto(item.id)}>
                          Elimina foto
                        </button>
                      </div>
                      <div style={{ marginTop: '6px', fontSize: '0.8em', color: '#9a9a9a' }}>
                        {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}

export default Foto;
