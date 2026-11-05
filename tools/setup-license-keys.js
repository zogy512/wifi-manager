'use strict';

const { webcrypto } = require('crypto');
const fs = require('fs');
const path = require('path');

(async () => {
  const file = path.join(__dirname, 'license-key.json');
  if (fs.existsSync(file) && !process.argv.includes('--force')) {
    console.error('Une clé privée existe déjà : tools/license-key.json');
    console.error('Ne la remplacez pas, sinon tous les futurs codes seront invalides.');
    process.exit(1);
  }
  const { publicKey, privateKey } = await webcrypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  const pub = await webcrypto.subtle.exportKey('jwk', publicKey);
  const priv = await webcrypto.subtle.exportKey('jwk', privateKey);
  fs.writeFileSync(file, JSON.stringify(priv, null, 2), { mode: 0o600 });
  console.log('Clé privée enregistrée dans tools/license-key.json (ne pas partager).');
  console.log('\nClé publique à intégrer dans app.js :\n');
  console.log(JSON.stringify(pub, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
