/* Gabarit de l'e-mail reçu par CMR à chaque demande (devis ou contact).
   Mise en page en tableaux + styles en ligne : compatible Gmail, Outlook, Apple Mail. */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CONTACT_KEYS = ['Prénom', 'Nom', 'Entreprise / association', 'Entreprise', 'E-mail', 'Téléphone', 'Ville / code postal'];
const BLUE = '#0a47ff', NIGHT = '#060b13';

function rows(list) {
  return list.map((p, i) =>
    '<tr><td style="padding:10px 0;' + (i ? 'border-top:1px solid #e6eaf2;' : '') + 'width:150px;vertical-align:top;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#6b7690">' + esc(p[0]) + '</td>' +
    '<td style="padding:10px 0;' + (i ? 'border-top:1px solid #e6eaf2;' : '') + 'vertical-align:top;font-size:14px;line-height:1.55;color:#0d1626;white-space:pre-wrap">' +
    (p[0] === 'E-mail' ? '<a href="mailto:' + esc(p[1]) + '" style="color:' + BLUE + ';text-decoration:none">' + esc(p[1]) + '</a>' : p[0] === 'Téléphone' ? '<a href="tel:' + esc(String(p[1]).replace(/[^\d+]/g, '')) + '" style="color:' + BLUE + ';text-decoration:none">' + esc(p[1]) + '</a>' : esc(p[1])) +
    '</td></tr>').join('');
}
function block(title, list) {
  if (!list.length) return '';
  return '<tr><td style="padding:26px 36px 0"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:' + BLUE + ';padding-bottom:6px;border-bottom:2px solid ' + BLUE + '">' + title + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' + rows(list) + '</table></td></tr>';
}
function btn(href, label, solid) {
  return '<a href="' + esc(href) + '" style="display:inline-block;margin:0 8px 8px 0;padding:13px 24px;border-radius:999px;font-size:14px;font-weight:700;text-decoration:none;' +
    (solid ? 'background:' + BLUE + ';color:#ffffff' : 'border:1px solid #c9d2e4;color:#0d1626') + '">' + esc(label) + '</a>';
}

function renderMail(o) {
  const subject = o.subject, pairs = o.pairs, site = (o.siteUrl || '').replace(/\/$/, '');
  const isContact = /^Contact site/i.test(subject);
  const get = (k) => { const p = pairs.find((x) => x[0] === k); return p ? p[1] : ''; };
  const contact = pairs.filter((p) => CONTACT_KEYS.indexOf(p[0]) > -1);
  const project = pairs.filter((p) => CONTACT_KEYS.indexOf(p[0]) < 0);
  const email = o.replyTo || get('E-mail');
  const who = [get('Prénom'), get('Nom')].filter(Boolean).join(' ') || get('Nom') || email;
  const urgent = get('Urgent') === 'Oui';
  const logo = o.logoSrc || (site + '/Assets/img/logo-blanc.png');
  const kind = isContact ? 'Nouveau message' : 'Nouvelle demande de devis';

  return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>' +
    '<body style="margin:0;padding:0;background:#eef1f6;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + esc(kind + ' de ' + who) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6"><tr><td align="center" style="padding:28px 12px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dfe5f0">' +
    '<tr><td style="background:' + NIGHT + ';padding:26px 36px"><img src="' + esc(logo) + '" alt="CMR Personnalisation" height="44" style="display:block;height:44px;width:auto;border:0"></td></tr>' +
    '<tr><td style="background:' + BLUE + ';height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>' +
    '<tr><td style="padding:34px 36px 0">' +
      '<div style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:' + BLUE + '">' + kind + '</div>' +
      '<h1 style="margin:10px 0 0;font-size:26px;line-height:1.25;color:#0d1626;font-weight:700">' + esc(who) + '</h1>' +
      (get('Entreprise / association') || get('Entreprise') ? '<div style="margin-top:4px;font-size:15px;color:#6b7690">' + esc(get('Entreprise / association') || get('Entreprise')) + '</div>' : '') +
      (urgent ? '<div style="margin-top:14px"><span style="display:inline-block;padding:5px 12px;border-radius:999px;background:#fff1e6;color:#b45309;font-size:12px;font-weight:700">Demande urgente</span></div>' : '') +
    '</td></tr>' +
    block(isContact ? 'Message' : 'Projet', project) +
    block('Coordonnées', contact) +
    '<tr><td style="padding:30px 36px 8px">' +
      (email ? btn('mailto:' + email + '?subject=' + encodeURIComponent('Re: ' + subject), 'Répondre au client', true) : '') +
      (site ? btn(site + '/admin#/' + (isContact ? 'demandes' : 'demandes'), 'Ouvrir l’administration', false) : '') +
    '</td></tr>' +
    '<tr><td style="padding:22px 36px 30px"><div style="border-top:1px solid #e6eaf2;padding-top:16px;font-size:12px;line-height:1.6;color:#8a94ab">Message envoyé automatiquement depuis le site CMR Personnalisation. Répondre directement à cet e-mail écrit au client.</div></td></tr>' +
    '</table></td></tr></table></body></html>';
}

/* E-mail de confirmation envoyé au client après sa demande (aucun prix, ton humain). */
function renderConfirmation(o) {
  const site = (o.siteUrl || '').replace(/\/$/, ''), pairs = o.pairs;
  const get = (k) => { const p = pairs.find((x) => x[0] === k); return p ? p[1] : ''; };
  const prenom = get('Prénom') || get('Nom') || '';
  const isContact = !!o.isContact;
  const logo = o.logoSrc || (site + '/Assets/img/logo-blanc.png');
  const recap = isContact ? [] : [['Besoin', get('Besoin')], ['Produits', get('Produits')], ['Technique', get('Technique')], ['Quantité', get('Quantité')], ['Répartition', get('Répartition par produit / taille')], ['Date souhaitée', get('Date souhaitée')]].filter((p) => p[1]);
  const step = (n, t, d) => '<tr><td style="width:36px;vertical-align:top;padding:0 0 16px"><div style="width:28px;height:28px;border-radius:50%;background:' + BLUE + ';color:#fff;font-size:13px;font-weight:700;text-align:center;line-height:28px">' + n + '</div></td><td style="padding:2px 0 16px"><div style="font-size:14px;font-weight:700;color:#0d1626">' + t + '</div><div style="font-size:13px;line-height:1.55;color:#6b7690;margin-top:2px">' + d + '</div></td></tr>';
  return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>' +
    '<body style="margin:0;padding:0;background:#eef1f6;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">Bien reçu : nous étudions votre projet et revenons vers vous rapidement.</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6"><tr><td align="center" style="padding:28px 12px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dfe5f0">' +
    '<tr><td style="background:' + NIGHT + ';padding:26px 36px"><img src="' + esc(logo) + '" alt="CMR Personnalisation" height="44" style="display:block;height:44px;width:auto;border:0"></td></tr>' +
    '<tr><td style="background:' + BLUE + ';height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>' +
    '<tr><td style="padding:34px 36px 0">' +
      '<h1 style="margin:0;font-size:26px;line-height:1.3;color:#0d1626;font-weight:700">' + (prenom ? 'Merci ' + esc(prenom) + ', c’est bien reçu !' : 'Merci, c’est bien reçu !') + '</h1>' +
      '<p style="margin:14px 0 0;font-size:15px;line-height:1.65;color:#2b3550">' + (isContact ? 'Nous avons bien reçu votre message. Un membre de l’équipe CMR vous répond personnellement dès que possible.' : 'Nous avons bien reçu votre demande de devis. Notre équipe étudie votre projet et revient vers vous avec une proposition sur mesure.') + '</p>' +
    '</td></tr>' +
    (recap.length ? block('Votre demande', recap) : '') +
    (isContact ? '' : '<tr><td style="padding:28px 36px 0"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:' + BLUE + ';padding-bottom:14px">La suite</div><table role="presentation" cellpadding="0" cellspacing="0" width="100%">' +
      step(1, 'Étude de votre projet', 'Nous analysons vos besoins, vos visuels et la technique la plus adaptée.') +
      step(2, 'Proposition sur mesure', 'Vous recevez un devis personnalisé, sans minimum de commande.') +
      step(3, 'Validation et production', 'Une fois le devis validé, nous lançons la réalisation dans notre atelier.') +
    '</table></td></tr>') +
    '<tr><td style="padding:6px 36px 0"><p style="margin:0;font-size:14px;line-height:1.65;color:#2b3550">Une précision à nous apporter ? Répondez simplement à cet e-mail ou appelez-nous au <a href="tel:+33769829961" style="color:' + BLUE + ';text-decoration:none;font-weight:700">07 69 82 99 61</a>.</p></td></tr>' +
    '<tr><td style="padding:24px 36px 8px">' + (site ? btn(site + '/realisations', 'Voir nos réalisations', true) + btn(site + '/compte', 'Mon espace client', false) : '') + '</td></tr>' +
    '<tr><td style="padding:14px 36px 30px"><div style="border-top:1px solid #e6eaf2;padding-top:16px;font-size:12px;line-height:1.6;color:#8a94ab">CMR Personnalisation — 1 place de la gare, Clairoix, 60280 Compiègne<br>Vous recevez cet e-mail car vous avez effectué une demande sur notre site.</div></td></tr>' +
    '</table></td></tr></table></body></html>';
}
module.exports = { renderMail, renderConfirmation };
