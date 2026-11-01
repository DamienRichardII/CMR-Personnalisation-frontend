#!/usr/bin/env node
/* Sondage de l'API JHK (lecture seule) : enregistre quelques réponses dans ./jhk-probe/ pour que je puisse écrire l'import.
 * Votre token n'est jamais affiché ni enregistré : il est remplacé par *** partout.
 *   PowerShell :  $env:JHK_API_TOKEN="votre_token"
 *                 node scripts/probe-jhk.mjs */
import { mkdirSync, writeFileSync } from 'node:fs';
const TOKEN = process.env.JHK_API_TOKEN, LANG = 'fr';
if (!TOKEN) { console.error('JHK_API_TOKEN manquant.'); process.exit(1); }
const BASE = 'https://www.jhktshirt.com/app/' + LANG + '/api/' + TOKEN + '/';
const mask = (s) => String(s).split(TOKEN).join('***');
mkdirSync('jhk-probe', { recursive: true });

async function get(path, name) {
  try {
    const r = await fetch(BASE + path, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(120000) });
    const txt = mask(await r.text());
    console.log(name.padEnd(22) + ' HTTP ' + r.status + '  ' + (txt.length / 1024).toFixed(0) + ' Ko');
    writeFileSync('jhk-probe/' + name + '.json', txt);
    try { return JSON.parse(txt); } catch { return null; }
  } catch (e) { console.log(name.padEnd(22) + ' ÉCHEC ' + mask(e.message)); return null; }
}
const shape = (v, d = 0) => Array.isArray(v) ? '[' + v.length + ' éléments] ' + (v[0] !== undefined && d < 2 ? shape(v[0], d + 1) : '')
  : v && typeof v === 'object' ? '{' + Object.keys(v).slice(0, 40).join(', ') + '}' : typeof v;

const cats = await get('gallery/categories.json', 'categories'); console.log('  forme :', shape(cats));
const wh = await get('gallery/warehouses.json', 'warehouses'); console.log('  forme :', shape(wh));
const prods = await get('gallery/tee-shirts/products.json', 'produits-tee-shirts'); console.log('  forme :', shape(prods));
let first = Array.isArray(prods) ? prods[0] : prods && (prods.products || prods.data || Object.values(prods)[0]);
if (Array.isArray(first)) first = first[0];
const ref = first && (first.reference || first.ref || first.code || first.sku);
if (ref) { const one = await get('clothes/11/' + encodeURIComponent(ref) + '/product.json', 'fiche-' + ref); console.log('  forme :', shape(one)); }
else console.log('Référence du premier produit non trouvée : envoyez-moi quand même le dossier jhk-probe.');
console.log('\nTerminé. Envoyez-moi les fichiers du dossier "jhk-probe" (ils ne contiennent pas votre token).');
