'use strict';

const { pbkdf2Sync, randomInt } = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PLANS = {
  '3m': { label: '3 mois', price: 2000, tag: '3M', months: 3 },
  '6m': { label: '6 mois', price: 5000, tag: '6M', months: 6 },
  '1y': { label: '1 an', price: 10000, tag: '1A', months: 12 },
};
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SALT = 'wifipro-short-v1';
const ITERATIONS = 100000;
const nf = new Intl.NumberFormat('fr-FR');

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const hasFlag = (name) => args.includes(`--${name}`);

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
  node tools/make-short-license-stock.js [--count 10] [--plans 3m,6m,1y]
                                         [--out ~/wifi-licences.txt]
                                         [--registry ./short-licenses.json]

Génère des codes courts du type Atu3-16yeih, le fichier de stock privé et
le registre public (empreintes SHA-256) utilisé par l'application.

Options :
  --count     nombre de codes par formule (défaut : 10)
  --plans     formules à générer (défaut : 3m,6m,1y)
  --out       fichier privé de stock (défaut : ~/wifi-licences.txt)
  --registry  registre de l'application (défaut : ./short-licenses.json)`);
  process.exit(0);
}

const count = Math.max(1, Math.min(200, Number(option('count')) || 10));
const planIds = (option('plans') || '3m,6m,1y')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (!planIds.length || planIds.some((id) => !PLANS[id])) {
  console.error('Formule inconnue. Utilisez 3m, 6m ou 1y.');
  process.exit(1);
}

const out = option('out') || path.join(os.homedir(), 'wifi-licences.txt');
const registryFile = option('registry') || path.join(__dirname, '..', 'short-licenses.json');

let registry = { version: 1, codes: {} };
if (fs.existsSync(registryFile)) {
  const parsed = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
  if (parsed && parsed.codes && typeof parsed.codes === 'object') {
    registry = { version: 1, codes: parsed.codes };
  }
}

const randomChar = () => ALPHABET[randomInt(0, ALPHABET.length)];
const randomCode = () => {
  let canonical = '';
  while (canonical.length < 10) canonical += randomChar();
  const part1 = canonical.slice(0, 4);
  const part2 = canonical.slice(4);
  const display = `${part1.charAt(0)}${part1.slice(1).toLowerCase()}-${part2.toLowerCase()}`;
  const hash = pbkdf2Sync(canonical, SALT, ITERATIONS, 32, 'sha256').toString('hex');
  return { display, canonical, hash };
};

const entries = [];
for (const planId of planIds) {
  const plan = PLANS[planId];
  for (let i = 1; i <= count; i += 1) {
    const label = `WF-${plan.tag}-${String(i).padStart(3, '0')}`;
    let code;
    do {
      code = randomCode();
    } while (registry.codes[code.hash] || entries.some((e) => e.hash === code.hash));
    registry.codes[code.hash] = { p: planId, m: plan.months, n: label, c: todayKey() };
    entries.push({ planId, plan, label, ...code });
  }
}

if (fs.existsSync(out)) {
  const backup = out.replace(/\.txt$/i, '') + `-backup-${stamp()}.txt`;
  fs.copyFileSync(out, backup);
  console.log(`Ancien fichier sauvegardé : ${backup}`);
}

const total = entries.length;
const sep = '═'.repeat(64);
const thin = '─'.repeat(64);
const lines = [];
lines.push('WIFIPRO — LICENCES (CODES COURTS)');
lines.push(
  `Généré le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date())}`
);
lines.push('');
lines.push('MODE D’EMPLOI');
lines.push('1. Le client ouvre l’application puis va dans « Activer l’application ».');
lines.push('2. Il saisit le code court indiqué sous « CODE : » (ex. Atu3-16yeih).');
lines.push('3. La durée commence le jour de l’activation, pas le jour de la génération.');
lines.push('4. Le code fonctionne sur tout appareil et n’est pas à usage unique.');
lines.push('5. Garde ce fichier privé : toute personne ayant un code peut l’utiliser.');
lines.push('');
lines.push('RÉSUMÉ');
for (const planId of planIds) {
  const plan = PLANS[planId];
  const ofPlan = entries.filter((e) => e.planId === planId);
  lines.push(
    `${plan.label.toUpperCase()} : ${ofPlan.length} codes (${ofPlan[0].label} à ${ofPlan[ofPlan.length - 1].label}) — ${nf.format(plan.price)} F`
  );
}
lines.push('');
lines.push(sep);
lines.push('');

entries.forEach((entry, index) => {
  lines.push(`LICENCE ${String(index + 1).padStart(2, '0')} / ${total}`);
  lines.push(`Formule   : ${entry.plan.label.toUpperCase()} — ${nf.format(entry.plan.price)} F`);
  lines.push(`Référence : ${entry.label}`);
  lines.push('Client    : ______________________________');
  lines.push('Envoyée le: __________________');
  lines.push('CODE :');
  lines.push(entry.display);
  lines.push('');
  lines.push(thin);
  lines.push('');
});

fs.writeFileSync(out, lines.join('\n'), { mode: 0o600 });
fs.chmodSync(out, 0o600);
fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2) + '\n', { mode: 0o644 });

console.log(`${total} codes courts générés (${count} par formule).`);
console.log(`Fichier privé : ${out}`);
console.log(`Registre application : ${registryFile}`);
console.log('Pousse le registre sur GitHub pour que les clients reçoivent les nouveaux codes.');
