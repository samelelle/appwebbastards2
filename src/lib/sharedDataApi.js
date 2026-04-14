import { hasSupabaseConfig, supabase } from './supabaseClient';
import { notifyBadgeDataChanged } from './notificationBadges';

const EVENTS_KEY = 'bb-events';
const DELETED_EVENTS_KEY = 'bb-events-deleted';
const EVENT_ROUTES_KEY = 'bb-events-routes';
const MEETINGS_KEY = 'bb-riunioni';

function generateId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `fallback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ensureId(item) {
  return item.id ? item : { ...item, id: generateId() };
}

function parseJsonArray(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadLocalEvents(defaultEvents = []) {
  const parsed = parseJsonArray(localStorage.getItem(EVENTS_KEY));
  const deletedIds = new Set(parseJsonArray(localStorage.getItem(DELETED_EVENTS_KEY)));
  const routesById = loadEventRoutes();
  if (parsed.length === 0 && defaultEvents.length > 0) {
    return defaultEvents.map(ev => ensureId({
      ...ev,
      mapRoute: ev.mapRoute || routesById[ev.id] || null,
    })).filter(ev => !deletedIds.has(ev.id));
  }
  return parsed.map(ev => ensureId({
    ...ev,
    start: ev.start instanceof Date ? ev.start : new Date(ev.start),
    end: ev.end instanceof Date ? ev.end : new Date(ev.end),
    mapRoute: ev.mapRoute || routesById[ev.id] || null,
  })).filter(ev => !deletedIds.has(ev.id));
}

function loadDeletedEventIds() {
  return parseJsonArray(localStorage.getItem(DELETED_EVENTS_KEY));
}

function saveDeletedEventIds(ids) {
  localStorage.setItem(DELETED_EVENTS_KEY, JSON.stringify(ids));
}

function loadEventRoutes() {
  const routes = parseJsonArray(localStorage.getItem(EVENT_ROUTES_KEY));
  return routes.reduce((accumulator, item) => {
    if (item?.id) {
      accumulator[item.id] = item.mapRoute || null;
    }
    return accumulator;
  }, {});
}

function saveEventRoutes(routesById) {
  const serialized = Object.entries(routesById)
    .filter(([, mapRoute]) => Boolean(mapRoute))
    .map(([id, mapRoute]) => ({ id, mapRoute }));
  localStorage.setItem(EVENT_ROUTES_KEY, JSON.stringify(serialized));
}

function setEventRoute(eventId, mapRoute) {
  const routesById = loadEventRoutes();
  if (mapRoute) {
    routesById[eventId] = mapRoute;
  } else {
    delete routesById[eventId];
  }
  saveEventRoutes(routesById);
}

function getEventRoute(eventId) {
  return loadEventRoutes()[eventId] || null;
}

function markEventDeleted(eventId) {
  const deletedIds = new Set(loadDeletedEventIds());
  deletedIds.add(eventId);
  saveDeletedEventIds(Array.from(deletedIds));
}

function saveLocalEvents(events) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

function loadLocalMeetings() {
  return parseJsonArray(localStorage.getItem(MEETINGS_KEY)).map(ensureId);
}

function saveLocalMeetings(meetings) {
  localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));
}

function createId() {
  return generateId();
}

function mergeEventsById(localEvents, remoteEvents) {
  const byId = new Map();
  localEvents.forEach(ev => byId.set(ev.id, ev));
  remoteEvents.forEach(ev => byId.set(ev.id, ev));
  return Array.from(byId.values()).sort((a, b) => new Date(a.start) - new Date(b.start));
}

function mergeMeetingsById(localMeetings, remoteMeetings) {
  const byId = new Map();
  localMeetings.forEach(item => byId.set(item.id, item));
  remoteMeetings.forEach(item => byId.set(item.id, item));
  return Array.from(byId.values()).sort((a, b) => {
    const dateA = a.data ? new Date(`${a.data}T${a.ora || '23:59'}`) : new Date(0);
    const dateB = b.data ? new Date(`${b.data}T${b.ora || '23:59'}`) : new Date(0);
    return dateA - dateB;
  });
}

export async function getEvents(defaultEvents = []) {

  const deletedIds = new Set(loadDeletedEventIds());
  if (!hasSupabaseConfig) {
    throw new Error('Supabase non configurato: impossibile sincronizzare eventi.');
  }

  const { data, error } = await supabase
    .from('events')
    .select('id, title, start_at, end_at, note, image')
    .order('start_at', { ascending: true });

  if (error) throw error;

  const remoteEvents = (data || []).map(row => ({
    id: row.id,
    title: row.title,
    start: new Date(row.start_at),
    end: new Date(row.end_at),
    note: row.note || '',
    image: row.image || '',
    mapRoute: getEventRoute(row.id),
  })).filter(ev => !deletedIds.has(ev.id));

  return remoteEvents;
}

export async function addEvent(eventPayload) {
  const payload = {
    id: createId(),
    title: eventPayload.title,
    start: eventPayload.start,
    end: eventPayload.end,
    note: eventPayload.note || '',
    image: eventPayload.image || '',
    mapRoute: eventPayload.mapRoute || null,
  };


  const created = ensureId(payload);
  setEventRoute(created.id, created.mapRoute);
  notifyBadgeDataChanged('events');

  if (!hasSupabaseConfig) {
    throw new Error('Supabase non configurato: impossibile aggiungere eventi.');
  }

  const { data, error } = await supabase
    .from('events')
    .insert({
      id: payload.id,
      title: payload.title,
      start_at: payload.start.toISOString(),
      end_at: payload.end.toISOString(),
      note: payload.note,
      image: payload.image,
    })
    .select('id, title, start_at, end_at, note, image')
    .single();

  if (error) throw error;

  setEventRoute(created.id, created.mapRoute);
  notifyBadgeDataChanged('events');

  return {
    id: data.id,
    title: data.title,
    start: new Date(data.start_at),
    end: new Date(data.end_at),
    note: data.note || '',
    image: data.image || '',
    mapRoute: created.mapRoute || getEventRoute(created.id) || null,
  };
}

export async function updateEvent(eventId, eventPayload) {
  const payload = {
    title: eventPayload.title,
    start: eventPayload.start,
    end: eventPayload.end,
    note: eventPayload.note || '',
    image: eventPayload.image || '',
  };

  if (!hasSupabaseConfig) {
    throw new Error('Supabase non configurato: impossibile aggiornare eventi.');
  }

  const { data, error } = await supabase
    .from('events')
    .update({
      title: payload.title,
      start_at: payload.start.toISOString(),
      end_at: payload.end.toISOString(),
      note: payload.note,
      image: payload.image,
    })
    .eq('id', eventId)
    .select('id, title, start_at, end_at, note, image')
    .single();

  if (error) throw error;

  return {
    id: data.id,
    title: data.title,
    start: new Date(data.start_at),
    end: new Date(data.end_at),
    note: data.note || '',
    image: data.image || '',
  };
}

export async function deleteEvent(eventId) {
  markEventDeleted(eventId);
  setEventRoute(eventId, null);

  if (!hasSupabaseConfig) {
    throw new Error('Supabase non configurato: impossibile eliminare eventi.');
  }

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) throw error;
}

export async function getMeetings() {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase non configurato: impossibile sincronizzare riunioni.');
  }

  const { data, error } = await supabase
    .from('meetings')
    .select('id, data, ora, ordine')
    .order('data', { ascending: true })
    .order('ora', { ascending: true });

  if (error) throw error;

  return (data || []).map(ensureId);
}

export async function addMeeting(meetingPayload) {
  const payload = {
    id: createId(),
    data: meetingPayload.data,
    ora: meetingPayload.ora || '',
    ordine: meetingPayload.ordine,
  };


  const created = ensureId(payload);

  if (!hasSupabaseConfig) {
    throw new Error('Supabase non configurato: impossibile aggiungere riunioni.');
  }

  const { data, error } = await supabase
    .from('meetings')
    .insert(payload)
    .select('id, data, ora, ordine')
    .single();

  if (error) throw error;

  return ensureId(data);
}

export async function updateMeeting(meetingId, meetingPayload) {
  const payload = {
    data: meetingPayload.data,
    ora: meetingPayload.ora || '',
    ordine: meetingPayload.ordine,
  };

  if (!hasSupabaseConfig) {
    throw new Error('Supabase non configurato: impossibile aggiornare riunioni.');
  }

  const { data, error } = await supabase
    .from('meetings')
    .update(payload)
    .eq('id', meetingId)
    .select('id, data, ora, ordine')
    .single();

  if (error) throw error;

  return ensureId(data);
}

export async function deleteMeeting(meetingId) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase non configurato: impossibile eliminare riunioni.');
  }

  const { error } = await supabase
    .from('meetings')
    .delete()
    .eq('id', meetingId);

  if (error) throw error;
}
