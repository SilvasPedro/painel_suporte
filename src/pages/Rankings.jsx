import React, { useState, useEffect, useMemo } from 'react';
import { 
    Trophy, Medal, Star, CheckSquare, Phone, MessageSquare, 
    Calendar, Loader2, Award, Users, Search, X, 
    LayoutGrid, Table, BarChart3, Eye, Download, Sparkles,
    Flame, ChevronRight, ArrowUpRight, CheckCircle2, RotateCcw
} from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../services/firebase';

// --- FUNÇÕES DE CONVERSÃO DE TEMPO ---
const timeToSeconds = (timeStr) => {
    if (!timeStr || timeStr === '00:00:00' || timeStr === '--') return Infinity; 
    const parts = String(timeStr).split(':');
    if (parts.length !== 3) return Infinity;
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
};

const secondsToTime = (totalSeconds) => {
    if (totalSeconds === Infinity || isNaN(totalSeconds) || totalSeconds <= 0) return "--:--:--";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const parseDateObj = (dateStr) => {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
    return 0;
};

const getMonthYear = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
    return null;
};

const Rankings = () => {
    // Critério de Classificação
    const [activeTab, setActiveTab] = useState('pontuacao'); // 'pontuacao', 'finalizacoes', 'tma_tel', 'tma_huggy'
    
    // Modos de Visualização
    const [viewMode, setViewMode] = useState('podium'); // 'podium', 'table', 'bars', 'grid'

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [periodFilter, setPeriodFilter] = useState('all'); // 'all', 'month_MM/YYYY', 'week_DD/MM/YYYY'
    const [shiftFilter, setShiftFilter] = useState('all'); // 'all', 'Manhã', 'Tarde', 'Noite'
    const [tierFilter, setTierFilter] = useState('all'); // 'all', 'top3', 'top5', 'top10'
    
    // Modal de Detalhes do Colaborador
    const [selectedColab, setSelectedColab] = useState(null);

    const [evaluations, setEvaluations] = useState([]);
    const [collaboratorsMap, setCollaboratorsMap] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Busca Colaboradores (ativos)
        const unsubColabs = onSnapshot(collection(db, "collaborators"), (snap) => {
            const map = {};
            snap.forEach(d => {
                const data = d.data();
                if (data.active !== false) {
                    map[d.id] = { id: d.id, ...data };
                }
            });
            setCollaboratorsMap(map);
        });

        // Busca todas as avaliações semanais
        const unsubEvals = onSnapshot(query(collection(db, "weekly_evaluations")), (snap) => {
            const fetched = [];
            snap.forEach(d => fetched.push({ id: d.id, ...d.data() }));
            setEvaluations(fetched);
            setLoading(false);
        });

        return () => { unsubColabs(); unsubEvals(); };
    }, []);

    // Extrai as opções de filtros (Semanas e Meses)
    const filterOptions = useMemo(() => {
        const months = new Set();
        const weeks = new Set();
        
        evaluations.forEach(e => { 
            if (e.date) {
                weeks.add(e.date);
                const my = getMonthYear(e.date);
                if (my) months.add(my);
            } 
        });

        const sortedWeeks = Array.from(weeks).sort((a, b) => parseDateObj(b) - parseDateObj(a));
        const sortedMonths = Array.from(months).sort((a, b) => {
            const [m1, y1] = a.split('/');
            const [m2, y2] = b.split('/');
            return new Date(y2, m2 - 1, 1).getTime() - new Date(y1, m1 - 1, 1).getTime();
        });

        return { weeks: sortedWeeks, months: sortedMonths };
    }, [evaluations]);

    // Calcula e ordena o ranking agregando dados
    const rawRankingData = useMemo(() => {
        // Filtra as avaliações pelo período escolhido
        const filteredEvals = evaluations.filter(e => {
            if (periodFilter === 'all') return true;
            if (periodFilter.startsWith('month_')) {
                return getMonthYear(e.date) === periodFilter.replace('month_', '');
            }
            if (periodFilter.startsWith('week_')) {
                return e.date === periodFilter.replace('week_', '');
            }
            return true;
        });
        
        // Agrupador de resultados por colaborador
        const colabStats = {};

        filteredEvals.forEach(e => {
            const colabId = e.colabId || e.collaboratorId;
            const colabInfo = collaboratorsMap[colabId];
            
            if (!colabInfo) return;

            // Filtro de Turno
            if (shiftFilter !== 'all') {
                const shiftLower = String(colabInfo.shift || '').toLowerCase();
                const targetLower = shiftFilter.toLowerCase();
                if (!shiftLower.includes(targetLower)) return;
            }

            if (!colabStats[colabId]) {
                colabStats[colabId] = {
                    id: colabId,
                    name: colabInfo.name || 'Sem Nome',
                    shift: colabInfo.shift || 'Geral',
                    role: colabInfo.role || colabInfo.cargo || 'Analista',
                    pontuacao: 0,
                    finalizacoes: 0,
                    ligAtendidas: 0,
                    ligPerdidas: 0,
                    huggyAtendimentos: 0,
                    tmaTelSecTotal: 0,
                    tmaTelCount: 0,
                    tmaHuggySecTotal: 0,
                    tmaHuggyCount: 0,
                    weeklyRecords: []
                };
            }

            // Soma a Pontuação
            let pts = e.pontuacao;
            if (pts === undefined) {
                pts = (Number(e.Atendimentos_Finalizados || 0) * 1) + 
                      (Number(e.Ligacoes_Atendidas || 0) * 2) + 
                      (Number(e.Atendimentos_Huggy || 0) * 1) + 
                      (Number(e.Ligacoes_Perdidas || 0) * -5);
            }
            colabStats[colabId].pontuacao += pts;
            colabStats[colabId].finalizacoes += Number(e.Atendimentos_Finalizados) || 0;
            colabStats[colabId].ligAtendidas += Number(e.Ligacoes_Atendidas) || 0;
            colabStats[colabId].ligPerdidas += Number(e.Ligacoes_Perdidas) || 0;
            colabStats[colabId].huggyAtendimentos += Number(e.Atendimentos_Huggy) || 0;

            // TMA Telefonia
            const telSec = timeToSeconds(e.TMA_Telefonia);
            if (telSec !== Infinity && telSec > 0) {
                colabStats[colabId].tmaTelSecTotal += telSec;
                colabStats[colabId].tmaTelCount += 1;
            }

            // TMA Huggy
            const huggySec = timeToSeconds(e.TMA_Huggy);
            if (huggySec !== Infinity && huggySec > 0) {
                colabStats[colabId].tmaHuggySecTotal += huggySec;
                colabStats[colabId].tmaHuggyCount += 1;
            }

            // Salva o registro da semana para o modal de detalhe
            colabStats[colabId].weeklyRecords.push({
                date: e.date,
                pts,
                finalizados: Number(e.Atendimentos_Finalizados) || 0,
                ligAtendidas: Number(e.Ligacoes_Atendidas) || 0,
                ligPerdidas: Number(e.Ligacoes_Perdidas) || 0,
                huggy: Number(e.Atendimentos_Huggy) || 0,
                tmaTel: e.TMA_Telefonia || '--:--:--',
                tmaHuggy: e.TMA_Huggy || '--:--:--'
            });
        });

        // Consolida as médias e prepara array final
        let data = Object.values(colabStats).map(c => {
            const avgTelSec = c.tmaTelCount > 0 ? Math.round(c.tmaTelSecTotal / c.tmaTelCount) : Infinity;
            const avgHuggySec = c.tmaHuggyCount > 0 ? Math.round(c.tmaHuggySecTotal / c.tmaHuggyCount) : Infinity;

            return {
                ...c,
                tmaTelSec: avgTelSec,
                tmaTel: secondsToTime(avgTelSec),
                tmaHuggySec: avgHuggySec,
                tmaHuggy: secondsToTime(avgHuggySec)
            };
        });

        // Aplica a ordenação baseada no critério ativo
        if (activeTab === 'pontuacao') {
            data.sort((a, b) => b.pontuacao - a.pontuacao);
        } else if (activeTab === 'finalizacoes') {
            data.sort((a, b) => b.finalizacoes - a.finalizacoes);
        } else if (activeTab === 'tma_tel') {
            data.sort((a, b) => {
                if (a.tmaTelSec === Infinity && b.tmaTelSec === Infinity) return 0;
                if (a.tmaTelSec === Infinity) return 1;
                if (b.tmaTelSec === Infinity) return -1;
                return a.tmaTelSec - b.tmaTelSec;
            });
        } else if (activeTab === 'tma_huggy') {
            data.sort((a, b) => {
                if (a.tmaHuggySec === Infinity && b.tmaHuggySec === Infinity) return 0;
                if (a.tmaHuggySec === Infinity) return 1;
                if (b.tmaHuggySec === Infinity) return -1;
                return a.tmaHuggySec - b.tmaHuggySec;
            });
        }

        return data;
    }, [evaluations, collaboratorsMap, periodFilter, shiftFilter, activeTab]);

    // Aplica pesquisa por nome e filtro de tier (top 3, top 5, etc.)
    const finalRankingData = useMemo(() => {
        let list = rawRankingData;

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            list = list.filter(c => c.name.toLowerCase().includes(term));
        }

        if (tierFilter === 'top3') {
            list = list.slice(0, 3);
        } else if (tierFilter === 'top5') {
            list = list.slice(0, 5);
        } else if (tierFilter === 'top10') {
            list = list.slice(0, 10);
        }

        return list;
    }, [rawRankingData, searchTerm, tierFilter]);

    // Resumo de Métricas Gerais da Operação
    const summaryStats = useMemo(() => {
        if (rawRankingData.length === 0) return { totalPontos: 0, totalFinalizados: 0, mediaPontos: 0, totalColabs: 0 };
        const totalPontos = rawRankingData.reduce((acc, c) => acc + c.pontuacao, 0);
        const totalFinalizados = rawRankingData.reduce((acc, c) => acc + c.finalizacoes, 0);
        const mediaPontos = Math.round(totalPontos / rawRankingData.length);
        return {
            totalPontos,
            totalFinalizados,
            mediaPontos,
            totalColabs: rawRankingData.length
        };
    }, [rawRankingData]);

    // Maior valor para calcular barras proporcionais
    const maxScore = useMemo(() => {
        if (rawRankingData.length === 0) return 1;
        if (activeTab === 'pontuacao') return Math.max(...rawRankingData.map(c => c.pontuacao), 1);
        if (activeTab === 'finalizacoes') return Math.max(...rawRankingData.map(c => c.finalizacoes), 1);
        return 100;
    }, [rawRankingData, activeTab]);

    // Exportação em CSV
    const exportCSV = () => {
        const headers = ["Posição", "Nome", "Turno", "Pontuação", "Finalizações", "Ligações Atendidas", "Ligações Perdidas", "Huggy", "TMA Telefonia", "TMA Huggy"];
        const rows = finalRankingData.map((c, i) => [
            `${i + 1}º`,
            `"${c.name}"`,
            `"${c.shift}"`,
            c.pontuacao,
            c.finalizacoes,
            c.ligAtendidas,
            c.ligPerdidas,
            c.huggyAtendimentos,
            c.tmaTel,
            c.tmaHuggy
        ]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `ranking_equipe_${activeTab}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const hasActiveFilters = Boolean(searchTerm || shiftFilter !== 'all' || periodFilter !== 'all' || tierFilter !== 'all');

    const clearFilters = () => {
        setSearchTerm('');
        setShiftFilter('all');
        setPeriodFilter('all');
        setTierFilter('all');
    };

    // Componente de Badge de Medalha
    const renderMedal = (pos) => {
        if (pos === 0) {
            return (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-yellow-950 flex items-center justify-center font-black text-xs shadow-md border-2 border-white ring-2 ring-yellow-400/50 shrink-0">
                    <Trophy className="w-4 h-4 text-yellow-950" />
                </div>
            );
        }
        if (pos === 1) {
            return (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-400 to-slate-200 text-slate-900 flex items-center justify-center font-black text-xs shadow-md border-2 border-white ring-2 ring-slate-300 shrink-0">
                    <Medal className="w-4 h-4 text-slate-800" />
                </div>
            );
        }
        if (pos === 2) {
            return (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-700 to-amber-500 text-amber-50 flex items-center justify-center font-black text-xs shadow-md border-2 border-white ring-2 ring-amber-600/40 shrink-0">
                    <Award className="w-4 h-4 text-amber-100" />
                </div>
            );
        }
        return (
            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-xs border border-gray-200 shrink-0">
                {pos + 1}º
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 h-full p-8">
                <Loader2 className="w-10 h-10 text-red-600 animate-spin mb-3" />
                <p className="text-sm font-medium text-gray-600">Calculando indicadores e rankings da equipe...</p>
            </div>
        );
    }

    // Top 3 destacados
    const topThree = rawRankingData.slice(0, 3);
    const leader = topThree[0];
    const second = topThree[1];
    const third = topThree[2];

    return (
        <div className="flex-1 p-6 h-full overflow-y-auto bg-gray-50 flex flex-col space-y-6">
            
            {/* ========================================== */}
            {/* CABEÇALHO PRINCIPAL                        */}
            {/* ========================================== */}
            <header className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shrink-0">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-yellow-50 text-yellow-600 rounded-xl border border-yellow-200">
                            <Trophy className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                                    Rankings & Reconhecimento da Equipe
                                </h1>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200 flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 text-yellow-600" /> Gamificação
                                </span>
                            </div>
                            <p className="text-sm text-gray-500">
                                Classificação geral, volume de atendimentos e eficiência operacional por período.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button 
                        onClick={exportCSV}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-xl font-bold text-sm transition-all shadow-2xs cursor-pointer"
                        title="Exportar dados do ranking em CSV"
                    >
                        <Download className="w-4 h-4 text-gray-500" /> Exportar CSV
                    </button>
                </div>
            </header>

            {/* ========================================== */}
            {/* CARDS DE RESUMO OPERACIONAL                */}
            {/* ========================================== */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                <div className="p-4 rounded-xl border bg-white border-gray-200 shadow-2xs">
                    <span className="text-xs font-bold uppercase tracking-wider block text-gray-400">Analistas Ranqueados</span>
                    <div className="text-2xl font-black mt-1 text-gray-900 flex items-center justify-between">
                        <span>{summaryStats.totalColabs}</span>
                        <Users className="w-5 h-5 text-gray-300" />
                    </div>
                    <span className="text-[11px] text-gray-500 mt-0.5 block">Com avaliações no período</span>
                </div>

                <div className="p-4 rounded-xl border bg-white border-gray-200 shadow-2xs">
                    <span className="text-xs font-bold uppercase tracking-wider block text-amber-600">Total de Pontos</span>
                    <div className="text-2xl font-black mt-1 text-gray-900 flex items-center justify-between">
                        <span>{summaryStats.totalPontos.toLocaleString('pt-BR')}</span>
                        <Star className="w-5 h-5 text-amber-400" />
                    </div>
                    <span className="text-[11px] text-gray-500 mt-0.5 block">Média: {summaryStats.mediaPontos} pts / analista</span>
                </div>

                <div className="p-4 rounded-xl border bg-white border-gray-200 shadow-2xs">
                    <span className="text-xs font-bold uppercase tracking-wider block text-emerald-600">Finalizações</span>
                    <div className="text-2xl font-black mt-1 text-gray-900 flex items-center justify-between">
                        <span>{summaryStats.totalFinalizados.toLocaleString('pt-BR')}</span>
                        <CheckSquare className="w-5 h-5 text-emerald-400" />
                    </div>
                    <span className="text-[11px] text-gray-500 mt-0.5 block">Atendimentos concluídos</span>
                </div>

                <div className="p-4 rounded-xl border bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-white border-yellow-200/80 shadow-2xs">
                    <span className="text-xs font-bold uppercase tracking-wider block text-yellow-700">Líder Atual</span>
                    <div className="text-base font-black mt-1 text-gray-900 truncate">
                        {leader ? leader.name : 'Nenhum'}
                    </div>
                    <span className="text-[11px] font-bold text-yellow-800 mt-0.5 block">
                        {leader ? `${leader.pontuacao} pts • ${leader.shift}` : '--'}
                    </span>
                </div>
            </div>

            {/* ========================================== */}
            {/* BARRA DE FILTROS E MODOS DE VISUALIZAÇÃO   */}
            {/* ========================================== */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col gap-4 shrink-0">
                <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
                    
                    {/* Campo de Busca por Colaborador */}
                    <div className="flex-1 relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                        <input 
                            type="text" 
                            placeholder="Buscar por colaborador no ranking..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none text-sm transition-all bg-gray-50/50 focus:bg-white"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Modos de Visualização (Podium, Table, Bars, Grid) */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 shrink-0 self-start lg:self-auto">
                        <button 
                            onClick={() => setViewMode('podium')} 
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                viewMode === 'podium' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                            }`}
                            title="Visualização com Pódio"
                        >
                            <Trophy className="w-3.5 h-3.5 text-yellow-600" />
                            <span>Pódio & Lista</span>
                        </button>
                        <button 
                            onClick={() => setViewMode('table')} 
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                viewMode === 'table' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                            }`}
                            title="Tabela Executiva"
                        >
                            <Table className="w-3.5 h-3.5 text-red-600" />
                            <span>Tabela</span>
                        </button>
                        <button 
                            onClick={() => setViewMode('bars')} 
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                viewMode === 'bars' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                            }`}
                            title="Comparativo em Barras"
                        >
                            <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Comparativo</span>
                        </button>
                        <button 
                            onClick={() => setViewMode('grid')} 
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                viewMode === 'grid' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                            }`}
                            title="Grade de Cartões"
                        >
                            <LayoutGrid className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Cartões</span>
                        </button>
                    </div>
                </div>

                {/* Filtros Dropdowns */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Período</label>
                        <select 
                            value={periodFilter} 
                            onChange={(e) => setPeriodFilter(e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white focus:ring-2 focus:ring-red-600 outline-none cursor-pointer"
                        >
                            <option value="all">Total Agregado (Todo o período)</option>
                            {filterOptions.months.length > 0 && (
                                <optgroup label="Agrupado por Mês">
                                    {filterOptions.months.map(m => <option key={`month_${m}`} value={`month_${m}`}>Mês: {m}</option>)}
                                </optgroup>
                            )}
                            {filterOptions.weeks.length > 0 && (
                                <optgroup label="Semanas Específicas">
                                    {filterOptions.weeks.map(d => <option key={`week_${d}`} value={`week_${d}`}>Semana: {d}</option>)}
                                </optgroup>
                            )}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Turno</label>
                        <select 
                            value={shiftFilter} 
                            onChange={(e) => setShiftFilter(e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white focus:ring-2 focus:ring-red-600 outline-none cursor-pointer"
                        >
                            <option value="all">Todos os Turnos</option>
                            <option value="Manhã">Manhã</option>
                            <option value="Tarde">Tarde</option>
                            <option value="Noite">Noite</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Faixa de Posição</label>
                        <select 
                            value={tierFilter} 
                            onChange={(e) => setTierFilter(e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white focus:ring-2 focus:ring-red-600 outline-none cursor-pointer"
                        >
                            <option value="all">Todos os Colaboradores</option>
                            <option value="top3">Pódio (Top 3)</option>
                            <option value="top5">Top 5 Destaques</option>
                            <option value="top10">Top 10 Melhores</option>
                        </select>
                    </div>

                    <div className="flex items-end">
                        {hasActiveFilters ? (
                            <button 
                                onClick={clearFilters}
                                className="w-full px-3 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                                <RotateCcw className="w-3 h-3" /> Limpar Filtros
                            </button>
                        ) : (
                            <div className="text-[11px] text-gray-400 py-1.5 pl-1">
                                {finalRankingData.length} analistas exibidos
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ========================================== */}
            {/* SELETOR DE CRITÉRIO DE RANKING (TABS)      */}
            {/* ========================================== */}
            <div className="bg-white p-1.5 rounded-xl border border-gray-200 shadow-2xs shrink-0 flex flex-wrap gap-1.5">
                <button 
                    onClick={() => setActiveTab('pontuacao')} 
                    className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        activeTab === 'pontuacao' 
                            ? 'bg-amber-500 text-white shadow-xs' 
                            : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <Star className="w-4 h-4" /> Pontuação Ponderada
                </button>
                <button 
                    onClick={() => setActiveTab('finalizacoes')} 
                    className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        activeTab === 'finalizacoes' 
                            ? 'bg-emerald-600 text-white shadow-xs' 
                            : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <CheckSquare className="w-4 h-4" /> Volume de Finalizações
                </button>
                <button 
                    onClick={() => setActiveTab('tma_tel')} 
                    className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        activeTab === 'tma_tel' 
                            ? 'bg-blue-600 text-white shadow-xs' 
                            : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <Phone className="w-4 h-4" /> Eficiência TMA Voz
                </button>
                <button 
                    onClick={() => setActiveTab('tma_huggy')} 
                    className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        activeTab === 'tma_huggy' 
                            ? 'bg-purple-600 text-white shadow-xs' 
                            : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <MessageSquare className="w-4 h-4" /> Eficiência TMA Chat
                </button>
            </div>

            {/* ========================================== */}
            {/* CONTEÚDO PRINCIPAL DOS RANKINGS            */}
            {/* ========================================== */}
            {finalRankingData.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center flex flex-col items-center justify-center flex-1">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center mb-4 text-gray-400">
                        <Trophy className="w-8 h-8 opacity-40" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Nenhum registro encontrado</h3>
                    <p className="text-sm text-gray-500 max-w-md mt-1 mb-6">
                        {hasActiveFilters 
                            ? "Nenhum colaborador corresponde aos filtros selecionados. Tente ajustar os filtros ou redefini-los."
                            : "Ainda não há avaliações semanais lançadas no sistema."}
                    </p>
                    {hasActiveFilters && (
                        <button 
                            onClick={clearFilters}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-lg transition-colors cursor-pointer"
                        >
                            Redefinir Filtros
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* -------------------------------------- */}
                    {/* MODO 1: PÓDIO VISUAL + LISTA COMPLETA  */}
                    {/* -------------------------------------- */}
                    {viewMode === 'podium' && (
                        <div className="space-y-6 flex-1 flex flex-col">
                            
                            {/* PÓDIO DOS 3 PRIMEIROS */}
                            {topThree.length >= 2 && (
                                <div className="bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 p-6 rounded-2xl border border-zinc-800 text-white shadow-lg shrink-0">
                                    <div className="text-center mb-6">
                                        <span className="text-[11px] font-bold uppercase tracking-widest text-yellow-400 flex items-center justify-center gap-1.5">
                                            <Flame className="w-3.5 h-3.5 text-yellow-400" /> Pódio de Destaque
                                        </span>
                                        <h3 className="text-xl font-black text-white mt-1">
                                            Top Performers da Operação
                                        </h3>
                                    </div>

                                    <div className="flex items-end justify-center gap-3 sm:gap-6 max-w-3xl mx-auto pt-4">
                                        
                                        {/* 2º LUGAR (PRATA) */}
                                        {second && (
                                            <div 
                                                onClick={() => setSelectedColab(second)}
                                                className="flex-1 flex flex-col items-center cursor-pointer group"
                                            >
                                                <div className="relative mb-2">
                                                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-300 text-slate-900 font-black text-lg flex items-center justify-center border-4 border-slate-400/80 shadow-md group-hover:scale-105 transition-transform">
                                                        {second.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="absolute -bottom-2 -right-1 w-6 h-6 rounded-full bg-slate-400 text-slate-950 font-black text-[10px] flex items-center justify-center border border-white">
                                                        2º
                                                    </div>
                                                </div>
                                                <span className="font-bold text-xs sm:text-sm text-center line-clamp-1 max-w-[120px] text-zinc-100 group-hover:text-yellow-300 transition-colors">
                                                    {second.name}
                                                </span>
                                                <span className="text-[10px] text-zinc-400 font-medium">{second.shift}</span>
                                                
                                                <div className="w-full bg-zinc-800/90 border border-slate-400/40 rounded-t-xl mt-3 p-3 flex flex-col items-center justify-center h-28 shadow-inner">
                                                    <span className="text-xs sm:text-sm font-black text-slate-300">
                                                        {activeTab === 'pontuacao' && `${second.pontuacao} pts`}
                                                        {activeTab === 'finalizacoes' && `${second.finalizacoes} fin.`}
                                                        {activeTab === 'tma_tel' && second.tmaTel}
                                                        {activeTab === 'tma_huggy' && second.tmaHuggy}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-400 mt-1">Prata</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* 1º LUGAR (OURO) */}
                                        {leader && (
                                            <div 
                                                onClick={() => setSelectedColab(leader)}
                                                className="flex-1 flex flex-col items-center cursor-pointer group"
                                            >
                                                <div className="relative mb-2">
                                                    <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-yellow-500 to-amber-300 text-yellow-950 font-black text-2xl flex items-center justify-center border-4 border-yellow-300 shadow-xl group-hover:scale-105 transition-transform ring-4 ring-yellow-500/20">
                                                        {leader.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                                        <Trophy className="w-6 h-6 text-yellow-400 drop-shadow-md animate-bounce" />
                                                    </div>
                                                    <div className="absolute -bottom-2 -right-1 w-7 h-7 rounded-full bg-yellow-400 text-yellow-950 font-black text-xs flex items-center justify-center border-2 border-white">
                                                        1º
                                                    </div>
                                                </div>
                                                <span className="font-extrabold text-sm sm:text-base text-center line-clamp-1 max-w-[150px] text-yellow-300 group-hover:underline">
                                                    {leader.name}
                                                </span>
                                                <span className="text-xs text-zinc-300 font-bold">{leader.shift}</span>
                                                
                                                <div className="w-full bg-gradient-to-b from-yellow-500/20 to-zinc-800/90 border-t-2 border-yellow-400 rounded-t-xl mt-3 p-3 flex flex-col items-center justify-center h-36 shadow-lg">
                                                    <span className="text-base sm:text-xl font-black text-yellow-400">
                                                        {activeTab === 'pontuacao' && `${leader.pontuacao} pts`}
                                                        {activeTab === 'finalizacoes' && `${leader.finalizacoes} fin.`}
                                                        {activeTab === 'tma_tel' && leader.tmaTel}
                                                        {activeTab === 'tma_huggy' && leader.tmaHuggy}
                                                    </span>
                                                    <span className="text-[11px] font-bold text-yellow-200 mt-1 uppercase tracking-wider">Campeão</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* 3º LUGAR (BRONZE) */}
                                        {third && (
                                            <div 
                                                onClick={() => setSelectedColab(third)}
                                                className="flex-1 flex flex-col items-center cursor-pointer group"
                                            >
                                                <div className="relative mb-2">
                                                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-amber-700 text-amber-100 font-black text-lg flex items-center justify-center border-4 border-amber-600/80 shadow-md group-hover:scale-105 transition-transform">
                                                        {third.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="absolute -bottom-2 -right-1 w-6 h-6 rounded-full bg-amber-600 text-amber-50 font-black text-[10px] flex items-center justify-center border border-white">
                                                        3º
                                                    </div>
                                                </div>
                                                <span className="font-bold text-xs sm:text-sm text-center line-clamp-1 max-w-[120px] text-zinc-100 group-hover:text-yellow-300 transition-colors">
                                                    {third.name}
                                                </span>
                                                <span className="text-[10px] text-zinc-400 font-medium">{third.shift}</span>
                                                
                                                <div className="w-full bg-zinc-800/90 border border-amber-600/40 rounded-t-xl mt-3 p-3 flex flex-col items-center justify-center h-24 shadow-inner">
                                                    <span className="text-xs sm:text-sm font-black text-amber-400">
                                                        {activeTab === 'pontuacao' && `${third.pontuacao} pts`}
                                                        {activeTab === 'finalizacoes' && `${third.finalizacoes} fin.`}
                                                        {activeTab === 'tma_tel' && third.tmaTel}
                                                        {activeTab === 'tma_huggy' && third.tmaHuggy}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-400 mt-1">Bronze</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* LISTA COMPLETA DO RANKING */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                        <Award className="w-4 h-4 text-red-600" /> Classificação Completa da Equipe
                                    </h4>
                                    <span className="text-xs text-gray-400">
                                        Clique em qualquer linha para ver a ficha completa
                                    </span>
                                </div>

                                <div className="divide-y divide-gray-100">
                                    {finalRankingData.map((colab, index) => {
                                        const percent = maxScore > 0 ? Math.min(Math.round((colab.pontuacao / maxScore) * 100), 100) : 0;
                                        
                                        return (
                                            <div 
                                                key={colab.id}
                                                onClick={() => setSelectedColab(colab)}
                                                className="p-4 hover:bg-gray-50/80 transition-colors flex items-center justify-between gap-4 cursor-pointer group"
                                            >
                                                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                    {renderMedal(index)}
                                                    
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-sm text-gray-900 group-hover:text-red-600 transition-colors truncate">
                                                                {colab.name}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                                                {colab.shift}
                                                            </span>
                                                        </div>

                                                        {/* Barra de Proporção em relação ao líder */}
                                                        {activeTab === 'pontuacao' && (
                                                            <div className="w-full max-w-md bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                                                                <div 
                                                                    className={`h-full rounded-full ${
                                                                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-slate-400' : index === 2 ? 'bg-amber-600' : 'bg-red-500'
                                                                    }`}
                                                                    style={{ width: `${percent}%` }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-6 shrink-0">
                                                    <div className="text-right">
                                                        <span className="text-base font-black text-gray-900 block">
                                                            {activeTab === 'pontuacao' && `${colab.pontuacao} pts`}
                                                            {activeTab === 'finalizacoes' && `${colab.finalizacoes} finalizações`}
                                                            {activeTab === 'tma_tel' && colab.tmaTel}
                                                            {activeTab === 'tma_huggy' && colab.tmaHuggy}
                                                        </span>
                                                        <span className="text-[11px] text-gray-400">
                                                            {activeTab === 'pontuacao' ? `${colab.finalizacoes} finalizações` : `${colab.pontuacao} pts`}
                                                        </span>
                                                    </div>

                                                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-all" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* -------------------------------------- */}
                    {/* MODO 2: TABELA EXECUTIVA DETALHADA     */}
                    {/* -------------------------------------- */}
                    {viewMode === 'table' && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden flex-1 flex flex-col">
                            <div className="overflow-x-auto flex-1">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-zinc-950 text-white sticky top-0 z-10">
                                        <tr>
                                            <th className="px-5 py-3.5 text-center font-bold text-xs uppercase tracking-wider w-16">Pos</th>
                                            <th className="px-5 py-3.5 text-left font-bold text-xs uppercase tracking-wider">Colaborador</th>
                                            <th className="px-5 py-3.5 text-center font-bold text-xs uppercase tracking-wider">Turno</th>
                                            <th className="px-5 py-3.5 text-right font-bold text-xs uppercase tracking-wider">Pontuação</th>
                                            <th className="px-5 py-3.5 text-right font-bold text-xs uppercase tracking-wider">Finalizações</th>
                                            <th className="px-5 py-3.5 text-right font-bold text-xs uppercase tracking-wider">Ligações Atend.</th>
                                            <th className="px-5 py-3.5 text-right font-bold text-xs uppercase tracking-wider">TMA Voz</th>
                                            <th className="px-5 py-3.5 text-right font-bold text-xs uppercase tracking-wider">TMA Chat</th>
                                            <th className="px-5 py-3.5 text-center font-bold text-xs uppercase tracking-wider">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {finalRankingData.map((colab, index) => (
                                            <tr 
                                                key={colab.id} 
                                                onClick={() => setSelectedColab(colab)}
                                                className={`hover:bg-gray-50/80 transition-colors cursor-pointer ${
                                                    index === 0 ? 'bg-yellow-50/20' : index === 1 ? 'bg-slate-50/40' : index === 2 ? 'bg-amber-50/20' : ''
                                                }`}
                                            >
                                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                                    <div className="flex justify-center">
                                                        {renderMedal(index)}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center font-bold text-xs text-zinc-700">
                                                            {colab.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="font-bold text-gray-900 text-sm">
                                                            {colab.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                                    <span className="text-[11px] uppercase font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-0.5 rounded-md">
                                                        {colab.shift}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-right font-mono font-bold text-gray-900">
                                                    <span className={`px-2.5 py-1 rounded-lg text-xs ${
                                                        index === 0 ? 'bg-yellow-100 text-yellow-800 font-black' : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {colab.pontuacao} pts
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-right font-medium text-gray-700">
                                                    {colab.finalizacoes}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-right font-medium text-gray-700">
                                                    {colab.ligAtendidas}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-right font-mono text-xs font-bold text-blue-700">
                                                    {colab.tmaTel}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-right font-mono text-xs font-bold text-purple-700">
                                                    {colab.tmaHuggy}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setSelectedColab(colab); }}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Ver Ficha Completa"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* -------------------------------------- */}
                    {/* MODO 3: COMPARATIVO EM BARRAS          */}
                    {/* -------------------------------------- */}
                    {viewMode === 'bars' && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs space-y-4 flex-1">
                            <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900">Comparativo Visual de Desempenho</h4>
                                    <p className="text-xs text-gray-500">Proporção individual calculada em relação ao líder (100%)</p>
                                </div>
                                <span className="text-xs font-bold text-gray-400">
                                    Base: {activeTab === 'pontuacao' ? 'Pontuação' : 'Finalizações'}
                                </span>
                            </div>

                            <div className="space-y-4 pt-2">
                                {finalRankingData.map((colab, index) => {
                                    const value = activeTab === 'pontuacao' ? colab.pontuacao : colab.finalizacoes;
                                    const percent = maxScore > 0 ? Math.min(Math.round((value / maxScore) * 100), 100) : 0;

                                    return (
                                        <div 
                                            key={colab.id} 
                                            onClick={() => setSelectedColab(colab)}
                                            className="p-3 rounded-xl hover:bg-gray-50/80 transition-all border border-transparent hover:border-gray-200 cursor-pointer"
                                        >
                                            <div className="flex justify-between items-center mb-1.5 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-gray-400 w-6">{index + 1}º</span>
                                                    <span className="font-bold text-gray-900">{colab.name}</span>
                                                    <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-medium">
                                                        {colab.shift}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 font-mono font-bold">
                                                    <span className="text-gray-900">{value}</span>
                                                    <span className="text-gray-400 text-[10px]">({percent}%)</span>
                                                </div>
                                            </div>

                                            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-slate-400' : index === 2 ? 'bg-amber-600' : 'bg-red-500'
                                                    }`}
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* -------------------------------------- */}
                    {/* MODO 4: GRADE DE CARTÕES (BENTO GRID)  */}
                    {/* -------------------------------------- */}
                    {viewMode === 'grid' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1">
                            {finalRankingData.map((colab, index) => (
                                <div 
                                    key={colab.id}
                                    onClick={() => setSelectedColab(colab)}
                                    className={`bg-white rounded-xl border p-5 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                                        index === 0 ? 'border-yellow-300 ring-1 ring-yellow-400/30' : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            {renderMedal(index)}
                                            <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                                {colab.shift}
                                            </span>
                                        </div>

                                        <div>
                                            <h4 className="text-base font-bold text-gray-900 line-clamp-1">
                                                {colab.name}
                                            </h4>
                                            <span className="text-xs text-gray-400">
                                                {colab.role}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs">
                                            <div className="bg-gray-50 p-2 rounded-lg">
                                                <span className="text-[10px] text-gray-400 uppercase font-bold block">Pontos</span>
                                                <span className="font-bold text-gray-900 text-sm">{colab.pontuacao}</span>
                                            </div>
                                            <div className="bg-gray-50 p-2 rounded-lg">
                                                <span className="text-[10px] text-gray-400 uppercase font-bold block">Finalizados</span>
                                                <span className="font-bold text-emerald-700 text-sm">{colab.finalizacoes}</span>
                                            </div>
                                            <div className="bg-gray-50 p-2 rounded-lg">
                                                <span className="text-[10px] text-gray-400 uppercase font-bold block">TMA Voz</span>
                                                <span className="font-mono text-xs font-bold text-blue-700">{colab.tmaTel}</span>
                                            </div>
                                            <div className="bg-gray-50 p-2 rounded-lg">
                                                <span className="text-[10px] text-gray-400 uppercase font-bold block">TMA Chat</span>
                                                <span className="font-mono text-xs font-bold text-purple-700">{colab.tmaHuggy}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2 flex items-center justify-between text-xs text-red-600 font-bold group">
                                        <span>Ver Ficha Completa</span>
                                        <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ========================================================================= */}
            {/* MODAL DE FICHA DETALHADA DO COLABORADOR                                   */}
            {/* ========================================================================= */}
            {selectedColab && (
                <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[80] backdrop-blur-xs">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                        
                        {/* Header do Modal */}
                        <div className="p-5 bg-zinc-950 text-white flex justify-between items-center shrink-0 border-b border-zinc-800">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-yellow-500 text-yellow-950 font-black text-xl flex items-center justify-center shadow-sm">
                                    {selectedColab.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white leading-tight">
                                        {selectedColab.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-zinc-400">{selectedColab.role}</span>
                                        <span className="text-zinc-600">•</span>
                                        <span className="text-xs text-yellow-400 font-bold">Turno: {selectedColab.shift}</span>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={() => setSelectedColab(null)} 
                                className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Corpo do Modal com Indicadores e Histórico */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-gray-50">
                            
                            {/* Grid de Estatísticas Acumuladas */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
                                    Resumo do Período Selecionado
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Pontuação Acumulada</span>
                                        <span className="text-xl font-black text-amber-600 mt-1 block">{selectedColab.pontuacao} pts</span>
                                    </div>
                                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Finalizações</span>
                                        <span className="text-xl font-black text-emerald-700 mt-1 block">{selectedColab.finalizacoes}</span>
                                    </div>
                                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Ligações Atendidas</span>
                                        <span className="text-xl font-black text-blue-700 mt-1 block">{selectedColab.ligAtendidas}</span>
                                    </div>
                                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Ligações Perdidas</span>
                                        <span className="text-xl font-black text-red-600 mt-1 block">{selectedColab.ligPerdidas}</span>
                                    </div>
                                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">TMA Telefonia (Média)</span>
                                        <span className="text-lg font-mono font-bold text-gray-900 mt-1 block">{selectedColab.tmaTel}</span>
                                    </div>
                                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">TMA Huggy (Média)</span>
                                        <span className="text-lg font-mono font-bold text-gray-900 mt-1 block">{selectedColab.tmaHuggy}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Histórico Semanal Detalhado */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center justify-between">
                                    <span>Lançamentos que Compõem esta Nota ({selectedColab.weeklyRecords.length})</span>
                                    <span className="text-[11px] font-normal text-gray-400">Ordenado por semana</span>
                                </h4>

                                {selectedColab.weeklyRecords.length === 0 ? (
                                    <div className="bg-white p-6 rounded-xl border border-gray-200 text-center text-xs text-gray-400">
                                        Nenhuma avaliação semanal individual encontrada no período.
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                                        <table className="min-w-full text-xs divide-y divide-gray-200">
                                            <thead className="bg-gray-50 text-gray-500 font-bold">
                                                <tr>
                                                    <th className="px-4 py-2.5 text-left">Semana</th>
                                                    <th className="px-4 py-2.5 text-right">Pontos</th>
                                                    <th className="px-4 py-2.5 text-right">Finalizados</th>
                                                    <th className="px-4 py-2.5 text-right">Lig. Atendidas</th>
                                                    <th className="px-4 py-2.5 text-right">TMA Voz</th>
                                                    <th className="px-4 py-2.5 text-right">TMA Chat</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {selectedColab.weeklyRecords.map((rec, i) => (
                                                    <tr key={i} className="hover:bg-gray-50">
                                                        <td className="px-4 py-2.5 font-medium text-gray-900">{rec.date}</td>
                                                        <td className="px-4 py-2.5 text-right font-bold text-amber-600">{rec.pts} pts</td>
                                                        <td className="px-4 py-2.5 text-right text-gray-700">{rec.finalizados}</td>
                                                        <td className="px-4 py-2.5 text-right text-gray-700">{rec.ligAtendidas}</td>
                                                        <td className="px-4 py-2.5 text-right font-mono text-blue-600">{rec.tmaTel}</td>
                                                        <td className="px-4 py-2.5 text-right font-mono text-purple-600">{rec.tmaHuggy}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Rodapé do Modal */}
                        <div className="p-4 bg-white border-t border-gray-200 flex justify-end shrink-0">
                            <button 
                                onClick={() => setSelectedColab(null)} 
                                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-sm transition-colors cursor-pointer"
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

export default Rankings;
