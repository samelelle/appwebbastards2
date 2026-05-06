const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const swSrc = path.join(__dirname, '../public/push-sw.js');
const distDir = path.join(__dirname, '../dist');
const swContent = fs.readFileSync(swSrc, 'utf8');
const hash = crypto.createHash('md5').update(swContent).digest('hex').slice(0, 8);
const swDestName = `push-sw.${hash}.js`;
const swDest = path.join(distDir, swDestName);

// Copia il file con hash nel nome nella cartella dist
fs.copyFileSync(swSrc, swDest);

// Salva il nome del file in un manifest JSON per la registrazione dinamica
fs.writeFileSync(path.join(distDir, 'sw-manifest.json'), JSON.stringify({ sw: swDestName }));

console.log(`Service worker copiato come ${swDestName}`);
