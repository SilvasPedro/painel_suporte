# Preferências de Design & UI/UX — Hubdesk

> **Documento Vivo de Diretrizes:** Este arquivo registra formalmente tudo o que o usuário **gosta** e **não gosta** no redesign do Hubdesk, servindo de bússola para que todas as telas sejam assertivas, surpreendentes e rigorosamente alinhadas à sua visão.

---

## 🎨 1. Identidade Visual Central
- **Paleta de Cores:** Identidade forte em **Carmesim / Rose** (`#e11d48` / `#f43f5e`), com acentos em âmbar (`#fbbf24`), esmeralda (`#10b981`) e anil (`#6366f1`).
- **Suporte Multi-Tema:** Coerência obrigatória nos três temas do sistema:
  - **Light (Claro):** Base `#f8fafc` com cartões brancos limpos e bordas sutis em `#e2e8f0`.
  - **Warm (Papel/Aconchegante):** Base bege suave `#dfd7ca` com cartões `#ede6dc`.
  - **Dark (Cinematográfico):** Base profunda `#090a0f` com cartões `#111319` e vidro translúcido.
- **Nível de Ambição:** Qualidade visual de nível **Behance / Magic UI / Linear / Vercel**, com mudanças substanciais e arquitetura moderna (não apenas retoques superficiais).

---

## ✅ 2. O Que o Usuário GOSTA (Aprovado & Recomendado)

1. **Cartão de Destaque / MVP da Semana (Bento 1):**
   - Feixe de luz perimetral (**`BorderBeam`**) contínuo com gradiente carmesim a dourado.
   - Pílula de destaque no topo com ícone de coroa dourada.
   - Avatar com anel estilizado e atalho rápido para ver o relatório completo.

2. **Bento Grids & Cockpits Executivos:**
   - Estatísticas consolidadas no topo da tela com hierarquia visual clara.
   - Barras de progresso com distribuição percentual e contagem em tempo real.

3. **Radar de Turnos Interativo:**
   - 4 horários oficiais destacados (Manhã I, Manhã II, Tarde, Noturno).
   - Clicar em qualquer card de turno filtra a equipe imediatamente com anel luminoso (*glow*).

4. **Crachás Digitais da Equipe (Magic Cards):**
   - Holofote de iluminação radial suave que acompanha o cursor (**`MagicCard`**).
   - Indicador de status verde esmeralda com efeito de pulso (*pulse ping*) nos membros ativos.
   - Barra de ações rápidas no rodapé dos cards para facilitar a gestão.

5. **Modos Múltiplos de Visualização:**
   - Alternância fluida entre Grade, Tabela Enterprise, Diretório Compacto e Visão Agrupada.

6. **Pesquisa Instantânea & Command Palette (`Ctrl + K`):**
   - Agilidade e estética limpa para navegação rápida.

---

## 🚫 3. O Que o Usuário NÃO GOSTA (Proibido / Evitar Rigorosamente)

1. **Textos em Movimento / Deslizantes / Shimmer Marquee:**
   - **Regra:** **NÃO USAR** textos com animações contínuas correndo ou brilhando de um lado para o outro (ex.: `AnimatedShinyText` ou efeitos de texto deslizando).
   - **Motivo:** O usuário achou desconfortável para a leitura ("muito ruim").
   - **Padrão Obrigatório:** Textos, títulos e selos devem ser sempre **estáticos, fixos, nítidos, com alto contraste e tipografia impecável**.

2. **Linhas e Bordas Pretas Pesadas (*Border-Line Preto*):**
   - **Regra:** **NUNCA** utilizar bordas pretas pesadas, outlines escuros duros ou classes com falha de opacidade que caiam no fallback de borda preta (`currentColor`).
   - **Padrão Obrigatório:** As bordas de agrupamentos, cockpits e tabelas devem ser suaves e refinadas:
     - Utilizar `border-subtle` (`#e2e8f0` no light, nunca preto).
     - Usar divisórias internas suaves (`divide-x divide-subtle`).
     - Usar fundos suaves translúcidos com sombra sutil (`shadow-2xs`), criando profundidade sem contornos duros.

3. **Mudanças Incrementais / Retoques Tímidos:**
   - O usuário não quer apenas ajustes pontuais de cor em componentes antigos.
   - Quer que cada tela passe por um redesign completo e ambicioso, com cara de projeto novo.

---

## 📋 4. Log de Preferências Registradas

| Data | Tela / Componente | Elemento | Preferência / Decisão |
|---|---|---|---|
| 31/10/2026 | Hub da Equipe | Cartão de Destaque Atual | **Gostou** do cartão, mas exigiu **texto fixo/estático** (sem shimmer correndo). |
| 31/10/2026 | Hub da Equipe | Micro-Cockpit de Métricas dos Cards | **Não gostou** da borda preta em volta dos últimos dados. Substituído por container elegante `bg-subtle/80`, divisórias suaves e `border-subtle`. |
| 31/10/2026 | Geral | Identidade de Cores | Manter fielmente a identidade de cores Carmesim / Rose do Hubdesk. |
| 31/10/2026 | Geral | Componentes Magic UI | Aprovado o uso de `BorderBeam`, `MagicCard`, `ShineBorder` e layouts Bento Grid. |
| 31/10/2026 | Barra de Navegação Lateral | Redesign Completo | Barra lateral elevada para padrão cockpit executivo: iluminação ambiente volumétrica, pílula deslizante Framer Motion nos links ativos, busca rápida `Ctrl+K`, crachá digital do usuário com nível gamificado e rodapé moderno. |
| 31/10/2026 | Geral / Usuários | Indicadores de Presença | **Remover indicador de "online":** o sistema não possui tracking em tempo real de presença/online; evitar falsos beacons de status online em avatares e rodapé. |
| 31/10/2026 | Hub da Equipe | Filtro Padrão de Status | Definir **somente colaboradores ativos** como o filtro padrão da tela (`statusFilter = 'active'`), com facilidade de alternância. |
| 31/10/2026 | Tela de Login | Redesign Completo | Painel duplo cinematográfico: iluminação volumétrica carmesim e âmbar, vitrine executiva com Bento de 3 pilares, notas de versão estáticas e formulário de acesso envolto com feixe perimetral `BorderBeam` Magic UI. |
| 31/10/2026 | Modal de Atualizações | Redesign Completo | Modal de Changelog (`VersionChangelogModal.jsx`) reformulado em dark glassmorphism com timeline vertical interativa, filtro de versão rápida, ícones com glow e zero pontos falsos de presença online. |
| 31/10/2026 | Tabelas & Avatar de Perfil | Linhas e Contornos Pretos | **Proibido linhas pretas pesadas**: corrigidas as linhas divisórias entre itens de tabelas (agora estritamente `border-subtle` suave em `<tr>` e `.divide-subtle`) e a moldura do avatar no perfil (substituída por `border-4 border-white dark:border-[#111319] ring-1 ring-subtle`, eliminando o fallback preto). |

---

*Este arquivo deve ser consultado antes de qualquer nova refatoração de interface no Hubdesk.*
