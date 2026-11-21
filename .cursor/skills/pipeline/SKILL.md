---
name: pipeline
description: >-
  Validates and updates the development/build environment (Node, npm, Java,
  Gradle, Android SDK, PATH, JAVA_HOME, ANDROID_HOME) before any install, sync,
  or build. Use when running npm install, gradle, gradlew, npx cap, pod install,
  mobile:sync, APK builds, or configuring a new app/toolchain — never assume
  the environment is correct.
---

# pipeline.md — Pipeline de Ambiente e Builds (sempre atualizado)

Você é responsável por garantir que todo ambiente de desenvolvimento e toda ferramenta de build esteja corretamente configurada e na versão mais recente compatível antes de qualquer execução.

## Objetivo
Evitar erros repetidos de caminho, versão desatualizada ou configuração incorreta.  
Nunca execute comandos de build, install ou run sem antes validar e, se necessário, atualizar o ambiente.

## Regras Obrigatórias

1. **Verificação antes de qualquer comando**
   - Antes de rodar `npm install`, `gradle`, `npx cap`, `./gradlew`, `pod install` ou equivalente, confirme:
     - Versão atual da ferramenta (Node, npm, Java, Gradle, Android SDK, etc.).
     - Caminhos de ambiente (`PATH`, `JAVA_HOME`, `ANDROID_HOME`, `GRADLE_USER_HOME`, etc.).
   - Se a versão estiver desatualizada ou o caminho incorreto, **não execute** o comando principal.

2. **Atualização obrigatória quando necessário**
   - Se detectar versão antiga ou configuração incorreta:
     - Informe claramente o que está desatualizado.
     - Execute ou oriente a atualização primeiro (ex.: `npm install -g npm@latest`, ajuste de `JAVA_HOME`, limpeza de cache Gradle, etc.).
     - Só depois prossiga com o comando original.
   - Nunca assuma que o ambiente está correto.

3. **Memória de erros anteriores**
   - Mantenha consciência dos erros já cometidos neste projeto ou em projetos semelhantes (caminhos errados, versões antigas de Gradle/npm/Node, cache corrompido, `google-services.json` ausente, etc.).
   - Antes de repetir um fluxo que já falhou, verifique se a causa anterior foi corrigida.
   - Se o mesmo tipo de erro ocorrer novamente, pare e corrija a raiz em vez de apenas repetir o comando.

4. **Configurações mais atualizadas possíveis**
   - Prefira sempre as versões estáveis mais recentes compatíveis com o stack do projeto.
   - Para Node: respeite `engines` / `.nvmrc` / `packageManager` quando existirem; caso contrário, use Node LTS atual ou superior.
   - Para Gradle/Android: use a versão do Android Gradle Plugin e Gradle compatível e atual.
   - Documente brevemente qual versão está sendo usada quando fizer diferença.

5. **Fluxo padrão para novo app ou nova configuração**
   1. Verificar versões e caminhos do ambiente.
   2. Atualizar o que estiver desatualizado.
   3. Limpar caches problemáticos se houver histórico de erro (Gradle, npm, etc.).
   4. Só então executar install / sync / build.
   5. Se falhar, registrar a causa e corrigir antes de tentar novamente.

## Proibições
- Executar build ou install com versão ou caminho sabidamente incorreto.
- Repetir o mesmo comando que já falhou sem corrigir a causa.
- Ignorar arquivos de versão do projeto (`.nvmrc`, `packageManager`, `gradle-wrapper.properties`, etc.).
- Assumir configuração padrão do sistema sem verificar.

## Formato ao agir
- Sempre diga brevemente o que verificou e o que atualizou (ou por que não precisou).
- Se for parar para atualizar, explique o motivo em uma linha.
- Após sucesso, confirme que o ambiente está alinhado.

Siga estas regras em toda criação, configuração ou build de software. O objetivo é que erros de ambiente não se repitam.
