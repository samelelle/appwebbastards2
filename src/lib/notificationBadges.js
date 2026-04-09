const EVENTS_KEY = 'bb-events';
const CHAT_KEY = 'bb-rubrica-chat';
const SEEN_EVENTS_KEY = 'bb-seen-events-count';
const SEEN_CHAT_KEY = 'bb-seen-chat-count';
const BADGE_SYNC_EVENT = 'bb-badge-sync';

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getEventTotalCount() {
  const events = safeParse(localStorage.getItem(EVENTS_KEY), []);
  return Array.isArray(events) ? events.length : 0;
}

function getChatTotalCount() {
  const chatByCategory = safeParse(localStorage.getItem(CHAT_KEY), {});
  if (!chatByCategory || typeof chatByCategory !== 'object') return 0;

  return Object.values(chatByCategory).reduce((total, messages) => {
    if (!Array.isArray(messages)) return total;
    return total + messages.length;
  }, 0);
}

function emitBadgeSync(scope = 'all') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BADGE_SYNC_EVENT, { detail: { scope } }));
}

export function notifyBadgeDataChanged(scope = 'all') {
  emitBadgeSync(scope);
}

export function subscribeBadgeChanges(onChange) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const relevantStorageKeys = new Set([EVENTS_KEY, CHAT_KEY, SEEN_EVENTS_KEY, SEEN_CHAT_KEY]);

  const handleStorage = event => {
    if (!event.key || relevantStorageKeys.has(event.key)) {
      onChange();
    }
  };

  const handleSyncEvent = () => onChange();

  window.addEventListener('storage', handleStorage);
  window.addEventListener(BADGE_SYNC_EVENT, handleSyncEvent);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(BADGE_SYNC_EVENT, handleSyncEvent);
  };
}

export function getUnreadEventCount() {
  const seen = Number(localStorage.getItem(SEEN_EVENTS_KEY) || 0);
  const total = getEventTotalCount();
  return Math.max(0, total - seen);
}

export function getUnreadChatCount() {
  const seen = Number(localStorage.getItem(SEEN_CHAT_KEY) || 0);
  const total = getChatTotalCount();
  return Math.max(0, total - seen);
}

export function markEventsSeen() {
  localStorage.setItem(SEEN_EVENTS_KEY, String(getEventTotalCount()));
  emitBadgeSync('events');
}

export function markChatSeen() {
  localStorage.setItem(SEEN_CHAT_KEY, String(getChatTotalCount()));
  emitBadgeSync('chat');
}
