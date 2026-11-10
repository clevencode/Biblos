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

## CMS editorial (`#admin`)

- URL : `https://…/#admin`
- Firebase Auth **e-mail / mot de passe** (compte éditeur créé dans la console)
- Écritures : `upsertReadingPlan` / `deleteReadingPlan` après `requireEditorialUser()`
- Parser : `extractionArea` → `parsePlanExtraction` (Étape / Jour, sans IA)
- Liste admin : `onSnapshot` sur toute la collection ; app public : query `isPublished`

## Déploiement des règles

```bash
firebase deploy --only firestore:rules
```

Ne pas commiter `.env` ; variables : `VITE_FIREBASE_*` (voir `.env.example`).
