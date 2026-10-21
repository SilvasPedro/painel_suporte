import { updateProfile } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { calculatePerformanceScore } from '../utils/scoringCalculations';

/**
 * Atualiza o perfil completo do usuário atual tanto no Firebase Auth (photoURL, displayName)
 * quanto na coleção 'collaborators' do Firestore.
 * Proteção: Apenas Gestores podem conceder ou modificar emblemas (badges).
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
        bannerColor: profileData.bannerColor || 'carmim',
        bannerUrl: profileData.bannerUrl || '',
        interests: Array.isArray(profileData.interests) ? profileData.interests : [],
        phone: profileData.phone || '',
        ramal: profileData.ramal || profileData.slackOrTeams || '',
        slackOrTeams: profileData.ramal || profileData.slackOrTeams || '',
        additionalEmails: Array.isArray(profileData.additionalEmails) ? profileData.additionalEmails : [],
        workHours: profileData.workHours || '',
        updatedAt: new Date().toISOString()
    };

    // Salva emblemas se fornecidos
    if (Array.isArray(profileData.badges)) {
        payload.badges = profileData.badges;
    }

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
                shift: user.shift || 'Manhã I',
                status: 'Ativo',
                badges: Array.isArray(profileData.badges) ? profileData.badges : [],
                createdAt: new Date().toISOString(),
                ...payload
            }, { merge: true });
        }
    }

    return payload;
};

/**
 * Atualização exclusiva de Emblemas por um Gestor para qualquer colaborador
 */
export const updateCollaboratorBadges = async (colabId, badges) => {
    if (!colabId) throw new Error("ID do colaborador é obrigatório");
    const safeBadges = Array.isArray(badges) ? badges : [];
    const colabRef = doc(db, 'collaborators', colabId);
    await updateDoc(colabRef, {
        badges: safeBadges,
        updatedAt: new Date().toISOString()
    });
    return safeBadges;
};

/**
 * Definição Oficial de Turnos e Expedientes da Operação
 * Manhã I: 08:00 até 14:15
 * Manhã II: 09:00 até 15:15
 * Tarde: 11:00 até 17:15
 * Noturno: 13:45 até 20:00
 * Terceirizada: 20:00 até 08:00
 */
export const SYSTEM_SHIFTS = [
    {
        id: 'Manhã I',
        label: 'Manhã I',
        hours: '08:00 até 14:15',
        start: '08:00',
        end: '14:15',
        color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        badge: 'bg-amber-50 text-amber-800 border-amber-200'
    },
    {
        id: 'Manhã II',
        label: 'Manhã II',
        hours: '09:00 até 15:15',
        start: '09:00',
        end: '15:15',
        color: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20',
        badge: 'bg-yellow-50 text-yellow-800 border-yellow-200'
    },
    {
        id: 'Tarde',
        label: 'Tarde',
        hours: '11:00 até 17:15',
        start: '11:00',
        end: '17:15',
        color: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
        badge: 'bg-orange-50 text-orange-800 border-orange-200'
    },
    {
        id: 'Noturno',
        label: 'Noturno',
        hours: '13:45 até 20:00',
        start: '13:45',
        end: '20:00',
        color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
        badge: 'bg-indigo-50 text-indigo-800 border-indigo-200'
    }
];

export const SYSTEM_SHIFTS_MAP = SYSTEM_SHIFTS.reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
}, {});

/**
 * Informação do sistema sobre o período das 20:00 até 08:00 assumido por terceirizada
 */
export const THIRD_PARTY_SCHEDULE_INFO = {
    title: 'Operação Terceirizada Noturna',
    hours: '20:00 até 08:00',
    description: 'Das 20:00 até às 08:00 quem assume o atendimento é uma equipe terceirizada homologada.',
    note: 'Plantão externo com SLA de monitoria e triagem de chamados críticos durante a madrugada.',
    coverage: 'Noturno / Madrugada (20:00 às 08:00)',
    active: true,
    savedInSystem: true
};

/**
 * Salva e persiste os horários de expediente e a informação da terceirizada
 * nas configurações do sistema no Firestore (system_settings/operation_shifts).
 */
export const saveSystemShiftsInfo = async () => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('hubdesk_shifts_synced')) {
        return true;
    }
    try {
        const shiftsDocRef = doc(db, 'system_settings', 'operation_shifts');
        await setDoc(shiftsDocRef, {
            shifts: SYSTEM_SHIFTS,
            thirdParty: THIRD_PARTY_SCHEDULE_INFO,
            notes: 'Das 20:00 até às 08:00 quem assume é uma terceirizada.',
            updatedAt: new Date().toISOString()
        }, { merge: true });

        const infoDocRef = doc(db, 'system_settings', 'system_info');
        await setDoc(infoDocRef, {
            officialShifts: SYSTEM_SHIFTS.map(s => `${s.label}: ${s.hours}`),
            thirdPartyOperation: THIRD_PARTY_SCHEDULE_INFO,
            systemVersion: 'v3.9.0',
            updatedAt: new Date().toISOString()
        }, { merge: true });
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('hubdesk_shifts_synced', 'true');
        }
        return true;
    } catch (err) {
        console.warn('Aviso ao persistir configurações de turnos e terceirizada:', err);
        return false;
    }
};

export const normalizeShiftName = (shiftStr) => {
    if (!shiftStr) return 'Manhã I';
    const s = String(shiftStr).trim();
    if (s === 'Manhã') return 'Manhã I';
    if (s === 'Noite') return 'Noturno';
    if (SYSTEM_SHIFTS_MAP[s]) return s;
    return s;
};

/**
 * Calcula o nível do usuário com base nos emblemas ativos (de 1 a 6)
 */
export const calculateUserLevel = (badges) => {
    const count = Array.isArray(badges) ? badges.length : 0;
    if (count <= 0) return 1;
    return Math.max(1, Math.min(6, count));
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
 * Opções de cores/gradientes predefinidos para o Banner de Fundo do Perfil
 * 8 opções elegantes e harmoniosas
 */
export const BANNER_COLOR_PRESETS = [
    {
        id: 'carmim',
        name: 'Vermelho Carmim (HubDesk)',
        gradient: 'from-red-600 via-red-700 to-rose-800',
        preview: '#dc2626'
    },
    {
        id: 'oceano',
        name: 'Azul Oceano',
        gradient: 'from-blue-600 via-indigo-600 to-blue-800',
        preview: '#2563eb'
    },
    {
        id: 'esmeralda',
        name: 'Verde Esmeralda',
        gradient: 'from-emerald-600 via-teal-600 to-green-800',
        preview: '#059669'
    },
    {
        id: 'roxo',
        name: 'Roxo Imperial',
        gradient: 'from-purple-600 via-violet-700 to-indigo-900',
        preview: '#7c3aed'
    },
    {
        id: 'sunset',
        name: 'Âmbar Sunset',
        gradient: 'from-amber-500 via-orange-600 to-red-600',
        preview: '#ea580c'
    },
    {
        id: 'grafite',
        name: 'Grafite Noturno',
        gradient: 'from-zinc-800 via-neutral-900 to-black',
        preview: '#18181b'
    },
    {
        id: 'magenta',
        name: 'Rosa Magenta',
        gradient: 'from-pink-600 via-rose-600 to-purple-700',
        preview: '#db2777'
    },
    {
        id: 'artico',
        name: 'Ciano Ártico',
        gradient: 'from-cyan-600 via-teal-600 to-blue-700',
        preview: '#0891b2'
    }
];

/**
 * Catálogo Oficial de Insígnias e Emblemas de Feitos do HubDesk (v3.9)
 * 6 emblemas oficiais calculados de forma 100% automatizada a partir
 * das métricas semanais e auditorias de qualidade.
 */
export const BADGES_CATALOG = [
    {
        id: 'emblema_desempenho',
        title: 'Emblema de Desempenho',
        iconName: 'TrendingUp',
        color: 'from-blue-500 to-indigo-600',
        textColor: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-500/10 border-blue-500/30',
        badgeBg: 'bg-blue-100 text-blue-800 border-blue-300',
        description: 'A sua pontuação média está dentro ou acima da média do seu turno (no máximo 5% abaixo, igual ou superior).',
        category: 'Performance Operacional',
        requirement: 'Média de pontos do colaborador no máx. 5% abaixo da média do turno (>= 95% da média do turno)',
        metricKey: 'desempenho',
        metricCondition: 'Média >= 95% da Média do Turno'
    },
    {
        id: 'emblema_auditorias',
        title: 'Emblema de Auditorias QA',
        iconName: 'ShieldCheck',
        color: 'from-emerald-500 to-teal-600',
        textColor: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-500/10 border-emerald-500/30',
        badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        description: 'Conformidade de qualidade exemplar: percentual de aprovação em QA de 85% ou superior.',
        category: 'Qualidade & Auditoria',
        requirement: 'Taxa de conformidade de qualidade maior ou igual a 85% (% QA >= 85%)',
        metricKey: 'qaTaxa',
        metricCondition: 'QA >= 85%'
    },
    {
        id: 'emblema_tma',
        title: 'Emblema de Agilidade TMA',
        iconName: 'Clock',
        color: 'from-amber-500 to-yellow-600',
        textColor: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-500/10 border-amber-500/30',
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
        description: 'Agilidade comprovada: TMA de Telefonia abaixo de 10 min e TMA de Chat abaixo de 25 min.',
        category: 'Velocidade & Eficiência',
        requirement: 'TMA de Telefonia < 10 min e TMA de Chat < 25 min (ambos dentro do padrão)',
        metricKey: 'tma',
        metricCondition: 'Voz < 10m e Chat < 25m'
    },
    {
        id: 'emblema_zero_perdidas',
        title: 'Emblema Fila Limpa',
        iconName: 'Zap',
        color: 'from-violet-500 to-purple-600',
        textColor: 'text-violet-600 dark:text-violet-400',
        bgColor: 'bg-violet-500/10 border-violet-500/30',
        badgeBg: 'bg-violet-100 text-violet-800 border-violet-300',
        description: 'Prontidão e foco na telefonia: percentual de chamadas perdidas de 2% ou menos contra chamadas atendidas.',
        category: 'Prontidão & Foco',
        requirement: 'Percentual de chamadas perdidas <= 2% contra chamadas atendidas',
        metricKey: 'zeroPerdidas',
        metricCondition: 'Perdidas <= 2%'
    },
    {
        id: 'emblema_volume',
        title: 'Emblema Produtividade Mestre',
        iconName: 'Rocket',
        color: 'from-orange-500 to-rose-600',
        textColor: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-500/10 border-orange-500/30',
        badgeBg: 'bg-orange-100 text-orange-800 border-orange-300',
        description: 'Alto volume de entregas e resoluções com média semanal de atendimentos finalizados superior ou igual a 40.',
        category: 'Volume & Entrega',
        requirement: 'Média de atendimentos finalizados >= 40 por semana',
        metricKey: 'volume',
        metricCondition: 'Finalizados >= 40/sem'
    },
    {
        id: 'emblema_constancia',
        title: 'Emblema Constância de Ouro',
        iconName: 'Award',
        color: 'from-cyan-500 to-blue-600',
        textColor: 'text-cyan-600 dark:text-cyan-400',
        bgColor: 'bg-cyan-500/10 border-cyan-500/30',
        badgeBg: 'bg-cyan-100 text-cyan-800 border-cyan-300',
        description: 'Constância exemplar: 100% das semanas com pontuação positiva e média geral de pontos superior a 50.',
        category: 'Consistência & Regularidade',
        requirement: '100% das semanas com pontuação positiva e média >= 50 pts',
        metricKey: 'constancia',
        metricCondition: 'Semanas 100% Positivas'
    }
];

// Mapeamento de compatibilidade para transição suave de IDs anteriores
export const LEGACY_BADGE_MAP = {
    top_tma: 'emblema_tma',
    guardiao_qualidade: 'emblema_auditorias',
    destaque_qa: 'emblema_auditorias',
    top_finalizacoes: 'emblema_volume',
    fcr_champion: 'emblema_constancia',
    plantao_ferro: 'emblema_zero_perdidas',
    mestre_redes: 'emblema_desempenho',
    veterano_hubdesk: 'emblema_constancia'
};

/**
 * Converte string de tempo HH:MM:SS ou MM:SS em minutos decimais
 */
export const timeStringToDecimalMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.trim().split(':');
    if (parts.length === 3) {
        return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10) + (parseInt(parts[2], 10) / 60);
    }
    if (parts.length === 2) {
        return parseInt(parts[0], 10) + (parseInt(parts[1], 10) / 60);
    }
    const num = parseFloat(timeStr);
    return isNaN(num) ? 0 : num;
};

/**
 * Extrai objeto Date seguro de qualquer item do sistema
 */
export const getItemDateObj = (item) => {
    if (!item) return null;
    if (item.date) {
        if (typeof item.date === 'string') {
            if (/^\d{4}-\d{2}-\d{2}/.test(item.date)) {
                const [y, m, d] = item.date.substring(0, 10).split('-').map(Number);
                return new Date(y, m - 1, d);
            }
            if (/^\d{2}\/\d{2}\/\d{4}/.test(item.date)) {
                const [d, m, y] = item.date.substring(0, 10).split('/').map(Number);
                return new Date(y, m - 1, d);
            }
        }
        if (item.date instanceof Date) return item.date;
        if (typeof item.date === 'number') return new Date(item.date);
    }
    if (item.createdAt) {
        if (typeof item.createdAt.toDate === 'function') return item.createdAt.toDate();
        if (typeof item.createdAt === 'string') {
            const parsed = new Date(item.createdAt);
            if (!isNaN(parsed.getTime())) return parsed;
        }
        if (typeof item.createdAt === 'number') return new Date(item.createdAt);
    }
    if (item.timestamp) {
        if (typeof item.timestamp.toDate === 'function') return item.timestamp.toDate();
        if (typeof item.timestamp === 'string') {
            const parsed = new Date(item.timestamp);
            if (!isNaN(parsed.getTime())) return parsed;
        }
    }
    return null;
};

/**
 * Obtém a chave do mês no formato MM/YYYY
 */
export const getItemMonthKey = (item) => {
    if (!item) return null;
    if (item.month && typeof item.month === 'string' && item.month.includes('/')) {
        return item.month;
    }
    const d = getItemDateObj(item);
    if (!d) return null;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${yyyy}`;
};

/**
 * Avalia de forma totalmente automatizada quais dos 4 emblemas oficiais o colaborador conquistou
 * com base nas métricas reais da operação disponíveis no sistema.
 * 
 * Regras Estritas:
 * 1. Emblema de Feedbacks: Relação positiva (Positivos > Negativos)
 * 2. Emblema de Desempenho: Média de pontos >= 95% da média do seu turno operacional
 * 3. Emblema de Auditorias: % QA > 90%
 * 4. Emblema de TMA: TMA Telefonia < 10 min e TMA Chat < 25 min naquele mês vigente
 * 
 * @param {Object} params
 * @param {Object} params.collaborator - Dados cadastrais do colaborador
 * @param {Array} params.allCollaborators - Lista completa de colaboradores para agrupamento de turnos
 * @param {Array} params.weeklyEvaluations - Avaliações semanais
 * @param {Array} params.qaAudits - Auditorias QA internas
 * @param {Array} params.thirdPartyAudits - Auditorias da terceirizada (opcional)
 * @param {Array} params.feedbacks - Feedbacks registrados
 * @param {Array} params.manualBadges - Concessões manuais pela gestão (opcional)
 * @returns {Object} { activeBadges: string[], automatedMap: Object, badgeDetails: Object, calculatedMetrics: Object }
 */
export const evaluateCollaboratorBadges = ({
    collaborator = {},
    allCollaborators = [],
    weeklyEvaluations = [],
    qaAudits = [],
    thirdPartyAudits = [],
    manualBadges = []
}) => {
    const colabIds = [
        collaborator?.id,
        collaborator?.firestoreId,
        collaborator?.uid
    ].filter(Boolean).map(id => String(id).trim().toLowerCase());
    const colabName = (collaborator?.name || collaborator?.displayName || '').trim().toLowerCase();

    // -------------------------------------------------------------
    // FILTRAGEM DE AVALIAÇÕES SEMANAIS DO COLABORADOR
    // -------------------------------------------------------------
    const myEvals = (weeklyEvaluations || []).filter(e => {
        if (!e) return false;
        const eId = String(e.colabId || e.collaboratorId || '').trim().toLowerCase();
        if (eId && colabIds.includes(eId)) return true;
        if (colabName) {
            const eName = String(e.name || e.colabName || '').trim().toLowerCase();
            if (eName && eName === colabName) return true;
        }
        return false;
    });

    const getEvalPoints = (ev) => {
        if (ev.pontuacao !== undefined && ev.pontuacao !== null && ev.pontuacao !== '') {
            return Number(ev.pontuacao) || 0;
        }
        return calculatePerformanceScore(ev);
    };

    // -------------------------------------------------------------
    // REGRA 1: EMBLEMA DE DESEMPENHO (Média >= 95% da média do turno)
    // -------------------------------------------------------------
    const colabShift = normalizeShiftName(collaborator?.shift || collaborator?.turno || 'Manhã I');

    const colabShiftMap = {};
    (allCollaborators || []).forEach(c => {
        const s = normalizeShiftName(c.shift || c.turno);
        if (c.id) colabShiftMap[String(c.id).toLowerCase()] = s;
        if (c.uid) colabShiftMap[String(c.uid).toLowerCase()] = s;
        if (c.firestoreId) colabShiftMap[String(c.firestoreId).toLowerCase()] = s;
        if (c.name) colabShiftMap[c.name.trim().toLowerCase()] = s;
    });

    let myTotalPoints = 0;
    myEvals.forEach(ev => {
        myTotalPoints += getEvalPoints(ev);
    });
    const myEvalsCount = myEvals.length;
    const colabAvgPoints = myEvalsCount > 0 ? (myTotalPoints / myEvalsCount) : 0;

    let shiftTotalPoints = 0;
    let shiftEvalsCount = 0;

    (weeklyEvaluations || []).forEach(ev => {
        if (!ev) return;
        let evShift = ev.shift ? normalizeShiftName(ev.shift) : null;
        if (!evShift) {
            const eId = String(ev.colabId || ev.collaboratorId || '').trim().toLowerCase();
            const eName = (ev.name || ev.colabName || '').trim().toLowerCase();
            evShift = colabShiftMap[eId] || colabShiftMap[eName] || null;
        }
        if (evShift === colabShift) {
            shiftTotalPoints += getEvalPoints(ev);
            shiftEvalsCount++;
        }
    });

    const shiftAvgPoints = shiftEvalsCount > 0 ? (shiftTotalPoints / shiftEvalsCount) : colabAvgPoints;
    const shiftThresholdPoints = shiftAvgPoints > 0 ? (shiftAvgPoints * 0.95) : 0;
    const isDesempenhoUnlocked = myEvalsCount > 0 && colabAvgPoints > 0 && colabAvgPoints >= shiftThresholdPoints;

    // -------------------------------------------------------------
    // REGRA 2: EMBLEMA DE AUDITORIAS (% QA > 90%)
    // -------------------------------------------------------------
    const combinedAudits = [
        ...(qaAudits || []),
        ...(thirdPartyAudits || [])
    ];

    const myAudits = combinedAudits.filter(a => {
        if (!a) return false;
        const aId = String(a.colabId || a.collaboratorId || '').trim().toLowerCase();
        if (aId && colabIds.includes(aId)) return true;
        if (colabName) {
            const aName = (a.collaboratorName || a.colabName || a.operator || '').trim().toLowerCase();
            if (aName && aName === colabName) return true;
        }
        return false;
    });

    const totalAudits = myAudits.length;
    const conformesAudits = myAudits.filter(a => {
        const st = String(a.status || '').toLowerCase().trim();
        const ql = String(a.quality || '').toLowerCase().trim();
        return st === 'conforme' || ql === 'positiva' || ql === 'positivo' || st === 'aprovado';
    }).length;

    const qaTaxa = totalAudits > 0 ? (conformesAudits / totalAudits) * 100 : 0;
    const isAuditoriasUnlocked = totalAudits > 0 && qaTaxa >= 85;

    // -------------------------------------------------------------
    // REGRA 3: EMBLEMA DE TMA (Telefonia < 10m e Chat < 25m)
    // -------------------------------------------------------------
    const now = new Date();
    const currentMonthKey = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    let monthEvals = myEvals.filter(ev => getItemMonthKey(ev) === currentMonthKey);
    let effectiveMonthKey = currentMonthKey;

    if (monthEvals.length === 0 && myEvals.length > 0) {
        const sortedEvals = [...myEvals].sort((a, b) => {
            const da = getItemDateObj(a);
            const db = getItemDateObj(b);
            return (db?.getTime() || 0) - (da?.getTime() || 0);
        });
        const latestKey = getItemMonthKey(sortedEvals[0]);
        if (latestKey) {
            effectiveMonthKey = latestKey;
            monthEvals = myEvals.filter(ev => getItemMonthKey(ev) === effectiveMonthKey);
        }
    }

    const tmaSourceEvals = monthEvals.length > 0 ? monthEvals : myEvals;

    let sumTmaTelMin = 0;
    let countTmaTel = 0;
    let sumTmaChatMin = 0;
    let countTmaChat = 0;

    tmaSourceEvals.forEach(ev => {
        if (ev.TMA_Telefonia) {
            const dec = timeStringToDecimalMinutes(ev.TMA_Telefonia);
            if (dec > 0) {
                sumTmaTelMin += dec;
                countTmaTel++;
            }
        }
        const chatVal = ev.TMA_Huggy || ev.TMA_Chat;
        if (chatVal) {
            const dec = timeStringToDecimalMinutes(chatVal);
            if (dec > 0) {
                sumTmaChatMin += dec;
                countTmaChat++;
            }
        }
    });

    const avgTmaTelMin = countTmaTel > 0 ? (sumTmaTelMin / countTmaTel) : 0;
    const avgTmaChatMin = countTmaChat > 0 ? (sumTmaChatMin / countTmaChat) : 0;
    const hasTmaData = countTmaTel > 0 || countTmaChat > 0;

    const isTelWithinLimit = countTmaTel === 0 || avgTmaTelMin < 10;
    const isChatWithinLimit = countTmaChat === 0 || avgTmaChatMin < 25;
    const isTmaUnlocked = hasTmaData && isTelWithinLimit && isChatWithinLimit &&
        !(countTmaTel > 0 && avgTmaTelMin >= 10) &&
        !(countTmaChat > 0 && avgTmaChatMin >= 25);

    // -------------------------------------------------------------
    // REGRA 4: EMBLEMA FILA LIMPA (Perdidas <= 2% contra Atendidas)
    // -------------------------------------------------------------
    let totalLigAtendidas = 0;
    let totalLigPerdidas = 0;
    myEvals.forEach(ev => {
        totalLigAtendidas += Number(ev.Ligacoes_Atendidas || ev.ligAtendidas || 0);
        totalLigPerdidas += Number(ev.Ligacoes_Perdidas || ev.ligPerdidas || 0);
    });
    const hasTelephonyActivity = totalLigAtendidas > 0;
    const taxaPerdidas = hasTelephonyActivity ? (totalLigPerdidas / totalLigAtendidas) * 100 : 0;
    const isZeroPerdidasUnlocked = myEvalsCount > 0 && hasTelephonyActivity && taxaPerdidas <= 2;

    // -------------------------------------------------------------
    // REGRA 5: EMBLEMA PRODUTIVIDADE MESTRE (Média de Finalizações >= 40/sem)
    // -------------------------------------------------------------
    let totalFinalizados = 0;
    myEvals.forEach(ev => {
        totalFinalizados += Number(ev.Atendimentos_Finalizados || ev.finalizados || 0);
    });
    const avgFinalizados = myEvalsCount > 0 ? (totalFinalizados / myEvalsCount) : 0;
    const isVolumeUnlocked = myEvalsCount > 0 && (avgFinalizados >= 40 || totalFinalizados >= 100);

    // -------------------------------------------------------------
    // REGRA 6: EMBLEMA CONSTÂNCIA DE OURO (100% das semanas com pontos > 0 e média >= 50)
    // -------------------------------------------------------------
    const allPositiveWeeks = myEvalsCount >= 2 && myEvals.every(ev => getEvalPoints(ev) > 0);
    const isConstanciaUnlocked = allPositiveWeeks && colabAvgPoints >= 50;

    // Mapeamento dos 6 emblemas oficiais 100% automatizados
    const automatedMap = {
        emblema_desempenho: isDesempenhoUnlocked,
        emblema_auditorias: isAuditoriasUnlocked,
        emblema_tma: isTmaUnlocked,
        emblema_zero_perdidas: isZeroPerdidasUnlocked,
        emblema_volume: isVolumeUnlocked,
        emblema_constancia: isConstanciaUnlocked
    };

    // Detalhamento e feedback para exibição na UI
    const badgeDetails = {
        emblema_desempenho: {
            unlocked: isDesempenhoUnlocked,
            currentValue: myEvalsCount > 0 
                ? `${Math.round(colabAvgPoints)} pts (Turno: ${Math.round(shiftAvgPoints)} pts)`
                : 'Sem avaliações',
            targetValue: `>= ${Math.round(shiftThresholdPoints)} pts (95% do Turno)`,
            progressPercent: shiftThresholdPoints > 0
                ? Math.min(100, Math.round((colabAvgPoints / shiftThresholdPoints) * 100))
                : (myEvalsCount > 0 ? 100 : 0),
            feedback: myEvalsCount === 0
                ? 'Sem avaliações semanais registradas para cálculo de média.'
                : isDesempenhoUnlocked
                    ? `Desempenho excelente! Média de ${Math.round(colabAvgPoints)} pts está dentro/acima do piso de 95% do turno ${colabShift} (${Math.round(shiftThresholdPoints)} pts).`
                    : `Sua média é de ${Math.round(colabAvgPoints)} pts. O piso de 95% do seu turno (${colabShift}) é de ${Math.round(shiftThresholdPoints)} pts.`
        },
        emblema_auditorias: {
            unlocked: isAuditoriasUnlocked,
            currentValue: totalAudits > 0 
                ? `${qaTaxa.toFixed(1)}% (${conformesAudits}/${totalAudits} conformes)`
                : 'Sem auditorias',
            targetValue: '>= 85% QA',
            progressPercent: totalAudits > 0 ? Math.min(100, Math.round((qaTaxa / 85) * 100)) : 0,
            feedback: totalAudits === 0
                ? 'Nenhuma auditoria realizada ainda.'
                : isAuditoriasUnlocked
                    ? `Qualidade comprovada! Taxa de conformidade de ${qaTaxa.toFixed(1)}% atinge a meta de 85% ou superior.`
                    : `Taxa atual é de ${qaTaxa.toFixed(1)}% em ${totalAudits} auditorias (necessário atingir 85% ou mais).`
        },
        emblema_tma: {
            unlocked: isTmaUnlocked,
            currentValue: hasTmaData 
                ? `Voz: ${countTmaTel > 0 ? avgTmaTelMin.toFixed(1) + 'm' : 'N/A'} | Chat: ${countTmaChat > 0 ? avgTmaChatMin.toFixed(1) + 'm' : 'N/A'}`
                : 'Sem dados no mês',
            targetValue: 'Voz < 10m & Chat < 25m',
            progressPercent: isTmaUnlocked ? 100 : (hasTmaData ? 50 : 0),
            feedback: !hasTmaData
                ? `Sem registros de TMA no período de referência (${effectiveMonthKey}).`
                : isTmaUnlocked
                    ? `Agilidade exemplar! TMA Telefonia (${avgTmaTelMin.toFixed(1)}m < 10m) e Chat (${avgTmaChatMin.toFixed(1)}m < 25m) dentro da meta.`
                    : `TMA atual: Voz ${avgTmaTelMin.toFixed(1)}m (meta < 10m), Chat ${avgTmaChatMin.toFixed(1)}m (meta < 25m). Ambos precisam estar dentro do padrão.`
        },
        emblema_zero_perdidas: {
            unlocked: isZeroPerdidasUnlocked,
            currentValue: hasTelephonyActivity
                ? `${taxaPerdidas.toFixed(1)}% (${totalLigPerdidas} perdidas / ${totalLigAtendidas} atendidas)`
                : (myEvalsCount > 0 ? 'Sem fila de telefonia' : 'Sem avaliações'),
            targetValue: '<= 2.0% de perdidas',
            progressPercent: isZeroPerdidasUnlocked 
                ? 100 
                : (hasTelephonyActivity ? Math.max(0, Math.min(99, Math.round((2 / Math.max(0.1, taxaPerdidas)) * 100))) : 0),
            feedback: !hasTelephonyActivity
                ? 'Sem atividade de telefonia nas avaliações recentes.'
                : isZeroPerdidasUnlocked
                    ? `Fila limpa exemplar! Índice de chamadas perdidas em ${taxaPerdidas.toFixed(1)}% (dentro do limite de até 2%).`
                    : `Índice de chamadas perdidas em ${taxaPerdidas.toFixed(1)}% (${totalLigPerdidas} perdidas contra ${totalLigAtendidas} atendidas). Meta: 2% ou menos.`
        },
        emblema_volume: {
            unlocked: isVolumeUnlocked,
            currentValue: myEvalsCount > 0
                ? `${Math.round(avgFinalizados)} finalizados/sem (${totalFinalizados} total)`
                : 'Sem avaliações',
            targetValue: '>= 40 finalizados/sem',
            progressPercent: myEvalsCount > 0 ? Math.min(100, Math.round((avgFinalizados / 40) * 100)) : 0,
            feedback: myEvalsCount === 0
                ? 'Sem avaliações registradas para cálculo de volume.'
                : isVolumeUnlocked
                    ? `Volume excepcional! Média semanal de ${Math.round(avgFinalizados)} atendimentos finalizados supera a meta de 40/semana.`
                    : `Média de ${Math.round(avgFinalizados)} atendimentos finalizados por semana (meta: >= 40/sem).`
        },
        emblema_constancia: {
            unlocked: isConstanciaUnlocked,
            currentValue: myEvalsCount > 0
                ? `${allPositiveWeeks ? '100% semanas positivas' : 'Possui semana zerada/negativa'} (${Math.round(colabAvgPoints)} pts médios)`
                : 'Sem avaliações',
            targetValue: '100% semanas > 0 pts e média >= 50 pts',
            progressPercent: isConstanciaUnlocked ? 100 : (allPositiveWeeks ? 70 : (myEvalsCount > 0 ? 30 : 0)),
            feedback: myEvalsCount < 2
                ? 'Requer pelo menos 2 semanas de avaliações para apurar constância.'
                : isConstanciaUnlocked
                    ? `Constância de ouro! 100% das semanas com saldo positivo e média consolidada de ${Math.round(colabAvgPoints)} pontos.`
                    : `Requer 100% das semanas com pontuação positiva e média geral >= 50 pontos (atual: ${Math.round(colabAvgPoints)} pts).`
        }
    };

    // Monta a lista oficial de emblemas ativos 100% automatizados
    const activeBadgeSet = new Set();
    Object.entries(automatedMap).forEach(([id, isActive]) => {
        if (isActive) activeBadgeSet.add(id);
    });

    // Mapeia e incorpora eventuais concessões manuais legadas
    if (Array.isArray(manualBadges)) {
        manualBadges.forEach(bId => {
            const mappedId = LEGACY_BADGE_MAP[bId] || bId;
            if (automatedMap[mappedId] !== undefined && automatedMap[mappedId]) {
                activeBadgeSet.add(mappedId);
            }
        });
    }

    const activeBadges = Array.from(activeBadgeSet);

    return {
        activeBadges,
        automatedMap,
        badgeDetails,
        calculatedMetrics: {
            colabAvgPoints,
            shiftAvgPoints,
            shiftThresholdPoints,
            colabShift,
            qaTaxa,
            totalAudits,
            conformesAudits,
            avgTmaTelMin,
            avgTmaChatMin,
            totalLigAtendidas,
            totalLigPerdidas,
            taxaPerdidas,
            totalFinalizados,
            avgFinalizados,
            effectiveMonthKey
        }
    };
};

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
