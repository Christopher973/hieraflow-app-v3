---
post_title: "Fiche technique de déploiement on-premise — Hieraflow"
author1: "Christopher"
post_slug: "deploy-on-premise-hieraflow"
microsoft_alias: "christopher"
featured_image: ""
categories: ["Deployment"]
tags: ["docker", "minio", "prisma", "nginx", "apache", "ssl", "on-premise"]
ai_note: "yes"
summary: "Guide pas-à-pas pour déployer Hieraflow on‑premise avec Docker, MinIO, reverse proxy TLS et migrations Prisma."
post_date: "2026-02-19"
---

**Objectif**: déployer l'application Hieraflow sur un serveur VPS (Ubuntu/Debian) en utilisant Docker Compose, exposer l'application sur `hieraflow.domaine.fr`, exposer MinIO sur `minio.hieraflow.domaine.fr` via un reverse-proxy TLS, et configurer le stockage d'avatars (bucket MinIO) pour que les URLs signées soient résolubles publiquement.

**Public cible**: administrateur système / administrateur infra du client.

Prérequis

- VPS Ubuntu/Debian 22.04+ avec accès root ou sudo
- Domaine(s) DNS configurés: `hieraflow.domaine.fr` et `minio.hieraflow.domaine.fr` pointant vers l'IP du VPS
- Docker & Docker Compose installés
- Token GHCR (personnel) fourni par l'équipe (utilisé pour `docker login`)
- Fichiers fournis par l'intégrateur: `docker-compose.yml` (template), `.env.template` (template) et instruction du token GHCR

Résumé des points appris précédemment (à prendre en compte)

- L'application génère les URLs S3 côté serveur en lisant `S3_ENDPOINT` au démarrage. Toute modification de `.env` nécessite un redémarrage du conteneur pour être prise en compte.
- Si `S3_ENDPOINT` pointe vers un nom interne Docker (ex: `http://minio:9000`), les URLs signées contiendront ce host — non résoluble depuis un navigateur externe -> erreur `net::ERR_NAME_NOT_RESOLVED`.
- Better‑Auth vérifie les origines ; `BETTER_AUTH_URL` doit correspondre au domaine public utilisé par le navigateur.
- MinIO doit être accessible via un nom public TLS (ou proxifié) pour que les objets signés soient chargeables côté client.
- Utiliser `forcePathStyle: true` et `endpoint` pour compatibilité MinIO côté application.

Étapes détaillées (ordre précis)

1. Préparer le serveur et dossiers

- Se connecter au VPS en SSH:

```bash
ssh root@IP_DU_SERVEUR
```

- Mettre à jour le système et installer dépendances minimales:

```bash
apt update && apt upgrade -y
apt install -y curl git apache2 certbot python3-certbot-apache
```

- Créer le dossier d'application recommandé:

```bash
mkdir -p /opt/hieraflow
cd /opt/hieraflow
```

2. Installer Docker / login GHCR

- Installer Docker (méthode officielle) si nécessaire:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl enable --now docker
rm get-docker.sh
```

- Installer docker compose plugin si absent (ex: `docker compose`):

```bash
apt install -y docker-compose-plugin
```

- Se connecter à GHCR pour tirer l'image privée (remplacez `TOKEN` par le token fourni):

```bash
echo "<GHCR_TOKEN>" | docker login ghcr.io -u <GHCR_USERNAME> --password-stdin
```

- Tirer l'image (nommage attendu: minuscule) :

```bash
docker pull ghcr.io/<owner>/hieraflow-v3:latest
```

3. Déposer les templates fournis

- Copier le `docker-compose.yml` et `.env.template` fournis dans `/opt/hieraflow` et renommer `.env`:

```bash
cp /chemin/vers/templates/docker-compose.yml /opt/hieraflow/docker-compose.yml
cp /chemin/vers/templates/.env.template /opt/hieraflow/.env
```

- Éditer `/opt/hieraflow/.env` et renseigner les valeurs (extraits essentiels) :

```
DATABASE_URL="mysql://user:password@host:3306/db"
BETTER_AUTH_SECRET="<secret>"
BETTER_AUTH_URL="https://hieraflow.domaine.fr"
NEXT_PUBLIC_APP_URL="https://hieraflow.domaine.fr"
S3_ENDPOINT="https://minio.hieraflow.domaine.fr"
S3_REGION="us-east-1"
S3_BUCKET="hieraflow-app"
S3_ACCESS_KEY_ID="minio-access-key"
S3_SECRET_ACCESS_KEY="minio-secret-key"
```

Important : utilisez le nom public (`minio.hieraflow.domaine.fr`) pour `S3_ENDPOINT`. Ne laissez pas `http://minio:9000` si vous voulez que les navigateurs résolvent les URLs signées.

4. Démarrer la stack Docker (MinIO inclus si présent dans `docker-compose`)

- Depuis `/opt/hieraflow` :

```bash
docker compose pull
docker compose up -d
docker compose ps
```

- Si vous avez séparé MinIO (ou l'exécutez via system service), assurez-vous que le service MinIO tourne avant d'initialiser l'app.

5. Créer le bucket MinIO et configurer les credentials

- Si MinIO est dans le même `docker-compose` ou local, utiliser `mc` (minio client) ou `docker exec` :

```bash
# si mc est installé localement
mc alias set localminio http://127.0.0.1:9000 minio-access-key minio-secret-key
mc mb localminio/hieraflow-app
mc policy set public localminio/hieraflow-app || true

# ou depuis le conteneur minio
docker compose exec minio sh -c "mc alias set localminio http://127.0.0.1:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD} && mc mb localminio/hieraflow-app"
```

Notes:

- Nous recommandons de laisser le bucket privé et d'utiliser des URLs signées pour l'accès public — c'est la configuration par défaut de l'application.
- Si vous activez une policy publique, adaptez la sécurité en conséquence.

6. Exposer l'application et MinIO via reverse-proxy TLS (Apache exemple)

Configuration recommandée : Apache (ou Nginx) en reverse-proxy sur 80/443 et proxy_pass vers `localhost:3000` (app) et vers MinIO interne.

- Exemple VirtualHost Apache pour Hieraflow (`/etc/apache2/sites-available/hieraflow.conf`):

```
<VirtualHost *:80>
    ServerName hieraflow.domaine.fr
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
    RewriteEngine On
    RequestHeader set X-Forwarded-Proto "http"
</VirtualHost>
```

- Exemple VirtualHost Apache for MinIO (`/etc/apache2/sites-available/minio.conf`):

```
<VirtualHost *:80>
    ServerName minio.hieraflow.domaine.fr
    ProxyPreserveHost On
    ProxyRequests Off
    ProxyPass / http://127.0.0.1:9000/
    ProxyPassReverse / http://127.0.0.1:9000/
    RequestHeader set X-Forwarded-Proto "http"
</VirtualHost>
```

- Activer modules et sites, tester config, recharger Apache :

```bash
a2enmod proxy proxy_http proxy_wstunnel headers rewrite ssl
a2ensite hieraflow.conf
a2ensite minio.conf
apache2ctl configtest
systemctl reload apache2
```

7. Obtenir certificats SSL avec Certbot

- Utiliser Certbot Apache plugin (certbot doit être installé) :

```bash
certbot --apache -d hieraflow.domaine.fr -d minio.hieraflow.domaine.fr
```

- Vérifier endpoints HTTPS :

```bash
curl -I https://hieraflow.domaine.fr
curl -I https://minio.hieraflow.domaine.fr/minio/health/ready
```

8. Vérifier et exécuter les migrations Prisma

- Si votre `docker-compose` contient un service `migrate` :

```bash
docker compose exec migrate sh -c "npx prisma migrate deploy"
```

- Sinon, exécuter depuis le conteneur application :

```bash
docker compose exec hieraflow sh -c "npx prisma migrate deploy"
```

9. Vérifications fonctionnelles

- Vérifier que l'application est UP :

```bash
docker compose ps
docker compose logs hieraflow --tail 200
```

- Dans le navigateur, accéder à `https://hieraflow.domaine.fr` et vous connecter. Tester l'upload d'avatar.
- Ouvrir DevTools → Network → vérifier l'URL de l'image renvoyée par l'API :
  - L'URL signée doit commencer par `https://minio.hieraflow.domaine.fr/...` et non par `https://minio:9000/...`.
  - Si vous voyez `minio:9000` → l'application utilise un `S3_ENDPOINT` interne : corriger `.env` et redémarrer le conteneur.

10. Commandes utiles de diagnostic

```bash
# Voir env prises par docker-compose
docker compose config | sed -n '1,200p' | grep -i s3_endpoint -n || true

# Recharger l'app après modification de .env
docker compose up -d --no-deps --force-recreate hieraflow

# Logs
docker compose logs -f hieraflow

# Tester accès direct proxy MinIO
curl -I https://minio.hieraflow.domaine.fr/minio/health/ready
```

11. Résolution des problèmes courants rencontrés précédemment

- Problème: `net::ERR_NAME_NOT_RESOLVED` pour `https://minio:9000/...`
  - Cause: URL signée utilise le host interne Docker `minio`. Solution: mettre `S3_ENDPOINT` sur le nom public (ex: `https://minio.hieraflow.domaine.fr`) et redémarrer `hieraflow`.

- Problème: Better‑Auth refuse l'origine (`Invalid origin`) lors de login
  - Cause: `BETTER_AUTH_URL` ne correspond pas au domaine public. Solution: dans `.env` mettre `BETTER_AUTH_URL="https://hieraflow.domaine.fr"` puis redémarrer.

- Problème: changements `.env` non pris en compte
  - Rappel: les variables d'environnement serveur sont lues au démarrage du conteneur. Toujours redémarrer / recréer le conteneur après modification.

- Problème: image non trouvée / tag en majuscule
  - Vérifier le nom d'image GHCR est en minuscules: `ghcr.io/<owner>/hieraflow-v3:latest`.

12. Procédure de mise à jour de production (quand nous annonçons une nouvelle version)

- Étapes succinctes à suivre pour mettre à jour l'instance en production :

1. Récupérer le nouveau token / valider que vous êtes connecté à GHCR :

```bash
echo "<GHCR_TOKEN>" | docker login ghcr.io -u <GHCR_USERNAME> --password-stdin
```

2. Pull de la nouvelle image :

```bash
cd /opt/hieraflow
docker compose pull
```

3. Mettre à jour la stack (recreate service et exécuter migrations) :

```bash
docker compose up -d --no-deps --force-recreate hieraflow
# si un service migrate est présent
docker compose exec migrate sh -c "npx prisma migrate deploy"
```

4. Vérifier logs et santé :

```bash
docker compose logs -f hieraflow --tail 200
curl -I https://hieraflow.domaine.fr
```

5. En cas de rollback demandé :

- Re-puller l'image précédemment validée et refaire `docker compose up -d --no-deps --force-recreate hieraflow`.

Consignes de sécurité et bonnes pratiques

- Ne stockez pas de tokens GHCR en clair dans le repo. Fournissez-les par canal sécurisé au client.
- Protégez les accès MinIO (ne pas rendre le bucket public si inutile). Préférez les URLs signées.
- Sauvegardez régulièrement la base MySQL (ou MariaDB) avec `mysqldump`.

Annexe — vérifications rapides

- `docker compose ps` → tous les services doivent être `Up` et `healthy`.
- `curl -I https://minio.hieraflow.domaine.fr/minio/health/ready` → `200 OK`.
- Vérifier qu'une URL d'avatar dans le navigateur commence par `https://minio.hieraflow.domaine.fr`.

Contact & support

- Si vous rencontrez une erreur bloquante, recueillez : `docker compose logs hieraflow --tail 500`, la valeur de `S3_ENDPOINT` dans `/opt/hieraflow/.env` et un exemple d'URL signée depuis le navigateur (Network tab). Envoyez ces éléments à l'équipe d'intégration.

Fichier(s) fournis par l'intégrateur (à inclure dans `/opt/hieraflow`)

- `docker-compose.yml` (template)
- `.env.template` → renommer en `.env` et ajuster

Fin de la fiche.
