# Biblos — instruções para o Claude

## Git em sessões cloud (Claude Code na web / app)

- **Enviar sempre diretamente para `master`** após cada commit, sem perguntar
  (autorização permanente do dono do repositório para sessões cloud).
- Também fazer push para a branch da sessão (`claude/...`).
- Antes de enviar: `git fetch origin master` e confirmar que é fast-forward
  (`git merge-base --is-ancestor origin/master HEAD`). Se o `master` tiver
  commits novos, **não** forçar nem reescrever histórico — parar e perguntar.
- Nunca `push --force` para `master`.

## Contexto do projeto

- Guia de engenharia: `.cursor/skills/biblos-app/SKILL.md` (arquitetura,
  scripts, regras). Comunicação com o utilizador em português.
- Testes relevantes: `npm run test:user-sync` (sync Firestore das atividades),
  `npm run test:study-nav`, `npm run test:s21-search`.
