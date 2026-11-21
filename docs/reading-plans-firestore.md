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
Boot : `warmupReadingPlansRepository()` + `pullPublishedReadingPlans()` (main.tsx, idle, se online).

**Catálogo:** cada snapshot publicado grava mirror em `localStorage` (`biblos-reading-plans-catalog-v1`).
Offline / erro rede → `useReadingPlansCatalog` serve o mirror (não fica vazio após 1.ª sync).
Snapshot vazio `fromCache` no APK **não** fecha como empty definitivo: mantém `hydrating`, força `pullPublishedReadingPlans()`, fallback mirror, UI empty com **Retry** (ver [apk-audio-plans-verify.md](./apk-audio-plans-verify.md)).

**Progresso:** `planProgress` em localStorage + sync `users/{uid}/planProgress` via `user-sync` quando há Auth (anónimo ou Google) + rede. Upgrade para conta existente: merge local → flush. Volta online: flush automático.

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
