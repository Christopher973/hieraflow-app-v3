---
applyTo: "**"
---

# Déploiement Dockerisé de l'Application Hiéraflow sur un VPS Debian

## Rôle et Contexte :

Tu es un Ingénieur DevOps Senior et un Architecte Cloud expert, spécialisé dans la conteneurisation (Docker), l'écosystème JavaScript/TypeScript (Next.js 16, Prisma 7) et l'administration de serveurs Linux (Debian, Apache).
Je dois préparer et déployer une application web en production sur un VPS Debian. Le serveur VPS possède déjà Apache, MariaDB et phpMyAdmin configurés et fonctionnels sur l'hôte.

Stack Technique et Infrastructure :

Frontend/Backend : Next.js 16 (App Router)

Base de données : MySQL (utilise l'instance MariaDB de l'hôte)

ORM : Prisma 7

Stockage S3 : MinIO (doit tourner en local sur le VPS via Docker)

Conteneurisation : Docker et Docker Compose

Domaines : domaine.fr (pour l'application) et s3.domaine.fr (pour l'API MinIO).

## Contraintes strictes de déploiement :

Sécurité du code : Le code source ne doit pas être présent sur le VPS. Seule l'image Docker pré-compilée doit y être déployée.

Registre privé : L'image est hébergée sur GitHub Container Registry (GHCR) en privé.

MinIO et URLs signées : MinIO tourne sur le VPS. Puisque l'application génère des URLs signées (S3_SIGNED_URLS_ENABLED=true), l'API MinIO doit être accessible publiquement de manière sécurisée (SSL).

Certificats SSL : Tout le trafic public doit être chiffré (HTTPS) en utilisant Apache comme reverse proxy et Let's Encrypt (Certbot).

## Actions Requises (Agis étape par étape et justifie tes choix architecturaux) :

Création du Dockerfile : Rédige un Dockerfile multi-stage optimisé pour Next.js 16 (standalone) et Prisma. Inclus la génération du client Prisma. Comment gérer les variables d'environnement au moment du build vs au runtime ?

Authentification GHCR & Docker Compose : - Fournis la commande pour s'authentifier à GHCR sur le VPS avec un Token (PAT).

Rédige le fichier docker-compose.yml de production incluant le service Next.js (tiré depuis GHCR) et le service MinIO. Configure correctement les réseaux pour que Next.js puisse parler à MariaDB sur l'hôte et à MinIO.

Stratégie de Migration Prisma : Explique la méthode la plus propre pour exécuter npx prisma migrate deploy en production directement depuis l'image compilée, sans avoir le code source sur le serveur VPS. Donne la commande exacte.

Configuration Apache & SSL : Fournis les configurations VirtualHost Apache (.conf) pour :

Rediriger le trafic de domaine.fr vers le conteneur Next.js.

Rediriger le trafic de s3.domaine.fr vers l'API du conteneur MinIO.

Explique brièvement comment générer les certificats SSL avec Certbot pour ces domaines.

Script de Déploiement : Rédige un script bash (deploy.sh) pour le VPS qui automatise la mise à jour (pull de la dernière image GHCR, exécution des migrations Prisma, redémarrage propre via docker-compose sans downtime si possible).

Utilise un ton technique, sois exhaustif sur la sécurité, et fournis des blocs de code clairs.
