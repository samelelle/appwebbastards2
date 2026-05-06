
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    fetch('/sw-manifest.json')
      .then(res => res.json())
      .then(({ sw }) => {
        navigator.serviceWorker.register(`/${sw}`).catch(() => {});
      });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
