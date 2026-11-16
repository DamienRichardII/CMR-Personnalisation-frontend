-- =====================================================================
-- Fichier 2/5 : espaces de stockage (buckets) et leurs règles d'accès
--   devis-fichiers  : privé, fichiers joints aux demandes de devis (écrits par l'API avec la clé service_role)
--   client-fichiers : privé, un dossier par client (<id du client>/<fichier>), 10 Mo max
--   site-medias     : public (lecture par URL), images du site gérées depuis /admin, 5 Mo max
-- À exécuter APRÈS 01_schema_site.sql.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('devis-fichiers',  'devis-fichiers',  false, 10485760, null),
  ('client-fichiers', 'client-fichiers', false, 10485760, null),
  ('site-medias',     'site-medias',     true,   5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- devis-fichiers : lecture et suppression réservées aux administrateurs ----------
drop policy if exists "cmr admin lit devis-fichiers" on storage.objects;
create policy "cmr admin lit devis-fichiers" on storage.objects
  for select to authenticated
  using (bucket_id = 'devis-fichiers' and (select public.is_admin()));

drop policy if exists "cmr admin supprime devis-fichiers" on storage.objects;
create policy "cmr admin supprime devis-fichiers" on storage.objects
  for delete to authenticated
  using (bucket_id = 'devis-fichiers' and (select public.is_admin()));

-- ---------- client-fichiers : chaque client gère son propre dossier ----------
drop policy if exists "cmr client lit ses fichiers" on storage.objects;
create policy "cmr client lit ses fichiers" on storage.objects
  for select to authenticated
  using (bucket_id = 'client-fichiers'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

drop policy if exists "cmr client depose ses fichiers" on storage.objects;
create policy "cmr client depose ses fichiers" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'client-fichiers' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "cmr client supprime ses fichiers" on storage.objects;
create policy "cmr client supprime ses fichiers" on storage.objects
  for delete to authenticated
  using (bucket_id = 'client-fichiers'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

-- ---------- site-medias : écriture réservée aux administrateurs (la lecture par URL publique est libre) ----------
drop policy if exists "cmr admin lit site-medias" on storage.objects;
create policy "cmr admin lit site-medias" on storage.objects
  for select to authenticated
  using (bucket_id = 'site-medias' and (select public.is_admin()));

drop policy if exists "cmr admin ajoute site-medias" on storage.objects;
create policy "cmr admin ajoute site-medias" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site-medias' and (select public.is_admin()));

drop policy if exists "cmr admin modifie site-medias" on storage.objects;
create policy "cmr admin modifie site-medias" on storage.objects
  for update to authenticated
  using (bucket_id = 'site-medias' and (select public.is_admin()))
  with check (bucket_id = 'site-medias' and (select public.is_admin()));

drop policy if exists "cmr admin supprime site-medias" on storage.objects;
create policy "cmr admin supprime site-medias" on storage.objects
  for delete to authenticated
  using (bucket_id = 'site-medias' and (select public.is_admin()));
