Aja como um Arquiteto de Software Fullstack Sênior, Especialista em Performance/FinOps de Cloud (Firebase/Firestore) e Designer Especialista em UI/UX para Softwares Corporativos (B2B/SaaS).

Você deve realizar uma **Auditoria e Revisão Arquitetural Completa** de todo o código-fonte, módulos, fluxos e estruturas de dados deste sistema. Trata-se de uma plataforma crítica de **Gestão de Equipe de Suporte Interno para um Provedor de Internet (ISP)**.

A plataforma possui múltiplos módulos (tickets/chamados, monitoramento de equipe, ordens de serviço, escalas/turnos, base de conhecimento/scripts, métricas de atendimento, etc.). Seu objetivo é inspecionar minuciosamente cada módulo e entregar um relatório diagnóstico detalhado, seguido de um plano de ação e código refatorado.

Siga rigorosamente as diretrizes e eixos de análise estruturados abaixo:

---

### 1. Auditoria e Diagnóstico em 3 Níveis de Criticidade

Analise todos os arquivos, componentes, stores, hooks e queries do projeto e categorize os achados em:

#### A. Nível 1: Pontos Críticos (Ação Imediata / Blocker)
- Erros de runtime potenciais, vazamentos de memória (listeners abertos, loops de renderização em `useEffect`).
- Falhas de concorrência ou condições de corrida (race conditions) em atendimentos concorrentes ou atribuição de tickets.
- Ausência de tratamento de erros ou quebras com dados incompletos/nulos.
- Vulnerabilidades nas regras de segurança do Firestore (`firestore.rules`) e brechas de permissão entre níveis hierárquicos (Atendente vs. Supervisor vs. Administrador/NOC).

#### B. Nível 2: Funcionalidades Operacionais que Podem Evoluir (Otimizações)
- Componentes e hooks que funcionam, mas com acoplamento excessivo ou repetição desnecessária de lógica.
- Gargalos de performance de renderização em listagens longas (ausência de paginação virtualizada ou memoização de filtros pesados).
- Refatoração de tipagem TypeScript (eliminação de `any`, validações de payload com Zod ou interfaces estritas).

#### C. Nível 3: Gaps de Produto e Funcionalidades Faltantes (Nível Enterprise ISP)
- Identificar carências típicas em sistemas de suporte de telecom/ISP que aumentariam a maturidade operacional da empresa:
  - Ex.: Controle de SLA dinâmico por tipo de falha (massiva, fibra rompida, roteador travado, queda de autenticação PPPoE).
  - Alerta de falhas massivas/incidentes em lote por região/bairro (para evitar que dezenas de atendentes abram chamados isolados para o mesmo circuito).
  - Gestão de turnos/pausas (produtividade em tempo real sem microgerenciamento invasivo).
  - Histórico do cliente e log de auditoria imutável em cada chamado.

---

### 2. Redução Drástica de Leituras no Firestore (Meta: Teto Seguro dos 50k Reads/Dia)

**Contexto Crítico:** A aplicação utiliza o plano Spark/limite gratuito do Firestore (teto de **50.000 leituras/dia**). Uma equipe de suporte ativo gerando requisições contínuas, múltiplos `onSnapshot` e re-renderizações descontroladas estoura essa quota rapidamente, derrubando a operação.

#### Diretrizes Mandatórias de Engenharia de Dados:
1. **Auditoria de Listeners em Tempo Real (`onSnapshot`):**
   - Mapear todos os snapshots ativos e restringir estritamente ao que exige tempo real absoluto (ex.: fila de chamados urgentes ativos).
   - Eliminar `onSnapshot` em coleções inteiras; usar consultas filtradas com cursores (`limit()`, `where()`, `startAfter()`).
   - Implementar `unsubscribe` infalível em todos os desmontes de componentes e trocas de rota.
2. **Estratégia de Cache e Persistência Local:**
   - Ativar e tirar proveito de `persistentLocalCache` com `persistentSingleTabManager` ou `persistentMultipleTabManager` no Firestore SDK modular.
   - Implementar camada de cache em memória ou via React Query / SWR com `staleTime` bem calibrado para dados estáticos ou semiestáticos (lista de colaboradores, motivos de chamado, scripts padrão, setores da empresa).
3. **Desnormalização Inteligente e Agregação de Métricas:**
   - **Evitar o padrão N+1:** Nunca ler 100 documentos individuais para somar status ou calcular tempo médio de atendimento (TMA).
   - Utilizar documentos agregadores (`metrics/today`, `counters/queue_summary`) que acumulem totais via transações ou `increment()`, consumindo 1 leitura em vez de centenas.
4. **Paginação com Cursors no Firestore:**
   - Adicionar paginação sob demanda (`query(..., limit(15), startAfter(lastDoc))`) em todos os históricos, relatórios e tabelas de chamados finalizados.

---

### 3. Redesign de UI/UX: Ergonomia, Baixa Fadiga Visual e Alta Usabilidade

**Contexto Operacional:** Os analistas de suporte passam de 6 a 8 horas diárias na frente da plataforma, frequentemente sob estresse de chamados simultâneos e clientes sem conexão. A interface não pode ser cansativa, poluída ou lenta.

#### Diretrizes de Ergonomia Visual e Experiência:
1. **Ergonomia e Fadiga Ocular:**
   - Paleta de cores escura/neutra com alto contraste legível (modo escuro profissional: fundo `#121214` ou `#0F172A`, superfícies `#1E293B`, bordas suaves `border-slate-800`), sem saturações excessivas.
   - Tipografia limpa, hierárquica e de alta legibilidade (ex.: Inter, Geist ou Roboto), com espaçamentos confortáveis que permitam escanear status rapidamente sem esforço visual.
2. **Arquitetura de Navegação Otimizada para Atendimento Rápido:**
   - Fila de atendimento estilo Kanban ou tabela compacta inteligente com badges de SLA (ex.: Verde suave para dentro do prazo, Âmbar para 75% do tempo, Carmim suave para estourado).
   - Atalhos de teclado para ações frequentes (ex.: abrir novo ticket, atribuir a mim, encerrar chamado, buscar cliente).
   - Detalhamento lateral (slide-over / drawer) para inspecionar um ticket sem perder o contexto da fila geral.
3. **Redução de Cliques e Fricção:**
   - Formulários com preenchimento inteligente e máscaras automáticas (MAC Address, IP, CPF/CNPJ, Contrato).
   - Acesso rápido a scripts padrão de resolução (ex.: comando para reinicialização remota de ONU, teste de ping, DNS padrão do provedor).

---

### 4. Formato de Resposta e Entregáveis Esperados

Organize sua resposta em etapas claras:

1. **Relatório Executivo de Auditoria:**
   - Diagnóstico módulo a módulo com tabela comparativa: [Módulo | Status Atual | Problemas Encontrados | Criticidade (Alta/Média/Baixa)].
2. **Plano de Otimização do Firestore (FinOps):**
   - Comparativo de consumo estimado antes vs. depois das otimizações propostas para garantir a operação abaixo das 50.000 leituras/dia.
3. **Roadmap de Melhorias de UI/UX & Novas Features:**
   - Lista priorizada do que implementar para tornar a ferramenta padrão de mercado para ISPs.
4. **Implementação de Código Prioritário:**
   - Refatoração dos hooks/serviços mais problemáticos de leitura do Firestore.
   - Exemplos de implementação das correções críticas identificadas.