# Log de Atualizações — Hubdesk (Registro de Modificações de Arquivos)

Este arquivo é um registro contínuo e mandatório de todas as adições, alterações e deleções de arquivos realizadas no projeto Hubdesk.

---

## [11/11/2026] — Versão v4.11.1 (Smart Pre: Atalho EasyAuth)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.11.0` para `4.11.1`. |
| **Criado** | `src/components/smartpre/EasyAuthShortcut.jsx` | Botão do portal EasyAuth e painel "Ver credenciais" (senha oculta, copiar, cadastro pela gestão). |
| **Criado** | `src/assets/easyauth_logo.png` | Logo da EasyAuth usada no botão. |
| **Alterado** | `src/pages/SmartPre.jsx` | Atalho no cabeçalho da tela. |
| **Alterado** | `firestore.rules` | Regras da coleção `smart_pre_settings`. |
| **Alterado** | `src/components/smartpre/smartPreRender.test.jsx` | Teste do atalho. |
| **Alterado** | `src/data/changelogData.js` / `version.md` / `log-att.md` | Registro da versão. |

---

## [11/11/2026] — Versão v4.11.0 (Smart Pre: Protocolos de Atendimento)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.10.0` para `4.11.0`. |
| **Alterado** | `src/utils/smartPre.js` / `smartPre.test.js` | Modelo cliente + protocolos, situação derivada, validações, indicadores por protocolo e compatibilidade com a v4.10.0. |
| **Alterado** | `src/components/smartpre/SmartPreFormModal.jsx` | Cadastro simplificado (apenas dados da instalação). |
| **Alterado** | `src/components/smartpre/SmartPreDetailModal.jsx` | Protocolos de atendimento (abrir, editar, finalizar, excluir) e relatos. |
| **Alterado** | `src/components/smartpre/SmartPreDashboard.jsx` | Indicadores calculados pelos protocolos. |
| **Alterado** | `src/pages/SmartPre.jsx` | Gravação de protocolos, filtros por situação/encerramento/classificação e busca por protocolo. |
| **Alterado** | `src/components/smartpre/smartPreRender.test.jsx` | Testes de renderização atualizados. |
| **Alterado** | `src/data/changelogData.js` / `version.md` / `log-att.md` | Registro da versão. |

---

## [11/11/2026] — Versão v4.10.0 (Tela Smart Pre)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.9.0` para `4.10.0`. |
| **Criado** | `src/pages/SmartPre.jsx` | Tela principal: cabeçalho, abas Dashboard/Clientes, filtros e gravação no Firestore. |
| **Criado** | `src/components/smartpre/*` | Dashboard, formulário e detalhe com relatos, mais teste de renderização. |
| **Criado** | `src/utils/smartPre.js` / `smartPre.test.js` | Constantes e cálculos puros (taxa de contato, tempos, saúde do serviço) com testes. |
| **Alterado** | `src/services/rbac.js` | Módulo `smart_pre` e permissões padrão por cargo. |
| **Alterado** | `src/pages/AdminDashboard.jsx` / `src/data/tourSteps.js` | Item de menu, rota interna e passo do tour. |
| **Alterado** | `src/services/dataCache.js` | Limite e ordenação de `smart_pre_clients`. |
| **Alterado** | `firestore.rules` | Regras da coleção `smart_pre_clients`. |
| **Alterado** | `src/data/changelogData.js` / `version.md` / `log-att.md` | Registro da versão. |

---

## [10/11/2026] — Versão v4.9.0 (DM ao Solicitante em Tarefas & Relatórios)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.8.2` para `4.9.0`. |
| **Alterado** | `api/_lib/dm.js` / `api/_lib/dm.test.js` | Eventos `report_status` e `report_comment` com leitura do relatório no servidor e testes. |
| **Alterado** | `src/services/discordDm.js` / `discordDm.test.js` | `sendReportDm`, `DM_EVENT_META` e mensagens discretas, com testes. |
| **Alterado** | `src/services/notificationEvents.js` | Novos tipos de DM ativados por padrão. |
| **Alterado** | `src/components/settings/TeamWebhookSettings.jsx` | Toggles dos novos avisos de DM. |
| **Alterado** | `src/pages/Reports.jsx` / `src/components/reports/ReportDetailModal.jsx` | Disparo da DM ao mudar status ou comentar. |
| **Alterado** | `src/data/changelogData.js` / `version.md` / `log-att.md` | Registro da versão. |

---

## [10/11/2026] — Versão v4.8.2 (Aviso de DM Pulada por Configuração)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.8.1` para `4.8.2`. |
| **Alterado** | `src/services/discordDm.js` | Detecção de DM pulada por configuração com contagem de destinatários vinculados, aviso na tela e registro no console. |
| **Alterado** | `src/services/discordDm.test.js` | Novos testes das DMs puladas por configuração e dos textos exibidos. |
| **Alterado** | `src/data/changelogData.js` | `CURRENT_VERSION` para `v4.8.2` e nova entrada do changelog oficial. |
| **Alterado** | `version.md` / `log-att.md` | Notas de lançamento e registro desta atualização. |

---

## [10/11/2026] — Versão v4.8.1 (Diagnóstico do Bot do Discord)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.8.0` para `4.8.1`. |
| **Alterado** | `api/_lib/dm.js` | Limpeza e validação do formato do token, verificação do bot no Discord com cache e motivos nas respostas de erro. |
| **Alterado** | `api/notify-dm.js` | `GET` passa a devolver o estado detalhado do bot. |
| **Alterado** | `src/services/discordDm.js` | Estado detalhado do bot, textos de orientação e passo a passo para corrigir o token. |
| **Alterado** | `src/components/settings/TeamWebhookSettings.jsx` | Estado do bot por cor e texto, com a orientação de correção. |
| **Alterado** | `api/_lib/dm.test.js`, `src/services/discordDm.test.js` | Testes do token, do estado do bot e dos textos. |
| **Alterado** | `src/data/changelogData.js` | `CURRENT_VERSION` para `v4.8.1` e nova entrada do changelog oficial. |
| **Alterado** | `version.md` / `log-att.md` | Notas de lançamento e registro desta atualização. |

---

## [10/11/2026] — Versão v4.8.0 (Avisos por DM no Discord)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.7.2` para `4.8.0`. |
| **Criado** | `api/notify-dm.js` | Função serverless que recebe o pedido de DM (POST) e informa se o bot está configurado (GET). |
| **Criado** | `api/_lib/dm.js` | Validação do login do Firebase, permissões, leitura do ID do Discord no Firestore, mensagens e envio pelo bot com tratamento de erros e limites. |
| **Criado** | `api/_lib/dm.test.js` | Testes da função (token, permissões, envio e erros). |
| **Criado** | `src/services/discordDm.js` | Serviço do app: pedido de envio, regras de ativação, estado do bot e mensagens ao usuário. |
| **Criado** | `src/services/discordDm.test.js` | Testes do serviço do app. |
| **Alterado** | `src/pages/MyProfile.jsx` | Campo de vínculo do Discord, validação, instruções e DM de teste. |
| **Alterado** | `src/services/userProfile.js` | Gravação do `discordUserId` no perfil. |
| **Alterado** | `src/components/settings/TeamWebhookSettings.jsx` | Bloco "DM no Discord (bot)": estado do bot, ativação, eventos e DM de teste. |
| **Alterado** | `src/components/NotificationManager.jsx` | Exibe ao gestor o resultado do envio de DMs. |
| **Alterado** | `src/pages/WeeklyMetrics.jsx`, `src/services/adminAuth.js`, `src/pages/MonthlyEvaluations.jsx` | Disparo das DMs nos três eventos. |
| **Alterado** | `src/services/notificationEvents.js` | Bloco `dm` na configuração padrão do webhook. |
| **Alterado** | `server.ts` / `.env.example` | Rota local de `/api/notify-dm` e documentação das variáveis (sem valores). |
| **Alterado** | `src/data/changelogData.js` | `CURRENT_VERSION` para `v4.8.0` e nova entrada do changelog oficial. |
| **Alterado** | `version.md` / `log-att.md` | Notas de lançamento e registro desta atualização. |

---

## [10/11/2026] — Versão v4.7.2 (Diagnóstico do Webhook do Canal)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.7.1` para `4.7.2`. |
| **Alterado** | `src/services/notificationEvents.js` | Resultado e motivo de cada envio (`describeWebhookResult`, evento `HUBDESK_WEBHOOK_RESULT`), intervalo configurável e cache mais curto para configuração desativada. |
| **Alterado** | `src/components/NotificationManager.jsx` | Exibe ao gestor o resultado do aviso ao canal. |
| **Alterado** | `src/components/settings/TeamWebhookSettings.jsx` | Campo de intervalo, faixa de alerta (desativado ou não salvo) e aviso ao salvar desativado. |
| **Alterado** | `src/services/notificationEvents.test.js` | Novos testes de diagnóstico e do intervalo configurável. |
| **Alterado** | `src/data/changelogData.js` | `CURRENT_VERSION` para `v4.7.2` e nova entrada do changelog oficial. |
| **Alterado** | `version.md` / `log-att.md` | Notas de lançamento e registro desta atualização. |

---

## [10/11/2026] — Versão v4.7.1 (Avisos Genéricos do Webhook)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.7.0` para `4.7.1`. |
| **Alterado** | `src/services/notificationEvents.js` | Mensagens genéricas padrão, `renderWebhookText`, link configurável, Discord em texto simples e proteção contra repetição. |
| **Alterado** | `src/components/settings/TeamWebhookSettings.jsx` | Campos de link e de mensagem por evento, teste com exemplo do aviso real e textos de privacidade. |
| **Alterado** | `src/pages/WeeklyMetrics.jsx`, `src/services/adminAuth.js`, `src/pages/MonthlyEvaluations.jsx` | Disparo do aviso genérico, sem nomes ou dados. |
| **Alterado** | `src/services/notificationEvents.test.js` | Novos testes das mensagens genéricas, do link e da proteção contra repetição. |
| **Alterado** | `src/data/changelogData.js` | `CURRENT_VERSION` para `v4.7.1` e nova entrada do changelog oficial. |
| **Alterado** | `version.md` / `log-att.md` | Notas de lançamento e registro desta atualização. |

---

## [10/11/2026] — Versão v4.7.0 (Notificações: Avisos Pessoais e Webhook do Canal)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.6.0` para `4.7.0`. |
| **Criado** | `src/services/notificationEvents.js` | Eventos, montagem de avisos, marcação de lidos, formatos de webhook por serviço, envio com fallback de CORS e despacho ao canal da equipe. |
| **Criado** | `src/services/notificationEvents.test.js` | Testes dos avisos e do webhook. |
| **Criado** | `src/components/settings/TeamWebhookSettings.jsx` | Tela de configuração do webhook (serviço, URL, eventos, teste e avisos de privacidade). |
| **Alterado** | `firestore.rules` | Regras de `notifications` e `integrations`. |
| **Alterado** | `src/components/NotificationManager.jsx` | Listeners de feedbacks e 1:1 substituídos pela caixa de avisos pessoal. |
| **Alterado** | `src/context/NotificationContext.jsx` | Indicador de Meu Histórico baseado nos avisos pendentes e marcação de lidos ao abrir o histórico. |
| **Alterado** | `src/pages/WeeklyMetrics.jsx` | Aviso pessoal por colaborador no mesmo lote da avaliação e resumo ao canal da equipe. |
| **Alterado** | `src/services/adminAuth.js` | Feedback e aviso gravados em lote e resumo ao canal. |
| **Alterado** | `src/pages/MonthlyEvaluations.jsx` | Aviso pessoal no novo formato e resumo ao canal. |
| **Alterado** | `src/pages/MyHistory.jsx` | Abertura da aba indicada pelo aviso. |
| **Alterado** | `src/pages/Settings.jsx` | Inclusão do cartão de webhook na aba Notificações. |
| **Alterado** | `src/data/changelogData.js` | `CURRENT_VERSION` para `v4.7.0` e nova entrada do changelog oficial. |
| **Alterado** | `version.md` / `log-att.md` | Notas de lançamento e registro desta atualização. |

---

## [09/11/2026] — Versão v4.6.0 (Tour Guiado e Cargo Operacional)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.5.1` para `4.6.0`. |
| **Criado** | `src/components/tour/ProductTour.jsx` | Componente do tour: fundo escurecido, retângulo de destaque, cartão posicionado automaticamente, navegação por teclado e barra de progresso. |
| **Criado** | `src/data/tourSteps.js` | Roteiros (Operacional/Apoio e Gestor/Supervisor), filtro por permissão, versão mobile e chave de persistência. |
| **Criado** | `src/data/tourSteps.test.js` | Testes dos roteiros e do rótulo do cargo Operacional. |
| **Alterado** | `src/pages/AdminDashboard.jsx` | Abertura automática do tour no primeiro acesso, marcadores `data-tour`, gravação da conclusão no perfil e botão "Tour guiado". |
| **Alterado** | `src/services/rbac.js` | Rótulo do cargo para Operacional e função `getRoleLabel`. |
| **Alterado** | `src/context/AuthContext.jsx` | Cargo padrão passa a "Operacional". |
| **Alterado** | `src/components/collaborators/CreateCollaboratorModal.jsx`, `EditCollaboratorModal.jsx`, `ReportDashboardModal.jsx` | Cargo Operacional em cadastro, edição e relatório do colaborador. |
| **Alterado** | `src/pages/CollaboratorsHub.jsx` | Filtro e rótulos do cargo Operacional. |
| **Alterado** | `src/components/reports/ReportDetailModal.jsx`, `TaskFormModal.jsx` | Cargo padrão e exibição do cargo nos comentários de chamados. |
| **Alterado** | `src/data/changelogData.js` | `CURRENT_VERSION` para `v4.6.0` e nova entrada do changelog oficial. |
| **Alterado** | `version.md` | Notas de lançamento da versão `v4.6.0`. |
| **Alterado** | `log-att.md` | Registro desta atualização. |

---

## [09/11/2026] — Versão v4.5.1 (Correção do Changelog)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.5.0` para `4.5.1`. |
| **Alterado** | `src/data/changelogData.js` | Importação do ícone `Target` (ausente na entrada da v4.5.0), `CURRENT_VERSION` para `v4.5.1` e nova entrada do changelog. |
| **Alterado** | `version.md` / `log-att.md` | Registro desta correção. |

---

## [09/11/2026] — Versão v4.5.0 (Meu Desempenho: Aproveitamento, Finalizações e Tipos de Gráfico)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.4.0` para `4.5.0`. |
| **Alterado** | `src/pages/MyDashboard.jsx` | Cartões de aproveitamento Huggy, Huggy finalizados e finalizações com médias; seletor de tipo de gráfico (suave, área, linha, barras e degraus) e componente `EvolutionChart`; novos gráficos de aproveitamento e finalizações. |
| **Alterado** | `src/data/changelogData.js` | `CURRENT_VERSION` para `v4.5.0` e nova entrada do changelog oficial. |
| **Alterado** | `version.md` | Notas de lançamento da versão `v4.5.0`. |
| **Alterado** | `log-att.md` | Registro desta atualização. |

---

## [09/11/2026] — Versão v4.4.0 (Capa Ajustável e Remoção da Biografia)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.3.1` para `4.4.0`. |
| **Alterado** | `src/pages/MyProfile.jsx` | Ajuste da capa (arrastar, posição X/Y e zoom com pré-visualização), componente `ProfileBannerImage` e remoção do campo de biografia. |
| **Alterado** | `src/services/userProfile.js` | Gravação de `bannerPosX`, `bannerPosY` e `bannerZoom` com validação de limites e remoção de `bio` do payload. |
| **Alterado** | `src/services/rbac.js` | Descrição da permissão da tela de perfil sem menção a biografia. |
| **Alterado** | `src/data/changelogData.js` | `CURRENT_VERSION` para `v4.4.0` e nova entrada do changelog oficial. |
| **Alterado** | `version.md` | Notas de lançamento da versão `v4.4.0`. |
| **Alterado** | `log-att.md` | Registro desta atualização. |

---

## [09/11/2026] — Versão v4.3.1 (Modelo de Métricas na Ordem da Tela)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.3.0` para `4.3.1`. |
| **Alterado** | `src/pages/WeeklyMetrics.jsx` | Cabeçalhos e linhas do CSV de modelo reordenados para seguir a tela de lançamento. |
| **Alterado** | `src/data/changelogData.js` | `CURRENT_VERSION` para `v4.3.1` e nova entrada do changelog oficial. |
| **Alterado** | `version.md` | Notas de lançamento da versão `v4.3.1`. |
| **Alterado** | `log-att.md` | Registro desta atualização. |

---

## [09/11/2026] — Versão v4.3.0 (Ligações Realizadas e Huggy Iniciados x Finalizados)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.2.2` para `4.3.0`. |
| **Alterado** | `src/utils/scoringCalculations.js` | Peso das ligações realizadas, função `getHuggyStats` (aproveitamento com 0,5 pt por 1% e modo legado) e atualização de `calculatePerformanceScore` e `calculateScoreBreakdown`. |
| **Alterado** | `src/pages/WeeklyMetrics.jsx` | Colunas Lig. Realizadas, Huggy Iniciados, Huggy Finalizados e % Aproveit.; validação, gravação em lote com os novos campos, modelo CSV e importação por nome de coluna. |
| **Alterado** | `src/pages/Rankings.jsx` | Ligações realizadas e Huggy iniciados/finalizados/aproveitamento em tabela, modal, histórico e CSV. |
| **Alterado** | `src/pages/MyHistory.jsx` | Cartão Realizadas, detalhe e exportação com os novos campos. |
| **Alterado** | `src/components/history/WeeklyMetricDetailModal.jsx` | Cartões e extrato da fórmula com ligações realizadas e aproveitamento Huggy. |
| **Alterado** | `src/pages/DataManager.jsx` | Rótulos, filtro, cartões, composição do cálculo e formulário de edição com os novos campos. |
| **Alterado** | `src/pages/CollaboratorsHub.jsx`, `src/pages/DashboardOverview.jsx`, `src/components/collaborators/ReportDashboardModal.jsx` | Fórmulas duplicadas substituídas pelo cálculo central. |
| **Alterado** | `src/utils/dataExport.js` | Colunas de ligações realizadas e de Huggy nas exportações. |
| **Alterado** | `src/utils/scoringCalculations.test.js`, `src/utils/dataExport.test.js` | Novos testes de pontuação e teste de exportação independente da posição da coluna. |
| **Alterado** | `src/data/changelogData.js` | `CURRENT_VERSION` para `v4.3.0` e nova entrada do changelog oficial. |
| **Alterado** | `version.md` | Notas de lançamento da versão `v4.3.0`. |
| **Alterado** | `log-att.md` | Registro desta atualização. |

---

## [09/11/2026] — Versão v4.2.2 (Validação do Lançamento Semanal e Correção dos Filtros de Turno)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.2.1` para `4.2.2`. |
| **Alterado** | `src/pages/WeeklyMetrics.jsx` | Tela de confirmação com colaboradores sem lançamento e pontos de atenção, gravação atômica com `writeBatch`, importação CSV com normalização de nomes e aviso de não encontrados, destaque das linhas vazias e lista de ativos sem turno. |
| **Alterado** | `src/index.css` | Criação das classes `bg-primary-hub`, `bg-secondary-hub`, `bg-muted-hub` e `bg-muted-hub/30` (corrige texto branco sem fundo nos botões ativos de filtro). |
| **Alterado** | `src/data/changelogData.js` | `CURRENT_VERSION` para `v4.2.2` e nova entrada do changelog oficial. |
| **Alterado** | `version.md` | Notas de lançamento da versão `v4.2.2`. |
| **Alterado** | `log-att.md` | Registro desta atualização. |

---

## [09/11/2026] — Versão v4.2.1 (Otimização Fase 2 e Migração para Tokens de Tema)

| Ação | Arquivo | Descrição da Alteração |
| :--- | :--- | :--- |
| **Alterado** | `package.json` / `package-lock.json` | Incremento da versão semântica de `4.2.0` para `4.2.1`. |
| **Alterado** | `src/pages/MyProfile.jsx` | Auditorias QA consultadas apenas do colaborador exibido e remoção da leitura de `third_party_audits`. |
| **Alterado** | `src/pages/ThirdPartyAudits.jsx` | Importação CSV com `writeBatch` e operadores deduplicados; tokens de tema. |
| **Alterado** | `src/pages/DataManager.jsx`, `Rankings.jsx`, `SectorKPIs.jsx`, `OperationalSchedules.jsx`, `DailySchedule.jsx`, `SundaySchedule.jsx`, `CollaboratorDashboard.jsx` | Migração de cores fixas para tokens de tema. |
| **Alterado** | `src/components/collaborators/ReportDashboardModal.jsx`, `EditCollaboratorModal.jsx`, `CreateCollaboratorModal.jsx`, `FeedbackModal.jsx` | Migração de cores fixas para tokens de tema. |
| **Alterado** | `src/components/settings/QaProcessModal.jsx`, `QaProcessPreviewModal.jsx`, `src/components/FloatingExtensions.jsx`, `src/components/ChangePasswordModal.jsx` | Migração de cores fixas para tokens de tema. |
| **Alterado** | `src/data/changelogData.js` | `CURRENT_VERSION` para `v4.2.1` e nova entrada do changelog oficial. |
| **Alterado** | `version.md` | Notas de lançamento da versão `v4.2.1`. |
| **Alterado** | `log-att.md` | Registro desta atualização. |

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
