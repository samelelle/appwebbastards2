import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useIsMobile from '../hooks/useIsMobile';
import { canCurrentUserAccessMeetings } from '../lib/meetingAccess';

function canShowMeetingsButton() {
  try {
    const currentUserId = localStorage.getItem('bb-current-chat-user-id');
    const rawRubrica = localStorage.getItem('bb-rubrica');
    if (!currentUserId || !rawRubrica) return false;
    const iscritti = JSON.parse(rawRubrica);
    if (!Array.isArray(iscritti)) return false;
    const currentMember = iscritti.find(iscritto => String(iscritto?.id || '') === String(currentUserId));
    if (!currentMember) return false;
    const cats = (Array.isArray(currentMember.categorie) ? currentMember.categorie : [currentMember.categoria || ''])
      .map(c => String(c || '').trim().toLowerCase())
      .filter(Boolean);
    // Mostra solo se almeno una categoria è 'full' o 'viminale'
    return cats.some(c => c === 'full' || c === 'viminale');
  } catch {
    return false;
  }
}

function isDevBypassEnabled() {
  try {
    return localStorage.getItem('bb-dev-bypass-auth') === 'true';
  } catch {
    return false;
  }
}
import { getUnreadChatCount, getUnreadEventCount, markChatSeen, markEventsSeen, subscribeBadgeChanges } from '../lib/notificationBadges';
import { useState } from 'react';

function MobileBottomNav() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);
  const [unreadEvents, setUnreadEvents] = useState(null);
  const [unreadChats, setUnreadChats] = useState(null);
  const [canAccessMeetings, setCanAccessMeetings] = useState(() => isDevBypassEnabled() || canShowMeetingsButton());

  useEffect(() => {
    const refreshAccess = () => {
      setCanAccessMeetings(isDevBypassEnabled() || canShowMeetingsButton());
    };

    refreshAccess();
    window.addEventListener('focus', refreshAccess);
    window.addEventListener('storage', refreshAccess);

    return () => {
      window.removeEventListener('focus', refreshAccess);
      window.removeEventListener('storage', refreshAccess);
    };
  }, []);

  useEffect(() => {
    const updateUnread = () => {
      setUnreadEvents(getUnreadEventCount());
      setUnreadChats(getUnreadChatCount());
    };

    updateUnread();
    const timer = window.setInterval(updateUnread, 5000);
    const unsubscribe = subscribeBadgeChanges(updateUnread);

    return () => {
      window.clearInterval(timer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isMobile || !navRef.current) return undefined;

    const root = document.documentElement;

    const updateNavHeight = () => {
      root.style.setProperty('--bb-mobile-bottom-nav-height', `${Math.ceil(navRef.current.getBoundingClientRect().height)}px`);
    };

    updateNavHeight();

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateNavHeight);
      resizeObserver.observe(navRef.current);
    }

    window.addEventListener('resize', updateNavHeight);
    window.visualViewport?.addEventListener('resize', updateNavHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateNavHeight);
      window.visualViewport?.removeEventListener('resize', updateNavHeight);
    };
  }, [isMobile]);

  if (!isMobile) return null;

  const items = [
    { label: 'Home', path: '/' },
    { label: 'Eventi', path: '/eventi' },
    { label: 'Rubrica', path: '/rubrica' },
    ...(canAccessMeetings ? [{ label: 'Riunioni', path: '/riunioni' }] : []),
    { label: 'Foto', path: '/foto' },
    { label: 'Mappa', path: '/mappa' },
  ];

  return (
    <div
      ref={navRef}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 7000,
        background: 'rgba(18,18,18,0.98)',
        borderTop: '1px solid #333',
        display: 'grid',
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        padding: '8px 6px calc(8px + env(safe-area-inset-bottom)) 6px',
        gap: '6px',
        backdropFilter: 'blur(6px)',
      }}
    >
      {items.map(item => {
        const active = location.pathname === item.path;
        const handlePress = () => {
          if (item.path === '/eventi') {
            markEventsSeen();
            setUnreadEvents(null);
          }
          if (item.path === '/rubrica') {
            markChatSeen();
            setUnreadChats(null);
          }
          navigate(item.path);
        };

        const badgeCount = item.path === '/eventi' ? unreadEvents : item.path === '/rubrica' ? unreadChats : null;

        return (
          <button
            key={item.path}
            type="button"
            onClick={handlePress}
            style={{
              background: active ? '#ff6600' : '#222',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              minHeight: '44px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            {item.label}
            {Number.isFinite(badgeCount) && badgeCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-4px',
                  minWidth: '18px',
                  height: '18px',
                  borderRadius: '999px',
                  background: '#ff2b2b',
                  color: '#fff',
                  fontSize: '0.65rem',
                  lineHeight: '18px',
                  fontWeight: 800,
                  padding: '0 5px',
                  boxSizing: 'border-box',
                }}
              >
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default MobileBottomNav;
