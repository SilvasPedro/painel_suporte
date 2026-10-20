import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Camera, Upload, Link as LinkIcon, Check, X, ShieldCheck,
    Trophy, Zap, Star, Rocket, CalendarCheck, Award, Mail,
    Phone, Clock, ExternalLink, Copy, CheckCircle2,
    Sparkles, Plus, Trash2, Edit3, Loader2, Save,
    Headphones, Users, Search,
    ArrowLeft, Eye, ChevronRight, TrendingUp, Palette, Image as ImageIcon
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
    BANNER_COLOR_PRESETS,
    SYSTEM_SHIFTS,
    SYSTEM_SHIFTS_MAP,
    THIRD_PARTY_SCHEDULE_INFO,
    normalizeShiftName,
    calculateUserLevel,
    evaluateCollaboratorBadges
} from '../services/userProfile';

// Mapeamento de ícones dos emblemas oficiais da v3.9
const BADGE_ICONS = {
    TrendingUp,
    ShieldCheck,
    Clock,
    Zap,
    Rocket,
    Award,
    Trophy,
    Sparkles
};

const getInitialFormData = (u) => {
    const rawShift = u?.shift || 'Manhã I';
    const normShift = normalizeShiftName(rawShift);
    const shiftConfig = SYSTEM_SHIFTS_MAP[normShift] || SYSTEM_SHIFTS[0];

    return {
        name: u?.name || u?.displayName || u?.email?.split('@')[0] || '',
        photoURL: u?.photoURL || u?.photoUrl || '',
        bio: u?.bio || '',
        bannerColor: u?.bannerColor || 'carmim',
        bannerUrl: u?.bannerUrl || '',
        interests: Array.isArray(u?.interests) && u.interests.length > 0
            ? u.interests
            : ['Atendimento Humanizado', 'Resolução Ágil', 'Automação'],
        phone: u?.phone || '',
        ramal: u?.ramal || u?.slackOrTeams || '',
        slackOrTeams: u?.ramal || u?.slackOrTeams || '',
        additionalEmails: Array.isArray(u?.additionalEmails) ? u.additionalEmails : [],
        shift: normShift,
        workHours: u?.workHours || shiftConfig.hours,
        badges: Array.isArray(u?.badges) ? u.badges : []
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

    // Coleções necessárias para cálculo automático dos 3 emblemas oficiais
    const [weeklyEvals, setWeeklyEvals] = useState([]);
    const [qaAuditsList, setQaAuditsList] = useState([]);
    const [thirdPartyAuditsList, setThirdPartyAuditsList] = useState([]);

    // Carrega a lista completa de colaboradores e métricas da operação
    useEffect(() => {
        const unsubColabs = subscribeSharedCollection('collaborators', (items) => {
            const list = [...items];
            list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setCollaboratorsList(list);
        });

        const unsubEvals = subscribeSharedCollection('weekly_evaluations', (items) => {
            setWeeklyEvals(items || []);
        });

        const unsubAudits = subscribeSharedCollection('qa_audits', (items) => {
            setQaAuditsList(items || []);
        });

        const unsubThirdParty = subscribeSharedCollection('third_party_audits', (items) => {
            setThirdPartyAuditsList(items || []);
        });

        return () => {
            unsubColabs();
            unsubEvals();
            unsubAudits();
            unsubThirdParty();
        };
    }, []);

    // REGRA CRÍTICA: Filtra APENAS colaboradores ativos (ignora inativos e desligados)
    const activeCollaboratorsList = useMemo(() => {
        return collaboratorsList.filter(c => {
            if (!c) return false;
            if (c.active === false) return false;
            const st = (c.status || '').toLowerCase().trim();
            if (st === 'inativo' || st === 'desligado') return false;
            return true;
        });
    }, [collaboratorsList]);

    // Determina o colaborador que está sendo visualizado (Meu perfil ou de outro colega ativo)
    const activeSelectedColab = useMemo(() => {
        if (!selectedColabId) return null;
        return activeCollaboratorsList.find(c => (c.id === selectedColabId || c.firestoreId === selectedColabId || c.uid === selectedColabId)) || null;
    }, [selectedColabId, activeCollaboratorsList]);

    const isViewingOther = Boolean(activeSelectedColab && (activeSelectedColab.id !== (myAuthUser?.firestoreId || myAuthUser?.uid || currentUserId)));
    const user = activeSelectedColab || myAuthUser;

    const isGestor = isMasterAdmin || normalizedRole === 'gestor';

    const [saving, setSaving] = useState(false);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
    const [copiedPhone, setCopiedPhone] = useState(false);

    // Estado do formulário de Perfil
    const [formData, setFormData] = useState(() => getInitialFormData(user));

    // Input temporário para novos e-mails
    const [newEmailInput, setNewEmailInput] = useState('');

    // Input temporário no modal de foto
    const [photoUrlInput, setPhotoUrlInput] = useState(() => user?.photoURL || user?.photoUrl || '');
    const [photoPreview, setPhotoPreview] = useState(() => user?.photoURL || user?.photoUrl || '');

    // Rascunho temporário no modal de customização da capa
    const [bannerColorDraft, setBannerColorDraft] = useState(() => user?.bannerColor || 'carmim');
    const [bannerUrlDraft, setBannerUrlDraft] = useState(() => user?.bannerUrl || '');

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
            setBannerColorDraft(updated.bannerColor || 'carmim');
            setBannerUrlDraft(updated.bannerUrl || '');
        }
    }, [activeSelectedColab, myAuthUser]);

    // Salva configurações padrão de turnos se necessário
    useEffect(() => {
        saveSystemShiftsInfo();
    }, []);

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

    // Preset selecionado de cor do banner
    const selectedBannerPreset = useMemo(() => {
        return BANNER_COLOR_PRESETS.find(p => p.id === formData.bannerColor) || BANNER_COLOR_PRESETS[0];
    }, [formData.bannerColor]);

    // Avaliação 100% automatizada dos 6 emblemas oficiais com base nas métricas reais da operação
    const badgeEvaluation = useMemo(() => {
        return evaluateCollaboratorBadges({
            collaborator: {
                ...user,
                shift: formData.shift || user?.shift
            },
            allCollaborators: collaboratorsList,
            weeklyEvaluations: weeklyEvals,
            qaAudits: qaAuditsList,
            thirdPartyAudits: thirdPartyAuditsList,
            manualBadges: []
        });
    }, [user, formData.shift, collaboratorsList, weeklyEvals, qaAuditsList, thirdPartyAuditsList]);

    // Insígnias ativas no momento (100% automatizadas pelas avaliações e auditorias)
    const activeBadgeList = useMemo(() => {
        return badgeEvaluation.activeBadges || [];
    }, [badgeEvaluation.activeBadges]);

    // Nível calculado com base nos emblemas ativos reais (de 1 a 6)
    const userLevel = useMemo(() => {
        return calculateUserLevel(activeBadgeList);
    }, [activeBadgeList]);

    // Manipulação do Modal de Banner / Capa
    const handleOpenBannerModal = () => {
        if (isViewingOther && !isGestor) {
            showToast('Você está em modo de visualização. Apenas o próprio colaborador ou a Gestão podem alterar a capa.', 'info');
            return;
        }
        setBannerColorDraft(formData.bannerColor || 'carmim');
        setBannerUrlDraft(formData.bannerUrl || '');
        setIsBannerModalOpen(true);
    };

    const handleConfirmBanner = () => {
        const cleanUrl = bannerUrlDraft.trim();
        if (cleanUrl && !cleanUrl.startsWith('https://')) {
            showToast('A URL da imagem de capa deve começar com https:// para ser válida.', 'warning');
            return;
        }
        setFormData(prev => ({
            ...prev,
            bannerColor: bannerColorDraft,
            bannerUrl: cleanUrl
        }));
        setIsBannerModalOpen(false);
        showToast('Capa do perfil selecionada! Clique em "Salvar Alterações" para confirmar.', 'info');
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
            await saveUserProfileData(user, formData);
            showToast('Perfil atualizado com sucesso no Firebase!', 'success');
        } catch (error) {
            console.error('Erro ao salvar perfil:', error);
            showToast('Erro ao salvar perfil: ' + error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Lista para exibição no quadrado estilo amigos do Facebook (até 12 colegas ativos)
    const facebookFriendsPreview = useMemo(() => {
        const myId = myAuthUser?.firestoreId || myAuthUser?.uid || currentUserId;
        const others = activeCollaboratorsList.filter(c => {
            const cId = c.id || c.firestoreId || c.uid;
            return cId !== myId && c.email?.toLowerCase() !== myAuthUser?.email?.toLowerCase();
        });
        return others.slice(0, 12);
    }, [activeCollaboratorsList, myAuthUser, currentUserId]);

    // Lista filtrada para o modal de lista completa de colegas
    const filteredColabsList = useMemo(() => {
        if (!colabSearchQuery.trim()) return activeCollaboratorsList;
        const q = colabSearchQuery.toLowerCase().trim();
        return activeCollaboratorsList.filter(c => {
            const name = (c.name || c.displayName || '').toLowerCase();
            const role = (c.role || '').toLowerCase();
            const shift = (c.shift || '').toLowerCase();
            const email = (c.email || '').toLowerCase();
            return name.includes(q) || role.includes(q) || shift.includes(q) || email.includes(q);
        });
    }, [activeCollaboratorsList, colabSearchQuery]);

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
            <div className="w-full space-y-6">

                {/* AVISO DE VISUALIZAÇÃO DE OUTRO COLABORADOR */}
                {isViewingOther && (
                    <div className="bg-gradient-to-r from-red-600 via-rose-700 to-red-800 border border-red-500/40 p-4 rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-white animate-in fade-in duration-150">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0">
                                <Eye className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <span>Visualizando Perfil Público:</span>
                                    <span className="text-amber-300 font-extrabold">{user?.name || user?.displayName}</span>
                                </h3>
                                <p className="text-[11px] text-red-100">
                                    Você está consultando os contatos, turnos e habilidades deste colega de equipe.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedColabId(null)}
                            className="px-3.5 py-1.5 bg-white hover:bg-gray-100 text-gray-900 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Voltar ao Meu Perfil</span>
                        </button>
                    </div>
                )}

                {/* 1. HERO BANNER DO PERFIL (HEADER EXECUTIVO) */}
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/90 shadow-xs overflow-hidden relative">
                    {/* Fundo Personalizável (8 Cores ou Imagem HTTPS) com Textura Elegante */}
                    <div 
                        className={`h-44 sm:h-52 bg-gradient-to-r ${selectedBannerPreset.gradient} p-6 relative flex items-start justify-between bg-cover bg-center transition-all duration-300`}
                        style={formData.bannerUrl && formData.bannerUrl.startsWith('https://') ? { backgroundImage: `url(${formData.bannerUrl})` } : {}}
                    >
                        {/* Overlay para contraste quando houver imagem */}
                        {formData.bannerUrl && formData.bannerUrl.startsWith('https://') && (
                            <div className="absolute inset-0 bg-black/30 backdrop-blur-[0.5px]"></div>
                        )}
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
                        
                        {/* Botão de Personalização da Capa (Apenas Dono do Perfil ou Gestor) */}
                        <div className="relative z-10 flex items-center gap-2">
                            {(!isViewingOther || isGestor) && (
                                <button
                                    type="button"
                                    onClick={handleOpenBannerModal}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-black/30 hover:bg-black/50 text-white backdrop-blur-md border border-white/25 shadow-xs cursor-pointer transition-all active:scale-95"
                                    title="Personalizar cor ou imagem de capa do seu perfil"
                                >
                                    <Palette className="w-3.5 h-3.5 text-amber-300" />
                                    <span>Personalizar Capa</span>
                                </button>
                            )}
                        </div>

                        {/* Botão de Salvar Rápido no Topo */}
                        <div className="relative z-10">
                            {isViewingOther && !isGestor ? (
                                <div className="px-3.5 py-1.5 bg-black/40 backdrop-blur-md border border-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm">
                                    <Eye className="w-3.5 h-3.5 text-red-200" />
                                    <span>Modo Consulta</span>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleSaveProfile}
                                    disabled={saving}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-red-900/30 flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
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
                                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl sm:rounded-3xl border-4 border-white shadow-xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0 relative transition-transform group-hover:scale-[1.02]">
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
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-red-600 via-rose-600 to-red-700 text-white select-none">
                                            <span className="text-3xl sm:text-4xl font-black">
                                                {formData.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                                            </span>
                                            <span className="text-[10px] font-mono text-red-100 mt-0.5">Sem Foto</span>
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
                                    className="absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white bg-white shadow-md flex items-center justify-center"
                                    title={`Status: ${userOperationalStatus}`}
                                >
                                    <span className={`w-2.5 h-2.5 rounded-full ${currentStatusStyle.dot}`}></span>
                                </div>
                            </div>

                            {/* Badges de Destaque no Topo Direito (Com Nível de 1 a 6) */}
                            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 text-xs">
                                
                                {/* Badge de Status Operacional */}
                                <div className={`px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 shadow-2xs ${currentStatusStyle.badge}`}>
                                    <span className={`w-2 h-2 rounded-full ${currentStatusStyle.dot}`}></span>
                                    <span>Status: {userOperationalStatus}</span>
                                </div>

                                {/* Badge de Nível (1 a 6) */}
                                <div 
                                    className="px-3.5 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 bg-amber-500/10 border-amber-500/40 text-amber-900 shadow-2xs"
                                    title={`Nível do Colaborador: ${userLevel} de 6 (${activeBadgeList.length} de 6 emblemas conquistados)`}
                                >
                                    <Sparkles className="w-4 h-4 text-amber-600 animate-spin-slow" />
                                    <span className="font-black text-amber-800">Nível {userLevel}</span>
                                    <span className="text-[10px] font-mono text-amber-700 bg-amber-200/60 px-1.5 py-0.2 rounded-md">
                                        {activeBadgeList.length}/6
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

                {/* 2. GRID PRINCIPAL: 2 COLUNAS HARMONIOSAS (HABILIDADES & EMBLEMAS | CONTATOS & EXPEDIENTE) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* COLUNA ESQUERDA: EMBLEMAS DE FEITOS (100% AUTOMATIZADOS) */}
                    <div className="space-y-6">

                        {/* CARD 2.1: EMBLEMAS & INSÍGNIAS DE FEITOS (SISTEMA 100% AUTOMATIZADO) */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 sm:p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                        <Trophy className="w-4 h-4 text-amber-500" />
                                        Insígnias & Emblemas de Feitos
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Conquistas calculadas e desbloqueadas em tempo real pelas métricas reais da operação.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                        {activeBadgeList.length} de {BADGES_CATALOG.length} Conquistados
                                    </span>
                                </div>
                            </div>

                            {/* Banner Informativo do Sistema Automatizado */}
                            <div className="p-3 bg-gradient-to-r from-amber-50 via-rose-50/40 to-blue-50/30 border border-amber-200/80 rounded-xl flex items-start gap-3 text-xs text-gray-800">
                                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                    <span className="font-bold text-gray-900 block">
                                        6 Emblemas Oficiais Calculados Automaticamente:
                                    </span>
                                    <p className="text-[11px] text-gray-600 leading-relaxed">
                                        As insígnias são desbloqueadas diretamente a partir das avaliações semanais e auditorias QA: 
                                        <strong> Desempenho</strong> (&ge; 95% do turno), 
                                        <strong> Auditorias QA</strong> (&ge; 85% conformidade), 
                                        <strong> Agilidade TMA</strong> (Voz &lt; 10m & Chat &lt; 25m), 
                                        <strong> Fila Limpa</strong> (&le; 2% de perdidas), 
                                        <strong> Produtividade</strong> (&ge; 40 finalizações/semana) e 
                                        <strong> Constância</strong> (100% semanas positivas).
                                    </p>
                                </div>
                            </div>

                            {/* Grade dos 6 Emblemas com Métricas Reais e Feedback de Desbloqueio */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                {BADGES_CATALOG.map(badge => {
                                    const IconComponent = BADGE_ICONS[badge.iconName] || Trophy;
                                    const isUnlocked = activeBadgeList.includes(badge.id);
                                    const detail = badgeEvaluation.badgeDetails?.[badge.id];

                                    return (
                                        <div
                                            key={badge.id}
                                            className={`p-3.5 rounded-xl border transition-all relative overflow-hidden flex flex-col justify-between select-none ${
                                                isUnlocked
                                                    ? 'border-amber-300 bg-amber-50/70 shadow-xs'
                                                    : 'border-gray-200 bg-gray-50/60 opacity-75'
                                            }`}
                                            title={`Critério: ${badge.requirement}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                {/* Ícone do Emblema */}
                                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-xs relative ${
                                                    isUnlocked ? badge.bgColor : 'bg-gray-100 border-gray-200 text-gray-400'
                                                }`}>
                                                    <IconComponent className={`w-5 h-5 ${isUnlocked ? badge.textColor : 'text-gray-400'}`} />
                                                    {isUnlocked && (
                                                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-white flex items-center justify-center shadow-xs">
                                                            <Check className="w-2 h-2 text-white stroke-[3]" />
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <h3 className={`text-xs font-bold truncate ${isUnlocked ? 'text-gray-900' : 'text-gray-600'}`}>
                                                            {badge.title}
                                                        </h3>
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                                            isUnlocked ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-gray-200 text-gray-600'
                                                        }`}>
                                                            {isUnlocked ? 'Conquistado' : 'Em Progresso'}
                                                        </span>
                                                    </div>

                                                    <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                                                        {badge.description}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Detalhe da Regra e Métrica Atual */}
                                            <div className="mt-3 pt-2 border-t border-gray-100/80 space-y-1">
                                                <div className="flex items-center justify-between text-[10px]">
                                                    <span className="text-gray-500 font-semibold truncate">
                                                        Meta: {badge.requirement}
                                                    </span>
                                                    {detail?.currentValue && (
                                                        <span className="font-mono font-bold text-gray-700">
                                                            {detail.currentValue}
                                                        </span>
                                                    )}
                                                </div>
                                                {detail?.feedback && (
                                                    <p className={`text-[10px] leading-tight ${isUnlocked ? 'text-emerald-700 font-medium' : 'text-gray-500'}`}>
                                                        {detail.feedback}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* COLUNA DIREITA: CONTATOS (ACIMA) E HORÁRIO DE EXPEDIENTE (ABAIXO) */}
                    <div className="space-y-6">

                        {/* CARD 2.2: CANAIS DE CONTATO & COMUNICAÇÃO */}
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
                                            className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-red-600 text-gray-900"
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

                            {/* Ramal de Atendimento */}
                            <div>
                                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                                    Número do Ramal:
                                </label>
                                <div className="relative">
                                    <Headphones className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                                    <input
                                        type="text"
                                        value={formData.ramal}
                                        onChange={(e) => setFormData(prev => ({ ...prev, ramal: e.target.value, slackOrTeams: e.target.value }))}
                                        placeholder="Ex: 2045 ou 20"
                                        className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-red-600 text-gray-900"
                                    />
                                </div>
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
                                            className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-700"
                                        >
                                            <span className="truncate" title={email}>{email}</span>
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
                                        className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-red-600 text-gray-900"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddEmail}
                                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                                    >
                                        + Add
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* CARD 2.4: BOX DE AMIGOS / COLEGAS DE EQUIPE (ESTILO COMPACTO & ERGONÔMICO) */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-4 sm:p-5 space-y-3.5">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                                <div>
                                    <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                        <Users className="w-4 h-4 text-red-600" />
                                        Colegas de Equipe
                                    </h2>
                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                        {activeCollaboratorsList.length} colegas ativos no time
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsTeamModalOpen(true)}
                                    className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer flex items-center gap-1"
                                >
                                    <span>Ver mais</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Grade Compacta de 5 a 6 Colunas (Fotos Menores e Proporcionais) */}
                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                                {facebookFriendsPreview.map((colab) => {
                                    const cId = colab.id || colab.firestoreId || colab.uid;
                                    const isSelected = activeSelectedColab && (activeSelectedColab.id === cId || activeSelectedColab.firestoreId === cId || activeSelectedColab.uid === cId);
                                    const st = colab.status || 'Ativo';
                                    const dotColor = st === 'Ativo' ? 'bg-emerald-500' : st === 'Férias' ? 'bg-amber-500' : 'bg-purple-500';
                                    const photo = colab.photoURL || colab.photoUrl;
                                    const displayName = colab.name || colab.displayName || colab.email?.split('@')[0] || 'Colega';
                                    const firstName = displayName.split(' ')[0];

                                    return (
                                        <button
                                            key={cId}
                                            type="button"
                                            onClick={() => setSelectedColabId(cId)}
                                            className="flex flex-col items-center sm:items-start text-center sm:text-left group cursor-pointer transition-all hover:scale-[1.03] focus:outline-none p-1 rounded-xl hover:bg-gray-50/80"
                                            title={`${displayName} • ${colab.shift || colab.role || st}`}
                                        >
                                            {/* Foto Quadrada Compacta */}
                                            <div className={`w-full aspect-square rounded-xl overflow-hidden bg-gray-100 border relative shadow-2xs group-hover:shadow-xs transition-all ${
                                                isSelected 
                                                    ? 'border-red-600 ring-2 ring-red-500/50' 
                                                    : 'border-gray-200 group-hover:border-red-300'
                                            }`}>
                                                {photo ? (
                                                    <img
                                                        src={photo}
                                                        alt={displayName}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-100 to-rose-200 text-red-800 font-bold text-xs select-none">
                                                        {firstName.slice(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                                {/* Ponto indicador de status operacional */}
                                                <span 
                                                    className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-white shadow-2xs ${dotColor}`} 
                                                    title={`Status: ${st}`}
                                                />
                                            </div>

                                            {/* Nome abaixo do minicard quadrado */}
                                            <span className={`text-[10px] font-bold mt-1 truncate w-full text-center sm:text-left transition-colors leading-tight ${
                                                isSelected ? 'text-red-700' : 'text-gray-900 group-hover:text-red-600'
                                            }`}>
                                                {firstName}
                                            </span>
                                            <span className="text-[9px] text-gray-400 truncate w-full text-center sm:text-left leading-tight">
                                                {colab.shift || colab.role || 'Suporte'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Botão Ver Mais no rodapé da box */}
                            <button
                                type="button"
                                onClick={() => setIsTeamModalOpen(true)}
                                className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl border border-gray-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Users className="w-3.5 h-3.5 text-gray-500" />
                                <span>Ver mais ({activeCollaboratorsList.length} colegas)</span>
                            </button>
                        </div>

                        {/* CARD 2.5: HORÁRIO DE OPERAÇÃO ATUAL & ESCALA OFICIAL */}
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
                            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1.5 shadow-2xs">
                                <div className="flex items-center gap-2">
                                    <Headphones className="w-4 h-4 text-amber-600" />
                                    <span className="text-xs font-bold text-gray-900 tracking-wide">
                                        {THIRD_PARTY_SCHEDULE_INFO.title}
                                    </span>
                                </div>
                                <div className="text-[11px] font-mono font-bold text-amber-700">
                                    Horário: {THIRD_PARTY_SCHEDULE_INFO.hours}
                                </div>
                                <p className="text-[11px] text-gray-600 leading-relaxed">
                                    {THIRD_PARTY_SCHEDULE_INFO.description}
                                </p>
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
                        {/* Header Modal com Gradiente Oficial HubDesk */}
                        <div className="p-5 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between shadow-xs">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white">
                                    <Camera className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Alterar Foto de Perfil</h3>
                                    <p className="text-[11px] text-red-100">Recurso Oficial PhotoUrl do Firebase</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsPhotoModalOpen(false)}
                                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Conteúdo do Modal */}
                        <div className="p-6 space-y-6">

                            {/* Preview Circular / Quadrado Arredondado */}
                            <div className="flex flex-col items-center justify-center">
                                <div className="w-28 h-28 rounded-3xl border-4 border-red-500/20 shadow-md bg-gray-100 overflow-hidden flex items-center justify-center mb-2 relative">
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
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-2xl bg-gray-100">
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
                                            className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-red-600 text-gray-900 placeholder:text-gray-400"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPhotoPreview(photoUrlInput)}
                                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-gray-200"
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

            {/* ========================================================================= */}
            {/* MODAL DE PERSONALIZAÇÃO DA CAPA / BANNER DO PERFIL (8 CORES + HTTPS)      */}
            {/* ========================================================================= */}
            {isBannerModalOpen && (
                <div 
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setIsBannerModalOpen(false)}
                >
                    <div 
                        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header Modal com Gradiente Oficial */}
                        <div className="p-5 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between shadow-xs">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white">
                                    <Palette className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Personalizar Capa do Perfil</h3>
                                    <p className="text-[11px] text-red-100">Escolha uma das 8 cores ou informe um link HTTPS de imagem</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsBannerModalOpen(false)}
                                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Conteúdo do Modal */}
                        <div className="p-6 space-y-5">
                            {/* Pré-visualização ao Vivo */}
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-2">
                                    Pré-visualização da Capa:
                                </label>
                                {(() => {
                                    const previewPreset = BANNER_COLOR_PRESETS.find(p => p.id === bannerColorDraft) || BANNER_COLOR_PRESETS[0];
                                    const hasValidImg = Boolean(bannerUrlDraft && bannerUrlDraft.trim().startsWith('https://'));
                                    return (
                                        <div 
                                            className={`h-28 rounded-2xl bg-gradient-to-r ${previewPreset.gradient} relative overflow-hidden flex items-end p-3.5 border border-gray-200 shadow-inner transition-all bg-cover bg-center`}
                                            style={hasValidImg ? { backgroundImage: `url(${bannerUrlDraft.trim()})` } : {}}
                                        >
                                            <div className="absolute inset-0 bg-black/25"></div>
                                            <div className="relative z-10 text-white flex items-center justify-between w-full">
                                                <div>
                                                    <span className="text-xs font-black drop-shadow-sm">{previewPreset.name}</span>
                                                    {hasValidImg && (
                                                        <span className="block text-[10px] text-white/90 font-medium">Link de imagem HTTPS ativo</span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-xs font-bold">
                                                    Ao vivo
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Seletor de Cores (8 Opções) */}
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-2">
                                    Selecione uma Cor de Fundo (8 Opções):
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {BANNER_COLOR_PRESETS.map(preset => {
                                        const isSelected = bannerColorDraft === preset.id;
                                        return (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => setBannerColorDraft(preset.id)}
                                                className={`p-2 rounded-xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
                                                    isSelected
                                                        ? 'border-red-600 ring-2 ring-red-300 bg-red-50/50 shadow-xs'
                                                        : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                                                }`}
                                            >
                                                <div className={`h-8 w-full rounded-lg bg-gradient-to-r ${preset.gradient} flex items-center justify-center shadow-2xs`}>
                                                    {isSelected && <Check className="w-4 h-4 text-white stroke-[3] drop-shadow" />}
                                                </div>
                                                <span className="text-[11px] font-bold text-gray-800 truncate block">
                                                    {preset.name.split(' ')[0]}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Opção Imagem HTTPS */}
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1.5">
                                    Imagem de Capa Personalizada via Link HTTPS (Opcional):
                                </label>
                                <div className="relative">
                                    <LinkIcon className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                                    <input
                                        type="url"
                                        value={bannerUrlDraft}
                                        onChange={(e) => setBannerUrlDraft(e.target.value)}
                                        placeholder="https://exemplo.com/minha-capa.jpg"
                                        className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-red-600 text-gray-900 placeholder:text-gray-400"
                                    />
                                </div>
                                <div className="flex items-center justify-between mt-1 text-[10px] text-gray-500">
                                    <span>Cole um link direto seguro (deve iniciar com https://).</span>
                                    {bannerUrlDraft && (
                                        <button
                                            type="button"
                                            onClick={() => setBannerUrlDraft('')}
                                            className="text-red-600 hover:underline font-bold cursor-pointer"
                                        >
                                            Remover Imagem
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer Modal */}
                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsBannerModalOpen(false)}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmBanner}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                            >
                                Confirmar Capa
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL DE LISTA COMPLETA DE COLEGAS DE EQUIPE (VER MAIS)                   */}
            {/* ========================================================================= */}
            {isTeamModalOpen && (
                <div 
                    onClick={() => setIsTeamModalOpen(false)}
                    className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[80] backdrop-blur-xs animate-in fade-in duration-150"
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-200 animate-in zoom-in-95 duration-150"
                    >
                        <div className="p-4 bg-gradient-to-r from-red-600 to-rose-700 text-white flex justify-between items-center shrink-0 shadow-xs">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white">
                                    <Users className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Colegas de Equipe</h3>
                                    <p className="text-[11px] text-red-100">
                                        {activeCollaboratorsList.length} colaboradores ativos no time
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setIsTeamModalOpen(false)}
                                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Barra de Busca no Modal */}
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                            <div className="relative">
                                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                <input
                                    type="text"
                                    value={colabSearchQuery}
                                    onChange={(e) => setColabSearchQuery(e.target.value)}
                                    placeholder="Buscar por nome, cargo ou turno..."
                                    className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-red-500 text-gray-900 placeholder:text-gray-400"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Grid Completo de Colegas */}
                        <div className="p-4 overflow-y-auto flex-1 space-y-2">
                            {filteredColabsList.length === 0 ? (
                                <div className="py-12 text-center text-xs text-gray-400 italic">
                                    Nenhum colega encontrado com o termo "{colabSearchQuery}".
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {filteredColabsList.map(c => {
                                        const cId = c.id || c.firestoreId || c.uid;
                                        const isSelected = activeSelectedColab && (activeSelectedColab.id === cId || activeSelectedColab.firestoreId === cId || activeSelectedColab.uid === cId);
                                        const photo = c.photoURL || c.photoUrl;
                                        const name = c.name || c.displayName || c.email?.split('@')[0];
                                        const st = c.status || 'Ativo';
                                        const dotColor = st === 'Ativo' ? 'bg-emerald-500' : st === 'Férias' ? 'bg-amber-500' : 'bg-purple-500';

                                        return (
                                            <div
                                                key={cId}
                                                className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                                                    isSelected ? 'bg-red-50 border-red-300 ring-1 ring-red-200' : 'bg-white border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="relative shrink-0">
                                                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-gradient-to-br from-red-100 to-rose-200 border border-red-200 flex items-center justify-center font-bold text-red-800 text-xs">
                                                            {photo ? (
                                                                <img src={photo} alt={name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span>{name.slice(0, 2).toUpperCase()}</span>
                                                            )}
                                                        </div>
                                                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-2xs ${dotColor}`} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="text-xs font-bold text-gray-900 truncate" title={name}>
                                                            {name}
                                                        </h4>
                                                        <p className="text-[10px] text-gray-500 truncate">
                                                            {c.role || 'Colaborador'} &bull; <strong className="text-gray-700">{c.shift || 'Geral'}</strong>
                                                        </p>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedColabId(cId);
                                                        setIsTeamModalOpen(false);
                                                    }}
                                                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-700 rounded-lg text-xs font-bold border border-red-200 transition-all cursor-pointer shrink-0"
                                                >
                                                    Ver Perfil
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-xs">
                            <span className="text-gray-400">
                                Mostrando {filteredColabsList.length} de {activeCollaboratorsList.length} colegas
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsTeamModalOpen(false)}
                                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-colors cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default MyProfile;
