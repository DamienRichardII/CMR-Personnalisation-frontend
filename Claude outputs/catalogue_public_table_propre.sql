-- Catalogue public : remplace la vue "catalogue_public" (signalée en erreur par Supabase)
-- par une table propre, lisible par le public, sans aucune mention de fournisseur.
-- La table se met à jour toute seule à chaque synchro (déclencheur sur roly_produits).
-- À exécuter en une seule fois dans Supabase > SQL Editor > Run.

begin;

create table public.catalogue_public_new as select * from public.catalogue_public;
drop view public.catalogue_public;
alter table public.catalogue_public_new rename to catalogue_public;
alter table public.catalogue_public alter column ref set not null;
alter table public.catalogue_public add primary key (ref);
create index catalogue_public_rubrique_idx on public.catalogue_public (rubrique);
create index catalogue_public_genre_idx on public.catalogue_public (genre);
create index catalogue_public_best_idx on public.catalogue_public (best) where best is not null;
create index catalogue_public_couleurs_idx on public.catalogue_public using gin (couleurs);
create index catalogue_public_nom_idx on public.catalogue_public (nom, ref);

alter table public.catalogue_public enable row level security;
create policy "public lit catalogue propre" on public.catalogue_public for select to anon, authenticated using (true);
create policy "admin catalogue propre" on public.catalogue_public for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.catalogue_public to anon, authenticated;

create or replace function public.cmr_maj_catalogue_public() returns trigger language plpgsql set search_path = public as $$
declare r public.roly_produits; k text;
begin
  if TG_OP = 'DELETE' then
    delete from public.catalogue_public where ref = 'CMR-' || upper(substr(md5(OLD.modelcode), 1, 6));
    return OLD;
  end if;
  r := NEW; k := 'CMR-' || upper(substr(md5(r.modelcode), 1, 6));
  if r.actif and not (lower(coalesce(r.famille, '')) in ('bermudas', 'pantalons court') or r.nom ~* '(short|bermuda)') then
    insert into public.catalogue_public (ref, nom, image, genre, rubrique, tailles, coloris, nouveaute, description, composition, best, couleurs)
    values (k,
      btrim(regexp_replace(public.cmr_decode(r.nom), '\m(roly|jhk|stamina|wrk)\M\s*', '', 'gi')),
      split_part(r.image, ',', 1),
      case when r.enfant or r.genre = 'Enfant' then 'Enfant' when r.genre = 'Femme' then 'Femme' when r.genre = 'Homme' then 'Homme' else 'Mixte' end,
      case when r.nom ~* '(jogg|legg)' or lower(coalesce(r.famille, '')) in ('leggins', 'survêtements') then 'sport'
           when public.cmr_rubrique(r.famille) = 'autres' and (r.brand = 'stamina' or r.nom ~* '(gourde|porte-cl|bouteille|mug)') then 'accessoires'
           else public.cmr_rubrique(r.famille) end,
      r.tailles, r.coloris, r.nouveaute, public.cmr_clean_desc(r.description), public.cmr_decode(r.composition), r.bestseller, public.cmr_couleurs(r.coloris))
    on conflict (ref) do update set nom = excluded.nom, image = excluded.image, genre = excluded.genre, rubrique = excluded.rubrique, tailles = excluded.tailles,
      coloris = excluded.coloris, nouveaute = excluded.nouveaute, description = excluded.description, composition = excluded.composition, best = excluded.best, couleurs = excluded.couleurs;
  else
    delete from public.catalogue_public where ref = k;
  end if;
  return NEW;
end $$;
revoke execute on function public.cmr_maj_catalogue_public() from public, anon, authenticated;

create trigger roly_produits_maj_public after insert or update or delete on public.roly_produits
  for each row execute function public.cmr_maj_catalogue_public();

commit;
