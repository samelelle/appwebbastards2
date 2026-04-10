// Debug temporaneo per capire perché il bottone Riunioni non compare
// Rimuovere dopo il debug!

export function debugCurrentUserCategories() {
  try {
    const currentUserId = localStorage.getItem('bb-current-chat-user-id');
    const rawRubrica = localStorage.getItem('bb-rubrica');
    if (!currentUserId || !rawRubrica) {
      console.log('[DEBUG] currentUserId o rubrica mancante');
      return;
    }
    const iscritti = JSON.parse(rawRubrica);
    const currentMember = iscritti.find(iscritto => String(iscritto?.id || '') === String(currentUserId));
    if (!currentMember) {
      console.log('[DEBUG] Nessun iscritto trovato con id:', currentUserId);
      return;
    }
    let allCategories = [];
    if (Array.isArray(currentMember.categorie)) {
      allCategories = allCategories.concat(currentMember.categorie.map(c => String(c || '').trim().toLowerCase()));
    }
    if (typeof currentMember.categoria === 'string') {
      allCategories.push(String(currentMember.categoria).trim().toLowerCase());
    }
    allCategories = allCategories.filter(Boolean);
    console.log('[DEBUG] Categorie utente:', allCategories, 'Iscritto:', currentMember);
  } catch (e) {
    console.log('[DEBUG] Errore parsing categorie:', e);
  }
}
