-- =====================================================================
-- Fichier 5/5 (FACULTATIF) : best sellers demandés par Ayoub
-- À lancer APRÈS la première synchro des catalogues (les produits doivent exister).
-- Le catalogue s'ouvre sur « Best sellers », triés par rang croissant (1 = premier affiché).
--
-- ÉTAPE A : lancez d'abord l'APERÇU (requête 1) et vérifiez que chaque ligne désigne le bon produit.
--           Si un motif désigne trop de produits ou le mauvais, affinez-le dans les DEUX requêtes.
-- ÉTAPE B : lancez ensuite la MISE À JOUR (requête 2).
-- Chaque requête est autonome : vous pouvez les lancer séparément.
-- =====================================================================

-- REQUÊTE 1 : aperçu (aucune modification)
with b(rang, libelle, motif) as (values
  (1,  'Softshell / Gilet Oslo', '%oslo%'),
  (2,  'Rudolphe',               '%rudolph%'),
  (3,  'Québec',                 '%qu_bec%'),
  (4,  'Parka America',          '%america%'),
  (5,  'Sweat Urban',            '%urban%'),
  (6,  'Sweat Classica',         '%classica%'),
  (7,  'Polaire New Artic',      '%artic%'),
  (8,  'Polo Star',              'polo star%'),
  (9,  'Polo Wos',               'polo wos%'),
  (10, 'Polo Estrella',          'polo estrella%'),
  (11, 'T-shirt Stafford',       '%stafford%'),
  (12, 'Porte-clés Hornet',      '%hornet%')
)
select b.rang, b.libelle, p.modelcode, p.brand, p.nom
from b join public.roly_produits p on p.actif and p.nom ilike b.motif
order by b.rang, p.nom;

-- REQUÊTE 2 : application (mêmes motifs que ci-dessus)
with b(rang, libelle, motif) as (values
  (1,  'Softshell / Gilet Oslo', '%oslo%'),
  (2,  'Rudolphe',               '%rudolph%'),
  (3,  'Québec',                 '%qu_bec%'),
  (4,  'Parka America',          '%america%'),
  (5,  'Sweat Urban',            '%urban%'),
  (6,  'Sweat Classica',         '%classica%'),
  (7,  'Polaire New Artic',      '%artic%'),
  (8,  'Polo Star',              'polo star%'),
  (9,  'Polo Wos',               'polo wos%'),
  (10, 'Polo Estrella',          'polo estrella%'),
  (11, 'T-shirt Stafford',       '%stafford%'),
  (12, 'Porte-clés Hornet',      '%hornet%')
)
update public.roly_produits p
set bestseller = b.rang
from b
where p.actif and p.nom ilike b.motif;

-- Pour retirer un produit des best sellers :
--   update public.roly_produits set bestseller = null where modelcode = '...';
-- La table publique se met à jour toute seule (déclencheur).
-- La rubrique « Haute visibilité » est une catégorie, pas un produit : elle n'a pas de rang ici.
