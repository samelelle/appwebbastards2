import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

const APP_URL = import.meta.env.VITE_APP_PUBLIC_URL || window.location.origin;

export default function QrCodeShare({ url }) {
  const shareUrl = url || APP_URL;
  return (
    <div style={{ textAlign: 'center', padding: 24 }}>
      <h2>Condividi l'app</h2>
      <QRCodeSVG value={shareUrl} size={200} />
      <div style={{ marginTop: 16, wordBreak: 'break-all' }}>{shareUrl}</div>
      <p>Scansiona il QR code per aprire l'app su un altro dispositivo.</p>
    </div>
  );
}
