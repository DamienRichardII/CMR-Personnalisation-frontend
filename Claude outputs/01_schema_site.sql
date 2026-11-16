-- =====================================================================
-- CMR Personnalisation : migration vers le nouveau projet Supabase
-- Fichier 1/5 : tables du site, règles de sécurité (RLS), fonctions
-- À coller dans Supabase > SQL Editor > New query > Run (une seule fois).
-- Ordre à respecter : 01, 02, 03, 04, (05 facultatif).
-- Schéma reconstruit à partir du code du site (admin, espace client, API devis).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Administrateurs : seuls les e-mails listés ici (et confirmés) ont accès à /admin
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.admins a
    join auth.users u on lower(u.email) = a.email
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admin gere admins" on public.admins;
create policy "admin gere admins" on public.admins
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- Clients (espace client) : une ligne par compte, créée automatiquement
-- ---------------------------------------------------------------------
create table if not exists public.clients (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  prenom      text,
  nom         text,
  entreprise  text,
  telephone   text,
  adresse     text,
  code_postal text,
  ville       text,
  created_at  timestamptz not null default now()
);
alter table public.clients enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.clients (id, email, prenom, nom, entreprise, telephone)
  values (
    new.id, new.email,
    nullif(btrim(new.raw_user_meta_data ->> 'prenom'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'nom'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'entreprise'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'telephone'), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.sync_client_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clients set email = new.email where id = new.id;
  return new;
end $$;
revoke all on function public.sync_client_email() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.sync_client_email();

-- Reprise des comptes déjà présents (vide sur un projet neuf)
insert into public.clients (id, email, prenom, nom, entreprise, telephone)
select u.id, u.email,
       nullif(btrim(u.raw_user_meta_data ->> 'prenom'), ''), nullif(btrim(u.raw_user_meta_data ->> 'nom'), ''),
       nullif(btrim(u.raw_user_meta_data ->> 'entreprise'), ''), nullif(btrim(u.raw_user_meta_data ->> 'telephone'), '')
from auth.users u
on conflict (id) do nothing;

drop policy if exists "client lit son profil" on public.clients;
create policy "client lit son profil" on public.clients
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists "client modifie son profil" on public.clients;
create policy "client modifie son profil" on public.clients
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists "admin gere clients" on public.clients;
create policy "admin gere clients" on public.clients
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- le client ne peut modifier que ces colonnes (pas son id ni son e-mail)
revoke all on public.clients from anon, authenticated;
grant select, delete on public.clients to authenticated;
grant update (prenom, nom, entreprise, telephone, adresse, code_postal, ville) on public.clients to authenticated;

-- ---------------------------------------------------------------------
-- Demandes de devis (insérées par l'API /api/devis avec la clé service_role)
-- ---------------------------------------------------------------------
create table if not exists public.demandes_devis (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  besoin         text,
  produits       text[] not null default '{}',
  technique      text,
  logo_existant  text,
  quantite       text,
  date_souhaitee date,
  urgent         boolean not null default false,
  description    text,
  prenom         text,
  nom            text,
  entreprise     text,
  email          text not null,
  telephone      text,
  ville          text,
  donnees        jsonb,
  fichiers       jsonb not null default '[]'::jsonb,
  statut         text not null default 'nouvelle'
                 check (statut in ('nouvelle', 'en_cours', 'devis_envoye', 'gagnee', 'perdue', 'archivee')),
  notes_internes text
);
create index if not exists demandes_devis_created_idx on public.demandes_devis (created_at desc);
create index if not exists demandes_devis_statut_idx on public.demandes_devis (statut);
create index if not exists demandes_devis_email_idx on public.demandes_devis (lower(email));
alter table public.demandes_devis enable row level security;

drop policy if exists "admin gere demandes" on public.demandes_devis;
create policy "admin gere demandes" on public.demandes_devis
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.demandes_devis from anon, authenticated;
grant select, insert, update, delete on public.demandes_devis to authenticated;  -- filtré par la politique admin ci-dessus

-- ---------------------------------------------------------------------
-- Messages du formulaire de contact
-- ---------------------------------------------------------------------
create table if not exists public.messages_contact (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nom        text,
  entreprise text,
  email      text not null,
  telephone  text,
  sujet      text,
  message    text not null,
  traite     boolean not null default false
);
create index if not exists messages_contact_created_idx on public.messages_contact (created_at desc);
alter table public.messages_contact enable row level security;

drop policy if exists "admin gere messages" on public.messages_contact;
create policy "admin gere messages" on public.messages_contact
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.messages_contact from anon, authenticated;
grant select, insert, update, delete on public.messages_contact to authenticated;

-- ---------------------------------------------------------------------
-- Commandes (référence automatique CMD-AAAA-0001, montant jamais montré au client)
-- ---------------------------------------------------------------------
create table if not exists public.commandes (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  reference             text unique,
  demande_id            uuid references public.demandes_devis (id) on delete set null,
  client_nom            text not null,
  entreprise            text,
  client_email          text,
  client_telephone      text,
  description           text not null,
  quantite              integer check (quantite is null or quantite >= 0),
  statut                text not null default 'a_lancer'
                        check (statut in ('a_lancer', 'en_production', 'pret', 'livre', 'annulee')),
  montant               numeric(12, 2) check (montant is null or montant >= 0),
  date_livraison_prevue date,
  paye                  boolean not null default false,
  notes                 text
);
create index if not exists commandes_created_idx on public.commandes (created_at desc);
create index if not exists commandes_email_idx on public.commandes (lower(client_email));
create index if not exists commandes_demande_idx on public.commandes (demande_id);
alter table public.commandes enable row level security;

create or replace function public.cmr_commande_reference()
returns trigger
language plpgsql
set search_path = public
as $$
declare an text := to_char(now(), 'YYYY'); n integer;
begin
  if new.reference is null or btrim(new.reference) = '' then
    perform pg_advisory_xact_lock(hashtext('cmr_commande_reference'));
    select coalesce(max((substring(reference from '(\d+)$'))::integer), 0) + 1 into n
    from public.commandes where reference like 'CMD-' || an || '-%';
    new.reference := 'CMD-' || an || '-' || lpad(n::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists commandes_reference on public.commandes;
create trigger commandes_reference before insert on public.commandes
  for each row execute function public.cmr_commande_reference();

drop policy if exists "admin gere commandes" on public.commandes;
create policy "admin gere commandes" on public.commandes
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.commandes from anon, authenticated;
grant select, insert, update, delete on public.commandes to authenticated;

-- ---------------------------------------------------------------------
-- Espace client : le client ne voit que SES demandes / commandes (rapprochées par e-mail confirmé)
-- ---------------------------------------------------------------------
create or replace function public.mes_demandes()
returns table (created_at timestamptz, statut text, besoin text, produits text[], quantite text, date_souhaitee date)
language sql
stable
security definer
set search_path = public, auth
as $$
  select d.created_at, d.statut, d.besoin, d.produits, d.quantite, d.date_souhaitee
  from public.demandes_devis d
  where lower(d.email) = (select lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null)
  order by d.created_at desc;
$$;
revoke all on function public.mes_demandes() from public, anon;
grant execute on function public.mes_demandes() to authenticated;

create or replace function public.mes_commandes()
returns table (reference text, statut text, description text, quantite integer, date_livraison_prevue date, created_at timestamptz)
language sql
stable
security definer
set search_path = public, auth
as $$
  select c.reference, c.statut, c.description, c.quantite, c.date_livraison_prevue, c.created_at
  from public.commandes c
  where lower(c.client_email) = (select lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null)
  order by c.created_at desc;
$$;
revoke all on function public.mes_commandes() from public, anon;
grant execute on function public.mes_commandes() to authenticated;

-- ---------------------------------------------------------------------
-- Stock
-- ---------------------------------------------------------------------
create table if not exists public.stock_items (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  nom           text not null,
  categorie     text,
  reference     text,
  couleur       text,
  taille        text,
  fournisseur   text,
  quantite      integer not null default 0 check (quantite >= 0),
  seuil_alerte  integer not null default 0 check (seuil_alerte >= 0),
  notes         text
);
create index if not exists stock_items_nom_idx on public.stock_items (nom);
alter table public.stock_items enable row level security;

create table if not exists public.stock_mouvements (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  item_id    uuid not null references public.stock_items (id) on delete cascade,
  delta      integer not null check (delta <> 0),
  motif      text,
  auteur     text
);
create index if not exists stock_mouvements_item_idx on public.stock_mouvements (item_id, created_at desc);
alter table public.stock_mouvements enable row level security;

drop policy if exists "admin gere stock" on public.stock_items;
create policy "admin gere stock" on public.stock_items
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admin lit mouvements" on public.stock_mouvements;
create policy "admin lit mouvements" on public.stock_mouvements
  for select to authenticated using ((select public.is_admin()));

revoke all on public.stock_items, public.stock_mouvements from anon, authenticated;
grant select, insert, update, delete on public.stock_items to authenticated;
grant select on public.stock_mouvements to authenticated;

-- Ajustement de stock : variation +/-, historique et auteur enregistrés, jamais de stock négatif
create or replace function public.ajuster_stock(p_item uuid, p_delta integer, p_motif text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare nouveau integer;
begin
  if not (select public.is_admin()) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'La variation ne peut pas être nulle.';
  end if;
  update public.stock_items set quantite = quantite + p_delta
  where id = p_item
  returning quantite into nouveau;
  if not found then
    raise exception 'Article introuvable.';
  end if;
  insert into public.stock_mouvements (item_id, delta, motif, auteur)
  values (p_item, p_delta, nullif(btrim(p_motif), ''), auth.jwt() ->> 'email');
  return nouveau;
exception when check_violation then
  raise exception 'Stock insuffisant : la quantité ne peut pas être négative.';
end $$;
revoke all on function public.ajuster_stock(uuid, integer, text) from public, anon;
grant execute on function public.ajuster_stock(uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------
-- Produits publiés depuis l'administration (page Réalisations / simulateur)
-- ---------------------------------------------------------------------
create table if not exists public.produits_publies (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  nom              text not null,
  categorie        text not null
                   check (categorie in ('t-shirts-polos', 'sweats', 'vestes-gilets', 'hautes-visibilites', 'travail', 'objets')),
  stock_item_id    uuid references public.stock_items (id) on delete set null,
  en_stock         boolean not null default true,
  description      text,
  caracteristiques text,
  coloris          text,
  image_url        text,
  image2_url       text,
  image3_url       text,
  simulateur       boolean not null default false,
  publie           boolean not null default false,
  ordre            integer not null default 0
);
create index if not exists produits_publies_ordre_idx on public.produits_publies (ordre, created_at);
alter table public.produits_publies enable row level security;

drop policy if exists "public lit produits publies" on public.produits_publies;
create policy "public lit produits publies" on public.produits_publies
  for select to anon, authenticated using (publie);
drop policy if exists "admin gere produits" on public.produits_publies;
create policy "admin gere produits" on public.produits_publies
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.produits_publies from anon, authenticated;
grant select on public.produits_publies to anon;
grant select, insert, update, delete on public.produits_publies to authenticated;

-- « En stock » / « Rupture » suit automatiquement l'article de stock lié
create or replace function public.cmr_en_stock_produit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stock_item_id is null then
    new.en_stock := true;
  else
    new.en_stock := coalesce((select quantite > 0 from public.stock_items where id = new.stock_item_id), true);
  end if;
  return new;
end $$;
revoke all on function public.cmr_en_stock_produit() from public, anon, authenticated;
drop trigger if exists produits_publies_en_stock on public.produits_publies;
create trigger produits_publies_en_stock before insert or update of stock_item_id on public.produits_publies
  for each row execute function public.cmr_en_stock_produit();

create or replace function public.cmr_maj_en_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.produits_publies set en_stock = (new.quantite > 0) where stock_item_id = new.id;
  return new;
end $$;
revoke all on function public.cmr_maj_en_stock() from public, anon, authenticated;
drop trigger if exists stock_items_maj_en_stock on public.stock_items;
create trigger stock_items_maj_en_stock after update of quantite on public.stock_items
  for each row when (old.quantite is distinct from new.quantite)
  execute function public.cmr_maj_en_stock();

-- ---------------------------------------------------------------------
-- Réalisations (cartes de la page Réalisations)
-- ---------------------------------------------------------------------
create table if not exists public.realisations (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  titre      text not null,
  sous_titre text,
  image_url  text,
  alt        text,
  publie     boolean not null default false,
  ordre      integer not null default 0
);
create index if not exists realisations_ordre_idx on public.realisations (ordre, created_at);
alter table public.realisations enable row level security;

drop policy if exists "public lit realisations" on public.realisations;
create policy "public lit realisations" on public.realisations
  for select to anon, authenticated using (publie);
drop policy if exists "admin gere realisations" on public.realisations;
create policy "admin gere realisations" on public.realisations
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.realisations from anon, authenticated;
grant select on public.realisations to anon;
grant select, insert, update, delete on public.realisations to authenticated;

-- ---------------------------------------------------------------------
-- Contenus éditables (textes du site modifiables depuis /admin)
-- ---------------------------------------------------------------------
create table if not exists public.contenus (
  cle        text primary key,
  valeur     text not null default '',
  groupe     text not null,
  libelle    text not null,
  multiligne boolean not null default false
);
alter table public.contenus enable row level security;

drop policy if exists "public lit contenus" on public.contenus;
create policy "public lit contenus" on public.contenus
  for select to anon, authenticated using (true);
drop policy if exists "admin gere contenus" on public.contenus;
create policy "admin gere contenus" on public.contenus
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.contenus from anon, authenticated;
grant select on public.contenus to anon;
grant select, insert, update, delete on public.contenus to authenticated;

notify pgrst, 'reload schema';
