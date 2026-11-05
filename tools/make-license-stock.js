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
const entries = [];
for (const planId of planIds) {
  const plan = PLANS[planId];
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
    entries.push({ planId, plan, label, code });
  }
}

const total = entries.length;
const sep = '═'.repeat(64);
const thin = '─'.repeat(64);
const lines = [];
lines.push('WIFIPRO — STOCK DE LICENCES');
lines.push(
  `Généré le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date())} à ${batch.slice(11).replace('-', ':')}`
);
lines.push('');
lines.push('MODE D’EMPLOI');
lines.push('1. Chaque licence est présentée dans un bloc séparé.');
lines.push('2. Envoyez au client uniquement le code situé sous la ligne « CODE : ».');
lines.push('3. Notez le nom du client et la date d’envoi dans le bloc.');
lines.push('4. La durée commence le jour de l’activation, pas le jour de la génération.');
lines.push('5. Un code n’est pas à usage unique : gardez ce fichier privé.');
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
  lines.push(entry.code);
  lines.push('');
  lines.push(thin);
  lines.push('');
});

fs.writeFileSync(out, lines.join('\n'), { mode: 0o600 });
fs.chmodSync(out, 0o600);
console.log(`${total} codes générés (${count} par formule).`);
console.log(`Fichier : ${out}`);
console.log(`Afficher : cat "${out}"`);
