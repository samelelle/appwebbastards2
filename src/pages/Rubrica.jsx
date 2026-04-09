import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MobileBottomNav from '../components/MobileBottomNav';
import MobilePageShell from '../components/MobilePageShell';
import useIsMobile from '../hooks/useIsMobile';
import { markChatSeen, notifyBadgeDataChanged } from '../lib/notificationBadges';
import { ensureNotificationPermission, notifyUser } from '../lib/notifications';

function Rubrica() {
    const [searchIscritto, setSearchIscritto] = useState('');
  const isMobile = useIsMobile();
  const categorieDisponibili = ['Full', 'Prospect', 'Viminale'];
  const seenCategoryKey = 'bb-rubrica-seen-categories';
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [categoriaAperta, setCategoriaAperta] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatImageData, setChatImageData] = useState('');
  const [chatImageError, setChatImageError] = useState('');
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem('bb-current-chat-user-id') || '');
  const [replyTo, setReplyTo] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [editingIscrittoId, setEditingIscrittoId] = useState(null);
  const [chatNotice, setChatNotice] = useState('');
  const [openedChatImage, setOpenedChatImage] = useState('');
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);
  const [iscritti, setIscritti] = useState(() => {
    const saved = localStorage.getItem('bb-rubrica');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((iscritto, idx) => (iscritto.id
          ? iscritto
          : {
              ...iscritto,
              id: `legacy-${idx}-${(iscritto.cognome || '').trim()}-${(iscritto.nome || '').trim()}`,
            }));
      } catch {
        return [];
      }
    }
    return [];
  });
  const [chatByCategoria, setChatByCategoria] = useState(() => {
    const saved = localStorage.getItem('bb-rubrica-chat');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  });
  const [form, setForm] = useState({ ruolo: '', cognome: '', nome: '', telefono: '', categorie: [] });
  const [seenByCategory, setSeenByCategory] = useState(() => {
    const saved = localStorage.getItem(seenCategoryKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    }
    return {};
  });
  const chatEndRef = useRef(null);
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const knownMessageIdsRef = useRef(new Set());
  const initializedMessagesRef = useRef(false);

  function openChatImage(imageData) {
    if (!imageData) return;
    setOpenedChatImage(imageData);
  }

  function generateId() {
    if (typeof crypto !== 'undefined') {
      if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
      if (typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      }
    }
    return `fallback-${new Date().toISOString().replace(/\D/g, '')}`;
  }

  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Errore lettura file'));
      reader.readAsDataURL(file);
    });
  }

  async function optimizeImage(file) {
    const rawDataUrl = await fileToDataUrl(file);
    const maxSize = 1280;

    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const targetWidth = Math.max(1, Math.round(img.width * ratio));
        const targetHeight = Math.max(1, Math.round(img.height * ratio));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    });
  }

  async function handleSelectImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setChatImageError('Seleziona un file immagine valido.');
      return;
    }

    setChatImageError('');
    try {
      const optimized = await optimizeImage(file);
      setChatImageData(optimized);
    } catch {
      setChatImageError('Impossibile caricare la foto, riprova.');
    }
  }

  function downloadImageData(imageDataUrl) {
    if (!imageDataUrl) return;

    const link = document.createElement('a');
    link.href = imageDataUrl;
    link.download = `rubrica-foto-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function handleSaveOpenedImage() {
    if (!openedChatImage) return;

    const fileName = `rubrica-foto-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
    const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

    try {
      const response = await fetch(openedChatImage);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });

      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: 'Foto chat',
          text: 'Seleziona Salva immagine o Foto/Galleria',
        });
        return;
      }

      if (isMobileDevice) {
        const blobUrl = URL.createObjectURL(blob);
        const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
        if (!opened) {
          window.location.href = blobUrl;
        }
        return;
      }

      downloadImageData(openedChatImage);
    } catch {
      if (isMobileDevice) {
        const opened = window.open(openedChatImage, '_blank', 'noopener,noreferrer');
        if (!opened) {
          window.location.href = openedChatImage;
        }
        return;
      }
      downloadImageData(openedChatImage);
    }
  }

  function displayName(iscritto) {
    return `${iscritto.cognome} ${iscritto.nome}`.trim();
  }

  useEffect(() => {
    localStorage.setItem('bb-rubrica', JSON.stringify(iscritti));
  }, [iscritti]);

  useEffect(() => {
    localStorage.setItem('bb-rubrica-chat', JSON.stringify(chatByCategoria));
    notifyBadgeDataChanged('chat');
  }, [chatByCategoria]);

  useEffect(() => {
    localStorage.setItem(seenCategoryKey, JSON.stringify(seenByCategory));
  }, [seenByCategory]);

  useEffect(() => {
    // Segna letti quando la pagina viene aperta, non ad ogni nuovo messaggio.
    markChatSeen();
  }, []);

  useEffect(() => {
    let active = true;
    ensureNotificationPermission().then(permission => {
      if (active) {
        setNotificationsAllowed(permission === 'granted');
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleStorage = event => {
      if (event.key !== 'bb-rubrica-chat') return;
      if (!event.newValue) {
        setChatByCategoria({});
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue);
        setChatByCategoria(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        // Ignore malformed external storage updates.
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    localStorage.setItem('bb-current-chat-user-id', currentUserId || '');
  }, [currentUserId]);

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

  function handleInput(e) {
    const { name, value, options } = e.target;
    if (name === 'categorie') {
      const selected = Array.from(options)
        .filter(option => option.selected)
        .map(option => option.value);
      setForm(prev => ({ ...prev, categorie: selected }));
      return;
    }
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function toggleCategoria(categoria) {
    setForm(prev => {
      const exists = prev.categorie.includes(categoria);
      if (exists) {
        return { ...prev, categorie: prev.categorie.filter(cat => cat !== categoria) };
      }
      return { ...prev, categorie: [...prev.categorie, categoria] };
    });
  }

  function startEditIscritto(iscritto) {
    setEditingIscrittoId(iscritto.id);
    setForm({
      ruolo: iscritto.ruolo || '',
      cognome: iscritto.cognome || '',
      nome: iscritto.nome || '',
      telefono: iscritto.telefono || '',
      categorie: getCategorieArray(iscritto),
    });
    setSaveError('');
    setShowAddModal(true);
  }

  function handleDeleteIscritto(iscrittoId) {
    const confirmed = window.confirm('Vuoi cancellare davvero questo iscritto?');
    if (!confirmed) return;

    setIscritti(prev => prev.filter(item => item.id !== iscrittoId));
    if (currentUserId === iscrittoId) setCurrentUserId('');
    if (editingIscrittoId === iscrittoId) {
      setEditingIscrittoId(null);
      setShowAddModal(false);
    }
  }

  function handleAddIscritto(e) {
    e.preventDefault();
    const ruolo = form.ruolo.trim();
    const cognome = form.cognome.trim();
    const nome = form.nome.trim();
    const telefono = form.telefono.trim();
    if (!ruolo || !cognome || !nome || !telefono || form.categorie.length === 0) {
      setSaveError('Compila tutti i campi e seleziona almeno una categoria.');
      return;
    }
    if (editingIscrittoId) {
      setIscritti(prev => prev.map(item => (item.id === editingIscrittoId
        ? {
            ...item,
            ruolo,
            cognome,
            nome,
            telefono,
            categorie: form.categorie,
          }
        : item)));
      setEditingIscrittoId(null);
    } else {
      const newId = generateId();
      setIscritti(prev => [
        ...prev,
        {
          id: newId,
          ruolo,
          cognome,
          nome,
          telefono,
          categorie: form.categorie,
        },
      ]);
      if (!currentUserId) setCurrentUserId(newId);
    }
    setSaveError('');
    setForm({ ruolo: '', cognome: '', nome: '', telefono: '', categorie: [] });
    setShowAddModal(false);
  }

  function getCategorieArray(iscritto) {
    if (Array.isArray(iscritto.categorie)) return iscritto.categorie;
    if (typeof iscritto.categorie === 'string' && iscritto.categorie.trim()) return [iscritto.categorie.trim()];
    if (typeof iscritto.categoria === 'string' && iscritto.categoria.trim()) return [iscritto.categoria.trim()];
    return [];
  }

  const iscrittiCategoriaAperta = categoriaAperta
    ? iscritti.filter(iscritto => getCategorieArray(iscritto).includes(categoriaAperta))
    : [];

  const membriCategoriaAperta = iscrittiCategoriaAperta.map(iscritto => ({ id: iscritto.id, name: displayName(iscritto) }));
  const identitaCorrente = iscritti.find(iscritto => iscritto.id === currentUserId) || null;
  const membroCorrenteInCategoria = identitaCorrente && categoriaAperta
    ? getCategorieArray(identitaCorrente).includes(categoriaAperta)
    : false;

  const messaggiCategoriaAperta = categoriaAperta
    ? (chatByCategoria[categoriaAperta] || [])
    : [];
  const isOverlayOpen = Boolean(categoriaAperta || showMembersModal || showIdentityModal || showAddModal);
  const categoryMessageCounts = categorieDisponibili.reduce((accumulator, categoria) => {
    const messages = Array.isArray(chatByCategoria[categoria]) ? chatByCategoria[categoria] : [];
    const seenCount = Number(seenByCategory[categoria] || 0);
    accumulator[categoria] = Math.max(0, messages.filter(message => message.authorId !== currentUserId).length - seenCount);
    return accumulator;
  }, {});

  useEffect(() => {
    if (!categoriaAperta) return;

    const messages = Array.isArray(chatByCategoria[categoriaAperta]) ? chatByCategoria[categoriaAperta] : [];
    setSeenByCategory(prev => ({
      ...prev,
      [categoriaAperta]: messages.filter(message => message.authorId !== currentUserId).length,
    }));
  }, [categoriaAperta, chatByCategoria, currentUserId]);

  useEffect(() => {
    const entries = Object.entries(chatByCategoria);
    const allMessages = entries.flatMap(([categoria, messages]) =>
      (messages || []).map(message => ({ ...message, categoria: message.categoria || categoria })),
    );
    const nextIds = new Set(allMessages.map(message => message.id));

    if (!initializedMessagesRef.current) {
      knownMessageIdsRef.current = nextIds;
      initializedMessagesRef.current = true;
      return;
    }

    const incoming = allMessages.filter(message => !knownMessageIdsRef.current.has(message.id));
    knownMessageIdsRef.current = nextIds;
    if (!incoming.length) return;

    const externalIncoming = incoming.filter(message => message.authorId !== currentUserId);
    if (!externalIncoming.length) return;

    const latest = externalIncoming[externalIncoming.length - 1];
    const author = latest.authorName || latest.author || 'Membro';
    const categoryLabel = latest.categoria ? ` in ${latest.categoria}` : '';
    const preview = latest.text?.trim() ? latest.text.trim().slice(0, 60) : 'Nuovo messaggio';
    const noticeText = `Nuovo messaggio${categoryLabel} da ${author}`;

    setChatNotice(noticeText);
    window.setTimeout(() => setChatNotice(''), 4500);

    if (notificationsAllowed) {
      notifyUser(noticeText, preview);
    }
  }, [chatByCategoria, currentUserId, notificationsAllowed]);

  useEffect(() => {
    if (!showAddModal) return undefined;

    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, [showAddModal]);

  useEffect(() => {
    if (!categoriaAperta || !chatEndRef.current) return;
    chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [categoriaAperta, messaggiCategoriaAperta.length]);

  function replyPreviewText(message) {
    if (!message) return null;
    if (message.text) return message.text;
    if (message.imageData) return '[Foto]';
    return '[Messaggio]';
  }

  async function handleSendMessage() {
    if (!categoriaAperta || !identitaCorrente || !membroCorrenteInCategoria) return;
    const testo = chatInput.trim();
    if (!testo && !chatImageData) return;

    const nuovoMessaggio = {
      id: generateId(),
      authorId: identitaCorrente.id,
      authorName: displayName(identitaCorrente),
      categoria: categoriaAperta,
      text: testo,
      imageData: chatImageData || null,
      timestamp: new Date().toISOString(),
      replyToId: replyTo ? replyTo.id : null,
      replyToAuthor: replyTo ? (replyTo.authorName || replyTo.author || 'Membro') : null,
      replyToText: replyTo ? replyPreviewText(replyTo) : null,
    };
    setChatByCategoria(prev => ({
      ...prev,
      [categoriaAperta]: [...(prev[categoriaAperta] || []), nuovoMessaggio],
    }));
    setChatInput('');
    setChatImageData('');
    setChatImageError('');
    setReplyTo(null);
  }

  return (
    <div
      className="bb-page"
      style={{ height: 'var(--bb-app-height, 100dvh)', background: '#111', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: isMobile ? 0 : '48px', paddingBottom: 0, position: 'fixed', inset: 0, overflow: 'hidden' }}
    >
      {chatNotice && (
        <div style={{ position: 'fixed', top: 'calc(var(--bb-mobile-shell-height, 94px) + 8px)', left: '10px', right: '10px', zIndex: 8200, background: '#1d2a1d', border: '1px solid #2f5d2f', color: '#b8f7b8', borderRadius: '8px', padding: '8px 10px', fontSize: '0.88rem', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
          {chatNotice}
        </div>
      )}
      <MobilePageShell title="RUBRICA" />
      {!isMobile && <Link to="/" className="bb-back-btn">&#8592; Home</Link>}
      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: '24px' }}>
          <h1 className="bb-title" style={{ margin: 0 }}>RUBRICA</h1>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: isMobile ? '100%' : '360px', maxWidth: '92vw', margin: '0 auto', marginTop: isMobile ? 0 : '3cm', padding: isMobile ? 'calc(var(--bb-mobile-shell-height, 94px) + 72px) 12px 8px 12px' : 0, boxSizing: 'border-box', flex: isMobile ? '0 0 auto' : '1 1 auto', height: isMobile ? 'calc(100dvh - var(--bb-mobile-bottom-nav-height, 94px) - 8px)' : 'auto', maxHeight: isMobile ? 'calc(100dvh - var(--bb-mobile-bottom-nav-height, 94px) - 8px)' : 'none', overflowY: 'auto' }}>
        <button className="bb-event-btn" style={{ width: '100%', minHeight: isMobile ? '40px' : undefined, padding: isMobile ? '8px 36px 8px 12px' : '8px 12px', fontSize: isMobile ? '0.9rem' : undefined, position: 'relative' }} onClick={() => { setReplyTo(null); setCategoriaAperta('Full'); }}>
          Full
          {categoryMessageCounts.Full > 0 && <span style={{ position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)', minWidth: '20px', height: '20px', borderRadius: '999px', background: '#ff2b2b', color: '#fff', fontSize: '0.7rem', lineHeight: '20px', fontWeight: 800, textAlign: 'center', padding: '0 5px', boxSizing: 'border-box' }}>{categoryMessageCounts.Full > 99 ? '99+' : categoryMessageCounts.Full}</span>}
        </button>
        <button className="bb-event-btn" style={{ width: '100%', minHeight: isMobile ? '40px' : undefined, padding: isMobile ? '8px 36px 8px 12px' : '8px 12px', fontSize: isMobile ? '0.9rem' : undefined, position: 'relative' }} onClick={() => { setReplyTo(null); setCategoriaAperta('Prospect'); }}>
          Prospect
          {categoryMessageCounts.Prospect > 0 && <span style={{ position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)', minWidth: '20px', height: '20px', borderRadius: '999px', background: '#ff2b2b', color: '#fff', fontSize: '0.7rem', lineHeight: '20px', fontWeight: 800, textAlign: 'center', padding: '0 5px', boxSizing: 'border-box' }}>{categoryMessageCounts.Prospect > 99 ? '99+' : categoryMessageCounts.Prospect}</span>}
        </button>
        <button className="bb-event-btn" style={{ width: '100%', minHeight: isMobile ? '40px' : undefined, padding: isMobile ? '8px 36px 8px 12px' : '8px 12px', fontSize: isMobile ? '0.9rem' : undefined, position: 'relative' }} onClick={() => { setReplyTo(null); setCategoriaAperta('Viminale'); }}>
          Viminale
          {categoryMessageCounts.Viminale > 0 && <span style={{ position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)', minWidth: '20px', height: '20px', borderRadius: '999px', background: '#ff2b2b', color: '#fff', fontSize: '0.7rem', lineHeight: '20px', fontWeight: 800, textAlign: 'center', padding: '0 5px', boxSizing: 'border-box' }}>{categoryMessageCounts.Viminale > 99 ? '99+' : categoryMessageCounts.Viminale}</span>}
        </button>

        <button className="bb-event-btn" style={{ width: '100%', minHeight: isMobile ? '40px' : undefined, padding: isMobile ? '8px 36px 8px 12px' : '8px 12px', fontSize: isMobile ? '0.9rem' : undefined, position: 'relative' }} onClick={() => setShowIdentityModal(true)}>
          Identita chat: {identitaCorrente ? displayName(identitaCorrente) : 'Non selezionata'}
        </button>

        <button className="bb-event-btn" style={{ width: '100%', minHeight: isMobile ? '40px' : undefined, padding: isMobile ? '8px 36px 8px 12px' : '8px 12px', fontSize: isMobile ? '0.9rem' : undefined, position: 'relative' }} onClick={() => setShowMembersModal(true)}>
          Lista iscritti
        </button>

        <button className="bb-add-btn" style={{ width: 'auto', marginTop: '12px', alignSelf: 'center', minHeight: isMobile ? '38px' : undefined, padding: isMobile ? '7px 12px' : undefined, fontSize: isMobile ? '0.86rem' : undefined }} onClick={() => { setSaveError(''); setShowAddModal(true); }}>Aggiungi iscritto</button>
      </div>

      {categoriaAperta && (
        <div style={{ position: 'fixed', inset: 0, background: '#111', display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', zIndex: 8100, padding: 0, boxSizing: 'border-box' }}>
          <div style={{ background: '#1b1b1b', color: '#fff', borderRadius: isMobile ? '0' : '16px', padding: isMobile ? 'calc(14px + env(safe-area-inset-top)) 12px 0 12px' : '18px', width: '100vw', height: '100dvh', maxHeight: '100dvh', boxShadow: isMobile ? 'none' : '0 4px 24px #000a', position: 'relative', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 4, background: '#1b1b1b', paddingBottom: '8px' }}>
              <button onClick={() => { setReplyTo(null); setCategoriaAperta(null); }} style={{ position: 'absolute', top: isMobile ? '14px' : 10, right: 14, background: 'none', border: 'none', color: '#ff6600', fontSize: '1.8rem', cursor: 'pointer' }} title="Chiudi">&times;</button>
              <h2 style={{ color: '#ff6600', marginTop: 0, marginBottom: '8px' }}>Stanza categoria: {categoriaAperta}</h2>
              <div style={{ color: '#bbb', fontSize: '0.88em', marginBottom: '8px' }}>
              Partecipanti: {iscrittiCategoriaAperta.length}
              </div>
            </div>

            <div style={{ marginTop: '4px', borderTop: '1px solid #444', paddingTop: '10px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#ffb366', fontSize: '1rem' }}>Chat categoria</h3>

              <div style={{ background: '#0f0f0f', borderRadius: '10px', padding: '10px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                {messaggiCategoriaAperta.length === 0 && (
                  <div style={{ color: '#999', fontSize: '0.92em' }}>Nessun messaggio ancora.</div>
                )}
                {messaggiCategoriaAperta.map((msg, idx) => {
                  const isOwn = msg.authorId === currentUserId;
                  return (
                  <div key={`${msg.timestamp}-${idx}`} style={{ alignSelf: isOwn ? 'flex-end' : 'flex-start', maxWidth: '84%', background: isOwn ? '#1f7a3f' : '#2a2a2a', borderRadius: '12px', padding: '7px 9px' }}>
                    {!isOwn && (
                      <div style={{ fontSize: '0.76em', color: '#ffb366', marginBottom: '2px' }}>{msg.authorName || msg.author || 'Membro'}</div>
                    )}
                    {msg.replyToAuthor && (
                      <div style={{ fontSize: '0.78em', color: '#aaa', borderLeft: '2px solid #555', paddingLeft: '6px', marginBottom: '4px' }}>
                        Risposta a {msg.replyToAuthor}: {msg.replyToText}
                      </div>
                    )}
                    {msg.text && <div style={{ fontSize: '0.95em' }}>{msg.text}</div>}
                    {msg.imageData && (
                      <button
                        type="button"
                        onClick={() => openChatImage(msg.imageData)}
                        style={{
                          marginTop: msg.text ? '6px' : 0,
                          padding: 0,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'block',
                          width: '100%',
                          touchAction: 'manipulation',
                        }}
                        aria-label="Apri foto inviata in chat"
                      >
                        <img
                          src={msg.imageData}
                          alt="Foto inviata in chat"
                          style={{ width: '100%', maxWidth: '240px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.18)', display: 'block', touchAction: 'manipulation' }}
                        />
                        <div style={{ marginTop: '4px', color: '#bbb', fontSize: '0.74em' }}>Tocca la foto per aprirla</div>
                      </button>
                    )}
                    <div style={{ fontSize: '0.75em', color: '#aaa', marginTop: '2px' }}>{new Date(msg.timestamp).toLocaleString()}</div>
                    <button type="button" onClick={() => setReplyTo(msg)} style={{ marginTop: '4px', background: isOwn ? '#14602f' : '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75em', cursor: 'pointer' }}>
                      Rispondi
                    </button>
                  </div>
                );})}
                <div ref={chatEndRef} />
              </div>

              {!identitaCorrente && <div style={{ marginTop: '8px', color: '#ffb366', fontSize: '0.88em' }}>Seleziona prima la tua identita chat.</div>}
              {identitaCorrente && !membroCorrenteInCategoria && <div style={{ marginTop: '8px', color: '#ffb366', fontSize: '0.88em' }}>La tua identita non appartiene a questa categoria.</div>}

              {replyTo && (
                <div style={{ marginTop: '8px', background: '#2a2a2a', borderRadius: '6px', padding: '6px 8px', fontSize: '0.85em' }}>
                  Rispondi a <b>{replyTo.authorName || replyTo.author || 'Membro'}</b>: {replyPreviewText(replyTo)}
                  <button type="button" onClick={() => setReplyTo(null)} style={{ marginLeft: '8px', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '0.75em' }}>
                    Annulla
                  </button>
                </div>
              )}

              {chatImageData && (
                <div style={{ marginTop: '8px', background: '#2a2a2a', borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src={chatImageData} alt="Anteprima foto" style={{ width: '68px', height: '68px', objectFit: 'cover', borderRadius: '8px' }} />
                  <div style={{ flex: 1, fontSize: '0.86em', color: '#ddd' }}>Foto pronta da inviare</div>
                  <button type="button" onClick={() => { setChatImageData(''); setChatImageError(''); }} style={{ background: '#444', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer' }}>Rimuovi</button>
                </div>
              )}

              {chatImageError && (
                <div style={{ marginTop: '6px', color: '#ffb366', fontSize: '0.82em' }}>{chatImageError}</div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="bb-add-btn"
                  style={{ width: 'auto', minHeight: '36px', padding: '6px 10px', fontSize: '0.8rem' }}
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={membriCategoriaAperta.length === 0 || !identitaCorrente || !membroCorrenteInCategoria}
                >
                  Foto
                </button>
                <button
                  type="button"
                  className="bb-add-btn"
                  style={{ width: 'auto', minHeight: '36px', padding: '6px 10px', fontSize: '0.8rem' }}
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={membriCategoriaAperta.length === 0 || !identitaCorrente || !membroCorrenteInCategoria}
                >
                  Scatta
                </button>
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleSelectImage}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handleSelectImage}
                />
              </div>

              <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '10px', background: '#1b1b1b', paddingTop: '8px', paddingBottom: isMobile ? 'max(8px, env(safe-area-inset-bottom))' : 0, paddingLeft: 0, paddingRight: 0 }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                  placeholder="Scrivi un messaggio..."
                  style={{ flex: 1, padding: '10px', borderRadius: '18px', border: 'none', fontSize: '0.95rem' }}
                  disabled={membriCategoriaAperta.length === 0 || !identitaCorrente || !membroCorrenteInCategoria}
                />
                <button className="bb-event-btn" style={{ width: 'auto', minWidth: '86px', borderRadius: '18px', padding: '10px 14px' }} type="button" onClick={() => void handleSendMessage()} disabled={membriCategoriaAperta.length === 0 || !identitaCorrente || !membroCorrenteInCategoria || (!chatInput.trim() && !chatImageData)}>Invia</button>
              </div>
              {membriCategoriaAperta.length === 0 && (
                <div style={{ marginTop: '6px', color: '#999', fontSize: '0.82em' }}>
                  Aggiungi almeno un iscritto alla categoria per usare la chat.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showMembersModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#111', display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', zIndex: 8100, padding: 0, boxSizing: 'border-box' }}>
          <div style={{ background: '#222', color: '#fff', borderRadius: isMobile ? '0' : '16px', padding: isMobile ? 'calc(18px + env(safe-area-inset-top)) 16px calc(18px + env(safe-area-inset-bottom)) 16px' : '24px', width: '100vw', height: '100dvh', maxHeight: '100dvh', overflowY: 'auto', boxShadow: isMobile ? 'none' : '0 4px 24px #000a', position: 'relative', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 4, background: '#222', paddingBottom: '8px', minHeight: '56px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                <button onClick={() => setShowMembersModal(false)} style={{ background: 'none', border: 'none', color: '#ff6600', fontSize: '1.8rem', cursor: 'pointer', marginLeft: '2px' }} title="Chiudi">&times;</button>
                <h2 style={{ color: '#ff6600', margin: 0, flex: 1, textAlign: 'center', fontSize: '1.25rem' }}>Lista iscritti</h2>
                <div style={{ width: '36px' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', marginTop: '6px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={searchIscritto}
                  onChange={e => setSearchIscritto(e.target.value)}
                  placeholder="Cerca per nome, cognome, ruolo, telefono, categoria..."
                  style={{ flex: 1, padding: '7px', borderRadius: '7px', border: '1px solid #555', background: '#181818', color: '#fff', fontSize: '1rem', minWidth: 0 }}
                />
                <button
                  type="button"
                  className="bb-add-btn"
                  style={{ minWidth: '70px', padding: '7px 10px', fontSize: '0.95rem' }}
                  onClick={() => setSearchIscritto('')}
                  title="Azzera ricerca"
                >
                  Azzera
                </button>
              </div>
            </div>
            {iscritti.length === 0 && <div style={{ color: '#bbb' }}>Nessun iscritto disponibile.</div>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {iscritti
                .filter(iscritto => {
                  const q = searchIscritto.trim().toLowerCase();
                  if (!q) return true;
                  const campi = [
                    iscritto.cognome || '',
                    iscritto.nome || '',
                    iscritto.ruolo || '',
                    iscritto.telefono || '',
                    (Array.isArray(iscritto.categorie) ? iscritto.categorie.join(' ') : (iscritto.categoria || '')),
                  ].join(' ').toLowerCase();
                  return campi.includes(q);
                })
                .map(iscritto => (
                  <li key={iscritto.id} style={{ background: '#2a2a2a', borderRadius: '8px', padding: '10px' }}>
                    <div><b>{displayName(iscritto)}</b></div>
                    <div style={{ color: '#ffb366', fontSize: '0.92em' }}>Ruolo: {iscritto.ruolo || 'N/D'}</div>
                    <div style={{ color: '#ddd', fontSize: '0.9em' }}>Telefono: {iscritto.telefono || 'N/D'}</div>
                    <div style={{ color: '#aaa', fontSize: '0.85em' }}>Categorie: {getCategorieArray(iscritto).join(', ') || 'N/D'}</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button
                        type="button"
                        className="bb-add-btn"
                        style={{ width: 'auto', minHeight: '34px', padding: '5px 10px', fontSize: '0.8rem', marginLeft: 0 }}
                        onClick={() => startEditIscritto(iscritto)}
                      >
                        Modifica
                      </button>
                      <button
                        type="button"
                        className="bb-event-btn"
                        style={{ width: 'auto', minWidth: '0', minHeight: '34px', padding: '5px 10px', fontSize: '0.8rem' }}
                        onClick={() => handleDeleteIscritto(iscritto.id)}
                      >
                        Cancella
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
            {/* pulsante Indietro rimosso */}
          </div>
        </div>
      )}

      {showIdentityModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#111', display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', zIndex: 8100, padding: 0, boxSizing: 'border-box' }}>
          <div style={{ background: '#222', color: '#fff', borderRadius: isMobile ? '0' : '16px', padding: isMobile ? 'calc(18px + env(safe-area-inset-top)) 16px calc(18px + env(safe-area-inset-bottom)) 16px' : '24px', width: '100vw', height: '100dvh', maxHeight: '100dvh', overflowY: 'auto', boxShadow: isMobile ? 'none' : '0 4px 24px #000a', position: 'relative', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 4, background: '#222', paddingBottom: '8px' }}>
              <button onClick={() => setShowIdentityModal(false)} style={{ position: 'absolute', top: isMobile ? '14px' : 10, right: 14, background: 'none', border: 'none', color: '#ff6600', fontSize: '1.8rem', cursor: 'pointer' }} title="Chiudi">&times;</button>
              <h2 style={{ color: '#ff6600', marginTop: 0, marginBottom: '10px' }}>Seleziona la tua identita</h2>
            </div>
            {iscritti.length === 0 && <div style={{ color: '#bbb' }}>Nessun iscritto disponibile.</div>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {iscritti.map((iscritto, idx) => (
                <li key={`${iscritto.id || idx}`} style={{ marginBottom: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentUserId(iscritto.id);
                      setShowIdentityModal(false);
                    }}
                    style={{ width: '100%', textAlign: 'left', background: currentUserId === iscritto.id ? '#ff6600' : '#2a2a2a', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer' }}
                  >
                    <div><b>{displayName(iscritto)}</b></div>
                    <div style={{ fontSize: '0.85em', color: '#ddd' }}>Ruolo: {iscritto.ruolo}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#111', display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', zIndex: 8100, padding: 0, boxSizing: 'border-box' }}>
          <div style={{ background: '#222', color: '#fff', borderRadius: isMobile ? '0' : '16px', padding: isMobile ? 'calc(18px + env(safe-area-inset-top)) 16px calc(18px + env(safe-area-inset-bottom)) 16px' : '24px', width: '100vw', height: '100dvh', maxHeight: '100dvh', overflow: 'hidden', boxShadow: isMobile ? 'none' : '0 4px 24px #000a', position: 'relative', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: '0 0 auto', position: 'relative', background: '#222', paddingBottom: '8px' }}>
              <button onClick={() => setShowAddModal(false)} style={{ position: 'absolute', top: isMobile ? '14px' : 10, right: 14, background: 'none', border: 'none', color: '#ff6600', fontSize: '1.8rem', cursor: 'pointer' }} title="Chiudi">&times;</button>
              <h2 style={{ color: '#ff6600', marginTop: 0, marginBottom: 0 }}>{editingIscrittoId ? 'Modifica iscritto' : 'Nuovo iscritto'}</h2>
            </div>
            <form id="member-form" onSubmit={handleAddIscritto} style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: '1 1 auto', overflowY: 'auto', paddingTop: '12px', paddingBottom: '12px', minHeight: 0, boxSizing: 'border-box' }}>
              <label style={{ fontWeight: 600 }}>Ruolo</label>
              <input name="ruolo" type="text" value={form.ruolo} onChange={handleInput} placeholder="Es. Segretario" style={{ padding: '8px', borderRadius: '6px', border: 'none', fontSize: '1rem' }} />

              <label style={{ fontWeight: 600 }}>Cognome</label>
              <input name="cognome" type="text" value={form.cognome} onChange={handleInput} placeholder="Cognome" style={{ padding: '8px', borderRadius: '6px', border: 'none', fontSize: '1rem' }} />

              <label style={{ fontWeight: 600 }}>Nome</label>
              <input name="nome" type="text" value={form.nome} onChange={handleInput} placeholder="Nome" style={{ padding: '8px', borderRadius: '6px', border: 'none', fontSize: '1rem' }} />

              <label style={{ fontWeight: 600 }}>Telefono</label>
              <input name="telefono" type="tel" value={form.telefono} onChange={handleInput} placeholder="Numero di telefono" style={{ padding: '8px', borderRadius: '6px', border: 'none', fontSize: '1rem' }} />

              <label style={{ fontWeight: 600 }}>Categorie rubrica (selezione multipla)</label>
              {isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {categorieDisponibili.map(cat => {
                    const checked = form.categorie.includes(cat);
                    return (
                      <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#2a2a2a', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCategoria(cat)}
                          style={{ width: '18px', height: '18px', accentColor: '#ff6600' }}
                        />
                        <span>{cat}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <>
                  <select name="categorie" multiple value={form.categorie} onChange={handleInput} style={{ padding: '8px', borderRadius: '6px', border: 'none', fontSize: '1rem', minHeight: '98px' }}>
                    {categorieDisponibili.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <div style={{ color: '#bbb', fontSize: '0.85em' }}>Tieni premuto Ctrl per selezionare piu categorie.</div>
                </>
              )}

              {form.categorie.length === 0 && (
                <div style={{ color: '#ffb366', fontSize: '0.85em' }}>Seleziona almeno una categoria.</div>
              )}

              {saveError && (
                <div style={{ color: '#ffb366', fontSize: '0.85em' }}>{saveError}</div>
              )}

            </form>
            <div style={{ flex: '0 0 auto', display: 'flex', gap: '8px', marginTop: '8px', background: '#222', paddingTop: '8px', paddingBottom: isMobile ? 'max(8px, env(safe-area-inset-bottom))' : 0, zIndex: 2 }}>
              <button className="bb-event-btn" type="submit" form="member-form" style={{ flex: 1 }}>{editingIscrittoId ? 'Salva modifiche' : 'Salva iscritto'}</button>
              <button className="bb-add-btn" type="button" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {openedChatImage && (
        <div
          role="presentation"
          onClick={() => setOpenedChatImage('')}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.90)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 8200, padding: '16px', boxSizing: 'border-box' }}
        >
          <div
            role="presentation"
            onClick={event => event.stopPropagation()}
            style={{ position: 'relative', width: '100%', maxWidth: '100vw', maxHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          >
            <button
              type="button"
              onClick={() => setOpenedChatImage('')}
              style={{ position: 'absolute', top: '-10px', right: '-10px', width: '34px', height: '34px', borderRadius: '999px', border: 'none', background: '#ff6600', color: '#fff', fontSize: '1.2rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.35)' }}
              aria-label="Chiudi foto"
            >
              ×
            </button>
            <img
              src={openedChatImage}
              alt="Foto aperta in grande"
              style={{ display: 'block', width: '100%', maxWidth: '100vw', maxHeight: '100vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 6px 28px rgba(0,0,0,0.5)', userSelect: 'none' }}
            />
          </div>
        </div>
      )}

      {!isOverlayOpen && <MobileBottomNav />}
    </div>
  );
}

export default Rubrica;
