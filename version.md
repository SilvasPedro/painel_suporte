# Changelog Semântico — Hubdesk

Todas as alterações notáveis deste projeto serão documentadas neste arquivo, seguindo o padrão [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [v4.6.0] - 2026-11-09

### 🎯 Destaque Principal
**Tour guiado** no primeiro acesso, com dois roteiros por perfil, e **renomeação do cargo Colaborador para Operacional**.

---

### 🚀 Novas Funcionalidades (Added)
- **Tour guiado** (`ProductTour`): escurece a tela, destaca o elemento com um retângulo e explica sua função em um cartão posicionado automaticamente, sem sair da tela. Navegação por Voltar/Próximo/Pular ou teclado (setas, Enter e Esc), barra de progresso e suporte aos temas claro, morno e escuro.
- **Dois roteiros** (`tourSteps`): **Operacional e Apoio** (desempenho, histórico, rankings, solicitações, escalas, organograma) e **Gestor e Supervisor** (KPIs, Hub da Equipe, avaliações semanais e mensais, auditorias, KPIs do setor, gestão de dados e configurações). Passos filtrados pelas permissões RBAC do usuário; busca rápida, notificações e tema em ambos.
- **Exibição única no primeiro acesso**: controle local (`localStorage`) e campos `tourVersion`, `tourType` e `tourCompletedAt` no perfil do colaborador. Incrementar `TOUR_VERSION` reapresenta o tour a todos.
- **Botão "Tour guiado"** no rodapé do menu lateral para rever a apresentação.
- **Celular**: o menu lateral é oculto, então as telas são resumidas em um único passo e o tour destaca o botão do menu.

### 🔄 Alterações (Changed)
- **Cargo "Colaborador" passa a "Operacional"** em cadastro, edição, filtro do Hub da Equipe, matriz de permissões, perfil, relatório do colaborador e comentários de chamados. O identificador interno `colaborador` foi mantido para preservar a matriz de permissões salva.
- Nova função `getRoleLabel`: registros antigos ("Colaborador") e vazios aparecem como "Operacional"; cargos fora do padrão (ex.: NOC) são exibidos como cadastrados. Sem migração de dados.

### 🧪 Testes
- Testes dos roteiros (tipo por cargo, filtro por permissão, alvos válidos, versão mobile e chave de persistência) e do rótulo de cargo.

---

## [v4.5.1] - 2026-11-09

### 🐛 Correções (Fixed)
- **Tela de Novidades (changelog)**: o ícone `Target` usado na entrada da v4.5.0 não estava importado em `changelogData.js`, o que causaria erro ao abrir o histórico de versões. Import adicionado.

---

## [v4.5.0] - 2026-11-09

### 🎯 Destaque Principal
**Meu Desempenho** com os novos indicadores de **aproveitamento Huggy** e **finalizações** (médias calculadas pelos lançamentos semanais) e **gráficos com tipos alternáveis**.

---

### 🚀 Novas Funcionalidades (Added)
- **Cartão Aproveitamento Huggy**: média simples dos percentuais de cada lançamento (formato novo), com o total de finalizados sobre iniciados e o aproveitamento ponderado do período; indica quantas semanas entraram na média.
- **Cartões Huggy Finalizados e Finalizações**: média por lançamento e total (`getHuggyStats` e `Atendimentos_Finalizados`).
- **Seletor de tipo de gráfico**: Suave (curva), Área, Linha (com pontos), Barras e Degraus, aplicado a todos os gráficos de evolução semanal; a escolha é lembrada no navegador.
- **Novos gráficos**: Aproveitamento Huggy (%) com eixo fixo de 0 a 100% e Finalizações com duas séries (Huggy finalizados e Finalizações).
- Componente reutilizável `EvolutionChart`, que redesenha o gráfico conforme o tipo escolhido; os gráficos de Pontos, TMA Telefonia e TMA Huggy passam a usá-lo.

### 🔄 Alterações (Changed)
- Grade de "Minhas Médias & Indicadores Pessoais" passa a 4 colunas para acomodar os novos cartões.
- Lançamentos anteriores à v4.3.0 (sem percentual) ficam fora da média de aproveitamento, mas o volume continua contando em Huggy Finalizados; semanas sem percentual aparecem como lacuna no gráfico.

---

## [v4.4.0] - 2026-11-09

### 🎯 Destaque Principal
Perfil do usuário com **capa ajustável**: reposicionar e ampliar a imagem de capa com pré-visualização ao vivo. A opção de **biografia** foi removida.

---

### 🚀 Novas Funcionalidades (Added)
- **Ajuste de enquadramento da capa**: para capas com imagem (link HTTPS), é possível arrastar a imagem na pré-visualização, ajustar posição horizontal e vertical (0–100%) e zoom (100–300%), com o zoom partindo do ponto focal escolhido. Botão "Restaurar padrão".
- Novos campos no perfil (`collaborators`): `bannerPosX`, `bannerPosY` e `bannerZoom`, gravados com limites validados (`clampNumber`). Perfis sem esses valores continuam centralizados e sem zoom.
- Componente `ProfileBannerImage`, compartilhado entre a capa do perfil e a pré-visualização do modal.

### 🔄 Alterações (Changed)
- **Biografia removida**: o campo "Legenda / Bio Profissional" saiu da tela e `bio` deixou de ser gravado em `saveUserProfileData`. Textos já salvos permanecem no banco, sem exibição.
- Descrição da permissão da tela de perfil (RBAC) atualizada, sem menção a biografia.

---

## [v4.3.1] - 2026-11-09

### 🔄 Alterações (Changed)
- **Modelo de métricas (CSV de download)** reordenado para seguir as colunas da tela de lançamento semanal: `Nome; Ligacoes_Atendidas; Ligacoes_Perdidas; Ligacoes_Realizadas; TMA_Telefonia; TME_Telefonia; Huggy_Iniciados; Huggy_Finalizados; TMA_Huggy; Atendimentos_Finalizados`.
- A importação continua lendo as colunas pelo nome do cabeçalho (com fallback às posições do modelo antigo), portanto modelos já baixados seguem sendo aceitos; colunas ausentes entram zeradas.

---

## [v4.3.0] - 2026-11-09

### 🎯 Destaque Principal
Novas métricas nas **Avaliações Semanais**: **Ligações Realizadas** (+1 ponto) e **Huggy Iniciados x Finalizados** com cálculo do **% de aproveitamento** (0,5 ponto por 1%).

---

### 🚀 Novas Funcionalidades (Added)
- **Ligações Realizadas** (`Ligacoes_Realizadas`): novo campo no lançamento semanal, valendo +1 ponto por ligação. Presente em Rankings (tabela, modal, histórico semanal e CSV), Meu Histórico (resumo, detalhe e exportação), desempenho semanal detalhado (cartão e extrato da fórmula), Gerenciador de Dados (rótulo, filtro "Com Ligações Realizadas", cartões, formulário de edição e composição do cálculo) e exportações.
- **Huggy Iniciados e Huggy Finalizados** (`Huggy_Iniciados`, `Huggy_Finalizados`, `Huggy_Aproveitamento`): aproveitamento = finalizados ÷ iniciados, inteiro (arredonda para baixo) e limitado a 100%; **0,5 ponto por 1%** (máximo de 50 pontos). Sem iniciados, 0%. A tela de lançamento calcula o percentual e os pontos em tempo real.
- **Validação do lançamento**: a confirmação antes de salvar avisa quando Huggy Finalizados é maior que Iniciados (aproveitamento limitado a 100%).
- **Função central `getHuggyStats`** em `scoringCalculations`, usada por todas as telas e exportações.

### 🔄 Alterações (Changed)
- O campo **Atendimentos Huggy** foi removido do lançamento (substituído pelos dois novos). O antigo +1 ponto por atendimento não vale mais para lançamentos novos.
- **Registros antigos** (apenas `Atendimentos_Huggy`) preservam a pontuação gravada e, quando recalculados, mantêm +1 ponto por atendimento; o volume aparece como "finalizados" sem percentual.
- **Fórmula centralizada**: Visão Geral, Hub da Equipe, relatório do colaborador e lançamento passaram a usar `calculatePerformanceScore` em vez de fórmulas duplicadas.
- **Importação CSV** do lançamento semanal lê as colunas pelo nome do cabeçalho (com fallback às posições antigas). O modelo novo inclui `Huggy_Iniciados`, `Huggy_Finalizados` e `Ligacoes_Realizadas`; arquivos antigos com `Atendimentos_Huggy` continuam sendo importados (o valor passa a ser Huggy Finalizados).
- Exportações (CSV/PDF/Markdown) com as colunas "Ligações Realizadas", "Huggy Iniciados", "Huggy Finalizados" e "% Aproveitamento Huggy".

### 🧪 Testes
- Novos testes de pontuação: ligações realizadas, aproveitamento Huggy (arredondamento, limite de 100%, sem iniciados), soma na pontuação total e compatibilidade com registros antigos. O teste de exportação passou a localizar a coluna de pontuação pelo cabeçalho.

### ⚠️ Observações
- A pontuação semanal pode terminar em ",5" quando o % de aproveitamento é ímpar.
- A coluna **Finalizados** (`Atendimentos_Finalizados`, +1 ponto) foi mantida; se representar o mesmo dado de Huggy Finalizados, há contagem em duplicidade.

---

## [v4.2.2] - 2026-11-09

### 🎯 Destaque Principal
Lançamento de **Avaliações Semanais** mais seguro: antes de gravar, o sistema mostra quem não receberá avaliação e permite confirmar ou voltar para revisar.

---

### 🚀 Novas Funcionalidades (Added)
- **Tela de confirmação ao salvar**: lista os colaboradores sem nenhuma métrica ("não receberão nada"), os pontos de atenção por colaborador (campos vazios gravados como 0, contagens decimais/negativas, tempos fora de HH:MM:SS) e os colaboradores ativos sem turno, que não aparecem no lançamento. Botões "Voltar e revisar" (destaca em amarelo as linhas vazias) e "Confirmar e salvar N avaliações".

### 🐛 Correções (Fixed)
- **Colaboradores sem avaliação após o lançamento**:
  - Gravação em lote atômico (`writeBatch`, até 400 por commit): antes, uma falha parcial gravava parte das avaliações e, ao tentar de novo, duplicava as já salvas.
  - Importação CSV: comparação de nomes sem distinção de acento/espaços e aviso dos nomes não encontrados (antes eram descartados em silêncio).
  - Campos contendo apenas espaços deixam de contar como preenchidos.
  - Gravação itera os colaboradores elegíveis atuais, não o estado acumulado do formulário.
- **Botão "Todos" dos turnos com texto branco ilegível**: as classes `bg-primary-hub`, `bg-secondary-hub` e `bg-muted-hub` (incluindo `/30`) não existiam; foram criadas em `index.css`. Corrige também o mesmo padrão em Demanda & Fila Diária e nos seletores de Feedbacks 1:1.

---

## [v4.2.1] - 2026-11-09

### 🎯 Destaque Principal
Segunda fase da otimização: menos leituras no perfil do colaborador, importação CSV em lotes e migração de 15 telas e modais para os tokens de tema.

---

### ⚡ Performance (Changed)
- **Meu Perfil**: os emblemas passam a usar apenas as auditorias QA do colaborador exibido (`where('colabId', '==', id)`). A leitura de `third_party_audits` foi removida, pois o cálculo dos emblemas só atribui auditorias por `colabId` ou nome do colaborador e as terceirizadas não possuem esses campos (resultado inalterado).
- **Importação CSV da Auditoria Terceirizada**: gravação com `writeBatch` (até 400 operações por commit) e um único registro por operador, em vez de dois `await` sequenciais por linha.

### 🎨 Interface (Changed)
- **Migração para tokens de tema** (`bg-surface`, `bg-subtle`, `border-subtle`, `border-strong`, `divide-subtle`, `text-primary-hub`, `text-secondary-hub`, `text-muted-hub`) em: Gerenciador de Dados, Rankings, KPIs do Setor, Escalas (Operacionais, Diária e Domingos), Painel do Colaborador, Relatório do Colaborador, Extensões Flutuantes e nos modais de criação/edição de colaborador, feedback, processo QA (edição e prévia) e alteração de senha. Textos cinza em cartões escuros foram preservados para manter o contraste.

### ⚠️ Observações
- `monthly_evaluations` e `sector_kpis` permanecem sem limite de propósito: ordenar por `createdAt` ocultaria documentos antigos sem o campo (feedbacks 1:1 históricos são dado de conformidade). O volume já caiu com as consultas escopadas da v4.2.0.

---

## [v4.2.0] - 2026-11-09

### 🎯 Destaque Principal
Otimização de **leituras do Firestore** para operar com folga dentro da cota diária: cada usuário baixa somente os próprios registros, coleções volumosas passam a ter limite com ordenação por mais recentes e a Auditoria Terceirizada lê apenas os dados da empresa selecionada.

---

### ⚡ Performance (Changed)
- **Consultas escopadas por colaborador**: `NotificationManager`, `NotificationContext`, `MyHistory` e `MyDashboard` usam `where('colabId' | 'creatorId', '==', uid)` em `feedbacks`, `monthly_evaluations`, `qa_audits` e `critical_reports` em vez de baixar a coleção inteira e filtrar na tela. Gestores mantêm a lista completa de chamados (compartilhada com a tela de Relatórios).
- **`limit` sempre com `orderBy`** em `dataCache`: `weekly_evaluations`, `qa_audits`, `feedbacks`, `critical_reports` e `third_party_audits` ordenam por `createdAt` decrescente; `dailyDemand` ordena pelo ID do documento (data). Fallback automático sem ordenação se faltar índice.
- **Chaves de cache por query** (`buildCollectionKey`): cada escopo tem listener e cache próprios, com deduplicação preservada.
- **`fetchQueryOnce`**: leitura única com TTL de 45 minutos e sem listener aberto, usada para dados históricos.
- **Auditoria Terceirizada**: ATSOC com listener restrito a `company == 'ATSOC'`; UpCall lida uma vez (registros legados não possuem o campo) e filtrada no cliente. Contagem por empresa preenchida conforme cada base é carregada.
- **Visão Geral**: indicadores da terceirizada passam a considerar somente a ATSOC, compartilhando o mesmo listener da tela de Auditoria Terceirizada.
- `invalidateCollectionCache` passa a limpar também as chaves escopadas e de leitura única da coleção.

### 🐛 Correções (Fixed)
- **Notificações de feedback para colaboradores comuns**: a consulta sem filtro era negada pelas regras do Firestore; com o filtro por `colabId` ela passa a ser aceita.
- **Limite descartando registros recentes**: antes o `limit` sem ordenação podia deixar de fora auditorias e avaliações novas quando a coleção ultrapassava o teto.

### ⚠️ Observações
- Documentos sem o campo `createdAt` não aparecem nas coleções ordenadas; registros antigos sem `colabId` ou `creatorId` não geram notificação nem aparecem em "Meu Histórico".
- Pendentes para a próxima fase: `MyProfile` (emblemas), `monthly_evaluations` e `sector_kpis` sem limite e importação CSV em lote (`writeBatch`).

---

## [v4.1.1] - 2026-11-06

### 🎯 Destaque Principal
Melhoria substancial do **tema Morno (sépia)**: a paleta de linho, creme e café espresso passou a cobrir todos os elementos da tela, incluindo a barra lateral, que antes permanecia preta e destoava do restante.

---

### 🔄 Alterações (Changed)
- **Barra lateral e gaveta mobile** em café espresso (`#2b221b`), com texto creme, hover translúcido, item ativo, indicadores de notificação e brilhos ambientes em terracota claro.
- **Nova paleta de tokens**: canvas linho (`#ece3d3`), superfícies creme (`#f7f1e5`), bordas, textos primário/secundário/mudo em marrom, sombras quentes e cor de marca em terracota (`#b4451a`).
- **Cor de marca**: botões `bg-red-600`/`bg-rose-*`, eyebrows e destaques rosa passam a terracota; vermelho semântico (erros, não conformidades) é preservado.
- **Cartões de destaque escuros** (`zinc-950/900`) e gradientes convertidos para espresso, incluindo cabeçalhos de modais e tabelas Markdown.
- **Cobertura global**: regras antes restritas ao `main` agora valem para cabeçalho, modais e overlays (overlay em marrom translúcido).
- **Formulários**: fundo creme claro, foco com anel terracota, `accent-color` em checkboxes, radios e ranges.
- **Tabelas, badges, gráficos (Recharts) e barras de rolagem** reajustados para tons terrosos, incluindo novos badges `sky`, `indigo` e `teal`.
- Seleção de texto e contorno de foco por teclado em tons de terracota.

---

## [v4.1.0] - 2026-11-06

### 🎯 Destaque Principal
Evolução das telas de auditoria e escalas sobre a base visual da v4.0.0: **Auditoria Terceirizada** passa a suportar múltiplas empresas (ATSOC atual e UpCall como histórico), o **modal de Auditorias QA** foi redesenhado para agilizar o preenchimento, a **Escala de Folgas** ganhou cards quadrados por dia e os títulos de 12 telas foram padronizados.

---

### 🚀 Novas Funcionalidades (Added)
- **Seletor de Empresa na Auditoria Terceirizada**: ATSOC (operação atual) e UpCall (histórico, somente leitura), com contagem de auditorias por empresa e abertura da UpCall em "Todo o Histórico".
- **Campo `company` nas auditorias e operadores**: novas auditorias, importações CSV e operadores salvos são gravados com a empresa; registros sem o campo são tratados como UpCall (sem necessidade de migração).
- **Filtros da checklist no modal QA**: Todos, Pendentes e Falhas, botão "Próximo pendente", atalho "Hoje" na data, tecla Esc para fechar e confirmação ao salvar com critérios sem resposta.
- **Escala de Folgas em cards quadrados**: cada dia do mês é um card arredondado com destaque para hoje e feriados 100% H.E, com rolagem horizontal em telas estreitas.

### 🔄 Alterações (Changed)
- **Auditorias QA**: filtros movidos para logo abaixo do título; métricas, filtros e tabela redesenhados (cartões com ícone, barras de progresso, pílulas e cabeçalho claro).
- **Modal QA**: coluna de pontuação fixa na rolagem, numeração colorida por resultado e cores adaptadas aos temas claro, quente e escuro.
- **Padronização de títulos** (estilo de Tarefas & Relatórios) em: Auditorias QA, Auditoria Terceirizada, Escala de Folgas, Escala Diária, Plantão (Domingos), Escalas Operacionais, Organograma, KPIs do Setor, Meu Histórico, Demanda & Fila Diária, Feedbacks 1:1 e Métricas Semanais.
- **Exportações** de CSV e PDF da Auditoria Terceirizada passam a identificar a empresa.

### 🐛 Correções (Fixed)
- **Data nas Auditorias QA**: o campo agora se chama "Data da Auditoria" (dia em que a auditoria foi feita), na tabela, no formulário e nos detalhes.
- **Canal de comunicação**: reduzido a Telefone e WhatsApp / Chat; registros antigos de WhatsApp e Chat aparecem como "WhatsApp / Chat" na edição.

---

## [v3.11.0] - 2026-10-31

### 🎯 Destaque Principal
Refatoração completa da tela de **Feedbacks 1:1 (Análise Mensal)**. Transição para o modelo consolidado baseado em documentos ricos em Markdown (`.md`), garantindo leitura amigável com tabelas visuais estilizadas, tipografia responsiva e fluxo de confirmação de ciência auditável pelo colaborador, acompanhado de notificações automáticas em tempo real (push, pop-up, sino e indicador pulsante) e preservação do modo legado para os 4 pilares históricos.

---

### 🚀 Novas Funcionalidades (Added)
- **Tabelas Visuais Ricas no Markdown (`MarkdownRenderer`)**:
  - Renderização completa de tabelas com cabeçalho escuro de alto contraste, bordas delimitadoras, linhas zebradas para facilitar a leitura e container responsivo com scroll horizontal suave em telas menores.
  - Substituição da prévia crua por visualização gráfica refinada tanto no formulário de criação quanto na visualização final do feedback.
- **Notificação Automática ao Colaborador no Salvamento de Feedback**:
  - Ao salvar uma avaliação 1:1, um registro é automaticamente criado na coleção `notifications` do Firestore direcionado ao colaborador.
  - O `NotificationManager` monitora em tempo real a coleção `monthly_evaluations`, disparando som de alerta, notificação nativa do navegador/desktop e indicador pulsante na barra lateral em "Meu Histórico".
  - O sino de notificações (`NotificationBell`) exibe a pendência e permite com um clique abrir diretamente a aba de alinhamento mensal e o modal do feedback.
  - Implementada Cloud Function `notifyNewMonthlyEvaluation` em `functions/index.js` para envio via Firebase Cloud Messaging (FCM).
- **Novo Formato Consolidado em Markdown (`format: 'markdown'`)**:
  - Formulário de lançamento com editor Markdown e aba de prévia em tempo real com tabelas renderizadas.
  - Botão de atalho "Carregar Modelo Oficial 1:1" com estrutura recomendada (Destaques Positivos, Pontos de Atenção, Tabela de Metas/PDI e Acordos).
  - Renderização segura via `react-markdown`, `remark-gfm` e `rehype-sanitize`.
- **Fluxo de Confirmação de Ciência ("Estou Ciente / Marcar como Lido")**:
  - Botão de ação primária destacado ao final do documento renderizado.
  - Registro de auditoria no Firestore contendo data/hora (`readAt`), UID (`readByUid`), nome legível (`readByName`) e e-mail (`readByEmail`).
  - Badge permanente pós-confirmação: *"Visualizado e confirmado em DD/MM/AAAA às HH:mm por [Nome]"*.
- **Modo Legado Protegido (`LegacyFeedbackView`)**:
  - Detecção automática de feedbacks históricos baseados nos 4 pilares (`format: '4_pillars'` ou presença de pontuações de pilares).
  - Visualização em modo protegido e bloqueado contra edição acidental (Read-only).
  - Banner explicativo destacado no topo: *"Visualização em Modo Legado — 4 Pilares (Read-only)"*.
- **Badges e Filtros Avançados na Listagem**:
  - Indicadores visuais nos grids e tabelas diferenciando feedbacks novos (`Markdown 1:1`) dos antigos (`Legado - 4 Pilares`).
  - Indicadores de status de leitura (`Confirmado` vs. `Pendente de Leitura`).
  - Filtros contextuais por formato, status de leitura, mês de referência e classificação.

---

### 🛡️ Segurança e Compatibilidade (Fixed & Changed)
- Proteção anti-XSS ativa em todas as visualizações Markdown de feedbacks.
- Isolamento estrito de escrita para registros legados, assegurando conformidade de dados históricos.
- Layout 100% responsivo para visualização fluida em dispositivos móveis sem overflow horizontal.
- Integração unificada nos módulos de Gestão (`MonthlyEvaluations`) e Histórico Individual do Colaborador (`MyHistory`).
