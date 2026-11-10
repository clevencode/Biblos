# Módulo: leitor áudio flutuante

| Campo | Valor |
|-------|--------|
| **ID** | `audio-float` |
| **Componente** | `BibleAudioFloat` |
| **Superfície** | Botão play/pause no dock + barra de progresso expansível |
| **Dono do estado** | `BibleReaderView` (elemento `<audio>`, sync S21) |

Áudio disponível principalmente para **Segond 21** (`canPlayBookAudio`). Controlos de transporte vivem no pai; o float é UI pura.

---

## Resumo

- **Repouso:** só botão play (`is-expanded` false, strip `inert`).
- **A reproduzir ou a seek:** strip visível com `range` + tempos.
- **Buffering:** spinner no botão (`deriveAudioViewState` → `status: "buffering"`).

Montado no `footer.bible-yv-dock` junto com navegação de plano (se `planReading`).

---

## Mapa de ficheiros

| Papel | Caminho |
|-------|---------|
| UI | `src/components/BibleAudioFloat.tsx` |
| ViewState | `src/bible/viewState/audioViewState.ts` |
| Sync capítulo | `src/bibleChapterAudioSync.ts` (e refs em `BibleReaderView`) |
| Doc produto | [bible-mobile-audio-sync.md](../bible-mobile-audio-sync.md) |

---

## Contrato (`BibleAudioFloatProps`)

| Prop | Origem típica |
|------|----------------|
| `hasAudio` | `canPlayBookAudio` |
| `playing` | estado `audioPlaying` |
| `busy` | `audioBusy` (buffer/load) |
| `currentTime` / `duration` | eventos `timeupdate` / metadata |
| `onTogglePlay` | `handleAudioTransport` |
| `onSeek` | `seekAudio(seconds)` |

Estado local: `seeking` + `seekValue` durante drag no range; sincroniza com `currentTime` quando não em seek.

---

## Comportamento UI

- `progressVisible = playing \|\| seeking` → classe `is-expanded` no contentor.
- Range: `--seek-progress` CSS custom property; `tabIndex` 0 só quando expandido.
- `formatAudioClock` — `m:ss` ou `h:mm:ss`.
- `disabled` no play se `!hasAudio \|\| busy`; range se sem duração ou não expandido.

---

## Integração no dock

Classes no `footer`:

- `is-playing` quando áudio activo
- `is-floating` em viewport compacta
- `is-play-only` leitura livre (sem nav de plano)
- `has-verse-actions` quando sheet de versículos aberto

`aria-hidden`/`inert` no dock em modo plano com chrome escondido.

---

## Acessibilidade

- `role="group"` `aria-label="Lecture audio"`
- Play: `aria-pressed`, label Pause/Lecture
- Range: `aria-valuenow/min/max`, `aria-controls` quando expandido
- Tempos decorativos `aria-hidden`

---

## Alterações seguras

- Ajustar expand/collapse CSS.
- Melhorar labels FR.

## Anti-padrões

- Lógica de fetch de áudio dentro do float — manter no leitor/repositório.
- Ignorar `busy` no seek durante load.

---

## Ligações

- [reader-surface.md](./reader-surface.md)
- [bible-mobile-audio-sync.md](../bible-mobile-audio-sync.md)
