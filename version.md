# Changelog Semântico — Hubdesk

Todas as alterações notáveis deste projeto serão documentadas neste arquivo, seguindo o padrão [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
