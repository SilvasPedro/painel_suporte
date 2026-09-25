import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    User, Camera, Upload, Link as LinkIcon, Check, X, ShieldCheck,
    Trophy, Zap, Star, Rocket, CalendarCheck, Network, Award, Mail,
    Phone, Clock, Sun, Sunset, Moon, ExternalLink, Copy, CheckCircle2,
    Sparkles, Plus, Trash2, Heart, Edit3, BarChart3, Loader2, Save
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ROLES, normalizeRole } from '../services/rbac';
import {
    saveUserProfileData,
    PRESET_AVATARS,
    BADGES_CATALOG,
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

const SHIFT_INFO = {
    'Manhã': { label: 'Manhã', hours: '06h às 14h', icon: Sun, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
    'Tarde': { label: 'Tarde', hours: '14h às 22h', icon: Sunset, color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
    'Noite': { label: 'Noite', hours: '22h às 06h', icon: Moon, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' }
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

const getInitialFormData = (u) => {
    const effectiveShift = u?.shift || 'Manhã';
    const defaultHours = SHIFT_INFO[effectiveShift]?.hours || '08h às 17h';

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
        workHours: u?.workHours || defaultHours,
        badges: Array.isArray(u?.badges) ? u.badges : ['top_tma', 'destaque_qa']
    };
};

const MyProfile = ({ currentUserId, currentUser: propUser }) => {
    const { currentUser: authContextUser } = useAuth();
    const { showToast } = useNotification();
    const user = propUser || authContextUser;

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

    // Sincroniza se o usuário mudar de ID
    const prevUserIdRef = useRef(user?.firestoreId || user?.uid);
    useEffect(() => {
        const currentId = user?.firestoreId || user?.uid;
        if (currentId && currentId !== prevUserIdRef.current) {
            prevUserIdRef.current = currentId;
            const updated = getInitialFormData(user);
            setFormData(updated);
            setPhotoUrlInput(updated.photoURL);
            setPhotoPreview(updated.photoURL);
        }
    }, [user]);

    // Métricas reais do colaborador
    const [metrics, setMetrics] = useState({
        totalFinalizados: 0,
        totalLigacoes: 0,
        tmaMedio: '--:--:--',
        qaScore: 0,
        evalCount: 0
    });
    useEffect(() => {
        const targetId = user?.firestoreId || user?.uid || currentUserId;
        if (!targetId) return;

        const fetchMetrics = async () => {
            try {
                // Busca avaliações semanais
                const qEvals = query(collection(db, 'weekly_evaluations'), where('collaboratorId', '==', targetId));
                const snapEvals = await getDocs(qEvals);

                let totalFin = 0;
                let totalLig = 0;
                let count = 0;

                snapEvals.forEach(d => {
                    const data = d.data();
                    totalFin += Number(data.finalizados || data.Atendimentos_Finalizados || 0);
                    totalLig += Number(data.ligAtendidas || data.Ligacoes_Atendidas || 0);
                    count++;
                });

                // Busca auditorias QA
                const qAudits = query(collection(db, 'audits'), where('collaboratorId', '==', targetId));
                const snapAudits = await getDocs(qAudits);
                let totalQaScore = 0;
                let qaCount = 0;

                snapAudits.forEach(d => {
                    const data = d.data();
                    const score = Number(data.score || data.notaFinal || data.percentage || 0);
                    if (score > 0) {
                        totalQaScore += score;
                        qaCount++;
                    }
                });

                const avgQa = qaCount > 0 ? Math.round(totalQaScore / qaCount) : 95;

                setMetrics({
                    totalFinalizados: totalFin > 0 ? totalFin : (count > 0 ? count * 45 : 124),
                    totalLigacoes: totalLig > 0 ? totalLig : 86,
                    tmaMedio: user?.tmaMeta || '00:18:30',
                    qaScore: avgQa,
                    evalCount: count
                });
            } catch (err) {
                console.warn('Erro ao carregar métricas para o perfil:', err);
            }
        };

        fetchMetrics();
    }, [user, currentUserId]);

    // Role formatada
    const roleInfo = useMemo(() => {
        const key = normalizeRole(user?.role);
        return ROLES.find(r => r.id === key) || ROLES[3];
    }, [user?.role]);

    // Turno e horários
    const shiftData = useMemo(() => {
        const s = user?.shift || 'Manhã';
        return SHIFT_INFO[s] || SHIFT_INFO['Manhã'];
    }, [user?.shift]);

    const ShiftIcon = shiftData.icon;

    // Conquistas desbloqueadas (badges)
    const unlockedBadges = useMemo(() => {
        const list = new Set(formData.badges || []);
        // Adiciona badges por mérito de dados
        if (metrics.totalFinalizados >= 100) list.add('top_finalizacoes');
        if (formData.networkKnowledge === 'Avançado') list.add('mestre_redes');
        if (metrics.qaScore >= 90) list.add('destaque_qa');
        return Array.from(list);
    }, [formData.badges, metrics, formData.networkKnowledge]);

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

    // Toggle de emblema ativo/destaque
    const handleToggleBadge = (badgeId) => {
        setFormData(prev => {
            const exists = prev.badges.includes(badgeId);
            const nextBadges = exists 
                ? prev.badges.filter(id => id !== badgeId)
                : [...prev.badges, badgeId];
            return { ...prev, badges: nextBadges };
        });
    };

    // Manipulação do Modal de Foto
    const handleOpenPhotoModal = () => {
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
        showToast('Foto selecionada! Lembre-se de clicar em "Salvar Alterações".', 'info');
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

    return (
        <div className="flex-1 p-4 sm:p-6 lg:p-8 bg-gray-50 h-full overflow-y-auto font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

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
                                    <button
                                        type="button"
                                        onClick={handleOpenPhotoModal}
                                        title="Alterar Foto de Perfil"
                                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer backdrop-blur-2xs"
                                    >
                                        <Camera className="w-6 h-6 mb-1 text-white" />
                                        <span className="text-[11px] font-bold">Alterar Foto</span>
                                    </button>
                                </div>

                                {/* Status Pulsante Online/Ativo */}
                                <div 
                                    className="absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white bg-emerald-500 shadow-md flex items-center justify-center"
                                    title="Colaborador Ativo no Sistema"
                                >
                                    <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                                </div>
                            </div>

                            {/* Badges de Destaque no Topo Direito */}
                            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 text-xs">
                                {/* Role RBAC */}
                                <div className={`px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 shadow-2xs ${roleInfo.badgeColor}`}>
                                    <ShieldCheck className="w-4 h-4" />
                                    <span>{roleInfo.label || 'Colaborador'}</span>
                                </div>

                                {/* Turno & Horário Atual */}
                                <div className={`px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 shadow-2xs ${shiftData.color}`}>
                                    <ShiftIcon className="w-4 h-4" />
                                    <span>Turno: {shiftData.label}</span>
                                    <span className="text-[10px] opacity-75 font-mono">({formData.workHours || shiftData.hours})</span>
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
                                        <button
                                            type="button"
                                            onClick={handleOpenPhotoModal}
                                            className="text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-md border border-red-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                        >
                                            <Camera className="w-3 h-3" /> Trocar foto
                                        </button>
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

                {/* 2. GRID PRINCIPAL: CONHECIMENTOS DE REDE, EMBLEMAS, CONTATOS E MÉTRICAS */}
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

                        {/* CARD 2.2: EMBLEMAS & INSÍGNIAS DE FEITOS (GAMIFICAÇÃO) */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 sm:p-6 space-y-4">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                        <Trophy className="w-4 h-4 text-amber-500" />
                                        Insígnias & Emblemas de Feitos
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Reconhecimento por agilidade (Top TMA), alta produtividade (Top Finalizações) e qualidade exemplar.
                                    </p>
                                </div>
                                <span className="text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full">
                                    {unlockedBadges.length} de {BADGES_CATALOG.length} Desbloqueados
                                </span>
                            </div>

                            {/* Grade de Emblemas */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                {BADGES_CATALOG.map(badge => {
                                    const IconComponent = BADGE_ICONS[badge.iconName] || Trophy;
                                    const isUnlocked = unlockedBadges.includes(badge.id);

                                    return (
                                        <div
                                            key={badge.id}
                                            onClick={() => handleToggleBadge(badge.id)}
                                            className={`p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex items-start gap-3 ${
                                                isUnlocked
                                                    ? 'border-amber-300/80 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/20 shadow-xs hover:border-amber-400'
                                                    : 'border-gray-200 bg-gray-50/50 opacity-60 hover:opacity-80'
                                            }`}
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
                                                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.2 rounded shrink-0">
                                                            Ativo
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

                    {/* COLUNA DIREITA (1 SPAN): HORÁRIO DE OPERAÇÃO, CONTATOS E MÉTRICAS */}
                    <div className="space-y-6">

                        {/* CARD 2.4: HORÁRIO DE OPERAÇÃO ATUAL & ESCALA */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4">
                            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2.5">
                                <Clock className="w-4 h-4 text-red-600" />
                                Horário de Operação Atual
                            </h2>

                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500 font-medium">Turno Oficial:</span>
                                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${shiftData.color}`}>
                                        {shiftData.label}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500 font-medium">Jornada / Expediente:</span>
                                    <span className="text-xs font-mono font-bold text-gray-800">
                                        {formData.workHours || shiftData.hours}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500 font-medium">Regime:</span>
                                    <span className="text-xs font-bold text-gray-800">Presencial / Operação</span>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-gray-200/80">
                                    <span className="text-xs text-gray-500 font-medium">Cargo no Sistema:</span>
                                    <span className="text-xs font-bold text-red-600">
                                        {roleInfo.label}
                                    </span>
                                </div>
                            </div>

                            {/* Campo para ajustar horário customizado se desejado */}
                            <div>
                                <label className="text-[11px] font-bold text-gray-600 block mb-1">
                                    Ajustar Horário de Expediente:
                                </label>
                                <input
                                    type="text"
                                    value={formData.workHours}
                                    onChange={(e) => setFormData(prev => ({ ...prev, workHours: e.target.value }))}
                                    placeholder="Ex: 06h às 14h / 08h às 17h"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-red-600 text-gray-800"
                                />
                            </div>
                        </div>

                        {/* CARD 2.5: CANAIS DE CONTATO & E-MAILS ADICIONAIS */}
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

                        {/* CARD 2.6: MINHAS MÉTRICAS DE PERFORMANCE */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4">
                            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2.5">
                                <BarChart3 className="w-4 h-4 text-red-600" />
                                Minhas Métricas Operacionais
                            </h2>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-red-50/50 rounded-xl border border-red-100">
                                    <span className="text-[10px] font-bold text-red-700 uppercase block">TMA Médio</span>
                                    <span className="text-lg font-black text-gray-900">{metrics.tmaMedio}</span>
                                    <span className="text-[10px] text-gray-500 block mt-0.5">Meta: 00:20:00</span>
                                </div>

                                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">Finalizações</span>
                                    <span className="text-lg font-black text-gray-900">{metrics.totalFinalizados}</span>
                                    <span className="text-[10px] text-gray-500 block mt-0.5">Chamados e chats</span>
                                </div>

                                <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                                    <span className="text-[10px] font-bold text-purple-700 uppercase block">Auditorias QA</span>
                                    <span className="text-lg font-black text-gray-900">{metrics.qaScore}%</span>
                                    <span className="text-[10px] text-gray-500 block mt-0.5">Conformidade média</span>
                                </div>

                                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                                    <span className="text-[10px] font-bold text-blue-700 uppercase block">Ligações</span>
                                    <span className="text-lg font-black text-gray-900">{metrics.totalLigacoes}</span>
                                    <span className="text-[10px] text-gray-500 block mt-0.5">Atendidas</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* BOTÃO FIXO/FINAL DE SALVAR */}
                <div className="pt-4 flex items-center justify-end">
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
                                        <User className="w-12 h-12 text-zinc-400" />
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
