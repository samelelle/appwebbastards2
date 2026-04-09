import { useEffect, useState } from 'react';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isTabletPortrait = width <= 1366 && height > width;
    const isPhoneLandscape = height <= 500 && width > height;
    return width <= breakpoint || isTabletPortrait || isPhoneLandscape;
  });

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isTabletPortrait = width <= 1366 && height > width;
      const isPhoneLandscape = height <= 500 && width > height;
      setIsMobile(width <= breakpoint || isTabletPortrait || isPhoneLandscape);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}

export default useIsMobile;
