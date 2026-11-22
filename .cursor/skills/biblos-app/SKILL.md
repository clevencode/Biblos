---
name: biblos-app
description: >-
  Engineering guidance for the Biblos Bible study app (Vite React, Capacitor
  Android, S21 offline, YouVersion, Firebase). Use when building or changing
  BiblosApp, Biblos, mobile APK, bible reader, offline S21, shell tabs Plan/Bible,
  or scripts bible:s21 / stage-bible-assets / mobile:sync.
---

# Biblos — engenharia do app

Skill de **criação e manutenção do produto**. Segurança de ficheiros de arquivo/áudio: skill `nao-destrutivo`. Pipeline ElevenLabs: skill `agentask`. Ambiente/builds: skill `pipeline`.

## Projecto

- App: `C:\Users\Clevy\Projects\BiblosApp` (npm name `biblos`)
- Android nativo relacionado: `C:\Users\Clevy\Projects\BiblosAndroid` (se necessário)
- Stack: Vite + React 19 + TypeScript, Capacitor 8, Firebase Auth, Vercel API
- Node `>=22.22.2`, npm `>=12`

## Arranque rápido

```text
cd C:\Users\Clevy\Projects\BiblosApp
npm run dev
npm run build
npm run mobile:sync
npm run mobile:apk
```

Scripts úteis: `bible:s21`, `bible:study:export`, `bible:study:stage`, `icons:generate`, testes `test:s21-search` / `test:study-nav`.

## Arquitectura (mapa)

| Área | Onde |
|------|------|
| UI shell / abas | `src/shellNav.ts`, `src/shellRadial.ts`, `src/App.tsx` |
| Leitor Bíblia | `src/components/`, `src/features/`, `src/bibleEngine.ts` |
| S21 offline | `src/bibleOffline.ts`, `src/offlineStorageGuard.ts`, `data/bible/s21/` |
| Ambiente/build | skill `pipeline` (validar Node/Java/Gradle antes de install/sync/APK) |
| Canon / YouVersion | `src/youversion/`, `src/bibleS21Canon.ts` |
| Áudio no app | `src/bibleAudioControls.ts`, `src/bibleNativeAudio.ts`, `src/bibleChapterAudio*` |
| API | `api/`, `src/apiBase.ts` |
| Assets build | `scripts/stage-bible-assets.mjs`, `scripts/stage-study-assets.mjs` |
| Conversão S21 | `scripts/convert-s21.mjs` → `data/bible/s21/books/*.json` + `manifest.json` |

## Dados bíblicos no app

- Formato livro: `{ version, book, usfm, bookId, title, chapters: [{ chapter, verses: [{ number, text }] }] }`
- Fonte MySword/export → `npm run bible:s21` (não editar JSON de livros à mão em massa)
- Offline-first: IndexedDB / preferências Capacitor; limpar slate só com confirmação explícita (`cleanSlate.ts`)

## Regras de engenharia

1. Mudanças mínimas e alinhadas ao código existente (componentes, tokens, i18n).
2. Abas principais: Plan e Bible (não reintroduzir shell antigo sem pedido).
3. **Nova arquitectura / módulo:** só o caminho canónico — sem legado, dual paths nem wrappers deprecated (ver skill `architecture`).
4. Mobile: `build:mobile` + `cap sync` antes de APK; não commitar `.env` / `google-services` secrets.
5. Não misturar pasta `Downloads\Archiv1\Bible` (arquivo pessoal) com o repo — só importar via scripts/`data/`.
6. Commits só quando o utilizador pedir; push a `master` só com pedido explícito.
7. Preferir português na comunicação com o utilizador.
8. **Bloco final git (manual):** após qualquer alteração de código/config no repo, terminar a resposta com um bloco pronto a copiar com `git add`, `git commit` e mensagem (assunto + corpo curto, foco no *porquê*). **Não** correr `git add` / `git commit` até pedido explícito. Se não houver mudanças no working tree, omitir o bloco.

### Formato do bloco git (fim da resposta)

```text
git add -A
git commit -m "$(cat <<'EOF'
<tipo>: <assunto em 1 linha>

<1–2 frases do porquê / impacto>
EOF
)"
```

No PowerShell (Windows), equivalente pronto a colar:

```text
git add -A
git commit -m @"
<tipo>: <assunto em 1 linha>

<1–2 frases do porquê / impacto>
"@
```

## Ao criar funcionalidade nova

1. Localizar o feature folder / componente existente.
2. Reutilizar `bibleEngine` / offline / YouVersion client em vez de parsers paralelos.
3. Se precisar de novo dataset: script em `scripts/` + stage no build.
4. Testar com os scripts `test:*` relevantes.
5. Documentar caminhos de dados tocados (para não confundir com `agentask` / arquivo).

## Fora de âmbito

- Geração ElevenLabs / Proverbes compile → `agentask`
- Apagar/restaurar ficheiros em Downloads → `nao-destrutivo`
- Validação de ambiente/build → `pipeline`
