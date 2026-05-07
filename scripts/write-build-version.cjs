const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const buildVersion = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const generatedDir = path.join(__dirname, '../src/generated');
const generatedFile = path.join(generatedDir, 'buildVersion.js');
const metaFile = path.join(__dirname, '../.build-version.json');

fs.mkdirSync(generatedDir, { recursive: true });
fs.writeFileSync(generatedFile, `export const BUILD_VERSION = '${buildVersion}';\n`);
fs.writeFileSync(metaFile, JSON.stringify({ version: buildVersion }));

console.log(`Build version generated: ${buildVersion}`);