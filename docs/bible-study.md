# Bíblia de estudo (âmbito Biblos)

> **État app :** as **références croisées (TSKe)** estão activas no painel de estudo do versículo.
> Strong / Sg1910 permanecem no ETL para trabalho posterior.

Recursos suportados na app:

| Recurso | ID | Uso |
|--------|-----|-----|
| Segond 21 | `s21` | Texto principal, áudio, offline, busca |
| Haïtienne 1998 | `ht98` | Texto (`/bibles/ht1998.json`) |
| Références croisées | TSKe | Painel « Référence croisée » (`/bible/study/tske/{USFM}.{ch}.json`) |
| Segond 1910 + Strong | `sg1910` | ETL local (não obrigatório no deploy) |
| Léxico Strong | H/G | ETL local (não obrigatório no deploy) |

## Gerar e incluir no deploy

O ficheiro `estudo-biblia-compilado.txt` **não** vai para o git. Extração local:

```bash
npm run bible:study:export
npm run bible:study:stage
```

- `data/bible/study/tske/` — **versionado** (necessário para Vercel/APK)
- `public/bible/study/` — gerado no `npm run build` via `stage-study-assets.mjs`
- `strong/` e `sg1910/` — locais / opcionais no stage

`npm run build` e `build:mobile` já correm o stage de study depois do S21.

## Licenças

- Sg1910 / TSKe: conforme as fontes MySword / concordance.bible referenciadas no compilado.
- Não incluir Nave, ISBE, LSG paralelo, interlinear ou outros módulos fora deste âmbito.
