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

**Historique / activity:** `biblos-activity-v1` (Preferences no APK) + sync `users/{uid}/activity/state` no mesmo `user-sync` — sobrevive a limpar o storage do browser com a mesma conta.

## Sécurité

Voir `firestore.rules` :

- **Lecture publique** : só `isPublished == true`
- **Create/update/delete** : só se `request.auth.token.admin == true` (custom claim)
- Contas anónimas **não** podem escrever nem ler rascunhos

## CMS editorial (`#admin`)

- URL : `https://…/#admin`
- Firebase Auth **e-mail / mot de passe** (compte éditeur criado na consola)
- **Autorização**: custom claim `admin: true` (obrigatório nas rules e em `requireEditorialUser`)
- UX extra: `VITE_CLEVENCODE_ADMIN_EMAIL` (link no Profil) — não substitui o claim
- Atribuir claim: `npm run firebase:set-editor-claim -- --email …` (service account local)
- Écritures : `upsertReadingPlan` / `deleteReadingPlan` après `requireEditorialUser()`
- Parser : `extractionArea` → `parsePlanExtraction` (Étape / Jour, sans IA)
- Liste admin : `onSnapshot` sur toute la collection ; app public : query `isPublished`

## Déploiement des règles

```bash
npm run firebase:set-editor-claim -- --email admin@example.com
npm run firebase:deploy-rules
```

Ne pas commiter `.env` ni service accounts ; variables : `VITE_FIREBASE_*` (voir `.env.example`).

## App Check

Opcional no cliente: `VITE_FIREBASE_APPCHECK_SITE_KEY` (reCAPTCHA v3).  
Só activar **enforcement** na consola Firebase depois da chave estar a funcionar (DEV usa debug token).
