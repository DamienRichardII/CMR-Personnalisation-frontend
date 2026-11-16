# Migration CMR Personnalisation → nouveau projet Supabase

Nouveau projet : `https://llfxqzvdgvvrihxotwcs.supabase.co`
Ancien projet (non lu, injoignable depuis ma session) : `ruxyfdmhkxfsbhxwscom`

## Important : comment ce schéma a été fait

Je n'ai pas pu lire l'ancien projet. Le schéma est **reconstruit à partir du code du site** (admin, espace client, API devis, scripts de synchro). Je l'ai testé sur une base PostgreSQL locale (création, déclencheurs, droits anonyme / client / admin, stock, commandes, catalogue : tout passe). Trois points restent à vérifier chez vous, car je ne pouvais pas comparer avec l'ancienne base :

1. **Rubriques du catalogue** : les fonctions de classement (`cmr_rubrique`, `cmr_couleur`) sont réécrites à partir des noms de familles. Après la première synchro, lancez les requêtes de vérification en bas de `03_catalogue.sql` et comparez avec le site actuel.
2. **Best sellers** : la liste exacte de l'ancienne base n'est pas dans le code. `05_best_sellers.sql` la refait d'après les noms d'Ayoub, avec un aperçu à valider.
3. **Données existantes** (demandes de devis, commandes, comptes clients, fichiers, stock, produits publiés, réalisations) : **non migrées**. Le nouveau projet démarre vide. Si l'ancien projet est encore restaurable, dites-le-moi : je vous prépare l'export / import des données.

## Ordre d'exécution

### A. Fichiers SQL (Supabase > SQL Editor > New query > coller > Run), dans cet ordre

| Fichier | Contenu |
|---|---|
| `01_schema_site.sql` | administrateurs, clients, demandes de devis, messages, commandes, stock, produits publiés, réalisations, contenus, règles de sécurité (RLS), fonctions `is_admin`, `mes_demandes`, `mes_commandes`, `ajuster_stock` |
| `02_storage.sql` | espaces de stockage `devis-fichiers`, `client-fichiers`, `site-medias` et leurs règles |
| `03_catalogue.sql` | `roly_produits` (privée), `catalogue_public` (lue par le site), déclencheur de mise à jour, fonctions de nettoyage |
| `04_donnees_depart.sql` | textes éditables du site + liste des administrateurs (**modifiez les e-mails avant de lancer**) |
| `05_best_sellers.sql` | facultatif, après la première synchro |

### B. Réglages Authentication (Dashboard > Authentication)

- **URL Configuration > Site URL** : `https://www.cmrpersonnalisation.com`
- **Redirect URLs** : `https://www.cmrpersonnalisation.com/**` et `https://cmrpersonnalisation.com/**` (ajoutez `http://localhost:3000/**` seulement pour tester en local)
- **Sign In / Providers > Email** : « Confirm email » activé, longueur minimale du mot de passe : 8
- **Emails > Templates** : coller les 6 modèles du dossier `emails-supabase` (voir son `LISEZ-MOI.md`)
- **Attack Protection / Password security** : activer la protection contre les mots de passe compromis (selon votre offre Supabase, elle peut ne pas être disponible)
- **Emails > SMTP Settings** : à régler avec Resend si vous voulez sortir de la limite d'envoi du SMTP par défaut (Supabase limite fortement les e-mails d'authentification sans SMTP personnalisé)

### C. Clés à récupérer (Project Settings > API Keys)

- **Publishable key** (`sb_publishable_...`) : publique, va dans le code du site
- **Secret key** (`sb_secret_...`) ou, selon l'affichage, la clé **service_role** : **secrète**. Ne la collez jamais dans une conversation, ni dans Git, ni dans le site.

## Variables à modifier

### Vercel (Project cmr-personnalisation > Settings > Environment Variables, environnement Production)

| Variable | Valeur | Remarque |
|---|---|---|
| `SUPABASE_URL` | `https://llfxqzvdgvvrihxotwcs.supabase.co` | à **modifier** (ancienne URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | secret key / service_role du **nouveau** projet | à **modifier** |
| `RESEND_API_KEY` | inchangée | |
| `MAIL_TO` | inchangée (défaut : `cmr.personnalisation@gmail.com`) | |
| `MAIL_FROM` | inchangée | |
| `SITE_URL` | inchangée (défaut : `https://www.cmrpersonnalisation.com`) | |

Les variables ne s'appliquent qu'aux **nouveaux déploiements** : après modification, faites Deployments > ... > Redeploy.

### GitHub (dépôt CMR-Personnalisation-frontend > Settings > Secrets and variables > Actions)

| Secret | Valeur |
|---|---|
| `SUPABASE_URL` | `https://llfxqzvdgvvrihxotwcs.supabase.co` (à **modifier**) |
| `SUPABASE_SERVICE_ROLE_KEY` | secret key / service_role du **nouveau** projet (à **modifier**) |
| `ROLY_USERNAME`, `ROLY_PASSWORD` | inchangés (pensez à changer le mot de passe Roly, il avait été exposé) |
| `JHK_API_TOKEN` | inchangé (régénérez-le si possible, il avait été exposé) |

### Dans le code du site (pas une variable d'environnement)

Fichier `js/supabase-config.js` : remplacer l'URL par `https://llfxqzvdgvvrihxotwcs.supabase.co` et la clé par la **publishable key** du nouveau projet. Cette clé est publique par conception (la sécurité repose sur les règles RLS). Envoyez-la-moi si vous voulez que je modifie le fichier et que je vous donne les commandes git.

## Mise en route après les SQL

1. Faire les réglages B, mettre à jour les variables Vercel et GitHub, modifier `js/supabase-config.js`, puis commit + push (redéploiement).
2. GitHub > Actions > « Synchronisation catalogues (Roly + JHK) » > Run workflow : remplit `roly_produits` et, par déclencheur, `catalogue_public` (compter une à plusieurs dizaines de minutes).
3. Lancer les vérifications en bas de `03_catalogue.sql`, puis `05_best_sellers.sql` (aperçu, puis mise à jour).
4. Créer votre compte sur `/compte` avec l'adresse listée dans `04_donnees_depart.sql`, cliquer le lien de confirmation reçu, puis ouvrir `/admin`.
5. Tester : un envoi de formulaire devis (une ligne doit apparaître dans `demandes_devis` et un e-mail arriver), un envoi de formulaire contact, l'ajout d'une image dans l'admin (Médias), la création d'un compte client et le dépôt d'un fichier dans l'espace client.
6. Ancien projet : le garder en lecture quelques jours, puis le supprimer une fois tout vérifié.
