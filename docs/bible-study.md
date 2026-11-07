# Bíblia de estudo (âmbito Biblos)

> **État app :** Strong 1910 et références croisées (TSKe) sont **désactivés** dans l’UI.
> Seuls **S21** et **HAT98** sont proposés. Scripts ETL conservés pour un travail ultérieur.

Recursos suportados na app:

| Recurso | ID | Uso |
|--------|-----|-----|
| Segond 21 | `s21` | Texto principal, áudio, offline |
| Haïtienne 1998 | `ht98` | Texto (`/bibles/ht1998.json`) |
| Segond 1910 + Strong | `sg1910` | Texto com etiquetas Strong (`/bible/study/sg1910/books/{USFM}.json`) |
| Léxico Strong | H/G | Definições ao tocar numa palavra (`/bible/study/strong/{H7225}.json`) |
| Références croisées | TSKe | Painel « Références » por versículo (`/bible/study/tske/{USFM}.{ch}.json`) |

## Gerar dados a partir do compilado

O ficheiro `estudo-biblia-compilado.txt` **não** vai para o git. Extração local:

```bash
node scripts/export-study-compilado.mjs "%USERPROFILE%\Downloads\estudo-biblia-compilado.txt"
node scripts/export-strong-lexicon.mjs "%USERPROFILE%\Downloads\estudo-biblia-compilado.txt"
node scripts/stage-study-assets.mjs
```

Saída:

- `data/bible/study/` (fonte)
- `public/bible/study/` (servido pela app)

## Licenças

- Sg1910 / TSKe: conforme as fontes MySword / concordance.bible referenciadas no compilado.
- Não incluir Nave, ISBE, LSG paralelo, interlinear ou outros módulos fora deste âmbito.
