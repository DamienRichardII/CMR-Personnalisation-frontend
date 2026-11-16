-- =====================================================================
-- Best sellers demandés par Ayoub (version corrigée d'après les noms réels du catalogue)
-- Attendu : 17 produits (les versions Femme comptent avec les versions Homme).
-- Le catalogue s'ouvre sur « Best sellers », triés par rang croissant (1 = premier affiché).
-- À coller dans le SQL Editor > Run (tout le fichier d'un coup).
-- Non trouvé dans le catalogue : « Sweat Classica » (aucun produit de ce nom) et « Haute visibilité »
-- (c'est une rubrique, pas un produit).
-- =====================================================================

-- 1. Remise à zéro de l'ancienne sélection
update public.roly_produits set bestseller = null where bestseller is not null;

-- 2. Nouvelle sélection
with b(rang, motif) as (values
  (1,  'gilet oslo%'),                     -- Gilet Oslo (+ Femme) : à confirmer avec Ayoub (« Softshell Oslo »)
  (2,  '%rudolph%'),                       -- Softshell Rudolph
  (3,  '%quebec%'),                        -- Softshell Quebec
  (4,  'parka america%'),                  -- Parka America (+ Femme)
  (5,  'sweatshirt à capuche urban%'),     -- Sweat Urban (+ Femme)
  (7,  'veste new artic%'),                -- New Artic (+ Femme)
  (8,  'polo star%'),                      -- Polo Star (+ Femme)
  (9,  'polo wos%'),                       -- Polo Wos
  (10, '%estrella%'),                      -- Polo Estrella (+ Femme)
  (11, 't-shirt stafford%'),               -- T-shirt Stafford
  (12, 'porte-clés hornet%')               -- Porte-clés Hornet
)
update public.roly_produits p
set bestseller = b.rang
from b
where p.actif and p.nom ilike b.motif;

-- 3. Contrôle (la table publique est mise à jour automatiquement)
select best, nom, rubrique from public.catalogue_public where best is not null order by best, nom;
