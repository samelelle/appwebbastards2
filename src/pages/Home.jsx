import { useEffect, useState } from 'react';
import QrCodeShare from '../components/QrCodeShare';
  const [showQr, setShowQr] = useState(false);
import { useNavigate } from 'react-router-dom';
import teschioImg from '../assets/teschio1.png';
import MobileBottomNav from '../components/MobileBottomNav';
import useIsMobile from '../hooks/useIsMobile';
import { canCurrentUserAccessMeetings } from '../lib/meetingAccess';
import { getUnreadChatCount, getUnreadEventCount, markChatSeen, markEventsSeen, subscribeBadgeChanges } from '../lib/notificationBadges';

function Home({ onLogout, userEmail, isDevMode, canToggleDevMode, onToggleDevMode }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isTabletLandscape, setIsTabletLandscape] = useState(false);
  const [isPhoneLandscape, setIsPhoneLandscape] = useState(false);
  const [canAccessMeetings, setCanAccessMeetings] = useState(() => canCurrentUserAccessMeetings());
  const [unreadEvents, setUnreadEvents] = useState(null);
  const [unreadChats, setUnreadChats] = useState(null);

  useEffect(() => {
    const updateTabletLandscape = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setIsTabletLandscape(width > 768 && width <= 1366 && width > height);
      setIsPhoneLandscape((width <= 768 && width > height) || (height <= 500 && width > height));
    };

    updateTabletLandscape();
    window.addEventListener('resize', updateTabletLandscape);
    window.visualViewport?.addEventListener('resize', updateTabletLandscape);

    return () => {
      window.removeEventListener('resize', updateTabletLandscape);
      window.visualViewport?.removeEventListener('resize', updateTabletLandscape);
    };
  }, []);

  useEffect(() => {
    const refreshAccess = () => {
      setCanAccessMeetings(canCurrentUserAccessMeetings());
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
    const refreshUnread = () => {
      setUnreadEvents(getUnreadEventCount());
      setUnreadChats(getUnreadChatCount());
    };

    refreshUnread();
    const timer = window.setInterval(refreshUnread, 5000);
    const unsubscribe = subscribeBadgeChanges(refreshUnread);

    return () => {
      window.clearInterval(timer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const rootEl = document.getElementById('root');
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const prevHtmlTouchAction = document.documentElement.style.touchAction;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    const prevBodyTouchAction = document.body.style.touchAction;
    const prevRootOverflow = rootEl ? rootEl.style.overflow : '';
    const handleTouchMove = event => event.preventDefault();

    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.documentElement.style.touchAction = 'none';
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'none';
    if (rootEl) rootEl.style.overflow = 'hidden';
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      document.documentElement.style.touchAction = prevHtmlTouchAction;
      document.body.style.overflow = prevBodyOverflow || prevOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll || prevOverscroll;
      document.body.style.touchAction = prevBodyTouchAction;
      if (rootEl) rootEl.style.overflow = prevRootOverflow;
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  return (
    <div
      className="bb-page"
      style={{
        height: 'var(--bb-app-height, 100dvh)',
        background: '#111',
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
        touchAction: 'none',
        paddingTop: isMobile ? 'calc(8px + env(safe-area-inset-top))' : 0,
        paddingBottom: isMobile ? 'calc(110px + env(safe-area-inset-bottom))' : 0,
      }}
    >
      <h1
        className="bb-title bb-title-top bb-home-title"
        style={{
          fontSize: isMobile ? '2.55rem' : isTabletLandscape ? '3rem' : '4.8rem',
          marginTop: isTabletLandscape ? '8px' : undefined,
          marginBottom: isTabletLandscape ? '6px' : undefined,
        }}
      >
        BORN BASTARDS
      </h1>
      <button
        type="button"
        className="bb-add-btn"
        style={{ margin: '18px 0 0 0', padding: '8px 18px', fontSize: '1.1rem', background: '#222', color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer' }}
        onClick={() => setShowQr(true)}
      >
        📱 Condividi app
      </button>
      <div
        style={{
          position: 'absolute',
          top: isPhoneLandscape ? 'auto' : isMobile ? 'calc(10px + env(safe-area-inset-top))' : '14px',
          bottom: isPhoneLandscape ? 'calc(var(--bb-mobile-bottom-nav-height, 94px) + 10px + env(safe-area-inset-bottom))' : 'auto',
          right: '12px',
          left: isPhoneLandscape ? '12px' : 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          maxWidth: isPhoneLandscape ? '92vw' : '72vw',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          zIndex: 20,
        }}
      >
          <span style={{ fontSize: '0.72rem', color: '#ffb366', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userEmail || ''}
          </span>
          {!isDevMode ? (
            <button
              type="button"
              onClick={onLogout}
              className="bb-add-btn"
              style={{ marginLeft: 0, width: 'auto', height: 'auto', padding: '6px 10px', fontSize: '0.78rem' }}
            >
              Logout
            </button>
          ) : (
            <span style={{ fontSize: '0.72rem', color: '#7ff27f' }}>DEV</span>
          )}
          {canToggleDevMode && (
            <button
              type="button"
              onClick={onToggleDevMode}
              className="bb-add-btn"
              style={{
                marginLeft: 0,
                width: 'auto',
                height: 'auto',
                padding: '6px 10px',
                fontSize: '0.72rem',
                background: isDevMode ? '#0b6b3a' : '#5a3100',
                color: '#fff',
              }}
            >
              DEV BYPASS: {isDevMode ? 'ON' : 'OFF'}
            </button>
          )}
      </div>

      {/* IMMAGINE DEL TESCHIO */}
      <div
        style={{
          position: (isTabletLandscape || isPhoneLandscape) ? 'absolute' : 'relative',
          top: isTabletLandscape
            ? 'calc(env(safe-area-inset-top) - 52px)'
            : isPhoneLandscape
              ? 'calc(54px + env(safe-area-inset-top))'
              : 'auto',
          left: (isTabletLandscape || isPhoneLandscape) ? 0 : 'auto',
          right: (isTabletLandscape || isPhoneLandscape) ? 0 : 'auto',
          zIndex: (isTabletLandscape || isPhoneLandscape) ? 2 : 'auto',
          display: 'flex',
          justifyContent: 'center',
          margin: (isTabletLandscape || isPhoneLandscape) ? 0 : '14px 0 0 0',
          pointerEvents: 'none',
        }}
      >
          <img
            src={teschioImg}
            className="bb-hero-img"
            style={isTabletLandscape
              ? {
                  width: 'auto',
                  height: 'auto',
                  maxWidth: '260px',
                  maxHeight: '20dvh',
                  objectFit: 'contain',
                  marginTop: '0',
                }
              : isPhoneLandscape
                ? {
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '170px',
                    maxHeight: '24dvh',
                    objectFit: 'contain',
                    marginTop: '0',
                  }
                : undefined}
          />
      </div>
      {showQr && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100dvh', background: 'rgba(0,0,0,0.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowQr(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, minWidth: 260, maxWidth: '90vw', boxShadow: '0 4px 32px #0008', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowQr(false)} style={{ position: 'absolute', top: 8, right: 12, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#222' }}>&times;</button>
            <QrCodeShare />
          </div>
        </div>
      )}
      <MobileBottomNav />
    </div>
  );
}

export default Home;
