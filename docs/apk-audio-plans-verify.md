# Checklist APK — áudio background + planos

Verificação manual após rebuild do APK (`npm run build` + sync Capacitor + assemble).

## Pré-requisitos

- Mesmo `VITE_FIREBASE_PROJECT_ID` no build APK e na consola Firestore.
- Em Firestore: ≥1 documento `reading_plans` com `isPublished: true`.
- Android 13+: aceitar permissão de notificações quando pedido (Capawesome `POST_NOTIFICATIONS`).

## 1. Áudio em background (Capgo Media Session)

| Passo | Esperado |
|-------|----------|
| Abrir Bible → livro com áudio S21 → Play | Reprodução começa; notificação média aparece |
| Home / outra app / ecrã bloqueado | Áudio continua |
| Pause / play na notificação | HTMLAudio pausa / retoma |
| Skip −15s / +30s (ou seek) na notificação | Posição actualiza no leitor |
| Swipe / stop da notificação | Playback pára; FGS mediaPlayback termina |
| Voltar à app com áudio activo | Controlo flutuante reflecte estado |

Notas técnicas: engine = `HTMLAudioElement` no WebView; FGS = Capgo `MediaSessionService` (`foregroundServiceType=mediaPlayback`). `MainActivity.resumeWebViewForMedia` mantém timers em `onPause`.

## 2. Catálogo Plan (« Aucun plan disponible »)

| Passo | Esperado |
|-------|----------|
| Install limpa / limpar dados → abrir Plan | Hydrating (não empty definitivo) enquanto sync |
| Com planos publicados online | Lista aparece (espelho local gravado) |
| Offline após 1.ª sync com planos | Lista vem do mirror local |
| Empty real (0 publicados na rede) | Mensagem `plan.emptyPublishedHint` + botão **Réessayer** |
| Comparar web vs APK no mesmo projectId | Mesmos planos publicados |

Se a lista ficar vazia com Firebase configurado: ver log one-shot `[reading-plans] snapshot: docs=… mapped=…` (normalizer a rejeitar docs) e confirmar `isPublished: true` no projectId do APK.

## Rebuild rápido

```bash
npm run build
npx cap sync android
# depois assemble no Android Studio / Gradle
```
