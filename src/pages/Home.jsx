import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import teschioImg from '../assets/teschio1.png';
import MaintenanceToggleButton from '../components/MaintenanceToggleButton';
import MobileBottomNav from '../components/MobileBottomNav';
import useIsMobile from '../hooks/useIsMobile';
import { canCurrentUserAccessMeetings } from '../lib/meetingAccess';
import { getUnreadChatCount, getUnreadEventCount, markChatSeen, markEventsSeen, subscribeBadgeChanges } from '../lib/notificationBadges';
import { subscribeUserToPush } from '../lib/pushSubscription';
import { unsubscribeUserFromPush } from '../lib/unsubscribePush';

// Utility per decodificare base64url (come in pushSubscription.js)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function formatPushError(result, fallbackMessage) {
  const reason = result?.reason ? String(result.reason) : 'errore';
  const detailsMessage = result?.details?.message || result?.details?.error_description || '';
  const detailsStatus = result?.details?.status ? `status ${result.details.status}` : '';
  const bodyError =
    result?.details?.body?.error ||
    result?.details?.body?.message ||
    result?.details?.body?.details?.message ||
    '';

  const detail = detailsMessage || bodyError || detailsStatus;
  if (detail) return `${reason}: ${detail}`;
  return String(result?.reason || fallbackMessage || 'errore');
}

function Home({ onLogout, userEmail, isDevMode, isMaintenanceMode, canToggleMaintenance, onToggleMaintenance, canToggleDevMode, onToggleDevMode }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const showMaintenanceNotice = isMaintenanceMode && !isDevMode;
  const [isTabletLandscape, setIsTabletLandscape] = useState(false);
  const [isPhoneLandscape, setIsPhoneLandscape] = useState(false);
  const [canAccessMeetings, setCanAccessMeetings] = useState(() => canCurrentUserAccessMeetings());
  const [unreadEvents, setUnreadEvents] = useState(null);
  const [unreadChats, setUnreadChats] = useState(null);
  const [pushStatus, setPushStatus] = useState(() => {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');
  const [showPushRenewBanner, setShowPushRenewBanner] = useState(false);

    // Controlla se la subscription esistente ha la VAPID key giusta
    useEffect(() => {
      (async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;
        try {
          const registration = await navigator.serviceWorker.getRegistration('/push-sw.js');
          if (!registration) return;
          const subscription = await registration.pushManager.getSubscription();
          if (!subscription) return;
          // Recupera la chiave pubblica attesa
          let vapidKey = null;
          if (import.meta.env.VITE_VAPID_PUBLIC_KEY) {
            vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
          } else {
            try {
              const resp = await fetch('/api/vapid-public-key');
              if (resp.ok) {
                const data = await resp.json();
                vapidKey = data?.publicKey || null;
              }
            } catch {}
          }
          if (!vapidKey) return;
          // Confronta la chiave della subscription con quella attesa
          const subKey = subscription.options?.applicationServerKey || subscription.options?.applicationServerKey;
          if (!subKey) return;
          // subKey può essere ArrayBuffer o base64
          let subKeyArr;
          if (subKey instanceof Uint8Array) {
            subKeyArr = subKey;
          } else if (subKey instanceof ArrayBuffer) {
            subKeyArr = new Uint8Array(subKey);
          } else if (Array.isArray(subKey)) {
            subKeyArr = new Uint8Array(subKey);
          } else {
            // Prova a decodificare
            subKeyArr = urlBase64ToUint8Array(subKey);
          }
          const expectedKeyArr = urlBase64ToUint8Array(vapidKey);
          if (subKeyArr.length !== expectedKeyArr.length || !subKeyArr.every((v, i) => v === expectedKeyArr[i])) {
            setShowPushRenewBanner(true);
          }
        } catch {}
      })();
    }, []);

  useEffect(() => {
    if (!pushError) {
      setShowPushRenewBanner(false);
      return;
    }
    const err = pushError.toLowerCase();
    if (
      err.includes('vapid') ||
      err.includes('auth') ||
      err.includes('not valid') ||
      err.includes('subscription') ||
      err.includes('410') ||
      err.includes('chiave') ||
      err.includes('invalid')
    ) {
      setShowPushRenewBanner(true);
    } else {
      setShowPushRenewBanner(false);
    }
  }, [pushError]);

  useEffect(() => {
    let cancelled = false;

    async function ensureSubscribedWhenGranted() {
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      const result = await subscribeUserToPush();
      if (cancelled) return;
      if (!result?.ok) {
        setPushError(formatPushError(result, 'errore'));
      }
    }

    ensureSubscribedWhenGranted();

    return () => {
      cancelled = true;
    };
  }, []);

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

  async function handleEnablePush() {
    setPushBusy(true);
    setPushError('');
    try {
      const result = await subscribeUserToPush({ interactive: true });
      if (result?.ok) {
        setPushStatus('granted');
      } else {
        setPushStatus(Notification.permission);
        setPushError(formatPushError(result, 'Impossibile attivare le notifiche'));
      }
    } finally {
      setPushBusy(false);
    }
  }

  async function handleRenewPush() {
    setPushBusy(true);
    setPushError('');
    try {
      await unsubscribeUserFromPush();
      const result = await subscribeUserToPush({ interactive: true });
      if (result?.ok) {
        setPushStatus('granted');
        setShowPushRenewBanner(false);
      } else {
        setPushStatus(Notification.permission);
        setPushError(formatPushError(result, 'Impossibile riattivare le notifiche'));
      }
    } finally {
      setPushBusy(false);
    }
  }

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
      {!showMaintenanceNotice && (
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
            {'Notification' in window && pushStatus !== 'granted' && (
              <button
                type="button"
                onClick={handleEnablePush}
                className="bb-add-btn"
                disabled={pushBusy}
                style={{
                  marginLeft: 0,
                  width: 'auto',
                  height: 'auto',
                  padding: '6px 10px',
                  fontSize: '0.72rem',
                  background: '#0a3a6b',
                  color: '#fff',
                }}
              >
                {pushBusy ? 'Attiva...' : 'Abilita push'}
              </button>
            )}
        </div>
      )}
      {!showMaintenanceNotice && showPushRenewBanner && (
        <div style={{ position: 'absolute', top: '64px', right: '12px', left: '12px', zIndex: 30 }}>
          <div style={{ background: '#2a1c1c', color: '#ffb7b7', border: '1px solid #5d2c2c', borderRadius: '10px', padding: '10px', fontSize: '0.95rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <span>Le notifiche push non funzionano più su questo dispositivo.<br/>Per favore riattivale per continuare a riceverle.</span>
            <button
              type="button"
              onClick={handleRenewPush}
              className="bb-add-btn"
              disabled={pushBusy}
              style={{ marginTop: '4px', fontSize: '0.95em', background: '#0a3a6b', color: '#fff', padding: '7px 16px', borderRadius: '8px' }}
            >
              {pushBusy ? 'Riattivo...' : 'Riattiva notifiche'}
            </button>
            {pushError && (
              <span style={{ color: '#ffb7b7', fontSize: '0.85em', marginTop: '2px' }}>Errore: {pushError}</span>
            )}
          </div>
        </div>
      )}
      {!showMaintenanceNotice && !showPushRenewBanner && pushError && (
        <div style={{ position: 'absolute', top: '64px', right: '12px', left: '12px', zIndex: 30 }}>
          <div style={{ background: '#2a1c1c', color: '#ffb7b7', border: '1px solid #5d2c2c', borderRadius: '10px', padding: '10px', fontSize: '0.85rem' }}>
            Notifiche non attive: {pushError}
          </div>
        </div>
      )}
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
      {/* SCRITTA SOTTO L'IMMAGINE */}
      <div className="bb-title" style={{
        fontSize: isMobile ? '1.9rem' : isTabletLandscape ? '2.4rem' : '2.9rem',
        marginTop: isMobile ? '8px' : '18px',
        whiteSpace: 'normal',
        textAlign: 'center',
        lineHeight: 1.1,
      }}>
        Law Enforcement<br />Motorcycle Club
      </div>
      {/* Tasto manutenzione DEV sotto la scritta principale */}
      <MaintenanceToggleButton
        visible={canToggleMaintenance}
        maintenanceMode={isMaintenanceMode}
        onToggle={onToggleMaintenance}
      />
      {showMaintenanceNotice && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px 20px 0 20px', color: '#fff' }}>
          <div style={{ fontSize: isMobile ? '2rem' : '2.4rem', fontWeight: 800, color: '#ff6600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Manutenzione
          </div>
          <div style={{ marginTop: '12px', fontSize: isMobile ? '1rem' : '1.1rem', lineHeight: 1.5, maxWidth: '440px', color: '#ddd' }}>
            L'app non è disponibile in questo momento. Riprova più tardi.
          </div>
        </div>
      )}
      {/* QR code popup rimosso */}
      {!showMaintenanceNotice && <MobileBottomNav />}
    </div>
  );
}

export default Home;
