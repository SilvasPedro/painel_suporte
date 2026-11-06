# Changelog Semântico — Hubdesk

Todas as alterações notáveis deste projeto serão documentadas neste arquivo, seguindo o padrão [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
