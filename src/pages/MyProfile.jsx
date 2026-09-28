import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Camera, Upload, Link as LinkIcon, Check, X, ShieldCheck,
    Trophy, Zap, Star, Rocket, CalendarCheck, Network, Award, Mail,
    Phone, Clock, Sun, Sunset, Moon, ExternalLink, Copy, CheckCircle2,
    Sparkles, Plus, Trash2, Heart, Edit3, BarChart3, Loader2, Save,
    Lock, Info, AlertCircle, Headphones, Users, UserCheck, Search,
    ChevronDown, ArrowLeft, Eye
} from 'lucide-react';
import { subscribeSharedCollection } from '../services/dataCache';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import { useNotification } from '../context/NotificationContext';
import { ROLES, normalizeRole } from '../services/rbac';
import {
    saveUserProfileData,
    saveSystemShiftsInfo,
    PRESET_AVATARS,
    BADGES_CATALOG,
    SYSTEM_SHIFTS,
    SYSTEM_SHIFTS_MAP,
    THIRD_PARTY_SCHEDULE_INFO,
    normalizeShiftName,
    calculateUserLevel,
    DEFAULT_NETWORK_TAG_SUGGESTIONS,
    DEFAULT_INTEREST_SUGGESTIONS
} from '../services/userProfile';

// Mapeamento de ícones dos emblemas
const BADGE_ICONS = {
    Trophy,
    Zap,
    Star,
    ShieldCheck,
    Rocket,
    CalendarCheck,
    Network,
    Award
};

const NETWORK_LEVELS = [
    {
        id: 'Básico',
        label: 'Básico',
        color: 'border-emerald-500 text-emerald-600 bg-emerald-500/10',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        desc: 'Conceitos de IP, DHCP, DNS, roteadores residenciais e cabeamento.'
    },
    {
        id: 'Médio',
        label: 'Médio',
        color: 'border-amber-500 text-amber-600 bg-amber-500/10',
        badge: 'bg-amber-100 text-amber-800 border-amber-300',
        desc: 'VLANs, sub-redes, GPON/ONU, Wi-Fi Mesh e troubleshooting de enlaces.'
    },
    {
        id: 'Avançado',
        label: 'Avançado',
        color: 'border-red-500 text-red-600 bg-red-500/10',
        badge: 'bg-red-100 text-red-800 border-red-300',
        desc: 'BGP, OSPF, Mikrotik RouterOS, Huawei OLT, QoS e topologias complexas.'
    }
];

// Funções de conversão matemática de tempos para cálculos reais
const timeToSeconds = (timeStr) => {
    if (!timeStr || timeStr === '--' || timeStr === '--:--:--' || timeStr === '00:00:00') return 0;
    const parts = String(timeStr).trim().split(':');
    if (parts.length === 3) {
        return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
    }
    if (parts.length === 2) {
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return 0;
};

const secondsToTime = (totalSeconds) => {
    if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '--:--:--';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const calcularPontuacao = (metrics) => {
    if (!metrics) return 0;
    const ptsFinalizados = (Number(metrics.finalizados) || Number(metrics.Atendimentos_Finalizados) || 0) * 1;
    const ptsLigacoes = (Number(metrics.ligAtendidas) || Number(metrics.Ligacoes_Atendidas) || 0) * 2;
    const ptsHuggy = (Number(metrics.huggyVol) || Number(metrics.Atendimentos_Huggy) || 0) * 1;
    const ptsPerdidas = (Number(metrics.ligPerdidas) || Number(metrics.Ligacoes_Perdidas) || 0) * -5;
    return ptsFinalizados + ptsLigacoes + ptsHuggy + ptsPerdidas;
};

const getInitialFormData = (u) => {
    const rawShift = u?.shift || 'Manhã I';
    const normShift = normalizeShiftName(rawShift);
    const shiftConfig = SYSTEM_SHIFTS_MAP[normShift] || SYSTEM_SHIFTS[0];

    return {
        name: u?.name || u?.displayName || u?.email?.split('@')[0] || '',
        photoURL: u?.photoURL || u?.photoUrl || '',
        bio: u?.bio || '',
        networkKnowledge: u?.networkKnowledge || 'Básico',
        networkSkills: Array.isArray(u?.networkSkills) && u.networkSkills.length > 0 
            ? u.networkSkills 
            : ['GPON / Fibra Óptica', 'Wi-Fi 6 / Mesh', 'Troubleshooting N2'],
        interests: Array.isArray(u?.interests) && u.interests.length > 0
            ? u.interests
            : ['Engenharia de Redes', 'Atendimento Humanizado', 'Automação'],
        phone: u?.phone || '',
        additionalEmails: Array.isArray(u?.additionalEmails) ? u.additionalEmails : [],
        slackOrTeams: u?.slackOrTeams || '',
        shift: normShift,
        workHours: u?.workHours || shiftConfig.hours,
        badges: Array.isArray(u?.badges) ? u.badges : ['top_tma', 'destaque_qa']
    };
};

const MyProfile = ({ currentUserId, currentUser: propUser }) => {
    const { currentUser: authContextUser } = useAuth();
    const { isMasterAdmin, normalizedRole } = usePermissions();
    const { showToast } = useNotification();
    const myAuthUser = propUser || authContextUser;

    const [collaboratorsList, setCollaboratorsList] = useState([]);
    const [selectedColabId, setSelectedColabId] = useState(null);
    const [colabSearchQuery, setColabSearchQuery] = useState('');
    const [isColabPickerOpen, setIsColabPickerOpen] = useState(false);

    // Carrega a lista completa de colaboradores para alternar perfis e ver status
    useEffect(() => {
        const unsub = subscribeSharedCollection('collaborators', (items) => {
            const list = [...items];
            list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setCollaboratorsList(list);
        });
        return () => unsub();
    }, []);

    // Determina o colaborador que está sendo visualizado (Meu perfil ou de outro colega)
    const activeSelectedColab = useMemo(() => {
        if (!selectedColabId) return null;
        return collaboratorsList.find(c => (c.id === selectedColabId || c.firestoreId === selectedColabId || c.uid === selectedColabId)) || null;
    }, [selectedColabId, collaboratorsList]);

    const isViewingOther = Boolean(activeSelectedColab && (activeSelectedColab.id !== (myAuthUser?.firestoreId || myAuthUser?.uid || currentUserId)));
    const user = activeSelectedColab || myAuthUser;

    const isGestor = isMasterAdmin || normalizedRole === 'gestor';

    const [saving, setSaving] = useState(false);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [copiedPhone, setCopiedPhone] = useState(false);

    // Estado do formulário de Perfil
    const [formData, setFormData] = useState(() => getInitialFormData(user));

    // Inputs temporários para tags e novos e-mails
    const [newSkillInput, setNewSkillInput] = useState('');
    const [newInterestInput, setNewInterestInput] = useState('');
    const [newEmailInput, setNewEmailInput] = useState('');

    // Input temporário no modal de foto
    const [photoUrlInput, setPhotoUrlInput] = useState(() => user?.photoURL || user?.photoUrl || '');
    const [photoPreview, setPhotoPreview] = useState(() => user?.photoURL || user?.photoUrl || '');

    // Sincroniza se o usuário selecionado mudar
    const prevUserIdRef = useRef(user?.firestoreId || user?.uid || user?.id);
    useEffect(() => {
        const currentTarget = activeSelectedColab || myAuthUser;
        const currentId = currentTarget?.firestoreId || currentTarget?.uid || currentTarget?.id;
        if (currentId !== prevUserIdRef.current) {
            prevUserIdRef.current = currentId;
            const updated = getInitialFormData(currentTarget);
            setFormData(updated);
            setPhotoUrlInput(updated.photoURL);
            setPhotoPreview(updated.photoURL);
        }
    }, [activeSelectedColab, myAuthUser]);

    // Métricas reais do colaborador (SEM MOCK)
    const hasTargetUser = Boolean((user?.firestoreId || user?.uid || currentUserId) || user?.name || user?.email);
    const [realMetrics, setRealMetrics] = useState({
        loading: hasTargetUser,
        mediaTmaTelefonia: '--:--:--',
        mediaTmaChat: '--:--:--',
        mediaPontos: '--',
        percentualAuditorias: '--%',
        totalAvaliacoes: 0,
        totalAuditorias: 0
    });

    // Carrega dados 100% reais do Firestore para o colaborador (SEM MOCK)
    useEffect(() => {
        const targetId = user?.firestoreId || user?.uid || currentUserId;
        const targetName = (user?.name || user?.displayName || '').trim().toLowerCase();
        const targetEmail = (user?.email || '').trim().toLowerCase();

        if (!targetId && !targetName && !targetEmail) {
            return;
        }

        let isMounted = true;

        // 1. Assinatura em cache compartilhado para avaliações semanais
        const unsubEvals = subscribeSharedCollection('weekly_evaluations', (items) => {
            if (!isMounted) return;
            const evalDocs = [];
            items.forEach(dt => {
                const matchesId = (targetId && (dt.colabId === targetId || dt.collaboratorId === targetId || dt.uid === targetId));
                const matchesName = targetName && (
                    (dt.colabName && dt.colabName.trim().toLowerCase() === targetName) ||
                    (dt.collaboratorName && dt.collaboratorName.trim().toLowerCase() === targetName) ||
                    (dt.name && dt.name.trim().toLowerCase() === targetName)
                );
                const matchesEmail = targetEmail && (
                    (dt.email && dt.email.trim().toLowerCase() === targetEmail) ||
                    (dt.colabEmail && dt.colabEmail.trim().toLowerCase() === targetEmail)
                );
                if (matchesId || matchesName || matchesEmail) {
                    evalDocs.push(dt);
                }
            });

            let totalTmaTelSec = 0;
            let countTmaTel = 0;
            let totalTmaChatSec = 0;
            let countTmaChat = 0;
            let totalScoreSum = 0;
            let countEvals = 0;

            evalDocs.forEach(dt => {
                countEvals++;

                // Média TMA Telefonia real
                const tmaTelStr = dt.TMA_Telefonia || dt.tmaTelefonia || dt.tma_tel;
                const telSec = timeToSeconds(tmaTelStr);
                if (telSec > 0 && telSec < 86400) {
                    totalTmaTelSec += telSec;
                    countTmaTel++;
                }

                // Média TMA Chat (Huggy) real
                const tmaChatStr = dt.TMA_Huggy || dt.tmaHuggy || dt.tma_chat || dt.tmaChat;
                const chatSec = timeToSeconds(tmaChatStr);
                if (chatSec > 0 && chatSec < 86400) {
                    totalTmaChatSec += chatSec;
                    countTmaChat++;
                }

                // Média de Pontos real
                const pts = dt.pontuacao !== undefined ? Number(dt.pontuacao) : calcularPontuacao(dt);
                totalScoreSum += pts;
            });

            const mediaTmaTel = countTmaTel > 0 ? secondsToTime(totalTmaTelSec / countTmaTel) : '--:--:--';
            const mediaTmaChat = countTmaChat > 0 ? secondsToTime(totalTmaChatSec / countTmaChat) : '--:--:--';
            const mediaPts = countEvals > 0 ? `${(totalScoreSum / countEvals).toFixed(1)} pts` : '--';

            setRealMetrics(prev => ({
                ...prev,
                mediaTmaTelefonia: mediaTmaTel,
                mediaTmaChat: mediaTmaChat,
                mediaPontos: mediaPts,
                totalAvaliacoes: countEvals
            }));
        });

        // 2. Assinatura em cache compartilhado para auditorias QA
        const unsubAudits = subscribeSharedCollection('qa_audits', (items) => {
            if (!isMounted) return;
            const auditDocs = [];
            items.forEach(dt => {
                const matchesId = (targetId && (dt.colabId === targetId || dt.collaboratorId === targetId || dt.uid === targetId));
                const matchesName = targetName && (
                    (dt.colabName && dt.colabName.trim().toLowerCase() === targetName) ||
                    (dt.collaboratorName && dt.collaboratorName.trim().toLowerCase() === targetName) ||
                    (dt.name && dt.name.trim().toLowerCase() === targetName)
                );
                if (matchesId || matchesName) {
                    auditDocs.push(dt);
                }
            });

            let totalAuditScoreSum = 0;
            let countAuditsWithScore = 0;
            let countConforme = 0;

            auditDocs.forEach(dt => {
                const sc = Number(dt.score ?? dt.notaFinal ?? dt.percentage);
                if (!isNaN(sc) && sc > 0) {
                    totalAuditScoreSum += sc;
                    countAuditsWithScore++;
                }
                if (dt.status === 'Conforme' || dt.conforme === true) {
                    countConforme++;
                }
            });

            let percentualAuditorias = '--%';
            if (countAuditsWithScore > 0) {
                percentualAuditorias = `${Math.round(totalAuditScoreSum / countAuditsWithScore)}%`;
            } else if (auditDocs.length > 0) {
                percentualAuditorias = `${((countConforme / auditDocs.length) * 100).toFixed(1)}%`;
            }

            setRealMetrics(prev => ({
                ...prev,
                loading: false,
                percentualAuditorias,
                totalAuditorias: auditDocs.length
            }));
        });

        // Garante persistência das configurações de turnos e terceirizada no sistema
        saveSystemShiftsInfo();

        return () => {
            isMounted = false;
            unsubEvals();
            unsubAudits();
        };
    }, [user, currentUserId]);

    // Role formatada
    const roleInfo = useMemo(() => {
        const key = normalizeRole(user?.role);
        return ROLES.find(r => r.id === key) || ROLES[3];
    }, [user?.role]);

    // Turno atual normalizado
    const currentShift = useMemo(() => {
        const norm = normalizeShiftName(formData.shift);
        return SYSTEM_SHIFTS_MAP[norm] || SYSTEM_SHIFTS[0];
    }, [formData.shift]);

    // Nível calculado com base nos emblemas ativos (de 1 a 8)
    const userLevel = useMemo(() => {
        return calculateUserLevel(formData.badges);
    }, [formData.badges]);

    // Manipulação de tags de conhecimento em redes
    const handleAddSkillTag = (tagToAdd) => {
        const tag = (tagToAdd || newSkillInput).trim();
        if (!tag) return;
        if (formData.networkSkills.includes(tag)) {
            showToast('Essa tag já foi adicionada.', 'info');
            return;
        }
        if (formData.networkSkills.length >= 15) {
            showToast('Limite máximo de 15 tags atingido.', 'warning');
            return;
        }
        setFormData(prev => ({
            ...prev,
            networkSkills: [...prev.networkSkills, tag]
        }));
        setNewSkillInput('');
    };

    const handleRemoveSkillTag = (tagToRemove) => {
        setFormData(prev => ({
            ...prev,
            networkSkills: prev.networkSkills.filter(t => t !== tagToRemove)
        }));
    };

    // Manipulação de interesses
    const handleAddInterest = (interestToAdd) => {
        const item = (interestToAdd || newInterestInput).trim();
        if (!item) return;
        if (formData.interests.includes(item)) {
            showToast('Esse interesse já consta na lista.', 'info');
            return;
        }
        setFormData(prev => ({
            ...prev,
            interests: [...prev.interests, item]
        }));
        setNewInterestInput('');
    };

    const handleRemoveInterest = (itemToRemove) => {
        setFormData(prev => ({
            ...prev,
            interests: prev.interests.filter(i => i !== itemToRemove)
        }));
    };

    // Manipulação de e-mails adicionais
    const handleAddEmail = () => {
        const email = newEmailInput.trim().toLowerCase();
        if (!email) return;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showToast('Insira um formato de e-mail válido.', 'warning');
            return;
        }
        if (formData.additionalEmails.includes(email) || email === user?.email?.toLowerCase()) {
            showToast('Este e-mail já está adicionado.', 'info');
            return;
        }
        setFormData(prev => ({
            ...prev,
            additionalEmails: [...prev.additionalEmails, email]
        }));
        setNewEmailInput('');
        showToast('E-mail adicional adicionado com sucesso.', 'success');
    };

    const handleRemoveEmail = (emailToRemove) => {
        setFormData(prev => ({
            ...prev,
            additionalEmails: prev.additionalEmails.filter(e => e !== emailToRemove)
        }));
    };

    // Controle de Emblemas (REGRA: Apenas Gestor pode alterar)
    const handleToggleBadge = (badgeId) => {
        if (!isGestor) {
            showToast('Permissão restrita: Apenas o Gestor pode conceder ou alterar os emblemas da equipe.', 'warning');
            return;
        }
        setFormData(prev => {
            const exists = prev.badges.includes(badgeId);
            const nextBadges = exists 
                ? prev.badges.filter(id => id !== badgeId)
                : [...prev.badges, badgeId];
            return { ...prev, badges: nextBadges };
        });
    };

    // Alteração de Turno
    const handleChangeShift = (shiftId) => {
        const shiftObj = SYSTEM_SHIFTS_MAP[shiftId];
        setFormData(prev => ({
            ...prev,
            shift: shiftId,
            workHours: shiftObj ? shiftObj.hours : prev.workHours
        }));
    };

    // Manipulação do Modal de Foto
    const handleOpenPhotoModal = () => {
        if (isViewingOther && !isGestor) {
            showToast('Você está em modo de visualização. Apenas o próprio colaborador ou a Gestão podem alterar a foto.', 'info');
            return;
        }
        setPhotoPreview(formData.photoURL || '');
        setPhotoUrlInput(formData.photoURL || '');
        setIsPhotoModalOpen(true);
    };

    const handleSelectPresetAvatar = (url) => {
        setPhotoPreview(url);
        setPhotoUrlInput(url);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Por favor, selecione um arquivo de imagem válido.', 'warning');
            return;
        }

        if (file.size > 3 * 1024 * 1024) {
            showToast('A imagem deve ter no máximo 3MB.', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result;
            if (typeof result === 'string') {
                setPhotoPreview(result);
                setPhotoUrlInput(result);
                showToast('Foto carregada com sucesso!', 'success');
            }
        };
        reader.readAsDataURL(file);
    };

    const handleConfirmPhoto = () => {
        setFormData(prev => ({
            ...prev,
            photoURL: photoPreview.trim()
        }));
        setIsPhotoModalOpen(false);
        showToast('Foto selecionada! Clique em "Salvar Alterações" para confirmar.', 'info');
    };

    const handleRemovePhoto = () => {
        setPhotoPreview('');
        setPhotoUrlInput('');
        setFormData(prev => ({
            ...prev,
            photoURL: ''
        }));
        setIsPhotoModalOpen(false);
        showToast('Foto removida.', 'info');
    };

    // Copiar telefone
    const handleCopyPhone = () => {
        if (!formData.phone) return;
        navigator.clipboard.writeText(formData.phone);
        setCopiedPhone(true);
        showToast('Telefone copiado para a área de transferência!', 'success');
        setTimeout(() => setCopiedPhone(false), 2000);
    };

    // Salvar todas as alterações no Firebase Auth & Firestore
    const handleSaveProfile = async (e) => {
        if (e) e.preventDefault();
        if (isViewingOther && !isGestor) {
            showToast('Você está no modo de visualização. Apenas o próprio colaborador ou a Gestão podem alterar os dados deste perfil.', 'warning');
            return;
        }
        setSaving(true);
        try {
            await saveUserProfileData(user, formData, isGestor);
            showToast('Perfil atualizado com sucesso no Firebase!', 'success');
        } catch (error) {
            console.error('Erro ao salvar perfil:', error);
            showToast('Erro ao salvar perfil: ' + error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Lista filtrada para o dropdown de busca de colaboradores
    const filteredColabsForPicker = useMemo(() => {
        if (!colabSearchQuery.trim()) return collaboratorsList;
        const q = colabSearchQuery.toLowerCase().trim();
        return collaboratorsList.filter(c => 
            (c.name || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q) ||
            (c.role || '').toLowerCase().includes(q) ||
            (c.shift || '').toLowerCase().includes(q) ||
            (c.status || '').toLowerCase().includes(q)
        );
    }, [collaboratorsList, colabSearchQuery]);

    // Status operacional formatado
    const userOperationalStatus = user?.status || (user?.active !== false ? 'Ativo' : 'Inativo');
    const getStatusStyle = (st) => {
        switch (st) {
            case 'Ativo':
                return { badge: 'bg-emerald-50 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500', ping: true };
            case 'Férias':
                return { badge: 'bg-amber-50 text-amber-800 border-amber-300', dot: 'bg-amber-500', ping: false };
            case 'Afastado':
                return { badge: 'bg-purple-50 text-purple-800 border-purple-300', dot: 'bg-purple-500', ping: false };
            case 'Inativo':
            default:
                return { badge: 'bg-rose-50 text-rose-800 border-rose-300', dot: 'bg-rose-500', ping: false };
        }
    };
    const currentStatusStyle = getStatusStyle(userOperationalStatus);

    return (
        <div className="flex-1 p-4 sm:p-6 lg:p-8 bg-gray-50 h-full overflow-y-auto font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* 0. BARRA DE SELEÇÃO E VISUALIZAÇÃO DE PERFIS DA EQUIPE */}
                <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            {/* Botão Meu Perfil */}
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedColabId(null);
                                    setIsColabPickerOpen(false);
                                }}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                    !isViewingOther
                                        ? 'bg-zinc-950 text-white shadow-xs'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                            >
                                <UserCheck className="w-4 h-4 text-emerald-400" />
                                <span>Meu Perfil</span>
                            </button>

                            {/* Botão Alternar/Ver Outro Colaborador */}
                            <button
                                type="button"
                                onClick={() => setIsColabPickerOpen(!isColabPickerOpen)}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                                    isViewingOther
                                        ? 'bg-red-50 border-red-300 text-red-700 shadow-2xs'
                                        : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                                }`}
                            >
                                <Users className="w-4 h-4 text-red-600" />
                                <span className="truncate max-w-[140px] sm:max-w-[200px]">
                                    {isViewingOther ? `Perfil: ${user?.name || 'Colaborador'}` : 'Ver Perfis da Equipe'}
                                </span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isColabPickerOpen ? 'rotate-180' : ''}`} />
                            </button>
                        </div>

                        {/* Indicador de Status Operacional Atual */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-medium hidden md:inline">Status do Colaborador:</span>
                            <div className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-2xs ${currentStatusStyle.badge}`}>
                                <span className="relative flex h-2 w-2">
                                    {currentStatusStyle.ping && (
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${currentStatusStyle.dot}`}></span>
                                    )}
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${currentStatusStyle.dot}`}></span>
                                </span>
                                <span>{userOperationalStatus}</span>
                            </div>

                            {isViewingOther && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedColabId(null)}
                                    className="text-xs text-red-600 hover:text-red-700 font-bold ml-1.5 inline-flex items-center gap-1 cursor-pointer hover:underline"
                                    title="Voltar ao meu próprio perfil"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Voltar ao Meu Perfil</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Dropdown Expansível com Busca de Colaboradores */}
                    {isColabPickerOpen && (
                        <div className="pt-3 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-150 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-zinc-500" />
                                    Selecione um colaborador para visualizar o status e perfil:
                                </span>
                                <span className="text-[11px] text-gray-400 font-mono">
                                    {filteredColabsForPicker.length} colaboradores
                                </span>
                            </div>

                            <div className="relative">
                                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                <input
                                    type="text"
                                    value={colabSearchQuery}
                                    onChange={(e) => setColabSearchQuery(e.target.value)}
                                    placeholder="Buscar colaborador por nome, cargo, turno ou status..."
                                    className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                                {filteredColabsForPicker.map((c) => {
                                    const cId = c.id || c.firestoreId || c.uid;
                                    const isSelected = (selectedColabId === cId) || (!selectedColabId && cId === (myAuthUser?.firestoreId || myAuthUser?.uid || currentUserId));
                                    const cStatus = c.status || (c.active !== false ? 'Ativo' : 'Inativo');
                                    const cStatusStyle = getStatusStyle(cStatus);
                                    const cLevel = calculateUserLevel(c.badges);

                                    return (
                                        <button
                                            type="button"
                                            key={cId}
                                            onClick={() => {
                                                setSelectedColabId(cId);
                                                setIsColabPickerOpen(false);
                                                showToast(`Visualizando perfil de ${c.name || 'Colaborador'}`, 'info');
                                            }}
                                            className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                                                isSelected
                                                    ? 'bg-red-50/80 border-red-400 ring-1 ring-red-400 font-bold shadow-2xs'
                                                    : 'bg-white hover:bg-gray-50 border-gray-200'
                                            }`}
                                        >
                                            {/* Avatar */}
                                            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                                                {(c.photoURL || c.photoUrl) ? (
                                                    <img src={c.photoURL || c.photoUrl} alt={c.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    c.name?.charAt(0)?.toUpperCase() || 'U'
                                                )}
                                            </div>

                                            {/* Detalhes */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-xs font-bold text-gray-900 truncate">{c.name}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold border ${cStatusStyle.badge}`}>
                                                        {cStatus}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-0.5">
                                                    <span className="truncate">{c.role || 'Colaborador'}</span>
                                                    <span>•</span>
                                                    <span className="truncate text-zinc-700 font-semibold">{c.shift || 'Geral'}</span>
                                                    <span>•</span>
                                                    <span className="text-amber-700 font-mono">Nv.{cLevel}</span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Banner de Aviso quando em modo de visualização de outro colega */}
                {isViewingOther && (
                    <div className="p-3.5 bg-gradient-to-r from-red-950 via-zinc-900 to-zinc-950 rounded-2xl text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm border border-red-900/40">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-red-600/30 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                                <Eye className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                                    <span>Modo de Visualização do Perfil da Equipe</span>
                                    <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-white/10 text-white border border-white/20">
                                        Público
                                    </span>
                                </h4>
                                <p className="text-[11px] text-zinc-300">
                                    Você está consultando o status, horários, histórico de métricas e informações de <strong>{user?.name}</strong>.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {formData.phone && (
                                <button
                                    type="button"
                                    onClick={handleCopyPhone}
                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-white/20"
                                >
                                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Copiar Contato</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setSelectedColabId(null)}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>Voltar ao Meu Perfil</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* 1. HERO BANNER DO PERFIL (HEADER EXECUTIVO) */}
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/90 shadow-xs overflow-hidden relative">
                    {/* Fundo Gradiente Elegante com Textura Sutil */}
                    <div className="h-44 sm:h-52 bg-gradient-to-r from-zinc-900 via-zinc-950 to-red-950 p-6 relative flex items-start justify-between">
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
                        
                        <div className="relative z-10 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white backdrop-blur-md border border-white/20 shadow-xs">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                Perfil Oficial HubDesk • v3.6
                            </span>
                        </div>

                        {/* Botão de Salvar Rápido no Topo */}
                        <div className="relative z-10">
                            {isViewingOther && !isGestor ? (
                                <div className="px-3.5 py-1.5 bg-black/40 backdrop-blur-md border border-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm">
                                    <Eye className="w-3.5 h-3.5 text-zinc-300" />
                                    <span>Modo Consulta</span>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleSaveProfile}
                                    disabled={saving}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-red-950/40 flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Salvando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            <span>Salvar Alterações</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Informações Centrais do Usuário (Sobrepostas ao Banner) */}
                    <div className="px-6 pb-6 pt-0 relative">
                        <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-4">
                            
                            {/* Avatar com Badge de Edição PhotoUrl */}
                            <div className="relative group">
                                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl sm:rounded-3xl border-4 border-white shadow-xl bg-zinc-900 overflow-hidden flex items-center justify-center shrink-0 relative transition-transform group-hover:scale-[1.02]">
                                    {formData.photoURL ? (
                                        <img
                                            src={formData.photoURL}
                                            alt={formData.name || 'Foto do Perfil'}
                                            className="w-full h-full object-cover"
                                            onError={() => {
                                                setFormData(prev => ({ ...prev, photoURL: '' }));
                                                showToast('Erro ao carregar URL da foto. Avatar padrão restaurado.', 'warning');
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-red-600 to-zinc-900 text-white select-none">
                                            <span className="text-3xl sm:text-4xl font-black">
                                                {formData.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                                            </span>
                                            <span className="text-[10px] font-mono text-zinc-300 mt-0.5">Sem Foto</span>
                                        </div>
                                    )}

                                    {/* Botão Hover para Alterar Foto */}
                                    {(!isViewingOther || isGestor) && (
                                        <button
                                            type="button"
                                            onClick={handleOpenPhotoModal}
                                            title="Alterar Foto de Perfil"
                                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer backdrop-blur-2xs"
                                        >
                                            <Camera className="w-6 h-6 mb-1 text-white" />
                                            <span className="text-[11px] font-bold">Alterar Foto</span>
                                        </button>
                                    )}
                                </div>

                                {/* Status Pulsante Online/Ativo */}
                                <div 
                                    className="absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white bg-zinc-900 shadow-md flex items-center justify-center"
                                    title={`Status: ${userOperationalStatus}`}
                                >
                                    <span className={`w-2.5 h-2.5 rounded-full ${currentStatusStyle.dot}`}></span>
                                </div>
                            </div>

                            {/* Badges de Destaque no Topo Direito (Com Nível de 1 a 8) */}
                            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 text-xs">
                                
                                {/* Badge de Status Operacional */}
                                <div className={`px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 shadow-2xs ${currentStatusStyle.badge}`}>
                                    <span className={`w-2 h-2 rounded-full ${currentStatusStyle.dot}`}></span>
                                    <span>Status: {userOperationalStatus}</span>
                                </div>

                                {/* Badge de Nível (1 a 8) */}
                                <div 
                                    className="px-3.5 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border-amber-500/40 text-amber-900 shadow-2xs"
                                    title={`Nível do Colaborador: ${userLevel} de 8 (${formData.badges.length} emblema(s) ativo(s))`}
                                >
                                    <Sparkles className="w-4 h-4 text-amber-600 animate-spin-slow" />
                                    <span className="font-black text-amber-800">Nível {userLevel}</span>
                                    <span className="text-[10px] font-mono text-amber-700 bg-amber-200/60 px-1.5 py-0.2 rounded-md">
                                        {formData.badges.length}/8
                                    </span>
                                </div>

                                {/* Role RBAC */}
                                <div className={`px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 shadow-2xs ${roleInfo.badgeColor}`}>
                                    <ShieldCheck className="w-4 h-4" />
                                    <span>{roleInfo.label || 'Colaborador'}</span>
                                </div>

                                {/* Turno & Horário Atual */}
                                <div className={`px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 shadow-2xs ${currentShift.color}`}>
                                    <Clock className="w-4 h-4" />
                                    <span>{currentShift.label}</span>
                                    <span className="text-[10px] opacity-80 font-mono">({currentShift.hours})</span>
                                </div>

                                {/* Nível de Redes Atual */}
                                <div className="px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 bg-zinc-900 text-white border-zinc-800 shadow-2xs">
                                    <Network className="w-4 h-4 text-red-400" />
                                    <span>Redes: <strong className="text-red-400">{formData.networkKnowledge}</strong></span>
                                </div>
                            </div>
                        </div>

                        {/* Nome, Email Principal e Legenda/Bio */}
                        <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                                        <span>{formData.name || 'Seu Nome'}</span>
                                        {(!isViewingOther || isGestor) && (
                                            <button
                                                type="button"
                                                onClick={handleOpenPhotoModal}
                                                className="text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-md border border-red-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                            >
                                                <Camera className="w-3 h-3" /> Trocar foto
                                            </button>
                                        )}
                                    </h1>
                                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5 font-medium">
                                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                                        <span>{user?.email || 'email@empresa.com'}</span>
                                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                                            Conta Principal (Auth)
                                        </span>
                                    </p>
                                </div>

                                <div className="text-xs text-gray-500 sm:text-right font-mono">
                                    <span>ID: {user?.firestoreId || user?.uid || 'USR-001'}</span>
                                </div>
                            </div>

                            {/* Campo de Bio / Legenda do Usuário */}
                            <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-200 focus-within:border-red-500 focus-within:bg-white transition-all">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between mb-1">
                                    <span className="flex items-center gap-1.5">
                                        <Edit3 className="w-3.5 h-3.5 text-red-600" />
                                        Legenda / Bio Profissional
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-mono">
                                        {formData.bio.length}/180 caracteres
                                    </span>
                                </label>
                                <textarea
                                    value={formData.bio}
                                    maxLength={180}
                                    onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                                    placeholder="Ex: Especialista em redes FTTH, diagnóstico ágil e suporte consultivo. Foco em soluções de primeiro contato com alta satisfação."
                                    rows={2}
                                    className="w-full text-xs text-gray-800 bg-transparent border-0 outline-none resize-none leading-relaxed placeholder:text-gray-400"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. GRID PRINCIPAL: CONHECIMENTOS DE REDE, EMBLEMAS, CONTATOS E MÉTRICAS REAIS */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* COLUNA ESQUERDA (2 SPANS): HABILIDADES, REDES E EMBLEMAS */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* CARD 2.1: CONHECIMENTOS SOBRE REDES & HABILIDADES */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 sm:p-6 space-y-5">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                        <Network className="w-4 h-4 text-red-600" />
                                        Conhecimento Técnico em Redes
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Defina seu nível de proficiência e destaque suas especialidades de conectividade.
                                    </p>
                                </div>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                    formData.networkKnowledge === 'Avançado' ? 'bg-red-100 text-red-700 border-red-300' :
                                    formData.networkKnowledge === 'Médio' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                    'bg-emerald-100 text-emerald-800 border-emerald-300'
                                }`}>
                                    Nível: {formData.networkKnowledge}
                                </span>
                            </div>

                            {/* Seletor de Nível (Básico, Médio, Avançado) */}
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-2">
                                    Nível Geral de Conhecimento:
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {NETWORK_LEVELS.map(lvl => {
                                        const isSelected = formData.networkKnowledge === lvl.id;
                                        return (
                                            <button
                                                key={lvl.id}
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, networkKnowledge: lvl.id }))}
                                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                                    isSelected 
                                                        ? `${lvl.color} border-2 shadow-xs ring-1 ring-red-200 font-bold`
                                                        : 'border-gray-200 bg-gray-50/50 hover:bg-gray-100/70 text-gray-600'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-black">{lvl.label}</span>
                                                    {isSelected && <CheckCircle2 className="w-4 h-4 text-red-600" />}
                                                </div>
                                                <p className="text-[11px] text-gray-500 leading-tight">
                                                    {lvl.desc}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Tags Personalizadas de Conhecimento Técnico */}
                            <div className="pt-2">
                                <label className="text-xs font-bold text-gray-700 flex items-center justify-between mb-2">
                                    <span>Tags de Competências & Ferramentas:</span>
                                    <span className="text-[10px] text-gray-400 font-mono">
                                        {formData.networkSkills.length}/15 tags
                                    </span>
                                </label>

                                {/* Lista de tags ativas */}
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {formData.networkSkills.map(tag => (
                                        <span
                                            key={tag}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-zinc-900 text-white border border-zinc-800 shadow-2xs group"
                                        >
                                            <span>{tag}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveSkillTag(tag)}
                                                className="text-zinc-400 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                                                title={`Remover tag ${tag}`}
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                    {formData.networkSkills.length === 0 && (
                                        <span className="text-xs text-gray-400 italic">
                                            Nenhuma tag adicionada. Adicione competências abaixo.
                                        </span>
                                    )}
                                </div>

                                {/* Campo para adicionar nova tag */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newSkillInput}
                                        onChange={(e) => setNewSkillInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkillTag())}
                                        placeholder="Digite uma competência (ex: Mikrotik, Wi-Fi 6, OSPF)..."
                                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-red-600 focus:border-red-600"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleAddSkillTag()}
                                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Adicionar
                                    </button>
                                </div>

                                {/* Sugestões Rápidas de Tags */}
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                    <span className="text-[11px] font-semibold text-gray-400 block mb-1.5">
                                        Sugestões Rápidas (clique para adicionar):
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {DEFAULT_NETWORK_TAG_SUGGESTIONS
                                            .filter(s => !formData.networkSkills.includes(s))
                                            .slice(0, 8)
                                            .map(suggestion => (
                                                <button
                                                    key={suggestion}
                                                    type="button"
                                                    onClick={() => handleAddSkillTag(suggestion)}
                                                    className="px-2 py-1 bg-gray-100 hover:bg-red-50 hover:text-red-700 hover:border-red-200 border border-gray-200 rounded-md text-[11px] font-medium text-gray-600 transition-colors cursor-pointer flex items-center gap-1"
                                                >
                                                    <Plus className="w-2.5 h-2.5" />
                                                    {suggestion}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CARD 2.2: EMBLEMAS & INSÍGNIAS DE FEITOS (REQUISITO: APENAS GESTOR ALTERA) */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 sm:p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                        <Trophy className="w-4 h-4 text-amber-500" />
                                        Insígnias & Emblemas de Feitos
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Reconhecimento por agilidade (Top TMA), alta produtividade (Top Finalizações) e qualidade exemplar.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    {isGestor ? (
                                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-full flex items-center gap-1">
                                            <Edit3 className="w-3 h-3 text-emerald-600" /> Gestor: Edição Liberada
                                        </span>
                                    ) : (
                                        <span className="text-[11px] font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                                            <Lock className="w-3 h-3 text-zinc-500" /> Concedido pela Gestão
                                        </span>
                                    )}
                                    <span className="text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full">
                                        {formData.badges.length} de {BADGES_CATALOG.length} Ativos
                                    </span>
                                </div>
                            </div>

                            {/* Aviso de Permissão para Não-Gestores */}
                            {!isGestor && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-900">
                                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>
                                        Os emblemas são homologados e alterados exclusivamente pela <strong>Gestão</strong> com base nas métricas e conquistas da operação.
                                    </span>
                                </div>
                            )}

                            {/* Grade de Emblemas */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                {BADGES_CATALOG.map(badge => {
                                    const IconComponent = BADGE_ICONS[badge.iconName] || Trophy;
                                    const isUnlocked = formData.badges.includes(badge.id);

                                    return (
                                        <div
                                            key={badge.id}
                                            onClick={isGestor ? () => handleToggleBadge(badge.id) : undefined}
                                            className={`p-3.5 rounded-xl border transition-all relative overflow-hidden flex items-start gap-3 ${
                                                isGestor ? 'cursor-pointer hover:border-amber-400 active:scale-[0.99]' : 'cursor-default select-none'
                                            } ${
                                                isUnlocked
                                                    ? 'border-amber-300/80 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/20 shadow-xs'
                                                    : 'border-gray-200 bg-gray-50/50 opacity-60'
                                            }`}
                                            title={isGestor ? 'Clique para conceder ou revogar este emblema (Exclusivo Gestor)' : 'Emblema concedido exclusivamente pela Gestão'}
                                        >
                                            {/* Ícone do Emblema */}
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-xs ${
                                                isUnlocked ? badge.bgColor : 'bg-gray-200 border-gray-300 text-gray-400'
                                            }`}>
                                                <IconComponent className={`w-5 h-5 ${isUnlocked ? badge.textColor : 'text-gray-400'}`} />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-1">
                                                    <h3 className={`text-xs font-bold truncate ${isUnlocked ? 'text-gray-900' : 'text-gray-500'}`}>
                                                        {badge.title}
                                                    </h3>
                                                    {isUnlocked ? (
                                                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5">
                                                            <Check className="w-2.5 h-2.5 text-amber-700" /> Ativo
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-400 font-mono shrink-0">
                                                            Pendente
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">
                                                    {badge.description}
                                                </p>
                                                <div className="mt-1 text-[10px] text-gray-400 font-medium">
                                                    Requisito: {badge.requirement}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* CARD 2.3: INTERESSES & DESENVOLVIMENTO */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 sm:p-6 space-y-4">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                        <Heart className="w-4 h-4 text-red-500" />
                                        Interesses Profissionais & Objetivos
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Áreas de tecnologia, infraestrutura e suporte que você tem interesse em aprofundar.
                                    </p>
                                </div>
                            </div>

                            {/* Tags de Interesses Ativas */}
                            <div className="flex flex-wrap gap-2">
                                {formData.interests.map(item => (
                                    <span
                                        key={item}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-800 border border-red-200"
                                    >
                                        <span>{item}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveInterest(item)}
                                            className="text-red-400 hover:text-red-700 p-0.5 rounded cursor-pointer"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>

                            {/* Adicionar Interesse */}
                            <div className="flex gap-2 pt-1">
                                <input
                                    type="text"
                                    value={newInterestInput}
                                    onChange={(e) => setNewInterestInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddInterest())}
                                    placeholder="Adicionar interesse (ex: Segurança da Informação, Liderança)..."
                                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-red-600 focus:border-red-600"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddInterest()}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Adicionar
                                </button>
                            </div>

                            {/* Sugestões de Interesses */}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {DEFAULT_INTEREST_SUGGESTIONS
                                    .filter(s => !formData.interests.includes(s))
                                    .slice(0, 5)
                                    .map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => handleAddInterest(s)}
                                            className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-[11px] font-medium transition-colors cursor-pointer"
                                        >
                                            + {s}
                                        </button>
                                    ))}
                            </div>
                        </div>

                    </div>

                    {/* COLUNA DIREITA (1 SPAN): HORÁRIO DE OPERAÇÃO, CONTATOS E MÉTRICAS REAIS */}
                    <div className="space-y-6">

                        {/* CARD 2.4: HORÁRIO DE OPERAÇÃO ATUAL & ESCALA OFICIAL */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4">
                            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2.5">
                                <Clock className="w-4 h-4 text-red-600" />
                                Horário de Expediente Oficial
                            </h2>

                            {/* Seletor dos 4 Turnos Oficiais */}
                            <div>
                                <label className="text-[11px] font-bold text-gray-600 block mb-1.5">
                                    Turno de Atuação:
                                </label>
                                <div className="space-y-2">
                                    {SYSTEM_SHIFTS.map(shiftItem => {
                                        const isSelected = formData.shift === shiftItem.id;
                                        return (
                                            <button
                                                key={shiftItem.id}
                                                type="button"
                                                onClick={() => handleChangeShift(shiftItem.id)}
                                                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-red-50/70 border-red-500 ring-1 ring-red-300 text-red-950 font-bold'
                                                        : 'bg-gray-50/50 hover:bg-gray-100/70 border-gray-200 text-gray-700'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Clock className={`w-3.5 h-3.5 ${isSelected ? 'text-red-600' : 'text-gray-400'}`} />
                                                    <span className="text-xs">{shiftItem.label}</span>
                                                </div>
                                                <span className="text-xs font-mono font-bold text-gray-600">
                                                    {shiftItem.hours}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Caixa Informativa sobre a Operação Terceirizada (20:00 até 08:00) */}
                            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white space-y-1.5 shadow-2xs">
                                <div className="flex items-center gap-2">
                                    <Headphones className="w-4 h-4 text-amber-400" />
                                    <span className="text-xs font-bold text-white tracking-wide">
                                        {THIRD_PARTY_SCHEDULE_INFO.title}
                                    </span>
                                </div>
                                <div className="text-[11px] font-mono font-bold text-amber-300">
                                    Horário: {THIRD_PARTY_SCHEDULE_INFO.hours}
                                </div>
                                <p className="text-[11px] text-zinc-400 leading-relaxed">
                                    {THIRD_PARTY_SCHEDULE_INFO.description}
                                </p>
                            </div>
                        </div>

                        {/* CARD 2.5: MÉTRICAS OPERACIONAIS 100% REAIS (SEM DADOS MOCKADOS) */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4">
                            <div className="border-b border-gray-100 pb-2.5 flex items-center justify-between">
                                <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-red-600" />
                                    Métricas Operacionais Reais
                                </h2>
                                <span className="text-[10px] text-gray-400 font-mono font-semibold">
                                    {realMetrics.totalAvaliacoes} avaliações
                                </span>
                            </div>

                            {realMetrics.loading ? (
                                <div className="py-8 flex flex-col items-center justify-center text-center">
                                    <Loader2 className="w-6 h-6 text-red-600 animate-spin mb-2" />
                                    <span className="text-xs text-gray-500">Calculando métricas reais...</span>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* 1. Média de TMA Telefonia */}
                                        <div className="p-3 bg-red-50/50 rounded-xl border border-red-100">
                                            <span className="text-[10px] font-bold text-red-700 uppercase block tracking-wider">
                                                Média TMA Telefonia
                                            </span>
                                            <span className="text-base sm:text-lg font-black font-mono text-gray-900 mt-0.5 block">
                                                {realMetrics.mediaTmaTelefonia}
                                            </span>
                                            <span className="text-[10px] text-gray-400 block mt-0.5">
                                                Chamadas de voz
                                            </span>
                                        </div>

                                        {/* 2. Média de TMA Chat */}
                                        <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                                            <span className="text-[10px] font-bold text-blue-700 uppercase block tracking-wider">
                                                Média TMA Chat
                                            </span>
                                            <span className="text-base sm:text-lg font-black font-mono text-gray-900 mt-0.5 block">
                                                {realMetrics.mediaTmaChat}
                                            </span>
                                            <span className="text-[10px] text-gray-400 block mt-0.5">
                                                Atendimentos Huggy
                                            </span>
                                        </div>

                                        {/* 3. Média de Pontos */}
                                        <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                            <span className="text-[10px] font-bold text-emerald-700 uppercase block tracking-wider">
                                                Média de Pontos
                                            </span>
                                            <span className="text-base sm:text-lg font-black text-gray-900 mt-0.5 block">
                                                {realMetrics.mediaPontos}
                                            </span>
                                            <span className="text-[10px] text-gray-400 block mt-0.5">
                                                Produtividade semanal
                                            </span>
                                        </div>

                                        {/* 4. % nas Auditorias QA */}
                                        <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                                            <span className="text-[10px] font-bold text-purple-700 uppercase block tracking-wider">
                                                % nas Auditorias
                                            </span>
                                            <span className="text-base sm:text-lg font-black text-gray-900 mt-0.5 block">
                                                {realMetrics.percentualAuditorias}
                                            </span>
                                            <span className="text-[10px] text-gray-400 block mt-0.5">
                                                {realMetrics.totalAuditorias} checklist(s) QA
                                            </span>
                                        </div>
                                    </div>

                                    {realMetrics.totalAvaliacoes === 0 && (
                                        <p className="text-[11px] text-gray-400 text-center italic pt-1">
                                            Nenhum lançamento semanal registrado ainda para este analista.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* CARD 2.6: CANAIS DE CONTATO & E-MAILS ADICIONAIS */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4">
                            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2.5">
                                <Phone className="w-4 h-4 text-red-600" />
                                Contatos & Comunicação
                            </h2>

                            {/* Número de Telefone / WhatsApp */}
                            <div>
                                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                                    Telefone / WhatsApp de Contato:
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                                        <input
                                            type="text"
                                            value={formData.phone}
                                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                            placeholder="(11) 98765-4321"
                                            className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-red-600"
                                        />
                                    </div>
                                    {formData.phone && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleCopyPhone}
                                                className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors cursor-pointer"
                                                title="Copiar Telefone"
                                            >
                                                {copiedPhone ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                            <a
                                                href={`https://wa.me/55${formData.phone.replace(/\D/g, '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors flex items-center justify-center"
                                                title="Abrir WhatsApp"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Ramal ou Canal Interno */}
                            <div>
                                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                                    Ramal VoIP / Teams / Slack:
                                </label>
                                <input
                                    type="text"
                                    value={formData.slackOrTeams}
                                    onChange={(e) => setFormData(prev => ({ ...prev, slackOrTeams: e.target.value }))}
                                    placeholder="Ex: Ramal 2045 ou @pedro.suporte"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-red-600"
                                />
                            </div>

                            {/* E-mails Adicionais */}
                            <div className="pt-2 border-t border-gray-100">
                                <label className="text-[11px] font-bold text-gray-700 block mb-1.5">
                                    E-mails Adicionais:
                                </label>

                                <div className="space-y-1.5 mb-2">
                                    {formData.additionalEmails.map(email => (
                                        <div
                                            key={email}
                                            className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200 text-xs"
                                        >
                                            <span className="text-gray-700 truncate" title={email}>{email}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveEmail(email)}
                                                className="text-gray-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                                                title="Remover e-mail"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {formData.additionalEmails.length === 0 && (
                                        <p className="text-[11px] text-gray-400 italic">
                                            Nenhum e-mail adicional registrado.
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="email"
                                        value={newEmailInput}
                                        onChange={(e) => setNewEmailInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEmail())}
                                        placeholder="Adicionar e-mail secundário..."
                                        className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-red-600"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddEmail}
                                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                                    >
                                        + Add
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* BOTÃO FIXO/FINAL DE SALVAR */}
                <div className="pt-4 flex items-center justify-end">
                    {isViewingOther && !isGestor ? (
                        <div className="p-3 bg-gray-100 border border-gray-200 text-gray-500 rounded-xl text-xs font-semibold flex items-center gap-2">
                            <Eye className="w-4 h-4 text-gray-400" />
                            <span>Modo de visualização pública ativo. Para editar, acesse seu próprio perfil.</span>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-950/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Gravando no Firebase...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    <span>Salvar Todas as Informações</span>
                                </>
                            )}
                        </button>
                    )}
                </div>

            </div>

            {/* ========================================================================= */}
            {/* MODAL DE FOTO DE PERFIL (PHOTOURL DO FIREBASE)                           */}
            {/* ========================================================================= */}
            {isPhotoModalOpen && (
                <div 
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setIsPhotoModalOpen(false)}
                >
                    <div 
                        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header Modal */}
                        <div className="p-5 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
                                    <Camera className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Alterar Foto de Perfil</h3>
                                    <p className="text-[11px] text-zinc-400">Recurso Oficial PhotoUrl do Firebase</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsPhotoModalOpen(false)}
                                className="p-1 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Conteúdo do Modal */}
                        <div className="p-6 space-y-6">

                            {/* Preview Circular / Quadrado Arredondado */}
                            <div className="flex flex-col items-center justify-center">
                                <div className="w-28 h-28 rounded-3xl border-4 border-red-500/20 shadow-md bg-zinc-100 overflow-hidden flex items-center justify-center mb-2 relative">
                                    {photoPreview ? (
                                        <img
                                            src={photoPreview}
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                            onError={() => {
                                                setPhotoPreview('');
                                                showToast('URL inválida ou imagem inacessível.', 'error');
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-400 font-bold text-2xl bg-zinc-100">
                                            {formData.name?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                </div>
                                <span className="text-xs text-gray-500 font-medium">Pré-visualização do Avatar</span>
                            </div>

                            {/* Opção 1: Inserir URL Direta */}
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1.5">
                                    Opção 1: Inserir Link / URL da Imagem (PhotoUrl)
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <LinkIcon className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                                        <input
                                            type="url"
                                            value={photoUrlInput}
                                            onChange={(e) => {
                                                setPhotoUrlInput(e.target.value);
                                                setPhotoPreview(e.target.value);
                                            }}
                                            placeholder="https://exemplo.com/minha-foto.jpg"
                                            className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-red-600 text-gray-800"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPhotoPreview(photoUrlInput)}
                                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                                    >
                                        Testar
                                    </button>
                                </div>
                            </div>

                            {/* Opção 2: Upload de Arquivo Local */}
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1.5">
                                    Opção 2: Fazer Upload do Computador / Dispositivo
                                </label>
                                <label className="w-full border-2 border-dashed border-gray-300 hover:border-red-400 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-gray-50/50 hover:bg-red-50/20 transition-all">
                                    <Upload className="w-6 h-6 text-gray-400 mb-1" />
                                    <span className="text-xs font-bold text-gray-700">Clique para selecionar imagem</span>
                                    <span className="text-[10px] text-gray-400 mt-0.5">PNG, JPG, WEBP (máx. 3MB)</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                </label>
                            </div>

                            {/* Opção 3: Avatares Profissionais em 1 Clique */}
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-2">
                                    Opção 3: Escolher Avatar Profissional (1 Clique)
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {PRESET_AVATARS.map(avatar => {
                                        const isSelected = photoPreview === avatar.url;
                                        return (
                                            <button
                                                key={avatar.id}
                                                type="button"
                                                onClick={() => handleSelectPresetAvatar(avatar.url)}
                                                className={`p-1 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden group ${
                                                    isSelected ? 'border-red-600 ring-2 ring-red-200' : 'border-gray-200 hover:border-gray-400'
                                                }`}
                                                title={avatar.name}
                                            >
                                                <img
                                                    src={avatar.url}
                                                    alt={avatar.name}
                                                    className="w-full h-12 object-cover rounded-lg group-hover:scale-105 transition-transform"
                                                />
                                                {isSelected && (
                                                    <div className="absolute inset-0 bg-red-600/30 flex items-center justify-center">
                                                        <Check className="w-4 h-4 text-white drop-shadow" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>

                        {/* Footer Modal */}
                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={handleRemovePhoto}
                                className="px-3 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                            >
                                Remover Foto
                            </button>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsPhotoModalOpen(false)}
                                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmPhoto}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                                >
                                    Confirmar Foto
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
};

export default MyProfile;
