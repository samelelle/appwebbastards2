const ALLOWED_MEETING_CATEGORIES = new Set(['full', 'viminale']);

function normalizeCategory(value) {
  return String(value || '').trim().toLowerCase();
}

function getMemberCategories(member) {
  if (!member || typeof member !== 'object') return [];

  if (Array.isArray(member.categorie)) {
    return member.categorie.map(normalizeCategory).filter(Boolean);
  }

  if (typeof member.categoria === 'string') {
    const oneCategory = normalizeCategory(member.categoria);
    return oneCategory ? [oneCategory] : [];
  }

  return [];
}

function safeReadLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function canCurrentUserAccessMeetings() {
  // DEV bypass: se attivo, accesso sempre consentito
  try {
    if (localStorage.getItem('bb-dev-bypass-auth') === 'true') return true;
  } catch {}

  const currentUserId = safeReadLocalStorage('bb-current-chat-user-id');
  if (!currentUserId) return false;

  const rawRubrica = safeReadLocalStorage('bb-rubrica');
  if (!rawRubrica) return false;

  try {
    const iscritti = JSON.parse(rawRubrica);
    if (!Array.isArray(iscritti)) return false;

    const currentMember = iscritti.find(iscritto => String(iscritto?.id || '') === String(currentUserId));
    const categories = getMemberCategories(currentMember);

    return categories.some(category => ALLOWED_MEETING_CATEGORIES.has(category));
  } catch {
    return false;
  }
}
