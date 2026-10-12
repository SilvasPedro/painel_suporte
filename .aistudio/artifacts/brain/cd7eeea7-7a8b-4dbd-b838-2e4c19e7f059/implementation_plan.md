# Ajustes Visuais do Perfil e Botão de Ramais

Plano de refinamento para corrigir o tema claro na tela de perfil, redimensionar os cartões de colegas para uma grade compacta e ergonômica, remover as tags "Ativo/Bloqueado" das insígnias e realocar o botão flutuante de ramais para o canto inferior direito com alinhamento perfeito.

## Decisões Confirmadas pelo Usuário

> [!IMPORTANT]
> As preferências visuais e estruturais foram esclarecidas na fase de entrevista:

- **Cartões dos Colegas de Equipe**: Grade compacta de 5 a 6 colunas (com miniaturas menores e proporcionais), substituindo a grade atual de 3 colunas que gerava cards excessivamente grandes.
- **Cabeçalho no Modo Claro**: Restaurar o gradiente vibrante oficial HubDesk (vermelho vivo e vinho elegante: `from-red-600 via-rose-600 to-red-700`) no modo claro, reservando tons escuros profundos exclusivamente para quando `dark` estiver ativo (`dark:from-zinc-900 dark:via-zinc-950 dark:to-red-950`).
- **Remoção de Tags nas Insígnias**: Eliminar as tags de status ("Ativo" / "Bloqueado") dentro dos cartões de insígnias, tornando o card mais limpo e legível. A distinção visual fica por conta do ícone colorido com checkmark e da borda suave do card desbloqueado.
- **Posicionamento do Botão de Ramais**: Alinhamento fixo de precisão no canto inferior direito (`bottom-6 right-6`), sem deslocamentos residuais do antigo botão de chat.

---

## 1. Visão Geral & Escopo

1. **Correção do Modo Claro no Perfil (`MyProfile.jsx`)**:
   - O cabeçalho executivo (Hero Banner) está com gradiente escuro fixo (`from-zinc-900 via-zinc-950 to-red-950`). Será atualizado para o gradiente clássico HubDesk no modo claro (`from-red-600 via-red-700 to-rose-800`), aplicando o escuro apenas sob seletor `dark:`.
   - Ajustar elementos com classes escuras fixas (como borda do avatar, tags de rede `bg-zinc-900` e botões de adição) para usarem cores claras quando no modo claro (`bg-red-50 text-red-800`, `bg-red-600` para botões primários) e tons escuros correspondentes no modo escuro.
   - O aviso de "Visualizando Perfil Público" terá gradiente em tons de vermelho no modo claro e escuro suave no dark mode.

2. **Compactação dos Cartões de Colegas de Equipe**:
   - No Card 2.4 de `MyProfile.jsx`, a grade passará de `grid-cols-3` para `grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2.5`.
   - As miniaturas terão proporção equilibrada com avatares de tamanho controlado, mantendo o ponto de status (online/férias/etc.) e tipografia compacta de nome e cargo.
   - Expandir o limite de pré-visualização de 9 para até 10-12 colegas para preencher harmoniosamente as linhas da nova grade compacta.

3. **Remoção das Tags "Ativo" / "Bloqueado" nas Insígnias**:
   - Remover os spans `<span ...>Ativo</span>` e `<span ...>Bloqueado</span>` ao lado dos títulos dos emblemas em `MyProfile.jsx`.
   - Dar 100% de largura para o título do emblema, evitando quebras de linha indesejadas e permitindo leitura fluida da descrição e regra.

4. **Realocação do Botão Flutuante de Ramais (`FloatingExtensions.jsx`)**:
   - Ajustar a âncora do botão para `fixed bottom-6 right-6` direto, garantindo alinhamento padrão ao canto da viewport.
   - Ajustar o modal suspenso para abrir alinhado sobre o botão (`bottom-22 right-6`), com transição suave.

---

## 2. Experiência do Usuário & Design Visual

### Hierarquia Visual e Cores
- **Modo Claro**: Fundo geral em `bg-gray-50`, cartões em `bg-white border-gray-200`, banner em gradiente corporativo `from-red-600 via-red-700 to-rose-800`, botões primários de ação em `bg-red-600 hover:bg-red-700 text-white`.
- **Modo Escuro**: Preservação total do estilo escuro confortável `#0f1115` e superfícies `#181a20` com bordas `#262933`.
- **Colegas de Equipe**: Formato moderno de galeria corporativa de pessoas, com cards compactos, foto circular/arredondada bem enquadrada e primeiro nome visível com corte elegante.

---

## 3. Decisões Técnicas & Arquitetura

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TELA DE PERFIL (MyProfile)                      │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 1. HERO BANNER                                                   │  │
│  │  Modo Claro: Gradiente Vermelho/Vinho HubDesk                    │  │
│  │  Modo Escuro: dark:from-zinc-900 dark:via-zinc-950 dark:to-red-950│
│  │  Avatar executivo + Identificação + Bio editável                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 2. INSÍGNIAS & EMBLEMAS (100% LARGURA)                           │  │
│  │  • Desempenho  • Auditorias  • TMA                               │  │
│  │  (SEM tag Ativo/Bloqueado — Título e descrição 100% limpos)      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌───────────────────────────────┬──────────────────────────────────┐  │
│  │ 3. CONHECIMENTO EM REDES      │ 4. CONTATOS & EXPEDIENTE         │  │
│  │  Tags claras no modo claro    │  Telefone, WhatsApp, E-mails     │  │
│  │                               │  ──────────────────────────────  │  │
│  │                               │  5. COLEGAS DE EQUIPE (COMPACTO) │  │
│  │                               │  Grade 5 a 6 colunas, fotos 44px │  │
│  └───────────────────────────────┴──────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ CANTO INFERIOR DIREITO DA VIEWPORT (Global App)                        │
│                                                                        │
│                                           [ (📞) Botão de Ramais ]     │
│                                           fixed bottom-6 right-6       │
└────────────────────────────────────────────────────────────────────────┘
```

### Componentes Impactados
1. `src/pages/MyProfile.jsx`:
   - Correção dos temas claro/escuro no Hero Banner, tags e elementos auxiliares.
   - Ajuste da grade dos amigos de `grid-cols-3` para `grid-cols-4 sm:grid-cols-5 md:grid-cols-6` com cartões menores.
   - Remoção dos pills `<span ...>Ativo</span>` e `<span ...>Bloqueado</span>` do catálogo de emblemas.
   - Aumento da lista `facebookFriendsPreview` de 9 para 10-12 itens para fechamento simétrico da grade.
2. `src/components/FloatingExtensions.jsx`:
   - Alinhamento fixo direto em `bottom-6 right-6` para o botão e `bottom-22 right-6` para a janela de pesquisa de ramais.
