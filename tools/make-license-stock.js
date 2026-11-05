'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PLANS = {
  '3m': { label: '3 mois', price: 2000, tag: '3M' },
  '6m': { label: '6 mois', price: 5000, tag: '6M' },
  '1y': { label: '1 an', price: 10000, tag: '1A' },
};

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const hasFlag = (name) => args.includes(`--${name}`);
const nf = new Intl.NumberFormat('fr-FR');

const todayKey = () => {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
};

const stamp = () => {
  const now = new Date();
  return [
    todayKey(),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join('-');
};

if (hasFlag('help') || hasFlag('h')) {
  console.log(`Utilisation :
  node tools/make-license-stock.js [--count 10] [--plans 3m,6m,1y] [--out FICHIER] [--force]

Génère un stock de codes valables sur tout appareil et dont la durée commence
à l'activation. Chaque code est unique et étiqueté (WF-3M-001, etc.).

Options :
  --count   nombre de codes par formule (défaut : 10)
  --plans   formules à générer (défaut : 3m,6m,1y)
  --out     fichier de sortie (défaut : ~/wifipro-stock-AAA-MM-JJ-HH-MM.txt)
  --force   écrase le fichier de sortie s'il existe`);
  process.exit(0);
}

const count = Math.max(1, Math.min(200, Number(option('count')) || 10));
const planIds = (option('plans') || '3m,6m,1y')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const unknown = planIds.filter((id) => !PLANS[id]);
if (!planIds.length || unknown.length) {
  console.error('Formule inconnue. Utilisez 3m, 6m ou 1y.');
  process.exit(1);
}

let out = option('out') || path.join(os.homedir(), `wifipro-stock-${stamp()}.txt`);
if (fs.existsSync(out) && !hasFlag('force')) {
  const base = out.replace(/\.txt$/i, '');
  let i = 2;
  while (fs.existsSync(`${base}-${i}.txt`)) i += 1;
  out = `${base}-${i}.txt`;
}

const tool = path.join(__dirname, 'make-license.js');
const batch = stamp();
const lines = [];
lines.push('STOCK DE LICENCES WIFIPRO');
lines.push(`Généré le ${todayKey()} à ${batch.slice(11).replace('-', ':')}`);
lines.push('');
lines.push('Ces codes ne sont pas liés à un appareil : ils fonctionnent sur tout téléphone.');
lines.push('La durée (3, 6 ou 12 mois) démarre le jour de l’activation.');
lines.push('Notez le client à qui vous envoyez chaque code.');
lines.push('ATTENTION : un code n’est pas à usage unique. Gardez ce fichier privé.');
lines.push('');
lines.push('Prix indicatifs : 3 mois = 2 000 F · 6 mois = 5 000 F · 1 an = 10 000 F.');
lines.push('');

let total = 0;
for (const planId of planIds) {
  const plan = PLANS[planId];
  lines.push(`=== ${plan.label.toUpperCase()} — ${nf.format(plan.price)} F ===`);
  lines.push('');
  for (let i = 1; i <= count; i += 1) {
    const label = `WF-${plan.tag}-${String(i).padStart(3, '0')}`;
    const code = execFileSync(
      'node',
      [
        tool,
        '--device',
        '*',
        '--plan',
        planId,
        '--name',
        `Stock ${label} ${batch}`,
        '--auto-start',
        '--code-only',
      ],
      { encoding: 'utf8' }
    ).trim();
    lines.push(`${label} | client : __________________ | envoyé le : ____________`);
    lines.push(code);
    lines.push('');
    total += 1;
  }
}

fs.writeFileSync(out, lines.join('\n'), { mode: 0o600 });
fs.chmodSync(out, 0o600);
console.log(`${total} codes générés (${count} par formule).`);
console.log(`Fichier : ${out}`);
console.log(`Afficher : cat "${out}"`);
