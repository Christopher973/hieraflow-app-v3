# Hiéraflow - L’outil complet pour visualiser vos équipes

Visualisez et gérez facilement votre entreprise avec Hieraflow : trombinoscopes, organigrammes interactifs et back-office complet.

## Documentations

- [Documentation de l'API](https://documenter.getpostman.com/view/36446416/2sBXcBmguL)

## Stockage d'images (AWS S3 / MinIO)

La fonctionnalité d'avatar collaborateur est implémentée avec le SDK AWS S3 v3 et supporte :

- AWS S3 (mode SaaS)
- MinIO (mode On-Premise) via endpoint personnalisé

### Variables d'environnement

Configurer les variables suivantes :

- `S3_ENDPOINT` : vide pour AWS, URL MinIO pour On-Premise (ex: `http://localhost:9000`)
- `S3_REGION` : ex `us-east-1`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET_NAME` : ex `hieraflow-avatars`
- `S3_SIGNED_URLS_ENABLED` : `true` pour générer des URLs signées (recommandé en production)
- `S3_SIGNED_URLS_EXPIRES_IN` : durée de validité en secondes (ex: `900`)

### Bucket privé en production (URLs signées)

Pour un bucket AWS privé avec les 4 protections d'accès public activées :

- `S3_SIGNED_URLS_ENABLED=true`
- `S3_SIGNED_URLS_EXPIRES_IN=900`

L'application générera des URLs temporaires côté serveur lors des lectures d'avatars.

### Démarrage MinIO local

Un fichier `docker-compose.minio.yml` est fourni pour lancer MinIO et initialiser automatiquement le bucket.

```bash
docker compose -f docker-compose.minio.yml up -d
```

Console MinIO : `http://localhost:9001`

### Flux technique avatar (Server Action)

1. Formulaire CRUD collaborateur (`Input` type file)
2. Envoi `FormData` vers la Server Action `uploadCollaboratorAvatarAction`
3. Validation Zod (MIME + taille max 5MB)
4. Traitement Sharp (`resize` max 512px, conversion `webp`, compression qualité 82)
5. Upload dans S3/MinIO via `src/lib/storage.ts`
6. Mise à jour Prisma (`member.avatarKey`, reset `member.avatarUrl`)
7. Revalidation Next.js (`revalidatePath`) des pages concernées
