import React, { useState, useEffect, useMemo } from 'react';
import { 
    Users, UserPlus, Edit3, FileText, MessageSquare, 
    X, Loader2, Calendar, Phone, PhoneMissed, 
    CheckCircle, Clock, Filter, KeyRound, UserX, UserCheck, 
    Search, Shield, Eye, LayoutGrid, List, Table, Layers, 
    Sun, Sunset, Moon, ArrowUpDown, ChevronDown, ChevronRight, 
    Award, TrendingUp, Sparkles, AlertCircle, Check, Mail, MoreVertical
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNotification } from '../context/NotificationContext';
import { usePermissions } from '../context/PermissionsContext';
import { ROLES, normalizeRole } from '../services/rbac';

// Sub-componentes modais modernos
import CreateCollaboratorModal from '../components/collaborators/CreateCollaboratorModal';
import EditCollaboratorModal from '../components/collaborators/EditCollaboratorModal';
import FeedbackModal from '../components/collaborators/FeedbackModal';
import ReportDashboardModal from '../components/collaborators/ReportDashboardModal';

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
    const ptsFinalizados = (Number(metrics.finalizados) || Number(metrics.Atendimentos_Finalizados) || 0) * 1;
    const ptsLigacoes = (Number(metrics.ligAtendidas) || Number(metrics.Ligacoes_Atendidas) || 0) * 2;
    const ptsHuggy = (Number(metrics.huggyVol) || Number(metrics.Atendimentos_Huggy) || 0) * 1;
    const ptsPerdidas = (Number(metrics.ligPerdidas) || Number(metrics.Ligacoes_Perdidas) || 0) * -5;
    return ptsFinalizados + ptsLigacoes + ptsHuggy + ptsPerdidas;
};

const getRoleMeta = (roleString) => {
    const key = normalizeRole(roleString);
    const found = ROLES.find(r => r.id === key);
    if (found) return found;
    return {
        id: 'colaborador',
        label: roleString || 'Colaborador',
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
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
    const [sortBy, setSortBy] = useState('name_asc'); // 'name_asc', 'name_desc', 'score_desc', 'score_asc'

    // --- CONEXÃO COM FIRESTORE ---
    useEffect(() => {
        const q = query(collection(db, "collaborators"), orderBy("name", "asc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const docs = [];
            querySnapshot.forEach((d) => {
                docs.push({ id: d.id, ...d.data() });
            });
            setCollaborators(docs);
            setLoading(false);
        }, (error) => {
            showToast("Erro ao carregar colaboradores: " + error.message, "error");
            setLoading(false);
        });

        const qEvals = query(collection(db, "weekly_evaluations"));
        const unsubEvals = onSnapshot(qEvals, (snapshot) => {
            const evals = [];
            snapshot.forEach((d) => {
                evals.push({ id: d.id, ...d.data() });
            });
            setEvaluations(evals);
        });

        return () => {
            unsubscribe();
            unsubEvals();
        };
    }, [showToast]);

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

    // Estatísticas gerais
    const { totalCount, activeCount, inactiveCount, manhaCount, tardeCount, noiteCount } = useMemo(() => {
        const total = collaborators.length;
        const active = collaborators.filter(c => c.active !== false);
        const inactive = total - active.length;
        const manha = active.filter(c => c.shift === 'Manhã').length;
        const tarde = active.filter(c => c.shift === 'Tarde').length;
        const noite = active.filter(c => c.shift === 'Noite').length;
        return {
            totalCount: total,
            activeCount: active.length,
            inactiveCount: inactive,
            manhaCount: manha,
            tardeCount: tarde,
            noiteCount: noite
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

            const matchesShift = shiftFilter ? colab.shift === shiftFilter : true;
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

    const hasActiveFilters = searchTerm || shiftFilter || roleFilter || statusFilter !== 'all';

    const clearFilters = () => {
        setSearchTerm('');
        setShiftFilter('');
        setRoleFilter('');
        setStatusFilter('all');
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
        <div className="flex-1 p-6 bg-gray-50 h-full overflow-y-auto">
            {/* CABEÇALHO EXECUTIVO */}
            <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-red-600 uppercase tracking-wider">
                        <Users className="w-3.5 h-3.5" />
                        <span>Gestão de Pessoas & Operação</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Hub da Equipe</h1>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Central de colaboradores, acompanhamento de turnos, perfis de acesso e registros individuais.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {isEditable ? (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer hover:shadow"
                        >
                            <UserPlus className="w-4 h-4" />
                            <span>Novo Colaborador</span>
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs font-medium shadow-2xs">
                            <Eye className="w-4 h-4 text-blue-500" />
                            <span>Modo Leitura ({activeRoleInfo?.label || normalizedRole})</span>
                        </div>
                    )}
                </div>
            </header>

            {/* CARDS DE RESUMO & PAINEL DE TURNOS */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                {/* Métricas rápidas */}
                <div className="lg:col-span-1 grid grid-cols-2 gap-3">
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Ativos</span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl font-black text-gray-900">{activeCount}</span>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                {totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0}%
                            </span>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-1">De {totalCount} ({inactiveCount} inat.)</span>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Média Score</span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className={`text-2xl font-black ${avgActiveScore !== null && avgActiveScore >= 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                                {avgActiveScore !== null ? avgActiveScore : '—'}
                            </span>
                            {avgActiveScore !== null && <span className="text-xs font-bold text-gray-400">pts</span>}
                        </div>
                        <span className="text-[10px] text-gray-400 mt-1">Última avaliação</span>
                    </div>
                </div>

                {/* Distribuição por Turno */}
                <div className="lg:col-span-3 bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Sun className="w-4 h-4 text-amber-500" />
                            <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Distribuição por Turno (Equipe Ativa)</h2>
                        </div>
                        <span className="text-[11px] font-semibold text-gray-500">
                            Total Ativo: <strong className="text-gray-900">{activeCount}</strong>
                        </span>
                    </div>

                    {/* Barra de progresso multi-cor */}
                    <div className="w-full h-3.5 bg-gray-100 rounded-full overflow-hidden flex my-2 border border-gray-100">
                        <div 
                            style={{ width: `${getPercent(manhaCount)}%` }} 
                            className="bg-amber-400 transition-all duration-500 hover:brightness-105" 
                            title={`Manhã: ${manhaCount} (${getPercent(manhaCount).toFixed(0)}%)`}
                        />
                        <div 
                            style={{ width: `${getPercent(tardeCount)}%` }} 
                            className="bg-orange-500 transition-all duration-500 hover:brightness-105" 
                            title={`Tarde: ${tardeCount} (${getPercent(tardeCount).toFixed(0)}%)`}
                        />
                        <div 
                            style={{ width: `${getPercent(noiteCount)}%` }} 
                            className="bg-zinc-900 transition-all duration-500 hover:brightness-125" 
                            title={`Noite: ${noiteCount} (${getPercent(noiteCount).toFixed(0)}%)`}
                        />
                    </div>

                    {/* Legenda clicável para filtrar */}
                    <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                        <button
                            type="button"
                            onClick={() => setShiftFilter(shiftFilter === 'Manhã' ? '' : 'Manhã')}
                            className={`p-1.5 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer ${
                                shiftFilter === 'Manhã' ? 'border-amber-400 bg-amber-50/70' : 'border-gray-100 hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                                <span className="font-semibold text-gray-700">Manhã</span>
                            </div>
                            <span className="font-bold text-gray-900">{manhaCount} <span className="text-gray-400 font-normal text-[10px]">({getPercent(manhaCount).toFixed(0)}%)</span></span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setShiftFilter(shiftFilter === 'Tarde' ? '' : 'Tarde')}
                            className={`p-1.5 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer ${
                                shiftFilter === 'Tarde' ? 'border-orange-400 bg-orange-50/70' : 'border-gray-100 hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                                <span className="font-semibold text-gray-700">Tarde</span>
                            </div>
                            <span className="font-bold text-gray-900">{tardeCount} <span className="text-gray-400 font-normal text-[10px]">({getPercent(tardeCount).toFixed(0)}%)</span></span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setShiftFilter(shiftFilter === 'Noite' ? '' : 'Noite')}
                            className={`p-1.5 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer ${
                                shiftFilter === 'Noite' ? 'border-zinc-800 bg-zinc-100' : 'border-gray-100 hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-zinc-900 shrink-0" />
                                <span className="font-semibold text-gray-700">Noite</span>
                            </div>
                            <span className="font-bold text-gray-900">{noiteCount} <span className="text-gray-400 font-normal text-[10px]">({getPercent(noiteCount).toFixed(0)}%)</span></span>
                        </button>
                    </div>
                </div>
            </div>

            {/* BARRA DE CONTROLE: PESQUISA, FILTROS, ORDENAÇÃO E MODOS DE VISUALIZAÇÃO */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs mb-6 space-y-3">
                <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
                    {/* Campo de Pesquisa */}
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, e-mail, cargo ou turno..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-9 py-2 bg-gray-50/60 border border-gray-300 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-all text-xs"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 p-0.5"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filtros Dropdowns */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Filtro Turno */}
                        <select 
                            value={shiftFilter} 
                            onChange={e => setShiftFilter(e.target.value)}
                            className="py-2 px-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600 text-xs bg-white text-gray-700 font-medium cursor-pointer"
                        >
                            <option value="">Todos os Turnos</option>
                            <option value="Manhã">Manhã</option>
                            <option value="Tarde">Tarde</option>
                            <option value="Noite">Noite</option>
                        </select>

                        {/* Filtro Cargo */}
                        <select 
                            value={roleFilter} 
                            onChange={e => setRoleFilter(e.target.value)}
                            className="py-2 px-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600 text-xs bg-white text-gray-700 font-medium cursor-pointer"
                        >
                            <option value="">Todos os Cargos</option>
                            <option value="Gestor">Gestor</option>
                            <option value="Supervisor">Supervisor</option>
                            <option value="Apoio">Apoio</option>
                            <option value="Colaborador">Colaborador</option>
                        </select>

                        {/* Filtro Status */}
                        <select 
                            value={statusFilter} 
                            onChange={e => setStatusFilter(e.target.value)}
                            className="py-2 px-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600 text-xs bg-white text-gray-700 font-medium cursor-pointer"
                        >
                            <option value="all">Status: Todos</option>
                            <option value="active">Apenas Ativos</option>
                            <option value="inactive">Apenas Inativos</option>
                        </select>

                        {/* Ordenação */}
                        <select 
                            value={sortBy} 
                            onChange={e => setSortBy(e.target.value)}
                            className="py-2 px-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-red-600 text-xs bg-white text-gray-700 font-medium cursor-pointer"
                        >
                            <option value="name_asc">Nome (A → Z)</option>
                            <option value="name_desc">Nome (Z → A)</option>
                            <option value="score_desc">Maior Pontuação</option>
                            <option value="score_asc">Menor Pontuação</option>
                        </select>
                    </div>

                    {/* SELETOR DE MODOS DE VISUALIZAÇÃO (O GRANDE DESTAQUE) */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 self-start xl:self-auto shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                viewMode === 'grid' 
                                    ? 'bg-white text-red-600 shadow-xs' 
                                    : 'text-gray-500 hover:text-gray-800'
                            }`}
                            title="Visualização em Grade de Cards"
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            <span>Grade</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                viewMode === 'table' 
                                    ? 'bg-white text-red-600 shadow-xs' 
                                    : 'text-gray-500 hover:text-gray-800'
                            }`}
                            title="Visualização em Tabela Detalhada"
                        >
                            <Table className="w-3.5 h-3.5" />
                            <span>Tabela</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setViewMode('compact')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                viewMode === 'compact' 
                                    ? 'bg-white text-red-600 shadow-xs' 
                                    : 'text-gray-500 hover:text-gray-800'
                            }`}
                            title="Visualização em Diretório Compacto"
                        >
                            <List className="w-3.5 h-3.5" />
                            <span>Diretório</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setViewMode('grouped')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                viewMode === 'grouped' 
                                    ? 'bg-white text-red-600 shadow-xs' 
                                    : 'text-gray-500 hover:text-gray-800'
                            }`}
                            title="Visualização Agrupada por Categoria"
                        >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Agrupado</span>
                        </button>
                    </div>
                </div>

                {/* Sub-barra com contadores e botão de limpar filtros */}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <span>Exibindo <strong className="text-gray-800">{filteredCollaborators.length}</strong> de {totalCount} colaboradores</span>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-red-600 hover:text-red-700 font-bold hover:underline ml-2 cursor-pointer"
                            >
                                Limpar filtros
                            </button>
                        )}
                    </div>

                    {viewMode === 'grouped' && (
                        <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-gray-600">Agrupar por:</span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setGroupBy('shift')}
                                    className={`px-2 py-0.5 rounded font-bold text-[11px] cursor-pointer ${
                                        groupBy === 'shift' ? 'bg-zinc-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    Turno
                                </button>
                                <button
                                    onClick={() => setGroupBy('role')}
                                    className={`px-2 py-0.5 rounded font-bold text-[11px] cursor-pointer ${
                                        groupBy === 'role' ? 'bg-zinc-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
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
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                    <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-gray-700">Nenhum colaborador encontrado</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                        Não encontramos nenhum membro com os filtros atuais. Tente ajustar o termo de busca ou limpar os filtros.
                    </p>
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        >
                            Limpar Filtros
                        </button>
                    )}
                </div>
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
// COMPONENTE 1: CARD MODERNO DA GRADE
// =========================================================================
const CollaboratorModernCard = ({ colab, latestEval, isEditable, onEdit, onFeedback, onReport, onToggleActive }) => {
    const score = latestEval ? calcularPontuacao(latestEval) : null;
    const roleMeta = getRoleMeta(colab.role);
    const isActive = colab.active !== false;

    return (
        <div className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-md ${
            isActive ? 'border-gray-200 hover:border-red-300' : 'border-gray-200 opacity-60 bg-gray-50/50'
        }`}>
            {/* Topo: Avatar, Nome, Status e Badges */}
            <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="relative">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-base select-none overflow-hidden shrink-0 ${
                            isActive ? 'bg-zinc-950 text-white shadow-xs' : 'bg-gray-400 text-white'
                        }`}>
                            {(colab.photoUrl || colab.photoURL) ? (
                                <img src={colab.photoUrl || colab.photoURL} alt={colab.name} className="w-full h-full object-cover" />
                            ) : (
                                colab.name?.charAt(0)?.toUpperCase() || '?'
                            )}
                        </div>
                        <span 
                            className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                isActive ? 'bg-emerald-500' : 'bg-gray-400'
                            }`}
                            title={isActive ? 'Ativo' : 'Inativo'}
                        />
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${roleMeta.badgeColor}`}>
                            {roleMeta.label || colab.role || 'Colaborador'}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            colab.shift === 'Manhã' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                            colab.shift === 'Tarde' ? 'bg-orange-50 text-orange-800 border-orange-200' :
                            'bg-zinc-100 text-zinc-800 border-zinc-200'
                        }`}>
                            {colab.shift === 'Manhã' ? <Sun className="w-2.5 h-2.5 text-amber-500" /> :
                             colab.shift === 'Tarde' ? <Sunset className="w-2.5 h-2.5 text-orange-500" /> :
                             <Moon className="w-2.5 h-2.5 text-zinc-700" />}
                            {colab.shift || 'Sem Turno'}
                        </span>
                    </div>
                </div>

                {/* Nome e E-mail */}
                <h3 className="font-bold text-sm text-gray-900 truncate leading-snug" title={colab.name}>
                    {colab.name}
                </h3>
                <p className="text-[11px] text-gray-500 truncate flex items-center gap-1 mt-0.5" title={colab.email}>
                    <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                    <span>{colab.email}</span>
                </p>

                {/* Métricas e Última Avaliação */}
                <div className="mt-3.5 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <div>
                        <span className="text-[10px] font-semibold text-gray-400 uppercase block">Última Avaliação</span>
                        <span className="font-medium text-gray-700 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            {latestEval?.date || 'Sem registro'}
                        </span>
                    </div>

                    <div className="text-right">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase block">Pontuação</span>
                        {score !== null ? (
                            <span className={`font-black text-xs px-2 py-0.5 rounded-md ${
                                score < 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                                {score} pts
                            </span>
                        ) : (
                            <span className="text-[11px] text-gray-400 font-medium">—</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Rodapé de Ações */}
            <div className="p-1.5 bg-gray-50 border-t border-gray-100 grid grid-cols-4 gap-1">
                {isEditable ? (
                    <button 
                        onClick={onEdit} 
                        className="flex flex-col items-center justify-center p-1.5 text-gray-600 hover:text-gray-950 hover:bg-white rounded-lg transition-all cursor-pointer"
                        title="Editar Informações"
                    >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-bold mt-0.5">Editar</span>
                    </button>
                ) : (
                    <div className="flex flex-col items-center justify-center p-1.5 text-gray-300 cursor-not-allowed">
                        <Edit3 className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-bold mt-0.5">Editar</span>
                    </div>
                )}

                <button 
                    onClick={onReport} 
                    className="flex flex-col items-center justify-center p-1.5 text-red-600 hover:text-red-700 hover:bg-white rounded-lg transition-all cursor-pointer"
                    title="Ver Relatório de Desempenho"
                >
                    <FileText className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-bold mt-0.5">Relatório</span>
                </button>

                {isEditable ? (
                    <button 
                        onClick={onFeedback} 
                        className="flex flex-col items-center justify-center p-1.5 text-amber-700 hover:text-amber-800 hover:bg-white rounded-lg transition-all cursor-pointer"
                        title="Registrar Feedback"
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-bold mt-0.5">Feedback</span>
                    </button>
                ) : (
                    <div className="flex flex-col items-center justify-center p-1.5 text-gray-300 cursor-not-allowed">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-bold mt-0.5">Feedback</span>
                    </div>
                )}

                {isEditable ? (
                    <button 
                        onClick={onToggleActive} 
                        className={`flex flex-col items-center justify-center p-1.5 ${
                            isActive ? 'text-gray-500 hover:text-red-600' : 'text-emerald-600 hover:text-emerald-700'
                        } hover:bg-white rounded-lg transition-all cursor-pointer`}
                        title={isActive ? 'Inativar Colaborador' : 'Ativar Colaborador'}
                    >
                        {isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        <span className="text-[9px] font-bold mt-0.5">{isActive ? 'Inativar' : 'Ativar'}</span>
                    </button>
                ) : (
                    <div className="flex flex-col items-center justify-center p-1.5 text-gray-300 cursor-not-allowed">
                        <UserX className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-bold mt-0.5">Status</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// =========================================================================
// COMPONENTE 2: VISUALIZAÇÃO EM TABELA ENTERPRISE
// =========================================================================
const CollaboratorTableView = ({ collaborators, latestEvalMap, isEditable, onEdit, onFeedback, onReport, onToggleActive }) => {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-zinc-950 text-white text-[11px] uppercase tracking-wider font-bold">
                            <th className="py-3 px-4">Colaborador</th>
                            <th className="py-3 px-4">Cargo (RBAC)</th>
                            <th className="py-3 px-4">Turno</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Última Avaliação</th>
                            <th className="py-3 px-4">Pontuação</th>
                            <th className="py-3 px-4 text-right">Ações Rápidas</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                        {collaborators.map(colab => {
                            const evalData = latestEvalMap[colab.id];
                            const score = evalData ? calcularPontuacao(evalData) : null;
                            const roleMeta = getRoleMeta(colab.role);
                            const isActive = colab.active !== false;

                            return (
                                <tr key={colab.id} className="hover:bg-gray-50/80 transition-colors">
                                    {/* Nome + Avatar + Email */}
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden ${
                                                isActive ? 'bg-zinc-900' : 'bg-gray-400'
                                            }`}>
                                                {(colab.photoUrl || colab.photoURL) ? (
                                                    <img src={colab.photoUrl || colab.photoURL} alt={colab.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    colab.name?.charAt(0)?.toUpperCase() || '?'
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-gray-900 truncate max-w-[200px]" title={colab.name}>
                                                    {colab.name}
                                                </div>
                                                <div className="text-[11px] text-gray-500 truncate max-w-[200px]" title={colab.email}>
                                                    {colab.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Cargo */}
                                    <td className="py-3 px-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${roleMeta.badgeColor}`}>
                                            {roleMeta.label}
                                        </span>
                                    </td>

                                    {/* Turno */}
                                    <td className="py-3 px-4">
                                        <span className="inline-flex items-center gap-1 text-gray-700 font-semibold text-xs">
                                            {colab.shift === 'Manhã' && <Sun className="w-3 h-3 text-amber-500" />}
                                            {colab.shift === 'Tarde' && <Sunset className="w-3 h-3 text-orange-500" />}
                                            {colab.shift === 'Noite' && <Moon className="w-3 h-3 text-zinc-700" />}
                                            {colab.shift || '—'}
                                        </span>
                                    </td>

                                    {/* Status */}
                                    <td className="py-3 px-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                            isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                            {isActive ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>

                                    {/* Data */}
                                    <td className="py-3 px-4 text-gray-600 font-medium">
                                        {evalData?.date || <span className="text-gray-400">Sem registro</span>}
                                    </td>

                                    {/* Pontuação */}
                                    <td className="py-3 px-4">
                                        {score !== null ? (
                                            <span className={`font-black text-xs px-2 py-0.5 rounded-md ${
                                                score < 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                                            }`}>
                                                {score} pts
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 font-medium">—</span>
                                        )}
                                    </td>

                                    {/* Ações */}
                                    <td className="py-3 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => onReport(colab)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                title="Relatório"
                                            >
                                                <FileText className="w-4 h-4" />
                                            </button>

                                            {isEditable && (
                                                <>
                                                    <button
                                                        onClick={() => onFeedback(colab)}
                                                        className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Feedback"
                                                    >
                                                        <MessageSquare className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => onEdit(colab)}
                                                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                                        title="Editar"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => onToggleActive(colab)}
                                                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                                            isActive ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'
                                                        }`}
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
        <div className={`bg-white p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:border-gray-300 shadow-2xs ${
            isActive ? 'border-gray-200' : 'border-gray-200 opacity-65 bg-gray-50'
        }`}>
            {/* Informações básicas */}
            <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0 overflow-hidden ${
                    isActive ? 'bg-zinc-950' : 'bg-gray-400'
                }`}>
                    {(colab.photoUrl || colab.photoURL) ? (
                        <img src={colab.photoUrl || colab.photoURL} alt={colab.name} className="w-full h-full object-cover" />
                    ) : (
                        colab.name?.charAt(0)?.toUpperCase() || '?'
                    )}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-xs text-gray-900 truncate" title={colab.name}>{colab.name}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.2 rounded border ${roleMeta.badgeColor}`}>
                            {roleMeta.label}
                        </span>
                        <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded flex items-center gap-1">
                            {colab.shift === 'Manhã' ? <Sun className="w-2.5 h-2.5 text-amber-500" /> :
                             colab.shift === 'Tarde' ? <Sunset className="w-2.5 h-2.5 text-orange-500" /> :
                             <Moon className="w-2.5 h-2.5 text-zinc-700" />}
                            {colab.shift || 'Sem Turno'}
                        </span>
                        {!isActive && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 bg-red-100 text-red-700 rounded">
                                Inativo
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">{colab.email}</p>
                </div>
            </div>

            {/* Score + Ações Rápidas */}
            <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                <div className="text-left sm:text-right">
                    <span className="text-[10px] text-gray-400 block font-medium">Último Score</span>
                    {score !== null ? (
                        <span className={`font-black text-xs ${score < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {score} pts
                        </span>
                    ) : (
                        <span className="text-[11px] text-gray-400">—</span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={onReport}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                        title="Relatório"
                    >
                        <FileText className="w-4 h-4" />
                        <span className="hidden md:inline text-[11px]">Relatório</span>
                    </button>

                    {isEditable && (
                        <>
                            <button
                                onClick={onFeedback}
                                className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                                title="Feedback"
                            >
                                <MessageSquare className="w-4 h-4" />
                                <span className="hidden md:inline text-[11px]">Feedback</span>
                            </button>
                            <button
                                onClick={onEdit}
                                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                title="Editar"
                            >
                                <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={onToggleActive}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    isActive ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
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
            ['Manhã', 'Tarde', 'Noite', 'Outros'].forEach(k => { map[k] = []; });
            collaborators.forEach(c => {
                const s = c.shift === 'Manhã' || c.shift === 'Tarde' || c.shift === 'Noite' ? c.shift : 'Outros';
                map[s].push(c);
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
                const groupTitle = groupBy === 'shift' ? `Turno ${groupKey}` : (roleMeta?.label || groupKey);
                const activeInGroup = groupColabs.filter(c => c.active !== false).length;

                return (
                    <div key={groupKey} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs">
                        {/* Header do Grupo */}
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                            <div className="flex items-center gap-2.5">
                                {groupBy === 'shift' ? (
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                        groupKey === 'Manhã' ? 'bg-amber-100 text-amber-800' :
                                        groupKey === 'Tarde' ? 'bg-orange-100 text-orange-800' : 'bg-zinc-900 text-white'
                                    }`}>
                                        {groupKey === 'Manhã' ? <Sun className="w-4 h-4" /> :
                                         groupKey === 'Tarde' ? <Sunset className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                                    </div>
                                ) : (
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${roleMeta?.badgeColor || 'bg-gray-100'}`}>
                                        <Shield className="w-4 h-4" />
                                    </div>
                                )}
                                <div>
                                    <h3 className="font-bold text-base text-gray-900">{groupTitle}</h3>
                                    <span className="text-[11px] text-gray-500">
                                        {activeInGroup} ativos de {groupColabs.length} membros
                                    </span>
                                </div>
                            </div>
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                                {groupColabs.length} {groupColabs.length === 1 ? 'membro' : 'membros'}
                            </span>
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
