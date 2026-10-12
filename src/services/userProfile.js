import { updateProfile } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

/**
 * Atualiza o perfil completo do usuário atual tanto no Firebase Auth (photoURL, displayName)
 * quanto na coleção 'collaborators' do Firestore.
 * Proteção: Apenas Gestores podem conceder ou modificar emblemas (badges).
 */
export const saveUserProfileData = async (user, profileData, isGestor = false) => {
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
        interests: Array.isArray(profileData.interests) ? profileData.interests : [],
        phone: profileData.phone || '',
        additionalEmails: Array.isArray(profileData.additionalEmails) ? profileData.additionalEmails : [],
        slackOrTeams: profileData.slackOrTeams || '',
        workHours: profileData.workHours || '',
        updatedAt: new Date().toISOString()
    };

    // Apenas Gestor pode alterar emblemas; caso contrário, preserva os emblemas existentes do usuário
    if (isGestor && Array.isArray(profileData.badges)) {
        payload.badges = profileData.badges;
    }

    // 3. Grava no Firestore na coleção collaborators
    if (firestoreId) {
        const colabRef = doc(db, 'collaborators', firestoreId);
        const snap = await getDoc(colabRef);
        if (snap.exists()) {
            // Se não for gestor e o payload não tiver badges, preserva o que já está no banco
            if (!isGestor && !payload.badges && snap.data().badges) {
                // mantém badges existentes sem sobrescrever
            }
            await updateDoc(colabRef, payload);
        } else {
            // Se for usuário master não registrado na equipe ainda
            await setDoc(colabRef, {
                uid: firestoreId,
                email: user.email || currentAuthUser?.email || '',
                role: user.role || 'Gestor',
                shift: user.shift || 'Manhã I',
                status: 'Ativo',
                badges: Array.isArray(profileData.badges) ? profileData.badges : ['emblema_tma', 'emblema_auditorias'],
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
            systemVersion: 'v3.7.2',
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
 * Calcula o nível do usuário com base nos emblemas ativos (de 1 a 3)
 */
export const calculateUserLevel = (badges) => {
    const count = Array.isArray(badges) ? badges.length : 0;
    if (count <= 0) return 1;
    return Math.max(1, Math.min(3, count));
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
 * Catálogo Oficial de Insígnias e Emblemas de Feitos do HubDesk
 * Exclusivamente os 3 emblemas oficiais parametrizados com regras automatizadas
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
        title: 'Emblema de Auditorias',
        iconName: 'ShieldCheck',
        color: 'from-emerald-500 to-teal-600',
        textColor: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-500/10 border-emerald-500/30',
        badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        description: 'Conformidade de qualidade exemplar: percentual de aprovação em QA superior a 90%.',
        category: 'Qualidade & Auditoria',
        requirement: 'Taxa de conformidade de qualidade maior que 90% (% QA > 90%)',
        metricKey: 'qaTaxa',
        metricCondition: 'QA > 90%'
    },
    {
        id: 'emblema_tma',
        title: 'Emblema de TMA',
        iconName: 'Trophy',
        color: 'from-amber-500 to-yellow-600',
        textColor: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-500/10 border-amber-500/30',
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
        description: 'Agilidade comprovada no mês vigente: TMA de Telefonia abaixo de 10 min e TMA de Chat abaixo de 25 min.',
        category: 'Velocidade & Eficiência',
        requirement: 'TMA de Telefonia < 10 min e TMA de Chat < 25 min no mês vigente (ambos dentro do padrão)',
        metricKey: 'tma',
        metricCondition: 'Voz < 10m e Chat < 25m no mês vigente'
    }
];

// Mapeamento de compatibilidade para transição suave de IDs anteriores
export const LEGACY_BADGE_MAP = {
    top_tma: 'emblema_tma',
    guardiao_qualidade: 'emblema_auditorias',
    destaque_qa: 'emblema_auditorias',
    top_finalizacoes: 'emblema_desempenho',
    fcr_champion: 'emblema_desempenho',
    plantao_ferro: 'emblema_desempenho',
    mestre_redes: 'emblema_desempenho',
    veterano_hubdesk: 'emblema_desempenho'
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
    ].filter(Boolean);
    const colabName = (collaborator?.name || collaborator?.displayName || '').trim().toLowerCase();

    // -------------------------------------------------------------
    // FILTRAGEM DE AVALIAÇÕES SEMANAIS DO COLABORADOR
    // -------------------------------------------------------------
    const myEvals = (weeklyEvaluations || []).filter(e => {
        if (!e) return false;
        const eId = e.colabId || e.collaboratorId;
        if (eId && colabIds.includes(eId)) return true;
        if (colabName) {
            const eName = (e.name || e.colabName || '').trim().toLowerCase();
            if (eName && eName === colabName) return true;
        }
        return false;
    });

    const getEvalPoints = (ev) => {
        if (ev.pontuacao !== undefined && ev.pontuacao !== null && ev.pontuacao !== '') {
            return Number(ev.pontuacao) || 0;
        }
        const fin = Number(ev.Atendimentos_Finalizados || ev.finalizados || 0);
        const lig = Number(ev.Ligacoes_Atendidas || ev.ligAtendidas || 0);
        const per = Number(ev.Ligacoes_Perdidas || ev.ligPerdidas || 0);
        const hug = Number(ev.Atendimentos_Huggy || ev.huggyVol || 0);
        return (fin * 1) + (lig * 2) + (hug * 1) + (per * -5);
    };

    // -------------------------------------------------------------
    // REGRA 2: EMBLEMA DE DESEMPENHO (Média >= 95% da média do turno)
    // -------------------------------------------------------------
    const colabShift = normalizeShiftName(collaborator?.shift || collaborator?.turno || 'Manhã I');

    // Mapeamento de turnos dos colaboradores da equipe
    const colabShiftMap = {};
    (allCollaborators || []).forEach(c => {
        const s = normalizeShiftName(c.shift || c.turno);
        if (c.id) colabShiftMap[c.id] = s;
        if (c.uid) colabShiftMap[c.uid] = s;
        if (c.name) colabShiftMap[c.name.trim().toLowerCase()] = s;
    });

    let myTotalPoints = 0;
    myEvals.forEach(ev => {
        myTotalPoints += getEvalPoints(ev);
    });
    const myEvalsCount = myEvals.length;
    const colabAvgPoints = myEvalsCount > 0 ? (myTotalPoints / myEvalsCount) : 0;

    // Calcula a média de todos do mesmo turno
    let shiftTotalPoints = 0;
    let shiftEvalsCount = 0;

    (weeklyEvaluations || []).forEach(ev => {
        if (!ev) return;
        let evShift = ev.shift ? normalizeShiftName(ev.shift) : null;
        if (!evShift) {
            const eId = ev.colabId || ev.collaboratorId;
            const eName = (ev.name || ev.colabName || '').trim().toLowerCase();
            evShift = colabShiftMap[eId] || colabShiftMap[eName] || null;
        }
        if (evShift === colabShift) {
            shiftTotalPoints += getEvalPoints(ev);
            shiftEvalsCount++;
        }
    });

    const shiftAvgPoints = shiftEvalsCount > 0 ? (shiftTotalPoints / shiftEvalsCount) : colabAvgPoints;
    // Tolerância oficial: no máximo 5% abaixo da média do turno, igual ou maior
    const shiftThresholdPoints = shiftAvgPoints > 0 ? (shiftAvgPoints * 0.95) : 0;
    const isDesempenhoUnlocked = myEvalsCount > 0 && colabAvgPoints >= shiftThresholdPoints;

    // -------------------------------------------------------------
    // REGRA 3: EMBLEMA DE AUDITORIAS (% QA > 90%)
    // -------------------------------------------------------------
    const combinedAudits = [
        ...(qaAudits || []),
        ...(thirdPartyAudits || [])
    ];

    const myAudits = combinedAudits.filter(a => {
        if (!a) return false;
        const aId = a.colabId || a.collaboratorId;
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
    const isAuditoriasUnlocked = totalAudits > 0 && qaTaxa > 90;

    // -------------------------------------------------------------
    // REGRA 4: EMBLEMA DE TMA (Telefonia < 10m e Chat < 25m no mês vigente)
    // -------------------------------------------------------------
    const now = new Date();
    const currentMonthKey = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    // Filtra avaliações daquele mês vigente
    let monthEvals = myEvals.filter(ev => getItemMonthKey(ev) === currentMonthKey);
    let effectiveMonthKey = currentMonthKey;

    // Se o mês vigente ainda não tiver registros mas houver avaliações anteriores,
    // utiliza o mês mais recente disponível para cálculo
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

    let sumTmaTelMin = 0;
    let countTmaTel = 0;
    let sumTmaChatMin = 0;
    let countTmaChat = 0;

    monthEvals.forEach(ev => {
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

    // Regra estrita: "TMA de Telefonia abaixo de 10 minutos e TMA de Chat abaixo de 25 minutos naquele mês vigente.
    // Se um dos dois não estiver dentro do padrão, não recebe a insígnia."
    const isTelWithinLimit = countTmaTel === 0 || avgTmaTelMin < 10;
    const isChatWithinLimit = countTmaChat === 0 || avgTmaChatMin < 25;
    const isTmaUnlocked = hasTmaData && isTelWithinLimit && isChatWithinLimit &&
        !(countTmaTel > 0 && avgTmaTelMin >= 10) &&
        !(countTmaChat > 0 && avgTmaChatMin >= 25);

    // Mapeamento dos 3 emblemas oficiais
    const automatedMap = {
        emblema_desempenho: isDesempenhoUnlocked,
        emblema_auditorias: isAuditoriasUnlocked,
        emblema_tma: isTmaUnlocked
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
            targetValue: '> 90% QA',
            progressPercent: totalAudits > 0 ? Math.min(100, Math.round((qaTaxa / 90) * 100)) : 0,
            feedback: totalAudits === 0
                ? 'Nenhuma auditoria realizada ainda.'
                : isAuditoriasUnlocked
                    ? `Qualidade comprovada! Taxa de conformidade de ${qaTaxa.toFixed(1)}% supera os 90% exigidos.`
                    : `Taxa atual é de ${qaTaxa.toFixed(1)}% em ${totalAudits} auditorias (necessário superior a 90%).`
        },
        emblema_tma: {
            unlocked: isTmaUnlocked,
            currentValue: hasTmaData 
                ? `Voz: ${countTmaTel > 0 ? avgTmaTelMin.toFixed(1) + 'm' : 'N/A'} | Chat: ${countTmaChat > 0 ? avgTmaChatMin.toFixed(1) + 'm' : 'N/A'}`
                : 'Sem dados no mês',
            targetValue: 'Voz < 10m & Chat < 25m',
            progressPercent: isTmaUnlocked ? 100 : (hasTmaData ? 50 : 0),
            feedback: !hasTmaData
                ? `Sem registros de TMA no mês de referência (${effectiveMonthKey}).`
                : isTmaUnlocked
                    ? `Agilidade exemplar no mês (${effectiveMonthKey})! TMA Telefonia (${avgTmaTelMin.toFixed(1)}m < 10m) e Chat (${avgTmaChatMin.toFixed(1)}m < 25m) dentro da meta.`
                    : `TMA no mês (${effectiveMonthKey}): Voz ${avgTmaTelMin.toFixed(1)}m (meta < 10m), Chat ${avgTmaChatMin.toFixed(1)}m (meta < 25m). Ambos precisam estar dentro do padrão.`
        }
    };

    // Monta a lista oficial de emblemas ativos
    const activeBadgeSet = new Set();
    Object.entries(automatedMap).forEach(([id, isActive]) => {
        if (isActive) activeBadgeSet.add(id);
    });

    // Mapeia e incorpora eventuais concessões manuais
    if (Array.isArray(manualBadges)) {
        manualBadges.forEach(bId => {
            const mappedId = LEGACY_BADGE_MAP[bId] || bId;
            if (automatedMap[mappedId] !== undefined) {
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
            effectiveMonthKey
        }
    };
};

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
