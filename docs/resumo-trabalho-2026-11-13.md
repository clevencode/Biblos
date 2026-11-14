# Resumo do trabalho — 13–14 de novembro de 2026

Registo do trabalho no **BiblosApp** (web / PWA / Capacitor Android).

**Intervalo recente (14/11):** `56008e0` → `e0aa414` em `origin/master`  
**Versão actual:** **0.2.7** · `versionCode` **6** · APK release assinado

---

## Visão geral (14/11)

| Área | Resultado |
|------|-----------|
| Persistência | Fase 1 híbrida Preferences ↔ localStorage; splash `local_ready` |
| Ícone | BookFill (coolicons) favicon / PWA / launcher / splash |
| Offline APK | Assets-first S21 + HT98 + TSKE (sem seed IndexedDB) |
| Estudo | Strong / sg1910 removidos; só TSKE |
| Banner web | Android → download APK (`VITE_APK_DOWNLOAD_URL`); iOS A2HS |
| Paleta | Tokens light/dark GitHub-like (hex semânticos) |
| Escala UI | `textZoom(100)`, viewport travado, rem 16px, touch 44px, sheets dvh/px |
| Release | Keystore upload + `npm run mobile:apk:release` |
| Update nativo | HEAD no APK R2 (ETag) → banner «Mettre à jour» |

---

## 1. Persistência híbrida + splash + chrome (56008e0)

| Tema | O que mudou |
|------|-------------|
| Prefs | `StorageAdapter` + mirror Preferences → localStorage no boot |
| Splash | Hide após `local_ready` (AppReadiness) |
| Chrome | Sem hide-at-scroll; pills do hub invertidas (ink/paper) |

**Ficheiros:** `StorageAdapter.ts`, `theme.ts`, `AppReadinessContext.tsx`, `BibleReaderView.tsx`, `index.css`.

---

## 2. Ícone oficial BookFill (9f8f741)

Geração via `scripts/generate-app-icons.mjs` → `public/` + mipmaps/splash Android.

---

## 3. APK assets-first (f8b20c9)

| Tema | Comportamento |
|------|----------------|
| S21 / HT98 / TSKE | Lidos de assets empacotados; sem escrita IDB no caminho crítico |
| Web | Banner instalar (depois evoluído para APK download) |
| Workbox | CacheFirst nas rotas de bíblia/estudo (web) |

---

## 4. Remoção Strong / sg1910 + banner APK web (4a4a68c)

| Tema | O que mudou |
|------|-------------|
| Estudo | Removidos `BibleStrongSheet`, `strongLexicon`, export Strong, CSS |
| Stage | Só TSKE no pipeline de estudo |
| Banner Android web | `usePwaInstall` modo `apk-download` (não A2HS / BIP CTA) |
| iOS | Mantém `ios-hint` |
| Limpeza | `firstInstallPack.ts` removido; chaves `install.banner*` mortas |
| Env | `VITE_APK_DOWNLOAD_URL` (ex. R2) em `.env.example` |

**Ficheiros:** `usePwaInstall.ts`, `InstallBanner.tsx`, `uiCopy.ts`, scripts stage/export.

---

## 5. Paleta UI + escala Chrome ↔ APK (50fe83e)

### Paleta (`src/index.css`)

| Token | Dark | Light |
|-------|------|-------|
| `--bg` / `--panel` | `#0D1117` | `#FFFFFF` |
| `--surface` | `#161B22` | `#F6F8FA` |
| `--elevated` | `#21262D` | `#EAEEF2` |
| `--line` | `#30363D` | `#D0D7DE` |
| `--text` | `#F0F6FC` | `#0D1117` |
| `--muted` | `#8B949E` | `#57606A` |

### Escala / touch / sheets

| Tema | Detalhe |
|------|---------|
| Android | `MainActivity` → `setTextZoom(100)` |
| Viewport | `maximum-scale=1.0, user-scalable=no, viewport-fit=cover` |
| CSS | `:root { font-size: 16px; text-size-adjust: 100% }` |
| Touch | Share close + word-search clear → `var(--mobile-touch, 44px)` |
| Sheets | Verse actions `min(48dvh, 340px)`; share `min(56dvh, 400px)` |
| Limpeza | Removido `--mobile-tab-min` órfão |

### Release assinado

| Item | Valor |
|------|--------|
| Script | `npm run mobile:apk:release` → `assembleRelease` |
| Keystore | `android/keystore/` + `key.properties` (**gitignored**) |
| Exemplo | `android/key.properties.example` |
| Output | `android/app/build/outputs/apk/release/Biblos.apk` |
| Backup | Cópia segura em Downloads (não no git) |

Hosting APK para utilizadores: **Cloudflare R2** + `VITE_APK_DOWNLOAD_URL` (sem Blaze Firebase Storage).

---

## 6. Update APK nativo via HTTP HEAD (e0aa414 · v0.2.7)

Só em `Capacitor.isNativePlatform()` + online.

```text
HEAD VITE_APK_DOWNLOAD_URL (cache: no-store)
  → ETag | Last-Modified | Content-Length
  → 1.ª abertura: grava biblos-apk-etag (sem banner)
  → depois: ETag ≠ salvo → banner .sw-update-banner
  → CTA Mettre à jour → Browser.open(url) + actualiza ETag
  → Plus tard → dismiss só na sessão
```

| Peça | Ficheiro |
|------|----------|
| Hook | `src/hooks/useApkUpdate.ts` |
| UI | `App.tsx` (prioridade: SW → APK update → InstallBanner web) |
| Plugin | `@capacitor/browser` |
| i18n | Reusa `swUpdate.*` + `auth.later` |

**CORS R2:** permitir `HEAD`/`GET` ao origin Capacitor (`https://localhost`).

**Versões bump:** `package.json` **0.2.7** · `versionCode` **6** · `versionName` **0.2.7**.

---

## 7. Commits recentes (14/11)

| Hash | Mensagem |
|------|----------|
| `56008e0` | Persistência híbrida fase 1, splash, chrome |
| `9f8f741` | Ícone BookFill oficial |
| `f8b20c9` | APK assets-first (sem IDB crítico) |
| `4a4a68c` | Banner APK web; remove Strong/sg1910/firstInstallPack |
| `50fe83e` | Release assinado + escala WebView + paleta |
| `e0aa414` | v0.2.7 HEAD update R2 + versionCode 6 |

*(O dia 13/11 mantém o histórico anterior: nav convex, auth, perfil, CMS, TSKE — commits `44c4bdb`…`a366b41`.)*

---

## 8. Smoke tests (estado actual)

| Área | Verificar |
|------|-----------|
| Web Android | Banner → download APK (URL R2 real, não fallback SPA) |
| APK 1.ª install | Sem banner update; ETag seed no `localStorage` |
| APK após novo upload R2 | Banner «Nouvelle version» → Browser → instalar por cima |
| Offline nativo | HEAD falha em silêncio |
| Escala | Fonte sistema Android não distorce chrome (textZoom 100) |
| Touch | Close share / clear search ≥ 44px |
| Assets | Leitura S21/HT98/TSKE sem rede no APK |

```bash
npm run mobile:apk:release
# Output: android/app/build/outputs/apk/release/Biblos.apk
# Subir ao R2 com o mesmo object key; actualizar VITE_APK_DOWNLOAD_URL se necessário
```

---

## 9. Follow-ups

- Configurar CORS HEAD no bucket R2  
- Custom domain R2 + rate limit (abuso de tráfego)  
- Garantir `VITE_APK_DOWNLOAD_URL` no CI / build nativo  
- Política Play Store (quando aplicável) vs sideload R2  

---

## Anexo — resumo 13/11 (ainda válido em parte)

Nav convex, auth Google persistente, perfil tabs, CMS planos admin, busca bundle S21, TSKE no deploy.  
**Obsoleto:** cartão «Installer» / `firstInstallPack` (removido em `4a4a68c`); Strong/Sg1910 (removidos).

---

*Actualizado após `e0aa414` (v0.2.7) — 14/11/2026.*
