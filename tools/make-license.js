'use strict';

const { webcrypto } = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');

const PLANS = {
  '3m': 3,
  '6m': 6,
  '1y': 12,
};

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const hasFlag = (name) => args.includes(`--${name}`);

function todayKey() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function addMonths(key, months) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setMonth(date.getMonth() + months);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function base64url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function main() {
  if (hasFlag('help') || hasFlag('h')) {
    console.log(`Utilisation :
  node tools/make-license.js --device ID --plan 3m|6m|1y --name "Nom" [--start AAAA-MM-JJ]
  node tools/make-license.js --device "*" --months 120 --name Propriétaire
  node tools/make-license.js                 (mode interactif)

Options :
  --device   ID affiché dans l'application ("*" pour un code non lié à un appareil)
  --plan     3m, 6m ou 1y
  --months   durée personnalisée en mois (prioritaire sur --plan)
  --name     nom du client ou du point de vente
  --start    date de début (par défaut aujourd'hui)
  --auto-start  la durée commence à l'activation (utile pour un stock)
  --code-only  affiche uniquement le code d'activation`);
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let device = option('device');
  let plan = option('plan');
  let monthsArg = option('months');
  let name = option('name');
  let start = option('start');
  const autoStart = hasFlag('auto-start');

  if (!device) device = (await rl.question('ID de l’appareil (ou * pour propriétaire) : ')).trim();
  if (!plan && !monthsArg) plan = (await rl.question('Formule (3m, 6m, 1y) : ')).trim();
  if (!name) name = (await rl.question('Nom du client / point de vente : ')).trim();
  if (!autoStart && !start) {
    start = process.stdin.isTTY
      ? (await rl.question(`Date de début [${todayKey()}] : `)).trim() || todayKey()
      : todayKey();
  }
  rl.close();

  if (!device) throw new Error('ID appareil obligatoire');
  if (!autoStart && !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    throw new Error('Date de début invalide (AAAA-MM-JJ)');
  }

  const months = monthsArg ? Number(monthsArg) : PLANS[plan];
  if (!Number.isInteger(months) || months < 1 || months > 240) {
    throw new Error('Formule ou durée invalide');
  }
  if (!plan) plan = 'custom';

  const end = autoStart ? null : addMonths(start, months);
  const payload = autoStart
    ? {
        a: 'wifipro',
        v: 1,
        d: device,
        p: plan,
        n: name || 'Client',
        s: 'auto',
        e: 'auto',
        m: months,
        i: new Date().toISOString(),
      }
    : {
        a: 'wifipro',
        v: 1,
        d: device,
        p: plan,
        n: name || 'Client',
        s: start,
        e: end,
        i: new Date().toISOString(),
      };
  const payloadText = JSON.stringify(payload);

  const keyFile = path.join(__dirname, 'license-key.json');
  if (!fs.existsSync(keyFile)) {
    throw new Error('Clé privée introuvable : tools/license-key.json');
  }
  const privateJwk = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
  const key = await webcrypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const signature = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(payloadText)
  );
  const code = `${base64url(Buffer.from(payloadText, 'utf8'))}.${base64url(signature)}`;

  if (hasFlag('code-only')) {
    console.log(code);
    return;
  }

  console.log('');
  console.log('Licence WifiPro');
  console.log('---------------');
  console.log(`Appareil : ${device}`);
  console.log(`Client   : ${payload.n}`);
  console.log(`Formule  : ${plan} (${months} mois)`);
  if (autoStart) {
    console.log('Début    : à l’activation');
    console.log(`Fin      : ${months} mois après activation`);
  } else {
    console.log(`Du       : ${start}`);
    console.log(`Au       : ${end}`);
  }
  console.log('');
  console.log('Code d’activation à envoyer au client :');
  console.log('');
  console.log(code);
  console.log('');
}

main().catch((e) => {
  console.error('Erreur :', e.message);
  process.exit(1);
});
