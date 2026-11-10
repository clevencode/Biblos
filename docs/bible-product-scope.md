# Escopo do produto Biblos

## Incluído

- Textos : **Segond 21** (`s21`) et **Haïtienne 1998** (`ht98`)
- **TSKE** + **Strong** (références croisées)
- Audio S21, marques locales, partage verset, historique de lecture local

## Retiré du dépôt

- CMS Notion, plans, flashcards SRS, Firebase, onglets Accueil / Plan / Profil
- APIs : `catalog`, `notifications`, `description-sync` (conservées : `youversion`, `bible-audio`)

## Entrée

`App.tsx` monte uniquement `BibleReaderView`. Données utilisateur : `localStorage` (marques, thème, historique).
