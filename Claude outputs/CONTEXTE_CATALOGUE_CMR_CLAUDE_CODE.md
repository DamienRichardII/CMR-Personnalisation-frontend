# Contexte : catalogue CMR Personnalisation (pour Claude Code)

Projet : site statique (HTML/CSS/JS vanilla) déployé sur Vercel, base Supabase (`ruxyfdmhkxfsbhxwscom`), dépôt GitHub `DamienRichardII/CMR-Personnalisation-frontend`, branche `main` (push = déploiement).
Client : CMR Personnalisation. Développeur : Damien (DamCompany). Réponses en français, courtes.

## Règles du projet
- Changements chirurgicaux, zéro régression, mobile-first, aucun contenu inventé.
- **Aucun prix** sur le site (tout passe par `devis.html`).
- **Aucune mention du nom d'un fournisseur** (Roly, Stamina, JHK, Gor Factory, WRK) visible sur le site : ni dans les textes, ni dans les références, ni dans les données publiques.
- Ne jamais demander ni écrire de secret (mot de passe, token, clé `service_role`) dans le chat, dans Git ou dans le front.
- Les photos viennent des serveurs des fournisseurs et **ne doivent pas être modifiées** (droits d'usage, expirent le 31 décembre de chaque année).

## Architecture du catalogue (état actuel)
- `roly_produits` : table brute alimentée par les synchros (clé primaire `modelcode`, colonne `brand` = `roly` | `stamina` | `jhk`, colonne `bestseller` int). **Privée** : aucun accès `anon`/`authenticated` en lecture.
- `catalogue_public` : **vue** publique lue par `js/catalogue.js` via PostgREST (`/rest/v1/catalogue_public`). Colonnes : `ref` (`CMR-` + 6 caractères de md5(modelcode)), `nom`, `image`, `genre`, `rubrique`, `tailles`, `coloris`, `nouveaute`, `description`, `composition`, `best`, `couleurs`.
- Fonctions SQL : `cmr_decode` (entités HTML), `cmr_clean_desc` (retire lignes « étiquette » et mots Roly/JHK/Stamina/WRK), `cmr_rubrique(famille)`, `cmr_couleur(s)`.
- Synchros : `scripts/sync-roly.mjs` (marques `roly` + `stamina`), `scripts/sync-jhk.mjs`, workflow GitHub Actions « Synchronisation catalogues (Roly + JHK) » (lundi 03:17 UTC + manuel). Secrets dans GitHub, jamais dans le dépôt.
- Front : `catalogue.html`, `js/catalogue.js`, `css/catalogue.css` (+ `css/galerie.css`, encore utilisé). Filtres : public, couleur, rubrique ; « Best sellers » par défaut ; recherche sur nom + description.

## Tâche à réaliser
Supabase signale `public.catalogue_public` en **erreur de sécurité** (`security_definer_view`). Il ne faut plus d'erreur, tout en gardant :
- le catalogue **lisible par le public** (photos comprises),
- **aucune mention de fournisseur** dans les données publiques.

Solution retenue : remplacer la vue par une **table** `public.catalogue_public` (RLS : lecture publique, écriture admin via `is_admin()`), tenue à jour automatiquement par un **trigger** sur `roly_produits` (la même logique que la vue : exclusion des shorts/bermudas, rubriques, genre, nettoyage des textes, `ref` neutre, première URL d'image seulement). Les synchros n'ont rien à changer.

Le script complet est dans `catalogue_public_table_propre.sql` (une transaction). Pourquoi pas `security_invoker` sur la vue : il faudrait rouvrir la lecture de `roly_produits` au public, donc exposer `brand`, les catégories fournisseurs et les descriptions brutes.

Note : l'outil MCP `apply_migration` a expiré deux fois (confirmation non affichée chez l'utilisateur). Exécuter le script via le SQL Editor Supabase ou la CLI, avec accord de l'utilisateur pour le `drop view`.

## Vérifications après application
1. `select relkind from pg_class where relname = 'catalogue_public'` → `r` (table).
2. `select count(*) from catalogue_public` → ~2 148 (390 Roly + 1 551 Stamina + 230 JHK, moins shorts/bermudas).
3. En anonyme (clé publishable) : `GET /rest/v1/catalogue_public?limit=1` → 200 ; `GET /rest/v1/roly_produits?limit=1` → refusé.
4. Aucune mention : `select count(*) from catalogue_public where nom ~* 'roly|jhk|stamina|wrk' or description ~* 'roly|jhk|stamina|wrk|tiquette'` → 0.
5. Trigger : `update roly_produits set bestseller = bestseller where modelcode = '<un code>'` → la ligne reste présente dans `catalogue_public`.
6. `get_advisors` (security) : l'erreur `security_definer_view` a disparu.
7. Site : ouvrir `/catalogue` (ordinateur + mobile) → 17 best sellers au départ, filtres et fiche détaillée OK, aucune erreur console.

## Points ouverts (côté utilisateur)
- Changer le mot de passe Roly et mettre à jour le secret GitHub `ROLY_PASSWORD` (il avait été collé dans un chat).
- Régénérer le token JHK si possible.
- Supprimer la ligne « TEST casquette » dans l'admin « Produits du site ».
- Activer la protection contre les mots de passe compromis (Supabase > Authentication).
- Demander à Gor Factory / JHK les droits d'usage des photos, et des visuels sans étiquette de marque.
- Noms de produits parfois anglais/espagnols (Stamina) et avec des codes parasites (« S/S Black ») : nettoyage possible.

## Livraison
Après chaque étape : copier les fichiers modifiés dans le dossier du projet, puis donner à l'utilisateur les commandes PowerShell, une par ligne : `git add -A`, `git commit -m "..."`, `git push`.
