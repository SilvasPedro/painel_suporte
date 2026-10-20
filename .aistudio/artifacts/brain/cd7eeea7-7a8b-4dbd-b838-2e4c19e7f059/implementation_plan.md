# Plano Diretor de Arquitetura: FinOps Firestore, Auditoria 360° e Redesign UI/UX para Suporte ISP

Plano de modernização arquitetural e ergonômica para a plataforma HubDesk ISP. Elimina o risco de esgotamento da cota de 50.000 leituras/dia no Firestore Spark através de cache em camadas (L1 Memory TTL + L2 IndexedDB + Cursors), estabelece regras de segurança zero-trust e projeta uma interface operacional de alta densidade e baixa fadiga com visualização em Fila/Kanban, Drawer lateral para inspeção de chamados, controle dinâmico de SLA e detector de falhas massivas por região.

---

## Decisões Críticas Confirmadas com o Usuário

> [!IMPORTANT]
> **Resumo dos Alinhamentos Confirmados:**
> 1. **Estratégia de Implementação Imediata:** Abordagem combinada balanceada, atacando simultaneamente a blindagem FinOps do Firestore e a experiência do atendente (Fila com Drawer lateral e SLAs visuais).
> 2. **Calibração de Leituras no Firestore:** Cache em memória RAM com TTL inteligente (Stale-While-Revalidate), eliminando listeners globais irrestritos e restringindo `onSnapshot` exclusivamente à fila operacional ativa de alta prioridade.
> 3. **Funcionalidade ISP Enterprise Prioritária (Nível 3):** Sistema de detecção e alerta de falhas massivas/incidentes em lote por região, bairro e circuito/OLT, prevenindo a duplicação de dezenas de chamados redundantes.

---

## 1. Relatório Executivo de Auditoria e Diagnóstico em 3 Níveis

### Diagnóstico Módulo a Módulo

| Módulo / Arquivo | Status Atual | Problemas Encontrados | Criticidade |
| :--- | :--- | :--- | :--- |
| **`dataCache.js` & Firestore Listeners** | Listeners globais irrestritos (`onSnapshot(collection)`) com keep-alive de 30min | Lê coleções inteiras (`feedbacks`, `critical_reports`, `qa_audits`, `weekly_evaluations`) sem cláusulas `where` ou `limit`. Qualquer abertura de tela ou mutação acarreta centenas de leituras simultâneas, multiplicadas pelo número de atendentes ativos. Risco iminente de estouro da cota diária de 50k reads. | **Nível 1 (Crítico / Blocker)** |
| **`firestore.rules` (Segurança & ABAC)** | Arquivo inexistente no repositório; permissões dependentes de console ou abertas | Usuários não-administradores conseguem ler dados sensíveis de outros colaboradores via inspeção do SDK; ausência de regras ABAC para impedir que atendentes alterem auditorias, metas de setor ou aprovem seus próprios relatórios. | **Nível 1 (Crítico / Blocker)** |
| **`Reports.jsx` (Chamados & Tarefas Críticas)** | Carrega todos os chamados da empresa no cliente e filtra via JavaScript (`.filter`) | Falha de privacidade grave: relatórios confidenciais de diretoria/gestão trafegam até o navegador do colaborador padrão. Modal de visualização centralizado cobre 100% da viewport, quebrando o fluxo de trabalho do operador. | **Nível 1 (Crítico / Blocker)** |
| **`DashboardOverview.jsx` & `MyDashboard.jsx`** | 8 a 9 listeners abertos simultaneamente por usuário no mount | Efeito N+1: Para exibir cards agregados (total de chamados do dia, TMA, notas médias), o cliente baixa individualmente centenas de documentos em vez de consumir documentos de agregação. | **Nível 2 (Operacional / Otimização)** |
| **`DailyDemandLaunch.jsx` (Demanda Diária)** | Subscrição integral à coleção `dailyDemand` e formulário modal básico | Falta de agregação por períodos históricos consolidados; ausência de atalhos de teclado rápidos para inserção rápida de métricas no fechamento de turno de atendimento. | **Nível 2 (Operacional / Otimização)** |
| **`DataManager.jsx` (Gestão Central)** | Paginação manual em memória de arrays gigantes | Carregamento síncrono que sobrecarrega a CPU do navegador em máquinas corporativas com baixo hardware; ausência de busca paginada com cursores (`startAfter`). | **Nível 2 (Operacional / Otimização)** |
| **Detecção de Falhas Massivas (ISP)** | Inexistente (atendentes abrem chamados individuais para o mesmo incidente) | Falta de agrupador de incidentes de rede por bairro, concentrador (BNG/PPPoE) ou OLT/POP. Um rompimento de fibra gera 50+ chamados idênticos poluindo a fila. | **Nível 3 (Gap ISP Enterprise)** |
| **Controle de SLA Dinâmico & Triagem ISP** | Sem relógio regressivo de SLA ou priorização dinâmica por tipo de falha | Atendentes não conseguem priorizar visualmente chamados de clientes corporativos com link dedicado vs. clientes residenciais, nem monitorar tempo limite para despacho técnico. | **Nível 3 (Gap ISP Enterprise)** |
| **Máscaras e Ferramentas Técnicas ISP** | Campos de texto livres sem validação de MAC, IPv4/IPv6 ou Contrato | Erros frequentes de digitação de MAC Address e falta de botões de cópia rápida para scripts de atendimento (reinício de ONU, consulta de sinal óptico, DNS padrão). | **Nível 3 (Gap ISP Enterprise)** |

---

## 2. Plano de Otimização do Firestore (FinOps: Teto Seguro < 50k Reads/Dia)

### Análise Quantitativa: Antes vs. Depois

Cenário Base de Operação de ISP:
- 12 Analistas de Suporte + 3 Supervisores/NOC (15 usuários ativos simultâneos).
- Turno de 8 horas com alternância de abas e resolução contínua de chamados.
- Base existente: 1.500 chamados históricos, 2.000 auditorias QA, 1.200 feedbacks, 800 avaliações semanais.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        CONSUMO DIÁRIO DE LEITURAS FIRESTORE                            │
├───────────────────────────────┬────────────────────────────┬───────────────────────────┤
│ Módulo / Fluxo                │ Arquitetura Atual (Antes)  │ Nova Arquitetura (Depois) │
├───────────────────────────────┼────────────────────────────┼───────────────────────────┤
│ Login & Carga do Dashboard    │ ~8.250 reads por abertura  │ ~18 reads (Docs agregados)│
│                               │ (15 users = 123.750 reads) │ (15 users = 270 reads)    │
├───────────────────────────────┼────────────────────────────┼───────────────────────────┤
│ Fila de Chamados (Reports)    │ ~1.500 reads a cada reload │ 25 reads (cursor limit 25)│
│                               │ ou alteração de doc        │ + Snapshot restrito ativos│
├───────────────────────────────┼────────────────────────────┼───────────────────────────┤
│ Troca de Abas / Navegação     │ Repetição frequente após   │ 0 reads (L1 Cache RAM     │
│                               │ expiração do keep-alive    │ com SWR + IndexedDB L2)   │
├───────────────────────────────┼────────────────────────────┼───────────────────────────┤
│ Dados Semiestáticos (Tags,    │ onSnapshot contínuo        │ 1 leitura a cada 60 min   │
│ Setores, Processos QA)        │ consumindo quota passiva   │ (TTL longo em memória)    │
├───────────────────────────────┼────────────────────────────┼───────────────────────────┤
│ TOTAL ESTIMADO / DIA          │ > 150.000 leituras/dia     │ ~ 3.800 a 6.500 reads/dia │
│                               │ (ESTOURO SEVERO DE COTA)   │ (MARGEM DE SEGURANÇA 87%) │
└───────────────────────────────┴────────────────────────────┴───────────────────────────┘
```

### Pilares da Reestruturação de Dados:

1. **Singleton L1 Memory Cache com SWR (Stale-While-Revalidate):**
   - Dados semiestáticos (`feedback_tags`, `qa_processes`, `system_settings`, lista de colaboradores) possuem `staleTime` de 30 a 60 minutos. Consultas subsequentes retornam instantaneamente da memória com **0 leituras**.
2. **Eliminação de `onSnapshot` Irrestrito em Coleções Inteiras:**
   - O único listener de tempo real mantido será restrito a:
     `query(collection(db, 'critical_reports'), where('status', 'in', ['Pendente', 'Em Andamento']), orderBy('createdAt', 'desc'), limit(30))`
   - Chamados concluídos, cancelados e históricos são consultados **sob demanda com paginação baseada em cursor** (`limit(20)`, `startAfter(lastVisibleDoc)`).
3. **Agregação Desnormalizada de Métricas Diárias:**
   - Métricas do dia (total abertos, resolvidos, pendentes, índice de satisfação) passam a ser incrementadas via transações atômicas / `increment()` no documento consolidado `metrics_summary/daily_{YYYY-MM-DD}`. O Dashboard consome **1 leitura** em vez de ler centenas de documentos para somar status.

---

## 3. Arquitetura e Engenharia de Software

### Diagrama de Fluxo de Dados e Cache

```
                      ┌──────────────────────────────────────┐
                      │        Componente React (UI)         │
                      └──────────────────┬───────────────────┘
                                         │
                   1. Requisita Dados    │ (useSharedData)
                                         ▼
                      ┌──────────────────────────────────────┐
                      │   Camada de Cache Inteligente L1     │
                      │  (RAM Map com TTL e SWR In-Memory)   │
                      └───────┬──────────────────────┬───────┘
          Hit (TTL Válido)    │                      │ Miss / Expirado
       ┌──────────────────────┘                      └─────────────────────┐
       │ (0 reads / 0ms)                                                   │
       ▼                                                                   ▼
┌──────────────┐                                            ┌─────────────────────────────┐
│ Entrega Dado │                                            │   Camada de Persistência L2 │
│ Instantâneo  │                                            │  (IndexedDB Multi-Tab SDK)  │
└──────────────┘                                            └──────────────┬──────────────┘
                                                                           │
                                                     Online Sync / Query   │ (limit + cursor)
                                                                           ▼
                                                            ┌─────────────────────────────┐
                                                            │  Google Cloud Firestore     │
                                                            │  - Fila Ativa: limit(30)    │
                                                            │  - Histórico: Paginado      │
                                                            │  - Agregações: Doc Único    │
                                                            └─────────────────────────────┘
```

### Regras de Segurança Zero-Trust (`firestore.rules`)

As regras serão formalizadas com:
- Validação estrita de papéis (RBAC): Atendentes só lêem seus próprios chamados ou chamados públicos atribuídos; apenas Supervisores, Gestores e Administradores possuem acesso total à coleção `critical_reports` e `qa_audits`.
- Bloqueio de mutação de campos imutáveis (`createdAt`, `creatorId`, `originalProtocol`).
- Validação de formato e tamanho máximo de texto para prevenir ataques de negação de carteira (Denial of Wallet).

---

## 4. Redesign UI/UX: Ergonomia, Fila Operacional & ISP Fast-Track

### Conceito Visual: Slate Dark Profissional de Baixa Fadiga Ocular

Projetado para analistas de suporte e operadores de NOC que permanecem de 6 a 8 horas contínuas monitorando telas:
- **Canvas Neutro 60%:** Fundo escuro profundo e suave `#0F172A` (Slate 900) e `#0B0F19` (Zinc 950).
- **Superfícies Estruturais 30%:** Painéis e cartões em `#1E293B` (Slate 800) com divisores em hairline `#334155` (Slate 700), sem sobreposição desnecessária de cards.
- **Acentos Funcionais 10%:**
  - Azul ISP `#38BDF8` (Sky 400) para ações de triagem e navegação.
  - Verde `#22C55E` (Emerald 500) para SLA dentro do prazo (>50% restante).
  - Âmbar `#F59E0B` (Amber 500) para SLA em atenção (<25% restante).
  - Vermelho `#EF4444` (Rose 500) para SLA estourado ou falha massiva ativa.

### Componentes de Destaque da Nova Fila de Suporte:

1. **Visualizador Híbrido: Fila Compacta Inteligente & Quadro de Triagem:**
   - Tabela compacta de alta densidade ($38\text{px}$ a $42\text{px}$ de altura por linha) com tipografia tabular (`font-mono tabular-nums`) para protocolo, tempo decorrido e SLA.
2. **Slide-Over Drawer Lateral (Inspeção Sem Perda de Contexto):**
   - Ao clicar em qualquer chamado, um drawer desliza suavemente da direita ($480\text{px}$ a $540\text{px}$) mantendo a fila visível ao fundo.
   - Permite alterar status, adicionar comentário técnico, consultar dados do cliente e ver histórico sem recarregar nem cobrir a tela.
3. **Banner de Detecção de Falhas Massivas / Incidentes em Lote:**
   - Painel de alerta no topo da fila quando houver $\ge 3$ chamados abertos no mesmo bairro/região ou circuito no intervalo de 60 minutos.
   - Botão para associar novos chamados ao "Incidente Massivo Raiz" com 1 clique.
4. **Scripts Rápidos e Máscaras ISP no Formulário:**
   - Máscaras automáticas para: MAC (`XX:XX:XX:XX:XX:XX`), IPv4 (`192.168.X.X`), CPF/CNPJ e Contrato.
   - Barra de atalhos rápidos com scripts padrão de atendimento ("Reinicialização de ONU", "Verificação de Potência RX/TX", "Configuração PPPoE").
5. **Navegação por Teclado:**
   - `Ctrl + N` / `Alt + N`: Abrir novo chamado.
   - `Esc`: Fechar Drawer.
   - `/`: Focar campo de busca rápida de cliente/protocolo.

---

## 5. Roteiro de Implementação e Etapas

### Fase 1: Blindagem FinOps do Firestore & Camada de Cache
- Refatorar `/src/services/dataCache.js` para introduzir o gerenciador `CacheManager` com TTL, políticas SWR e suporte a queries com restrição (`limit`, `where`).
- Criar a especificação completa de segurança em `/firestore.rules` com ABAC rigoroso para isolamento de dados entre operadores e supervisores.

### Fase 2: Redesign da Fila de Chamados (`Reports.jsx`)
- Implementar visualização compacta de tickets com badges de SLA regressivo.
- Desenvolver o componente `TicketDrawer.jsx` (slide-over lateral com comentários e ações de resolução rápida).
- Adicionar atalhos de teclado e máscaras para dados de rede (MAC, IP, Contrato).

### Fase 3: Módulo de Detecção de Falhas Massivas por Região
- Desenvolver o detector de incidentes agrupados no cabeçalho da fila de suporte.
- Criar fluxo de agrupamento em lote para evitar tickets redundantes durante rompimentos ou quedas de enlace.

### Fase 4: Otimização de Agregações e Dashboards
- Refatorar subscrições pesadas em `DashboardOverview.jsx` e `CollaboratorDashboard.jsx` para leitura sob demanda e consumo de métricas consolidadas.
- Compilação, verificação de desempenho e entrega do relatório final.
