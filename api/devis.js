/* CMR Personnalisation — envoi des demandes (devis + contact) par e-mail via Resend.
   Fonction serverless Vercel : POST /api/devis (JSON).
   Variables d'environnement (Vercel → Settings → Environment Variables) :
     RESEND_API_KEY  (obligatoire) clé API Resend
     MAIL_TO         (optionnel)  destinataire — défaut : cmrpersonnalisation@gmail.com
     MAIL_FROM       (optionnel)  expéditeur — défaut : onboarding@resend.dev (test) ;
                                  utiliser une adresse d'un domaine vérifié dans Resend en production */
const ALLOWED_EXT = /\.(png|jpe?g|gif|webp|svg|pdf|ai|eps|psd|zip)$/i;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method' }); }
  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ error: 'config' });

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

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'CMR Personnalisation <onboarding@resend.dev>',
        to: [process.env.MAIL_TO || 'cmrpersonnalisation@gmail.com'],
        subject, html, text,
        reply_to: replyTo,
        attachments: attachments.length ? attachments : undefined
      })
    });
    if (!r.ok) return res.status(502).json({ error: 'provider' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: 'network' });
  }
};
