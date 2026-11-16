-- =====================================================================
-- Fichier 4/5 : données de départ
--   1. Textes éditables du site (table contenus)  : reprennent les textes actuels des pages
--   2. Administrateurs                            : qui peut ouvrir /admin
-- À exécuter APRÈS 01, 02 et 03.
-- =====================================================================

-- 1. Textes éditables. Pour les deux mentions « Aucun minimum de commande », la valeur reste VIDE :
--    le site garde alors son texte d'origine (avec le gras). Remplissez-les depuis /admin pour les modifier.
insert into public.contenus (cle, valeur, groupe, libelle, multiligne) values
  ('contact.intro',
   'Une question, une idée, un besoin particulier ? Écrivez-nous : l''équipe CMR vous répond.',
   'Page Contact', 'Introduction de la page', true),
  ('devis.intro',
   'Répondez à quelques questions : nous préparons une proposition personnalisée, adaptée à votre besoin.',
   'Page Devis', 'Introduction de la page', true),
  ('devis.minimum',
   '',
   'Page Devis', 'Mention « Aucun minimum de commande »', false),
  ('realisations.intro',
   'Polos, sweats, softshells, t-shirts, vêtements haute visibilité, tabliers… découvrez quelques-unes de nos personnalisations réalisées dans l''atelier pour des entreprises, artisans et commerçants.',
   'Page Réalisations', 'Introduction de la page', true),
  ('realisations.minimum',
   '',
   'Page Réalisations', 'Mention « Aucun minimum de commande »', false),
  ('realisations.tarif',
   'Aucun tarif affiché : le prix dépend de la quantité et de la personnalisation. Chaque projet fait l''objet d''un devis.',
   'Page Réalisations', 'Mention sur les tarifs', true)
on conflict (cle) do nothing;

-- 2. Administrateurs : l'adresse doit correspondre à un compte créé ET confirmé (e-mail de confirmation cliqué).
--    Modifiez cette liste avant de lancer : une adresse par ligne, en minuscules.
insert into public.admins (email) values
  ('damien.miyouna@gmail.com')
  -- , ('cmr.personnalisation@gmail.com')   -- décommentez si le compte CMR doit aussi gérer le site
on conflict (email) do nothing;
