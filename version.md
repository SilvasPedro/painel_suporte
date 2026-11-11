# Changelog Semântico — Hubdesk

Todas as alterações notáveis deste projeto serão documentadas neste arquivo, seguindo o padrão [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [v4.10.0] - 2026-11-11

### 🎯 Destaque Principal
Nova tela **Smart Pre** para acompanhar os clientes do novo serviço, com relatos, tratativas e dashboard.

---

### 🚀 Novas Funcionalidades (Added)
- **Tela Smart Pre** (`/home?tab=smart_pre`): cadastro de clientes com data de instalação, contato após instalar (data e canal), problemas relatados, situação (em acompanhamento, em tratativa, resolvido) e tratativa (resolvido remotamente, visita técnica, acionamento do TI).
- **Relatos por cliente**: comentários no formato de Tarefas & Relatórios, gravados com `arrayUnion`, com atualização opcional da situação.
- **Dashboard**: saúde do serviço, taxa de contato, tempo médio/mediana até o primeiro contato, solicitações mais frequentes, tratativas, entradas x contatos por mês e fila em tratativa.
- **Filtros** por período, situação, tratativa, problema e busca por nome, código, telefone ou cidade.
- **Permissões**: módulo `smart_pre` na matriz do RBAC (Gestor, Supervisor e Apoio com ver/editar; Operacional sem acesso) e passo no tour guiado.

### 🔒 Segurança
- Nova coleção `smart_pre_clients` nas regras do Firestore, acessível à gestão, supervisão e ao cargo Apoio. **Publicar o `firestore.rules`.**

### 🧪 Testes
- 217 testes no total (cálculos da dashboard, validação, payload e renderização das telas).

### ⚠️ Observações
- A tela carrega até 600 clientes (os mais recentes). A regra do Firestore reconhece o cargo exato "Apoio" no cadastro do colaborador.

---

## [v4.9.0] - 2026-11-10

### 🎯 Destaque Principal
O bot do Discord envia DM ao solicitante de uma tarefa/relatório quando o status muda ou chega um comentário.

---

### 🚀 Novas Funcionalidades (Added)
- **Eventos `report_status` e `report_comment`** em `/api/notify-dm`: a DM vai ao solicitante (`creatorId`) com protocolo (ou título), novo status ou autor do comentário e link para `?tab=reports`. O texto do comentário nunca é enviado.
- **Disparo na tela de Tarefas & Relatórios** (formulário, modal de detalhes, painel lateral, atualização rápida e comentários) via `sendReportDm`.
- **Novos avisos em Configurações > Notificações**: "Mudança de status" e "Novo comentário", ativados por padrão.
- **Feedback discreto**: o gestor só vê aviso quando a DM sai ou falha; sem Discord vinculado, nada é exibido.

### 🔒 Segurança
- O servidor lê `critical_reports/{id}` com o token de quem chamou (regras do Firestore valem); status, protocolo e solicitante vêm do banco.
- Só gestão ou o responsável designado dispara; quem alterou a própria solicitação não recebe DM.
- Textos do relatório são higienizados (`cleanInline`) e menções são desativadas.

### 🧪 Testes
- 196 testes no total (novos: eventos de relatório no servidor e `sendReportDm`/mensagens no cliente).

### ⚠️ Observações
- Requer redeploy na Vercel e `DISCORD_BOT_TOKEN` configurado. A DM exige "Enviar DM aos colaboradores vinculados" marcado e salvo.

---

## [v4.8.2] - 2026-11-10

### 🎯 Destaque Principal
O envio de DM pulado por configuração deixa de ser silencioso: quem lança o item é avisado quando um colaborador com Discord vinculado deixaria de receber.

---

### 🚀 Novas Funcionalidades (Added)
- **Aviso na tela quando a DM é pulada por configuração** (`describeDmResult` com `reason` e `linked`): se algum destinatário tem o Discord vinculado e o envio de DM está desativado (ou o bloco `dm` nem existe na configuração salva antes da v4.8.0), a tela orienta a marcar "Enviar DM aos colaboradores vinculados" e salvar em Configurações > Notificações. Se o tipo de aviso está desmarcado nas DMs, informa o motivo.
- **Sem ruído para quem não usa DM**: se nenhum destinatário tem o Discord vinculado, nenhuma mensagem é exibida.
- **Contagem de vinculados sem leituras extras**: usa a lista de colaboradores já carregada em memória (`getCachedCollection`).
- **Registro no console** (`[DM Discord]`) de cada envio pulado, com o motivo e a quantidade de destinatários vinculados.

### 🧪 Testes
- 7 novos testes (169 no total): aviso com destinatário vinculado, configuração antiga sem o bloco `dm`, silêncio sem vinculados, evento desmarcado, lista de colaboradores indisponível e textos exibidos.

### ⚠️ Observações
- O botão "Enviar DM de teste" ignora a configuração da gestão (por isso funciona mesmo com a DM desativada), enquanto os avisos reais exigem "Enviar DM aos colaboradores vinculados" marcado e salvo.

---

## [v4.8.1] - 2026-11-10

### 🎯 Destaque Principal
**Diagnóstico do bot do Discord**: o token é limpo automaticamente e a tela de configuração mostra se o Discord o aceita, com o passo a passo para corrigir quando é recusado.

---

### 🚀 Novas Funcionalidades (Added)
- **Verificação do bot** (`getBotStatus`): `GET /api/notify-dm` consulta o Discord (`/users/@me`) sem enviar mensagem e devolve `{ configured, valid, reason?, botName? }`, com `reason` igual a `formato-invalido`, `recusado` ou `indisponivel`. Respostas definitivas ficam em cache por 60 segundos; o token nunca é devolvido.
- **Estado do bot na tela** (`describeBotStatus`): "Bot conectado: nome", "Token recusado pelo Discord", "O valor configurado não parece um token de bot", "Falta DISCORD_BOT_TOKEN na Vercel" ou "Não foi possível verificar o bot agora", com orientação de correção.
- **Passo a passo de correção** (`TOKEN_HELP`): copiar o token em Bot > Reset Token (não o Client Secret), atualizar `DISCORD_BOT_TOKEN` na Vercel sem aspas, espaços ou prefixo "Bot " e fazer um novo deploy. Também aparece na mensagem exibida a quem lança um item quando o Discord recusa o token.

### 🔄 Alterações (Changed)
- **Token tolerante** (`normalizeBotToken`): remove espaços e quebras de linha, aspas e o prefixo "Bot " antes do uso.
- **Formato validado** (`looksLikeBotToken`): valores sem as 3 partes separadas por ponto (Client Secret, Public Key, ID do aplicativo) são barrados antes de chamar o Discord, com resposta `502` e `reason: formato-invalido`; token recusado responde `502` com `reason: recusado`.
- `fetchBotStatus` passa a devolver o estado detalhado do bot (antes, apenas configurado ou não).

### 🧪 Testes
- 14 novos testes (162 no total): limpeza e formato do token, envio com token colado com sobras, motivos do 502, estado do bot (sem variável, formato inválido, aceito, recusado, indisponível e cache de 60 s) e textos da tela.

---

## [v4.8.0] - 2026-11-10

### 🎯 Destaque Principal
**Avisos por mensagem direta (DM) no Discord**, enviados por um bot, apenas a quem vinculou o próprio ID no perfil.

---

### 🚀 Novas Funcionalidades (Added)
- **Função serverless `/api/notify-dm`** (Vercel, `api/_lib/dm.js`): envia a DM pelo bot do Discord. Valida o ID token do Firebase (assinatura RS256 com as chaves públicas do Google, emissor, projeto e validade), aceita avisos de eventos somente da gestão (mesma regra do Firestore) e permite o evento `test` a qualquer usuário logado, apenas para si mesmo. O ID do Discord é lido do Firestore com o token de quem chamou, nunca vem do navegador. `GET /api/notify-dm` informa se o bot está configurado, sem expor segredos.
- **Mensagens**: avaliação semanal (pontuação da própria pessoa e data), feedback e 1:1 mensal (somente o aviso e o link para Meu Histórico, sem conteúdo) e teste. `allowed_mentions` vazio impede que a DM marque alguém.
- **Vínculo opcional em Meu Perfil** (`discordUserId`): campo com validação (17 a 20 dígitos), instruções para obter o ID, botão "Enviar DM de teste" e remoção do vínculo apagando o ID.
- **Configurações > Notificações**: bloco "DM no Discord (bot)" com o estado do bot, ativação, eventos (semanal, feedback e 1:1) e "Enviar DM de teste para mim".
- **Disparo nos três eventos** (lançamento semanal, feedback e 1:1 mensal) e resumo na tela para quem lançou (ex.: "5 DM(s) enviada(s) • 25 sem Discord vinculado"), incluindo orientações para DM bloqueada, bot sem token e token recusado.
- **Tratamento do Discord**: limite de requisições (429) com uma nova tentativa, DM bloqueada (50007), ID inválido, token recusado e envio com concorrência limitada.

### 🔄 Alterações (Changed)
- `server.ts` passa a expor `/api/notify-dm` no ambiente local; `.env.example` documenta `DISCORD_BOT_TOKEN` e `APP_URL` (sem valores).
- A configuração do webhook (`integrations/team_webhook`) ganha o bloco `dm` (`enabled` e `events`).

### 🔒 Segurança
- O token do bot existe somente nas variáveis de ambiente da Vercel (`DISCORD_BOT_TOKEN`); nunca no código, no navegador ou no repositório.
- IDs de destinatário são validados antes de montar caminhos do Firestore; limite de 100 destinatários por pedido.

### ⚠️ Observações
- O envio de DM funciona apenas no site publicado (Vercel). O colaborador precisa estar no mesmo servidor do bot e permitir mensagens diretas de membros do servidor.
- Para ativar: criar `DISCORD_BOT_TOKEN` na Vercel e fazer um novo deploy; vincular o ID em Meu Perfil; marcar "Enviar DM aos colaboradores vinculados" em Configurações > Notificações e salvar.

### 🧪 Testes
- 38 novos testes (148 no total): validação do token do Firebase (válido, expirado, outro projeto, assinatura falsa, kid desconhecido), permissões (401, 403, master, teste para si), envio e erros do Discord, destinatários sem vínculo, inativos e IDs perigosos, e o serviço do app (ativação, eventos, login, falhas e mensagens).

---

## [v4.7.2] - 2026-11-10

### 🎯 Destaque Principal
**Diagnóstico do webhook do canal**: o gestor passa a ver se o aviso ao canal saiu e, quando não saiu, o motivo.

---

### 🚀 Novas Funcionalidades (Added)
- **Resultado do aviso ao canal na tela** (`HUBDESK_WEBHOOK_RESULT` + `describeWebhookResult`): após lançar avaliação semanal, feedback ou 1:1, uma mensagem informa o resultado: enviado, enviado sem confirmação do serviço, falha de envio, webhook desativado, configuração ilegível (regras do Firestore não publicadas), evento desmarcado ou aviso repetido (proteção contra repetição). Webhook nunca configurado não exibe mensagem. O resultado também é registrado no console (`[Webhook]`).
- **Intervalo mínimo entre avisos iguais configurável** (`cooldownMinutes`): em branco usa o padrão de cada evento (10 min semanal; 30 min feedback e 1:1); `0` avisa sempre.
- **Alertas na tela de configuração**: faixa amarela quando o webhook está desativado (o teste funciona, mas os avisos automáticos não) ou há alterações não salvas; o salvamento com o webhook desativado avisa explicitamente.

### 🔄 Alterações (Changed)
- **Cache da configuração do webhook**: desativada ou ilegível é relida a cada 15 segundos (antes 5 minutos); ativa continua em 5 minutos. Ativar o webhook e lançar em seguida passa a funcionar sem esperar.
- `dispatchTeamWebhook` passa a classificar cada resultado por motivo (`not-configured`, `disabled`, `unreadable`, `event-off`, `cooldown`).

### 🧪 Testes
- 8 novos testes (110 no total): motivos de cada situação, intervalo configurável (inclusive 0), releitura da configuração desativada e mensagens ao usuário.

---

## [v4.7.1] - 2026-11-10

### 🎯 Destaque Principal
Avisos do **webhook do canal** agora são **genéricos** (sem nomes, notas ou conteúdo), com o link de Meu Histórico, mensagens editáveis por evento e proteção contra repetição.

---

### 🔄 Alterações (Changed)
- **Mensagens genéricas por evento** (`DEFAULT_WEBHOOK_MESSAGES`). Exemplo (avaliações semanais): "Atenção, pessoal! Foram lançadas as avaliações semanais de desempenho. Acessem {link} para visualizar!". O texto não cita pessoas, notas, quantidades ou datas.
- **Avisos de feedback e de 1:1 mensal** também passam a ser genéricos: antes o texto do 1:1 citava o colaborador e quem lançou, o que não cabe em um canal aberto.
- **Link dos avisos**: configurável; em branco, usa o endereço do site com `/home?tab=my_history` (Meu Histórico).
- **Discord** passa a receber texto simples (`content`) em vez de um embed, permitindo `@everyone` e `@here` no modelo da mensagem. Slack, Teams, Google Chat e URL genérica mantêm seus formatos, agora com o link dentro do texto.
- **Botão "Enviar teste"** envia um exemplo do aviso semanal real, marcado como teste.

### 🚀 Novas Funcionalidades (Added)
- **Mensagem personalizada por evento** em Configurações > Notificações, com `{link}` para posicionar o endereço (sem `{link}`, o endereço é acrescentado em nova linha) e campo para o link enviado.
- **Proteção contra repetição** (`WEBHOOK_COOLDOWN_MS`): o mesmo evento não é reenviado em menos de 10 minutos (avaliações semanais) ou 30 minutos (feedbacks e 1:1); envios que falham não ativam a proteção.

### 🧪 Testes
- 9 novos testes: troca de `{link}`, textos padrão sem dados pessoais, envio com texto e link personalizados, proteção contra repetição por evento e envio que falha. Teste do Discord ajustado ao texto simples (102 testes no total).

---

## [v4.7.0] - 2026-11-10

### 🎯 Destaque Principal
**Notificações otimizadas**: avisos pessoais por usuário (leitura mínima) e **webhook do canal da equipe** para novas avaliações semanais, feedbacks e avaliações 1:1 mensais.

---

### 🚀 Novas Funcionalidades (Added)
- **Avisos pessoais** (`notifications`): quem lança a avaliação semanal, o feedback ou o 1:1 mensal grava um aviso endereçado ao colaborador. Na avaliação semanal e no feedback, o aviso é gravado no mesmo lote do item (atômico).
- **Caixa de avisos no app**: `NotificationManager` e `NotificationContext` passam a escutar apenas os avisos não lidos do próprio usuário (`where toUserId == uid` e `read == false`), substituindo os listeners de `feedbacks` e `monthly_evaluations`. O indicador de Meu Histórico e o alerta em tempo real usam o mesmo listener compartilhado.
- **Marcação de lidos sem leituras extras**: ao abrir Meu Histórico, os avisos pendentes são marcados como lidos a partir da lista já mantida em memória.
- **Navegação pelo aviso**: o clique abre Meu Histórico na aba correta (feedbacks, métricas semanais ou 1:1 mensal) via `HUBDESK_OPEN_HISTORY_TAB`.
- **Webhook do canal da equipe** (`integrations/team_webhook`): em Configurações > Notificações, a gestão cadastra a URL, escolhe o serviço (Discord, Slack, Microsoft Teams, Google Chat ou URL genérica em JSON), seleciona os eventos e envia um teste. Mensagens com formato próprio de cada serviço.
- **Privacidade**: o canal recebe apenas um resumo do evento (quem lançou e o tipo), nunca o conteúdo de feedbacks ou 1:1; a URL é legível somente pela gestão.

### 🔄 Alterações (Changed)
- Lançamento semanal passa a gravar 2 documentos por colaborador (avaliação e aviso); lotes de 200 colaboradores.
- Registro de feedback (`registerFeedback`) passa a usar `writeBatch`.
- Removida a gravação antiga de notificação do 1:1 mensal (campos `userId` e `recipientId`), que nenhum trecho do sistema lia e que as regras bloqueavam.

### 🔒 Segurança (Firestore Rules)
- `notifications`: criação apenas pela gestão; leitura apenas pelo destinatário (ou gestão); o destinatário só altera `read` e `readAt`.
- `integrations`: leitura e escrita apenas pela gestão. **As regras precisam ser publicadas** (console ou `firebase deploy --only firestore:rules`).

### ⚠️ Observações
- O projeto está no plano Spark, que não executa Cloud Functions; o envio ao canal sai do navegador de quem lança o item (melhor esforço, sem nova tentativa). Alguns serviços não confirmam a entrega pelo navegador; use "Enviar teste" e confira o canal. No plano Blaze, o envio poderá migrar para o servidor.
- Feedbacks, avaliações semanais e 1:1 lançados antes desta versão não geram aviso retroativo.

### 🧪 Testes
- 18 novos testes: montagem dos avisos, formato por serviço, envio com e sem CORS, URL inválida, evento desmarcado, webhook desativado, usuário sem permissão e cache da configuração.

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
