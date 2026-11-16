-- =====================================================================
-- Fichier 3/5 : catalogue produits
--   roly_produits    : table BRUTE alimentée par les synchronisations (Roly, Stamina, JHK). PRIVÉE.
--                      (le nom est conservé car les scripts de synchro écrivent dedans)
--   catalogue_public : table PUBLIQUE lue par le site : aucun nom de fournisseur, aucune référence fournisseur.
--                      Tenue à jour automatiquement par un déclencheur sur roly_produits.
-- À exécuter APRÈS 01 et 02. Les produits arrivent ensuite par la synchro GitHub (voir NOTICE).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table brute (privée : aucun accès pour le public)
-- ---------------------------------------------------------------------
create table if not exists public.roly_produits (
  modelcode   text primary key,
  brand       text not null default 'roly' check (brand in ('roly', 'stamina', 'jhk')),
  nom         text not null,
  description text,
  composition text,
  observations text,
  genre       text,
  famille     text,
  cat_ids     jsonb not null default '[]'::jsonb,
  categories  jsonb not null default '[]'::jsonb,
  tailles     jsonb not null default '[]'::jsonb,
  coloris     jsonb not null default '[]'::jsonb,
  image       text,
  nouveaute   boolean not null default false,
  enfant      boolean not null default false,
  actif       boolean not null default true,
  bestseller  integer,
  maj         timestamptz not null default now()
);
create index if not exists roly_produits_brand_idx on public.roly_produits (brand, actif);
create index if not exists roly_produits_maj_idx on public.roly_produits (brand, maj);
alter table public.roly_produits enable row level security;

drop policy if exists "admin gere roly_produits" on public.roly_produits;
create policy "admin gere roly_produits" on public.roly_produits
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.roly_produits from anon, authenticated;
grant select, update on public.roly_produits to authenticated;  -- filtré par la politique admin

-- ---------------------------------------------------------------------
-- 2. Fonctions de nettoyage (reconstruites : voir la vérification en fin de fichier)
-- ---------------------------------------------------------------------

-- Décodage des entités HTML (&eacute; &amp; &#39; ...)
create or replace function public.cmr_decode(t text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare r text := t; m text[]; n integer; guard integer := 0;
begin
  if r is null then return null; end if;
  r := replace(r, '&nbsp;', ' ');
  r := replace(r, '&quot;', '"');
  r := replace(r, '&apos;', '''');
  r := replace(r, '&lt;', '<');
  r := replace(r, '&gt;', '>');
  r := replace(r, '&eacute;', 'é');  r := replace(r, '&Eacute;', 'É');
  r := replace(r, '&egrave;', 'è');  r := replace(r, '&Egrave;', 'È');
  r := replace(r, '&ecirc;', 'ê');   r := replace(r, '&euml;', 'ë');
  r := replace(r, '&agrave;', 'à');  r := replace(r, '&Agrave;', 'À');
  r := replace(r, '&acirc;', 'â');   r := replace(r, '&ocirc;', 'ô');
  r := replace(r, '&ucirc;', 'û');   r := replace(r, '&ugrave;', 'ù');
  r := replace(r, '&icirc;', 'î');   r := replace(r, '&iuml;', 'ï');
  r := replace(r, '&ccedil;', 'ç');  r := replace(r, '&Ccedil;', 'Ç');
  r := replace(r, '&oelig;', 'œ');   r := replace(r, '&deg;', '°');
  r := replace(r, '&rsquo;', '’');   r := replace(r, '&lsquo;', '‘');
  r := replace(r, '&laquo;', '«');   r := replace(r, '&raquo;', '»');
  r := replace(r, '&ntilde;', 'ñ');  r := replace(r, '&sup2;', '²');
  -- entités numériques décimales puis hexadécimales
  while r ~ '&#[0-9]+;' and guard < 500 loop
    guard := guard + 1;
    m := regexp_match(r, '(&#[0-9]+;)');
    n := case when length(m[1]) <= 10 then substring(m[1] from 3 for length(m[1]) - 3)::integer else 0 end;
    r := replace(r, m[1], case when n > 0 and n < 1114112 and not (n between 55296 and 57343) then chr(n) else '' end);
  end loop;
  while r ~* '&#x[0-9a-f]+;' and guard < 1000 loop
    guard := guard + 1;
    m := regexp_match(r, '(&#[xX][0-9a-fA-F]+;)');
    n := case when length(m[1]) <= 10 then ('x' || lpad(substring(m[1] from 4 for length(m[1]) - 4), 8, '0'))::bit(32)::integer else 0 end;
    r := replace(r, m[1], case when n > 0 and n < 1114112 and not (n between 55296 and 57343) then chr(n) else '' end);
  end loop;
  r := replace(r, '&amp;', '&');
  return r;
end $$;

-- Description publique : entités décodées, lignes « étiquette » supprimées, noms de fournisseurs retirés
create or replace function public.cmr_clean_desc(t text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(btrim(string_agg(l.line, E'\n' order by l.n), E'\n'), '')
  from (
    select btrim(regexp_replace(x.line, '\m(roly|jhk|stamina|wrk)\M\s*', '', 'gi')) as line, x.n
    from unnest(string_to_array(replace(public.cmr_decode(t), E'\r', ''), E'\n')) with ordinality as x(line, n)
  ) l
  where l.line <> '' and l.line !~* '(étiquette|etiquette)';
$$;

-- Rubrique du site (slug) à partir de la famille fournisseur et du nom du produit
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
    when f ~ '(porte.?cl|badge|lanyard)'                                               then 'cles'
    when f ~ '(stylo|papeterie|crayon|carnet|bloc|bureau|agenda)'                               then 'bureau'
    when f ~ '(usb|power ?bank|chargeur|écouteur|enceinte|bluetooth|batterie|high.?tech|technolog)'  then 'tech'
    when f ~ '(\msac|cabas|tote|besace|pochette|trousse|valise|bagage|banane)'                    then 'sacs'
    when f ~ '(casquette|bonnet|chapeau|\mbob\M|bandeau|écharpe|\mgant)'                              then 'casquettes'
    when f ~ '(sweat|polaire|hoodie|capuche|\mpull)'                                              then 'sweats'
    when f ~ '\m(t|tee)-?shirt'                                                                  then 'tshirts'
    when f ~ 'polo'                                                                             then 'polos'
    when f ~ '(veste|blouson|parka|softshell|gilet|manteau|coupe-vent|doudoune|imperm)'         then 'vestes'
    when f ~ '(chemise|chemisier)'                                                              then 'chemises'
    when f ~ '(travail|workwear|métier|metier|tablier|cuisine|médic|medic|santé|sante|combinaison|salopette|blouse)' then 'metiers'
    when f ~ '(sport|running|cyclis|fitness|legging|survêt|survet|training|maillot)'            then 'sport'
    when f ~ '(pantalon|\mjean|jogging)'                                                          then 'pantalons'
    -- repli sur le nom du produit quand la famille ne dit rien
    when n ~ '(sweat|polaire|hoodie)'                                                           then 'sweats'
    when n ~ '\m(t|tee)-?shirt'                                                                  then 'tshirts'
    when n ~ 'polo'                                                                             then 'polos'
    when n ~ '(veste|blouson|parka|softshell|gilet)'                                            then 'vestes'
    when n ~ 'chemise'                                                                          then 'chemises'
    when n ~ 'pantalon'                                                                         then 'pantalons'
    when n ~ '(casquette|bonnet)'                                                               then 'casquettes'
    else 'autres'
  end
  from s;
$$;

-- Familles de couleurs (filtre « Couleur » du catalogue) : un nom peut appartenir à plusieurs familles
create or replace function public.cmr_couleur(nom text)
returns text[]
language sql
immutable
set search_path = public
as $$
  with s as (select lower(coalesce(nom, '')) as n)
  select coalesce(array_remove(array[
    case when n ~ '(noir|black)' then 'Noir' end,
    case when n ~ '(blanc|white)' then 'Blanc' end,
    case when n ~ '(gris|anthracite|grey|gray|charcoal|argent)' then 'Gris' end,
    case when n ~ '(bleu|marine|navy|royal|ciel|turquoise|cyan|denim|azur|indigo|petrole|pétrole)' then 'Bleu' end,
    case when n ~ '(rouge|bordeaux|burgundy|cerise|(^|[^a-z])red([^a-z]|$))' then 'Rouge' end,
    case when n ~ '(vert|kaki|khaki|olive|menthe|sapin|bottle|green|lime|émeraude|emeraude)' then 'Vert' end,
    case when n ~ '(jaune|yellow|moutarde|citron|(^|[^a-z])or([^a-z]|$))' then 'Jaune' end,
    case when n ~ '(orange|abricot|corail)' then 'Orange' end,
    case when n ~ '(rose|fuchsia|pink|magenta)' then 'Rose' end,
    case when n ~ '(violet|mauve|lilas|prune|purple|lavande)' then 'Violet' end,
    case when n ~ '(marron|chocolat|brown|camel|café|cafe|taupe|chestnut|cognac|châtaigne)' then 'Marron' end
  ], null), '{}'::text[])
  from s;
$$;

-- Familles de couleurs d'un produit : somme de tous ses coloris
create or replace function public.cmr_couleurs(coloris jsonb)
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(distinct f order by f), '{}'::text[])
  from jsonb_array_elements(case when jsonb_typeof(coloris) = 'array' then coloris else '[]'::jsonb end) c,
       lateral unnest(public.cmr_couleur(c ->> 'nom')) f;
$$;

-- ---------------------------------------------------------------------
-- 3. Table publique lue par le site (aucune mention de fournisseur)
-- ---------------------------------------------------------------------
create table if not exists public.catalogue_public (
  ref         text primary key,
  nom         text not null,
  image       text,
  genre       text,
  rubrique    text,
  tailles     jsonb,
  coloris     jsonb,
  nouveaute   boolean,
  description text,
  composition text,
  best        integer,
  couleurs    text[]
);
create index if not exists catalogue_public_rubrique_idx on public.catalogue_public (rubrique);
create index if not exists catalogue_public_genre_idx on public.catalogue_public (genre);
create index if not exists catalogue_public_best_idx on public.catalogue_public (best) where best is not null;
create index if not exists catalogue_public_couleurs_idx on public.catalogue_public using gin (couleurs);
create index if not exists catalogue_public_nom_idx on public.catalogue_public (nom, ref);
alter table public.catalogue_public enable row level security;

drop policy if exists "public lit catalogue propre" on public.catalogue_public;
create policy "public lit catalogue propre" on public.catalogue_public
  for select to anon, authenticated using (true);
drop policy if exists "admin catalogue propre" on public.catalogue_public;
create policy "admin catalogue propre" on public.catalogue_public
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.catalogue_public from anon, authenticated;
grant select on public.catalogue_public to anon;
grant select, insert, update, delete on public.catalogue_public to authenticated;

-- ---------------------------------------------------------------------
-- 4. Déclencheur : chaque ajout / modification dans roly_produits met à jour la table publique
--    (shorts et bermudas exclus ; joggings et leggings classés dans Sport ; objets Stamina dans « Autres objets »)
-- ---------------------------------------------------------------------
create or replace function public.cmr_maj_catalogue_public()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r public.roly_produits; k text;
begin
  if TG_OP = 'DELETE' then
    delete from public.catalogue_public where ref = 'CMR-' || upper(substr(md5(OLD.modelcode), 1, 8));
    return OLD;
  end if;
  r := NEW;
  k := 'CMR-' || upper(substr(md5(r.modelcode), 1, 8));
  if r.actif and not (lower(coalesce(r.famille, '')) in ('bermudas', 'pantalons court') or r.nom ~* '(short|bermuda)') then
    insert into public.catalogue_public (ref, nom, image, genre, rubrique, tailles, coloris, nouveaute, description, composition, best, couleurs)
    values (
      k,
      btrim(regexp_replace(public.cmr_decode(r.nom), '\m(roly|jhk|stamina|wrk)\M\s*', '', 'gi')),
      split_part(r.image, ',', 1),
      case when r.enfant or r.genre = 'Enfant' then 'Enfant'
           when r.genre = 'Femme' then 'Femme'
           when r.genre = 'Homme' then 'Homme'
           else 'Mixte' end,
      case when r.nom ~* '(jogg|legg)' or lower(coalesce(r.famille, '')) in ('leggins', 'survêtements') then 'sport'
           when public.cmr_rubrique(r.famille, r.nom) = 'autres' and (r.brand = 'stamina' or r.nom ~* '(gourde|porte-cl|bouteille|mug)') then 'accessoires'
           else public.cmr_rubrique(r.famille, r.nom) end,
      r.tailles, r.coloris, r.nouveaute,
      public.cmr_clean_desc(r.description), public.cmr_decode(r.composition),
      r.bestseller, public.cmr_couleurs(r.coloris)
    )
    on conflict (ref) do update set
      nom = excluded.nom, image = excluded.image, genre = excluded.genre, rubrique = excluded.rubrique,
      tailles = excluded.tailles, coloris = excluded.coloris, nouveaute = excluded.nouveaute,
      description = excluded.description, composition = excluded.composition, best = excluded.best, couleurs = excluded.couleurs;
  else
    delete from public.catalogue_public where ref = k;
  end if;
  return NEW;
end $$;
revoke all on function public.cmr_maj_catalogue_public() from public, anon, authenticated;

drop trigger if exists roly_produits_maj_public on public.roly_produits;
create trigger roly_produits_maj_public
  after insert or update or delete on public.roly_produits
  for each row execute function public.cmr_maj_catalogue_public();

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- VÉRIFICATIONS à lancer APRÈS la première synchro (Run séparément) :
--
-- a) Répartition des rubriques (comparez avec le site actuel ; « autres » doit rester petit) :
--    select rubrique, count(*) from public.catalogue_public group by 1 order by 2 desc;
--
-- b) Familles fournisseur qui tombent en « autres » (à rattacher si besoin dans cmr_rubrique) :
--    select famille, brand, count(*) from public.roly_produits
--    where actif and public.cmr_rubrique(famille, nom) = 'autres' group by 1, 2 order by 3 desc;
--
-- c) Aucune mention de fournisseur :
--    select count(*) from public.catalogue_public
--    where nom ~* '(roly|jhk|stamina|wrk)' or description ~* '(roly|jhk|stamina|wrk|étiquette)';   -- attendu : 0
--
-- d) Couleurs : select unnest(couleurs) c, count(*) from public.catalogue_public group by 1 order by 2 desc;
-- ---------------------------------------------------------------------
