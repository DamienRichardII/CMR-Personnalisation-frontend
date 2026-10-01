/* CMR Personnalisation — envoi des demandes (devis + contact) par e-mail via Resend.
   Fonction serverless Vercel : POST /api/devis (JSON).
   Variables d'environnement (Vercel → Settings → Environment Variables) :
     RESEND_API_KEY  (obligatoire) clé API Resend
     MAIL_TO         (optionnel)  destinataire — défaut : cmr.personnalisation@gmail.com
     SUPABASE_URL                (optionnel) https://ruxyfdmhkxfsbhxwscom.supabase.co
     SUPABASE_SERVICE_ROLE_KEY   (optionnel) clé "service_role" (secrète, jamais côté navigateur) :
                                  si présente, chaque demande est aussi enregistrée dans Supabase
     MAIL_FROM       (optionnel)  expéditeur — défaut : onboarding@resend.dev (test) ;
                                  utiliser une adresse d'un domaine vérifié dans Resend en production */
const ALLOWED_EXT = /\.(png|jpe?g|gif|webp|svg|pdf|ai|eps|psd|zip)$/i;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);

const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const sbHeaders = (extra) => Object.assign({ apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY }, extra || {});
const get = (pairs, label) => { const p = pairs.find((x) => x[0] === label); return p ? p[1] : null; };

async function saveToSupabase(subject, pairs, attachments) {
  if (!SB_URL() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const isContact = /^Contact site/i.test(subject);
  let table, row;
  if (isContact) {
    table = 'messages_contact';
    row = { nom: get(pairs, 'Nom'), entreprise: get(pairs, 'Entreprise'), email: get(pairs, 'E-mail'), telephone: get(pairs, 'Téléphone'), sujet: get(pairs, 'Sujet'), message: get(pairs, 'Message') };
    if (!row.email || !row.message) return false;
  } else {
    table = 'demandes_devis';
    const d = get(pairs, 'Date souhaitée');
    row = {
      besoin: get(pairs, 'Besoin'), produits: (get(pairs, 'Produits') || '').split(',').map((x) => x.trim()).filter(Boolean),
      technique: get(pairs, 'Technique'), logo_existant: get(pairs, 'Logo / visuel existant'), quantite: get(pairs, 'Quantité'),
      date_souhaitee: /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null, urgent: get(pairs, 'Urgent') === 'Oui',
      description: get(pairs, 'Description'), prenom: get(pairs, 'Prénom'), nom: get(pairs, 'Nom'),
      entreprise: get(pairs, 'Entreprise / association'), email: get(pairs, 'E-mail'), telephone: get(pairs, 'Téléphone'),
      ville: get(pairs, 'Ville / code postal'), donnees: Object.fromEntries(pairs)
    };
    if (!row.email) return false;
    const id = require('crypto').randomUUID();
    row.id = id;
    const saved = [];
    for (const f of attachments) {
      const path = id + '/' + Date.now() + '-' + f.filename.replace(/[^\w.\-]+/g, '_');
      const up = await fetch(SB_URL() + '/storage/v1/object/devis-fichiers/' + path, {
        method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/octet-stream' }), body: Buffer.from(f.content, 'base64')
      });
      if (up.ok) saved.push({ nom: f.filename, chemin: path });
    }
    row.fichiers = saved;
  }
  const r = await fetch(SB_URL() + '/rest/v1/' + table, {
    method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(row)
  });
  return r.ok;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method' }); }
  const key = process.env.RESEND_API_KEY;

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || !Array.isArray(b.pairs)) return res.status(400).json({ error: 'payload' });

  const subject = clip(b.subject || 'Demande via le site', 150).replace(/[\r\n]+/g, ' ');
  const pairs = b.pairs.slice(0, 40).map((p) => [clip(p && p[0], 80), clip(p && p[1], 4000)]).filter((p) => p[1].trim());
  if (!pairs.length) return res.status(400).json({ error: 'empty' });

  const replyTo = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(b.replyTo || '') ? b.replyTo : undefined;

  let total = 0;
  const attachments = (Array.isArray(b.files) ? b.files : []).slice(0, 13).filter((f) => {
    if (!f || !f.name || typeof f.content !== 'string' || !ALLOWED_EXT.test(f.name)) return false;
    total += f.content.length;
    return total <= 4200000;
  }).map((f) => ({ filename: clip(f.name, 120).replace(/[\\/]/g, '_'), content: f.content }));

  const text = pairs.map((p) => p[0] + ' : ' + p[1]).join('\n');
  const html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">' +
    '<h2 style="margin:0 0 12px">' + esc(subject) + '</h2>' +
    '<table cellpadding="6" style="border-collapse:collapse">' +
    pairs.map((p) => '<tr><td style="vertical-align:top;color:#555;white-space:nowrap"><b>' + esc(p[0]) + '</b></td><td style="white-space:pre-wrap">' + esc(p[1]) + '</td></tr>').join('') +
    '</table></div>';

  const [stored, mailed] = await Promise.all([
    saveToSupabase(subject, pairs, attachments).catch(() => false),
    key ? fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'CMR Personnalisation <onboarding@resend.dev>',
        to: [process.env.MAIL_TO || 'cmr.personnalisation@gmail.com'],
        subject, html, text,
        reply_to: replyTo,
        attachments: attachments.length ? attachments : undefined
      })
    }).then((r) => r.ok).catch(() => false) : Promise.resolve(false)
  ]);
  /* Succès dès qu'au moins un canal (base de données ou e-mail) a enregistré la demande */
  if (stored || mailed) return res.status(200).json({ ok: true });
  return res.status(key || SB_URL() ? 502 : 500).json({ error: 'delivery' });
};
