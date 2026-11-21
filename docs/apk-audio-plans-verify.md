# Checklist APK — áudio background + planos

Verificação manual após rebuild do APK (`npm run mobile:apk` ou sync + assemble).

## Pré-requisitos

- Mesmo `VITE_FIREBASE_PROJECT_ID` no build APK e na consola Firestore.
- Em Firestore: ≥1 documento `reading_plans` com `isPublished: true`.
- Android 13+: aceitar permissão de notificações quando pedido (Capawesome `POST_NOTIFICATIONS`).

## 1. Áudio em background (mediagrid Native Audio)

Motor Android = **ExoPlayer / Media3** via `@mediagrid/capacitor-native-audio` + `AudioPlayerService` (`foregroundServiceType=mediaPlayback`). Web continua com `HTMLAudioElement`.

| Passo | Esperado |
|-------|----------|
| Abrir Bible → livro com áudio S21 → Play | Reprodução começa; notificação média aparece |
| Home / outra app / ecrã bloqueado | Áudio continua (decode nativo, não WebView) |
| Pause / play na notificação | Estado reflecte no float do leitor |
| Skip −15s / +30s na notificação | Posição actualiza |
| Stop / limpar notificação | Playback pára; FGS termina |
| Voltar à app com áudio activo | Controlo flutuante reflecte estado |
| Mudar de livro | Player reinicia na nova fonte HTTPS |

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
npm run mobile:apk
npm run mobile:install
# ou:
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb logcat -s Capacitor AudioPlayerService chromium
```
