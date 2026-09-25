import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Network, Save, Loader2, Users, GripVertical, X, 
    Crown, LifeBuoy, Headset, GraduationCap,
    Lock, Unlock, Check, AlertCircle, Search, 
    Sparkles, RefreshCw, Sun, Sunset, Moon, 
    ChevronDown, ArrowDown, UserCheck, 
    MoveRight, Undo2, Shield
} from 'lucide-react';
import { collection, onSnapshot, query, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import { useNotification } from '../context/NotificationContext';

// Definição das 4 Camadas (Tiers) do Organograma com cores e identidades visuais
const TIERS_CONFIG = [
    {
        key: 'lider_supervisor',
        label: 'Liderança & Supervisão',
        sublabel: 'Gestão direta, auditorias e tomada de decisão operacional',
        icon: Crown,
        theme: {
            border: 'border-amber-200',
            bg: 'bg-amber-50/40',
            headerBg: 'bg-gradient-to-r from-amber-500 to-amber-600',
            badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
            accentText: 'text-amber-700',
            dragOverBg: 'bg-amber-100/80 border-amber-500 ring-2 ring-amber-300',
            cardBorder: 'hover:border-amber-400'
        }
    },
    {
        key: 'assistente_apoio',
        label: 'Assistência & Apoio Operacional',
        sublabel: 'Monitoria de filas, auxílio técnico e suporte contínuo à equipe',
        icon: LifeBuoy,
        theme: {
            border: 'border-sky-200',
            bg: 'bg-sky-50/40',
            headerBg: 'bg-gradient-to-r from-sky-600 to-blue-600',
            badgeBg: 'bg-sky-100 text-sky-900 border-sky-300',
            accentText: 'text-sky-700',
            dragOverBg: 'bg-sky-100/80 border-sky-500 ring-2 ring-sky-300',
            cardBorder: 'hover:border-sky-400'
        }
    },
    {
        key: 'operacional_efetivado',
        label: 'Corpo Operacional Efetivado',
        sublabel: 'Analistas em regime pleno de atendimento (Voz, Chat e Tickets)',
        icon: Headset,
        theme: {
            border: 'border-emerald-200',
            bg: 'bg-emerald-50/40',
            headerBg: 'bg-gradient-to-r from-emerald-600 to-teal-600',
            badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
            accentText: 'text-emerald-700',
            dragOverBg: 'bg-emerald-100/80 border-emerald-500 ring-2 ring-emerald-300',
            cardBorder: 'hover:border-emerald-400'
        }
    },
    {
        key: 'novatos_experiencia',
        label: 'Novatos & Período de Experiência',
        sublabel: 'Integrantes em treinamento, acolhimento ou contrato inicial',
        icon: GraduationCap,
        theme: {
            border: 'border-purple-200',
            bg: 'bg-purple-50/40',
            headerBg: 'bg-gradient-to-r from-purple-600 to-indigo-600',
            badgeBg: 'bg-purple-100 text-purple-900 border-purple-300',
            accentText: 'text-purple-700',
            dragOverBg: 'bg-purple-100/80 border-purple-500 ring-2 ring-purple-300',
            cardBorder: 'hover:border-purple-400'
        }
    }
];

const DEFAULT_STRUCTURE = {
    lider_supervisor: [],
    assistente_apoio: [],
    operacional_efetivado: [],
    novatos_experiencia: []
};

const DOCUMENT_ID = 'department_structure';

const OrgChart = ({ readOnly }) => {
    const { currentUser } = useAuth();
    const { canEdit, normalizedRole, isMasterAdmin } = usePermissions();
    const { showToast } = useNotification();

    // -------------------------------------------------------------
    // DETERMINAÇÃO ROBUSTA DE PERMISSÃO (Quem pode editar vs quem é readOnly)
    // -------------------------------------------------------------
    const hasEditPermission = useMemo(() => {
        // Master Admin sempre edita
        if (isMasterAdmin) return true;

        // Verifica cargo do usuário
        const roleStr = String(currentUser?.role || '').toLowerCase();
        const isGestor = normalizedRole === 'gestor' || roleStr.includes('gestor') || roleStr.includes('admin') || roleStr.includes('gerente');

        // Checa permissão do RBAC para 'orgchart'
        const rbacAllows = canEdit('orgchart');

        // Se o RBAC explicitamente permite, pode editar
        if (rbacAllows) return true;

        // Se for Gestor e o prop readOnly não tiver sido forçado estritamente pelo container pai como true
        if (isGestor && readOnly !== true) {
            return true;
        }

        // Se o prop readOnly foi explicitamente informado como false
        if (readOnly === false) return true;

        return false;
    }, [canEdit, isMasterAdmin, normalizedRole, currentUser, readOnly]);

    // O status final de somente leitura
    const isReadOnly = !hasEditPermission;

    // Estados de Dados
    const [allCollaborators, setAllCollaborators] = useState([]);
    const [chart, setChart] = useState(DEFAULT_STRUCTURE);
    const [savedChart, setSavedChart] = useState(DEFAULT_STRUCTURE);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Estados de Drag & Drop
    const [draggedItem, setDraggedItem] = useState(null); // { colab, sourceLevel }
    const [dragOverTier, setDragOverTier] = useState(null); // key of tier or 'unassigned'

    // Estados de Filtro do Painel Lateral
    const [searchTerm, setSearchTerm] = useState('');
    const [shiftFilter, setShiftFilter] = useState('all'); // all | Manhã | Tarde | Noite

    // Menu rápido de movimentação por clique (sem arrastar)
    const [activeActionMenu, setActiveActionMenu] = useState(null); // { colabId, sourceLevel }
    const menuRef = useRef(null);

    // Fecha o menu de ação ao clicar fora
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setActiveActionMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 1. Busca todos os colaboradores ativos no Firestore
    useEffect(() => {
        const qColabs = query(collection(db, 'collaborators'));
        const unsubColabs = onSnapshot(qColabs, (snap) => {
            const colabs = [];
            snap.forEach(d => {
                if (d.data().active !== false) {
                    colabs.push({ id: d.id, ...d.data() });
                }
            });
            colabs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setAllCollaborators(colabs);
        });
        return () => unsubColabs();
    }, []);

    // 2. Ouvinte em tempo real da estrutura do organograma no Firestore
    useEffect(() => {
        const docRef = doc(db, 'system_settings', DOCUMENT_ID);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().structure) {
                const loaded = { ...DEFAULT_STRUCTURE, ...docSnap.data().structure };
                setSavedChart(loaded);
                // Atualiza o estado visual se o usuário não estiver no meio de alterações pendentes
                setChart(prev => {
                    return JSON.stringify(prev) === JSON.stringify(DEFAULT_STRUCTURE) ? loaded : prev;
                });
            } else {
                setSavedChart(DEFAULT_STRUCTURE);
            }
            setLoading(false);
        }, (error) => {
            console.error('Erro no listener de organograma:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 3. Colaboradores Não Alocados
    const unassignedCollaborators = useMemo(() => {
        const assignedIds = new Set([
            ...(chart.lider_supervisor || []).map(c => c.id),
            ...(chart.assistente_apoio || []).map(c => c.id),
            ...(chart.operacional_efetivado || []).map(c => c.id),
            ...(chart.novatos_experiencia || []).map(c => c.id)
        ]);
        return allCollaborators.filter(c => !assignedIds.has(c.id));
    }, [allCollaborators, chart]);

    // Colaboradores filtrados por busca e turno
    const filteredUnassigned = useMemo(() => {
        return unassignedCollaborators.filter(c => {
            const matchesSearch = !searchTerm.trim() || 
                (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.role || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesShift = shiftFilter === 'all' || c.shift === shiftFilter;
            return matchesSearch && matchesShift;
        });
    }, [unassignedCollaborators, searchTerm, shiftFilter]);

    // Estatísticas da Equipe
    const stats = useMemo(() => {
        const total = allCollaborators.length;
        const leaders = (chart.lider_supervisor || []).length;
        const assists = (chart.assistente_apoio || []).length;
        const ops = (chart.operacional_efetivado || []).length;
        const trainees = (chart.novatos_experiencia || []).length;
        const allocated = leaders + assists + ops + trainees;
        const unassigned = total - allocated;
        const percent = total > 0 ? Math.round((allocated / total) * 100) : 0;

        return { total, allocated, unassigned, percent, leaders, assists, ops, trainees };
    }, [allCollaborators, chart]);

    // -------------------------------------------------------------
    // AÇÕES DE MANIPULAÇÃO DA ESTRUTURA
    // -------------------------------------------------------------

    // Mover um colaborador de forma universal (por Drag ou por Clique)
    const moveCollaborator = (colab, sourceLevel, targetLevel) => {
        if (isReadOnly) return;
        if (sourceLevel === targetLevel) return;

        setChart(prev => {
            const next = JSON.parse(JSON.stringify(prev));

            // Remove da origem se veio de um tier
            if (sourceLevel && next[sourceLevel]) {
                next[sourceLevel] = next[sourceLevel].filter(c => c.id !== colab.id);
            }

            // Adiciona ao destino se for um tier válido
            if (targetLevel && next[targetLevel]) {
                // Evita duplicatas defensivamente
                next[targetLevel] = next[targetLevel].filter(c => c.id !== colab.id);
                next[targetLevel].push({
                    id: colab.id,
                    name: colab.name,
                    shift: colab.shift || 'Não informado',
                    role: colab.role || '',
                    email: colab.email || '',
                    photoUrl: colab.photoUrl || null
                });
            }

            return next;
        });

        setHasUnsavedChanges(true);
        setActiveActionMenu(null);
    };

    // Remover um colaborador de um tier (retorna para Não Alocados)
    const handleRemoveFromTier = (levelKey, colabId) => {
        if (isReadOnly) return;
        setChart(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            if (next[levelKey]) {
                next[levelKey] = next[levelKey].filter(c => c.id !== colabId);
            }
            return next;
        });
        setHasUnsavedChanges(true);
        setActiveActionMenu(null);
    };

    // Auto-alocar por cargo cadastrado no perfil
    const handleAutoSuggestByRole = () => {
        if (isReadOnly) return;
        if (unassignedCollaborators.length === 0) {
            showToast('Não há colaboradores pendentes de alocação.', 'info');
            return;
        }

        let movedCount = 0;
        setChart(prev => {
            const next = JSON.parse(JSON.stringify(prev));

            unassignedCollaborators.forEach(colab => {
                const roleLower = String(colab.role || '').toLowerCase();
                let target = null;

                if (roleLower.includes('supervis') || roleLower.includes('lider') || roleLower.includes('gestor') || roleLower.includes('coordenador')) {
                    target = 'lider_supervisor';
                } else if (roleLower.includes('apoio') || roleLower.includes('assistente')) {
                    target = 'assistente_apoio';
                } else if (roleLower.includes('experiência') || roleLower.includes('novato') || roleLower.includes('treinamento') || roleLower.includes('estagio')) {
                    target = 'novatos_experiencia';
                } else {
                    target = 'operacional_efetivado';
                }

                if (target && next[target]) {
                    next[target].push({
                        id: colab.id,
                        name: colab.name,
                        shift: colab.shift || 'Não informado',
                        role: colab.role || '',
                        email: colab.email || '',
                        photoUrl: colab.photoUrl || null
                    });
                    movedCount++;
                }
            });

            return next;
        });

        if (movedCount > 0) {
            setHasUnsavedChanges(true);
            showToast(`${movedCount} colaborador(es) distribuídos por cargo! Clique em "Salvar Estrutura" para confirmar.`, 'success');
        }
    };

    // Esvaziar toda a estrutura
    const handleClearStructure = () => {
        if (isReadOnly) return;
        if (stats.allocated === 0) return;

        if (window.confirm('Tem certeza de que deseja esvaziar todos os níveis do organograma? Todos os colaboradores retornarão para a lista de Não Alocados.')) {
            setChart(DEFAULT_STRUCTURE);
            setHasUnsavedChanges(true);
            showToast('Estrutura esvaziada. Clique em "Salvar Estrutura" para confirmar no banco.', 'info');
        }
    };

    // Descartar alterações e recarregar
    const handleDiscardChanges = () => {
        if (!hasUnsavedChanges) return;
        if (window.confirm('Deseja descartar as alterações não salvas e restaurar a versão salva no banco?')) {
            setChart(JSON.parse(JSON.stringify(savedChart)));
            setHasUnsavedChanges(false);
            showToast('Alterações descartadas.', 'info');
        }
    };

    // Salvar no Firebase
    const handleSave = async () => {
        if (isReadOnly) return;
        setSaving(true);
        try {
            await setDoc(doc(db, 'system_settings', DOCUMENT_ID), {
                structure: chart,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser?.email || 'Admin'
            });
            setSavedChart(JSON.parse(JSON.stringify(chart)));
            setHasUnsavedChanges(false);
            showToast('Organograma salvo com sucesso no banco de dados!', 'success');
        } catch (error) {
            console.error('Erro ao salvar organograma:', error);
            showToast('Erro ao salvar organograma. Verifique sua conexão.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // -------------------------------------------------------------
    // HANDLERS ROBUSTOS DE DRAG & DROP
    // -------------------------------------------------------------
    const handleDragStart = (e, colab, sourceLevel) => {
        if (isReadOnly) return;
        setDraggedItem({ colab, sourceLevel });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ id: colab.id, sourceLevel }));
        setTimeout(() => {
            if (e.target) e.target.style.opacity = '0.4';
        }, 0);
    };

    const handleDragEnd = (e) => {
        if (isReadOnly) return;
        if (e.target) e.target.style.opacity = '1';
        setDraggedItem(null);
        setDragOverTier(null);
    };

    const handleDragOver = (e, tierKey) => {
        if (isReadOnly) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverTier !== tierKey) {
            setDragOverTier(tierKey);
        }
    };

    const handleDragLeave = (e, tierKey) => {
        if (isReadOnly) return;
        e.preventDefault();
        e.stopPropagation();
        if (dragOverTier === tierKey) {
            setDragOverTier(null);
        }
    };

    const handleDrop = (e, targetLevel) => {
        if (isReadOnly) return;
        e.preventDefault();
        e.stopPropagation();
        setDragOverTier(null);

        if (!draggedItem) return;
        const { colab, sourceLevel } = draggedItem;
        moveCollaborator(colab, sourceLevel, targetLevel);
    };

    // Helper de Ícone de Turno
    const renderShiftBadge = (shift) => {
        const s = String(shift || '').toLowerCase();
        if (s.includes('manh')) {
            return (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    <Sun className="w-2.5 h-2.5 text-amber-500" /> Manhã
                </span>
            );
        }
        if (s.includes('tard')) {
            return (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                    <Sunset className="w-2.5 h-2.5 text-orange-500" /> Tarde
                </span>
            );
        }
        if (s.includes('noit')) {
            return (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Moon className="w-2.5 h-2.5 text-indigo-500" /> Noite
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                {shift || 'Geral'}
            </span>
        );
    };

    // Helper para gerar iniciais do avatar
    const getInitials = (name) => {
        if (!name) return '??';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    if (loading && allCollaborators.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 h-full p-8">
                <Loader2 className="w-10 h-10 text-red-600 animate-spin mb-3" />
                <p className="text-sm font-semibold text-zinc-600">Carregando dados do organograma...</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto w-full bg-gray-50 flex flex-col">
            <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6 pb-16 flex-1 flex flex-col">

                {/* ======================================================== */}
                {/* CABEÇALHO PRINCIPAL COM RECONHECIMENTO DE PERMISSÃO */}
                {/* ======================================================== */}
                <header className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                    <div className="space-y-1.5">
                        <div className="flex items-center flex-wrap gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                                <Network className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
                                    Organograma Operacional
                                </h1>
                                <p className="text-xs text-zinc-500">
                                    Estrutura hierárquica oficial, níveis de liderança e distribuição dos colaboradores por função.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Bloco de Status de Acesso & Ações */}
                    <div className="flex items-center flex-wrap gap-2.5 self-start md:self-auto">
                        
                        {/* Indicador Visual Claro de Permissão */}
                        {isReadOnly ? (
                            <div 
                                title="Seu perfil de acesso está configurado como somente leitura para o organograma."
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200 shadow-2xs"
                            >
                                <Lock className="w-3.5 h-3.5 text-zinc-500" />
                                <span>Modo Somente Leitura</span>
                            </div>
                        ) : (
                            <div 
                                title={`Você possui permissão de edição ativa como ${currentUser?.role || 'Gestor'}.`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
                            >
                                <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Modo Edição Ativo</span>
                                <span className="text-[10px] font-normal text-emerald-600 border-l border-emerald-300 pl-1.5">
                                    {currentUser?.role || 'Gestor'}
                                </span>
                            </div>
                        )}

                        {/* Botões de Ação para quem pode editar */}
                        {!isReadOnly && (
                            <>
                                {/* Auto-alocar por cargo */}
                                {unassignedCollaborators.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleAutoSuggestByRole}
                                        title="Distribuir automaticamente os colaboradores não alocados de acordo com o cargo cadastrado"
                                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-zinc-200 shadow-2xs"
                                    >
                                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                        <span className="hidden sm:inline">Auto-Distribuir</span>
                                    </button>
                                )}

                                {/* Descartar Alterações */}
                                {hasUnsavedChanges && (
                                    <button
                                        type="button"
                                        onClick={handleDiscardChanges}
                                        title="Descartar mudanças não salvas"
                                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-zinc-200 shadow-2xs"
                                    >
                                        <Undo2 className="w-3.5 h-3.5 text-zinc-500" />
                                        <span className="hidden sm:inline">Descartar</span>
                                    </button>
                                )}

                                {/* Salvar Estrutura */}
                                <button
                                    id="btn-save-orgchart"
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving || loading}
                                    className={`inline-flex items-center gap-2 px-4 py-2 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm disabled:opacity-50 ${
                                        hasUnsavedChanges 
                                            ? 'bg-red-600 hover:bg-red-700 ring-2 ring-red-400/50 animate-pulse' 
                                            : 'bg-zinc-900 hover:bg-zinc-800'
                                    }`}
                                >
                                    {saving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    <span>
                                        {hasUnsavedChanges ? 'Salvar Alterações *' : 'Salvar Estrutura'}
                                    </span>
                                </button>
                            </>
                        )}
                    </div>
                </header>

                {/* ======================================================== */}
                {/* CARDS DE RESUMO E ESTATÍSTICAS DA EQUIPE */}
                {/* ======================================================== */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
                    <div className="bg-white p-3.5 rounded-xl border border-zinc-200/80 shadow-xs">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Total Equipe</span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-xl font-black text-zinc-900">{stats.total}</span>
                            <span className="text-[11px] text-zinc-500">colabs</span>
                        </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-zinc-200/80 shadow-xs">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Alocados</span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-xl font-black text-emerald-600">{stats.allocated}</span>
                            <span className="text-[11px] text-emerald-700 font-bold">({stats.percent}%)</span>
                        </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-zinc-200/80 shadow-xs">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Não Alocados</span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className={`text-xl font-black ${stats.unassigned > 0 ? 'text-amber-600' : 'text-zinc-900'}`}>
                                {stats.unassigned}
                            </span>
                            <span className="text-[11px] text-zinc-500">pendentes</span>
                        </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-amber-200/70 shadow-xs bg-amber-50/20">
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block flex items-center gap-1">
                            <Crown className="w-3 h-3 text-amber-600" /> Líderes
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-xl font-black text-amber-900">{stats.leaders}</span>
                            <span className="text-[11px] text-amber-700">membros</span>
                        </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-sky-200/70 shadow-xs bg-sky-50/20">
                        <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider block flex items-center gap-1">
                            <LifeBuoy className="w-3 h-3 text-sky-600" /> Apoio
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-xl font-black text-sky-900">{stats.assists}</span>
                            <span className="text-[11px] text-sky-700">membros</span>
                        </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-emerald-200/70 shadow-xs bg-emerald-50/20">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block flex items-center gap-1">
                            <Headset className="w-3 h-3 text-emerald-600" /> Operação
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-xl font-black text-emerald-900">{stats.ops}</span>
                            <span className="text-[11px] text-emerald-700">membros</span>
                        </div>
                    </div>
                </div>

                {/* Banner de Aviso de Alterações Pendentes */}
                {hasUnsavedChanges && !isReadOnly && (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-amber-900 animate-fadeIn">
                        <div className="flex items-center gap-2 font-medium">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                                Você realizou alterações no organograma que ainda não foram gravadas. Clique em <strong>Salvar Alterações</strong> para atualizar o sistema para todos.
                            </span>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer shadow-2xs"
                        >
                            Salvar Agora
                        </button>
                    </div>
                )}

                {/* ======================================================== */}
                {/* ÁREA PRINCIPAL: LATERAL NÃO ALOCADOS + ÁRVORE HIERÁRQUICA */}
                {/* ======================================================== */}
                <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-[600px]">
                    
                    {/* ==================================================== */}
                    {/* PAINEL LATERAL ESQUERDO: NÃO ALOCADOS */}
                    {/* ==================================================== */}
                    {!isReadOnly && (
                        <aside 
                            className={`w-full lg:w-80 bg-white rounded-2xl border transition-all shadow-xs flex flex-col overflow-hidden shrink-0 ${
                                dragOverTier === 'unassigned' 
                                    ? 'border-red-500 bg-red-50/20 ring-2 ring-red-200' 
                                    : 'border-zinc-200/80'
                            }`}
                            onDragOver={(e) => handleDragOver(e, 'unassigned')}
                            onDragLeave={(e) => handleDragLeave(e, 'unassigned')}
                            onDrop={(e) => handleDrop(e, null)} // Soltar aqui remove de qualquer nível
                        >
                            {/* Topo do Painel */}
                            <div className="p-4 border-b border-zinc-200/80 bg-zinc-950 text-white flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-red-500" />
                                    <h3 className="font-bold text-sm">Não Alocados</h3>
                                </div>
                                <span className="text-xs font-mono font-bold bg-zinc-800 text-zinc-200 px-2 py-0.5 rounded-full">
                                    {unassignedCollaborators.length}
                                </span>
                            </div>

                            {/* Filtros e Busca */}
                            <div className="p-3 border-b border-zinc-100 bg-zinc-50/70 space-y-2">
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                                    <input 
                                        type="text"
                                        placeholder="Buscar por nome ou cargo..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-8 pr-7 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-red-500 focus:ring-1 focus:ring-red-200"
                                    />
                                    {searchTerm && (
                                        <button 
                                            onClick={() => setSearchTerm('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Filtro Rápido de Turno */}
                                <div className="flex items-center gap-1">
                                    {['all', 'Manhã', 'Tarde', 'Noite'].map((shift) => (
                                        <button
                                            key={shift}
                                            type="button"
                                            onClick={() => setShiftFilter(shift)}
                                            className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-colors cursor-pointer text-center ${
                                                shiftFilter === shift 
                                                    ? 'bg-zinc-900 text-white' 
                                                    : 'bg-white text-zinc-600 hover:bg-zinc-200/60 border border-zinc-200/80'
                                            }`}
                                        >
                                            {shift === 'all' ? 'Todos' : shift}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Lista de Colaboradores Não Alocados */}
                            <div className="p-3 overflow-y-auto flex-1 space-y-2 bg-zinc-50/40">
                                {dragOverTier === 'unassigned' && (
                                    <div className="p-3 border-2 border-dashed border-red-400 bg-red-50 rounded-xl text-center text-xs font-bold text-red-700 animate-pulse">
                                        Solte aqui para desvincular do organograma
                                    </div>
                                )}

                                {filteredUnassigned.length === 0 ? (
                                    <div className="text-center py-8 px-4 text-zinc-400 space-y-2">
                                        <UserCheck className="w-8 h-8 mx-auto text-zinc-300" />
                                        <p className="text-xs font-medium">
                                            {unassignedCollaborators.length === 0 
                                                ? 'Todos os colaboradores ativos estão alocados na estrutura!' 
                                                : 'Nenhum colaborador encontrado com os filtros atuais.'}
                                        </p>
                                    </div>
                                ) : (
                                    filteredUnassigned.map(colab => {
                                        const isMenuOpen = activeActionMenu?.colabId === colab.id && activeActionMenu?.sourceLevel === null;

                                        return (
                                            <div 
                                                key={colab.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, colab, null)}
                                                onDragEnd={handleDragEnd}
                                                className="bg-white border border-zinc-200/90 hover:border-zinc-300 p-2.5 rounded-xl shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-2 group relative cursor-grab active:cursor-grabbing"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <GripVertical className="w-4 h-4 text-zinc-300 group-hover:text-zinc-600 shrink-0" />
                                                    
                                                    {/* Avatar com foto ou iniciais */}
                                                    <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[11px] font-black text-zinc-700 shrink-0 overflow-hidden">
                                                        {(colab.photoUrl || colab.photoURL) ? (
                                                            <img src={colab.photoUrl || colab.photoURL} alt={colab.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            getInitials(colab.name)
                                                        )}
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p className="font-bold text-xs text-zinc-900 truncate" title={colab.name}>
                                                            {colab.name}
                                                        </p>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            {renderShiftBadge(colab.shift)}
                                                            {colab.role && (
                                                                <span className="text-[9px] text-zinc-400 truncate max-w-[80px]">
                                                                    {colab.role}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Botão de Alocação Rápida por Clique (sem arrastar) */}
                                                <div className="relative shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveActionMenu(isMenuOpen ? null : { colabId: colab.id, sourceLevel: null, colab })}
                                                        title="Alocar em um nível hierárquico"
                                                        className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                                                    >
                                                        <span>Alocar</span>
                                                        <ChevronDown className="w-3 h-3" />
                                                    </button>

                                                    {/* Menu Dropdown de Destino */}
                                                    {isMenuOpen && (
                                                        <div 
                                                            ref={menuRef}
                                                            className="absolute right-0 top-full mt-1.5 w-56 bg-zinc-900 text-white rounded-xl shadow-2xl p-1.5 z-50 border border-zinc-800 space-y-1 text-xs"
                                                        >
                                                            <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                                                                Mover para:
                                                            </div>
                                                            {TIERS_CONFIG.map(t => {
                                                                const Icon = t.icon;
                                                                return (
                                                                    <button
                                                                        key={t.key}
                                                                        type="button"
                                                                        onClick={() => moveCollaborator(colab, null, t.key)}
                                                                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 flex items-center gap-2 transition-colors cursor-pointer"
                                                                    >
                                                                        <Icon className="w-3.5 h-3.5 text-zinc-300" />
                                                                        <span className="font-semibold truncate">{t.label}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Rodapé Informativo */}
                            <div className="p-2.5 bg-zinc-100/70 border-t border-zinc-200/80 text-[10px] text-zinc-500 text-center leading-tight">
                                Arraste os cards para os níveis ao lado ou use o botão <strong>Alocar</strong>.
                            </div>
                        </aside>
                    )}

                    {/* ==================================================== */}
                    {/* LADO DIREITO: ÁRVORE HIERÁRQUICA DO ORGANOGRAMA */}
                    {/* ==================================================== */}
                    <main className="flex-1 bg-white rounded-2xl border border-zinc-200/80 shadow-xs p-4 sm:p-6 lg:p-8 flex flex-col items-center relative overflow-y-auto">

                        {/* Banner Informativo para Modo Leitura */}
                        {isReadOnly && (
                            <div className="w-full max-w-4xl mb-6 bg-sky-50 border border-sky-200 rounded-xl p-3.5 flex items-center gap-3 text-xs text-sky-900">
                                <Shield className="w-4 h-4 text-sky-600 shrink-0" />
                                <div>
                                    <strong className="font-bold">Modo de Consulta:</strong> O organograma está em modo de leitura com base nas permissões do seu cargo (<span className="font-semibold capitalize">{currentUser?.role || normalizedRole}</span>). Caso precise realizar alterações de liderança ou equipe, solicite a um Gestor do sistema.
                                </div>
                            </div>
                        )}

                        {/* Linhas e Níveis Hierárquicos */}
                        <div className="w-full max-w-5xl space-y-4 flex flex-col items-center">
                            {TIERS_CONFIG.map((tier, index) => {
                                const assigned = chart[tier.key] || [];
                                const isOver = dragOverTier === tier.key;
                                const TierIcon = tier.icon;

                                return (
                                    <React.Fragment key={tier.key}>
                                        {/* Conector Vertical Hierárquico com Seta */}
                                        {index !== 0 && (
                                            <div className="flex flex-col items-center py-1 select-none">
                                                <div className="w-0.5 h-6 bg-zinc-300"></div>
                                                <div className="w-5 h-5 rounded-full bg-zinc-100 border border-zinc-300 flex items-center justify-center -my-1 z-10">
                                                    <ArrowDown className="w-3 h-3 text-zinc-500" />
                                                </div>
                                                <div className="w-0.5 h-6 bg-zinc-300"></div>
                                            </div>
                                        )}

                                        {/* Bloco do Nível / Tier */}
                                        <div 
                                            className={`w-full rounded-2xl border-2 transition-all p-4 sm:p-5 flex flex-col ${
                                                isOver 
                                                    ? tier.theme.dragOverBg 
                                                    : `${tier.theme.border} ${tier.theme.bg}`
                                            }`}
                                            onDragOver={(e) => handleDragOver(e, tier.key)}
                                            onDragLeave={(e) => handleDragLeave(e, tier.key)}
                                            onDrop={(e) => handleDrop(e, tier.key)}
                                        >
                                            {/* Cabeçalho do Nível */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-black/5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-8 h-8 rounded-xl ${tier.theme.badgeBg} flex items-center justify-center shrink-0`}>
                                                        <TierIcon className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h2 className="font-black text-sm uppercase tracking-wider text-zinc-900">
                                                                {tier.label}
                                                            </h2>
                                                            <span className="text-xs font-mono font-bold bg-white/80 border border-black/10 px-2 py-0.5 rounded-full text-zinc-800 shadow-2xs">
                                                                {assigned.length}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-zinc-500 mt-0.5">
                                                            {tier.sublabel}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Dica para Modo Edição */}
                                                {!isReadOnly && (
                                                    <div className="text-[11px] text-zinc-400 italic sm:text-right hidden sm:block">
                                                        {isOver ? 'Solte o colaborador para alocar neste nível' : 'Arraste colaboradores aqui'}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Área de Cards de Colaboradores Alocados */}
                                            <div className="flex flex-wrap justify-center sm:justify-start gap-3 w-full min-h-[70px]">
                                                {assigned.length === 0 ? (
                                                    <div 
                                                        className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-6 px-4 text-center transition-colors ${
                                                            isOver 
                                                                ? 'border-zinc-500 bg-white/70' 
                                                                : 'border-black/10 bg-white/40 text-zinc-400'
                                                        }`}
                                                    >
                                                        <TierIcon className="w-6 h-6 mb-1.5 opacity-40" />
                                                        <p className="text-xs font-semibold text-zinc-600">
                                                            {isOver 
                                                                ? 'Solte para alocar neste nível!' 
                                                                : isReadOnly 
                                                                    ? 'Nenhum colaborador alocado nesta função no momento' 
                                                                    : 'Nenhum colaborador alocado neste nível'}
                                                        </p>
                                                        {!isReadOnly && !isOver && (
                                                            <p className="text-[11px] text-zinc-400 mt-0.5">
                                                                Arraste da barra lateral ou utilize o botão Alocar em qualquer card
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    assigned.map((colab) => {
                                                        const isMenuOpen = activeActionMenu?.colabId === colab.id && activeActionMenu?.sourceLevel === tier.key;

                                                        return (
                                                            <div 
                                                                key={`${tier.key}-${colab.id}`}
                                                                draggable={!isReadOnly}
                                                                onDragStart={!isReadOnly ? (e) => handleDragStart(e, colab, tier.key) : undefined}
                                                                onDragEnd={!isReadOnly ? handleDragEnd : undefined}
                                                                className={`bg-white border border-zinc-200/90 w-full sm:w-56 p-3 rounded-xl shadow-2xs flex flex-col justify-between transition-all group relative ${
                                                                    !isReadOnly 
                                                                        ? `cursor-grab active:cursor-grabbing hover:shadow-md ${tier.theme.cardBorder}` 
                                                                        : 'cursor-default'
                                                                }`}
                                                            >
                                                                {/* Topo do Card: Grip + Botões de Ação */}
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <div className="flex items-center gap-1.5 text-zinc-300">
                                                                        {!isReadOnly && (
                                                                            <GripVertical className="w-3.5 h-3.5 group-hover:text-zinc-500" />
                                                                        )}
                                                                        {renderShiftBadge(colab.shift)}
                                                                    </div>

                                                                    {/* Ações para quem pode editar */}
                                                                    {!isReadOnly && (
                                                                        <div className="flex items-center gap-1">
                                                                            {/* Botão Mover para outro nível */}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setActiveActionMenu(isMenuOpen ? null : { colabId: colab.id, sourceLevel: tier.key, colab })}
                                                                                title="Mover para outro nível hierárquico"
                                                                                className="p-1 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded transition-colors cursor-pointer"
                                                                            >
                                                                                <MoveRight className="w-3 h-3" />
                                                                            </button>

                                                                            {/* Botão Remover deste nível */}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRemoveFromTier(tier.key, colab.id)}
                                                                                title="Remover deste nível (retornar para Não Alocados)"
                                                                                className="p-1 text-zinc-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                                                            >
                                                                                <X className="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Centro do Card: Avatar e Nome */}
                                                                <div className="flex items-center gap-2.5 my-1">
                                                                    <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-xs font-black text-zinc-700 shrink-0 overflow-hidden">
                                                                        {(colab.photoUrl || colab.photoURL) ? (
                                                                            <img src={colab.photoUrl || colab.photoURL} alt={colab.name} className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            getInitials(colab.name)
                                                                        )}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="font-bold text-xs text-zinc-900 truncate" title={colab.name}>
                                                                            {colab.name}
                                                                        </p>
                                                                        <p className="text-[10px] text-zinc-400 truncate mt-0.5" title={colab.role || colab.email}>
                                                                            {colab.role || colab.email || 'Analista'}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                {/* Menu Dropdown de Movimentação do Card no Tier */}
                                                                {isMenuOpen && !isReadOnly && (
                                                                    <div 
                                                                        ref={menuRef}
                                                                        className="absolute right-2 top-8 w-56 bg-zinc-900 text-white rounded-xl shadow-2xl p-1.5 z-50 border border-zinc-800 space-y-1 text-xs"
                                                                    >
                                                                        <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                                                                            Mover para:
                                                                        </div>
                                                                        {TIERS_CONFIG.filter(t => t.key !== tier.key).map(t => {
                                                                            const Icon = t.icon;
                                                                            return (
                                                                                <button
                                                                                    key={t.key}
                                                                                    type="button"
                                                                                    onClick={() => moveCollaborator(colab, tier.key, t.key)}
                                                                                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 flex items-center gap-2 transition-colors cursor-pointer"
                                                                                >
                                                                                    <Icon className="w-3.5 h-3.5 text-zinc-300" />
                                                                                    <span className="font-semibold truncate">{t.label}</span>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                        <div className="border-t border-zinc-800 pt-1 mt-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRemoveFromTier(tier.key, colab.id)}
                                                                                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-900/60 text-red-400 hover:text-red-300 flex items-center gap-2 transition-colors cursor-pointer font-bold"
                                                                            >
                                                                                <X className="w-3.5 h-3.5" />
                                                                                <span>Desvincular (Não Alocado)</span>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>

                        {/* Botão de Limpeza no Fundo (Apenas para Editores) */}
                        {!isReadOnly && stats.allocated > 0 && (
                            <div className="mt-8 pt-6 border-t border-zinc-200/80 w-full max-w-4xl flex justify-between items-center text-xs text-zinc-400">
                                <span>Organograma Operacional • Suporte Prodigy</span>
                                <button
                                    type="button"
                                    onClick={handleClearStructure}
                                    className="text-zinc-500 hover:text-red-600 font-semibold transition-colors cursor-pointer flex items-center gap-1"
                                >
                                    <span>Esvaziar todos os níveis</span>
                                </button>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
};

export default OrgChart;
