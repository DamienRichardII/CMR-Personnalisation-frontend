#!/usr/bin/env node
/* Synchronise le catalogue Roly (API WSCLIENTS, lecture seule) vers la table Supabase `roly_produits`.
 *
 * Variables d'environnement (à définir sur VOTRE poste, jamais dans Git) :
 *   ROLY_USERNAME, ROLY_PASSWORD            identifiants de l'extranet Roly
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  clé "service_role" (Supabase > Project Settings > API)
 *   ROLY_API_BASE_URL  (facultatif)          défaut : https://clientsws.gorfactory.es:2096
 *
 * Usage :
 *   node scripts/sync-roly.mjs                       synchronisation complète
 *   node scripts/sync-roly.mjs --category=highviscoats --dry     test sur une catégorie, sans écriture
 *   node scripts/sync-roly.mjs --file=reponse.json --dry         lit un fichier getcatalog déjà téléchargé
 *   node scripts/sync-roly.mjs --dir=roly-fichiers               lit un dossier : un fichier <id-categorie>.json par catégorie
 *                                                                (+ categories.json = réponse de /item/categories, pour les sous-catégories)
 *
 * Aucune commande, aucun stock, aucun prix : uniquement les fiches produits. */
import { readFileSync, readdirSync } from 'node:fs';

const BASE = (process.env.ROLY_API_BASE_URL || 'https://clientsws.gorfactory.es:2096').replace(/\/$/, '');
const LANG = 'fr-FR', BRANDS = ['roly', 'stamina'];   // marques Roly documentées par l'API (roly = vêtements, stamina = objets et accessoires)
const VIRTUAL = new Set(['outlet', 'new-prices']); // rayons commerciaux, sans intérêt pour le catalogue

/* ---------- transformation (pure, testable) ---------- */
const titleCase = (s) => String(s || '').toLowerCase().replace(/(^|[\s/(-])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase());
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const httpsOnly = (u) => { u = clean(u); return /^https:\/\/([\w-]+\.)*gorfactory\.es\//.test(u) ? u : ''; };
const list = (s) => String(s || '').split(',').map(httpsOnly).filter(Boolean);

export function modelTitle(line) {
  const name = clean(line.itemname), mn = clean(line.modelname);
  let t = name;
  if (mn) { const i = name.toUpperCase().indexOf(mn.toUpperCase()); if (i >= 0) t = name.slice(0, i + mn.length); }
  return titleCase(t);
}
const SIZE_ORDER = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', 'XXXXL', '4XL', '5XL'];
const sizeRank = (s) => { const i = SIZE_ORDER.indexOf(String(s).toUpperCase()); return i < 0 ? 100 + (parseFloat(s) || 0) : i; };

/* items : lignes getcatalog (une ligne = un modèle × un coloris × une taille). anc : id catégorie -> [ancêtres incl. soi]. */
export function groupModels(items, catId, anc = {}, into = new Map(), brand = 'roly') {
  for (const l of items) {
    const code = clean(l.modelcode); if (!code) continue;
    const key = brand === 'roly' ? code : brand.slice(0, 3).toUpperCase() + '-' + code;
    let m = into.get(key);
    if (!m) {
      m = { modelcode: key, brand, nom: modelTitle(l), description: String(l.description || '').split('·').map(clean).filter(Boolean).join('\n') || null,
        composition: clean(l.composition) || null, observations: String(l.observations || '').split('·').map(clean).filter(Boolean).join('\n') || null,
        genre: titleCase(l.gender) || null, famille: titleCase(l.family) || null, cat_ids: new Set(), categories: new Set(), tailles: new Set(),
        colors: new Map(), nouveaute: String(l.isnovelty).toLowerCase() === 'true', enfant: String(l.isforchildren).toLowerCase() === 'true', image: '' };
      into.set(key, m);
    }
    for (const c of (anc[catId] || [catId])) m.cat_ids.add(c);
    String(l.categories || '').split(',').map(clean).filter(Boolean).forEach((c) => m.categories.add(c));
    if (l.sizename) m.tailles.add(clean(l.sizename));
    const cc = clean(l.colorcode) || clean(l.colorname);
    if (cc && !m.colors.has(cc)) {
      const front = httpsOnly(l.productimage);
      const views = list(l.viewsimages);
      m.colors.set(cc, { code: clean(l.colorcode), nom: titleCase(l.colorname), image: front || views[0] || '', views });
    }
  }
  return into;
}
export function toRows(models) {
  return [...models.values()].map((m) => {
    const coloris = [...m.colors.values()].filter((c) => c.image || c.views.length);
    return { modelcode: m.modelcode, brand: m.brand, nom: m.nom, description: m.description, composition: m.composition, observations: m.observations,
      genre: m.genre, famille: m.famille, cat_ids: [...m.cat_ids], categories: [...m.categories], tailles: [...m.tailles].sort((a, b) => sizeRank(a) - sizeRank(b)),
      coloris, image: (coloris[0] && (coloris[0].image || coloris[0].views[0])) || null, nouveaute: m.nouveaute, enfant: m.enfant, actif: coloris.length > 0, maj: new Date().toISOString() };
  });
}
export function ancestors(cats) {
  const by = new Map(cats.map((c) => [c.id, c])), out = {};
  for (const c of cats) { const chain = []; let cur = c, guard = 0; while (cur && guard++ < 10) { chain.push(cur.id); cur = cur.parentId ? by.get(cur.parentId) : null; } out[c.id] = chain; }
  return out;
}

/* ---------- accès réseau ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function http(url, opt = {}, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { ...opt, signal: AbortSignal.timeout(opt.timeout || 300000) });
      if (r.status >= 500 && i < tries) { await sleep(2000 * i); continue; }
      return r;
    } catch (e) { if (i >= tries) throw e; await sleep(2000 * i); }
  }
}
async function login() {
  const { ROLY_USERNAME: username, ROLY_PASSWORD: password } = process.env;
  if (!username || !password) throw new Error('ROLY_USERNAME / ROLY_PASSWORD manquants.');
  const r = await http(BASE + '/api/v1.1/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, scope: '' }) });
  const txt = (await r.text()).trim();
  if (!r.ok) throw new Error('Connexion Roly refusée (HTTP ' + r.status + ').');
  let tok = txt; try { const j = JSON.parse(txt); tok = typeof j === 'string' ? j : (j.token || j.access_token || j.accessToken || j.jwt || j.Token || ''); } catch {}
  tok = String(tok).replace(/^"|"$/g, '').replace(/^Bearer\s+/i, '');
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(tok)) throw new Error('Jeton introuvable dans la réponse de connexion.');
  return tok;
}
async function api(path, token) {
  const r = await http(BASE + path, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
  if (!r.ok) throw new Error('Roly ' + path.split('?')[0] + ' : HTTP ' + r.status);
  return r.json();
}
async function sb(path, opt = {}) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.');
  const r = await http(url.replace(/\/$/, '') + '/rest/v1/' + path, { ...opt, headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...(opt.headers || {}) } });
  if (!r.ok) throw new Error('Supabase ' + path.split('?')[0] + ' : HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300));
  return r;
}

/* ---------- programme ---------- */
const arg = (n) => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : null; };
const flag = (n) => process.argv.includes('--' + n);

async function main() {
  const dry = flag('dry'), onlyCat = arg('category'), file = arg('file'), dir = arg('dir');
  const models = new Map(), okBrands = []; let complete = true, failed = 0;
  if (dir) {
    let anc = {}; try { anc = ancestors(JSON.parse(readFileSync(dir + '/categories.json', 'utf8'))); } catch { console.log('(pas de categories.json : sous-catégories non reliées)'); }
    const files = readdirSync(dir).filter((f) => /\.json$/i.test(f) && !/^categories\.json$/i.test(f)); complete = false;
    for (const f of files) {
      const id = f.replace(/\.json$/i, ''), j = JSON.parse(readFileSync(dir + '/' + f, 'utf8')), items = Array.isArray(j) ? j : j.item || [];
      groupModels(items, id, anc, models); console.log('  ' + id.padEnd(22) + String(items.length).padStart(6) + ' lignes → ' + models.size + ' modèles au total');
    }
  } else if (file) {
    const j = JSON.parse(readFileSync(file, 'utf8')); groupModels(Array.isArray(j) ? j : j.item || [], arg('cat') || 'fichier', {}, models); complete = false;
  } else {
    const token = await login(); console.log('Connexion Roly : OK');
    const only = arg('brand');
    for (const brand of BRANDS.filter((x) => !only || x === only)) {
      const bm = new Map(); let bOk = true;
      try {
        const cats = await api('/api/v1/item/categories?lang=' + LANG + '&brand=' + brand, token);
        const anc = ancestors(cats), parents = new Set(cats.map((c) => c.parentId).filter(Boolean));
        let todo = cats.filter((c) => !parents.has(c.id) && !VIRTUAL.has(c.id));        // feuilles = catégories sans enfants
        if (onlyCat) { todo = cats.filter((c) => c.id === onlyCat); bOk = false; if (!todo.length) { console.log('Catégorie inconnue pour ' + brand + ' : ' + onlyCat); continue; } }
        console.log('[' + brand + '] ' + todo.length + ' catégories à lire…');
        for (const c of todo) {
          try {
            const j = await api('/api/v1/item/getcatalog?lang=' + LANG + '&brand=' + brand + '&category=' + encodeURIComponent(c.id), token);
            const items = Array.isArray(j) ? j : j.item || [];
            groupModels(items, c.id, anc, bm, brand);
            console.log('  ' + c.id.padEnd(22) + String(items.length).padStart(6) + ' lignes → ' + bm.size + ' modèles au total');
          } catch (e) { bOk = false; failed++; console.error('  ' + c.id + ' : ÉCHEC (' + e.message + ')'); }
        }
      } catch (e) { bOk = false; failed++; console.error('[' + brand + '] ÉCHEC : ' + e.message); }
      for (const [k, v] of bm) models.set(k, v);
      if (!bOk) complete = false; else okBrands.push(brand);
    }
  }
  const rows = toRows(models);
  console.log(rows.length + ' modèles prêts' + (dry ? ' (mode test : rien n\'est écrit).' : '.'));
  if (dry) { console.log(JSON.stringify(rows[0], null, 2).slice(0, 1800)); return; }
  for (let i = 0; i < rows.length; i += 100)
    await sb('roly_produits?on_conflict=modelcode', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 100)) });
  console.log('Supabase : ' + rows.length + ' fiches enregistrées.');
  const MIN = { roly: 200, stamina: 10 };
  const doneBrands = dir || file ? [] : okBrands.filter((br) => !onlyCat);
  for (const br of doneBrands) {
    const mine = rows.filter((r) => r.brand === br);
    if (mine.length < (MIN[br] || 10)) { console.log('[' + br + '] Trop peu de modèles reçus : résultat suspect, aucun modèle masqué.'); continue; }
    const stamp = mine.reduce((a, r) => (r.maj < a ? r.maj : a), mine[0].maj);
    await sb('roly_produits?brand=eq.' + br + '&maj=lt.' + encodeURIComponent(stamp), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ actif: false }) });
    console.log('[' + br + '] Modèles retirés par le fournisseur : masqués.');
  }
  if (!doneBrands.length) console.log('Synchro partielle : aucun modèle masqué.');
  if (failed) { console.error(failed + ' catégorie(s) en échec.'); process.exitCode = 1; }
}
if (import.meta.url === 'file://' + process.argv[1] || process.argv[1]?.endsWith('sync-roly.mjs')) main().catch((e) => { console.error('Erreur : ' + e.message); process.exit(1); });
