---
applyTo: "**"
---

# Guide de déploiement Docker sur VPS (Option C)

Ce guide détaille le déploiement de Hieraflow avec Docker sur un VPS Ubuntu, en utilisant MySQL installé localement sur le serveur.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        VPS Ubuntu                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Container Docker                       │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │         Hieraflow (Next.js 16)              │    │    │
│  │  │              Port 3000                      │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           MySQL (local sur VPS)                     │    │
│  │              Port 3306                              │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Apache (Reverse Proxy)                 │    │
│  │          Port 80/443 → localhost:3000               │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Prérequis

- VPS Ubuntu 22.04+ avec accès root
- Domaine configuré (ex: `hieraflow.votre-domaine.fr`)
- Accès SSH au serveur

---

# 2. Prérequis

- VPS Ubuntu/Debian 22.04+/16 avec accès root
- Domaine configuré (ex: `votre-domaine.fr`)
- Accès SSH au serveur

# 3. **Étapes dans l’ordre**

## **Étape 1 : Connexion et mise à jour**

```bash
ssh root@IP_DU_SERVEUR
apt update && apt upgrade -y
```

## **Étape 2 : Configuration du Swap pour allouer plus de mémoire (OPTONNEL)**

```bash
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' >> /etc/sysctl.conf
sysctl -p
free -h
```

## **Étape 3 : Installation d'Apache**

```bash
apt install apache2 -y
systemctl enable apache2
systemctl start apache2
a2enmod proxy proxy_http proxy_wstunnel headers rewrite ssl
systemctl restart apache2
```

## **Étape 4 : Installation de MariaDB**

```bash
apt install mariadb-server mariadb-client -y
systemctl enable mariadb
systemctl start mariadb
apt install mariadb-server mariadb-client -y
mariadb-secure-installation
```

## **Alternative à mariadb-secure-installation : Sécurisation manuelle de MariaDB**

```bash
mysql
```

```sql
-- Définir un mot de passe root (remplacez 'VotreMotDePasseRoot!')
ALTER USER 'root'@'localhost' IDENTIFIED BY 'VotreMotDePasseRoot!';

-- Supprimer les utilisateurs anonymes
DELETE FROM mysql.user WHERE User='';

-- Interdire la connexion root à distance
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');

-- Supprimer la base de test
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';

-- Appliquer les changements
FLUSH PRIVILEGES;

EXIT;
```

```bash
systemctl restart mariadb
```

## **Étape 5 : Installation de PHP et phpMyAdmin**

```bash
apt install php php-mysql php-mbstring php-zip php-gd php-json php-curl php-xml libapache2-mod-php -y
apt install phpmyadmin -y
ln -s /usr/share/phpmyadmin /var/www/html/phpmyadmin
```

## **Étape 6 : Installation de Git**

```bash
apt install git -y
git config --global user.name "Votre Nom"
git config --global user.email "votre@email.com"
ssh-keygen -t ed25519 -C "deploy@hieraflow"
cat ~/.ssh/id_ed25519.pub
# Ajouter cette clé à GitHub
ssh -T git@github.com
```

## **Étape 7 : Installation de Docker**

### Méthode recommandée : Script officiel Docker

Cette méthode est universelle et fonctionne sur toutes les versions de Debian/Ubuntu :

```bash
# Nettoyer les anciennes tentatives (si nécessaire)
rm -f /etc/apt/sources.list.d/docker.list
rm -f /etc/apt/keyrings/docker.gpg

# Télécharger et exécuter le script officiel Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Activer et démarrer Docker
systemctl enable docker
systemctl start docker

# Vérifications
docker --version
docker compose version

# Nettoyer le script
rm get-docker.sh
```

### Alternative : Installation manuelle (pour Debian stable uniquement)

Si vous êtes sur Debian 12 (bookworm) ou Ubuntu, vous pouvez utiliser cette méthode :

```bash
# Installer les prérequis
apt install -y ca-certificates curl gnupg

# Créer le répertoire pour les clés
install -m 0755 -d /etc/apt/keyrings

# Ajouter la clé GPG Docker
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Ajouter le dépôt Docker (détection automatique de la version)
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Mettre à jour et installer
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Activer Docker
systemctl enable docker
systemctl start docker

# Vérifications
docker --version
docker compose version
```

## **Étape 8 : Configuration du Firewall**

```bash
apt install ufw -y
ufw allow OpenSSH
ufw allow 'Apache Full'
ufw enable
ufw status
```

## **Étape 9 : Clonage du projet**

```bash
mkdir -p /apps
cd /apps
git clone git@github.com:repository_name.git .repository_name
cd repository_name
```

## **Étape 10 : Configuration de la base de données**

```sql
CREATE USER 'hieraflow_user'@'%' IDENTIFIED BY 'Azertyu.1';
CREATE USER 'hieraflow_user'@'localhost' IDENTIFIED BY 'Azertyu.1';
GRANT ALL PRIVILEGES ON *.* TO 'hieraflow_user'@'%' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON *.* TO 'hieraflow_user'@'localhost' WITH GRANT OPTION;
FLUSH PRIVILEGES;
EXIT;
```

## **Étape 11 : Configuration des variables d'environnement**

```bash
nano /apps/hieraflow/.env
```

```
DATABASE_URL="mysql://hieraflow_user:VotreMotDePasseFort123!@host.docker.internal:3306/db_hieraflow"
BETTER_AUTH_SECRET="DcdnWcdq1cIztXAu4xckLbMPnvYbidVc"
BETTER_AUTH_URL="https://votre-domaine.fr"
NEXT_PUBLIC_APP_URL="https://hieraflow.christopher-marie-angelique.fr"
```

## **Étape 12 : Build et démarrage Docker**

```bash
cd /apps/hieraflow
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f hieraflow
```

## **Étape 13 : Configuration Apache VirtualHost**

```bash
nano /etc/apache2/sites-available/hieraflow.conf
```

```
<VirtualHost *:80>
    ServerName hieraflow.votre-domaine.fr
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) "ws://127.0.0.1:3000/$1" [P,L]
    RequestHeader set X-Forwarded-Proto "http"
</VirtualHost>
```

```bash
a2ensite hieraflow.conf
a2dissite 000-default.conf
apache2ctl configtest
systemctl reload apache2
```

## **Étape 14 : Configuration SSL**

```bash
apt install certbot python3-certbot-apache -y
certbot --apache -d hieraflow.votre-domaine.fr
```

## **Étape 15 : Migrations Prisma**

```bash
docker compose exec hieraflow sh
npx prisma migrate deploy
exit
```

## 5. Commandes utiles

### Gestion du conteneur

```bash
# Voir les logs
docker compose logs -f

# Redémarrer le conteneur
docker compose restart

# Arrêter le conteneur
docker compose down

# Reconstruire et redémarrer
docker compose up -d --build

# Nettoyer les images non utilisées
docker system prune -af
```

### Mise à jour de l'application

```bash
cd /opt/apps/hieraflow

# Récupérer les dernières modifications
git pull origin main

# Reconstruire et redémarrer
docker compose up -d --build

# Exécuter les migrations si nécessaire
docker compose exec hieraflow npx prisma migrate deploy
```

### Backup de la base de données

```bash
# Créer un backup
mysqldump -u hieraflow_user -p db_hieraflow > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurer un backup
mysql -u hieraflow_user -p db_hieraflow < backup.sql
```

---

## 6. Dépannage

### Le conteneur ne démarre pas

```bash
# Vérifier les logs
docker compose logs hieraflow

# Vérifier que MySQL est accessible
docker compose exec hieraflow sh -c "nc -zv host.docker.internal 3306"
```

### Erreur de connexion à la base de données

1. Vérifier que MySQL écoute sur `0.0.0.0` :

   ```bash
   ss -tuln | grep 3306
   ```

2. Vérifier les credentials dans `.env`

3. Tester la connexion depuis le conteneur :
   ```bash
   docker compose exec hieraflow sh
   npx prisma db pull
   ```

### Problème de permissions

```bash
# Vérifier les permissions des fichiers
chown -R 1001:1001 /opt/apps/hieraflow
```

---
