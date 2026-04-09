import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import useIsMobile from '../hooks/useIsMobile';

function MobilePageShell({ title, backTo = '/', backLabel = 'Home' }) {
  const isMobile = useIsMobile();
  const shellRef = useRef(null);

  useEffect(() => {
    if (!isMobile || !shellRef.current) return undefined;

    const root = document.documentElement;

    const updateShellHeight = () => {
      root.style.setProperty('--bb-mobile-shell-height', `${Math.ceil(shellRef.current.getBoundingClientRect().height)}px`);
    };

    updateShellHeight();

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateShellHeight);
      resizeObserver.observe(shellRef.current);
    }

    window.addEventListener('resize', updateShellHeight);
    window.visualViewport?.addEventListener('resize', updateShellHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateShellHeight);
      window.visualViewport?.removeEventListener('resize', updateShellHeight);
    };
  }, [isMobile]);

  if (!isMobile) return null;

  return (
    <div
      ref={shellRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 6500,
        background: '#111',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.22)',
        paddingTop: 'max(8px, env(safe-area-inset-top))',
        paddingLeft: 'clamp(10px, 3vw, 14px)',
        paddingRight: 'clamp(10px, 3vw, 14px)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'clamp(4px, 1.5vw, 8px)',
          pointerEvents: 'auto',
        }}
      >
        <Link
          to={backTo}
          className="bb-back-btn"
          style={{ position: 'static', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '4px', whiteSpace: 'nowrap', fontSize: 'clamp(0.76rem, 2.7vw, 0.88rem)', padding: 'clamp(4px, 1.2vw, 6px) clamp(8px, 2.2vw, 10px)' }}
        >
          &#8592; {backLabel}
        </Link>
        <h1 className="bb-title" style={{ margin: 0, fontSize: 'clamp(1.2rem, 4.8vw, 1.5rem)', textAlign: 'center', flex: 1, lineHeight: 1.05, color: '#ff6600', fontFamily: "'Carnivalee Freakshow', Impact, Arial Black, sans-serif" }}>
          {title}
        </h1>
        <div style={{ width: 'clamp(44px, 14vw, 64px)' }} />
      </div>
    </div>
  );
}

export default MobilePageShell;