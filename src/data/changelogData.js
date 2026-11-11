import { Palette, ShieldCheck, Sliders, Sparkles, Layout, Flame, History, Layers, Filter, CheckCircle2, Award, BarChart3, TrendingUp, Activity, Network, Moon, Sun, Coffee, User, Trophy, Zap, Mail, Phone, FileSpreadsheet, Edit2, Headphones, MessageSquare, Bell, Volume2, RefreshCw, FileText, Tag, CheckCheck, CalendarDays, Calendar, Target } from 'lucide-react';

export const CURRENT_VERSION = 'v4.10.0';

export const CHANGELOG_VERSIONS = [
  {
    version: 'v4.10.0',
    date: 'Novembro 2026',
    isCurrent: true,
    tag: 'Versão Atual',
    summary: 'Atualização v4.10.0: nova tela Smart Pre para a equipe de Apoio, Supervisão e Gestão acompanharem os clientes do novo serviço, com relatos, tratativas e dashboard de saúde do serviço.',
    items: [
      {
        icon: Layers,
        iconColor: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        title: 'Nova Tela Smart Pre',
        category: 'Novidade',
        description: 'Cadastro dos clientes que entram na base com o Smart Pre: data da instalação, contato após instalar, problemas relatados e tratativa (resolvido remotamente, visita técnica ou acionamento do TI), com filtros por situação, tratativa, problema e período.'
      },
      {
        icon: MessageSquare,
        iconColor: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
        title: 'Relatos por Cliente',
        category: 'Acompanhamento',
        description: 'Cada cliente tem um histórico de relatos no mesmo formato de Tarefas & Relatórios, com autor, cargo e data, e a possibilidade de atualizar a situação junto com o relato.'
      },
      {
        icon: Zap,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Dashboard de Acompanhamento',
        category: 'Indicadores',
        description: 'Saúde do serviço, clientes que entraram em contato, tempo médio e mediana até o primeiro contato, solicitações mais frequentes, tratativas (remoto x visita x TI), entradas x contatos por mês e fila de clientes em tratativa.'
      },
      {
        icon: ShieldCheck,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Permissões e Tour',
        category: 'Segurança',
        description: 'Novo módulo Smart Pre na matriz de permissões (Configurações): Gestor, Supervisor e Apoio com acesso por padrão. Regras do Firestore para a nova coleção e novo passo no tour guiado.'
      }
    ]
  },
  {
    version: 'v4.9.0',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Versão Anterior',
    summary: 'Atualização v4.9.0: o bot do Discord agora avisa por DM o solicitante de uma tarefa ou relatório sempre que o status muda ou chega um novo comentário, para acompanhar tudo em tempo real.',
    items: [
      {
        icon: MessageSquare,
        iconColor: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
        title: 'DM ao Solicitante em Tarefas & Relatórios',
        category: 'Notificações',
        description: 'Quando a gestão ou o responsável altera o status ou comenta em uma tarefa/relatório, o colaborador que a abriu (com Discord vinculado) recebe uma DM com o protocolo, o novo status ou quem comentou, e o link para Tarefas & Relatórios. O texto do comentário nunca é enviado.'
      },
      {
        icon: Bell,
        iconColor: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        title: 'Novos Tipos de Aviso nas Configurações',
        category: 'Integrações',
        description: 'Configurações > Notificações ganha os avisos "Mudança de status" e "Novo comentário", ativados por padrão e que podem ser desmarcados. Quem altera só vê aviso na tela quando a DM é enviada ou dá problema.'
      },
      {
        icon: ShieldCheck,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Dados Lidos no Servidor',
        category: 'Segurança',
        description: 'O servidor lê o relatório no Firestore com as permissões de quem chamou: protocolo, status e solicitante nunca vêm do navegador, e só gestão ou o responsável designado pode disparar o aviso.'
      }
    ]
  },
  {
    version: 'v4.8.2',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v4.8.2: quando um colaborador vinculou o Discord, mas a DM está desativada nas configurações (ou o tipo de aviso está desmarcado), quem lançou o item agora é avisado na tela em vez de o envio ser pulado em silêncio.',
    items: [
      {
        icon: Bell,
        iconColor: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        title: 'Aviso Quando a DM Seria Enviada, Mas Está Desativada',
        category: 'Notificações',
        description: 'Ao lançar avaliação semanal, feedback ou 1:1, se algum destinatário tem o Discord vinculado e o envio de DM está desativado ou o tipo de aviso está desmarcado, o sistema informa na tela e indica onde ativar em Configurações > Notificações. Se ninguém tem Discord vinculado, nada é exibido.'
      },
      {
        icon: Zap,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Diagnóstico das DMs Puladas no Console',
        category: 'Integrações',
        description: 'Todo envio de DM pulado por configuração passa a ser registrado no console do navegador com o motivo e a quantidade de destinatários com Discord vinculado, facilitando o suporte.'
      }
    ]
  },
  {
    version: 'v4.8.1',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v4.8.1: diagnóstico do bot do Discord. O token é limpo automaticamente (espaços, aspas e prefixo Bot), a tela de configuração mostra se o Discord aceita o token e, quando recusa, indica o passo a passo para corrigir.',
    items: [
      {
        icon: ShieldCheck,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Verificação do Bot Sem Enviar DM',
        category: 'Notificações',
        description: 'Em Configurações > Notificações, o bloco de DM consulta o Discord e informa se o bot está conectado (com o nome), se o token foi recusado, se o valor configurado não parece um token de bot ou se falta a variável na Vercel. O resultado é guardado por 60 segundos e nunca expõe o token.'
      },
      {
        icon: Zap,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Token Tolerante a Sobras de Colagem',
        category: 'Integrações',
        description: 'Espaços, quebras de linha, aspas e o prefixo Bot são removidos do token antes do uso. Valores que nem têm a forma de um token (como Client Secret, Public Key ou ID do aplicativo) são barrados sem chamar o Discord.'
      },
      {
        icon: Bell,
        iconColor: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        title: 'Orientação Clara Quando o Token é Recusado',
        category: 'Notificações',
        description: 'As mensagens de erro e o bloco de configuração trazem o passo a passo: copiar o token em Bot > Reset Token (não o Client Secret), atualizá-lo na Vercel sem aspas, espaços ou prefixo e fazer um novo deploy.'
      }
    ]
  },
  {
    version: 'v4.8.0',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v4.8.0: avisos por mensagem direta (DM) no Discord, enviados por um bot. Cada colaborador pode vincular o próprio ID do Discord no perfil e receber, em privado, o aviso de avaliação semanal, feedback e avaliação 1:1.',
    items: [
      {
        icon: MessageSquare,
        iconColor: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
        title: 'Avisos Privados por DM no Discord',
        category: 'Notificações',
        description: 'Ao lançar avaliação semanal, feedback ou 1:1 mensal, o bot do Hubdesk envia uma mensagem direta apenas ao colaborador vinculado. Por ser privada, a DM da avaliação semanal traz a pontuação da própria pessoa; feedback e 1:1 nunca trazem o conteúdo, apenas o aviso e o link para Meu Histórico. Quem lançou vê quantas DMs foram enviadas.'
      },
      {
        icon: User,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Vínculo Opcional do Discord no Perfil',
        category: 'Perfil',
        description: 'Em Meu Perfil, o colaborador informa o próprio ID do Discord (com instruções de como encontrá-lo), envia uma DM de teste e pode remover o vínculo a qualquer momento apagando o ID. Só recebe DM quem vinculou a conta.'
      },
      {
        icon: ShieldCheck,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Envio Seguro pelo Servidor',
        category: 'Segurança',
        description: 'O token do bot fica apenas nas variáveis de ambiente da Vercel. A função valida o login do usuário, aceita avisos de eventos somente da gestão (o teste vale só para si mesmo) e lê o ID do Discord do cadastro, nunca do navegador. Em Configurações > Notificações, a gestão ativa a DM, escolhe os eventos e vê se o bot está configurado.'
      }
    ]
  },
  {
    version: 'v4.7.2',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v4.7.2: diagnóstico do webhook do canal. Quem lança uma avaliação, um feedback ou um 1:1 passa a ver se o aviso ao canal saiu ou o motivo de não ter saído, a tela de configuração alerta sobre webhook desativado ou alterações não salvas e o intervalo entre avisos iguais é configurável.',
    items: [
      {
        icon: Bell,
        iconColor: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        title: 'Resultado do Aviso ao Canal na Tela',
        category: 'Notificações',
        description: 'Após lançar um item, o sistema informa se o aviso foi enviado ao canal ou por que não foi: webhook desativado, sem permissão para ler a configuração (regras do Firestore), evento desmarcado ou aviso igual enviado há poucos minutos. O mesmo registro aparece no console do navegador.'
      },
      {
        icon: Zap,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Configuração Mais Clara e Intervalo Ajustável',
        category: 'Integrações',
        description: 'A tela do webhook avisa quando ele está desativado (o teste funciona mesmo assim, mas os avisos automáticos não) e quando há alterações não salvas. Novo campo define o intervalo mínimo entre avisos iguais, com 0 para sempre avisar.'
      },
      {
        icon: RefreshCw,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Configuração Desativada é Relida em Segundos',
        category: 'Integrações',
        description: 'Quando o webhook está desativado, a configuração é relida a cada 15 segundos em vez de 5 minutos, então ativar o webhook e lançar em seguida passa a funcionar sem esperar.'
      }
    ]
  },
  {
    version: 'v4.7.1',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v4.7.1: os avisos do webhook passam a ser genéricos, sem nomes, notas ou conteúdo, com o link de Meu Histórico, mensagens editáveis por evento e proteção contra repetição.',
    items: [
      {
        icon: Bell,
        iconColor: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        title: 'Avisos Genéricos para o Canal da Equipe',
        category: 'Notificações',
        description: 'O canal passa a receber uma mensagem geral, como: Atenção, pessoal! Foram lançadas as avaliações semanais de desempenho. Acessem o link para visualizar! Nenhum nome, nota ou conteúdo é enviado, inclusive nos avisos de feedback e de 1:1 mensal, que antes citavam as pessoas.'
      },
      {
        icon: FileText,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Mensagem e Link Personalizáveis',
        category: 'Integrações',
        description: 'Em Configurações > Notificações é possível editar o texto de cada evento, usando {link} onde o endereço deve aparecer, e definir o link enviado (padrão: Meu Histórico do site). No Discord, a mensagem é texto simples e permite @everyone ou @here. O teste envia um exemplo do aviso real.'
      },
      {
        icon: ShieldCheck,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Proteção Contra Repetição',
        category: 'Integrações',
        description: 'O mesmo tipo de aviso não é reenviado em menos de 10 minutos (avaliações semanais) ou 30 minutos (feedbacks e 1:1), evitando dezenas de mensagens iguais quando vários itens são lançados em sequência.'
      }
    ]
  },
  {
    version: 'v4.7.0',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v4.7.0: notificações otimizadas. Feedbacks, avaliações semanais e avaliações 1:1 geram um aviso pessoal para o colaborador, que passa a ler apenas os próprios avisos em vez de coleções inteiras, e a gestão pode enviar um resumo dos eventos a um canal da equipe (Discord, Slack, Teams, Google Chat ou URL genérica).',
    items: [
      {
        icon: Bell,
        iconColor: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        title: 'Avisos Pessoais com Leitura Mínima',
        category: 'Notificações',
        description: 'Ao lançar avaliação semanal, feedback ou 1:1 mensal, o sistema grava um aviso endereçado ao colaborador junto com o item. O app dele escuta somente os avisos ainda não lidos, o indicador de Meu Histórico acende por eles e o clique abre a aba certa do histórico. Os avisos viram lidos ao abrir o histórico, sem leituras extras no banco.'
      },
      {
        icon: Zap,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Webhook do Canal da Equipe',
        category: 'Integrações',
        description: 'Em Configurações > Notificações, a gestão cadastra a URL de um canal (Discord, Slack, Microsoft Teams, Google Chat ou URL genérica em JSON), escolhe quais eventos enviar e testa o envio. O canal recebe apenas um resumo do evento, nunca o conteúdo de feedbacks ou 1:1, e a URL fica visível somente para a gestão.'
      },
      {
        icon: ShieldCheck,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Novas Regras de Segurança',
        category: 'Segurança',
        description: 'Coleção de avisos com criação restrita à gestão e leitura restrita ao destinatário, que só pode marcar como lido, e coleção de integrações acessível apenas à gestão. As regras precisam ser publicadas no Firebase.'
      }
    ]
  },
  {
    version: 'v4.6.0',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v4.6.0: tour guiado no primeiro acesso, com dois roteiros (Operacional e Apoio; Gestor e Supervisor), e renomeação do cargo Colaborador para Operacional.',
    items: [
      {
        icon: Sparkles,
        iconColor: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        title: 'Tour Guiado no Primeiro Acesso',
        category: 'Onboarding',
        description: 'Ao entrar pela primeira vez, o sistema escurece a tela, destaca com um retângulo cada área importante (menu, telas, busca, notificações e tema) e explica sua função. São dois roteiros: Operacional e Apoio, e Gestor e Supervisor, mostrando apenas as telas que o usuário pode acessar. Navegação por botões ou teclado e opção de rever o tour pelo botão Tour guiado no menu lateral.'
      },
      {
        icon: User,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Cargo Colaborador Agora é Operacional',
        category: 'Cargos & Permissões',
        description: 'O nome do cargo passou a ser Operacional em cadastros, edição, filtros, matriz de permissões, perfil e comentários de chamados. Registros antigos salvos como Colaborador continuam funcionando e são exibidos como Operacional, sem necessidade de migração.'
      }
    ]
  },
  {
    version: 'v4.5.1',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v4.5.1: correção do histórico de versões, que passa a abrir normalmente (ícone ausente na entrada da v4.5.0).',
    items: [
      {
        icon: ShieldCheck,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Correção na Tela de Novidades',
        category: 'Correção',
        description: 'O ícone usado na entrada da v4.5.0 não estava importado e poderia impedir a abertura do histórico de versões. A importação foi adicionada e o arquivo passou por verificação de identificadores não definidos.'
      }
    ]
  },
  {
    version: 'v4.5.0',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v4.5.0: a tela Meu Desempenho ganha os indicadores de aproveitamento Huggy e de finalizações com médias calculadas pelos lançamentos semanais e um seletor de tipo de gráfico (suave, área, linha, barras e degraus).',
    items: [
      {
        icon: Target,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Aproveitamento Huggy e Finalizações com Médias',
        category: 'Meu Desempenho',
        description: 'Novos cartões de Aproveitamento Huggy (média dos percentuais por lançamento e aproveitamento ponderado do período), Huggy Finalizados e Finalizações, com média semanal e total. Lançamentos antigos, sem o percentual, ficam fora da média de aproveitamento.'
      },
      {
        icon: BarChart3,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Gráficos com Tipos Alternáveis',
        category: 'Meu Desempenho',
        description: 'Seletor com cinco estilos de gráfico: Suave, Área, Linha, Barras e Degraus, aplicado a todos os gráficos da evolução semanal e lembrado pelo navegador. Foram adicionados os gráficos de Aproveitamento Huggy (eixo de 0 a 100%) e de Finalizações com duas séries.'
      }
    ]
  },
  {
    version: 'v4.4.0',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v4.4.0: perfil do usuário com capa ajustável. Agora é possível reposicionar e ampliar a imagem de capa, com pré-visualização ao vivo, e a opção de biografia foi removida.',
    items: [
      {
        icon: Palette,
        iconColor: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        title: 'Ajuste de Enquadramento da Capa',
        category: 'Perfil',
        description: 'Ao usar uma imagem de capa por link, é possível arrastar a imagem na pré-visualização, ajustar a posição horizontal e vertical e aplicar zoom de 100% a 300% a partir do ponto escolhido. O botão Restaurar padrão volta ao enquadramento original e a capa do perfil exibe exatamente o que foi configurado.'
      },
      {
        icon: User,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Biografia Removida do Perfil',
        category: 'Perfil',
        description: 'O campo Legenda / Bio Profissional foi retirado da tela de perfil e deixou de ser gravado. Os textos já salvos permanecem no banco, mas não são mais exibidos.'
      }
    ]
  },
  {
    version: 'v4.3.1',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v4.3.1: o modelo de métricas para download passa a seguir a mesma ordem de colunas da tela de lançamento semanal, com Ligações Realizadas e Huggy Iniciados/Finalizados agrupados de forma lógica.',
    items: [
      {
        icon: FileSpreadsheet,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Modelo de Métricas Reorganizado',
        category: 'Avaliações Semanais',
        description: 'O CSV de modelo agora segue a ordem da tela: Ligações Atendidas, Perdidas e Realizadas, TMA e TME de Telefonia, Huggy Iniciados e Finalizados, TMA Huggy e Atendimentos Finalizados. A importação lê as colunas pelo nome do cabeçalho, então modelos antigos continuam aceitos.'
      }
    ]
  },
  {
    version: 'v4.3.0',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v4.3.0: novas métricas nas avaliações semanais. Ligações Realizadas passam a ser lançadas e valem 1 ponto, e o Huggy ganha Iniciados x Finalizados com cálculo do % de aproveitamento (0,5 ponto por 1%). Registros antigos mantêm a pontuação original.',
    items: [
      {
        icon: Headphones,
        iconColor: 'text-teal-500 bg-teal-500/10 border-teal-500/20',
        title: 'Ligações Realizadas nas Avaliações Semanais',
        category: 'Avaliações Semanais',
        description: 'Novo campo de ligações realizadas (ativas) no lançamento, valendo +1 ponto por ligação. O dado aparece em Rankings, Meu Histórico, desempenho semanal detalhado, Gerenciador de Dados (filtro, cartão, edição e composição do cálculo) e em todas as exportações. O modelo CSV ganhou a coluna e arquivos antigos continuam sendo importados.'
      },
      {
        icon: MessageSquare,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Huggy Iniciados x Finalizados com % de Aproveitamento',
        category: 'Avaliações Semanais',
        description: 'O campo Atendimentos Huggy foi substituído por Huggy Iniciados e Huggy Finalizados. O aproveitamento (finalizados ÷ iniciados, inteiro e limitado a 100%) vale 0,5 ponto por 1%, até 50 pontos. A tela de lançamento calcula o percentual e os pontos em tempo real e a confirmação avisa quando finalizados supera iniciados.'
      },
      {
        icon: ShieldCheck,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Cálculo Centralizado e Compatível com o Histórico',
        category: 'Pontuação',
        description: 'Fórmula única em scoringCalculations (usada por lançamento, Visão Geral, Hub, relatórios, rankings e exportações). Registros antigos, que possuem apenas Atendimentos Huggy, mantêm +1 ponto por atendimento e a pontuação já gravada. A importação CSV passou a ler as colunas pelo nome do cabeçalho.'
      }
    ]
  },
  {
    version: 'v4.2.2',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v4.2.2: lançamento de avaliações semanais mais seguro. Nova tela de confirmação mostra quem não receberá avaliação antes de salvar, a gravação passa a ser atômica em lote, a importação CSV avisa nomes não encontrados e o texto do botão de turnos "Todos" voltou a ser legível.',
    items: [
      {
        icon: ShieldCheck,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Confirmação Antes de Salvar o Lançamento',
        category: 'Avaliações Semanais',
        description: 'Ao salvar, o sistema lista quais colaboradores estão marcados para não receber nada, os pontos de atenção (campos vazios gravados como 0, valores inválidos e tempos fora do formato HH:MM:SS) e os ativos sem turno que ficam fora da lista. É possível confirmar ou voltar para revisar, com as linhas vazias destacadas.'
      },
      {
        icon: Zap,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Gravação Atômica e Importação CSV Confiável',
        category: 'Avaliações Semanais',
        description: 'As avaliações são gravadas em um único lote (todas ou nenhuma), evitando duplicidades em nova tentativa após falha parcial. A importação CSV ignora diferenças de acento e espaços nos nomes e informa quais linhas não foram encontradas. Campos só com espaços deixam de contar como preenchidos.'
      },
      {
        icon: Palette,
        iconColor: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
        title: 'Correção do Texto Branco nos Filtros de Turno',
        category: 'UX / UI',
        description: 'O botão ativo "Todos" ficava sem fundo e com texto branco, ilegível. Foram criadas as classes de fundo dos tokens de tema, corrigindo também o mesmo padrão em Demanda & Fila Diária e Feedbacks 1:1.'
      }
    ]
  },
  {
    version: 'v4.2.1',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v4.2.1: segunda fase da otimização. O perfil deixa de baixar auditorias de toda a equipe, a importação CSV da Auditoria Terceirizada passa a gravar em lotes e 15 telas e modais migraram das cores fixas para os tokens de tema (claro, morno e escuro).',
    items: [
      {
        icon: Zap,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Emblemas do Perfil com Leituras Mínimas',
        category: 'Performance',
        description: 'A tela Meu Perfil agora consulta apenas as auditorias QA do colaborador exibido e deixou de ler as auditorias terceirizadas, que nunca eram atribuídas a um colaborador no cálculo dos emblemas. O resultado dos emblemas permanece o mesmo.'
      },
      {
        icon: Layers,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Importação CSV em Lote',
        category: 'Performance',
        description: 'A importação de auditorias terceirizadas usa writeBatch (até 400 operações por commit) e grava cada operador uma única vez, reduzindo centenas de escritas sequenciais a poucos commits.'
      },
      {
        icon: Palette,
        iconColor: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
        title: 'Telas e Modais nos Tokens de Tema',
        category: 'UX / UI',
        description: 'Gerenciador de Dados, Rankings, KPIs do Setor, Escalas, Relatório do Colaborador e os modais de colaborador, feedback, processo QA e senha passaram a usar fundos, bordas e textos do tema, acompanhando os modos claro, morno e escuro de forma nativa.'
      }
    ]
  },
  {
    version: 'v4.2.0',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v4.2.0: otimização de leituras do Firestore. Cada usuário passa a baixar apenas os próprios registros, os limites de coleções volumosas agora vêm acompanhados de ordenação por mais recentes e a Auditoria Terceirizada lê somente os dados da empresa selecionada.',
    items: [
      {
        icon: Zap,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Consultas Escopadas por Colaborador',
        category: 'Performance',
        description: 'Notificações, Meu Histórico e Meu Desempenho deixaram de baixar coleções inteiras (feedbacks, avaliações mensais, auditorias e chamados) e passaram a consultar apenas os registros do próprio usuário, reduzindo drasticamente as leituras por sessão e corrigindo a falha de permissão em feedbacks para colaboradores.'
      },
      {
        icon: Layers,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Limites com Ordenação (Mais Recentes Primeiro)',
        category: 'Performance',
        description: 'Coleções volumosas (avaliações semanais, auditorias QA, feedbacks, chamados, auditorias terceirizadas e demanda diária) agora combinam limit com orderBy, evitando que registros novos sejam descartados quando o limite é atingido. Há fallback automático caso um índice esteja ausente.'
      },
      {
        icon: Headphones,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Auditoria Terceirizada Otimizada por Empresa',
        category: 'Performance',
        description: 'A ATSOC usa listener em tempo real restrito aos próprios documentos; a UpCall (histórico) é lida uma única vez com cache de 45 minutos, sem listener aberto. A Visão Geral passa a exibir os indicadores da terceirizada somente da ATSOC.'
      }
    ]
  },
  {
    version: 'v4.1.1',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v4.1.1: reformulação completa do tema Morno (sépia). Paleta de linho, creme e café espresso aplicada à tela inteira, com barra lateral, cartões de destaque, modais, formulários, tabelas, badges, gráficos e botões de ação em terracota, finalmente harmonizados.',
    items: [
      {
        icon: Coffee,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Barra Lateral em Café Espresso',
        category: 'Tema Morno',
        description: 'A barra lateral e a gaveta mobile deixaram de ser pretas e passaram a usar tons de café espresso, com texto em creme, item ativo, indicadores e brilhos em terracota claro, harmonizados com o restante da tela.'
      },
      {
        icon: Palette,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Nova Paleta Sépia e Cor de Marca em Terracota',
        category: 'Tema Morno',
        description: 'Tokens de cor refinados (linho, creme, bordas e textos terrosos) e vermelho/rosa de marca convertidos em terracota nos botões de ação, eyebrows e destaques, mantendo o vermelho apenas onde indica status negativo.'
      },
      {
        icon: Layers,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Cobertura Total dos Elementos',
        category: 'Tema Morno',
        description: 'O tema agora vale para a tela inteira (não só o conteúdo principal): cabeçalho, modais e overlays, cartões escuros de destaque, formulários com foco em terracota, tabelas, badges, gráficos, barras de rolagem e documentos Markdown.'
      }
    ]
  },
  {
    version: 'v4.1.0',
    date: 'Novembro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v4.1.0: Auditoria Terceirizada com seletor de empresa (ATSOC atual e UpCall como histórico somente leitura), modal de Auditorias QA redesenhado com filtros, atalhos e data da auditoria corrigida, calendário de folgas em cards quadrados e padronização dos títulos de 12 telas no estilo de Tarefas & Relatórios.',
    items: [
      {
        icon: Headphones,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Auditoria Terceirizada com Seleção de Empresa (ATSOC / UpCall)',
        category: 'Auditoria Terceirizada',
        description: 'Novo seletor de empresa no topo da tela. A ATSOC é a operação atual; os dados da UpCall (antiga terceirizada) ficam preservados em modo somente consulta. Métricas, filtros, CSV e PDF respeitam a empresa selecionada, e registros antigos sem o campo são tratados como UpCall automaticamente.'
      },
      {
        icon: ShieldCheck,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Modal de Auditorias QA Redesenhado',
        category: 'Auditorias QA',
        description: 'Coluna de pontuação fixa durante a rolagem, filtros da checklist (Todos, Pendentes e Falhas), botão Próximo pendente, atalho Hoje na data, tecla Esc para fechar, aviso de critérios sem resposta ao salvar e numeração colorida por resultado.'
      },
      {
        icon: Layout,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Correções de Data e Canal nas Auditorias QA',
        category: 'Auditorias QA',
        description: 'O campo de data passou a se chamar Data da Auditoria (dia em que a auditoria foi feita, não do atendimento). O canal de comunicação foi reduzido a Telefone e WhatsApp / Chat, com migração visual dos registros antigos de WhatsApp e Chat. Filtros movidos para o topo da tela, abaixo do título.'
      },
      {
        icon: Coffee,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Escala de Folgas em Cards Quadrados',
        category: 'Escalas',
        description: 'Cada dia do mês agora é um card quadrado arredondado, com destaque para hoje e para feriados de 100% H.E, preservando arrastar e soltar, adição rápida e remoção de folgas.'
      },
      {
        icon: Sparkles,
        iconColor: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
        title: 'Padronização dos Títulos e Visual Moderno',
        category: 'UX / UI',
        description: '12 telas adotaram o padrão de título de Tarefas & Relatórios (linha de contexto em rosa e título na fonte da marca, sem cartão de fundo). Métricas, filtros e tabela de Auditorias QA ganharam visual mais arredondado com barras de progresso, usando os tokens de tema claro, quente e escuro.'
      }
    ]
  },
  {
    version: 'v3.11.0',
    date: 'Outubro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v3.11.0: Refatoração completa da tela de Feedbacks 1:1 (Análise Mensal). Adoção do modelo consolidado em Markdown rico com tabelas, PDI e alinhamentos de metas, fluxo de confirmação de ciência (Estou Ciente) com auditoria de data/hora/usuário, total retrocompatibilidade em modo somente leitura (Read-only com banner contextual) para os feedbacks legados baseados nos 4 pilares, e novos indicadores visuais na listagem.',
    items: [
      {
        icon: FileText,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Novo Formato de Feedback 1:1 em Markdown Consolidado',
        category: 'Feedbacks 1:1',
        description: 'Redação e visualização rica com suporte nativo a títulos, listas, tabelas de metas/PDI, citações e código formatado com sanitização estrita (react-markdown, remark-gfm e rehype-sanitize) e tipografia fluida responsiva.'
      },
      {
        icon: CheckCheck,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Fluxo de Ciência e Auditoria (Estou Ciente / Marcar como Lido)',
        category: 'Compliance & Auditoria',
        description: 'Botão de confirmação de leitura ao final do documento com registro permanente no Firestore da data, hora, UID e nome do colaborador, além de exibição de badge de confirmação e rastreamento de pendências.'
      },
      {
        icon: History,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Modo Legado Protegido (4 Pilares)',
        category: 'Retrocompatibilidade',
        description: 'Preservação integral dos históricos anteriores dos 4 pilares (Produtividade, Qualidade, Comportamento e Pontualidade) em modo somente leitura (Read-only) com banner visual indicativo no topo.'
      },
      {
        icon: Sparkles,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Indicadores Visuais e Usabilidade Aprimorada na Listagem',
        category: 'UX / UI',
        description: 'Badges distintivos de formato (Markdown vs. Legado), status claro de leitura (Confirmado vs. Pendente de Leitura) e filtros por formato, status e mês de referência tanto na gestão quanto em Meu Histórico.'
      }
    ]
  },
  {
    version: 'v3.10.1',
    date: 'Outubro 2026',
    isCurrent: false,
    tag: 'Versão Anterior',
    summary: 'Atualização v3.10.1: Melhorias completas na tela de Tarefas & Relatórios — suporte a Markdown rico (GFM com tabelas, listas e blocos de código) com sanitização estrita contra XSS, gestão de Responsável (assigned_to) e Visualizadores (watchers somente leitura), destaque do Departamento de Origem no cabeçalho e metadados, políticas refinadas de visibilidade RBAC/RLS e correção de contraste WCAG AA nos cartões de status nos temas Claro e Morno.',
    items: [
      {
        icon: FileText,
        iconColor: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
        title: 'Markdown Rico com Tabelas e Sanitização Anti-XSS',
        category: 'Tarefas & Relatórios',
        description: 'Renderização segura de descrições em Markdown (GitHub Flavored Markdown via remark-gfm e rehype-sanitize), suportando tabelas responsivas, checklists, links e código com proteção contra scripts maliciosos.'
      },
      {
        icon: User,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Atribuição de Responsável, Visualizadores e Departamento de Origem',
        category: 'Governança & Fluxo',
        description: 'Seleção de colaborador responsável (com direcionamento automático a Gestores e Supervisores quando sem responsável), adição de múltiplos Visualizadores em modo somente leitura e exibição em destaque do Departamento de Origem.'
      },
      {
        icon: ShieldCheck,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Matriz Estrita de Visibilidade e Controle de Acesso (RLS)',
        category: 'Segurança & Privacidade',
        description: 'Isolamento rigoroso na listagem e no acesso direto: colaboradores visualizam apenas tarefas onde são autores, responsáveis ou visualizadores, enquanto Gestores e Supervisores recebem também todas as demandas sem responsável atribuído.'
      },
      {
        icon: Palette,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Correção de Contraste dos Cartões de Status (Temas Claro e Morno)',
        category: 'UI & Acessibilidade',
        description: 'Revisão das classes de estado ativo nos cartões de filtro de status, garantindo alto contraste tipográfico (WCAG AA/AAA) nos modos Claro, Morno e Escuro.'
      }
    ]
  },
  {
    version: 'v3.10.0',
    date: 'Outubro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v3.10.0: Lançamento do novo módulo de Escala de Folgas (com grade de calendário, cards e suporte a nomes e sobrenomes para homônimos), unificação das Escalas Diária e de Plantão com abas recolhíveis por padrão e botões de atalho, e harmonização visual completa da tela Meu Desempenho com cartões de cor sólida, ícones no canto superior direito e cartão de Próxima Folga sincronizado em tempo real.',
    items: [
      {
        icon: Coffee,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Módulo Completo de Escala de Folgas',
        category: 'Escalas & Gestão',
        description: 'Nova tela independente de folgas com visualização em Calendário Mensal e Cards agrupados, atribuição por drag & drop de colaboradores ativos e identificação clara de nome e sobrenome nos cards para evitar confusão entre homônimos.'
      },
      {
        icon: CalendarDays,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Escalas Diária e de Plantão Unificadas',
        category: 'Operação & Produtividade',
        description: 'Unificação em tela operacional única com switch rápido. Na Escala Diária, os postos de Telefonia, Huggy/Chat e Apoio vêm recolhidos por padrão com destaque da contagem de pessoas alocadas, além de atalhos para Expandir Tudo e Recolher Tudo.'
      },
      {
        icon: Layout,
        iconColor: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
        title: 'Meu Desempenho: Cartões Sólidos & Próxima Folga',
        category: 'Visão do Colaborador',
        description: 'Harmonização visual completa no padrão da Visão Geral de KPIs: cartões de Minha Tarefa Hoje, Próximo Plantão e Próxima Folga em linha única com cor sólida escura, ícones no canto superior direito e sincronização direta com a grade de folgas.'
      },
      {
        icon: TrendingUp,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Gestão Estratégica de KPIs do Setor Redesenhada',
        category: 'Gestão Estratégica',
        description: 'Cockpit executivo no topo com cards escuros sólidos e ícones no canto direito, gráficos com linhas de meta dinâmicas e tooltips glassmorphism, filtros flexíveis de período, alternância entre visão individual e consolidada, exportação CSV e tabela CRUD com edição e exclusão de lançamentos.'
      }
    ]
  },
  {
    version: 'v3.9.0',
    date: 'Outubro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v3.9.0: Grande reformulação no módulo de Perfis dos Usuários e Gamificação. Implementação do novo motor de Insígnias e Emblemas de Feitos com 6 conquistas oficiais 100% calculadas de forma automatizada pelas avaliações semanais e auditorias QA, sem intervenção manual de gestores. Obrigatoriedade de preenchimento de Telefone/WhatsApp e Ramal ao entrar no sistema, personalização da capa do perfil com 8 opções de cores e suporte a imagem HTTPS, e remoção da seção não metrificável de conhecimento técnico em redes.',
    items: [
      {
        icon: Trophy,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: '6 Emblemas Oficiais 100% Automatizados',
        category: 'Gamificação & Feitos',
        description: 'Cálculo automatizado a partir dos dados reais da operação: Desempenho (>= 95% do turno), Auditorias QA (>= 85%), Agilidade TMA (Voz < 10m & Chat < 25m), Fila Limpa (Perdidas <= 2% contra atendidas), Produtividade Mestre (>= 40 finalizados/sem) e Constância de Ouro (100% semanas positivas).'
      },
      {
        icon: Phone,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Obrigatoriedade de Contato e Ramal ao Entrar',
        category: 'Segurança & Comunicação',
        description: 'Verificação automática pós-login: se o usuário não possuir telefone/WhatsApp ou número de ramal cadastrado, a plataforma exibe modal bloqueante exigindo o preenchimento para continuidade do uso.'
      },
      {
        icon: Palette,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Personalização do Banner de Capa do Perfil',
        category: 'Identidade & Customização',
        description: 'Remoção da tag estática de perfil oficial e adição de seletor com 8 opções de cores/gradientes modernos, além da possibilidade de inserir link HTTPS para imagem de capa personalizada visível para todos os colegas.'
      },
      {
        icon: Sparkles,
        iconColor: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
        title: 'Remoção da Seção Manual de Redes',
        category: 'Otimização de Perfil',
        description: 'Eliminação da seção de conhecimento técnico em redes, simplificando o perfil e priorizando indicadores objetivos e metrificados da rotina de atendimento.'
      }
    ]
  },
  {
    version: 'v3.8.4',
    date: 'Outubro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v3.8.4: Reformulação completa do sistema de Feedbacks. Modal de lançamento do Gestor/Supervisor com estrutura guiada (Elogio, Orientação e Ponto de Melhoria com erro/conduta/prazo), canal de observação, seleção obrigatória de Protocolo/ID e tags de competências. Nova aba em Configurações para gestão de tags, reformulação visual moderna na visão do usuário e coluna de status de leitura na Gestão de Dados.',
    items: [
      {
        icon: MessageSquare,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Modal Estruturado do Gestor / Supervisor',
        category: 'Lançamento de Feedbacks',
        description: 'Fluxo guiado por categoria: Elogio (motivo), Orientação (conduta orientada) e Ponto de Melhoria (erro observado, forma correta e prazo). Canal de observação e Switch Sim/Não obrigatório para Protocolo/ID.'
      },
      {
        icon: Tag,
        iconColor: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
        title: 'Gestão de Tags de Competências em Configurações',
        category: 'Personalização & Tags',
        description: 'Aba dedicada na tela de configurações para adicionar, editar e remover tags (Processo, Agilidade, Conhecimento, Qualidade, Cooperação, Pontualidade, Comportamento).'
      },
      {
        icon: CheckCircle2,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Coluna e Controle de Leitura na Gestão de Dados',
        category: 'Gestão de Dados & Auditoria',
        description: 'Coluna dedicada na tabela de feedbacks indicando em tempo real se o colaborador marcou como lido (com data/hora) ou pendente, com contadores de resumo e filtros dedicados.'
      },
      {
        icon: Sparkles,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Visão do Colaborador Totalmente Reformulada',
        category: 'Experiência do Usuário',
        description: 'Design moderno em Meu Histórico com tags destacadas, protocolo, canal e modal de detalhes completo com cards dedicados para cada tipo de retorno.'
      }
    ]
  },
  {
    version: 'v3.8.3',
    date: 'Outubro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v3.8.3: Aprimoramento completo do sistema de notificações. O ícone de notificações na barra superior agora registra o histórico persistente das notificações recentes com ações para marcar como lida e apagar. Além disso, a barra lateral conta com indicador visual de bolinha vermelha pulsante em "Meu Histórico" (ao receber novos feedbacks) e em "Tarefas & Relatórios" (para novas solicitações e atualizações de status).',
    items: [
      {
        icon: Bell,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Histórico Recente de Notificações',
        category: 'Central de Notificações',
        description: 'Registro cronológico persistente de todos os feedbacks recebidos, novos relatórios despachados e alterações de status, com filtro entre todas e não lidas.'
      },
      {
        icon: CheckCircle2,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Ações de Marcar como Lida e Apagar',
        category: 'Gestão de Avisos',
        description: 'Controle individual para marcar avisos como lidos ou apagá-los do histórico, além de navegação direta com 1 clique para o feedback ou relatório correspondente.'
      },
      {
        icon: Sparkles,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Bolinha Vermelha Pulsante na Barra Lateral',
        category: 'Alertas Visuais em Tempo Real',
        description: 'Indicadores animados na barra lateral destacam instantaneamente a chegada de novos feedbacks em "Meu Histórico" e de novas demandas/atualizações em "Tarefas & Relatórios".'
      }
    ]
  },
  {
    version: 'v3.8.2',
    date: 'Outubro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v3.8.2: Melhoria na exportação de auditorias da equipe terceirizada. Os protocolos de atendimento (como 2610.XXXXX e protocolos longos do ERP MK) agora são exportados estritamente como texto puro no arquivo .CSV para evitar conversão indevida ou notação científica no Excel, e foi adicionada a exportação oficial em formato .PDF para facilitar o anexo e compartilhamento dos protocolos unificados.',
    items: [
      {
        icon: FileSpreadsheet,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Preservação de Protocolos em Texto no CSV',
        category: 'Auditorias & Exportação',
        description: 'Aplicação da sintaxe de texto puro ="..." em todos os protocolos terceirizados e do ERP, impedindo que o Excel os converta em números decimais com vírgula ou em notação científica exponencial.'
      },
      {
        icon: FileText,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Nova Exportação em PDF Formatado',
        category: 'Documentos & Anexos',
        description: 'Geração com 1 clique de relatório oficial em formato A4 Paisagem com mini painel de KPIs (Conformidade, Qualidade e FCR) e tabela completa pronta para anexar em chamados.'
      },
      {
        icon: Sparkles,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Download Seguro via Blob UTF-8 BOM',
        category: 'Performance & Compatibilidade',
        description: 'Substituição de data-URI por Blob nativo com cabeçalho UTF-8 BOM, garantindo que acentos e caracteres especiais abram com perfeição em qualquer versão do Excel.'
      }
    ]
  },
  {
    version: 'v3.8.1',
    date: 'Outubro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v3.8.1: Notificações Inteligentes para Tarefas & Relatórios. Notificação automática no navegador para usuários com role de Gestor sempre que uma nova solicitação/relatório for aberto no sistema, e notificação instantânea para o solicitante sempre que o status do seu chamado for alterado pela liderança.',
    items: [
      {
        icon: Bell,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Novo Relatório para Gestores',
        category: 'Demandas & Alertas',
        description: 'Usuários com perfil de Gestor/Supervisor recebem notificação nativa imediata no navegador com link direto quando qualquer colaborador abrir uma nova demanda crítica.'
      },
      {
        icon: RefreshCw,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Atualização de Status para o Solicitante',
        category: 'Acompanhamento de Chamados',
        description: 'O colaborador que abriu o relatório é notificado assim que a liderança alterar o status (ex: Em Andamento, Resolvido) ou emitir parecer oficial.'
      },
      {
        icon: Sparkles,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Central de Notificações com Simuladores',
        category: 'Validação & Testes',
        description: 'Novo menu de testes no sino do cabeçalho permitindo simular com 1 clique a chegada de relatórios para gestores e mudanças de status para colaboradores.'
      }
    ]
  },
  {
    version: 'v3.8.0',
    date: 'Outubro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v3.8.0: Notificações Push no Navegador em tempo real. Agora, quando a liderança registrar um Feedback (Elogio, Ponto de Melhoria ou Orientação) para qualquer colaborador (ex: Eduardo Caetano), o colaborador com o sistema aberto recebe um alerta nativo do sistema operacional/navegador com sinal sonoro suave e foco imediato para visualização e confirmação de leitura.',
    items: [
      {
        icon: Bell,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Notificações Push Web em Tempo Real',
        category: 'Alertas & Desempenho',
        description: 'Sincronização imediata via Firestore e Service Worker: popups nativos na tela avisando sobre novos feedbacks recebidos, mesmo com o navegador minimizado ou em outra aba.'
      },
      {
        icon: Sparkles,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Central de Notificações no Topo',
        category: 'Interface & Produtividade',
        description: 'Novo sino interativo com indicador de permissão, contagem de feedbacks pendentes, botão de disparo de testes de notificação e simulação de feedback.'
      },
      {
        icon: Volume2,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Sinal Sonoro Sintetizado (Chime Harmônico)',
        category: 'Acessibilidade & Áudio',
        description: 'Alerta acústico gerado nativamente via Web Audio API, com controle direto para ligar ou mutar o som nas preferências.'
      },
      {
        icon: History,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Abertura e Foco Automático ao Clicar',
        category: 'Usabilidade & Navegação',
        description: 'Ao clicar no popup de notificação, a janela do HubDesk é trazida para frente e o modal do feedback é aberto automaticamente.'
      }
    ]
  },
  {
    version: 'v3.7.4',
    date: 'Outubro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v3.7.4: Reformulação da tela para "Tarefas & Relatórios", novo sistema colaborativo de comentários em sequência para interação contínua entre solicitante e gestão diretamente dentro do chamado (sem precisar recriar ou editar o relato original), e remoção definitiva da opção de imprimir relatório.',
    items: [
      {
        icon: Layout,
        iconColor: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        title: 'Novo Nome Oficial: Tarefas & Relatórios',
        category: 'Navegação & Identidade',
        description: 'Padronização da nomenclatura em todos os menus, navegação lateral do gestor e do colaborador, controle de permissões RBAC e cabeçalhos operacionais.'
      },
      {
        icon: MessageSquare,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Interação Contínua em Comentários na Solicitação',
        category: 'Colaboração & Atendimento',
        description: 'Canal de mensagens em sequência dentro do ticket: gestores solicitam dados pendentes e colaboradores complementam em tempo real com respostas e protocolos sem alterar o original.'
      },
      {
        icon: ShieldCheck,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Interface Mais Limpa & Remoção de Impressão',
        category: 'Usabilidade',
        description: 'Remoção do botão de impressão física de relatórios para priorizar o fluxo ágil digital e a cópia de resumos formatados para a área de transferência.'
      }
    ]
  },
  {
    version: 'v3.7.3',
    date: 'Outubro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v3.7.3: Redesenho e modernização da tela de Visão Geral KPIs. Remoção do card de % QA dos Indicadores Estratégicos Globais, nova sessão dedicada aos Indicadores da Terceirizada (FCR, Conformidade e % de Qualidade), novo design visual moderno com efeito de vidro (glassmorphism), ícones transparecidos em segundo plano com gradientes temáticos, padronização tipográfica universal (sem fontes blocadas) e navegação interativa direta para Relatórios Críticos ao clicar no cartão de Demandas Pendentes com animação suave de hover.',
    items: [
      {
        icon: Headphones,
        iconColor: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
        title: 'Nova Sessão de Indicadores da Terceirizada',
        category: 'Auditorias & Terceirizada',
        description: 'Métricas consolidadas de FCR (First Call Resolution), Índice de Conformidade de Procedimentos e % de Qualidade Positiva dos atendimentos terceirizados em tempo real.'
      },
      {
        icon: Palette,
        iconColor: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
        title: 'Novo Design Glassmorphism & Ícones de Fundo',
        category: 'Design & Interface',
        description: 'Efeito de vidro elegante, degradês contemporâneos e ícones transparecidos integrados ao fundo dos cartões substituindo os ícones antigos do canto superior.'
      },
      {
        icon: Zap,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Navegação Direta para Relatórios Críticos',
        category: 'Experiência & Interatividade',
        description: 'Ao clicar no cartão de Demandas Pendentes, o usuário é direcionado instantaneamente para a tela de Relatórios Críticos com animação sutil e suave de hover.'
      }
    ]
  },
  {
    version: 'v3.7.2',
    date: 'Outubro 2026',
    isCurrent: false,
    tag: 'Estável',
    summary: 'Atualização v3.7.2: Novo fluxo operacional da Auditoria Terceirizada com importação em lote via arquivo .CSV (Data e Protocolo), descarte automático de protocolos duplicados, indicador no topo com % de progresso e contador de pendentes de preenchimento, edição ágil para preencher todas as colunas pendentes (Protocolo MK, Cliente, Operador, Processo, Procedimento, Qualidade, Saída FCR e Parecer), modelo oficial de CSV para download e padronização exclusiva em chamadas Atendidas.',
    items: [
      {
        icon: FileSpreadsheet,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Importação em Lote via .CSV',
        category: 'Produtividade & Automação',
        description: 'Permite importar arquivo .CSV contendo a data e o protocolo dos atendimentos a serem auditados, com botão de download de modelo padrão de CSV pré-formatado.'
      },
      {
        icon: ShieldCheck,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Descarte Automático de Protocolos Já Existentes',
        category: 'Integridade de Dados',
        description: 'Caso o arquivo CSV contenha protocolos que já existam no sistema, estes são descartados automaticamente na importação para evitar qualquer duplicidade de auditorias.'
      },
      {
        icon: TrendingUp,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Progresso Atual e Contador de Pendentes no Topo',
        category: 'Gestão Operacional',
        description: 'O topo agora contabiliza o % real de progresso das auditorias concluídas e destaca exatamente quantas chamadas ainda estão pendentes de preenchimento.'
      },
      {
        icon: Edit2,
        iconColor: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
        title: 'Preenchimento Ágil pelo Botão Editar',
        category: 'Qualidade QA',
        description: 'Ao pressionar o botão editar, o auditor preenche com facilidade as informações pendentes: Protocolo MK, Cliente, Operador, Processo, Procedimento, Qualidade, Saída (FCR) e Parecer do auditor.'
      }
    ]
  },
  {
    version: 'v3.7.1',
    date: 'Outubro 2026',
    isCurrent: false,
    tag: 'Versão Anterior',
    summary: 'Atualização v3.7.1: Consolidação definitiva dos 3 Emblemas Oficiais de Feitos (Desempenho de Turno, Auditorias QA e TMA de Telefonia/Chat), layout minimalista e ultra-limpo nos cards de perfil sem textos redundantes ou tags auxiliares, e recalibração da progressão de níveis para a escala 1 a 3.',
    items: [
      {
        icon: Trophy,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Tríade Oficial de Emblemas de Feitos',
        category: 'Gamificação & Reconhecimento',
        description: 'Remoção do emblema de feedbacks e consolidação estrita dos 3 emblemas operacionais automatizados: Emblema de Desempenho (média de pontos no máx. 5% abaixo da média do turno ou superior), Emblema de Auditorias (% QA > 90%) e Emblema de TMA (Telefonia < 10m e Chat < 25m no mês vigente).'
      },
      {
        icon: Layout,
        iconColor: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
        title: 'Cards de Perfil Ultra-Limpos & Minimalistas',
        category: 'Ergonomia Visual',
        description: 'Remoção da tag de resultado atual e dos textos explicativos em verde no rodapé dos cards de conquistas, conferindo um design limpo, focado na regra oficial e no status de desbloqueio.'
      },
      {
        icon: Sparkles,
        iconColor: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
        title: 'Calibração da Escala de Níveis (1 a 3)',
        category: 'Progressão Operacional',
        description: 'Ajuste matemático da escala de níveis do perfil para 1 a 3 ({conquistas}/3) perfeitamente alinhada com as 3 insígnias disponíveis na operação.'
      }
    ]
  },
  {
    version: 'v3.7',
    date: 'Outubro 2026',
    isCurrent: false,
    tag: 'Versão Anterior',
    summary: 'Nova grande atualização v3.7: Módulo Completo de Auditoria da Operação Terceirizada (Plantão Noturno / Equipes Externas) com validação anti-duplicidade de protocolos, atalhos rápidos para parecer do auditor, métricas de FCR, reincidência fora de horário, % de qualidade Positiva x Negativa e filtro por período com aproveitamento total do espaço em tela.',
    items: [
      {
        icon: ShieldCheck,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Nova Tela de Auditoria da Equipe Terceirizada',
        category: 'Qualidade & Auditoria Externa',
        description: 'Módulo dedicado para auditar chamadas da empresa terceirizada com registro de data obrigatória em branco para evitar erros, protocolo da chamada, status (Atendida/Abandonada), procedimentos (Conforme/Não conforme), qualidade (Positiva, Neutra, Negativa), processos (Sem acesso, Lentidão/Oscilação, Suporte TV, Informações, Assuntos Financeiros), operador com auto-complete em lista suspensa, protocolo ERP (MK) e nome do cliente.'
      },
      {
        icon: Zap,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Validação Anti-Duplicidade de Protocolo',
        category: 'Integridade de Dados',
        description: 'Bloqueio preventivo e alerta em tempo real caso o usuário tente cadastrar um protocolo que já existe no sistema, impedindo auditorias duplicadas e garantindo a fidedignidade dos registros.'
      },
      {
        icon: Sparkles,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Atalhos Rápidos no Parecer do Auditor',
        category: 'Produtividade & Agilidade',
        description: 'Botões de 1 clique para inserção imediata das conclusões mais recorrentes: "Problema foi resolvido remotamente pelo operador após procedimentos" e "Atendimento encaminhado para equipe N2/N3".'
      },
      {
        icon: BarChart3,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'KPIs Dedicados: FCR, Reincidência e Qualidade Estrita',
        category: 'Indicadores & Gestão',
        description: 'Cálculo de taxa de resolução no primeiro contato (FCR) baseado no desfecho da saída (Resolvido vs Encaminhado), índice de reincidência de clientes fora de horário comercial, e qualidade calculada exclusivamente na proporção Positivos x Negativos (neutros não desviam a média).'
      },
      {
        icon: Layout,
        iconColor: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
        title: 'Visualização Otimizada & Filtro por Período Sem Scroll Horizontal',
        category: 'Interface & Ergonomia',
        description: 'Aproveitamento de 100% da largura útil da tela com grid responsivo e tabela compacta sem barras de rolagem lateral desnecessárias, além de filtros avançados por período, status, processo e operador.'
      },
      {
        icon: Trophy,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Sistema Automatizado dos 4 Emblemas Oficiais',
        category: 'Gamificação & Reconhecimento Operacional',
        description: 'Ativação 100% automatizada e parametrizada com os 4 emblemas oficiais da plataforma: Emblema de Feedbacks (relação positiva Positivos > Negativos), Emblema de Desempenho (média de pontos no máx. 5% abaixo da média do turno ou superior), Emblema de Auditorias (% QA > 90%) e Emblema de TMA (Telefonia < 10m e Chat < 25m no mês vigente).'
      }
    ]
  },
  {
    version: 'v3.6',
    date: 'Setembro 2026',
    isCurrent: false,
    tag: 'Versão Anterior',
    summary: 'Nova grande atualização v3.6: Tela de Perfil 360° para todos os usuários com Foto via PhotoUrl do Firebase, Nível de 1 a 8 no Card de Role & Foto, Emblemas de Feitos exclusivos da Gestão, Métricas Operacionais 100% Reais (TMA Telefonia/Chat, Pontuação e Auditorias), Tags de Redes (Básico, Médio e Avançado) e Atualização Oficial dos Expedientes da Operação e Plantão Terceirizado Noturno.',
    items: [
      {
        icon: User,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Tela de Perfil & Acesso Centralizado no Card de Role e Foto com Nível (1 a 8)',
        category: 'Perfil & Identidade',
        description: 'Acesso à tela de Perfil agora centralizado exclusivamente no Card do Usuário (onde detém sua Role, Foto oficial via PhotoUrl do Firebase e Nível calculado dinamicamente de 1 a 8 com base nos emblemas conquistados), otimizando a barra lateral.'
      },
      {
        icon: BarChart3,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Métricas Operacionais 100% Reais (Sem Mocks)',
        category: 'Desempenho & Métricas',
        description: 'Cálculo real de dados direto do Firestore: Média de TMA Telefonia (chamadas de voz), Média de TMA Chat (atendimentos Huggy), Média de Pontos de produtividade e % de Conformidade nas Auditorias de QA com atualização em tempo real.'
      },
      {
        icon: Trophy,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Emblemas de Feitos Concedidos Exclusivamente pela Gestão',
        category: 'Gamificação & Mérito',
        description: 'Os emblemas (Top TMA, Top Finalizações, Destaque QA, Guardião da Qualidade, FCR, Plantão de Ferro, Mestre em Redes, Veterano HubDesk) agora são homologados e concedidos exclusivamente pelo Gestor. Os demais membros podem visualizar suas conquistas e seu nível correspondente.'
      },
      {
        icon: Sun,
        iconColor: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
        title: 'Expedientes Oficiais Corrigidos & Operação Terceirizada (20:00 às 08:00)',
        category: 'Expediente & Escalas',
        description: 'Ajuste oficial dos horários: Manhã I (08:00 até 14:15), Manhã II (09:00 até 15:15), Tarde (11:00 até 17:15) e Noturno (13:45 até 20:00). A operação noturna externa (20:00 até às 08:00 por terceirizada) fica devidamente registrada nas configurações do sistema no Firestore para controle de plantões e futuras integrações.'
      },
      {
        icon: Network,
        iconColor: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
        title: 'Tags de Conhecimento em Redes & Canais de Comunicação',
        category: 'Competências & Contatos',
        description: 'Definição de proficiência em redes (Básico, Médio e Avançado), chips de habilidades técnicas (GPON, Mikrotik, OSPF, Wi-Fi 6), múltiplos e-mails secundários e link direto para WhatsApp e telefone de contato.'
      }
    ]
  },
  {
    version: 'v3.5',
    date: 'Setembro 2026',
    isCurrent: false,
    tag: 'Versão Anterior',
    summary: 'Novos modos globais de visualização: Modo Escuro de alto contraste e Modo Morno para conforto visual sem extremos, disponíveis em todas as telas.',
    items: [
      {
        icon: Moon,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Modo Escuro (Paleta Suave, Aveludada & Ergonomia Prolongada)',
        category: 'Aparência & Ergonomia',
        description: 'Reformulação completa do modo escuro, substituindo o preto absoluto por tons suaves e repousantes de ardósia (#0f1115) e carvão aveludado (#181a20). Unificação de todas as telas e canva sem descontinuidades, com tipografia suave e barra lateral harmonizada (#121419) para leitura contínua e sem ofuscamento.'
      },
      {
        icon: Coffee,
        iconColor: 'text-amber-700 bg-amber-600/10 border-amber-600/20',
        title: 'Modo Morno (Equilíbrio Sépia, Linho & Conforto Ocular)',
        category: 'Aparência & Ergonomia',
        description: 'O meio-termo ideal para quem não se adapta ao branco luminoso e nem ao escuro total. Paleta inspirada em linho aconchegante, pedra e tons terrosos suaves com tipografia espresso (#261f1c), preservando a barra lateral escura original e eliminando a fadiga visual sem poluição luminosa.'
      },
      {
        icon: Palette,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Seletor de Modo no Canto Superior Direito',
        category: 'Navegação & Sistema',
        description: 'Alternância instantânea de temas em 1 clique posicionada de forma limpa e padronizada exclusivamente no canto superior direito do sistema, presente tanto na visão de Administrador quanto de Colaborador com persistência automática no navegador.'
      }
    ]
  },
  {
    version: 'v3.4',
    date: 'Setembro 2026',
    isCurrent: false,
    tag: 'Versão Anterior',
    summary: 'Nova fórmula equitativa de Líder Geral, Dashboard 360° do Colaborador, Organograma Operacional reformulado com RBAC inteligente e Central de Demanda Diária.',
    items: [
      {
        icon: Network,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Organograma Operacional & RBAC de Edição',
        category: 'Organograma',
        description: 'Reformulação visual e funcional do Organograma Operacional: reconhecimento inteligente de permissões RBAC para Gestores e perfis com edição liberada, badges de status em tempo real (Modo Edição vs Somente Leitura), novo menu rápido de movimentação por clique (sem depender apenas de drag & drop), auto-distribuição inteligente por cargo cadastrado, busca e filtros por turno nos não alocados, e conector vertical hierárquico refinado.'
      },
      {
        icon: Activity,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Nova Central de Demanda e Fila Diária',
        category: 'Demanda Diária',
        description: 'Reformulação visual e analítica profunda do painel de Demanda Diária: novos filtros por presets de período (Mês Atual, 7, 15 e 30 dias, Mês Anterior, Últimos 3 Meses e Personalizado), filtros multicritério por canal (Chamados/Chats), tendência de saldo de fila (Reduziu, Subiu ou Estável), dia da semana (Seg a Dom) e busca rápida. Acompanha novos cards executivos de delta/saldo, gráficos com áreas gradientes de Início vs Fim, comparativo geral por dia da semana e exportação completa em CSV.'
      },
      {
        icon: Award,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Nova Fórmula do Líder Geral por Pontuação Média',
        category: 'Visão Geral KPIs',
        description: 'A determinação do Líder Geral por turno (Dia e Noite) foi atualizada para utilizar a pontuação média calculada com base nas avaliações efetivamente lançadas, eliminando a distorção da pontuação acumulada bruta. Agora, novos colaboradores e analistas com menos avaliações competem com o mesmo critério e mesma régua de justiça operacional.'
      },
      {
        icon: BarChart3,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Dashboard Individual 360° do Colaborador',
        category: 'Hub da Equipe',
        description: 'Reformulação total da tela de relatório individual no Hub da Equipe, transformando-a em uma central de inteligência analítica completa: consolidação do mês vigente por padrão, cards estatísticos de pontuação, finalizações, telefonia (voz), chat Huggy, TMAs e conformidade QA.'
      },
      {
        icon: Sliders,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Filtros Avançados de Período, Mês e Semanas de Avaliação',
        category: 'Filtros & Análise',
        description: 'Novos controles de navegação com atalhos rápidos (Mês Vigente, Mês Anterior, Últimos 3 Meses e Todo o Histórico), dropdown seletor de mês e filtro detalhado por semana de avaliação para analisar recortes específicos ou todo o período consolidado.'
      },
      {
        icon: TrendingUp,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Gráficos Analíticos Dinâmicos & Abas Operacionais',
        category: 'Visualização de Métricas',
        description: 'Gráficos interativos de produção semanal, curva de pontuação e evolução de tempos médios (TMA e TME), combinados com abas de foco em Voz, Chat Huggy, Produtividade e Auditorias QA, além de extrato detalhado semana a semana com exportação em CSV e impressão.'
      }
    ]
  },
  {
    version: 'v3.3',
    date: 'Setembro 2026',
    isCurrent: false,
    tag: 'Versão Anterior',
    summary: 'Análise detalhada passo a passo de auditorias QA, refatoração de todas as visões de Meu Histórico, alternância entre Tabela e Cards e novos filtros avançados.',
    items: [
      {
        icon: ShieldCheck,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Análise Detalhada de Auditoria QA com Etapas',
        category: 'Qualidade & Auditoria',
        description: 'Substituição do resumo simples por uma análise aprofundada passo a passo (Etapa 01, 02...), exibindo o status de cada critério avaliado, apontamentos específicos do auditor, barra de aproveitamento percentual segmentada e filtros internos de etapas.'
      },
      {
        icon: History,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Refatoração Completa das Visões de Meu Histórico',
        category: 'Experiência do Colaborador',
        description: 'Reformulação integral de todos os modais detalhados: Feedbacks com categorização visual (Elogio, Ponto de Melhoria, Orientação), Avaliações Semanais com score consolidado e fórmula transparente de cálculo, e Avaliação Mensal 1:1 com pontuação por pilares e PDI.'
      },
      {
        icon: Layers,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Novas Visualizações: Modo Tabela e Modo Cards',
        category: 'Visualização de Dados',
        description: 'Adicionada alternância fluida entre visualização em Tabela detalhada e Grade de Cards visuais interativos, acompanhada por um mini-dashboard de 4 métricas resumidas que se adaptam dinamicamente a cada aba.'
      },
      {
        icon: Filter,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Filtros Avançados & Exportação CSV',
        category: 'Produtividade & Gestão',
        description: 'Novo conjunto de filtros combinados: busca instantânea por protocolo, auditor ou processo; atalhos de período rápido (7 dias, 30 dias, mês atual); filtros por status e processo QA; ordenação flexível e exportação dos dados filtrados para CSV.'
      }
    ]
  },
  {
    version: 'v3.2',
    date: 'Setembro 2026',
    isCurrent: false,
    tag: 'Versão Anterior',
    summary: 'Redesenho da tela de login, visualização direta de changelog, nova animação e padronização visual.',
    items: [
      {
        icon: Layout,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Nova Tela de Login & Changelog Visível',
        category: 'Interface & Acesso',
        description: 'Redesenho completo da interface de autenticação com feed direto de atualizações na tela principal, permitindo acompanhar novidades antes mesmo de efetuar o login.'
      },
      {
        icon: Palette,
        iconColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        title: 'Padronização do Favicon & Tipografia Brand',
        category: 'Identidade Visual',
        description: 'Substituição da logo antiga pelo ícone oficial do favicon na tela de login e barras de navegação, com aplicação da nova tipografia geométrica moderna (.font-brand).'
      },
      {
        icon: Flame,
        iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        title: 'Animação Atmosférica de Bolhas Ascendentes',
        category: 'Efeitos Visuais',
        description: 'Nova camada dinâmica no plano de fundo com bolhas e partículas luminosas subindo suavemente até 70% da altura da tela e dissipando de forma natural.'
      }
    ]
  },
  {
    version: 'v3.1',
    date: 'Setembro 2026',
    isCurrent: false,
    tag: 'Versão Anterior',
    summary: 'Refinamento de ícones e grandes novidades nas telas de auditoria QA.',
    items: [
      {
        icon: Palette,
        iconColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        title: 'Alterado ícone do sistema',
        category: 'Identidade Visual',
        description: 'Atualização e refinamento do ícone oficial e dos elementos de identidade visual da aplicação.'
      },
      {
        icon: ShieldCheck,
        iconColor: 'text-red-400 bg-red-500/10 border-red-500/20',
        title: 'Atualização de visualização na tela de auditorias QA',
        category: 'Módulo de Qualidade',
        description: 'Novo painel completo com indicadores em tempo real, ranking de conformidade com pódio da equipe, gráficos analíticos e histórico detalhado com paginação e inspeção rápida.'
      },
      {
        icon: Sliders,
        iconColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        title: 'Atualização na tela de adição de processos de auditoria',
        category: 'Processos & Checklists',
        description: 'Fluxo aprimorado para cadastro e edição de processos de QA, com categorização dinâmica, gerenciamento ágil de perguntas e pré-visualização interativa antes da publicação.'
      }
    ]
  }
];
