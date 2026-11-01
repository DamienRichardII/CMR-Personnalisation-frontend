#!/usr/bin/env node
/* Synchronise le catalogue JHK (API publique en lecture seule) vers la table Supabase `roly_produits` (brand = 'jhk').
 *
 * Variables d'environnement (sur VOTRE poste ou dans les secrets GitHub, jamais dans Git) :
 *   JHK_API_TOKEN                            votre token JHK
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  clé "service_role" de Supabase
 *
 * Usage :
 *   node scripts/sync-jhk.mjs --dry --limit=10     essai sur 10 produits, sans rien écrire
 *   node scripts/sync-jhk.mjs                      synchronisation complète
 * Aucun prix ni stock n'est enregistré : uniquement les fiches produits. */

const LANG = 'fr', WAREHOUSE = '11';
const TOKEN = process.env.JHK_API_TOKEN || '';
const BASE = 'https://www.jhktshirt.com/app/' + LANG + '/api/' + TOKEN + '/';
const mask = (s) => (TOKEN ? String(s).split(TOKEN).join('***') : String(s));

/* ---------- transformation (pure, testable) ---------- */
const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const https = (u) => { u = clean(u); if (u.startsWith('//')) u = 'https:' + u; return /^https:\/\//.test(u) ? u : ''; };
const FR = { white: 'Blanc', black: 'Noir', navy: 'Marine', red: 'Rouge', green: 'Vert', blue: 'Bleu', yellow: 'Jaune', orange: 'Orange', pink: 'Rose', purple: 'Violet', brown: 'Marron', beige: 'Beige', burgundy: 'Bordeaux', natural: 'Naturel', khaki: 'Kaki', grey: 'Gris', gray: 'Gris', 'royal blue': 'Bleu roi', 'sky blue': 'Bleu ciel', 'light grey': 'Gris clair', 'dark grey': 'Gris foncé', 'light blue': 'Bleu clair', 'dark navy': 'Marine foncé', 'bottle green': 'Vert bouteille', 'lime green': 'Vert citron', 'fluor yellow': 'Jaune fluo', 'fluor orange': 'Orange fluo' };
const colorName = (n) => { n = clean(n); return FR[n.toLowerCase()] || n; };
const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
export function htmlToLines(html) {
  return decode(String(html || '').replace(/<\/(p|li|h\d|div)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).split('\n').map(clean).filter(Boolean);
}
const byOrder = (a, b) => (parseFloat(a.r_order) || 0) - (parseFloat(b.r_order) || 0);
const slug = (s) => clean(s).toLowerCase();
const MAINS = new Set(['homme', 'femme', 'enfant']);

/* categories.json -> liste de pages produits à lire */
export function jobsFromCategories(cats) {
  const jobs = [];
  for (const e of Array.isArray(cats) ? cats : []) {
    const subs = e.categories ? Object.values(e.categories) : [];
    if (MAINS.has(slug(e.slug))) for (const s of subs) jobs.push({ path: 'gallery/' + encodeURIComponent(s.slug) + '/main/' + encodeURIComponent(e.slug) + '/products.json', main: slug(e.slug), cat: slug(s.slug), catName: clean(s.name) });
    else if (subs.length) for (const s of subs) jobs.push({ path: 'gallery/' + encodeURIComponent(s.slug) + '/products.json', line: slug(s.slug), catName: clean(s.name) });
    else if (e.slug) jobs.push({ path: 'gallery/' + encodeURIComponent(e.slug) + '/products.json', main: slug(e.slug), catName: clean(e.name) });
  }
  return jobs;
}
export function collect(list, job, into = new Map()) {
  for (const p of Array.isArray(list) ? list : []) {
    const ref = clean(p.reference); if (!ref) continue;
    let m = into.get(ref); if (!m) { m = { ref, name: clean(p.name), image: https(p.image), mains: new Set(), cats: new Set(), lines: new Set(), names: new Set() }; into.set(ref, m); }
    if (job.main) m.mains.add(job.main); if (job.cat) m.cats.add(job.cat); if (job.line) m.lines.add(job.line); if (job.catName) m.names.add(job.catName);
  }
  return into;
}
export function toRow(meta, d) {
  const imgs = [...new Set([...(Array.isArray(d.images) ? d.images : Object.values(d.images || {})).map(https), meta.image].filter(Boolean))];
  const main = imgs[0] || '';
  const lines = htmlToLines(d.description_html || d.description_plain);
  const sizes = Object.values(d.sizes || {}).sort(byOrder).map((s) => clean(s.name || s.reference)).filter(Boolean);
  const colors = Object.values(d.colors || {}).sort(byOrder).map((c) => ({ code: clean(c.reference), nom: colorName(c.name), image: main, swatch: https(c.image), views: imgs }));
  const mains = [...meta.mains].filter((x) => MAINS.has(x));
  const genre = mains.map((x) => x[0].toUpperCase() + x.slice(1)).join(' / ') || null;
  return { modelcode: 'JHK-' + meta.ref, brand: 'jhk', nom: clean(d.name) || meta.name || meta.ref, description: lines.join('\n') || null,
    composition: clean(d.composicion) || null, observations: null, genre, famille: [...meta.names][0] || null,
    cat_ids: [...new Set([...meta.mains, ...meta.cats, ...meta.lines])], categories: [...meta.names], tailles: sizes, coloris: colors, image: main || null,
    nouveaute: false, enfant: meta.mains.has('enfant'), actif: !!main, maj: new Date().toISOString() };
}

/* ---------- réseau ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(path, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(BASE + path, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(120000) });
      if (r.status >= 500 && i < tries) { await sleep(1500 * i); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return JSON.parse(await r.text());
    } catch (e) { if (i >= tries) throw new Error(mask(path.split('/').slice(0, 3).join('/')) + ' : ' + mask(e.message)); await sleep(1500 * i); }
  }
}
async function sb(path, opt = {}) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.');
  const r = await fetch(url.replace(/\/$/, '') + '/rest/v1/' + path, { ...opt, signal: AbortSignal.timeout(120000), headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...(opt.headers || {}) } });
  if (!r.ok) throw new Error('Supabase ' + path.split('?')[0] + ' : HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300));
}
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } })); }

/* ---------- programme ---------- */
const arg = (n) => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : null; };
async function main() {
  if (!TOKEN) throw new Error('JHK_API_TOKEN manquant.');
  const dry = process.argv.includes('--dry'), limit = parseInt(arg('limit'), 10) || 0;
  let complete = true, failed = 0;
  const cats = await getJson('gallery/categories.json'), jobs = jobsFromCategories(cats), metas = new Map();
  console.log(jobs.length + ' listes de produits à lire…');
  await pool(jobs, 4, async (j) => { try { collect(await getJson(j.path), j, metas); } catch (e) { complete = false; failed++; console.error('  ÉCHEC liste : ' + e.message); } });
  let refs = [...metas.values()]; console.log(refs.length + ' références trouvées.');
  if (limit) { refs = refs.slice(0, limit); complete = false; }
  const rows = [];
  await pool(refs, 5, async (m, k) => {
    try { rows.push(toRow(m, await getJson('clothes/' + WAREHOUSE + '/' + encodeURIComponent(m.ref) + '/product.json'))); }
    catch (e) { complete = false; failed++; console.error('  ÉCHEC fiche ' + m.ref + ' : ' + e.message); }
    if ((k + 1) % 50 === 0) console.log('  ' + (k + 1) + '/' + refs.length);
  });
  console.log(rows.length + ' fiches prêtes' + (dry ? ' (mode test : rien n\'est écrit).' : '.'));
  if (dry) { console.log(JSON.stringify(rows[0], null, 2).slice(0, 2200)); return; }
  for (let i = 0; i < rows.length; i += 50) await sb('roly_produits?on_conflict=modelcode', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 50)) });
  console.log('Supabase : ' + rows.length + ' fiches JHK enregistrées.');
  if (complete && rows.length < 50) { complete = false; console.log('Moins de 50 fiches reçues : résultat suspect, aucun modèle masqué.'); }
  if (complete) {
    const stamp = rows.reduce((a, r) => (r.maj < a ? r.maj : a), rows[0].maj);
    await sb('roly_produits?brand=eq.jhk&maj=lt.' + encodeURIComponent(stamp), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ actif: false }) });
    console.log('Modèles retirés par JHK : masqués.');
  } else console.log('Synchro partielle : aucun modèle masqué.');
  if (failed) { console.error(failed + ' erreur(s).'); process.exitCode = 1; }
}
if (process.argv[1] && process.argv[1].endsWith('sync-jhk.mjs')) main().catch((e) => { console.error('Erreur : ' + mask(e.message)); process.exit(1); });
