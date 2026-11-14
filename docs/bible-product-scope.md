# Escopo do produto Biblos

## Incluído

- Textos : **Segond 21** (`s21`) et **Haïtienne 1998** (`ht98`)
- **TSKE** (références croisées) — cânon protestante (66 livros)
- Audio S21, marques locales, partage verset, historique de lecture local

## Backlog (não incluído)

- **Refs cruzadas deuterocanônicas** (Tobie, Sagesse, …) — ideia mapeada em [bible-study.md](./bible-study.md#backlog-ideia--refs-cruzadas-deuterocanônicas); exige fonte aparte do TSKe e wiring só com texto DC (HT98)

## Retiré du dépôt

- CMS Notion, plans, flashcards SRS, Firebase, onglets Accueil / Plan / Profil
- APIs : `catalog`, `notifications`, `description-sync` (conservées : `youversion`, `bible-audio`)

## Entrée

`App.tsx` monte uniquement `BibleReaderView`. Données utilisateur : `localStorage` (marques, thème, historique).
