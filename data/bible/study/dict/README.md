# Diksyonè Kreyòl Vilsen — dados para o leitor HT98

| Ficheiro | Conteúdo |
|----------|----------|
| `ht-vilsen.json` | 10 773 entradas `[id, lema, pos, gloss]` (sem o campo `raw`) |
| `ht-aliases.json` | Grafia HT98 → lema do dicionário (pares verificados à mão) |

## Fonte e direitos

- *Diksyonè Kreyòl Vilsen*, 3yèm edisyon — Féquière Vilsaint & Maude Heurtelou.
  © Educa Vision Inc. (1997, 2003, 2007, 2009), ISBN 978-1-58432-435-5. Todos os direitos reservados.
- Digitalização e OCR: repositório privado `clevencode/dicvilsen` (`data/entries.json`,
  ortografia IPN; os glosses podem conter ruído de OCR).
- Uso no Biblos decidido pelo mantenedor: app sem fins lucrativos, público restrito, sem
  indexação. A atribuição aparece em cada definição mostrada na app (`WordDefinitionSheet`).
  Qualquer mudança de distribuição (loja, uso comercial) exige rever esta decisão com o editor.

## Regenerar

```powershell
npm run dict:import
```

(Usa `gh api` sobre o repo privado; alternativa: `npm run dict:import -- --from ..\dicvilsen\data\entries.json`.)
O `stage-study-assets.mjs` copia esta pasta para `public/bible/study/dict/` no build.
