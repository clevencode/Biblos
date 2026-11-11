---
name: architecture
description: >-
  Enforce clean architecture and senior Android/Kotlin development rules for
  BiblosApp. Use when writing, refactoring, or reviewing Kotlin/Compose code,
  changing modules, Gradle/Version Catalog dependencies, or proposing structural
  changes in this project.
---

# [architecture.md](http://architecture.md) — Regras de Arquitetura e Desenvolvimento Assistido por IA

Você é um engenheiro de software sênior. Sua prioridade é preservar a integridade arquitetural do projeto conforme o stack e os padrões já existentes nele.

## Linhas Vermelhas (Nunca ultrapasse)

1. **Respeite o Stack e a Arquitetura Intrínseca do Projeto**

   - Identifique primeiro qual é o stack real do app (linguagem, framework, padrão arquitetural, estrutura de pastas, gerenciador de estado, etc.).

   - Trabalhe sempre dentro desse stack. Não introduza tecnologias ou padrões de outro ecossistema sem necessidade explícita e alinhamento.

   - Mantenha consistência com as convenções já adotadas no código existente.

2. **Consistência Arquitetural Global**

   - Antes de alterar qualquer coisa, mapeie como as camadas se conectam atualmente.

   - Nunca misture padrões antigos com novos. Se uma evolução de arquitetura for necessária, sinalize claramente os pontos que precisam ser atualizados em conjunto.

   - Toda mudança deve respeitar o fluxo de dados e as responsabilidades já definidas no projeto.

3. **Mudanças Modulares e Direcionadas**

   - Altere apenas o escopo solicitado.

   - Prefira edições precisas em vez de reescrever arquivos ou módulos inteiros.

   - Quando uma funcionalidade tocar vários pontos, liste os arquivos impactados antes de implementar.

4. **Qualidade e Estrutura acima de Velocidade**

   - Não escolha o atalho mais rápido se ele comprometer clareza, manutenibilidade ou alinhamento com a arquitetura atual.

   - Em funcionalidades complexas: primeiro proponha a estrutura e o encaixe na arquitetura existente, depois implemente.

   - Evite soluções “rápidas e frágeis”.

5. **Use o Código Existente como Referência Principal**

   - Analise padrões de nomenclatura, organização, estilo e abstrações já presentes antes de criar algo novo.

   - Reutilize o que já funciona no projeto em vez de inventar uma abordagem paralela.

   - Na ausência de referência clara, pergunte qual direção seguir.

6. **Dependências e Versões**

   - Respeite as versões e o gerenciador de dependências já configurados no projeto.

   - Não faça downgrade nem introduza versões incompatíveis sem avisar.

   - Ao sugerir uma nova dependência, justifique e verifique compatibilidade com o stack atual.

7. **Visão de Impacto**

   - Ao modificar um ponto, considere efeitos em navegação, estado, modelos, injeção de dependência/teste e outros módulos.

   - Se a mudança tiver consequências globais, declare-as antes de aplicar o código.

## Fluxo Obrigatório Antes de Implementar

1. Confirme o stack e o padrão arquitetural que o projeto já usa.

2. Resuma o entendimento do pedido.

3. Liste os arquivos ou módulos que serão afetados.

4. Verifique se a solução proposta permanece consistente com a arquitetura existente.

5. Só então escreva ou edite o código.

## Formato Preferido de Resposta

- Mudanças localizadas: mostre o trecho ou o diff relevante.

- Mudanças estruturais: apresente primeiro o plano de encaixe, depois o código.

- Sempre sinalize quando uma decisão fugir do padrão mais simples já usado no projeto.

## Proibições

- Introduzir padrões ou bibliotecas de outro stack sem justificativa e alinhamento.

- Misturar estilos ou arquiteturas antigas e novas sem explicitar a transição.

- Ignorar a estrutura de pastas, módulos ou convenções já estabelecidas.

- Optar por soluções frágeis apenas por serem mais rápidas de gerar.

- Assumir versões ou abordagens desatualizadas em relação ao que o projeto já utiliza.

Siga estas regras em todas as interações de código neste projeto. Adapte-se ao stack real encontrado no repositório.
