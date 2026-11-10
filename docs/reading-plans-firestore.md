# Plans de lecture — Firestore (SSOT)

## Camadas (FDA)

| Camada | Caminho |
|--------|---------|
| Domain | `src/features/reading-plans/domain/` |
| Data | `src/features/reading-plans/data/` |
| Presentation | `src/features/reading-plans/presentation/` |

## Contrato `reading_plans/{id}`

- `title`, `description` (string)
- `isPublished` (boolean) — requête app : `where isPublished == true`
- `totalDays` (number)
- `etapes[]` : `{ order, name, jours: [{ numero, passage }] }`

## Offline-first

`initializeFirestore` + `persistentLocalCache` + `persistentMultipleTabManager`.
Boot : `warmupReadingPlansRepository()` (main.tsx, idle).

## Sécurité

Voir `firestore.rules` — lecture publique si `isPublished`.

## Déploiement des règles

```bash
firebase deploy --only firestore:rules
```

Ne pas commiter `.env` ; variables : `VITE_FIREBASE_*` (voir `.env.example`).
