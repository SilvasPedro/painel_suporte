# Log de Atualizações — Hubdesk (Registro de Modificações de Arquivos)

Este arquivo é um registro contínuo e mandatório de todas as adições, alterações e deleções de arquivos realizadas no projeto Hubdesk.

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
