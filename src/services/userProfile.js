import { updateProfile } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

/**
 * Atualiza o perfil completo do usuário atual tanto no Firebase Auth (photoURL, displayName)
 * quanto na coleção 'collaborators' do Firestore.
 */
export const saveUserProfileData = async (user, profileData) => {
    if (!user) throw new Error("Usuário não autenticado");

    const currentAuthUser = auth.currentUser;
    const firestoreId = user.firestoreId || user.uid || currentAuthUser?.uid;

    // 1. Atualiza photoURL no Firebase Auth se houver alteração
    if (currentAuthUser && profileData.photoURL !== undefined) {
        try {
            await updateProfile(currentAuthUser, {
                photoURL: profileData.photoURL || null,
                displayName: profileData.name || currentAuthUser.displayName || null
            });
        } catch (authErr) {
            console.warn("Aviso ao atualizar perfil no Firebase Auth:", authErr);
        }
    }

    // 2. Prepara dados limpos para persistir no Firestore
    const payload = {
        name: profileData.name || user.name || '',
        photoUrl: profileData.photoURL || '',
        photoURL: profileData.photoURL || '',
        bio: profileData.bio || '',
        networkKnowledge: profileData.networkKnowledge || 'Básico',
        networkSkills: Array.isArray(profileData.networkSkills) ? profileData.networkSkills : [],
        badges: Array.isArray(profileData.badges) ? profileData.badges : [],
        interests: Array.isArray(profileData.interests) ? profileData.interests : [],
        phone: profileData.phone || '',
        additionalEmails: Array.isArray(profileData.additionalEmails) ? profileData.additionalEmails : [],
        slackOrTeams: profileData.slackOrTeams || '',
        workHours: profileData.workHours || '',
        updatedAt: new Date().toISOString()
    };

    // 3. Grava no Firestore na coleção collaborators
    if (firestoreId) {
        const colabRef = doc(db, 'collaborators', firestoreId);
        const snap = await getDoc(colabRef);
        if (snap.exists()) {
            await updateDoc(colabRef, payload);
        } else {
            // Se for usuário master não registrado na equipe ainda
            await setDoc(colabRef, {
                uid: firestoreId,
                email: user.email || currentAuthUser?.email || '',
                role: user.role || 'Gestor',
                shift: user.shift || 'Manhã',
                status: 'Ativo',
                createdAt: new Date().toISOString(),
                ...payload
            }, { merge: true });
        }
    }

    return payload;
};

/**
 * Lista de avatares profissionais predefinidos para escolha rápida em 1 clique
 */
export const PRESET_AVATARS = [
    {
        id: 'tech_analyst_m',
        name: 'Analista Redes Masc',
        url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=256&h=256&fit=crop&crop=faces&auto=format&q=80'
    },
    {
        id: 'tech_analyst_f',
        name: 'Analista Suporte Fem',
        url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=256&h=256&fit=crop&crop=faces&auto=format&q=80'
    },
    {
        id: 'noc_engineer',
        name: 'Engenheiro NOC',
        url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&h=256&fit=crop&crop=faces&auto=format&q=80'
    },
    {
        id: 'team_lead',
        name: 'Líder Operacional',
        url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=256&h=256&fit=crop&crop=faces&auto=format&q=80'
    },
    {
        id: 'specialist_m',
        name: 'Especialista FTTH',
        url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&h=256&fit=crop&crop=faces&auto=format&q=80'
    },
    {
        id: 'specialist_f',
        name: 'Supervisora QA',
        url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=256&h=256&fit=crop&crop=faces&auto=format&q=80'
    },
    {
        id: 'network_architect',
        name: 'Arquiteto de Redes',
        url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=256&h=256&fit=crop&crop=faces&auto=format&q=80'
    },
    {
        id: 'telecom_tech',
        name: 'Técnico Telecom',
        url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=256&h=256&fit=crop&crop=faces&auto=format&q=80'
    }
];

/**
 * Catálogo de Insígnias e Emblemas de Feitos do HubDesk
 */
export const BADGES_CATALOG = [
    {
        id: 'top_tma',
        title: 'Top TMA',
        iconName: 'Trophy',
        color: 'from-amber-500 to-yellow-600',
        textColor: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-500/10 border-amber-500/30',
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
        description: 'Tempo Médio de Atendimento exemplar. Agilidade, precisão e eficiência nos chamados.',
        category: 'Velocidade & Eficiência',
        requirement: 'Manter TMA consistente dentro ou abaixo da meta da operação'
    },
    {
        id: 'top_finalizacoes',
        title: 'Top Finalizações',
        iconName: 'Zap',
        color: 'from-emerald-500 to-teal-600',
        textColor: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-500/10 border-emerald-500/30',
        badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        description: 'Alto volume de demandas resolvidas e fechamentos de chamados com sucesso.',
        category: 'Produtividade',
        requirement: 'Maior volume de finalizações de chamados e chats concluídos'
    },
    {
        id: 'destaque_qa',
        title: 'Destaque QA',
        iconName: 'Star',
        color: 'from-purple-500 to-indigo-600',
        textColor: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-500/10 border-purple-500/30',
        badgeBg: 'bg-purple-100 text-purple-800 border-purple-300',
        description: 'Nota máxima e conformidade impecável em auditorias de qualidade.',
        category: 'Qualidade Técnica',
        requirement: 'Auditorias QA com nota média superior a 90% de conformidade'
    },
    {
        id: 'guardiao_qualidade',
        title: 'Guardião da Qualidade',
        iconName: 'ShieldCheck',
        color: 'from-blue-500 to-cyan-600',
        textColor: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-500/10 border-blue-500/30',
        badgeBg: 'bg-blue-100 text-blue-800 border-blue-300',
        description: 'Zero incidentes críticos, postura consultiva e suporte de alta retenção.',
        category: 'Confiabilidade',
        requirement: 'Excelente histórico operacional sem incidentes críticos reportados'
    },
    {
        id: 'fcr_champion',
        title: 'Resolução no 1º Contato (FCR)',
        iconName: 'Rocket',
        color: 'from-rose-500 to-red-600',
        textColor: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-500/10 border-red-500/30',
        badgeBg: 'bg-red-100 text-red-800 border-red-300',
        description: 'Capacidade de solucionar o problema do cliente no primeiro chamado sem reabertura.',
        category: 'Eficiência',
        requirement: 'Taxa de First Contact Resolution (FCR) acima da meta setorial'
    },
    {
        id: 'plantao_ferro',
        title: 'Plantão de Ferro',
        iconName: 'CalendarCheck',
        color: 'from-orange-500 to-amber-600',
        textColor: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-500/10 border-orange-500/30',
        badgeBg: 'bg-orange-100 text-orange-800 border-orange-300',
        description: 'Assiduidade exemplar, pontualidade e dedicação em escalas de domingo e feriados.',
        category: 'Comprometimento',
        requirement: 'Participação assídua e sem faltas nas escalas de plantão'
    },
    {
        id: 'mestre_redes',
        title: 'Mestre em Redes',
        iconName: 'Network',
        color: 'from-cyan-500 to-blue-600',
        textColor: 'text-cyan-600 dark:text-cyan-400',
        bgColor: 'bg-cyan-500/10 border-cyan-500/30',
        badgeBg: 'bg-cyan-100 text-cyan-800 border-cyan-300',
        description: 'Conhecimento técnico avançado em infraestrutura de rede, roteamento e topologias.',
        category: 'Conhecimento Técnico',
        requirement: 'Conhecimento nível Avançado em redes e troubleshooting de enlaces'
    },
    {
        id: 'veterano_hubdesk',
        title: 'Veterano HubDesk',
        iconName: 'Award',
        color: 'from-amber-600 to-orange-700',
        textColor: 'text-amber-700 dark:text-amber-300',
        bgColor: 'bg-amber-600/10 border-amber-600/30',
        badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
        description: 'Histórico consistente de dedicação e liderança exemplar no suporte técnico.',
        category: 'Experiência & Honra',
        requirement: 'Consistência de resultados e referência técnica para a equipe'
    }
];

/**
 * Sugestões rápidas de tags de conhecimento em redes
 */
export const DEFAULT_NETWORK_TAG_SUGGESTIONS = [
    'GPON / Fibra Óptica',
    'Mikrotik RouterOS',
    'Wi-Fi 6 / Mesh',
    'IPv6 & Roteamento',
    'VLANs & Trunks',
    'Troubleshooting N2',
    'VoIP / Telefonia SIP',
    'Huawei OLT',
    'BGP & OSPF',
    'Análise de Sinal Óptico',
    'DNS & Servidores Cache',
    'Configuração de ONUs/CPEs'
];

/**
 * Sugestões rápidas de interesses profissionais
 */
export const DEFAULT_INTEREST_SUGGESTIONS = [
    'Engenharia de Redes',
    'Automação de Suporte',
    'Segurança da Informação',
    'Gestão e Liderança',
    'Atendimento Humanizado',
    'Cloud & Infraestrutura',
    'Monitoramento Zabbix/Grafana',
    'Tecnologias FTTH/GPON'
];
