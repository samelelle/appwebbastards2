import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import itLocale from 'date-fns/locale/it';
import MobileBottomNav from '../components/MobileBottomNav';
import MobilePageShell from '../components/MobilePageShell';
import useIsMobile from '../hooks/useIsMobile';
import { addEvent, deleteEvent, getEvents, updateEvent } from '../lib/sharedDataApi';
import { sendOneSignalNotification } from '../lib/onesignalNotify';
import { markEventsSeen } from '../lib/notificationBadges';
import { ensureNotificationPermission, notifyUser } from '../lib/notifications';

const locales = { it: itLocale };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const defaultEvents = [
  {
    id: 'default-riunione-club',
    title: 'Riunione Club',
    start: new Date(2026, 2, 28, 21, 0),
    end: new Date(2026, 2, 28, 23, 0),
  },
  {
    id: 'default-uscita-in-moto',
    title: 'Uscita in moto',
    start: new Date(2026, 3, 5, 10, 0),
    end: new Date(2026, 3, 5, 13, 0),
  },
];

function Eventi({ isDevMode }) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [editEventId, setEditEventId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', date: '', start: '', end: '', note: '', image: '' });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [syncError, setSyncError] = useState('');
  const [eventNotice, setEventNotice] = useState('');
  // Tiene traccia dell'ultimo evento visto
  const lastSeenEventIdRef = useRef(null);
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);
  const knownEventIdsRef = useRef(new Set());
  const initializedEventsRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function loadEvents() {
      try {
        setSyncError('');
        const loaded = await getEvents(defaultEvents);
        if (mounted) setEvents(loaded);
      } catch {
        if (mounted) {
          setSyncError('Errore sincronizzazione Eventi: fallback locale attivo.');
          setEvents(defaultEvents);
        }
      }
    }

    loadEvents();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    markEventsSeen();
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
    const evaluate = currentEvents => {
      const normalized = currentEvents.map(ev => ({
        ...ev,
        id: ev.id,
        start: ev.start instanceof Date ? ev.start : new Date(ev.start),
      }));
      const nextIds = new Set(normalized.map(ev => ev.id));

      if (!initializedEventsRef.current) {
        knownEventIdsRef.current = nextIds;
        initializedEventsRef.current = true;
        // All'avvio, considera l'ultimo evento come già visto
        if (normalized.length > 0) {
          lastSeenEventIdRef.current = normalized[normalized.length - 1].id;
        }
        return;
      }

      const added = normalized.filter(ev => !knownEventIdsRef.current.has(ev.id));
      knownEventIdsRef.current = nextIds;
      if (!added.length) return;

      const newest = added.sort((a, b) => b.start - a.start)[0];
      // Se la finestra è attiva e siamo già sulla pagina Eventi, aggiorna lastSeenEventIdRef e non mostrare la notifica
      if (document.hasFocus()) {
        lastSeenEventIdRef.current = newest.id;
        return;
      }
      // Mostra la notifica solo se non è già stata vista
      if (lastSeenEventIdRef.current !== newest.id) {
        const message = `Nuovo evento: ${newest.title}`;
        setEventNotice(message);
        window.setTimeout(() => setEventNotice(''), 4500);
        lastSeenEventIdRef.current = newest.id;
        if (notificationsAllowed) {
          notifyUser('Nuovo evento inserito', newest.title);
        }
        // Notifica push OneSignal
        sendOneSignalNotification({
          title: 'Nuovo evento',
          message: newest.title,
          url: window.location.href
        });
      }
    };

    evaluate(events);
  }, [events, notificationsAllowed]);

  useEffect(() => {
    let active = true;
    const pollId = window.setInterval(async () => {
      try {
        const loaded = await getEvents(defaultEvents);
        if (!active) return;
        setEvents(prev => {
          const prevIds = prev.map(item => item.id).sort().join('|');
          const nextIds = loaded.map(item => item.id).sort().join('|');
          return prevIds === nextIds ? prev : loaded;
        });
      } catch {
        // Keep current events when polling fails.
      }
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(pollId);
    };
  }, []);

  const normalizedEvents = events.map(ev => ({
    ...ev,
    start: ev.start instanceof Date ? ev.start : new Date(ev.start),
    end: ev.end instanceof Date ? ev.end : new Date(ev.end),
  }));

  const [calendarView, setCalendarView] = useState('month');
  const [showForm, setShowForm] = useState(false);
  const [showAllEventsList, setShowAllEventsList] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', start: '', end: '', note: '', image: '' });

  const filteredEvents = normalizedEvents.filter(
    ev => ev.start.getMonth() === calendarDate.getMonth() && ev.start.getFullYear() === calendarDate.getFullYear(),
  );

  const listedEvents = (showAllEventsList ? normalizedEvents : filteredEvents)
    .slice()
    .sort((a, b) => b.start - a.start);

  function goToPrevMonth() {
    setCalendarDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  }

  function goToNextMonth() {
    setCalendarDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  }

  function goToToday() {
    setCalendarDate(new Date());
  }

  function handleCloseDetail() {
    setSelectedEvent(null);
  }

  function handleShowMapRoute(event) {
    if (event.mapRoute) {
      sessionStorage.setItem('mapRoute', JSON.stringify(event.mapRoute));
      navigate('/mappa');
    }
  }

  function handleEditInput(e) {
    if (e.target.name === 'image') {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setEditForm(f => ({ ...f, image: reader.result }));
        };
        reader.readAsDataURL(file);
      }
    } else {
      setEditForm({ ...editForm, [e.target.name]: e.target.value });
    }
  }

  function startEditEvent(ev) {
    setEditEventId(ev.id);
    setEditForm({
      title: ev.title,
      date: ev.start.toISOString().slice(0, 10),
      start: ev.start.toTimeString().slice(0, 5),
      end: ev.end.toTimeString().slice(0, 5),
      note: ev.note || '',
      image: ev.image || '',
    });
  }

  async function handleUpdateEvent(e) {
    e.preventDefault();
    if (!editEventId) return;
    if (!editForm.title.trim() || !editForm.date) {
      setSyncError('Compila titolo e data prima di salvare la modifica.');
      return;
    }
    const dateParts = editForm.date.split('-');
    let start;
    let end;
    if (editForm.start && editForm.end) {
      const [startHour, startMin] = editForm.start.split(':');
      const [endHour, endMin] = editForm.end.split(':');
      start = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], startHour, startMin);
      end = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], endHour, endMin);
    } else {
      start = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 0, 0);
      end = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 23, 59);
    }
    try {
      // Recupera la mapRoute dall'evento selezionato (se esiste)
      const currentEvent = events.find(ev => ev.id === editEventId);
      const mapRoute = currentEvent && currentEvent.mapRoute ? currentEvent.mapRoute : null;
      const saved = await updateEvent(editEventId, {
        title: editForm.title,
        start,
        end,
        note: editForm.note,
        image: editForm.image,
        mapRoute,
      });
      if (saved) {
        setEvents(prev => prev.map(item => (item.id === editEventId ? saved : item)));
      }
      setEditEventId(null);
      setSyncError('');
    } catch {
      setSyncError('Errore aggiornamento evento. Riprova.');
    }
  }

  async function handleDeleteEvent(eventId) {
    try {
      await deleteEvent(eventId);
      setEvents(prev => prev.filter(item => item.id !== eventId));
      if (selectedEvent?.id === eventId) setSelectedEvent(null);
      if (editEventId === eventId) setEditEventId(null);
      setSyncError('');
    } catch {
      setSyncError('Errore eliminazione evento. Riprova.');
    }
  }

  function handleInput(e) {
    if (e.target.name === 'image') {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setForm(f => ({ ...f, image: reader.result }));
        };
        reader.readAsDataURL(file);
      }
    } else {
      setForm({ ...form, [e.target.name]: e.target.value });
    }
  }

  async function handleAddEvent(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.date) {
      setSyncError('Compila titolo e data prima di salvare l evento.');
      return;
    }
    const dateParts = form.date.split('-');
    let start;
    let end;
    if (form.start && form.end) {
      const [startHour, startMin] = form.start.split(':');
      const [endHour, endMin] = form.end.split(':');
      start = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], startHour, startMin);
      end = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], endHour, endMin);
    } else {
      start = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 0, 0);
      end = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 23, 59);
    }
    try {
      // Se il form contiene una mapRoute, salvala nell'evento
      const eventPayload = { title: form.title, start, end, note: form.note, image: form.image };
      if (form.mapRoute) {
        eventPayload.mapRoute = form.mapRoute;
      }
      const created = await addEvent(eventPayload);
      setEvents(prev => [...prev, created]);
      setForm({ title: '', date: '', start: '', end: '', note: '', image: '' });
      setShowForm(false);
      markEventsSeen();
      setSyncError('');
    } catch {
      setSyncError('Errore salvataggio evento. Riprova.');
    }
  }

  const itMessages = {
    date: 'Data',
    time: 'Ora',
    event: 'Evento',
    allDay: 'Tutto il giorno',
    week: 'Settimana',
    work_week: 'Settimana lavorativa',
    day: 'Giorno',
    month: 'Mese',
    previous: 'Precedente',
    next: 'Successivo',
    yesterday: 'Ieri',
    tomorrow: 'Domani',
    today: 'Oggi',
    agenda: 'Lista',
    noEventsInRange: 'Nessun evento in questo intervallo.',
    showMore: total => `+ altri ${total}`,
    weekdays: ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'],
    weekdaysShort: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
    months: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
  };

  const dayPropGetter = (date) => {
    const hasEvent = normalizedEvents.some(
      ev => ev.start.toDateString() === date.toDateString()
    );
    if (hasEvent) {
      return { style: { backgroundColor: '#ff6600' } };
    }
    return {};
  };

  const eventPropGetter = () => {
    if (calendarView === 'month') {
      return {
        style: {
          backgroundColor: 'transparent',
          border: 'none',
          boxShadow: 'none',
          color: 'transparent',
          minHeight: 0,
          margin: 0,
          padding: 0,
          height: 0,
          lineHeight: 0,
          overflow: 'hidden',
        },
      };
    }
    return {};
  };

  return (
    <div
      className="bb-page"
      style={{ height: 'var(--bb-app-height, 100dvh)', background: '#111', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: isMobile ? 0 : '90px', paddingLeft: 0, paddingRight: 0, paddingBottom: 0, position: isMobile ? 'fixed' : 'relative', inset: isMobile ? 0 : 'auto', overflow: 'hidden' }}
    >
      <MobilePageShell title="EVENTI" />
      {!isMobile && <Link to="/" className="bb-back-btn">&#8592; Home</Link>}
      {!isMobile && <h1 className="bb-title" style={{ margin: 0 }}>EVENTI</h1>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%', maxWidth: '700px', marginTop: isMobile ? 0 : '32px', alignItems: 'stretch', justifyContent: isMobile ? 'flex-start' : 'center', flex: isMobile ? '0 0 auto' : '1 1 auto', height: isMobile ? 'calc(100dvh - var(--bb-mobile-bottom-nav-height, 94px) - 8px)' : 'auto', maxHeight: isMobile ? 'calc(100dvh - var(--bb-mobile-bottom-nav-height, 94px) - 8px)' : 'none', overflowY: 'auto', overflowX: 'hidden', paddingTop: isMobile ? 'calc(var(--bb-mobile-shell-height, 94px) + clamp(18px, 4vw, 28px))' : 0, paddingLeft: isMobile ? 'clamp(8px, 2.5vw, 12px)' : 0, paddingRight: isMobile ? 'clamp(8px, 2.5vw, 12px)' : 0, paddingBottom: isMobile ? 'calc(var(--bb-mobile-bottom-nav-height, 94px) + clamp(18px, 4vw, 28px))' : 0, boxSizing: 'border-box' }}>
        {syncError && <div style={{ color: '#ffb366', fontSize: '0.9rem', width: '100%' }}>{syncError}</div>}
        {eventNotice && <div style={{ color: '#b8f7b8', fontSize: '0.9rem', width: '100%', background: '#1d2a1d', border: '1px solid #2f5d2f', borderRadius: '8px', padding: '8px 10px', boxSizing: 'border-box' }}>{eventNotice}</div>}
        <div style={{ background: '#222', borderRadius: '16px', padding: isMobile ? '10px' : '12px', width: '100%', maxWidth: isMobile ? '100%' : '700px', boxSizing: 'border-box', boxShadow: '0 2px 16px #0008', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <button onClick={goToToday} style={{ fontSize: '0.8em', padding: '2px 8px', borderRadius: 6, background: '#fff', color: '#222', border: '1px solid #bbb', marginRight: 4 }}>Oggi</button>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={goToPrevMonth} style={{ fontSize: '0.8em', padding: '2px 8px', borderRadius: 6, background: '#fff', color: '#222', border: '1px solid #bbb' }}>Back</button>
              <button onClick={goToNextMonth} style={{ fontSize: '0.8em', padding: '2px 8px', borderRadius: 6, background: '#fff', color: '#222', border: '1px solid #bbb' }}>Next</button>
            </div>
          </div>
          <div style={{ width: '100%', overflowX: 'hidden', overflowY: 'visible', minWidth: 0 }}>
            <Calendar
              localizer={localizer}
              events={normalizedEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ width: '100%', height: isMobile ? 300 : 420, maxHeight: 540, minHeight: isMobile ? 250 : 320, minWidth: 0, maxWidth: '100%', fontSize: '0.95rem', color: '#111', background: '#fff', borderRadius: '12px', padding: isMobile ? '6px' : '8px', overflow: 'hidden' }}
              views={['month', 'week', 'agenda']}
              messages={itMessages}
              view={calendarView}
              onView={setCalendarView}
              date={calendarDate}
              onNavigate={setCalendarDate}
              onSelectEvent={event => setSelectedEvent(event)}
              dayPropGetter={dayPropGetter}
              eventPropGetter={eventPropGetter}
              components={{
                month: {
                  dateHeader: ({ date, label }) => {
                    const eventCount = normalizedEvents.filter(
                      ev => ev.start.toDateString() === date.toDateString()
                    ).length;

                    return (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 3px', boxSizing: 'border-box' }}>
                        <span style={{ fontWeight: 600 }}>{label}</span>
                        {eventCount > 0 && (
                          <span style={{
                            minWidth: '14px',
                            height: '14px',
                            padding: '0 3px',
                            borderRadius: '999px',
                            background: '#2563eb',
                            color: '#fff',
                            fontSize: '9px',
                            fontWeight: 700,
                            lineHeight: '14px',
                            textAlign: 'center',
                            boxSizing: 'border-box',
                            flexShrink: 0,
                          }}>
                            {eventCount}
                          </span>
                        )}
                      </div>
                    );
                  }
                },
                event: ({ event }) => null,
              }}
            />
          </div>
          {isDevMode && (
            <>
              <button className="bb-add-btn" style={{ marginTop: '10px', width: isMobile ? '72%' : '60%', maxWidth: isMobile ? '240px' : 'none', fontSize: '0.75rem', padding: '3px 0', minWidth: 0 }} onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Annulla' : 'Aggiungi evento'}
              </button>
              {showForm && (
                <form onSubmit={handleAddEvent} style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', background: '#333', borderRadius: '8px', padding: '10px' }}>
                  <input name="title" type="text" placeholder="Titolo evento" value={form.title} onChange={handleInput} style={{ padding: '5px', borderRadius: '5px', border: 'none', fontSize: '1rem' }} />
                  <input className="bb-date-input" name="date" type="date" value={form.date} onChange={handleInput} style={{ padding: '5px', borderRadius: '5px', fontSize: '1rem' }} />
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <input className="bb-time-input" name="start" type="time" value={form.start} onChange={handleInput} style={{ flex: 1, padding: '5px', borderRadius: '5px', fontSize: '1rem' }} />
                    <input className="bb-time-input" name="end" type="time" value={form.end} onChange={handleInput} style={{ flex: 1, padding: '5px', borderRadius: '5px', fontSize: '1rem' }} />
                  </div>
                  <textarea name="note" placeholder="Note evento" value={form.note} onChange={handleInput} style={{ padding: '5px', borderRadius: '5px', border: 'none', minHeight: '28px', resize: 'vertical', fontSize: '1rem' }} />
                  <input name="image" type="file" accept="image/*" onChange={handleInput} style={{ marginTop: '4px', color: '#fff', fontSize: '1rem' }} />
                  {form.image && <img src={form.image} alt="anteprima" style={{ maxWidth: '100%', maxHeight: '70px', marginTop: '4px', borderRadius: '6px' }} />}
                  <button className="bb-event-btn" type="submit" style={{ width: '100%', fontSize: '1rem', padding: '6px 0' }}>Salva evento</button>
                </form>
              )}
            </>
          )}
        </div>

        <div style={{ width: '100%', color: '#fff', background: '#222', borderRadius: '14px', padding: '6px 2px 10px 2px', boxShadow: '0 2px 12px #0008', minWidth: '120px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '0 6px' }}>
            <h2 style={{ color: '#ff6600', fontSize: '1.1rem', margin: 0 }}>
              {showAllEventsList ? 'Tutti gli eventi inseriti' : 'Eventi del mese'}
            </h2>
            <button
              type="button"
              className="bb-add-btn"
              onClick={() => setShowAllEventsList(prev => !prev)}
              style={{ width: 'auto', minWidth: '126px', padding: '4px 10px', fontSize: '0.78rem', marginTop: 0 }}
            >
              {showAllEventsList ? 'Vedi mese corrente' : 'Mostra tutti eventi'}
            </button>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'flex-start', width: '100%', overflowX: 'hidden' }}>
            {listedEvents.map(ev => {
              const isAllDay = ev.start.getHours() === 0 && ev.start.getMinutes() === 0 && ev.end.getHours() === 23 && ev.end.getMinutes() === 59;
              return (
                <li
                  key={ev.id}
                  style={{
                    background: editEventId === ev.id ? '#333' : '#222',
                    borderRadius: '7px',
                    marginBottom: '0',
                    padding: '6px 8px',
                    color: '#fff',
                    boxShadow: '0 1px 4px #0006',
                    cursor: editEventId === ev.id ? 'default' : 'pointer',
                    position: 'relative',
                    minWidth: isMobile ? 'calc(50% - 5px)' : '130px',
                    maxWidth: isMobile ? 'calc(50% - 5px)' : '160px',
                    flex: isMobile ? '1 1 calc(50% - 5px)' : '1 0 130px',
                    fontSize: '0.92em',
                    minHeight: '48px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                    wordBreak: 'break-word',
                  }}
                >
                  <div onClick={() => setSelectedEvent(ev)}>
                    <b>{ev.title}</b><br />
                    {ev.start.toLocaleDateString()} {isAllDay ? '' : `${ev.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${ev.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    {ev.note && <div style={{ fontSize: '0.85em', color: '#ffb366', marginTop: '2px', wordBreak: 'break-word' }}><b>Note:</b> {ev.note}</div>}
                    {ev.image && <img src={ev.image} alt="evento" style={{ maxWidth: '100%', maxHeight: '50px', marginTop: '4px', borderRadius: '6px' }} />}
                  </div>
                  {isDevMode && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <button className="bb-add-btn" style={{ fontSize: '0.82rem', padding: '3px 10px', minWidth: '68px', borderRadius: '5px', background: '#ff6600', color: '#fff', fontWeight: 700, letterSpacing: '0.5px', border: 'none', whiteSpace: 'nowrap' }} onClick={() => startEditEvent(ev)}>Modifica</button>
                      <button className="bb-event-btn" style={{ width: 'auto', minWidth: '68px', fontSize: '0.82rem', padding: '3px 10px', borderRadius: '5px', background: '#ff4444', color: '#fff', fontWeight: 700, letterSpacing: '0.5px', border: 'none', whiteSpace: 'nowrap' }} onClick={() => handleDeleteEvent(ev.id)}>Cancella</button>
                    </div>
                  )}
                </li>
              );
            })}
            {listedEvents.length === 0 && (
              <li style={{ color: '#bbb', padding: '2px 8px' }}>
                {showAllEventsList ? 'Nessun evento inserito.' : 'Nessun evento nel mese selezionato.'}
              </li>
            )}
          </ul>

          {editEventId !== null && isDevMode && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
              <div style={{ background: '#222', color: '#fff', borderRadius: '16px', padding: '32px', minWidth: '320px', maxWidth: '90vw', boxShadow: '0 4px 24px #000a', position: 'relative' }}>
                <button onClick={() => setEditEventId(null)} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', color: '#ff6600', fontSize: '2rem', cursor: 'pointer' }} title="Chiudi">&times;</button>
                <h2 style={{ color: '#ff6600', marginTop: 0 }}>Modifica evento</h2>
                <form onSubmit={handleUpdateEvent} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input name="title" type="text" value={editForm.title} onChange={handleEditInput} placeholder="Titolo evento" style={{ padding: '8px', borderRadius: '6px', border: 'none', fontSize: '1rem' }} />
                  <input className="bb-date-input" name="date" type="date" value={editForm.date} onChange={handleEditInput} style={{ padding: '8px', borderRadius: '6px', fontSize: '1rem' }} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="bb-time-input" name="start" type="time" value={editForm.start} onChange={handleEditInput} style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '1rem' }} />
                    <input className="bb-time-input" name="end" type="time" value={editForm.end} onChange={handleEditInput} style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '1rem' }} />
                  </div>
                  <textarea name="note" placeholder="Note evento" value={editForm.note} onChange={handleEditInput} style={{ padding: '8px', borderRadius: '6px', border: 'none', minHeight: '32px', resize: 'vertical', fontSize: '1rem' }} />
                  <input name="image" type="file" accept="image/*" onChange={handleEditInput} style={{ marginTop: '4px', color: '#fff', fontSize: '1rem' }} />
                  {editForm.image && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                      <img src={editForm.image} alt="anteprima" style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '8px' }} />
                      <button type="button" onClick={() => setEditForm(f => ({ ...f, image: '' }))} style={{ background: '#ff4444', color: '#fff', border: 'none', borderRadius: '5px', padding: '2px 10px', cursor: 'pointer', fontSize: '0.95em' }}>Rimuovi foto</button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <button className="bb-event-btn" type="submit" style={{ flex: 1, fontSize: '1rem', padding: '8px 0', borderRadius: '6px' }}>Salva</button>
                    <button className="bb-add-btn" type="button" style={{ flex: 1, fontSize: '1rem', padding: '8px 0', borderRadius: '6px' }} onClick={() => setEditEventId(null)}>Annulla</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {selectedEvent && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#222', color: '#fff', borderRadius: '16px', padding: '32px', minWidth: '320px', maxWidth: '90vw', boxShadow: '0 4px 24px #000a', position: 'relative' }}>
              <button onClick={handleCloseDetail} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', color: '#ff6600', fontSize: '2rem', cursor: 'pointer' }} title="Chiudi">&times;</button>
              <h2 style={{ color: '#ff6600', marginTop: 0 }}>{selectedEvent.title}</h2>
              <div style={{ marginBottom: '12px' }}><b>Data:</b> {selectedEvent.start instanceof Date ? selectedEvent.start.toLocaleDateString() : ''}</div>
              {selectedEvent.start && selectedEvent.end && (selectedEvent.start.getHours() !== 0 || selectedEvent.start.getMinutes() !== 0 || selectedEvent.end.getHours() !== 23 || selectedEvent.end.getMinutes() !== 59) && (
                <div style={{ marginBottom: '12px' }}><b>Orario:</b> {selectedEvent.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {selectedEvent.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              )}
              {selectedEvent.note && <div style={{ marginBottom: '12px', color: '#ffb366', wordBreak: 'break-word' }}><b>Note:</b> {selectedEvent.note}</div>}
              {selectedEvent.image && <img src={selectedEvent.image} alt="evento" style={{ maxWidth: '100%', maxHeight: '180px', marginBottom: '12px', borderRadius: '10px' }} />}
              {selectedEvent.mapRoute && (
                <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => handleShowMapRoute(selectedEvent)} style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', background: '#ff6600', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
                    Mostra percorso
                  </button>
                  <button type="button" onClick={handleCloseDetail} style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', background: '#444', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
                    Chiudi
                  </button>
                </div>
              )}
              {!selectedEvent.mapRoute && (
                <button type="button" onClick={handleCloseDetail} style={{ marginTop: '16px', width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#444', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
                  Chiudi
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <MobileBottomNav />
    </div>
  );
}

export default Eventi;
