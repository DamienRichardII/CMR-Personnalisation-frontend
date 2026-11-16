-- =====================================================================
-- Fichier 6 : correctif de classement des rubriques (à lancer APRÈS la synchro)
-- Problème constaté : ~1 080 objets tombaient dans « Autres objets » (stylos, sacs, bouteilles, porte-clés,
-- high-tech…) et des produits à nom espagnol / anglais (chaussures, pantalons, vestes) dans « autres ».
-- Correctif : quand la famille fournisseur ne suffit pas, on classe d'après le NOM du produit.
-- Les produits déjà bien classés par leur famille ne changent pas.
-- À coller dans le SQL Editor > Run (une seule fois). Dure quelques secondes.
-- =====================================================================

create or replace function public.cmr_rubrique(famille text, nom text default null)
returns text
language sql
immutable
set search_path = public
as $$
  with s as (select lower(coalesce(famille, '')) as f, lower(coalesce(nom, '')) as n)
  select case
    when f ~ '(haute? visibilit|alta visib|high.?vis)' or n ~ '(haute? visibilit|high.?vis)'      then 'hv'
    when f ~ '(bébé|bebe|baby|naissance)'                                                       then 'bebe'
    when f ~ '(chauss|basket|sandale|botte|sabot|claquette)'                                    then 'chaussures'
    when f ~ '(gourde|bouteille|mug|tasse|verre|thermos|isotherme|boisson|shaker)'              then 'boissons'
    when f ~ '(porte.?cl|badge|lanyard)'                                                        then 'cles'
    when f ~ '(stylo|papeterie|crayon|carnet|bloc|bureau|agenda)'                               then 'bureau'
    when f ~ '(usb|power ?bank|chargeur|écouteur|enceinte|bluetooth|batterie|high.?tech|technolog)' then 'tech'
    when f ~ '(\msac|cabas|tote|besace|pochette|trousse|valise|bagage|banane)'                  then 'sacs'
    when f ~ '(casquette|bonnet|chapeau|\mbob\M|bandeau|écharpe|\mgant)'                        then 'casquettes'
    when f ~ '(sweat|polaire|hoodie|capuche|\mpull)'                                            then 'sweats'
    when f ~ '\m(t|tee)-?shirt'                                                                 then 'tshirts'
    when f ~ 'polo'                                                                             then 'polos'
    when f ~ '(veste|blouson|parka|softshell|gilet|manteau|coupe-vent|doudoune|imperm)'         then 'vestes'
    when f ~ '(chemise|chemisier)'                                                              then 'chemises'
    when f ~ '(travail|workwear|métier|metier|tablier|cuisine|médic|medic|santé|sante|combinaison|salopette|blouse)' then 'metiers'
    when f ~ '(sport|running|cyclis|fitness|legging|survêt|survet|training|maillot)'            then 'sport'
    when f ~ '(pantalon|\mjean|jogging)'                                                        then 'pantalons'
    -- repli sur le nom du produit quand la famille ne dit rien (noms français, anglais ou espagnols)
    when n ~ '(chaussures|\mshoes?\M|zapat|botte)'                                              then 'chaussures'
    when n ~ '(bouteille|\mbottle\M|gobelet|\mmugs?\M|tasse|gourde|thermos|isotherme|shaker|verre)'     then 'boissons'
    when n ~ '(porte.?cl|keychain|key ring|lanyard|badge)'                                      then 'cles'
    when n ~ '(stylo|\mpen\M|ballpen|crayon|pencil|carnet|notebook|bloc|notes|papeterie|agenda|\mr[eè]gle)' then 'bureau'
    when n ~ '(chargeur|charger|câble|cable|\musb|power ?bank|écouteur|enceinte|speaker|bluetooth|lampe|souris|clé usb)' then 'tech'
    when n ~ '(\msac|backpack|trousse|necesser|cabas|tote|besace|banane|sacoche|pochette|valise|cartable)' then 'sacs'
    when n ~ '(casquette|bonnet|chapeau|\mcap\M|gorra)'                                         then 'casquettes'
    when n ~ '(sweat|polaire|hoodie|sudadera)'                                                  then 'sweats'
    when n ~ '(\m(t|tee)-?shirt|camiseta)'                                                      then 'tshirts'
    when n ~ 'polo'                                                                             then 'polos'
    when n ~ '(veste|blouson|parka|softshell|gilet|cazadora|chaqueta|chaleco|coupe-vent)'       then 'vestes'
    when n ~ '(chemise|camisa)'                                                                 then 'chemises'
    when n ~ '(salopette|\mmono\M|ignifug|combinaison|tablier)'                                 then 'metiers'
    when n ~ '(pantalon|pantal[oó]n)'                                                           then 'pantalons'
    else 'autres'
  end
  from s;
$$;

-- Recalcule la table publique pour tous les produits (le déclencheur se déclenche pour chaque ligne)
update public.roly_produits set maj = maj;

-- Vérification : nouvelle répartition
select rubrique, count(*) from public.catalogue_public group by 1 order by 2 desc;
