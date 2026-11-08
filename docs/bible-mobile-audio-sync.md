# BiblosApp — Bible mobile UI & sync áudio–texto (piloto)

Documentação das alterações recentes na branch `develop` (nov. 2026): leitor mobile, navegação superior, play flutuante e teste de sincronismo com transcrição Gladia (Jean capítulo 1).

## Resumo

| Área | O que mudou |
|------|-------------|
| Navbar mobile | Altura uniforme em todas as secções (Accueil, Plan, Bible, Profil). Removida a faixa extra `bible-chrome-dock` / `has-bible-tools`. |
| Navegação topo | Livro e capítulo clicáveis (mesmo picker que o dock), setas de capítulo, estilo em pílula. |
| Menu | Hamburger + item « Recherche » (ícone + texto). |
| Play | Pilula `.bible-yv-audio-player` fixa acima da tab bar (`is-play-only`) ; expandida com barra + tempos na mesma faixa. |
| Texto | Título hero « Jean 3 » no corpo oculto no mobile; `padding-top` reservado para o header absoluto. |
| Sync áudio (teste) | Jean **JHN 1**: MP3 do capítulo + `1.transcript.json`; versículo activo segue `currentTime`. |

## Commits relevantes (develop)

1. **`e680ffc`** — Navegação livro/capítulo no topo; chips; menu hamburger.
2. **`1a79367`** — Play flutuante; navbar uniforme; passagem nav inferior só no plano (mobile).
3. **(seguinte)** — Piloto sync áudio–texto Jean 1 + documentação.

## Ficheiros principais

### UI / shell

- `src/App.tsx` — `mode-tabs` sem `has-bible-tools` / `bible-chrome-dock`.
- `src/components/BibleReaderView.tsx` — `narrowChrome`, `renderTopPassageNav()`, dock `is-floating` / `is-play-only`, integração sync.
- `src/index.css` — estilos pílula topo, FAB, `--bible-top-chrome`, `--bible-fab-lift`, `is-audio-active`.

### Sync áudio (piloto)

- `src/bibleChapterAudioSync.ts` — catálogo de capítulos com sync, fetch da transcrição, `buildVerseAudioCues()`, `verseAtTime()`.
- `public/s21-audio-sync/jhn/1.transcript.json` — export Gladia (segmentos `start` / `end` / `text`).
- `vite.config.ts` — plugin dev `s21-chapter-audio-dev`: serve `Jean_Chapitre_1.mp3` a partir do projeto audiobook (variável `S21_JHN1_MP3`).

### Projeto audiobook (externo)

Repositório: `C:\Users\Clevy\Projects\BibleAudioproject\bible-s21-audiobook`

```bash
# Transcrição Gladia (requer GLADIA_API_KEY no .env)
node src/cli.js transcribe --provider gladia --force \
  --file "output/43_John/audio/Chapitre complet/Jean/Jean_Chapitre_1.mp3"
```

Saída: `.../Jean/transcripts/Jean_Chapitre_1.{txt,srt,transcript.json}`

## Como testar o sync (local)

1. `npm run dev` no BiblosApp.
2. Abrir **Bible → Jean → capítulo 1**.
3. Tocar **Play** — deve carregar `/s21-audio-sync/jhn/Jean_Chapitre_1.mp3` (Vite dev) e `/s21-audio-sync/jhn/1.transcript.json`.
4. Durante a reprodução, o versículo activo fica com classe `is-audio-active` e scroll suave (`nearest`).

**MP3 em produção:** o JSON vai em `public/`; o MP3 em dev é lido do disco via Vite. Para build/APK, copiar o MP3 para `public/s21-audio-sync/jhn/` ou servir via CDN/Firebase Storage.

## Alinhamento versículos ↔ transcrição

- Gladia devolve **utterances** (frases), não versículos.
- `buildVerseAudioCues()` ignora o intro « Chapitre un », depois associa cada versículo S21 a um bloco de segmentos (normalização de texto + heurística gloutonne).
- É um **piloto**: pode haver deriva entre versículos; melhorias futuras: alinhamento por palavras, timestamps por versículo no pipeline audiobook, ou forçar leitura com marcadores de versículo no TTS.

## Variáveis / CSS mobile (`max-width: 860px`)

| Token | Uso |
|-------|-----|
| `--mobile-bottom-chrome` | Tab bar + safe-area |
| `--bible-audio-float-inset-x` | Margem esquerda do play (gutter + safe-area) |
| `--bible-audio-float-bottom` | Distância tab bar → FAB (`--bible-play-float-gap` 16px) |
| `--bible-audio-play-size` | Diâmetro do botão play (46px) |
| `--bible-fab-lift` | Reserva de scroll com pilula expandida (58px) |
| `--bible-dock-lift` | Padding inferior do texto |
| `--bible-top-chrome` | Altura do header livro/capítulo |
| `--bible-pick-lift` | Sheet picker até às tabs (sem faixa tools) |

## Plano de leitura

No mobile, o dock inferior com setas do **plano** mantém-se flutuante (`is-floating is-plan`). **Leitura livre:** dock `is-play-only` — só áudio; livro/capítulo e setas ficam no **topo** (nunca pílula « Jean 20 » no rodapé).

## Próximos passos sugeridos

- Copiar/script `stage-s21-chapter-audio.mjs` para mobile build.
- Estender `CHAPTER_SYNC_PACKS` com mais capítulos após transcrição.
- API ou Storage unificado (evitar path local no Vite).
- Refinar alinhamento (DTW / difflib no offline ou no servidor).
