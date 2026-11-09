import React, { useState, useEffect, useMemo } from 'react';
import { 
    Users, UserPlus, Edit3, FileText, MessageSquare, 
    X, Loader2, Calendar, Phone, PhoneMissed, 
    CheckCircle, Clock, Filter, KeyRound, UserX, UserCheck, 
    Search, Shield, Eye, LayoutGrid, List, Table, Layers, 
    Sun, Sunset, Moon, ArrowUpDown, ChevronDown, ChevronRight, 
    Award, TrendingUp, Sparkles, AlertCircle, Check, Mail, MoreVertical,
    Crown, Zap, Flame, ShieldCheck
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeSharedCollection } from '../services/dataCache';
import { useNotification } from '../context/NotificationContext';
import { usePermissions } from '../context/PermissionsContext';
import { ROLES, normalizeRole, getRoleLabel } from '../services/rbac';
import { Card, Badge, Button, Tabs, EmptyState, Input } from '../components/ui';
import { ShineBorder, BorderBeam, AnimatedShinyText, MagicCard } from '../components/magicui';
import { cn } from '../utils/cn';

// Sub-componentes modais modernos
import CreateCollaboratorModal from '../components/collaborators/CreateCollaboratorModal';
import EditCollaboratorModal from '../components/collaborators/EditCollaboratorModal';
import FeedbackModal from '../components/collaborators/FeedbackModal';
import ReportDashboardModal from '../components/collaborators/ReportDashboardModal';
import { calculatePerformanceScore, getHuggyStats } from '../utils/scoringCalculations';

// --- FUNÇÕES AUXILIARES ---
const parseDateObj = (dateStr) => {
    if (!dateStr || dateStr === 'Semana Atual' || dateStr === 'Sem data') return 0;
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
    }
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
    }
    return 0;
};

const calcularPontuacao = (metrics) => {
    if (!metrics) return null;
    return calculatePerformanceScore({
        Atendimentos_Finalizados: metrics.finalizados ?? metrics.Atendimentos_Finalizados,
        Ligacoes_Atendidas: metrics.ligAtendidas ?? metrics.Ligacoes_Atendidas,
        Ligacoes_Realizadas: metrics.ligRealizadas ?? metrics.Ligacoes_Realizadas,
        Ligacoes_Perdidas: metrics.ligPerdidas ?? metrics.Ligacoes_Perdidas,
        Atendimentos_Huggy: metrics.huggyVol ?? metrics.Atendimentos_Huggy,
        Huggy_Iniciados: metrics.huggyIniciados ?? metrics.Huggy_Iniciados,
        Huggy_Finalizados: metrics.huggyFinalizados ?? metrics.Huggy_Finalizados
    });
};

// Helper visual e de turnos oficiais (Manhã I, Manhã II, Tarde, Noturno)
const getShiftBadgeStyle = (shift) => {
    const s = String(shift || '').trim();
    const sLower = s.toLowerCase();

    if (s === 'Manhã I' || (sLower.includes('manh') && (sLower.includes('i') || sLower.includes('1')) && !sLower.includes('ii') && !sLower.includes('2')) || s === 'Manhã') {
        return {
            id: 'Manhã I',
            label: s === 'Manhã' ? 'Manhã I' : (s || 'Manhã I'),
            icon: Sun,
            iconClass: 'text-amber-500',
            badgeClass: 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs',
            dotClass: 'bg-amber-400',
            activeClass: 'border-amber-400 bg-amber-50/80 ring-1 ring-amber-400',
            barClass: 'bg-amber-400',
            hours: '08:00 às 14:15'
        };
    }
    if (s === 'Manhã II' || (sLower.includes('manh') && (sLower.includes('ii') || sLower.includes('2')))) {
        return {
            id: 'Manhã II',
            label: s || 'Manhã II',
            icon: Sun,
            iconClass: 'text-yellow-600',
            badgeClass: 'bg-yellow-50 text-yellow-900 border-yellow-300 shadow-2xs',
            dotClass: 'bg-yellow-400',
            activeClass: 'border-yellow-400 bg-yellow-50/80 ring-1 ring-yellow-400',
            barClass: 'bg-yellow-400',
            hours: '09:00 às 15:15'
        };
    }
    if (s === 'Tarde' || sLower.includes('tard')) {
        return {
            id: 'Tarde',
            label: 'Tarde',
            icon: Sunset,
            iconClass: 'text-orange-500',
            badgeClass: 'bg-orange-50 text-orange-900 border-orange-300 shadow-2xs',
            dotClass: 'bg-orange-500',
            activeClass: 'border-orange-400 bg-orange-50/80 ring-1 ring-orange-400',
            barClass: 'bg-orange-500',
            hours: '11:00 às 17:15'
        };
    }
    if (s === 'Noturno' || s === 'Noite' || sLower.includes('noturn') || sLower.includes('noit')) {
        return {
            id: 'Noturno',
            label: s === 'Noite' ? 'Noturno' : (s || 'Noturno'),
            icon: Moon,
            iconClass: 'text-indigo-600',
            badgeClass: 'bg-indigo-50 text-indigo-900 border-indigo-300 shadow-2xs',
            dotClass: 'bg-indigo-600',
            activeClass: 'border-indigo-500 bg-indigo-50/80 ring-1 ring-indigo-400',
            barClass: 'bg-indigo-600',
            hours: '13:45 às 20:00'
        };
    }
    return {
        id: 'Outros',
        label: s || 'Sem Turno',
        icon: Clock,
        iconClass: 'text-gray-400',
        badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
        dotClass: 'bg-gray-400',
        activeClass: 'border-gray-400 bg-gray-100',
        barClass: 'bg-gray-300',
        hours: '--'
    };
};

const getRoleMeta = (roleString) => {
    const key = normalizeRole(roleString);
    const found = ROLES.find(r => r.id === key);
    if (found) return found;
    return {
        id: 'colaborador',
        label: getRoleLabel(roleString),
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        activeBadgeColor: 'bg-emerald-600 text-white'
    };
};

const CollaboratorsHub = () => {
    const { showToast } = useNotification();
    const { canEdit, activeRoleInfo, normalizedRole } = usePermissions();
    const isEditable = canEdit('hub');

    // Modais
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingColab, setEditingColab] = useState(null);
    const [feedbackColab, setFeedbackColab] = useState(null);
    const [reportColab, setReportColab] = useState(null);

    // Dados
    const [collaborators, setCollaborators] = useState([]);
    const [evaluations, setEvaluations] = useState([]);
    const [loading, setLoading] = useState(true);

    // Visualização e Filtros
    // 'grid' (Grade), 'table' (Tabela), 'compact' (Diretório), 'grouped' (Agrupado)
    const [viewMode, setViewMode] = useState('grid');
    const [groupBy, setGroupBy] = useState('shift'); // 'shift' ou 'role'
    const [searchTerm, setSearchTerm] = useState('');
    const [shiftFilter, setShiftFilter] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('active'); // 'all', 'active', 'inactive' (padrão: ativos)
    const [sortBy, setSortBy] = useState('name_asc'); // 'name_asc', 'name_desc', 'score_desc', 'score_asc'

    // --- CONEXÃO COM FIRESTORE VIA CACHE COMPARTILHADO ---
    useEffect(() => {
        const unsubscribe = subscribeSharedCollection("collaborators", (items) => {
            const docs = [...items];
            docs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setCollaborators(docs);
            setLoading(false);
        });

        const unsubEvals = subscribeSharedCollection("weekly_evaluations", (items) => {
            setEvaluations(items);
        });

        return () => {
            unsubscribe();
            unsubEvals();
        };
    }, []);

    // Mapeamento da última avaliação por colaborador
    const latestEvalMap = useMemo(() => {
        const map = {};
        evaluations.forEach(ev => {
            if (!ev.colabId) return;
            const current = map[ev.colabId];
            const currentScoreTime = current 
                ? (current.date !== 'Semana Atual' ? parseDateObj(current.date) : (current.createdAt?.toMillis?.() || 0))
                : -1;
            const evTime = ev.date !== 'Semana Atual' ? parseDateObj(ev.date) : (ev.createdAt?.toMillis?.() || 0);

            if (!current || evTime >= currentScoreTime) {
                map[ev.colabId] = ev;
            }
        });
        return map;
    }, [evaluations]);

    // Alternar status ativo/inativo
    const handleToggleActive = async (colab) => {
        if (!isEditable) {
            showToast("Seu perfil tem apenas permissão de visualização.", "error");
            return;
        }
        try {
            const newStatus = colab.active === false ? true : false;
            await updateDoc(doc(db, "collaborators", colab.id), { 
                active: newStatus,
                status: newStatus ? "Ativo" : "Inativo"
            });
            showToast(`Colaborador ${newStatus ? 'ativado' : 'inativado'} com sucesso!`, "success");
        } catch (error) {
            showToast("Erro ao alterar status: " + error.message, "error");
        }
    };

    // Estatísticas gerais dos turnos oficiais
    const { totalCount, activeCount, inactiveCount, manha1Count, manha2Count, tardeCount, noturnoCount, outrosCount } = useMemo(() => {
        const total = collaborators.length;
        const active = collaborators.filter(c => c.active !== false);
        const inactive = total - active.length;
        
        let m1 = 0;
        let m2 = 0;
        let tar = 0;
        let not = 0;
        let out = 0;

        active.forEach(c => {
            const s = String(c.shift || '').trim();
            const sLower = s.toLowerCase();
            if (s === 'Manhã I' || (sLower.includes('manh') && (sLower.includes('i') || sLower.includes('1')) && !sLower.includes('ii') && !sLower.includes('2')) || s === 'Manhã') {
                m1++;
            } else if (s === 'Manhã II' || (sLower.includes('manh') && (sLower.includes('ii') || sLower.includes('2')))) {
                m2++;
            } else if (s === 'Tarde' || sLower.includes('tard')) {
                tar++;
            } else if (s === 'Noturno' || s === 'Noite' || sLower.includes('noturn') || sLower.includes('noit')) {
                not++;
            } else {
                out++;
            }
        });

        return {
            totalCount: total,
            activeCount: active.length,
            inactiveCount: inactive,
            manha1Count: m1,
            manha2Count: m2,
            tardeCount: tar,
            noturnoCount: not,
            outrosCount: out
        };
    }, [collaborators]);

    const getPercent = (value) => activeCount > 0 ? (value / activeCount) * 100 : 0;

    // Média de pontuação dos ativos avaliados
    const avgActiveScore = useMemo(() => {
        let sum = 0;
        let count = 0;
        collaborators.forEach(c => {
            if (c.active === false) return;
            const ev = latestEvalMap[c.id];
            if (ev) {
                const score = calcularPontuacao(ev);
                if (score !== null) {
                    sum += score;
                    count++;
                }
            }
        });
        return count > 0 ? Math.round(sum / count) : null;
    }, [collaborators, latestEvalMap]);

    // Identificação do MVP / Destaque Atual da Equipe
    const mvpCollaborator = useMemo(() => {
        let best = null;
        let maxScore = -Infinity;
        collaborators.forEach(c => {
            if (c.active === false) return;
            const ev = latestEvalMap[c.id];
            if (ev) {
                const s = calcularPontuacao(ev);
                if (s !== null && s > maxScore) {
                    maxScore = s;
                    best = { colab: c, score: s, eval: ev };
                }
            }
        });
        return best;
    }, [collaborators, latestEvalMap]);

    // Filtragem e Ordenação
    const filteredCollaborators = useMemo(() => {
        return collaborators.filter(colab => {
            const term = searchTerm.toLowerCase().trim();
            const matchesSearch = !term || (
                (colab.name && colab.name.toLowerCase().includes(term)) ||
                (colab.email && colab.email.toLowerCase().includes(term)) ||
                (colab.role && colab.role.toLowerCase().includes(term)) ||
                (colab.shift && colab.shift.toLowerCase().includes(term))
            );

            const isActive = colab.active !== false;
            const matchesStatus = 
                statusFilter === 'all' ? true :
                statusFilter === 'active' ? isActive : !isActive;

            const matchesShift = (() => {
                if (!shiftFilter) return true;
                const s = String(colab.shift || '').trim();
                const sLower = s.toLowerCase();
                if (shiftFilter === 'Manhã I') {
                    return s === 'Manhã I' || (sLower.includes('manh') && (sLower.includes('i') || sLower.includes('1')) && !sLower.includes('ii') && !sLower.includes('2')) || s === 'Manhã';
                }
                if (shiftFilter === 'Manhã II') {
                    return s === 'Manhã II' || (sLower.includes('manh') && (sLower.includes('ii') || sLower.includes('2')));
                }
                if (shiftFilter === 'Tarde') {
                    return s === 'Tarde' || sLower.includes('tard');
                }
                if (shiftFilter === 'Noturno') {
                    return s === 'Noturno' || s === 'Noite' || sLower.includes('noturn') || sLower.includes('noit');
                }
                return s === shiftFilter;
            })();

            const matchesRole = roleFilter ? normalizeRole(colab.role) === normalizeRole(roleFilter) : true;

            return matchesSearch && matchesStatus && matchesShift && matchesRole;
        }).sort((a, b) => {
            if (sortBy === 'name_asc') {
                return (a.name || '').localeCompare(b.name || '');
            }
            if (sortBy === 'name_desc') {
                return (b.name || '').localeCompare(a.name || '');
            }
            if (sortBy === 'score_desc' || sortBy === 'score_asc') {
                const scoreA = calcularPontuacao(latestEvalMap[a.id]) ?? -9999;
                const scoreB = calcularPontuacao(latestEvalMap[b.id]) ?? -9999;
                return sortBy === 'score_desc' ? scoreB - scoreA : scoreA - scoreB;
            }
            return 0;
        });
    }, [collaborators, searchTerm, statusFilter, shiftFilter, roleFilter, sortBy, latestEvalMap]);

    const hasActiveFilters = searchTerm || shiftFilter || roleFilter || statusFilter !== 'active';

    const clearFilters = () => {
        setSearchTerm('');
        setShiftFilter('');
        setRoleFilter('');
        setStatusFilter('active');
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 bg-gray-50 h-full">
                <Loader2 className="w-9 h-9 text-red-600 animate-spin mb-3" />
                <span className="text-sm font-semibold text-gray-500">Carregando Hub da Equipe...</span>
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 bg-canvas h-full overflow-y-auto">
            {/* CABEÇALHO EXECUTIVO */}
            <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-rose-500 uppercase tracking-wider">
                        <Users className="w-3.5 h-3.5" />
                        <span>Gestão de Pessoas & Operação</span>
                    </div>
                    <h1 className="font-brand text-2xl font-bold text-primary-hub tracking-tight">Hub da Equipe</h1>
                    <p className="text-xs text-secondary-hub mt-0.5">
                        Central de colaboradores, acompanhamento de turnos, perfis de acesso e registros individuais.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {isEditable ? (
                        <Button
                            variant="primary"
                            icon={UserPlus}
                            onClick={() => setIsCreateModalOpen(true)}
                        >
                            Novo Colaborador
                        </Button>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-2 bg-surface border border-subtle text-secondary-hub rounded-xl text-xs font-medium shadow-2xs">
                            <Eye className="w-4 h-4 text-sky-500" />
                            <span>Modo Leitura ({activeRoleInfo?.label || normalizedRole})</span>
                        </div>
                    )}
                </div>
            </header>

            {/* BENTO GRID EXECUTIVO COM MAGIC UI */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* BENTO 1: MVP / DESTAQUE DA SEMANA (BORDER BEAM + ANIMATED SHINY TEXT) */}
                <div className="relative rounded-2xl bg-surface border border-subtle p-5 shadow-xs flex flex-col justify-between overflow-hidden group">
                    <BorderBeam size={130} duration={6} colorFrom="#f43f5e" colorTo="#fbbf24" borderWidth={2} />
                    
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-600 dark:text-rose-400 tracking-wider uppercase">
                                <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                <span>Destaque Atual</span>
                            </span>
                            {mvpCollaborator?.score !== undefined && (
                                <Badge variant="success" size="sm" icon={Sparkles} className="font-bold tabular-nums">
                                    {mvpCollaborator.score} pts
                                </Badge>
                            )}
                        </div>

                        {mvpCollaborator ? (
                            <div className="flex items-center gap-3 mt-2">
                                <div className="relative w-12 h-12 rounded-2xl bg-zinc-950 text-white flex items-center justify-center font-brand font-black text-base shrink-0 ring-2 ring-rose-500/30 overflow-hidden shadow-sm">
                                    {(mvpCollaborator.colab.photoUrl || mvpCollaborator.colab.photoURL) ? (
                                        <img src={mvpCollaborator.colab.photoUrl || mvpCollaborator.colab.photoURL} alt={mvpCollaborator.colab.name} className="w-full h-full object-cover" />
                                    ) : (
                                        mvpCollaborator.colab.name?.charAt(0)?.toUpperCase() || '?'
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-brand font-bold text-sm text-primary-hub truncate leading-tight">
                                        {mvpCollaborator.colab.name}
                                    </h4>
                                    <p className="text-[11px] text-muted-hub truncate mt-0.5">
                                        {getRoleLabel(mvpCollaborator.colab.role)} • {mvpCollaborator.colab.shift || 'Turno Geral'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="py-3 text-center">
                                <span className="text-xs text-muted-hub font-medium">Aguardando avaliações</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-subtle flex items-center justify-between text-[11px]">
                        <span className="text-muted-hub">Maior pontuação ativa</span>
                        {mvpCollaborator && (
                            <button
                                onClick={() => setReportColab(mvpCollaborator.colab)}
                                className="text-rose-500 hover:text-rose-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                            >
                                Ver ficha
                                <ChevronRight className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>

                {/* BENTO 2: FORÇA OPERACIONAL & ENGAJAMENTO */}
                <div className="rounded-2xl bg-surface border border-subtle p-5 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between text-xs font-semibold text-muted-hub uppercase tracking-wider mb-2">
                            <span className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-rose-500" />
                                Força Operacional
                            </span>
                            <Badge variant={activeCount === totalCount ? "success" : "neutral"} size="sm">
                                {totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0}% ativa
                            </Badge>
                        </div>

                        <div className="flex items-baseline gap-2 mt-2">
                            <span className="font-brand text-3xl font-black text-primary-hub tabular-nums">{activeCount}</span>
                            <span className="text-xs text-muted-hub font-medium">de {totalCount} colaboradores</span>
                        </div>

                        {/* Barra de Ativos x Inativos */}
                        <div className="w-full h-2 bg-subtle rounded-full overflow-hidden flex mt-3 border border-subtle">
                            <div 
                                style={{ width: `${totalCount > 0 ? (activeCount / totalCount) * 100 : 0}%` }} 
                                className="bg-emerald-500 rounded-full transition-all duration-500"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-hub pt-3 border-t border-subtle mt-3">
                        <button
                            type="button"
                            onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all cursor-pointer",
                                statusFilter === 'active' ? "bg-emerald-500/15 text-emerald-600 font-bold" : "hover:text-primary-hub"
                            )}
                            title="Filtrar colaboradores ativos"
                        >
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            {activeCount} ativos
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive')}
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all cursor-pointer",
                                statusFilter === 'inactive' ? "bg-zinc-500/15 text-zinc-300 font-bold" : "hover:text-primary-hub"
                            )}
                            title="Filtrar colaboradores inativos"
                        >
                            <span className="w-2 h-2 rounded-full bg-zinc-400" />
                            {inactiveCount} inativos
                        </button>
                    </div>
                </div>

                {/* BENTO 3: RADAR DE TURNOS INTERATIVO (SPAN 2 COLUNAS) */}
                <div className="lg:col-span-2 rounded-2xl bg-surface border border-subtle p-5 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-500" />
                                <h3 className="text-xs font-bold text-primary-hub uppercase tracking-wider">
                                    Radar de Turnos (Equipe Ativa)
                                </h3>
                            </div>
                            {shiftFilter ? (
                                <button
                                    onClick={() => setShiftFilter('')}
                                    className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer flex items-center gap-1"
                                >
                                    Filtro: {shiftFilter} (Limpar ✕)
                                </button>
                            ) : (
                                <span className="text-[11px] text-muted-hub font-medium">Clique no turno para filtrar</span>
                            )}
                        </div>

                        {/* Barra multi-cor com distribuição de turnos */}
                        <div className="w-full h-2.5 bg-subtle rounded-full overflow-hidden flex my-2 border border-subtle">
                            <div style={{ width: `${getPercent(manha1Count)}%` }} className="bg-amber-400 transition-all duration-500" title={`Manhã I: ${manha1Count}`} />
                            <div style={{ width: `${getPercent(manha2Count)}%` }} className="bg-yellow-400 transition-all duration-500" title={`Manhã II: ${manha2Count}`} />
                            <div style={{ width: `${getPercent(tardeCount)}%` }} className="bg-orange-500 transition-all duration-500" title={`Tarde: ${tardeCount}`} />
                            <div style={{ width: `${getPercent(noturnoCount)}%` }} className="bg-indigo-600 transition-all duration-500" title={`Noturno: ${noturnoCount}`} />
                            {outrosCount > 0 && (
                                <div style={{ width: `${getPercent(outrosCount)}%` }} className="bg-zinc-400 transition-all duration-500" title={`Outros: ${outrosCount}`} />
                            )}
                        </div>
                    </div>

                    {/* 4 Cards Interativos de Turno */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                        {/* Manhã I */}
                        <button
                            type="button"
                            onClick={() => setShiftFilter(shiftFilter === 'Manhã I' ? '' : 'Manhã I')}
                            className={cn(
                                "p-2 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between",
                                shiftFilter === 'Manhã I' 
                                    ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30 shadow-xs" 
                                    : "bg-subtle/50 border-subtle hover:border-amber-400/50 hover:bg-subtle"
                            )}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                <span className="text-[10px] font-bold text-muted-hub">{getPercent(manha1Count).toFixed(0)}%</span>
                            </div>
                            <div>
                                <span className="font-bold text-xs text-primary-hub block truncate">Manhã I</span>
                                <span className="text-[9px] text-muted-hub block">08h - 14h15</span>
                            </div>
                            <span className="font-brand font-black text-sm text-primary-hub mt-1">{manha1Count} <span className="text-[10px] font-normal text-muted-hub">membros</span></span>
                        </button>

                        {/* Manhã II */}
                        <button
                            type="button"
                            onClick={() => setShiftFilter(shiftFilter === 'Manhã II' ? '' : 'Manhã II')}
                            className={cn(
                                "p-2 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between",
                                shiftFilter === 'Manhã II' 
                                    ? "bg-yellow-500/10 border-yellow-500 ring-2 ring-yellow-500/30 shadow-xs" 
                                    : "bg-subtle/50 border-subtle hover:border-yellow-400/50 hover:bg-subtle"
                            )}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                                <span className="text-[10px] font-bold text-muted-hub">{getPercent(manha2Count).toFixed(0)}%</span>
                            </div>
                            <div>
                                <span className="font-bold text-xs text-primary-hub block truncate">Manhã II</span>
                                <span className="text-[9px] text-muted-hub block">09h - 15h15</span>
                            </div>
                            <span className="font-brand font-black text-sm text-primary-hub mt-1">{manha2Count} <span className="text-[10px] font-normal text-muted-hub">membros</span></span>
                        </button>

                        {/* Tarde */}
                        <button
                            type="button"
                            onClick={() => setShiftFilter(shiftFilter === 'Tarde' ? '' : 'Tarde')}
                            className={cn(
                                "p-2 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between",
                                shiftFilter === 'Tarde' 
                                    ? "bg-orange-500/10 border-orange-500 ring-2 ring-orange-500/30 shadow-xs" 
                                    : "bg-subtle/50 border-subtle hover:border-orange-400/50 hover:bg-subtle"
                            )}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="w-2 h-2 rounded-full bg-orange-500" />
                                <span className="text-[10px] font-bold text-muted-hub">{getPercent(tardeCount).toFixed(0)}%</span>
                            </div>
                            <div>
                                <span className="font-bold text-xs text-primary-hub block truncate">Tarde</span>
                                <span className="text-[9px] text-muted-hub block">11h - 17h15</span>
                            </div>
                            <span className="font-brand font-black text-sm text-primary-hub mt-1">{tardeCount} <span className="text-[10px] font-normal text-muted-hub">membros</span></span>
                        </button>

                        {/* Noturno */}
                        <button
                            type="button"
                            onClick={() => setShiftFilter(shiftFilter === 'Noturno' ? '' : 'Noturno')}
                            className={cn(
                                "p-2 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between",
                                shiftFilter === 'Noturno' 
                                    ? "bg-indigo-500/10 border-indigo-500 ring-2 ring-indigo-500/30 shadow-xs" 
                                    : "bg-subtle/50 border-subtle hover:border-indigo-400/50 hover:bg-subtle"
                            )}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                                <span className="text-[10px] font-bold text-muted-hub">{getPercent(noturnoCount).toFixed(0)}%</span>
                            </div>
                            <div>
                                <span className="font-bold text-xs text-primary-hub block truncate">Noturno</span>
                                <span className="text-[9px] text-muted-hub block">13h45 - 20h</span>
                            </div>
                            <span className="font-brand font-black text-sm text-primary-hub mt-1">{noturnoCount} <span className="text-[10px] font-normal text-muted-hub">membros</span></span>
                        </button>
                    </div>
                </div>
            </div>

            {/* PAINEL DE CONTROLE / FILTROS E COMANDOS */}
            <div className="bg-surface p-4 rounded-2xl border border-subtle shadow-xs mb-6 space-y-3">
                <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
                    {/* Campo de Pesquisa Inteligente */}
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-muted-hub absolute left-3.5 top-3" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, e-mail, cargo ou turno..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-9 py-2.5 bg-subtle/60 border border-subtle rounded-xl outline-none focus:bg-surface focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 text-primary-hub transition-all text-xs"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-3 text-muted-hub hover:text-primary-hub p-0.5"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filtros Dropdowns Reestilizados */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Filtro Turno */}
                        <select 
                            value={shiftFilter} 
                            onChange={e => setShiftFilter(e.target.value)}
                            className="py-2.5 px-3 border border-subtle rounded-xl outline-none focus:ring-2 focus:ring-rose-500/30 text-xs bg-surface text-primary-hub font-medium cursor-pointer shadow-2xs"
                        >
                            <option value="">Todos os Turnos</option>
                            <option value="Manhã I">Manhã I (08:00 às 14:15)</option>
                            <option value="Manhã II">Manhã II (09:00 às 15:15)</option>
                            <option value="Tarde">Tarde (11:00 às 17:15)</option>
                            <option value="Noturno">Noturno (13:45 às 20:00)</option>
                        </select>

                        {/* Filtro Cargo */}
                        <select 
                            value={roleFilter} 
                            onChange={e => setRoleFilter(e.target.value)}
                            className="py-2.5 px-3 border border-subtle rounded-xl outline-none focus:ring-2 focus:ring-rose-500/30 text-xs bg-surface text-primary-hub font-medium cursor-pointer shadow-2xs"
                        >
                            <option value="">Todos os Cargos</option>
                            <option value="Gestor">Gestor</option>
                            <option value="Supervisor">Supervisor</option>
                            <option value="Apoio">Apoio</option>
                            <option value="Operacional">Operacional</option>
                        </select>

                        {/* Filtro Status */}
                        <select 
                            value={statusFilter} 
                            onChange={e => setStatusFilter(e.target.value)}
                            className="py-2.5 px-3 border border-subtle rounded-xl outline-none focus:ring-2 focus:ring-rose-500/30 text-xs bg-surface text-primary-hub font-medium cursor-pointer shadow-2xs"
                        >
                            <option value="active">Apenas Ativos (Padrão)</option>
                            <option value="all">Status: Todos</option>
                            <option value="inactive">Apenas Inativos</option>
                        </select>

                        {/* Ordenação */}
                        <select 
                            value={sortBy} 
                            onChange={e => setSortBy(e.target.value)}
                            className="py-2.5 px-3 border border-subtle rounded-xl outline-none focus:ring-2 focus:ring-rose-500/30 text-xs bg-surface text-primary-hub font-medium cursor-pointer shadow-2xs"
                        >
                            <option value="name_asc">Nome (A → Z)</option>
                            <option value="name_desc">Nome (Z → A)</option>
                            <option value="score_desc">Maior Pontuação</option>
                            <option value="score_asc">Menor Pontuação</option>
                        </select>
                    </div>

                    {/* SELETOR DE MODOS DE VISUALIZAÇÃO COM PÍLULAS */}
                    <div className="flex items-center bg-subtle p-1 rounded-xl border border-subtle self-start xl:self-auto shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                viewMode === 'grid' 
                                    ? "bg-surface text-rose-500 shadow-2xs" 
                                    : "text-secondary-hub hover:text-primary-hub"
                            )}
                            title="Visualização em Grade de Cards"
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            <span>Grade</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                viewMode === 'table' 
                                    ? "bg-surface text-rose-500 shadow-2xs" 
                                    : "text-secondary-hub hover:text-primary-hub"
                            )}
                            title="Visualização em Tabela Detalhada"
                        >
                            <Table className="w-3.5 h-3.5" />
                            <span>Tabela</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setViewMode('compact')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                viewMode === 'compact' 
                                    ? "bg-surface text-rose-500 shadow-2xs" 
                                    : "text-secondary-hub hover:text-primary-hub"
                            )}
                            title="Visualização em Diretório Compacto"
                        >
                            <List className="w-3.5 h-3.5" />
                            <span>Diretório</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setViewMode('grouped')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                viewMode === 'grouped' 
                                    ? "bg-surface text-rose-500 shadow-2xs" 
                                    : "text-secondary-hub hover:text-primary-hub"
                            )}
                            title="Visualização Agrupada por Categoria"
                        >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Agrupado</span>
                        </button>
                    </div>
                </div>

                {/* Sub-barra com contadores e botão de limpar filtros */}
                <div className="flex items-center justify-between text-xs text-muted-hub pt-2 border-t border-subtle flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <span>Exibindo <strong className="text-primary-hub">{filteredCollaborators.length}</strong> de {totalCount} colaboradores</span>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-rose-500 hover:text-rose-600 font-bold hover:underline ml-2 cursor-pointer"
                            >
                                Limpar todos os filtros
                            </button>
                        )}
                    </div>

                    {viewMode === 'grouped' && (
                        <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-secondary-hub">Agrupar por:</span>
                            <div className="flex gap-1 bg-subtle p-0.5 rounded-lg border border-subtle">
                                <button
                                    onClick={() => setGroupBy('shift')}
                                    className={cn(
                                        "px-2.5 py-1 rounded-md font-bold text-[11px] cursor-pointer transition-all",
                                        groupBy === 'shift' ? "bg-surface text-primary-hub shadow-2xs" : "text-secondary-hub hover:text-primary-hub"
                                    )}
                                >
                                    Turno
                                </button>
                                <button
                                    onClick={() => setGroupBy('role')}
                                    className={cn(
                                        "px-2.5 py-1 rounded-md font-bold text-[11px] cursor-pointer transition-all",
                                        groupBy === 'role' ? "bg-surface text-primary-hub shadow-2xs" : "text-secondary-hub hover:text-primary-hub"
                                    )}
                                >
                                    Cargo (RBAC)
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* CONTEÚDO PRINCIPAL CONFORME O MODO DE VISUALIZAÇÃO */}
            {filteredCollaborators.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="Nenhum colaborador encontrado"
                    description="Não encontramos nenhum membro com os filtros atuais. Tente ajustar o termo de busca ou limpar os filtros."
                    actionLabel={hasActiveFilters ? "Limpar Filtros" : undefined}
                    onAction={hasActiveFilters ? clearFilters : undefined}
                />
            ) : viewMode === 'grid' ? (
                /* 1. VISUALIZAÇÃO EM GRADE (CARDS MODERNIZADOS) */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredCollaborators.map(colab => (
                        <CollaboratorModernCard
                            key={colab.id}
                            colab={colab}
                            latestEval={latestEvalMap[colab.id]}
                            isEditable={isEditable}
                            onEdit={() => setEditingColab(colab)}
                            onFeedback={() => setFeedbackColab(colab)}
                            onReport={() => setReportColab(colab)}
                            onToggleActive={() => handleToggleActive(colab)}
                        />
                    ))}
                </div>
            ) : viewMode === 'table' ? (
                /* 2. VISUALIZAÇÃO EM TABELA ENTERPRISE */
                <CollaboratorTableView
                    collaborators={filteredCollaborators}
                    latestEvalMap={latestEvalMap}
                    isEditable={isEditable}
                    onEdit={setEditingColab}
                    onFeedback={setFeedbackColab}
                    onReport={setReportColab}
                    onToggleActive={handleToggleActive}
                />
            ) : viewMode === 'compact' ? (
                /* 3. VISUALIZAÇÃO EM DIRETÓRIO COMPACTO */
                <div className="space-y-2">
                    {filteredCollaborators.map(colab => (
                        <CollaboratorCompactRow
                            key={colab.id}
                            colab={colab}
                            latestEval={latestEvalMap[colab.id]}
                            isEditable={isEditable}
                            onEdit={() => setEditingColab(colab)}
                            onFeedback={() => setFeedbackColab(colab)}
                            onReport={() => setReportColab(colab)}
                            onToggleActive={() => handleToggleActive(colab)}
                        />
                    ))}
                </div>
            ) : (
                /* 4. VISUALIZAÇÃO AGRUPADA (POR TURNO OU POR CARGO) */
                <CollaboratorGroupedView
                    collaborators={filteredCollaborators}
                    groupBy={groupBy}
                    latestEvalMap={latestEvalMap}
                    isEditable={isEditable}
                    onEdit={setEditingColab}
                    onFeedback={setFeedbackColab}
                    onReport={setReportColab}
                    onToggleActive={handleToggleActive}
                />
            )}

            {/* MODAIS REESTILIZADOS */}
            {isCreateModalOpen && (
                <CreateCollaboratorModal 
                    onClose={() => setIsCreateModalOpen(false)} 
                    onSuccess={() => setIsCreateModalOpen(false)} 
                />
            )}
            {editingColab && (
                <EditCollaboratorModal 
                    colab={editingColab} 
                    onClose={() => setEditingColab(null)} 
                />
            )}
            {feedbackColab && (
                <FeedbackModal 
                    colab={feedbackColab} 
                    onClose={() => setFeedbackColab(null)} 
                />
            )}
            {reportColab && (
                <ReportDashboardModal 
                    colab={reportColab} 
                    onClose={() => setReportColab(null)} 
                />
            )}
        </div>
    );
};

// =========================================================================
// COMPONENTE 1: CARD MODERNO DA GRADE (MAGIC CARD COM SPOTLIGHT)
// =========================================================================
const CollaboratorModernCard = ({ colab, latestEval, isEditable, onEdit, onFeedback, onReport, onToggleActive }) => {
    const score = latestEval ? calcularPontuacao(latestEval) : null;
    const roleMeta = getRoleMeta(colab.role);
    const isActive = colab.active !== false;
    const shiftStyle = getShiftBadgeStyle(colab.shift);
    const ShiftIcon = shiftStyle.icon;

    return (
        <MagicCard
            gradientColor={isActive ? "rgba(244, 63, 94, 0.16)" : "rgba(148, 163, 184, 0.1)"}
            className={cn(
                "group relative rounded-2xl flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300",
                isActive 
                    ? "border-subtle hover:border-rose-500/40" 
                    : "border-subtle opacity-60 bg-subtle/40"
            )}
        >
            {/* Topo do Crachá Digital */}
            <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="relative">
                        <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center font-brand font-black text-base select-none overflow-hidden shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-105",
                            isActive 
                                ? "bg-zinc-950 text-white ring-2 ring-rose-500/20" 
                                : "bg-zinc-700 text-zinc-300"
                        )}>
                            {(colab.photoUrl || colab.photoURL) ? (
                                <img src={colab.photoUrl || colab.photoURL} alt={colab.name} className="w-full h-full object-cover" />
                            ) : (
                                colab.name?.charAt(0)?.toUpperCase() || '?'
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                        <Badge variant="outline" size="sm" className="font-semibold">
                            {roleMeta.label || getRoleLabel(colab.role)}
                        </Badge>
                        <Badge 
                            variant="neutral" 
                            size="sm" 
                            icon={ShiftIcon}
                            className={cn(shiftStyle.badgeClass, "text-[10px]")}
                        >
                            {shiftStyle.label}
                        </Badge>
                    </div>
                </div>

                {/* Nome e E-mail */}
                <h3 className="font-brand font-bold text-base text-primary-hub truncate leading-tight group-hover:text-rose-500 transition-colors" title={colab.name}>
                    {colab.name}
                </h3>
                <p className="text-xs text-muted-hub truncate flex items-center gap-1.5 mt-1" title={colab.email}>
                    <Mail className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span>{colab.email || 'Sem e-mail cadastrado'}</span>
                </p>

                {/* Micro Cockpit do Colaborador (Métricas Recentes) */}
                <div className="mt-4 p-2.5 rounded-xl bg-subtle/80 border border-subtle grid grid-cols-3 divide-x divide-subtle text-center shadow-2xs">
                    <div className="px-1">
                        <span className="text-[10px] uppercase font-bold text-muted-hub block tracking-wider">Finaliz.</span>
                        <span className="font-brand text-xs font-black text-primary-hub tabular-nums mt-0.5 block">
                            {latestEval?.Atendimentos_Finalizados ?? latestEval?.finalizados ?? '—'}
                        </span>
                    </div>
                    <div className="px-1">
                        <span className="text-[10px] uppercase font-bold text-muted-hub block tracking-wider">Voz</span>
                        <span className="font-brand text-xs font-black text-primary-hub tabular-nums mt-0.5 block">
                            {latestEval?.Ligacoes_Atendidas ?? latestEval?.ligAtendidas ?? '—'}
                        </span>
                    </div>
                    <div className="px-1">
                        <span className="text-[10px] uppercase font-bold text-muted-hub block tracking-wider">Chat</span>
                        <span className="font-brand text-xs font-black text-primary-hub tabular-nums mt-0.5 block">
                            {latestEval ? getHuggyStats(latestEval).volume : '—'}
                        </span>
                    </div>
                </div>

                {/* Pontuação & Data */}
                <div className="mt-3 flex items-center justify-between text-xs pt-2">
                    <span className="text-[11px] text-muted-hub flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted-hub" />
                        {latestEval?.date || 'Sem avaliação'}
                    </span>

                    {score !== null ? (
                        <Badge 
                            variant={score >= 0 ? "success" : "danger"} 
                            size="md"
                            icon={Sparkles}
                            className="font-bold tabular-nums"
                        >
                            {score} pts
                        </Badge>
                    ) : (
                        <span className="text-[11px] text-muted-hub">—</span>
                    )}
                </div>
            </div>

            {/* Barra de Ações Rápidas Ultra-Moderna */}
            <div className="p-2 bg-subtle/40 border-t border-subtle grid grid-cols-4 gap-1.5">
                <button
                    onClick={onEdit}
                    disabled={!isEditable}
                    className="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-secondary-hub hover:text-primary-hub hover:bg-surface border border-transparent hover:border-subtle transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Editar Informações"
                >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-bold mt-0.5">Editar</span>
                </button>

                <button
                    onClick={onReport}
                    className="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                    title="Ver Relatório de Desempenho"
                >
                    <FileText className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-bold mt-0.5">Relatório</span>
                </button>

                <button
                    onClick={onFeedback}
                    disabled={!isEditable}
                    className="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Registrar Feedback"
                >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-bold mt-0.5">Feedback</span>
                </button>

                <button
                    onClick={onToggleActive}
                    disabled={!isEditable}
                    className={cn(
                        "flex flex-col items-center justify-center py-1.5 px-1 rounded-lg border border-transparent transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                        isActive 
                            ? "text-muted-hub hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/20" 
                            : "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 hover:border-emerald-500/20"
                    )}
                    title={isActive ? "Inativar Colaborador" : "Ativar Colaborador"}
                >
                    {isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    <span className="text-[9px] font-bold mt-0.5">{isActive ? "Inativar" : "Ativar"}</span>
                </button>
            </div>
        </MagicCard>
    );
};

// =========================================================================
// COMPONENTE 2: VISUALIZAÇÃO EM TABELA ENTERPRISE
// =========================================================================
const CollaboratorTableView = ({ collaborators, latestEvalMap, isEditable, onEdit, onFeedback, onReport, onToggleActive }) => {
    return (
        <div className="bg-surface rounded-2xl border border-subtle shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-subtle/80 border-b border-subtle">
                        <tr className="text-secondary-hub text-[11px] uppercase tracking-wider font-bold">
                            <th className="py-3.5 px-4">Colaborador</th>
                            <th className="py-3.5 px-4">Cargo (RBAC)</th>
                            <th className="py-3.5 px-4">Turno</th>
                            <th className="py-3.5 px-4">Status</th>
                            <th className="py-3.5 px-4">Última Avaliação</th>
                            <th className="py-3.5 px-4">Pontuação</th>
                            <th className="py-3.5 px-4 text-right">Ações Rápidas</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle text-xs">
                        {collaborators.map(colab => {
                            const evalData = latestEvalMap[colab.id];
                            const score = evalData ? calcularPontuacao(evalData) : null;
                            const roleMeta = getRoleMeta(colab.role);
                            const isActive = colab.active !== false;

                            return (
                                <tr key={colab.id} className="hover:bg-subtle/50 transition-colors">
                                    {/* Nome + Avatar + Email */}
                                    <td className="py-3.5 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-9 h-9 rounded-xl flex items-center justify-center font-brand font-black text-xs text-white shrink-0 overflow-hidden shadow-2xs",
                                                isActive ? "bg-zinc-950 ring-1 ring-subtle" : "bg-zinc-600"
                                            )}>
                                                {(colab.photoUrl || colab.photoURL) ? (
                                                    <img src={colab.photoUrl || colab.photoURL} alt={colab.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    colab.name?.charAt(0)?.toUpperCase() || '?'
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-brand font-bold text-primary-hub truncate max-w-[200px]" title={colab.name}>
                                                    {colab.name}
                                                </div>
                                                <div className="text-[11px] text-muted-hub truncate max-w-[200px]" title={colab.email}>
                                                    {colab.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Cargo */}
                                    <td className="py-3.5 px-4">
                                        <Badge variant="outline" size="sm" className="font-semibold">
                                            {roleMeta.label || getRoleLabel(colab.role)}
                                        </Badge>
                                    </td>

                                    {/* Turno */}
                                    <td className="py-3.5 px-4">
                                        {(() => {
                                            const shiftStyle = getShiftBadgeStyle(colab.shift);
                                            const ShiftIcon = shiftStyle.icon;
                                            return (
                                                <Badge 
                                                    variant="neutral" 
                                                    size="sm" 
                                                    icon={ShiftIcon}
                                                    className={shiftStyle.badgeClass}
                                                >
                                                    {shiftStyle.label}
                                                </Badge>
                                            );
                                        })()}
                                    </td>

                                    {/* Status */}
                                    <td className="py-3.5 px-4">
                                        <Badge variant={isActive ? "success" : "neutral"} size="sm" dot>
                                            {isActive ? 'Ativo' : 'Inativo'}
                                        </Badge>
                                    </td>

                                    {/* Data */}
                                    <td className="py-3.5 px-4 text-secondary-hub font-medium">
                                        {evalData?.date || <span className="text-muted-hub">Sem registro</span>}
                                    </td>

                                    {/* Pontuação */}
                                    <td className="py-3.5 px-4">
                                        {score !== null ? (
                                            <Badge 
                                                variant={score >= 0 ? "success" : "danger"} 
                                                size="sm"
                                                icon={Sparkles}
                                                className="font-bold tabular-nums"
                                            >
                                                {score} pts
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-hub font-medium">—</span>
                                        )}
                                    </td>

                                    {/* Ações */}
                                    <td className="py-3.5 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => onReport(colab)}
                                                className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                                title="Relatório"
                                            >
                                                <FileText className="w-4 h-4" />
                                            </button>

                                            {isEditable && (
                                                <>
                                                    <button
                                                        onClick={() => onFeedback(colab)}
                                                        className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                                                        title="Feedback"
                                                    >
                                                        <MessageSquare className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => onEdit(colab)}
                                                        className="p-1.5 text-secondary-hub hover:bg-subtle rounded-lg transition-colors cursor-pointer"
                                                        title="Editar"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => onToggleActive(colab)}
                                                        className={cn(
                                                            "p-1.5 rounded-lg transition-colors cursor-pointer",
                                                            isActive ? "text-muted-hub hover:text-red-500 hover:bg-red-500/10" : "text-emerald-500 hover:bg-emerald-500/10"
                                                        )}
                                                        title={isActive ? 'Inativar' : 'Ativar'}
                                                    >
                                                        {isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// =========================================================================
// COMPONENTE 3: VISUALIZAÇÃO EM DIRETÓRIO COMPACTO
// =========================================================================
const CollaboratorCompactRow = ({ colab, latestEval, isEditable, onEdit, onFeedback, onReport, onToggleActive }) => {
    const score = latestEval ? calcularPontuacao(latestEval) : null;
    const roleMeta = getRoleMeta(colab.role);
    const isActive = colab.active !== false;

    return (
        <div className={cn(
            "bg-surface p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all shadow-2xs hover:border-subtle hover:shadow-xs",
            isActive ? "border-subtle" : "border-subtle opacity-65 bg-subtle/40"
        )}>
            {/* Informações básicas */}
            <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center font-brand font-black text-xs text-white shrink-0 overflow-hidden shadow-2xs",
                    isActive ? "bg-zinc-950 ring-1 ring-subtle" : "bg-zinc-600"
                )}>
                    {(colab.photoUrl || colab.photoURL) ? (
                        <img src={colab.photoUrl || colab.photoURL} alt={colab.name} className="w-full h-full object-cover" />
                    ) : (
                        colab.name?.charAt(0)?.toUpperCase() || '?'
                    )}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-brand font-bold text-xs text-primary-hub truncate" title={colab.name}>{colab.name}</h4>
                        <Badge variant="outline" size="sm">
                            {roleMeta.label || getRoleLabel(colab.role)}
                        </Badge>
                        {(() => {
                            const shiftStyle = getShiftBadgeStyle(colab.shift);
                            const ShiftIcon = shiftStyle.icon;
                            return (
                                <Badge 
                                    variant="neutral" 
                                    size="sm" 
                                    icon={ShiftIcon}
                                    className={shiftStyle.badgeClass}
                                >
                                    {shiftStyle.label}
                                </Badge>
                            );
                        })()}
                        {!isActive && (
                            <Badge variant="danger" size="sm">
                                Inativo
                            </Badge>
                        )}
                    </div>
                    <p className="text-[11px] text-muted-hub truncate mt-0.5">{colab.email}</p>
                </div>
            </div>

            {/* Score + Ações Rápidas */}
            <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-subtle">
                <div className="text-left sm:text-right">
                    <span className="text-[10px] text-muted-hub block font-medium">Último Score</span>
                    {score !== null ? (
                        <span className={cn(
                            "font-brand font-black text-xs tabular-nums",
                            score < 0 ? "text-rose-500" : "text-emerald-500"
                        )}>
                            {score} pts
                        </span>
                    ) : (
                        <span className="text-[11px] text-muted-hub">—</span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={onReport}
                        className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                        title="Relatório"
                    >
                        <FileText className="w-4 h-4" />
                        <span className="hidden md:inline text-[11px]">Relatório</span>
                    </button>

                    {isEditable && (
                        <>
                            <button
                                onClick={onFeedback}
                                className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                                title="Feedback"
                            >
                                <MessageSquare className="w-4 h-4" />
                                <span className="hidden md:inline text-[11px]">Feedback</span>
                            </button>
                            <button
                                onClick={onEdit}
                                className="p-1.5 text-secondary-hub hover:bg-subtle rounded-lg transition-colors cursor-pointer"
                                title="Editar"
                            >
                                <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={onToggleActive}
                                className={cn(
                                    "p-1.5 rounded-lg transition-colors cursor-pointer",
                                    isActive ? "text-muted-hub hover:text-red-500 hover:bg-red-500/10" : "text-emerald-500 hover:bg-emerald-500/10"
                                )}
                                title={isActive ? 'Inativar' : 'Ativar'}
                            >
                                {isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// =========================================================================
// COMPONENTE 4: VISUALIZAÇÃO AGRUPADA (POR TURNO OU POR CARGO)
// =========================================================================
const CollaboratorGroupedView = ({ collaborators, groupBy, latestEvalMap, isEditable, onEdit, onFeedback, onReport, onToggleActive }) => {
    // Monta grupos
    const groups = useMemo(() => {
        const map = {};
        if (groupBy === 'shift') {
            ['Manhã I', 'Manhã II', 'Tarde', 'Noturno', 'Outros'].forEach(k => { map[k] = []; });
            collaborators.forEach(c => {
                const s = String(c.shift || '').trim();
                const sLower = s.toLowerCase();
                let groupKey = 'Outros';
                if (s === 'Manhã I' || (sLower.includes('manh') && (sLower.includes('i') || sLower.includes('1')) && !sLower.includes('ii') && !sLower.includes('2')) || s === 'Manhã') {
                    groupKey = 'Manhã I';
                } else if (s === 'Manhã II' || (sLower.includes('manh') && (sLower.includes('ii') || sLower.includes('2')))) {
                    groupKey = 'Manhã II';
                } else if (s === 'Tarde' || sLower.includes('tard')) {
                    groupKey = 'Tarde';
                } else if (s === 'Noturno' || s === 'Noite' || sLower.includes('noturn') || sLower.includes('noit')) {
                    groupKey = 'Noturno';
                }
                map[groupKey].push(c);
            });
        } else {
            // por role
            ['gestor', 'supervisor', 'apoio', 'colaborador'].forEach(r => { map[r] = []; });
            collaborators.forEach(c => {
                const r = normalizeRole(c.role);
                if (!map[r]) map[r] = [];
                map[r].push(c);
            });
        }
        return map;
    }, [collaborators, groupBy]);

    return (
        <div className="space-y-6">
            {Object.entries(groups).map(([groupKey, groupColabs]) => {
                if (groupColabs.length === 0) return null;

                const roleMeta = groupBy === 'role' ? ROLES.find(r => r.id === groupKey) : null;
                const shiftStyle = groupBy === 'shift' ? getShiftBadgeStyle(groupKey) : null;
                const groupTitle = groupBy === 'shift' ? `Turno ${groupKey}` : (roleMeta?.label || groupKey);
                const activeInGroup = groupColabs.filter(c => c.active !== false).length;

                return (
                    <div key={groupKey} className="bg-surface rounded-2xl border border-subtle p-5 shadow-xs">
                        {/* Header do Grupo */}
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-subtle">
                            <div className="flex items-center gap-2.5">
                                {groupBy === 'shift' ? (() => {
                                    const ShiftIcon = shiftStyle.icon;
                                    return (
                                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border", shiftStyle.badgeClass)}>
                                            <ShiftIcon className={cn("w-4 h-4", shiftStyle.iconClass)} />
                                        </div>
                                    );
                                })() : (
                                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", roleMeta?.badgeColor || 'bg-subtle')}>
                                        <Shield className="w-4 h-4 text-primary-hub" />
                                    </div>
                                )}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-brand font-bold text-base text-primary-hub">{groupTitle}</h3>
                                        {groupBy === 'shift' && shiftStyle && shiftStyle.hours !== '--' && (
                                            <span className="text-[10px] font-semibold text-secondary-hub bg-subtle px-2 py-0.5 rounded-full border border-subtle">
                                                {shiftStyle.hours}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[11px] text-muted-hub">
                                        {activeInGroup} ativos de {groupColabs.length} membros
                                    </span>
                                </div>
                            </div>
                            <Badge variant="neutral" size="sm">
                                {groupColabs.length} {groupColabs.length === 1 ? 'membro' : 'membros'}
                            </Badge>
                        </div>

                        {/* Cards do grupo */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {groupColabs.map(colab => (
                                <CollaboratorModernCard
                                    key={colab.id}
                                    colab={colab}
                                    latestEval={latestEvalMap[colab.id]}
                                    isEditable={isEditable}
                                    onEdit={() => onEdit(colab)}
                                    onFeedback={() => onFeedback(colab)}
                                    onReport={() => onReport(colab)}
                                    onToggleActive={() => onToggleActive(colab)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default CollaboratorsHub;
