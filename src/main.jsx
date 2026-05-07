
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    fetch('/sw-manifest.json')
      .then(res => {
        console.log('[SW DEBUG] sw-manifest.json status:', res.status);
        console.log('[SW DEBUG] sw-manifest.json content-type:', res.headers.get('content-type'));
        if (!res.ok) throw new Error('sw-manifest.json request failed');
        return res.json();
      })
      .then(({ sw }) => {
        const swUrl = `/${sw}`;
        console.log('[SW DEBUG] registering service worker:', swUrl);
        navigator.serviceWorker.register(swUrl)
          .then(reg => {
            console.log('[SW DEBUG] service worker registered, scope:', reg.scope);
            window.dispatchEvent(new CustomEvent('bb-sw-registered', { detail: { registration: reg, swUrl } }));
          })
          .catch(err => {
            console.log('[SW DEBUG] service worker register error:', err);
          });
        fetch(swUrl, { cache: 'no-store' })
          .then(res => {
            console.log('[SW DEBUG] sw script status:', res.status);
            console.log('[SW DEBUG] sw script content-type:', res.headers.get('content-type'));
          })
          .catch(err => {
            console.log('[SW DEBUG] sw script fetch error:', err);
          });
      });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
