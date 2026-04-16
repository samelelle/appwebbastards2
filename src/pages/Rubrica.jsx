import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
// --- INIZIO MODIFICA SUPABASE ISCRITTI ---
import { Link } from 'react-router-dom';
import MobileBottomNav from '../components/MobileBottomNav';
import MobilePageShell from '../components/MobilePageShell';
import useIsMobile from '../hooks/useIsMobile';
import { markChatSeen } from '../lib/notificationBadges';
import { ensureNotificationPermission, notifyUser } from '../lib/notifications';

function Rubrica({ isDevMode }) {
        // Stato per modifica messaggio
        const [editingMsgId, setEditingMsgId] = useState(null);
        const [editingMsgText, setEditingMsgText] = useState('');
      // Azioni selezione multipla
      function canEditOrDeleteForAll() {
        if (!selectedMessages.length) return false;
        if (isDevMode) return true;
        // Solo se tutti i selezionati sono miei
        return selectedMessages.every(selId => {
          const msg = messaggiCategoriaAperta.find(m => m.id === selId);
          return msg && isOwnMessage(msg);
        });
      }

      function canReply() {
        return selectedMessages.length === 1;
      }

      function handleReplySelected() {
        if (selectedMessages.length !== 1) return;
        const msg = messaggiCategoriaAperta.find(m => m.id === selectedMessages[0]);
        if (msg) setReplyTo(msg);
        exitSelectMode();
      }

      function handleEditSelected() {
        if (selectedMessages.length !== 1) return exitSelectMode();
        const msg = messaggiCategoriaAperta.find(m => m.id === selectedMessages[0]);
        if (!msg || !isOwnMessage(msg)) return exitSelectMode();
        setEditingMsgId(msg.id);
        setEditingMsgText(msg.text || '');
        exitSelectMode();
      }

      async function handleSaveEditMsg() {
        if (!editingMsgId) return;
        const newText = editingMsgText.trim();
        if (!newText) return;
        await supabase.from('chat').update({ message: newText }).eq('id', editingMsgId);
        setEditingMsgId(null);
        setEditingMsgText('');
      }

      function handleCancelEditMsg() {
        setEditingMsgId(null);
        setEditingMsgText('');
      }

      async function handleDeleteForAll() {
        if (!selectedMessages.length) return exitSelectMode();
        if (!window.confirm('Vuoi eliminare questi messaggi per tutti?')) return;
        // Elimina da supabase (delete by id)
        await supabase.from('chat').delete().in('id', selectedMessages);
        exitSelectMode();
      }

      async function handleDeleteForMe() {
        if (!selectedMessages.length) return exitSelectMode();
        // Blacklist locale: salva in localStorage gli id dei messaggi nascosti solo per me
        const key = 'bb-chat-hide-msg-ids';
        let hidden = [];
        try {
          hidden = JSON.parse(localStorage.getItem(key) || '[]');
          if (!Array.isArray(hidden)) hidden = [];
        } catch { hidden = []; }
        const newHidden = Array.from(new Set([...hidden, ...selectedMessages]));
        localStorage.setItem(key, JSON.stringify(newHidden));
        exitSelectMode();
        // Forza refresh locale
        setChatByCategoria(prev => ({ ...prev }));
      }
    const [searchIscritto, setSearchIscritto] = useState('');
  const isMobile = useIsMobile();
  const categorieDisponibili = ['Full', 'Prospect', 'Viminale'];
  const seenCategoryKey = 'bb-rubrica-seen-categories';
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [categoriaAperta, setCategoriaAperta] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatImageData, setChatImageData] = useState('');
  const [chatImageError, setChatImageError] = useState('');
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [myIscrittoId, setMyIscrittoId] = useState(
    () =>
      localStorage.getItem('bb-my-iscritto-id')
      || localStorage.getItem('bb-current-chat-user-id')
      || ''
  );
  const currentUserId = myIscrittoId || '';
  const [replyTo, setReplyTo] = useState(null);
  // Stato per selezione multipla messaggi
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editingIscrittoId, setEditingIscrittoId] = useState(null);
  const [chatNotice, setChatNotice] = useState('');
  // Tiene traccia dell'ultimo messaggio visto per categoria
  const lastSeenMsgIdRef = useRef({});
  const [chatPermissionError, setChatPermissionError] = useState('');
  const [openedChatImage, setOpenedChatImage] = useState('');
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);
  const [iscritti, setIscritti] = useState([]);
  const [chatByCategoria, setChatByCategoria] = useState({});
  const [form, setForm] = useState({ ruolo: '', cognome: '', nome: '', telefono: '', email: '', categorie: [] });
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

  // Gestione selezione multipla messaggi
  function handleToggleSelectMessage(msgId) {
    setSelectMode(true);
    setSelectedMessages(prev =>
      prev.includes(msgId)
        ? prev.filter(id => id !== msgId)
        : [...prev, msgId]
    );
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedMessages([]);
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

  const displayName = useCallback((iscritto) => {
    return `${iscritto.cognome} ${iscritto.nome}`.trim();
  }, []);

  const iscrittiById = useMemo(() => {
    const map = new Map();
    for (const iscritto of iscritti) {
      if (iscritto?.id != null) map.set(String(iscritto.id), iscritto);
    }
    return map;
  }, [iscritti]);

  const getMessageAuthorId = useCallback((message) => {
    if (!message || typeof message !== 'object') return '';
    return message.authorId || message.user_id || message.userId || '';
  }, []);

  const authorLabel = useCallback((message) => {
    const authorId = getMessageAuthorId(message);
    if (authorId) {
      const iscritto = iscrittiById.get(String(authorId));
      if (iscritto) {
        const label = displayName(iscritto);
        if (label) return label;
      }
    }
    return message?.authorName || message?.author || 'Membro';
  }, [displayName, getMessageAuthorId, iscrittiById]);

  const isOwnMessage = useCallback((message) => {
    const authorId = getMessageAuthorId(message);
    if (!authorId || !currentUserId) return false;
    return String(authorId) === String(currentUserId);
  }, [currentUserId, getMessageAuthorId]);


  // Carica iscritti da Supabase e ascolta realtime
  useEffect(() => {
    let ignore = false;
    async function fetchIscritti() {
      const { data, error } = await supabase
        .from('iscritti')
        .select('*')
        .order('cognome', { ascending: true });
      if (!error && !ignore) {
        setIscritti(data || []);
      }
    }
    fetchIscritti();

    // Realtime
    const channel = supabase
      .channel('public:iscritti')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iscritti' }, _payload => {
        fetchIscritti();
      })
      .subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Carica i messaggi dalla tabella chat e ascolta in realtime
  useEffect(() => {
    let ignore = false;
    async function fetchMessages() {
      const { data, error } = await supabase
        .from('chat')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error && !ignore) {
        // Raggruppa per categoria
        const grouped = {};
         for (const msg of data) {
           if (!grouped[msg.categoria]) grouped[msg.categoria] = [];
           grouped[msg.categoria].push({
             ...msg,
              authorId: msg.authorId || msg.user_id || msg.userId || '',
              authorName: msg.authorName || msg.author || '',
              text: msg.message,
              imageData: msg.image_url,
              timestamp: msg.created_at,
            });
          }
        setChatByCategoria(grouped);
      }
    }
    fetchMessages();

    // Realtime: ascolta INSERT, UPDATE, DELETE
    const channel = supabase
      .channel('public:chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat' },
        payload => {
          const msg = payload.new;
          setChatByCategoria(prev => {
            const cat = msg.categoria;
            const arr = prev[cat] ? [...prev[cat]] : [];
            arr.push({
              ...msg,
              authorId: msg.authorId || msg.user_id || msg.userId || '',
              authorName: msg.authorName || msg.author || '',
              text: msg.message,
              imageData: msg.image_url,
              timestamp: msg.created_at,
            });
            return { ...prev, [cat]: arr };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat' },
        payload => {
          const msg = payload.new;
          setChatByCategoria(prev => {
            const cat = msg.categoria;
            const arr = prev[cat] ? [...prev[cat]] : [];
            const idx = arr.findIndex(m => m.id === msg.id);
            if (idx !== -1) {
              arr[idx] = {
                ...arr[idx],
                ...msg,
                authorId: msg.authorId || msg.user_id || msg.userId || '',
                authorName: msg.authorName || msg.author || '',
                text: msg.message,
                imageData: msg.image_url,
                timestamp: msg.created_at,
              };
            }
            return { ...prev, [cat]: arr };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat' },
        payload => {
          const msg = payload.old;
          setChatByCategoria(prev => {
            const cat = msg.categoria;
            const arr = prev[cat] ? prev[cat].filter(m => m.id !== msg.id) : [];
            return { ...prev, [cat]: arr };
          });
        }
      )
      .subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(channel);
    };
  }, []);

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
    // Identita bloccata: l'ID corrente segue sempre quello creato da questo dispositivo.
    const lockedId = myIscrittoId || '';
    localStorage.setItem('bb-my-iscritto-id', lockedId);
    // Mantieni compatibilita con chi legge ancora questa chiave.
    localStorage.setItem('bb-current-chat-user-id', lockedId);
  }, [myIscrittoId]);

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
    // In modalità DEV puoi modificare tutti, altrimenti solo il tuo
    if (!isDevMode && myIscrittoId && String(iscritto?.id || '') !== String(myIscrittoId)) return;
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

  async function handleDeleteIscritto(iscrittoId) {
    const confirmed = window.confirm('Vuoi cancellare davvero questo iscritto?');
    if (!confirmed) return;
    await supabase.from('iscritti').delete().eq('id', iscrittoId);
    if (String(myIscrittoId) === String(iscrittoId)) setMyIscrittoId('');
    if (editingIscrittoId === iscrittoId) {
      setEditingIscrittoId(null);
      setShowAddModal(false);
    }
  }

  async function handleAddIscritto(e) {
    e.preventDefault();
    const ruolo = form.ruolo.trim();
    const cognome = form.cognome.trim();
    const nome = form.nome.trim();
    const telefono = form.telefono.trim();
    const email = form.email.trim().toLowerCase();
    if (!ruolo || !cognome || !nome || !telefono || !email || form.categorie.length === 0) {
      setSaveError('Compila tutti i campi, inclusa la email, e seleziona almeno una categoria.');
      return;
    }
    if (!editingIscrittoId && myIscrittoId && identitaCorrente) {
      setSaveError('Puoi creare solo un iscritto su questo dispositivo.');
      return;
    }
    if (!isDevMode && editingIscrittoId && myIscrittoId && String(editingIscrittoId) !== String(myIscrittoId)) {
      setSaveError('Non puoi modificare l’iscritto di un’altra identita.');
      return;
    }
    let nuovoId = null;
    if (editingIscrittoId) {
      const { error } = await supabase.from('iscritti').update({
        ruolo,
        cognome,
        nome,
        telefono,
        email,
        categorie: form.categorie,
      }).eq('id', editingIscrittoId);
      if (error) {
        alert('Errore nel salvataggio: ' + error.message);
        return;
      }
      nuovoId = editingIscrittoId;
      setEditingIscrittoId(null);
    } else {
      const { data, error } = await supabase.from('iscritti').insert([
        {
          ruolo,
          cognome,
          nome,
          telefono,
          email,
          categorie: form.categorie,
        },
      ]).select();
      if (error) {
        alert('Errore nel salvataggio: ' + error.message);
        return;
      }
      if (data && data[0]) {
        setMyIscrittoId(data[0].id);
        nuovoId = data[0].id;
      }
    }
    // Aggiorna subito la rubrica in localStorage e l'identità locale se il nuovo/aggiornato iscritto è almeno full o viminale
    try {
      const { data: iscrittiData, error: iscrittiError } = await supabase.from('iscritti').select('*');
      if (!iscrittiError && Array.isArray(iscrittiData)) {
        localStorage.setItem('bb-rubrica', JSON.stringify(iscrittiData));
        if (nuovoId) {
          const nuovoIscritto = iscrittiData.find(i => String(i.id) === String(nuovoId));
          if (nuovoIscritto) {
            const categorie = Array.isArray(nuovoIscritto.categorie)
              ? nuovoIscritto.categorie.map(c => String(c).toLowerCase())
              : [String(nuovoIscritto.categoria || '').toLowerCase()];
            if (categorie.includes('full') || categorie.includes('viminale')) {
              localStorage.setItem('bb-my-iscritto-id', String(nuovoIscritto.id));
              localStorage.setItem('bb-current-chat-user-id', String(nuovoIscritto.id));
            }
          }
        }
      }
    } catch {}
    setSaveError('');
    setForm({ ruolo: '', cognome: '', nome: '', telefono: '', email: '', categorie: [] });
    setShowAddModal(false);
  }
// --- FINE MODIFICA SUPABASE ISCRITTI ---

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
  // Funzione per controllare se l'identità corrente è membro di una categoria
  function isMembroCorrenteInCategoria(cat) {
    if (isDevMode) return true;
    return identitaCorrente ? getCategorieArray(identitaCorrente).includes(cat) : false;
  }
  const membroCorrenteInCategoria = isDevMode
    ? true
    : (identitaCorrente && categoriaAperta
      ? getCategorieArray(identitaCorrente).includes(categoriaAperta)
      : false);

  // Applica blacklist locale per "elimina per me"
  const hiddenMsgIds = useMemo(() => {
    try {
      const arr = JSON.parse(localStorage.getItem('bb-chat-hide-msg-ids') || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }, [chatByCategoria]);

  const messaggiCategoriaAperta = categoriaAperta
    ? (chatByCategoria[categoriaAperta] || []).filter(msg => !hiddenMsgIds.includes(msg.id))
    : [];
  const isOverlayOpen = Boolean(categoriaAperta || showMembersModal || showIdentityModal || showAddModal);
  const categoryMessageCounts = categorieDisponibili.reduce((accumulator, categoria) => {
    const messages = Array.isArray(chatByCategoria[categoria]) ? chatByCategoria[categoria] : [];
    const seenCount = Number(seenByCategory[categoria] || 0);
    accumulator[categoria] = Math.max(0, messages.filter(message => !isOwnMessage(message)).length - seenCount);
    return accumulator;
  }, {});

  useEffect(() => {
    if (!categoriaAperta) return;

    const messages = Array.isArray(chatByCategoria[categoriaAperta]) ? chatByCategoria[categoriaAperta] : [];
    setSeenByCategory(prev => ({
      ...prev,
      [categoriaAperta]: messages.filter(message => !isOwnMessage(message)).length,
    }));
  }, [categoriaAperta, chatByCategoria, isOwnMessage]);

  useEffect(() => {
    const entries = Object.entries(chatByCategoria);
    const allMessages = entries.flatMap(([categoria, messages]) =>
      (messages || []).map(message => ({ ...message, categoria: message.categoria || categoria })),
    );
    const nextIds = new Set(allMessages.map(message => message.id));

    if (!initializedMessagesRef.current) {
      knownMessageIdsRef.current = nextIds;
      initializedMessagesRef.current = true;
      // Aggiorna i lastSeenMsgIdRef per tutte le categorie
      for (const [categoria, messages] of Object.entries(chatByCategoria)) {
        if (Array.isArray(messages) && messages.length > 0) {
          lastSeenMsgIdRef.current[categoria] = messages[messages.length - 1].id;
        }
      }
      setChatNotice(''); // Non mostrare la notifica all'apertura
      return;
    }

    const incoming = allMessages.filter(message => !knownMessageIdsRef.current.has(message.id));
    knownMessageIdsRef.current = nextIds;
    if (!incoming.length) {
      setChatNotice('');
      return;
    }

    // Mostra la notifica solo se il nuovo messaggio non è stato ancora visto
    const externalIncoming = incoming.filter(message => !isOwnMessage(message));
    if (!externalIncoming.length) {
      setChatNotice('');
      return;
    }

    const latest = externalIncoming[externalIncoming.length - 1];
    const categoria = latest.categoria;
    // Se la categoria è aperta e l'utente è sulla pagina giusta, aggiorna il lastSeenMsgIdRef
    if (categoriaAperta === categoria && document.hasFocus()) {
      lastSeenMsgIdRef.current[categoria] = latest.id;
      setChatNotice('');
      return;
    }

    // Mostra la notifica solo se non è già stata vista e solo se latest.id non è già in lastSeenMsgIdRef
    if (!lastSeenMsgIdRef.current[categoria] || lastSeenMsgIdRef.current[categoria] !== latest.id) {
      const author = authorLabel(latest);
      const categoryLabel = latest.categoria ? ` in ${latest.categoria}` : '';
      const preview = latest.text?.trim() ? latest.text.trim().slice(0, 60) : 'Nuovo messaggio';
      const noticeText = `Nuovo messaggio${categoryLabel} da ${author}`;
      setChatNotice(noticeText);
      window.setTimeout(() => setChatNotice(''), 4500);
      lastSeenMsgIdRef.current[categoria] = latest.id;
      if (notificationsAllowed) {
        notifyUser(noticeText, preview);
      }
    } else {
      setChatNotice('');
    }
  }, [authorLabel, chatByCategoria, isOwnMessage, notificationsAllowed, categoriaAperta]);

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

    await supabase.from('chat').insert([
      {
        categoria: categoriaAperta,
        user_id: identitaCorrente.id,
        message: testo,
        image_url: chatImageData || null,
        // puoi aggiungere altri campi se vuoi (es. replyTo)
      },
    ]);
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
      {chatPermissionError && (
        <div style={{ position: 'fixed', top: 'calc(var(--bb-mobile-shell-height, 94px) + 56px)', left: '10px', right: '10px', zIndex: 8200, background: '#2a1d1d', border: '1px solid #a33', color: '#ffb8b8', borderRadius: '8px', padding: '8px 10px', fontSize: '0.88rem', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
          {chatPermissionError}
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
        <button className="bb-event-btn" style={{ width: '100%', minHeight: isMobile ? '40px' : undefined, padding: isMobile ? '8px 36px 8px 12px' : '8px 12px', fontSize: isMobile ? '0.9rem' : undefined, position: 'relative' }}
          onClick={() => {
            setReplyTo(null);
            if (isMembroCorrenteInCategoria('Full')) {
              setCategoriaAperta('Full');
              setChatPermissionError('');
            } else {
              setCategoriaAperta(null);
              setChatPermissionError('Non hai i permessi per accedere a questa chat.');
              setTimeout(() => setChatPermissionError(''), 3500);
            }
          }}
        >
          Full
          {categoryMessageCounts.Full > 0 && <span style={{ position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)', minWidth: '20px', height: '20px', borderRadius: '999px', background: '#ff2b2b', color: '#fff', fontSize: '0.7rem', lineHeight: '20px', fontWeight: 800, textAlign: 'center', padding: '0 5px', boxSizing: 'border-box' }}>{categoryMessageCounts.Full > 99 ? '99+' : categoryMessageCounts.Full}</span>}
        </button>
        <button className="bb-event-btn" style={{ width: '100%', minHeight: isMobile ? '40px' : undefined, padding: isMobile ? '8px 36px 8px 12px' : '8px 12px', fontSize: isMobile ? '0.9rem' : undefined, position: 'relative' }}
          onClick={() => {
            setReplyTo(null);
            if (isMembroCorrenteInCategoria('Prospect')) {
              setCategoriaAperta('Prospect');
              setChatPermissionError('');
            } else {
              setCategoriaAperta(null);
              setChatPermissionError('Non hai i permessi per accedere a questa chat.');
              setTimeout(() => setChatPermissionError(''), 3500);
            }
          }}
        >
          Prospect
          {categoryMessageCounts.Prospect > 0 && <span style={{ position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)', minWidth: '20px', height: '20px', borderRadius: '999px', background: '#ff2b2b', color: '#fff', fontSize: '0.7rem', lineHeight: '20px', fontWeight: 800, textAlign: 'center', padding: '0 5px', boxSizing: 'border-box' }}>{categoryMessageCounts.Prospect > 99 ? '99+' : categoryMessageCounts.Prospect}</span>}
        </button>
        <button className="bb-event-btn" style={{ width: '100%', minHeight: isMobile ? '40px' : undefined, padding: isMobile ? '8px 36px 8px 12px' : '8px 12px', fontSize: isMobile ? '0.9rem' : undefined, position: 'relative' }}
          onClick={() => {
            setReplyTo(null);
            if (isMembroCorrenteInCategoria('Viminale')) {
              setCategoriaAperta('Viminale');
              setChatPermissionError('');
            } else {
              setCategoriaAperta(null);
              setChatPermissionError('Non hai i permessi per accedere a questa chat.');
              setTimeout(() => setChatPermissionError(''), 3500);
            }
          }}
        >
          Viminale
          {categoryMessageCounts.Viminale > 0 && <span style={{ position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)', minWidth: '20px', height: '20px', borderRadius: '999px', background: '#ff2b2b', color: '#fff', fontSize: '0.7rem', lineHeight: '20px', fontWeight: 800, textAlign: 'center', padding: '0 5px', boxSizing: 'border-box' }}>{categoryMessageCounts.Viminale > 99 ? '99+' : categoryMessageCounts.Viminale}</span>}
        </button>

        <button className="bb-event-btn" style={{ width: '100%', minHeight: isMobile ? '40px' : undefined, padding: isMobile ? '8px 36px 8px 12px' : '8px 12px', fontSize: isMobile ? '0.9rem' : undefined, position: 'relative' }} onClick={() => setShowIdentityModal(true)}>
          Identita chat: {identitaCorrente ? displayName(identitaCorrente) : 'Non selezionata'}
        </button>

        <button className="bb-event-btn" style={{ width: '100%', minHeight: isMobile ? '40px' : undefined, padding: isMobile ? '8px 36px 8px 12px' : '8px 12px', fontSize: isMobile ? '0.9rem' : undefined, position: 'relative' }} onClick={() => setShowMembersModal(true)}>
          Lista iscritti
        </button>

        {(!myIscrittoId || isDevMode) && (
          <button
            className="bb-add-btn"
            style={{ width: 'auto', marginTop: '12px', alignSelf: 'center', minHeight: isMobile ? '38px' : undefined, padding: isMobile ? '7px 12px' : undefined, fontSize: isMobile ? '0.86rem' : undefined }}
            onClick={() => {
              setEditingIscrittoId(null);
              setForm({ ruolo: '', cognome: '', nome: '', telefono: '', categorie: [] });
              setSaveError('');
              setShowAddModal(true);
            }}
          >
            Crea iscritto
          </button>
        )}
        {myIscrittoId && isDevMode && (
          <button
            className="bb-add-btn"
            style={{ width: 'auto', marginTop: '12px', alignSelf: 'center', minHeight: isMobile ? '38px' : undefined, padding: isMobile ? '7px 12px' : undefined, fontSize: isMobile ? '0.86rem' : undefined }}
            onClick={() => {
              const me = iscritti.find(iscritto => String(iscritto?.id || '') === String(myIscrittoId));
              if (me) startEditIscritto(me);
            }}
          >
            Modifica iscritto
          </button>
        )}
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
                  const isOwn = isOwnMessage(msg);
                  const isSelected = selectedMessages.includes(msg.id);
                  // Modalità modifica messaggio
                  if (editingMsgId === msg.id) {
                    return (
                      <div key={`${msg.timestamp}-${idx}`} style={{ alignSelf: isOwn ? 'flex-end' : 'flex-start', maxWidth: '84%', background: '#ffb366', borderRadius: '12px', padding: '7px 9px', border: '2px solid #fff', position: 'relative' }}>
                        <textarea
                          value={editingMsgText}
                          onChange={e => setEditingMsgText(e.target.value)}
                          style={{ width: '100%', minHeight: '48px', borderRadius: '8px', border: '1px solid #aaa', fontSize: '0.95em', padding: '6px' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                          <button type="button" onClick={handleSaveEditMsg} style={{ background: '#14602f', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 12px', fontWeight: 600, fontSize: '0.95em', cursor: 'pointer' }}>Salva</button>
                          <button type="button" onClick={handleCancelEditMsg} style={{ background: '#444', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 12px', fontWeight: 600, fontSize: '0.95em', cursor: 'pointer' }}>Annulla</button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={`${msg.timestamp}-${idx}`}
                      style={{
                        alignSelf: isOwn ? 'flex-end' : 'flex-start',
                        maxWidth: '84%',
                        background: isSelected ? '#ff6600' : (isOwn ? '#1f7a3f' : '#2a2a2a'),
                        borderRadius: '12px',
                        padding: '7px 9px',
                        border: isSelected ? '2px solid #fff' : undefined,
                        opacity: selectMode && !isSelected ? 0.6 : 1,
                        position: 'relative',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                      onClick={e => {
                        handleToggleSelectMessage(msg.id);
                      }}
                    >
                      {selectMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectMessage(msg.id)}
                          style={{ position: 'absolute', left: '-28px', top: '50%', transform: 'translateY(-50%)', zIndex: 2 }}
                        />
                      )}
                      {!isOwn && (
                        <div style={{ fontSize: '0.76em', color: '#ffb366', marginBottom: '2px' }}>{authorLabel(msg)}</div>
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
                      <div style={{ fontSize: '0.75em', color: '#aaa', marginTop: '2px' }}>
                        {new Date(msg.timestamp && !msg.timestamp.endsWith('Z') ? msg.timestamp + 'Z' : msg.timestamp).toLocaleString()}
                      </div>
                      {!selectMode && (
                        <button type="button" onClick={() => setReplyTo(msg)} style={{ marginTop: '4px', background: isOwn ? '#14602f' : '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75em', cursor: 'pointer' }}>
                          Rispondi
                        </button>
                      )}
                    </div>
                  );
                })}
                {/* Barra azioni selezione multipla */}
                {selectMode && selectedMessages.length > 0 && (
                  <div style={{ position: 'fixed', bottom: isMobile ? 'calc(var(--bb-mobile-bottom-nav-height, 94px) + 8px)' : '18px', left: 0, right: 0, zIndex: 9999, display: 'flex', justifyContent: 'center', gap: '12px', background: '#222', borderRadius: '16px', padding: '10px 16px', boxShadow: '0 2px 12px #000a', alignItems: 'center', maxWidth: '420px', margin: '0 auto' }}>
                    <span style={{ color: '#ffb366', fontWeight: 600, fontSize: '1em' }}>{selectedMessages.length} selezionato{selectedMessages.length > 1 ? 'i' : ''}</span>
                    <button type="button" onClick={exitSelectMode} style={{ background: '#444', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: 600, fontSize: '0.95em', cursor: 'pointer' }}>Annulla</button>
                    {canReply() && (
                      <button type="button" onClick={handleReplySelected} style={{ background: '#14602f', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: 600, fontSize: '0.95em', cursor: 'pointer' }}>Rispondi</button>
                    )}
                    {canEditOrDeleteForAll() && selectedMessages.length === 1 && (
                      <button type="button" onClick={handleEditSelected} style={{ background: '#ffb366', color: '#222', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: 600, fontSize: '0.95em', cursor: 'pointer' }}>Modifica</button>
                    )}
                    {canEditOrDeleteForAll() && (
                      <button type="button" onClick={handleDeleteForAll} style={{ background: '#ff4444', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: 600, fontSize: '0.95em', cursor: 'pointer' }}>Elimina per tutti</button>
                    )}
                    <button type="button" onClick={handleDeleteForMe} style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: 600, fontSize: '0.95em', cursor: 'pointer' }}>Elimina per me</button>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {!identitaCorrente && <div style={{ marginTop: '8px', color: '#ffb366', fontSize: '0.88em' }}>Seleziona prima la tua identita chat.</div>}
              {identitaCorrente && !membroCorrenteInCategoria && <div style={{ marginTop: '8px', color: '#ffb366', fontSize: '0.88em' }}>La tua identita non appartiene a questa categoria.</div>}

              {replyTo && (
                <div style={{ marginTop: '8px', background: '#2a2a2a', borderRadius: '6px', padding: '6px 8px', fontSize: '0.85em' }}>
                  Rispondi a <b>{authorLabel(replyTo)}</b>: {replyPreviewText(replyTo)}
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
                    {isDevMode && (
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
                    )}
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
              <h2 style={{ color: '#ff6600', marginTop: 0, marginBottom: '6px' }}>Identita chat</h2>
              <div style={{ color: '#bbb', fontSize: '0.9em', marginBottom: '8px' }}>Identita bloccata: non si puo cambiare.</div>
            </div>
            {!myIscrittoId && (
              <div style={{ color: '#bbb', fontSize: '0.95em' }}>
                Nessuna identita impostata. Crea un iscritto per usare la chat.
                <div style={{ marginTop: '12px' }}>
                  <button
                    type="button"
                    className="bb-add-btn"
                    style={{ width: 'auto' }}
                    onClick={() => {
                      setShowIdentityModal(false);
                      setEditingIscrittoId(null);
                      setForm({ ruolo: '', cognome: '', nome: '', telefono: '', categorie: [] });
                      setSaveError('');
                      setShowAddModal(true);
                    }}
                  >
                    Crea iscritto
                  </button>
                </div>
              </div>
            )}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {iscritti
                .filter(iscritto => myIscrittoId && String(iscritto?.id || '') === String(myIscrittoId))
                .map((iscritto, idx) => (
                <li key={`${iscritto.id || idx}`} style={{ marginBottom: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
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
                            <label style={{ fontWeight: 600 }}>Email</label>
                            <input name="email" type="email" value={form.email} onChange={handleInput} placeholder="Email" style={{ padding: '8px', borderRadius: '6px', border: 'none', fontSize: '1rem' }} required />
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
