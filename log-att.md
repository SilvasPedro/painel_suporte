# Log de Atualizações — Hubdesk (Registro de Modificações de Arquivos)

Este arquivo é um registro contínuo e mandatório de todas as adições, alterações e deleções de arquivos realizadas no projeto Hubdesk.

---

## [09/11/2026] — Versão v4.2.0 (Otimização de Leituras do Firestore)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.1.1` para `4.2.0`. |
| **Alterado** | `src/services/dataCache.js` | Queries escopadas (`options.where`) com chave de cache própria, `limit` combinado com `orderBy`, fallback sem ordenação em `failed-precondition`, novo `fetchQueryOnce` e limpeza de cache por prefixo. |
| **Alterado** | `src/components/NotificationManager.jsx` | Listeners de `feedbacks`, `monthly_evaluations` e `critical_reports` restritos ao usuário (gestores mantêm a lista completa de chamados). |
| **Alterado** | `src/context/NotificationContext.jsx` | Indicadores de não lidos consultam apenas os registros do usuário. |
| **Alterado** | `src/pages/MyHistory.jsx` | Coleções de histórico consultadas com `where('colabId', '==', uid)`. |
| **Alterado** | `src/pages/MyDashboard.jsx` | Chamados, feedbacks e auditorias consultados apenas do usuário. |
| **Alterado** | `src/pages/DashboardOverview.jsx` | Indicadores da terceirizada restritos à ATSOC. |
| **Alterado** | `src/pages/ThirdPartyAudits.jsx` | ATSOC com listener escopado e UpCall com leitura única em cache; contagem por empresa e estado de carregamento derivado. |
| **Alterado** | `src/data/changelogData.js` | `CURRENT_VERSION` para `v4.2.0` e nova entrada do changelog oficial. |
| **Alterado** | `version.md` | Notas de lançamento da versão `v4.2.0`. |
| **Alterado** | `log-att.md` | Registro desta atualização. |

---

## [06/11/2026] — Versão v4.1.1 (Melhoria Substancial do Tema Morno / Sépia)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.1.0` para `4.1.1`. |
| **Alterado** | `src/index.css` | Reescrita dos tokens do tema Morno (paleta linho/creme/espresso/terracota, variáveis da sidebar) e do bloco de regras do modo Morno: sidebar em espresso, superfícies e tipografia globais, marca em terracota, cartões escuros, overlays, formulários, tabelas, badges, gráficos, rolagem e Markdown. |
| **Alterado** | `src/data/changelogData.js` | `CURRENT_VERSION` para `v4.1.1` e nova entrada do changelog oficial. |
| **Alterado** | `version.md` | Notas de lançamento da versão `v4.1.1`. |
| **Alterado** | `log-att.md` | Registro desta atualização. |

---

## [06/11/2026] — Versão v4.1.0 (Empresas na Auditoria Terceirizada, Modal QA, Folgas em Cards e Títulos Padronizados)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.0.0` para `4.1.0`. |
| **Alterado** | `src/pages/ThirdPartyAudits.jsx` | Seletor de empresa (ATSOC / UpCall), filtragem por empresa, campo `company` em auditorias, importações e operadores, UpCall somente leitura, cabeçalho padronizado e tokens de tema. |
| **Alterado** | `src/pages/Audits.jsx` | Filtros movidos para o topo, cabeçalho padronizado e visual modernizado. |
| **Alterado** | `src/components/audits/AuditMetrics.jsx` | Reescrito com cartão base (`StatCard` local), ícones em chip e barras de progresso. |
| **Alterado** | `src/components/audits/AuditFilters.jsx` | Campos e atalhos de período em formato de pílula com tokens de tema. |
| **Alterado** | `src/components/audits/AuditTable.jsx` | Cabeçalho claro, avatar em gradiente, pontuação com barra, coluna "Data da Auditoria" e ícone do canal WhatsApp/Chat. |
| **Alterado** | `src/components/audits/AuditFormModal.jsx` | Data da Auditoria, canais Telefone e WhatsApp/Chat, filtros da checklist, próximo pendente, atalho Hoje, tecla Esc, confirmação com pendências e coluna fixa. |
| **Alterado** | `src/components/audits/AuditDetailsModal.jsx` | Texto "Auditoria realizada em", ícone do canal WhatsApp/Chat e tokens de tema. |
| **Alterado** | `src/pages/DayOffSchedule.jsx` | Calendário com dias em cards quadrados e título padronizado. |
| **Alterado** | `src/pages/DailySchedule.jsx`, `SundaySchedule.jsx`, `OperationalSchedules.jsx` | Título padronizado no estilo de Tarefas & Relatórios. |
| **Alterado** | `src/pages/OrgChart.jsx`, `SectorKPIs.jsx`, `MyHistory.jsx`, `DailyDemandLaunch.jsx`, `MonthlyEvaluations.jsx`, `WeeklyMetrics.jsx` | Título padronizado e remoção do cartão de fundo do cabeçalho. |
| **Alterado** | `src/data/changelogData.js` | `CURRENT_VERSION` para `v4.1.0` e nova entrada do changelog oficial. |
| **Alterado** | `version.md` | Notas de lançamento da versão `v4.1.0`. |
| **Alterado** | `log-att.md` | Registro desta atualização. |

---

## [31/10/2026] — Versão v3.11.0 (Refatoração da Tela de Feedbacks 1:1, Tabelas Visuais e Notificações)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `.env` | Configuração explícita das credenciais reais do Firebase (`prodigyapp-73141`). |
| **Alterado** | `package.json` | Incremento da versão semântica de `3.10.1` para `3.11.0`. |
| **Criado** | `src/types/feedback.types.js` | Schemas de validação, detecção de formato (`FEEDBACK_FORMATS`), modelo padrão em Markdown e construtor de payload de auditoria (`buildMarkAsReadPayload`). |
| **Criado** | `src/types/feedback.types.d.ts` | Definições e interfaces TypeScript para `FeedbackFormat`, `AuditReadConfirmation`, `Legacy4PillarsEvaluation` e `Markdown1on1Feedback`. |
| **Criado** | `src/types/feedback.types.test.js` | Suíte de testes unitários no Vitest para validação de esquemas, detecção de formatos e compliance de leitura. |
| **Criado** | `src/components/common/MarkdownRenderer.jsx` | Componente dedicado para renderização de Markdown com tabelas visuais ricas (bordas, zebrado, cabeçalho estilizado, scroll responsivo) e sanitização segura. |
| **Alterado** | `src/index.css` | Adição de regras CSS globais para estilização visual de tabelas e tipografia Markdown com compatibilidade aos temas Claro, Escuro e Morno. |
| **Criado** | `src/components/history/LegacyFeedbackView.jsx` | Componente de visualização em modo legado com banner de proteção (Read-only) para registros dos 4 pilares anteriores. |
| **Criado** | `src/components/history/MarkdownFeedbackView.jsx` | Componente de renderização segura em Markdown utilizando `MarkdownRenderer`, com tipografia fluida e botão de ação primária "Estou Ciente / Marcar como Lido". |
| **Alterado** | `src/components/history/MonthlyEvaluationDetailModal.jsx` | Modal expansivo com renderização condicional dinâmica entre `LegacyFeedbackView` e `MarkdownFeedbackView`, impressão e confirmação de ciência. |
| **Alterado** | `src/pages/MonthlyEvaluations.jsx` | Refatoração da página de Feedbacks Mensais 1:1: novo formulário com editor Markdown e prévia em tempo real com tabelas visuais, disparo de notificação na coleção `notifications` ao salvar feedback e listagem com badges de formato e status. |
| **Alterado** | `src/pages/MyHistory.jsx` | Integração dos badges visuais de formato e status na aba Análise Mensal (1:1), botão de "Estou Ciente" direto na tabela, envio de payload completo de auditoria no Firestore e ouvinte `HUBDESK_OPEN_MONTHLY_EVALUATION`. |
| **Alterado** | `src/components/NotificationManager.jsx` | Monitoramento em tempo real da coleção `monthly_evaluations` no Firestore, acionamento de notificações sonoras/desktop e navegação direta para o feedback 1:1. |
| **Alterado** | `src/context/NotificationContext.jsx` | Monitoramento contínuo de avaliações mensais não lidas para acionamento da bolinha pulsante em "Meu Histórico". |
| **Alterado** | `src/components/NotificationBell.jsx` | Suporte a notificações de alinhamento 1:1 no sino de notificações com redirecionamento para a aba mensal e abertura automática do modal. |
| **Alterado** | `functions/index.js` | Adição da Cloud Function `notifyNewMonthlyEvaluation` disparando push notification via token FCM para o colaborador. |
| **Alterado** | `src/data/changelogData.js` | Atualização do `CURRENT_VERSION` para `v3.11.0` e inserção dos itens detalhados do changelog oficial. |
| **Criado** | `version.md` | Changelog semântico detalhado e notas de lançamento da versão `v3.11.0`. |
| **Criado** | `log-att.md` | Criação do arquivo mandatório de histórico de arquivos modificados e criados. |
