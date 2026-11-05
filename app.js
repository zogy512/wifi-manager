'use strict';

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

const TYPES = [
  { id: '3h', short: '3H', label: '3 heures', price: 100 },
  { id: '1j', short: '1J', label: '1 jour', price: 200 },
  { id: '2j', short: '2J', label: '2 jours', price: 300 },
  { id: '1s', short: '1S', label: '1 semaine', price: 800 },
  { id: '1m', short: '1M', label: '1 mois', price: 3000 },
];
const TYPE_MAP = Object.fromEntries(TYPES.map((t) => [t.id, t]));

const LICENSE_PLANS = [
  { id: '3m', label: '3 mois', months: 3 },
  { id: '6m', label: '6 mois', months: 6 },
  { id: '1y', label: '1 an', months: 12 },
];
const LICENSE_MAP = Object.fromEntries(LICENSE_PLANS.map((p) => [p.id, p]));
const LEGACY_PLAN_LABELS = { '1m': 'Mensuelle (ancienne)' };
const WHATSAPP_DEFAULT = '221777003559';

function licensePlanLabel(id) {
  return (LICENSE_MAP[id] && LICENSE_MAP[id].label) || LEGACY_PLAN_LABELS[id] || id;
}

const DB_KEY = 'wifipro:db:v1';
const LOW_STOCK = 2;
const DAY_MS = 86400000;

/* ------------------------------------------------------------------ */
/* Petites aides                                                       */
/* ------------------------------------------------------------------ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const num = (v, fallback = 0) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};
const sum = (arr) => arr.reduce((a, b) => a + num(b), 0);
const uid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const nf = new Intl.NumberFormat('fr-FR');
const fmt = (n) => `${nf.format(Math.round(num(n)))} F`;
const fmtPlain = (n) => nf.format(Math.round(num(n)));
const fmtPhone = (n) => {
  const digits = String(n || '').replace(/\D/g, '');
  if (!digits) return '';
  const grouped = digits.replace(/^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5');
  return `+${grouped}`;
};
const whatsappNumber = () => (db.settings.whatsapp || WHATSAPP_DEFAULT).replace(/\D/g, '');
const whatsappLink = (message) =>
  `https://wa.me/${whatsappNumber()}?text=${encodeURIComponent(message)}`;
function openWhatsApp(message) {
  const url = whatsappLink(message);
  const win = window.open(url, '_blank', 'noopener');
  if (!win) location.href = url;
}
const fmtDate = (iso, withTime = false) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return (
    d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      ...(withTime ? { year: 'numeric' } : {}),
    }) + (withTime ? ` ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '')
  );
};
const fmtDay = (key) => {
  if (!key) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(key)) ? parseDateKey(key) : new Date(key);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtDateTimeCSV = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};
const dateKey = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-');
};
const todayKey = () => dateKey(new Date());
const nowISO = () => new Date().toISOString();
const parseDateKey = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const addMonthsToDateKey = (key, months) => {
  const base = parseDateKey(key);
  base.setMonth(base.getMonth() + months);
  return dateKey(base);
};
const isoToLocalInput = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const dateFromInput = (v) => {
  const d = v ? new Date(v) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
};
const byDateDesc = (a, b) => new Date(b.date) - new Date(a.date);
const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase() || '?';

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/><path d="M16 5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.2c2.1.8 3.5 2.8 3.5 5.3"/>',
  userplus: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5 1.4 0 2.7.4 3.8 1.2"/><path d="M19 8v6"/><path d="M16 11h6"/>',
  cart: '<path d="M2 3h3l2.5 12h11l2-8H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>',
  box: '<path d="M3 7l9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/>',
  chevronLeft: '<path d="M15 18l-6-6 6-6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  upload: '<path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M4 3h16"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.8"/><path d="M6 10v4"/><path d="M18 10v4"/>',
  alert: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
  chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 6"/><path d="M20 4v7h-7"/>',
  smartphone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3Z"/><path d="M9 12l2 2 4-4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  chat: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.3A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8.5 11h.01"/><path d="M12 11h.01"/><path d="M15.5 11h.01"/>',
  wifi: '<path d="M3.5 9.5a13 13 0 0 1 17 0"/><path d="M6.5 13a8.5 8.5 0 0 1 11 0"/><path d="M9.5 16.4a4 4 0 0 1 5 0"/><path d="M12 19.5h.01"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Données                                                             */
/* ------------------------------------------------------------------ */

function normalize(d) {
  const src = d && typeof d === 'object' ? d : {};
  return {
    vendors: Array.isArray(src.vendors) ? src.vendors : [],
    supplies: Array.isArray(src.supplies) ? src.supplies : [],
    sales: Array.isArray(src.sales) ? src.sales : [],
    payments: Array.isArray(src.payments) ? src.payments : [],
    clients: Array.isArray(src.clients) ? src.clients : [],
    licenses: Array.isArray(src.licenses) ? src.licenses : [],
    settings: {
      name: src.settings && src.settings.name ? String(src.settings.name) : 'WifiPro',
      licensePrices: {
        '3m': num(src.settings && src.settings.licensePrices && src.settings.licensePrices['3m']) > 0
          ? num(src.settings.licensePrices['3m'])
          : 2000,
        '6m': num(src.settings && src.settings.licensePrices && src.settings.licensePrices['6m']) > 0
          ? num(src.settings.licensePrices['6m'])
          : 5000,
        '1y': num(src.settings && src.settings.licensePrices && src.settings.licensePrices['1y']) > 0
          ? num(src.settings.licensePrices['1y'])
          : 10000,
      },
      whatsapp: String(src.settings && src.settings.whatsapp ? src.settings.whatsapp : '').replace(/\D/g, '') || WHATSAPP_DEFAULT,
    },
  };
}
function load() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) {
    console.warn('Lecture des données impossible', e);
  }
  return normalize({});
}
let db = load();
function save() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    alert('Impossible d’enregistrer les données sur cet appareil.');
  }
}

const vendorById = (id) => db.vendors.find((v) => v.id === id);

function vendorStock(vendorId) {
  const stock = Object.fromEntries(TYPES.map((t) => [t.id, 0]));
  db.supplies
    .filter((s) => s.vendorId === vendorId)
    .forEach((s) => {
      Object.entries(s.items || {}).forEach(([k, q]) => {
        if (stock[k] !== undefined) stock[k] += num(q);
      });
    });
  db.sales
    .filter((s) => s.vendorId === vendorId)
    .forEach((s) => {
      if (stock[s.type] !== undefined) stock[s.type] -= num(s.qty);
    });
  return stock;
}

function supplyTotal(s) {
  return Object.entries(s.items || {}).reduce(
    (total, [k, q]) => total + (TYPE_MAP[k] ? TYPE_MAP[k].price * num(q) : 0),
    0
  );
}

function vendorTotals(vendorId) {
  const stock = vendorStock(vendorId);
  const supplies = db.supplies.filter((s) => s.vendorId === vendorId);
  const payments = db.payments.filter((p) => p.vendorId === vendorId);
  const sales = db.sales.filter((s) => s.vendorId === vendorId);

  let suppliedValue = 0;
  let paidAtSupply = 0;
  supplies.forEach((s) => {
    suppliedValue += supplyTotal(s);
    paidAtSupply += num(s.paid);
  });

  let units = 0;
  let stockValue = 0;
  TYPES.forEach((t) => {
    units += stock[t.id];
    stockValue += stock[t.id] * t.price;
  });

  const paid = sum(payments.map((p) => p.amount));
  const salesValue = sum(sales.map((s) => s.total));

  return {
    stock,
    units,
    stockValue,
    suppliedValue,
    paidAtSupply,
    payments: paid,
    balance: suppliedValue - paidAtSupply - paid,
    salesValue,
    salesCount: sales.length,
  };
}

function itemsSummary(items) {
  const parts = TYPES.filter((t) => num(items && items[t.id]) > 0).map(
    (t) => `${t.short} × ${num(items[t.id])}`
  );
  return parts.join(' · ') || 'Aucun code';
}

function inPeriod(iso, period) {
  if (period === 'all') return true;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  if (period === 'today') return dateKey(d) === todayKey();
  if (period === 'month') return dateKey(d).slice(0, 7) === todayKey().slice(0, 7);
  const days = parseInt(period, 10);
  if (Number.isFinite(days)) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
    return d >= start;
  }
  return true;
}

function dateDaysLeft(key) {
  if (!key) return -Infinity;
  return Math.round((parseDateKey(key) - parseDateKey(todayKey())) / DAY_MS);
}
function isClientActive(c) {
  return String(c.fin || '') >= todayKey();
}

function vendorLicense(vendorId) {
  const list = db.licenses.filter((l) => l.vendorId === vendorId);
  if (!list.length) return null;
  return list.reduce((best, l) => (String(l.end) > String(best.end) ? l : best));
}

function licenseStatus(vendorId) {
  const license = vendorLicense(vendorId);
  if (!license) return { state: 'none', license: null, days: null };
  const days = dateDaysLeft(license.end);
  return { state: days >= 0 ? 'active' : 'expired', license, days };
}

function licenseBaseKey(vendorId, startKey) {
  const license = vendorLicense(vendorId);
  const start = startKey || todayKey();
  if (license && String(license.end) >= start) return license.end;
  return start;
}

function licenseBlocked(vendorId) {
  return licenseStatus(vendorId).state !== 'active';
}

function licenseBadge(vendorId) {
  const st = licenseStatus(vendorId);
  if (st.state === 'none') return '<span class="badge danger">Sans licence</span>';
  if (st.state === 'expired') return '<span class="badge danger">Licence expirée</span>';
  return `<span class="badge ${st.days <= 7 ? 'warn' : 'ok'}">Licence ${st.days} j</span>`;
}

/* ------------------------------------------------------------------ */
/* Navigation / rendu                                                  */
/* ------------------------------------------------------------------ */

let saleFilter = { vendor: 'all', period: '30' };
let reportPeriod = '30';
let clientFilter = 'active';
let currentAfter = null;
let lastRouteKey = '';

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [page, param] = raw.split('/');
  return { page: page || 'home', param: param ? decodeURIComponent(param) : '' };
}

function setActiveNav(page) {
  const map = {
    home: 'home', vendors: 'vendors', vendor: 'vendors', sales: 'sales',
    stock: 'stock', more: 'more', clients: 'more', licenses: 'more', reports: 'more',
  };
  $$('.bottomnav a').forEach((a) => {
    const active = a.dataset.nav === map[page];
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function render() {
  const route = parseHash();
  const known = ['home', 'vendors', 'vendor', 'sales', 'stock', 'more', 'clients', 'licenses', 'reports'];
  if (!known.includes(route.page)) {
    history.replaceState(null, '', '#/home');
    return render();
  }

  let page = route.page;
  if (page === 'vendor' && !vendorById(route.param)) page = 'vendors';

  currentAfter = null;
  let html = '';
  if (page === 'home') html = pageHome();
  else if (page === 'vendors') html = pageVendors();
  else if (page === 'vendor') html = pageVendor(route.param);
  else if (page === 'sales') html = pageSales();
  else if (page === 'stock') html = pageStock();
  else if (page === 'clients') html = pageClients();
  else if (page === 'licenses') html = pageLicenses();
  else if (page === 'reports') html = pageReports();
  else html = pageMore();

  $('#app').innerHTML = html;
  setActiveNav(route.page);

  const key = route.page + '/' + route.param;
  if (key !== lastRouteKey) {
    window.scrollTo(0, 0);
    lastRouteKey = key;
  }
  if (typeof currentAfter === 'function') currentAfter();
}

function emptyState(iconName, title, text) {
  return `<div class="empty">
    <span class="empty-icon">${icon(iconName)}</span>
    <strong>${esc(title)}</strong>
    <p>${esc(text)}</p>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Page : accueil                                                      */
/* ------------------------------------------------------------------ */

function pageHome() {
  const tKey = todayKey();
  const monthKey = tKey.slice(0, 7);
  const todaySales = db.sales.filter((s) => dateKey(s.date) === tKey);
  const monthSales = db.sales.filter((s) => dateKey(s.date).startsWith(monthKey));
  const totals = db.vendors.map((v) => ({ v, t: vendorTotals(v.id) }));
  const stockValue = totals.reduce((a, x) => a + x.t.stockValue, 0);
  const totalUnits = totals.reduce((a, x) => a + x.t.units, 0);
  const totalDue = totals.reduce((a, x) => a + Math.max(0, x.t.balance), 0);

  const low = [];
  db.vendors.forEach((v) => {
    const stock = vendorStock(v.id);
    TYPES.forEach((t) => {
      const supplied = db.supplies
        .filter((s) => s.vendorId === v.id)
        .reduce((a, s) => a + num(s.items && s.items[t.id]), 0);
      if (supplied > 0 && stock[t.id] <= LOW_STOCK) {
        low.push({ v, t, qty: stock[t.id] });
      }
    });
  });

  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = dateKey(d);
    return {
      key,
      label: d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
      total: sum(db.sales.filter((s) => dateKey(s.date) === key).map((s) => s.total)),
    };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.total));
  const weekTotal = sum(days.map((d) => d.total));

  const recent = [...db.sales].sort(byDateDesc).slice(0, 4);
  const licAlerts = db.vendors
    .map((v) => ({ v, st: licenseStatus(v.id) }))
    .filter((x) => x.st.state !== 'active' || x.st.days <= 7);

  return `
  <section class="hero">
    <div>
      <p class="eyebrow">${esc(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
      <h2>Tableau de bord</h2>
      <p class="muted">Votre réseau wifi en un coup d’œil.</p>
    </div>
  </section>

  <div class="kpis">
    <div class="kpi accent"><span>Ventes du jour</span><strong>${fmt(sum(todaySales.map((s) => s.total)))}</strong><small>${todaySales.length} vente(s)</small></div>
    <div class="kpi"><span>CA du mois</span><strong>${fmt(sum(monthSales.map((s) => s.total)))}</strong><small>${monthSales.length} vente(s)</small></div>
    <div class="kpi"><span>Valeur du stock</span><strong>${fmt(stockValue)}</strong><small>${fmtPlain(totalUnits)} codes en circulation</small></div>
    <div class="kpi"><span>Dettes vendeurs</span><strong>${fmt(totalDue)}</strong><small>à encaisser</small></div>
  </div>

  <div class="quick">
    <button class="quick-btn" data-action="new-sale">${icon('cart')}<span>Vente</span></button>
    <button class="quick-btn" data-action="new-supply">${icon('box')}<span>Appro</span></button>
    <button class="quick-btn" data-action="new-vendor">${icon('userplus')}<span>Vendeur</span></button>
  </div>

  ${low.length ? `<section class="card alert-card">
    <div class="card-head"><h3>Stock à recharger</h3><span class="badge warn">${low.length}</span></div>
    <div class="mini-list">${low
      .slice(0, 8)
      .map(
        (x) => `<span class="mini-chip">${esc(x.v.nom)} · ${x.t.short} <b>${x.qty}</b></span>`
      )
      .join('')}</div>
  </section>` : ''}

  ${licAlerts.length ? `<section class="card alert-card">
    <div class="card-head"><h3>Licences vendeurs</h3><a class="link" href="#/licenses">Gérer</a></div>
    <div class="mini-list">${licAlerts
      .slice(0, 8)
      .map(
        (x) => `<span class="mini-chip">${esc(x.v.nom)} · ${
          x.st.state === 'none' ? 'sans licence' : x.st.state === 'expired' ? 'expirée' : x.st.days + ' j'
        }</span>`
      )
      .join('')}</div>
  </section>` : ''}

  <section class="card">
    <div class="card-head"><h3>Ventes des 7 derniers jours</h3><span class="muted small">${fmt(weekTotal)}</span></div>
    <div class="barchart">
      ${days
        .map(
          (d) => `<div class="barcol ${d.key === tKey ? 'today' : ''}">
            <span class="bar-value">${d.total ? fmtPlain(d.total) : ''}</span>
            <div class="bar-track"><div class="bar" style="height:${Math.max(4, (d.total / maxDay) * 100)}%"></div></div>
            <span class="bar-label">${esc(d.label)}</span>
          </div>`
        )
        .join('')}
    </div>
  </section>

  <section class="card">
    <div class="card-head"><h3>Dernières ventes</h3><a class="link" href="#/sales">Tout voir</a></div>
    ${recent.length ? recent.map((s) => saleRow(s)).join('') : emptyState('cart', 'Aucune vente', 'Enregistrez votre première vente de code.')}
  </section>`;
}

function saleRow(s) {
  const v = vendorById(s.vendorId);
  const ty = TYPE_MAP[s.type];
  return `<div class="row">
    <span class="tag" data-type="${esc(s.type)}">${ty ? ty.short : '?'}</span>
    <span class="row-main">
      <span class="row-title">${ty ? esc(ty.label) : 'Code'} × ${num(s.qty)}</span>
      <span class="row-sub">${esc(v ? v.nom : 'Vendeur supprimé')} · ${fmtDate(s.date, true)}${s.note ? ' · ' + esc(s.note) : ''}</span>
    </span>
    <span class="row-end"><span class="amount">${fmt(s.total)}</span></span>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Page : vendeurs                                                     */
/* ------------------------------------------------------------------ */

function pageVendors() {
  const vendors = [...db.vendors].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  currentAfter = () => {
    const input = $('#vendorSearch');
    if (!input) return;
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      $$('#vendorList [data-search]').forEach((el) => {
        el.style.display = el.dataset.search.includes(q) ? '' : 'none';
      });
    });
  };

  return `
  <div class="page-head">
    <div><h2>Vendeurs</h2><p class="sub">${vendors.length} vendeur(s) enregistré(s)</p></div>
    <button class="btn" data-action="new-vendor">${icon('plus')}Ajouter</button>
  </div>
  ${vendors.length ? `<div class="search">${icon('search')}<input id="vendorSearch" type="search" placeholder="Rechercher un vendeur, un point…" autocomplete="off"></div>` : ''}
  <section class="card" id="vendorList">
    ${vendors.length ? vendors.map(vendorRow).join('') : emptyState('users', 'Aucun vendeur', 'Ajoutez votre premier vendeur pour commencer.')}
  </section>`;
}

function vendorRow(v) {
  const t = vendorTotals(v.id);
  const search = esc(`${v.nom} ${v.point || ''} ${v.tel || ''}`.toLowerCase());
  return `<a class="row" href="#/vendor/${v.id}" data-search="${search}">
    <span class="avatar">${esc(initials(v.nom))}</span>
    <span class="row-main">
      <span class="row-title">${esc(v.nom)}${v.actif === false ? ' <span class="badge">Inactif</span>' : ''}</span>
      <span class="row-sub">${esc(v.point || 'Point de vente')}${v.tel ? ' · ' + esc(v.tel) : ''}</span>
    </span>
    <span class="row-end"><strong>${t.units}</strong><small>codes</small>${licenseBadge(v.id)}</span>
  </a>`;
}

function pageVendor(id) {
  const v = vendorById(id);
  if (!v) return emptyState('users', 'Vendeur introuvable', 'Ce vendeur a peut-être été supprimé.');
  const t = vendorTotals(v.id);
  const lic = licenseStatus(v.id);
  const history = vendorHistory(v.id);

  const stockRows = TYPES.map(
    (ty) => `<div class="row" style="padding:9px 0">
      <span class="tag" data-type="${ty.id}">${ty.short}</span>
      <span class="row-main">
        <span class="row-title" style="font-size:13.5px">${ty.label}</span>
        <span class="row-sub">${fmt(ty.price)} l’unité</span>
      </span>
      <span class="row-end"><span class="qty ${t.stock[ty.id] <= LOW_STOCK ? 'low' : 'ok'}">${t.stock[ty.id]}</span></span>
    </div>`
  ).join('');

  const historyRows = history.length
    ? history
        .slice(0, 40)
        .map(
          (e) => `<div class="row">
        <span class="tag" data-type="${e.type || ''}">${e.short}</span>
        <span class="row-main">
          <span class="row-title" style="font-size:13.5px">${esc(e.label)}</span>
          <span class="row-sub">${esc(e.sub ? e.sub + ' · ' : '')}${fmtDate(e.date, true)}</span>
        </span>
        <span class="row-end">
          <span class="amount ${e.cls}">${e.prefix || ''}${fmt(e.amount)}</span>
          <button class="icon-btn ghost" data-action="delete-record" data-kind="${e.kind}" data-id="${e.id}" aria-label="Supprimer">${icon('trash')}</button>
        </span>
      </div>`
        )
        .join('')
    : emptyState('box', 'Aucune opération', 'Les appros, ventes et versements apparaîtront ici.');

  return `
  <div class="page-head">
    <div style="display:flex;align-items:center;gap:10px;min-width:0">
      <a class="icon-btn" href="#/vendors" aria-label="Retour">${icon('chevronLeft')}</a>
      <div style="min-width:0"><h2 style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(v.nom)}</h2><p class="sub">${esc(v.point || 'Point de vente')}</p></div>
    </div>
    <div class="row-actions">
      <button class="icon-btn" data-action="edit-vendor" data-id="${v.id}" aria-label="Modifier">${icon('edit')}</button>
      <button class="icon-btn" data-action="delete-vendor" data-id="${v.id}" aria-label="Supprimer">${icon('trash')}</button>
    </div>
  </div>

  <section class="card">
    <div class="row" style="border:0;padding:0">
      <span class="avatar lg">${esc(initials(v.nom))}</span>
      <span class="row-main">
        <span class="row-title" style="font-size:16px">${esc(v.nom)}</span>
        <span class="row-sub">${esc(v.tel || 'Sans téléphone')}</span>
        <span class="row-sub">${t.salesCount} vente(s) enregistrée(s)</span>
      </span>
      <span class="badge ${v.actif === false ? '' : 'ok'}">${v.actif === false ? 'Inactif' : 'Actif'}</span>
    </div>
  </section>

  <div class="kpis">
    <div class="kpi"><span>Stock</span><strong>${t.units} codes</strong><small>${fmt(t.stockValue)}</small></div>
    <div class="kpi ${t.balance > 0 ? 'accent' : ''}"><span>Solde dû</span><strong>${fmt(t.balance)}</strong><small>${t.balance > 0 ? 'à encaisser' : 'compte à jour'}</small></div>
    <div class="kpi"><span>Ventes</span><strong>${fmt(t.salesValue)}</strong><small>${t.salesCount} vente(s)</small></div>
    <div class="kpi"><span>Versements</span><strong>${fmt(t.payments)}</strong><small>reçus</small></div>
  </div>

  <div class="quick">
    <button class="quick-btn" data-action="new-sale" data-vendor="${v.id}">${icon('cart')}<span>Vente</span></button>
    <button class="quick-btn" data-action="new-supply" data-vendor="${v.id}">${icon('box')}<span>Appro</span></button>
    <button class="quick-btn" data-action="new-payment" data-vendor="${v.id}">${icon('cash')}<span>Versement</span></button>
  </div>

  <section class="card">
    <div class="card-head"><h3>Licence vendeur</h3>${licenseBadge(v.id)}</div>
    ${lic.license
      ? `<div class="breakdown">
          <div><span>Formule</span><strong>${licensePlanLabel(lic.license.plan)}</strong></div>
          <div><span>Du</span><strong>${fmtDay(lic.license.start)}</strong></div>
          <div><span>Au</span><strong>${fmtDay(lic.license.end)}</strong></div>
          <div><span>Montant payé</span><strong>${fmt(lic.license.amount)}</strong></div>
        </div>`
      : '<p class="muted small">Aucune licence enregistrée. Les ventes sont bloquées pour ce vendeur.</p>'}
    <div class="divider"></div>
    <button class="btn block" data-action="new-license" data-vendor="${v.id}">${icon('shield')}${lic.license ? 'Renouveler la licence' : 'Ajouter une licence'}</button>
  </section>

  <section class="card">
    <div class="card-head"><h3>Stock par type de code</h3></div>
    ${stockRows}
  </section>

  <section class="card">
    <div class="card-head"><h3>Compte du vendeur</h3></div>
    <div class="breakdown">
      <div><span>Valeur approvisionnée</span><strong>${fmt(t.suppliedValue)}</strong></div>
      <div><span>Payé à l’appro</span><strong>${fmt(t.paidAtSupply)}</strong></div>
      <div><span>Versements</span><strong>${fmt(t.payments)}</strong></div>
      <div class="total"><span>Solde dû</span><strong>${fmt(t.balance)}</strong></div>
    </div>
  </section>

  <section class="card">
    <div class="card-head"><h3>Historique</h3><span class="muted small">${history.length} opération(s)</span></div>
    ${historyRows}
  </section>`;
}

function vendorHistory(vendorId) {
  const entries = [];
  db.supplies
    .filter((s) => s.vendorId === vendorId)
    .forEach((s) =>
      entries.push({
        kind: 'supplies', id: s.id, date: s.date, short: 'APP',
        label: 'Approvisionnement', sub: itemsSummary(s.items),
        amount: supplyTotal(s), cls: '', prefix: '',
      })
    );
  db.sales
    .filter((s) => s.vendorId === vendorId)
    .forEach((s) =>
      entries.push({
        kind: 'sales', id: s.id, date: s.date, type: s.type,
        short: TYPE_MAP[s.type] ? TYPE_MAP[s.type].short : 'VTE',
        label: `Vente ${TYPE_MAP[s.type] ? TYPE_MAP[s.type].label : ''}`,
        sub: `${num(s.qty)} × ${fmt(s.unit)}`, amount: s.total, cls: '', prefix: '',
      })
    );
  db.payments
    .filter((p) => p.vendorId === vendorId)
    .forEach((p) =>
      entries.push({
        kind: 'payments', id: p.id, date: p.date, short: 'PAY',
        label: 'Versement', sub: p.note || '', amount: p.amount, cls: 'plus', prefix: '-',
      })
    );
  return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/* ------------------------------------------------------------------ */
/* Page : ventes                                                       */
/* ------------------------------------------------------------------ */

function pageSales() {
  const sales = db.sales
    .filter((s) => saleFilter.vendor === 'all' || s.vendorId === saleFilter.vendor)
    .filter((s) => inPeriod(s.date, saleFilter.period))
    .sort(byDateDesc);
  const total = sum(sales.map((s) => s.total));

  const vendorOptions = [
    `<option value="all" ${saleFilter.vendor === 'all' ? 'selected' : ''}>Tous les vendeurs</option>`,
    ...db.vendors.map(
      (v) => `<option value="${v.id}" ${saleFilter.vendor === v.id ? 'selected' : ''}>${esc(v.nom)}</option>`
    ),
  ].join('');

  const periods = [['today', "Aujourd’hui"], ['7', '7 jours'], ['30', '30 jours'], ['month', 'Ce mois'], ['all', 'Tout']];
  const periodOptions = periods
    .map(([val, lbl]) => `<option value="${val}" ${saleFilter.period === val ? 'selected' : ''}>${lbl}</option>`)
    .join('');

  return `
  <div class="page-head">
    <div><h2>Ventes</h2><p class="sub">${sales.length} vente(s) · ${fmt(total)}</p></div>
    <button class="btn" data-action="new-sale">${icon('plus')}Vendre</button>
  </div>

  <div class="grid2" style="margin-bottom:12px">
    <label class="field" style="margin:0"><span>Vendeur</span><select data-filter="sale-vendor">${vendorOptions}</select></label>
    <label class="field" style="margin:0"><span>Période</span><select data-filter="sale-period">${periodOptions}</select></label>
  </div>

  <section class="card">
    ${sales.length ? sales
      .map(
        (s) => `<div class="row">
        <span class="tag" data-type="${esc(s.type)}">${TYPE_MAP[s.type] ? TYPE_MAP[s.type].short : '?'}</span>
        <span class="row-main">
          <span class="row-title">${TYPE_MAP[s.type] ? esc(TYPE_MAP[s.type].label) : 'Code'} × ${num(s.qty)}</span>
          <span class="row-sub">${esc((vendorById(s.vendorId) || { nom: 'Vendeur supprimé' }).nom)} · ${fmtDate(s.date, true)}${s.note ? ' · ' + esc(s.note) : ''}</span>
        </span>
        <span class="row-end">
          <span class="amount">${fmt(s.total)}</span>
          <button class="icon-btn ghost" data-action="delete-record" data-kind="sales" data-id="${s.id}" aria-label="Supprimer">${icon('trash')}</button>
        </span>
      </div>`
      )
      .join('') : emptyState('cart', 'Aucune vente sur cette période', 'Changez de filtre ou enregistrez une vente.')}
  </section>`;
}

/* ------------------------------------------------------------------ */
/* Page : stock                                                        */
/* ------------------------------------------------------------------ */

function pageStock() {
  const vendors = [...db.vendors].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const stocks = {};
  vendors.forEach((v) => (stocks[v.id] = vendorStock(v.id)));
  const totals = Object.fromEntries(TYPES.map((t) => [t.id, 0]));
  vendors.forEach((v) => TYPES.forEach((t) => (totals[t.id] += stocks[v.id][t.id])));
  const totalUnits = sum(TYPES.map((t) => totals[t.id]));
  const stockValue = vendors.reduce((a, v) => a + vendorTotals(v.id).stockValue, 0);

  const rows = vendors
    .map((v) => {
      const st = stocks[v.id];
      const value = TYPES.reduce((a, t) => a + st[t.id] * t.price, 0);
      return `<tr>
        <td class="name-cell">${esc(v.nom)}</td>
        ${TYPES.map(
          (t) => `<td class="num"><span class="qty ${st[t.id] <= LOW_STOCK ? 'low' : 'ok'}">${st[t.id]}</span></td>`
        ).join('')}
        <td class="num">${fmt(value)}</td>
      </tr>`;
    })
    .join('');

  return `
  <div class="page-head">
    <div><h2>Stock</h2><p class="sub">${fmtPlain(totalUnits)} codes · ${fmt(stockValue)}</p></div>
    <button class="btn" data-action="new-supply">${icon('plus')}Appro</button>
  </div>

  ${vendors.length ? `<section class="card">
    <div class="card-head"><h3>Stock par vendeur</h3><span class="badge ${TYPES.some((t) => totals[t.id] <= LOW_STOCK) ? 'warn' : 'ok'}">${fmt(stockValue)}</span></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Vendeur</th>${TYPES.map((t) => `<th class="num">${t.short}</th>`).join('')}<th class="num">Valeur</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td>Total</td>${TYPES.map((t) => `<td class="num">${totals[t.id]}</td>`).join('')}<td class="num">${fmt(stockValue)}</td></tr></tfoot>
      </table>
    </div>
  </section>
  <section class="card">
    <div class="card-head"><h3>Tarifs des codes</h3></div>
    ${TYPES.map(
      (t) => `<div class="row">
        <span class="tag" data-type="${t.id}">${t.short}</span>
        <span class="row-main"><span class="row-title" style="font-size:13.5px">${t.label}</span><span class="row-sub">${t.short} = ${fmt(t.price)}</span></span>
        <span class="row-end"><strong>${fmt(t.price)}</strong></span>
      </div>`
    ).join('')}
  </section>` : `<section class="card">${emptyState('box', 'Aucun stock', 'Ajoutez un vendeur puis approvisionnez-le en codes.')}</section>`}`;
}

/* ------------------------------------------------------------------ */
/* Page : clients mensuels                                             */
/* ------------------------------------------------------------------ */

function pageClients() {
  const all = [...db.clients].sort((a, b) => String(a.fin).localeCompare(String(b.fin)));
  const active = all.filter(isClientActive);
  const expiring = active.filter((c) => dateDaysLeft(c.fin) <= 3);
  const filtered = all.filter((c) =>
    clientFilter === 'all' ? true : clientFilter === 'active' ? isClientActive(c) : !isClientActive(c)
  );

  const chips = [
    ['active', `Actifs (${active.length})`],
    ['expired', `Expirés (${all.length - active.length})`],
    ['all', `Tous (${all.length})`],
  ]
    .map(
      ([val, lbl]) =>
        `<button class="chip ${clientFilter === val ? 'active' : ''}" data-action="client-filter" data-value="${val}" type="button">${lbl}</button>`
    )
    .join('');

  return `
  <div class="page-head">
    <div style="display:flex;align-items:center;gap:10px;min-width:0">
      <a class="icon-btn" href="#/more" aria-label="Retour">${icon('chevronLeft')}</a>
      <div><h2>Clients mensuels</h2><p class="sub">${active.length} abonnement(s) actif(s)${expiring.length ? ` · ${expiring.length} expire(nt) bientôt` : ''}</p></div>
    </div>
    <button class="btn" data-action="new-client">${icon('plus')}Client</button>
  </div>

  <div class="filters">${chips}</div>

  ${filtered.length
    ? filtered.map(clientCard).join('')
    : `<section class="card">${emptyState('users', 'Aucun client', 'Ajoutez un abonnement mensuel à 3 000 F.')}</section>`}`;
}

function clientCard(c) {
  const v = vendorById(c.vendorId);
  const active = isClientActive(c);
  const days = dateDaysLeft(c.fin);
  const badge = active
    ? `<span class="badge ${days <= 3 ? 'warn' : 'ok'}">${days === 0 ? 'Dernier jour' : days + ' j restants'}</span>`
    : '<span class="badge danger">Expiré</span>';

  return `<section class="card client-card">
    <div class="client-top">
      <span class="avatar">${esc(initials(c.nom))}</span>
      <span class="row-main">
        <span class="row-title">${esc(c.nom)} ${badge}</span>
        <span class="row-sub">${esc(c.tel || 'Sans téléphone')}${v ? ' · ' + esc(v.nom) : ''}</span>
        <span class="row-sub">Jusqu’au ${fmtDay(c.fin)} · ${fmt(c.montant)}</span>
      </span>
    </div>
    <div class="client-actions">
      <button class="btn ghost sm" data-action="renew-client" data-id="${c.id}">${icon('refresh')}Renouveler</button>
      <button class="btn danger sm" data-action="delete-client" data-id="${c.id}">${icon('trash')}Supprimer</button>
    </div>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* Page : licences vendeurs                                            */
/* ------------------------------------------------------------------ */

function pageLicenses() {
  const vendors = [...db.vendors].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const rows = vendors.map((v) => ({ v, st: licenseStatus(v.id) }));
  const active = rows.filter((x) => x.st.state === 'active');
  const expiring = active.filter((x) => x.st.days <= 7);
  const toFix = rows.filter((x) => x.st.state !== 'active');
  const monthKey = todayKey().slice(0, 7);
  const monthRevenue = sum(
    db.licenses.filter((l) => dateKey(l.date).startsWith(monthKey)).map((l) => l.amount)
  );
  const totalRevenue = sum(db.licenses.map((l) => l.amount));
  const prices = db.settings.licensePrices || {};
  const waDisplay = fmtPhone(db.settings.whatsapp);

  return `
  <div class="page-head">
    <div style="display:flex;align-items:center;gap:10px;min-width:0">
      <a class="icon-btn" href="#/more" aria-label="Retour">${icon('chevronLeft')}</a>
      <div><h2>Licences</h2><p class="sub">${active.length} active(s) · ${toFix.length} à régulariser</p></div>
    </div>
    <button class="btn ghost" data-action="license-settings">${icon('edit')}Tarifs</button>
  </div>

  <div class="kpis">
    <div class="kpi accent"><span>Licences actives</span><strong>${active.length}</strong><small>${expiring.length} expire(nt) sous 7 j</small></div>
    <div class="kpi"><span>À régulariser</span><strong>${toFix.length}</strong><small>ventes bloquées</small></div>
    <div class="kpi"><span>Revenus ce mois</span><strong>${fmt(monthRevenue)}</strong><small>licences</small></div>
    <div class="kpi"><span>Total encaissé</span><strong>${fmt(totalRevenue)}</strong><small>${db.licenses.length} licence(s)</small></div>
  </div>

  <section class="card">
    <div class="card-head"><h3>Demander une licence</h3><span class="badge ok">WhatsApp</span></div>
    <p class="hint">Choisissez la formule : WhatsApp s’ouvrira avec un message prêt à envoyer au ${esc(waDisplay)}.</p>
    <label class="field"><span>Votre nom / point de vente (optionnel)</span>
      <input id="waName" maxlength="80" placeholder="Ex : Awa Diallo — Marché central">
    </label>
    <div class="stack">
      ${LICENSE_PLANS.map(
        (p) => `<button class="btn ghost" type="button" data-action="license-whatsapp" data-plan="${p.id}">${icon('chat')}${p.label} — ${num(prices[p.id]) > 0 ? fmt(prices[p.id]) : 'prix à confirmer'}</button>`
      ).join('')}
    </div>
    <p class="hint">Après réception du paiement, activez la licence ci-dessous pour débloquer les ventes du vendeur.</p>
  </section>

  <section class="card">
    <div class="card-head"><h3>Vendeurs</h3><button class="btn sm" data-action="new-license">${icon('plus')}Licence</button></div>
    ${rows.length ? rows.map(licenseRow).join('') : emptyState('shield', 'Aucun vendeur', 'Ajoutez un vendeur avant de créer une licence.')}
  </section>

  <section class="card">
    <div class="card-head"><h3>Tarifs des licences</h3><button class="btn ghost sm" data-action="license-settings">${icon('edit')}Modifier</button></div>
    ${LICENSE_PLANS.map(
      (p) => `<div class="row">
        <span class="tag">${p.months === 12 ? '1A' : p.months + 'M'}</span>
        <span class="row-main"><span class="row-title" style="font-size:13.5px">${p.label}</span><span class="row-sub">${p.months} mois</span></span>
        <span class="row-end"><strong>${num(prices[p.id]) > 0 ? fmt(prices[p.id]) : 'À définir'}</strong></span>
      </div>`
    ).join('')}
  </section>`;
}

function licenseRow(x) {
  const { v, st } = x;
  const plan = st.license ? licensePlanLabel(st.license.plan) : '';
  const sub =
    st.state === 'none'
      ? 'Aucune licence — ventes bloquées'
      : st.state === 'expired'
        ? `Expirée le ${fmtDay(st.license.end)} — ventes bloquées`
        : `${plan} · ${fmt(st.license.amount)} · jusqu’au ${fmtDay(st.license.end)}`;

  return `<div class="row">
    <span class="avatar">${esc(initials(v.nom))}</span>
    <span class="row-main">
      <span class="row-title">${esc(v.nom)} ${licenseBadge(v.id)}</span>
      <span class="row-sub">${esc(sub)}</span>
    </span>
    <button class="btn ${st.state === 'active' ? 'ghost' : ''} sm" data-action="new-license" data-vendor="${v.id}">${st.state === 'active' ? 'Renouveler' : 'Activer'}</button>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Page : rapports                                                     */
/* ------------------------------------------------------------------ */

function pageReports() {
  const sales = db.sales.filter((s) => inPeriod(s.date, reportPeriod));
  const supplies = db.supplies.filter((s) => inPeriod(s.date, reportPeriod));
  const payments = db.payments.filter((p) => inPeriod(p.date, reportPeriod));
  const licenses = db.licenses.filter((l) => inPeriod(l.date, reportPeriod));

  const salesTotal = sum(sales.map((s) => s.total));
  const supplyValue = sum(supplies.map(supplyTotal));
  const paymentValue = sum(payments.map((p) => p.amount));
  const licenseRevenue = sum(licenses.map((l) => l.amount));
  const totalDue = db.vendors.reduce((a, v) => a + Math.max(0, vendorTotals(v.id).balance), 0);
  const activeLicenses = db.vendors.filter((v) => licenseStatus(v.id).state === 'active').length;

  const byPlan = LICENSE_PLANS.map((p) => {
    const list = licenses.filter((l) => l.plan === p.id);
    return { p, count: list.length, amount: sum(list.map((l) => l.amount)) };
  });

  const byType = TYPES.map((t) => {
    const list = sales.filter((s) => s.type === t.id);
    return { t, qty: sum(list.map((s) => s.qty)), amount: sum(list.map((s) => s.total)) };
  });
  const maxType = Math.max(1, ...byType.map((x) => x.amount));

  const byVendor = db.vendors
    .map((v) => {
      const list = sales.filter((s) => s.vendorId === v.id);
      return { v, qty: sum(list.map((s) => s.qty)), amount: sum(list.map((s) => s.total)) };
    })
    .filter((x) => x.amount > 0 || x.qty > 0)
    .sort((a, b) => b.amount - a.amount);

  const periods = [['today', "Aujourd’hui"], ['7', '7 jours'], ['30', '30 jours'], ['month', 'Ce mois'], ['all', 'Tout']];
  const chips = periods
    .map(
      ([val, lbl]) =>
        `<button class="chip ${reportPeriod === val ? 'active' : ''}" data-action="report-period" data-value="${val}" type="button">${lbl}</button>`
    )
    .join('');

  return `
  <div class="page-head">
    <div style="display:flex;align-items:center;gap:10px;min-width:0">
      <a class="icon-btn" href="#/more" aria-label="Retour">${icon('chevronLeft')}</a>
      <div><h2>Rapports</h2><p class="sub">Analyse de votre activité</p></div>
    </div>
  </div>

  <div class="filters">${chips}</div>

  <div class="kpis">
    <div class="kpi accent"><span>CA ventes</span><strong>${fmt(salesTotal)}</strong><small>${sales.length} vente(s)</small></div>
    <div class="kpi"><span>Revenus licences</span><strong>${fmt(licenseRevenue)}</strong><small>${licenses.length} licence(s)</small></div>
    <div class="kpi"><span>Approvisionnements</span><strong>${fmt(supplyValue)}</strong><small>${supplies.length} opération(s)</small></div>
    <div class="kpi"><span>Versements</span><strong>${fmt(paymentValue)}</strong><small>${payments.length} versement(s)</small></div>
    <div class="kpi"><span>Licences actives</span><strong>${activeLicenses}</strong><small>sur ${db.vendors.length} vendeur(s)</small></div>
    <div class="kpi"><span>Dettes totales</span><strong>${fmt(totalDue)}</strong><small>toutes périodes</small></div>
  </div>

  <section class="card">
    <div class="card-head"><h3>Ventes par type de code</h3></div>
    ${byType
      .map(
        (x) => `<div style="padding:9px 0">
        <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:6px;font-size:12.5px">
          <span><b>${x.t.short}</b> · ${esc(x.t.label)} <span class="muted">(${x.qty} vendus)</span></span>
          <strong>${fmt(x.amount)}</strong>
        </div>
        <div class="progress"><span style="width:${Math.max(2, (x.amount / maxType) * 100)}%"></span></div>
      </div>`
      )
      .join('')}
  </section>

  <section class="card">
    <div class="card-head"><h3>Licences vendues</h3><span class="muted small">${fmt(licenseRevenue)}</span></div>
    ${licenses.length
      ? byPlan
          .map(
            (x) => `<div class="report-row">
          <span class="label">${x.p.months === 12 ? '1 an' : x.p.months + ' mois'}</span>
          <div>
            <div class="progress"><span style="width:${licenseRevenue ? Math.max(2, (x.amount / licenseRevenue) * 100) : 0}%"></span></div>
            <span class="muted small">${x.count} licence(s)</span>
          </div>
          <span class="value">${fmt(x.amount)}</span>
        </div>`
          )
          .join('')
      : emptyState('shield', 'Aucune licence sur cette période', 'Les licences vendeurs apparaîtront ici.')}
  </section>

  <section class="card">
    <div class="card-head"><h3>Ventes par vendeur</h3></div>
    ${byVendor.length
      ? byVendor
          .map(
            (x) => `<div class="row">
          <span class="avatar">${esc(initials(x.v.nom))}</span>
          <span class="row-main"><span class="row-title">${esc(x.v.nom)}</span><span class="row-sub">${x.qty} code(s) vendu(s)</span></span>
          <span class="row-end"><strong>${fmt(x.amount)}</strong></span>
        </div>`
          )
          .join('')
      : emptyState('chart', 'Aucune vente', 'Les statistiques apparaîtront ici.')}
  </section>

  <section class="card">
    <div class="card-head"><h3>Exports CSV</h3></div>
    <div class="stack">
      <button class="btn subtle" data-action="export-sales">${icon('download')}Ventes</button>
      <button class="btn subtle" data-action="export-supplies">${icon('download')}Approvisionnements</button>
      <button class="btn subtle" data-action="export-payments">${icon('download')}Versements</button>
      <button class="btn subtle" data-action="export-clients">${icon('download')}Clients mensuels</button>
      <button class="btn subtle" data-action="export-licenses">${icon('download')}Licences vendeurs</button>
    </div>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* Page : plus                                                         */
/* ------------------------------------------------------------------ */

function pageMore() {
  return `
  <div class="page-head">
    <div><h2>Plus</h2><p class="sub">Clients, licences, rapports et sauvegarde</p></div>
  </div>

  <div class="card menu">
    <a class="menu-item" href="#/clients">
      <span class="menu-icon">${icon('users')}</span>
      <span class="menu-text"><strong>Clients mensuels</strong><span>Abonnements à ${fmt(3000)} et renouvellements</span></span>
      ${icon('chevronRight')}
    </a>
    <a class="menu-item" href="#/licenses">
      <span class="menu-icon">${icon('shield')}</span>
      <span class="menu-text"><strong>Licences vendeurs</strong><span>Mensuelle, 3 mois ou annuelle</span></span>
      ${icon('chevronRight')}
    </a>
    <a class="menu-item" href="#/reports">
      <span class="menu-icon">${icon('chart')}</span>
      <span class="menu-text"><strong>Rapports</strong><span>CA, ventes, licences et vendeurs</span></span>
      ${icon('chevronRight')}
    </a>
  </div>

  <section class="card">
    <div class="card-head"><h3>Sauvegarde des données</h3><span class="badge info">Local</span></div>
    <p class="muted small" style="margin-bottom:12px">Téléchargez la sauvegarde ou envoyez-la directement vers Gmail via le partage Android (fichier JSON en pièce jointe).</p>
    <div class="grid2">
      <button class="btn ghost" data-action="export-backup">${icon('download')}Sauvegarder</button>
      <button class="btn subtle" data-action="import-backup">${icon('upload')}Restaurer</button>
    </div>
    <button class="btn block" style="margin-top:9px" data-action="share-backup">${icon('mail')}Envoyer sur Gmail</button>
    <input type="file" id="restoreFile" accept="application/json,.json" class="hidden">
  </section>

  <section class="card">
    <div class="card-head"><h3>Application</h3><span class="badge ok">Hors ligne</span></div>
    <div class="breakdown">
      <div><span>Version</span><strong>1.2</strong></div>
      <div><span>Stockage</span><strong>Sur cet appareil</strong></div>
      <div><span>Types de codes</span><strong>${TYPES.length}</strong></div>
    </div>
    <div class="divider"></div>
    <button class="btn block" data-action="install-app">${icon('smartphone')}Installer sur l’écran d’accueil</button>
    <div class="divider"></div>
    <button class="btn danger block" data-action="reset-data">${icon('alert')}Effacer toutes les données</button>
  </section>

  <p class="muted small" style="text-align:center;padding:4px 10px 10px">WifiPro · gestion des vendeurs de codes wifi</p>`;
}

/* ------------------------------------------------------------------ */
/* Formulaire : vendeur                                                */
/* ------------------------------------------------------------------ */

function openVendorForm(vendor) {
  openSheet({
    title: vendor ? 'Modifier le vendeur' : 'Nouveau vendeur',
    subtitle: vendor ? 'Mettez à jour ses informations.' : 'Ajoutez un point de vente à votre réseau.',
    submitText: vendor ? 'Enregistrer' : 'Ajouter',
    body: `
      <label class="field"><span>Nom du vendeur *</span>
        <input name="nom" value="${vendor ? esc(vendor.nom) : ''}" placeholder="Ex : Awa Diallo" required>
      </label>
      <label class="field"><span>Point de vente</span>
        <input name="point" value="${vendor ? esc(vendor.point || '') : ''}" placeholder="Ex : Marché central">
      </label>
      <label class="field"><span>Téléphone</span>
        <input name="tel" type="tel" value="${vendor ? esc(vendor.tel || '') : ''}" placeholder="Ex : 77 000 00 00">
      </label>
      <label class="check"><input type="checkbox" name="actif" ${!vendor || vendor.actif !== false ? 'checked' : ''}> Vendeur actif</label>`,
    onSubmit(fd) {
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) {
        toast('Le nom est obligatoire');
        return false;
      }
      const data = {
        nom,
        point: String(fd.get('point') || '').trim(),
        tel: String(fd.get('tel') || '').trim(),
        actif: fd.get('actif') === 'on',
      };
      if (vendor) Object.assign(vendor, data);
      else db.vendors.push({ id: uid(), createdAt: nowISO(), ...data });
      save();
      render();
      toast(vendor ? 'Vendeur modifié' : 'Vendeur ajouté');
      return true;
    },
  });
}

function deleteVendor(id) {
  const v = vendorById(id);
  if (!v) return;
  const count =
    db.supplies.filter((x) => x.vendorId === id).length +
    db.sales.filter((x) => x.vendorId === id).length +
    db.payments.filter((x) => x.vendorId === id).length +
    db.clients.filter((x) => x.vendorId === id).length +
    db.licenses.filter((x) => x.vendorId === id).length;
  const msg = count
    ? `Supprimer ${v.nom} et tout son historique (${count} opération(s)) ?`
    : `Supprimer ${v.nom} ?`;
  if (!confirm(msg)) return;
  db.vendors = db.vendors.filter((x) => x.id !== id);
  ['supplies', 'sales', 'payments', 'clients', 'licenses'].forEach((k) => {
    db[k] = db[k].filter((x) => x.vendorId !== id);
  });
  save();
  history.replaceState(null, '', '#/vendors');
  render();
  toast('Vendeur supprimé');
}

/* ------------------------------------------------------------------ */
/* Formulaire : vente                                                  */
/* ------------------------------------------------------------------ */

function ensureVendors() {
  if (db.vendors.length) return true;
  toast('Ajoutez d’abord un vendeur');
  openVendorForm();
  return false;
}

function vendorOptions(selectedId) {
  return db.vendors
    .map(
      (v) =>
        `<option value="${v.id}" ${v.id === selectedId ? 'selected' : ''}>${esc(v.nom)}${v.point ? ' — ' + esc(v.point) : ''}</option>`
    )
    .join('');
}

function openSaleForm(vendorId) {
  if (!ensureVendors()) return;
  const selected = vendorId || db.vendors[0].id;

  openSheet({
    title: 'Nouvelle vente',
    subtitle: 'Enregistrez la vente d’un code par un vendeur.',
    submitText: 'Enregistrer',
    body: `
      <label class="field"><span>Vendeur *</span>
        <select name="vendorId" required>${vendorOptions(selected)}</select>
      </label>
      <div class="grid2">
        <label class="field"><span>Type de code</span>
          <select name="type" id="saleType">
            ${TYPES.map((t) => `<option value="${t.id}">${t.short} — ${esc(t.label)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Quantité</span>
          <input type="number" name="qty" id="saleQty" min="1" step="1" inputmode="numeric" value="1" required>
        </label>
      </div>
      <div class="grid2">
        <label class="field"><span>Prix unitaire (F)</span>
          <input type="number" name="unit" id="saleUnit" min="0" step="1" inputmode="numeric" value="${TYPES[0].price}" required>
        </label>
        <label class="field"><span>Date</span>
          <input type="datetime-local" name="date" value="${isoToLocalInput(nowISO())}" required>
        </label>
      </div>
      <p class="hint" id="saleHint"></p>
      <p class="hint" id="licenseHint"></p>
      <label class="field"><span>Note (optionnel)</span>
        <input name="note" maxlength="120" placeholder="Ex : client au marché">
      </label>`,
    onMount(form) {
      const typeSel = form.querySelector('[name="type"]');
      const vendorSel = form.querySelector('[name="vendorId"]');
      const unit = form.querySelector('[name="unit"]');
      const qty = form.querySelector('[name="qty"]');
      const hint = form.querySelector('#saleHint');
      const licenseHint = form.querySelector('#licenseHint');

      const updateHint = () => {
        const ty = TYPE_MAP[typeSel.value];
        const stock = vendorStock(vendorSel.value)[typeSel.value] ?? 0;
        const needed = Math.max(0, Math.round(num(qty.value, 0)));
        hint.textContent = `Stock disponible : ${stock} ${ty ? ty.short : ''}${needed > stock ? ' — stock insuffisant' : ''}`;
        hint.classList.toggle('warn', needed > stock);

        const st = licenseStatus(vendorSel.value);
        if (st.state === 'active') {
          licenseHint.textContent = `Licence active jusqu’au ${fmtDay(st.license.end)}.`;
          licenseHint.classList.remove('warn');
        } else if (st.state === 'expired') {
          licenseHint.textContent = `Licence expirée le ${fmtDay(st.license.end)} — ventes bloquées.`;
          licenseHint.classList.add('warn');
        } else {
          licenseHint.textContent = 'Aucune licence pour ce vendeur — ventes bloquées.';
          licenseHint.classList.add('warn');
        }
      };

      typeSel.addEventListener('change', () => {
        const ty = TYPE_MAP[typeSel.value];
        if (ty) unit.value = ty.price;
        updateHint();
      });
      vendorSel.addEventListener('change', updateHint);
      qty.addEventListener('input', updateHint);
      updateHint();
    },
    onSubmit(fd) {
      const vendorId = String(fd.get('vendorId') || '');
      const type = String(fd.get('type') || '');
      const qty = Math.max(1, Math.round(num(fd.get('qty'), 1)));
      const unit = Math.max(0, num(fd.get('unit'), 0));
      const date = dateFromInput(fd.get('date')).toISOString();

      if (!vendorById(vendorId)) {
        toast('Choisissez un vendeur');
        return false;
      }
      if (!TYPE_MAP[type]) {
        toast('Choisissez un type de code');
        return false;
      }
      if (licenseBlocked(vendorId)) {
        alert('Licence vendeur expirée ou absente. Ajoutez ou renouvelez sa licence avant toute vente.');
        return false;
      }
      const available = vendorStock(vendorId)[type] ?? 0;
      if (qty > available) {
        if (!confirm(`Stock insuffisant : ${available} ${TYPE_MAP[type].short} disponible(s). Enregistrer quand même ?`)) {
          return false;
        }
      }
      db.sales.push({
        id: uid(), vendorId, type, qty, unit, total: unit * qty, date,
        note: String(fd.get('note') || '').trim(),
      });
      save();
      render();
      toast('Vente enregistrée');
      return true;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Formulaire : approvisionnement                                      */
/* ------------------------------------------------------------------ */

function openSupplyForm(vendorId) {
  if (!ensureVendors()) return;
  const selected = vendorId || db.vendors[0].id;

  openSheet({
    title: 'Approvisionnement',
    subtitle: 'Attribuez des codes à un vendeur.',
    submitText: 'Enregistrer',
    body: `
      <label class="field"><span>Vendeur *</span>
        <select name="vendorId" required>${vendorOptions(selected)}</select>
      </label>
      <label class="field"><span>Date</span>
        <input type="datetime-local" name="date" value="${isoToLocalInput(nowISO())}" required>
      </label>
      <div class="grid2">
        ${TYPES.map(
          (t) => `<label class="field"><span>${t.short} — ${esc(t.label)}</span>
            <input type="number" name="qty_${t.id}" data-qty min="0" step="1" inputmode="numeric" value="0" placeholder="0">
          </label>`
        ).join('')}
      </div>
      <div class="supply-total"><span>Valeur totale</span><strong id="supplyTotal">0 F</strong></div>
      <div class="grid2">
        <label class="field"><span>Montant payé (F)</span>
          <input type="number" name="paid" min="0" step="1" inputmode="numeric" value="0">
        </label>
        <label class="field"><span>Note (optionnel)</span>
          <input name="note" maxlength="120" placeholder="Ex : dépôt du matin">
        </label>
      </div>`,
    onMount(form) {
      const totalEl = form.querySelector('#supplyTotal');
      const calc = () => {
        let total = 0;
        TYPES.forEach((t) => {
          const input = form.querySelector(`[name="qty_${t.id}"]`);
          total += Math.max(0, Math.round(num(input.value))) * t.price;
        });
        totalEl.textContent = fmt(total);
      };
      $$('[data-qty]', form).forEach((i) => i.addEventListener('input', calc));
      calc();
    },
    onSubmit(fd) {
      const vendorId = String(fd.get('vendorId') || '');
      const date = dateFromInput(fd.get('date')).toISOString();
      if (!vendorById(vendorId)) {
        toast('Choisissez un vendeur');
        return false;
      }
      const items = {};
      let count = 0;
      TYPES.forEach((t) => {
        const q = Math.max(0, Math.round(num(fd.get('qty_' + t.id), 0)));
        if (q > 0) {
          items[t.id] = q;
          count += q;
        }
      });
      if (!count) {
        toast('Indiquez au moins un code');
        return false;
      }
      db.supplies.push({
        id: uid(), vendorId, items, date,
        paid: Math.max(0, num(fd.get('paid'), 0)),
        note: String(fd.get('note') || '').trim(),
      });
      save();
      render();
      toast(`${count} code(s) attribué(s)`);
      return true;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Formulaire : versement                                              */
/* ------------------------------------------------------------------ */

function openPaymentForm(vendorId) {
  if (!ensureVendors()) return;
  const selected = vendorId || db.vendors[0].id;

  openSheet({
    title: 'Nouveau versement',
    subtitle: 'Enregistrez l’argent remis par un vendeur.',
    submitText: 'Enregistrer',
    body: `
      <label class="field"><span>Vendeur *</span>
        <select name="vendorId" required>${vendorOptions(selected)}</select>
      </label>
      <div class="grid2">
        <label class="field"><span>Montant (F) *</span>
          <input type="number" name="amount" min="1" step="1" inputmode="numeric" placeholder="0" required>
        </label>
        <label class="field"><span>Date</span>
          <input type="datetime-local" name="date" value="${isoToLocalInput(nowISO())}" required>
        </label>
      </div>
      <label class="field"><span>Note (optionnel)</span>
        <input name="note" maxlength="120" placeholder="Ex : versement du soir">
      </label>`,
    onSubmit(fd) {
      const vendorId = String(fd.get('vendorId') || '');
      const amount = num(fd.get('amount'), 0);
      if (!vendorById(vendorId)) {
        toast('Choisissez un vendeur');
        return false;
      }
      if (amount <= 0) {
        toast('Saisissez un montant valide');
        return false;
      }
      db.payments.push({
        id: uid(), vendorId, amount,
        date: dateFromInput(fd.get('date')).toISOString(),
        note: String(fd.get('note') || '').trim(),
      });
      save();
      render();
      toast('Versement enregistré');
      return true;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Formulaire : licence vendeur                                        */
/* ------------------------------------------------------------------ */

function openLicenseForm(vendorId) {
  if (!ensureVendors()) return;
  const selected = vendorId || db.vendors[0].id;
  const prices = db.settings.licensePrices || {};

  openSheet({
    title: 'Licence vendeur',
    subtitle: 'Formules : 3 mois, 6 mois ou 1 an.',
    submitText: 'Enregistrer',
    body: `
      <label class="field"><span>Vendeur *</span>
        <select name="vendorId" required>${vendorOptions(selected)}</select>
      </label>
      <div class="grid2">
        <label class="field"><span>Formule</span>
          <select name="plan">
            ${LICENSE_PLANS.map((p) => `<option value="${p.id}">${p.label} (${p.months} mois)</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Montant payé (F)</span>
          <input type="number" name="amount" min="0" step="1" inputmode="numeric" value="${num(prices[LICENSE_PLANS[0].id])}">
        </label>
      </div>
      <label class="field"><span>Début souhaité</span>
        <input type="date" name="start" value="${todayKey()}">
      </label>
      <p class="hint" id="licenseCalc"></p>
      <label class="field"><span>Note (optionnel)</span>
        <input name="note" maxlength="120" placeholder="Ex : paiement mobile money">
      </label>`,
    onMount(form) {
      const vendorSel = form.querySelector('[name="vendorId"]');
      const planSel = form.querySelector('[name="plan"]');
      const startInput = form.querySelector('[name="start"]');
      const amount = form.querySelector('[name="amount"]');
      const calc = form.querySelector('#licenseCalc');

      const updateCalc = () => {
        const start = startInput.value || todayKey();
        const base = licenseBaseKey(vendorSel.value, start);
        const plan = LICENSE_MAP[planSel.value];
        const end = addMonthsToDateKey(base, plan.months);
        const existing = vendorLicense(vendorSel.value);
        calc.textContent =
          existing && String(existing.end) >= start
            ? `Licence actuelle jusqu’au ${fmtDay(existing.end)}. Nouvelle période : ${fmtDay(base)} → ${fmtDay(end)}.`
            : `Nouvelle licence : ${fmtDay(base)} → ${fmtDay(end)}.`;
      };

      planSel.addEventListener('change', () => {
        const price = Math.max(0, num(prices[planSel.value]));
        if (price > 0) amount.value = price;
        updateCalc();
      });
      vendorSel.addEventListener('change', updateCalc);
      startInput.addEventListener('change', updateCalc);
      updateCalc();
    },
    onSubmit(fd) {
      const vendorId = String(fd.get('vendorId') || '');
      const plan = LICENSE_MAP[String(fd.get('plan') || '')];
      const amount = Math.max(0, num(fd.get('amount'), 0));
      const startKey = String(fd.get('start') || todayKey());
      if (!vendorById(vendorId)) {
        toast('Choisissez un vendeur');
        return false;
      }
      if (!plan) {
        toast('Choisissez une formule');
        return false;
      }
      const base = licenseBaseKey(vendorId, startKey);
      const end = addMonthsToDateKey(base, plan.months);
      db.licenses.push({
        id: uid(), vendorId, plan: plan.id, amount,
        start: base, end, date: nowISO(),
        note: String(fd.get('note') || '').trim(),
      });
      save();
      render();
      toast(`Licence valable jusqu’au ${fmtDay(end)}`);
      return true;
    },
  });
}

function openLicenseSettings() {
  const prices = db.settings.licensePrices || {};
  openSheet({
    title: 'Tarifs des licences',
    subtitle: 'Prix des formules et numéro WhatsApp à contacter.',
    submitText: 'Enregistrer',
    body: `
      <div class="grid2">
        ${LICENSE_PLANS.map(
          (p) => `<label class="field"><span>${p.label}</span>
            <input type="number" name="p_${p.id}" min="0" step="1" inputmode="numeric" value="${num(prices[p.id])}">
          </label>`
        ).join('')}
      </div>
      <label class="field"><span>Numéro WhatsApp des licences</span>
        <input type="tel" name="whatsapp" inputmode="tel" value="${fmtPhone(db.settings.whatsapp)}" placeholder="+221 77 700 35 59">
      </label>
      <p class="hint">Ces montants préremplissent le formulaire de licence et restent modifiables à chaque paiement. Les demandes de licence arrivent sur ce numéro WhatsApp.</p>`,
    onSubmit(fd) {
      const nextPrices = {};
      LICENSE_PLANS.forEach((p) => {
        nextPrices[p.id] = Math.max(0, num(fd.get(`p_${p.id}`), 0));
      });
      db.settings.licensePrices = nextPrices;
      db.settings.whatsapp =
        String(fd.get('whatsapp') || '').replace(/\D/g, '') || WHATSAPP_DEFAULT;
      save();
      render();
      toast('Tarifs et WhatsApp enregistrés');
      return true;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Formulaire : client mensuel                                         */
/* ------------------------------------------------------------------ */

function openClientForm() {
  if (!ensureVendors()) return;
  const selected = db.vendors[0].id;

  openSheet({
    title: 'Nouveau client mensuel',
    subtitle: 'Abonnement de 1 mois (3 000 F par défaut).',
    submitText: 'Ajouter',
    body: `
      <label class="field"><span>Nom du client *</span>
        <input name="nom" placeholder="Ex : Moussa Traoré" required>
      </label>
      <label class="field"><span>Téléphone</span>
        <input name="tel" type="tel" placeholder="Ex : 77 000 00 00">
      </label>
      <label class="field"><span>Vendeur *</span>
        <select name="vendorId" required>${vendorOptions(selected)}</select>
      </label>
      <div class="grid2">
        <label class="field"><span>Date de début</span>
          <input type="date" name="debut" value="${todayKey()}" required>
        </label>
        <label class="field"><span>Montant (F)</span>
          <input type="number" name="montant" min="0" step="1" inputmode="numeric" value="3000" required>
        </label>
      </div>
      <p class="hint">Le code 1 mois sera déduit du stock du vendeur et la date de fin calculée automatiquement (+1 mois).</p>`,
    onSubmit(fd) {
      const nom = String(fd.get('nom') || '').trim();
      const vendorId = String(fd.get('vendorId') || '');
      const montant = Math.max(0, num(fd.get('montant'), 3000));
      const debut = String(fd.get('debut') || todayKey());
      if (!nom) {
        toast('Le nom est obligatoire');
        return false;
      }
      if (!vendorById(vendorId)) {
        toast('Choisissez un vendeur');
        return false;
      }
      if (licenseBlocked(vendorId)) {
        alert('Licence vendeur expirée ou absente. Renouvelez sa licence avant de créer un abonnement.');
        return false;
      }
      const available = vendorStock(vendorId)['1m'] ?? 0;
      if (available < 1) {
        if (!confirm('Stock 1 mois insuffisant. Ajouter le client quand même ?')) return false;
      }
      const fin = addMonthsToDateKey(debut, 1);
      const client = {
        id: uid(), nom, tel: String(fd.get('tel') || '').trim(),
        vendorId, montant, debut, fin, createdAt: nowISO(),
      };
      db.clients.push(client);
      db.sales.push({
        id: uid(), vendorId, type: '1m', qty: 1, unit: montant,
        total: montant, date: nowISO(), clientId: client.id,
        note: `Abonnement ${nom}`,
      });
      save();
      render();
      toast(`Client ajouté jusqu’au ${fmtDay(fin)}`);
      return true;
    },
  });
}

function openRenewClient(clientId) {
  const client = db.clients.find((c) => c.id === clientId);
  if (!client) return;
  const baseKey = client.fin >= todayKey() ? client.fin : todayKey();
  const newEnd = addMonthsToDateKey(baseKey, 1);
  const selected = client.vendorId;

  openSheet({
    title: `Renouveler ${client.nom}`,
    subtitle: `Nouvelle échéance : ${fmtDay(newEnd)}`,
    submitText: 'Renouveler',
    body: `
      <label class="field"><span>Vendeur *</span>
        <select name="vendorId" required>${vendorOptions(selected)}</select>
      </label>
      <label class="field"><span>Montant encaissé (F)</span>
        <input type="number" name="montant" min="0" step="1" inputmode="numeric" value="${num(client.montant, 3000)}" required>
      </label>
      <p class="hint">L’abonnement sera prolongé jusqu’au ${fmtDay(newEnd)} et une vente 1 mois sera enregistrée.</p>`,
    onSubmit(fd) {
      const vendorId = String(fd.get('vendorId') || '');
      if (!vendorById(vendorId)) {
        toast('Choisissez un vendeur');
        return false;
      }
      if (licenseBlocked(vendorId)) {
        alert('Licence vendeur expirée ou absente. Renouvelez sa licence avant de prolonger un abonnement.');
        return false;
      }
      const montant = Math.max(0, num(fd.get('montant'), 3000));
      const available = vendorStock(vendorId)['1m'] ?? 0;
      if (available < 1) {
        if (!confirm('Stock 1 mois insuffisant. Renouveler quand même ?')) return false;
      }
      client.vendorId = vendorId;
      client.montant = montant;
      client.fin = newEnd;
      db.sales.push({
        id: uid(), vendorId, type: '1m', qty: 1, unit: montant,
        total: montant, date: nowISO(), clientId: client.id,
        note: `Renouvellement ${client.nom}`,
      });
      save();
      render();
      toast(`Abonnement prolongé jusqu’au ${fmtDay(newEnd)}`);
      return true;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Suppression / exports / sauvegarde                                  */
/* ------------------------------------------------------------------ */

function deleteRecord(kind, id) {
  const labels = {
    sales: 'cette vente',
    supplies: 'cet approvisionnement',
    payments: 'ce versement',
  };
  if (!labels[kind]) return;
  if (!confirm(`Supprimer ${labels[kind]} ?`)) return;
  db[kind] = db[kind].filter((x) => x.id !== id);
  save();
  render();
  toast('Supprimé');
}

function deleteClient(id) {
  const c = db.clients.find((x) => x.id === id);
  if (!c) return;
  if (!confirm(`Supprimer le client ${c.nom} ?`)) return;
  db.clients = db.clients.filter((x) => x.id !== id);
  save();
  render();
  toast('Client supprimé');
}

function csv(rows) {
  const body = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '');
          return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        })
        .join(';')
    )
    .join('\r\n');
  return '\uFEFF' + body;
}

function download(filename, content, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function exportSalesCSV() {
  const rows = [['Date', 'Vendeur', 'Type', 'Quantité', 'Prix unitaire', 'Total', 'Note']];
  [...db.sales].sort(byDateDesc).forEach((s) => {
    const v = vendorById(s.vendorId);
    rows.push([
      fmtDateTimeCSV(s.date), v ? v.nom : 'Vendeur supprimé',
      TYPE_MAP[s.type] ? TYPE_MAP[s.type].label : s.type,
      s.qty, s.unit, s.total, s.note || '',
    ]);
  });
  download(`wifipro-ventes-${todayKey()}.csv`, csv(rows));
  toast('Export des ventes prêt');
}

function exportSuppliesCSV() {
  const header = ['Date', 'Vendeur', ...TYPES.map((t) => t.short), 'Valeur', 'Payé', 'Note'];
  const rows = [header];
  [...db.supplies].sort(byDateDesc).forEach((s) => {
    const v = vendorById(s.vendorId);
    rows.push([
      fmtDateTimeCSV(s.date), v ? v.nom : 'Vendeur supprimé',
      ...TYPES.map((t) => num(s.items && s.items[t.id])),
      supplyTotal(s), num(s.paid), s.note || '',
    ]);
  });
  download(`wifipro-approvisionnements-${todayKey()}.csv`, csv(rows));
  toast('Export des appros prêt');
}

function exportPaymentsCSV() {
  const rows = [['Date', 'Vendeur', 'Montant', 'Note']];
  [...db.payments].sort(byDateDesc).forEach((p) => {
    const v = vendorById(p.vendorId);
    rows.push([fmtDateTimeCSV(p.date), v ? v.nom : 'Vendeur supprimé', p.amount, p.note || '']);
  });
  download(`wifipro-versements-${todayKey()}.csv`, csv(rows));
  toast('Export des versements prêt');
}

function exportClientsCSV() {
  const rows = [['Nom', 'Téléphone', 'Vendeur', 'Début', 'Fin', 'Statut', 'Montant']];
  [...db.clients]
    .sort((a, b) => String(a.fin).localeCompare(String(b.fin)))
    .forEach((c) => {
      const v = vendorById(c.vendorId);
      rows.push([
        c.nom, c.tel || '', v ? v.nom : 'Vendeur supprimé',
        fmtDay(c.debut), fmtDay(c.fin), isClientActive(c) ? 'Actif' : 'Expiré', c.montant,
      ]);
    });
  download(`wifipro-clients-${todayKey()}.csv`, csv(rows));
  toast('Export des clients prêt');
}

function exportLicensesCSV() {
  const rows = [['Date paiement', 'Vendeur', 'Formule', 'Début', 'Fin', 'Montant', 'Note']];
  [...db.licenses].sort(byDateDesc).forEach((l) => {
    const v = vendorById(l.vendorId);
    rows.push([
      fmtDateTimeCSV(l.date), v ? v.nom : 'Vendeur supprimé',
      licensePlanLabel(l.plan),
      fmtDay(l.start), fmtDay(l.end), l.amount, l.note || '',
    ]);
  });
  download(`wifipro-licences-${todayKey()}.csv`, csv(rows));
  toast('Export des licences prêt');
}

async function shareBackup() {
  const name = `wifipro-sauvegarde-${todayKey()}.json`;
  const content = JSON.stringify(db, null, 2);
  try {
    const file = new File([content], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Sauvegarde WifiPro',
        text: 'Sauvegarde des données WifiPro à conserver.',
      });
      toast('Sauvegarde partagée');
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  download(name, content, 'application/json;charset=utf-8');
  alert(
    'Le partage direct n’est pas disponible. La sauvegarde a été téléchargée : joignez-la à un email Gmail depuis vos fichiers.'
  );
}

function exportBackup() {
  download(
    `wifipro-sauvegarde-${todayKey()}.json`,
    JSON.stringify(db, null, 2),
    'application/json;charset=utf-8'
  );
  toast('Sauvegarde téléchargée');
}

async function restoreBackup(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.vendors)) throw new Error('Format invalide');
    if (!confirm('Remplacer toutes les données actuelles par cette sauvegarde ?')) return;
    db = normalize(data);
    save();
    render();
    toast('Sauvegarde restaurée');
  } catch (e) {
    alert('Fichier de sauvegarde invalide.');
  }
}

function resetData() {
  if (!confirm('Effacer toutes les données ? Cette action est irréversible.')) return;
  if (!confirm('Confirmer la suppression définitive des vendeurs, ventes et clients ?')) return;
  db = normalize({});
  save();
  history.replaceState(null, '', '#/home');
  render();
  toast('Données effacées');
}

/* ------------------------------------------------------------------ */
/* Feuille modale                                                      */
/* ------------------------------------------------------------------ */

function openSheet({ title, subtitle = '', body, submitText = 'Enregistrer', onSubmit, onMount }) {
  const dlg = $('#sheet');
  if (dlg.open) dlg.close();
  dlg.innerHTML = `
    <form id="sheetForm" novalidate>
      <div class="sheet-head">
        <div>
          <h3>${esc(title)}</h3>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
        </div>
        <button type="button" class="icon-btn ghost" data-close aria-label="Fermer">${icon('close')}</button>
      </div>
      <div class="sheet-body">${body}</div>
      <div class="sheet-foot">
        <button type="button" class="btn subtle" data-close>Annuler</button>
        <button type="submit" class="btn">${esc(submitText)}</button>
      </div>
    </form>`;

  dlg.showModal();
  $$('[data-close]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));

  const form = $('#sheetForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const result = onSubmit ? onSubmit(fd, form) : true;
    if (result !== false) dlg.close();
  });
  if (typeof onMount === 'function') onMount(form);

  const first = form.querySelector('input:not([type="hidden"]), select');
  if (first) setTimeout(() => first.focus(), 80);
}

let toastTimer = null;
function toast(message) {
  const wrap = $('#toast');
  wrap.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  wrap.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    el.style.transition = 'all .2s ease';
    setTimeout(() => el.remove(), 220);
  }, 2600);
}

/* ------------------------------------------------------------------ */
/* Installation PWA                                                    */
/* ------------------------------------------------------------------ */

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = $('#installBtn');
  if (btn) btn.hidden = false;
});

async function installApp() {
  const btn = $('#installBtn');
  if (deferredPrompt) {
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch (e) {
      /* ignore */
    }
    deferredPrompt = null;
    if (btn) btn.hidden = true;
    return;
  }
  alert(
    'Pour installer WifiPro : ouvrez le menu du navigateur (⋮) puis choisissez « Ajouter à l’écran d’accueil ».'
  );
}

/* ------------------------------------------------------------------ */
/* Événements                                                          */
/* ------------------------------------------------------------------ */

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const vendor = btn.dataset.vendor;

  switch (action) {
    case 'new-vendor': openVendorForm(); break;
    case 'edit-vendor': {
      const v = vendorById(id);
      if (v) openVendorForm(v);
      break;
    }
    case 'delete-vendor': deleteVendor(id); break;
    case 'new-sale': openSaleForm(vendor); break;
    case 'new-supply': openSupplyForm(vendor); break;
    case 'new-payment': openPaymentForm(vendor); break;
    case 'new-client': openClientForm(); break;
    case 'renew-client': openRenewClient(id); break;
    case 'delete-client': deleteClient(id); break;
    case 'new-license': openLicenseForm(vendor); break;
    case 'license-settings': openLicenseSettings(); break;
    case 'license-whatsapp': {
      const plan = LICENSE_MAP[btn.dataset.plan];
      if (!plan) break;
      const price = num((db.settings.licensePrices || {})[plan.id]);
      const nameInput = document.getElementById('waName');
      const name = nameInput ? nameInput.value.trim() : '';
      const message = [
        `Bonjour, je souhaite obtenir une licence vendeur WifiPro de ${plan.label}${price > 0 ? ` (${fmt(price)})` : ''}.`,
        name ? `Nom / point de vente : ${name}.` : '',
        'Merci de me confirmer le paiement et l’activation.',
      ].filter(Boolean).join('\n');
      openWhatsApp(message);
      break;
    }
    case 'delete-record': deleteRecord(btn.dataset.kind, id); break;
    case 'client-filter':
      clientFilter = btn.dataset.value || 'active';
      render();
      break;
    case 'report-period':
      reportPeriod = btn.dataset.value || '30';
      render();
      break;
    case 'export-sales': exportSalesCSV(); break;
    case 'export-supplies': exportSuppliesCSV(); break;
    case 'export-payments': exportPaymentsCSV(); break;
    case 'export-clients': exportClientsCSV(); break;
    case 'export-licenses': exportLicensesCSV(); break;
    case 'export-backup': exportBackup(); break;
    case 'share-backup': shareBackup(); break;
    case 'import-backup': {
      const input = $('#restoreFile');
      if (input) input.click();
      break;
    }
    case 'install-app': installApp(); break;
    case 'reset-data': resetData(); break;
    default: break;
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.matches('[data-filter="sale-vendor"]')) {
    saleFilter.vendor = t.value;
    render();
  } else if (t.matches('[data-filter="sale-period"]')) {
    saleFilter.period = t.value;
    render();
  } else if (t.id === 'restoreFile') {
    const file = t.files && t.files[0];
    restoreBackup(file);
    t.value = '';
  }
});

const sheet = $('#sheet');
if (sheet) {
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.close();
  });
}

window.addEventListener('hashchange', render);
const installBtn = $('#installBtn');
if (installBtn) installBtn.addEventListener('click', installApp);

/* ------------------------------------------------------------------ */
/* Démarrage                                                           */
/* ------------------------------------------------------------------ */

if (!location.hash) history.replaceState(null, '', '#/home');
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
render();
