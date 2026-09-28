import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    TrendingUp, Save, Loader2, Calendar, Upload, Download, 
    Search, Filter, Sun, Sunset, Moon, Users, Sparkles, Check, 
    ShieldAlert, Award, Hash, CheckCircle2
} from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeSharedCollection } from '../services/dataCache';
import { useNotification } from '../context/NotificationContext';
import { normalizeRole } from '../services/rbac';

const SHIFT_BADGES = {
    'Manhã I': {
        icon: Sun,
        style: 'bg-amber-50 text-amber-900 border-amber-300 font-bold',
        dot: 'bg-amber-500'
    },
    'Manhã II': {
        icon: Sun,
        style: 'bg-yellow-50 text-yellow-900 border-yellow-300 font-bold',
        dot: 'bg-yellow-500'
    },
    'Tarde': {
        icon: Sunset,
        style: 'bg-orange-50 text-orange-900 border-orange-300 font-bold',
        dot: 'bg-orange-500'
    },
    'Noturno': {
        icon: Moon,
        style: 'bg-indigo-50 text-indigo-900 border-indigo-300 font-bold',
        dot: 'bg-indigo-500'
    }
};

const getShiftBadge = (shift) => {
    if (!shift) return { icon: Sun, style: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-400' };
    const s = String(shift).trim();
    if (s.includes('Manhã I') || s === 'Manha I') return SHIFT_BADGES['Manhã I'];
    if (s.includes('Manhã II') || s === 'Manha II') return SHIFT_BADGES['Manhã II'];
    if (s.toLowerCase().includes('tard')) return SHIFT_BADGES['Tarde'];
    if (s.toLowerCase().includes('noturn') || s.toLowerCase().includes('noit')) return SHIFT_BADGES['Noturno'];
    if (s.toLowerCase().includes('manh')) return SHIFT_BADGES['Manhã I'];
    return { icon: Sun, style: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-400' };
};

const WeeklyMetrics = () => {
    const { showToast } = useNotification();
    const [collaborators, setCollaborators] = useState([]);
    const [metricsData, setMetricsData] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const fileInputRef = useRef(null);

    // Filtros e busca
    const [searchQuery, setSearchQuery] = useState('');
    const [shiftFilter, setShiftFilter] = useState('ALL'); // 'ALL', 'Manhã I', 'Manhã II', 'Tarde', 'Noturno'

    // Estado para a data de referência (formato YYYY-MM-DD para o input)
    const [referenceDate, setReferenceDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        const unsubscribe = subscribeSharedCollection("collaborators", (items) => {
            const colabs = [];
            const initialMetrics = {};
            
            items.forEach((data) => {
                // REGRA CRÍTICA: Ignora inativos, sem turno OU usuários com cargo de Gestor e Supervisão
                const roleNorm = normalizeRole(data.role);
                const rawRole = (data.role || '').toLowerCase().trim();
                const isLideranca = (
                    roleNorm === 'gestor' || 
                    roleNorm === 'supervisor' || 
                    rawRole.includes('gest') || 
                    rawRole.includes('superv') || 
                    rawRole === 'manager'
                );

                if (data.active === false || !data.shift || data.shift.trim() === '' || isLideranca) {
                    return;
                }

                colabs.push(data);
                initialMetrics[data.id] = {
                    Ligacoes_Atendidas: '',
                    Ligacoes_Perdidas: '',
                    TMA_Telefonia: '',
                    TME_Telefonia: '',
                    Atendimentos_Huggy: '',
                    TMA_Huggy: '',
                    Atendimentos_Finalizados: ''
                };
            });

            colabs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            
            setCollaborators(colabs);
            // Preserva valores já preenchidos
            setMetricsData(prev => Object.keys(prev).length === 0 ? initialMetrics : prev);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleInputChange = (colabId, field, value) => {
        setMetricsData(prev => ({
            ...prev,
            [colabId]: {
                ...(prev[colabId] || {}),
                [field]: value
            }
        }));
    };

    // Preenchimento rápido de zeros nos campos vazios
    const handleFillZeros = () => {
        setMetricsData(prev => {
            const next = { ...prev };
            collaborators.forEach(c => {
                const cur = next[c.id] || {};
                next[c.id] = {
                    Ligacoes_Atendidas: cur.Ligacoes_Atendidas !== '' ? cur.Ligacoes_Atendidas : '0',
                    Ligacoes_Perdidas: cur.Ligacoes_Perdidas !== '' ? cur.Ligacoes_Perdidas : '0',
                    TMA_Telefonia: cur.TMA_Telefonia !== '' ? cur.TMA_Telefonia : '00:00:00',
                    TME_Telefonia: cur.TME_Telefonia !== '' ? cur.TME_Telefonia : '00:00:00',
                    Atendimentos_Huggy: cur.Atendimentos_Huggy !== '' ? cur.Atendimentos_Huggy : '0',
                    TMA_Huggy: cur.TMA_Huggy !== '' ? cur.TMA_Huggy : '00:00:00',
                    Atendimentos_Finalizados: cur.Atendimentos_Finalizados !== '' ? cur.Atendimentos_Finalizados : '0'
                };
            });
            return next;
        });
        showToast("Campos vazios preenchidos com valores padrão!", "info");
    };

    // --- FUNÇÕES DE IMPORTAÇÃO E EXPORTAÇÃO CSV ---
    const downloadTemplate = () => {
        const headers = ["Nome", "Ligacoes_Atendidas", "Ligacoes_Perdidas", "TMA_Telefonia", "TME_Telefonia", "Atendimentos_Huggy", "TMA_Huggy", "Atendimentos_Finalizados"];
        const rows = collaborators.map(c => [c.name, "0", "0", "00:00:00", "00:00:00", "0", "00:00:00", "0"]);
        
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `modelo_metricas_${referenceDate}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const lines = text.split(/\r?\n/); 
            
            if (lines.length < 2) {
                showToast("O arquivo parece estar vazio ou tem um formato inválido.", "error");
                return;
            }

            const delimiter = lines[0].includes(';') ? ';' : ',';
            const newMetrics = { ...metricsData };
            let importedCount = 0;

            for (let i = 1; i < lines.length; i++) {
                const row = lines[i].split(delimiter).map(item => item?.trim() || '');
                if (row.length < 2 || !row[0]) continue;
                
                const colabName = row[0];
                const colab = collaborators.find(c => c.name.toLowerCase() === colabName.toLowerCase());
                
                if (colab) {
                    newMetrics[colab.id] = {
                        Ligacoes_Atendidas: row[1] || '0',
                        Ligacoes_Perdidas: row[2] || '0',
                        TMA_Telefonia: row[3] || '00:00:00',
                        TME_Telefonia: row[4] || '00:00:00',
                        Atendimentos_Huggy: row[5] || '0',
                        TMA_Huggy: row[6] || '00:00:00',
                        Atendimentos_Finalizados: row[7] || '0'
                    };
                    importedCount++;
                }
            }

            setMetricsData(newMetrics);
            showToast(`${importedCount} colaboradores importados com sucesso!`, "success");
        };
        
        reader.readAsText(file);
        e.target.value = null;
    };

    const handleSaveMetrics = async () => {
        setSaving(true);
        try {
            const [year, month, day] = referenceDate.split('-');
            const dateString = `${day}/${month}/${year}`;

            const savePromises = Object.entries(metricsData).map(async ([colabId, metrics]) => {
                const hasData = Object.values(metrics).some(val => val !== '' && val !== null && val !== undefined);
                if (!hasData) return Promise.resolve();

                const finalizados = Number(metrics.Atendimentos_Finalizados) || 0;
                const ligAtendidas = Number(metrics.Ligacoes_Atendidas) || 0;
                const ligPerdidas = Number(metrics.Ligacoes_Perdidas) || 0;
                const huggy = Number(metrics.Atendimentos_Huggy) || 0;

                // Fórmula oficial de pontuação
                const pontuacaoTotal = (finalizados * 1) + (ligAtendidas * 2) + (huggy * 1) + (ligPerdidas * -5);

                const colabObj = collaborators.find(c => c.id === colabId);

                return addDoc(collection(db, "weekly_evaluations"), {
                    colabId: colabId,
                    colabName: colabObj?.name || '',
                    shift: colabObj?.shift || '',
                    date: dateString,
                    Atendimentos_Finalizados: finalizados,
                    Ligacoes_Atendidas: ligAtendidas,
                    Ligacoes_Perdidas: ligPerdidas,
                    Atendimentos_Huggy: huggy,
                    TMA_Telefonia: metrics.TMA_Telefonia || "00:00:00",
                    TMA_Huggy: metrics.TMA_Huggy || "00:00:00",
                    TME_Telefonia: metrics.TME_Telefonia || "00:00:00",
                    pontuacao: pontuacaoTotal,
                    createdAt: new Date() 
                });
            });

            await Promise.all(savePromises);
            showToast("Avaliações salvas com sucesso no banco de dados!", "success");
            
            // Limpa os campos após salvar
            const resetMetrics = {};
            collaborators.forEach(c => {
                resetMetrics[c.id] = {
                    Ligacoes_Atendidas: '', Ligacoes_Perdidas: '', TMA_Telefonia: '',
                    TME_Telefonia: '', Atendimentos_Huggy: '', TMA_Huggy: '', Atendimentos_Finalizados: ''
                };
            });
            setMetricsData(resetMetrics);

        } catch (error) {
            console.error(error);
            showToast("Erro ao salvar avaliações: " + error.message, "error");
        } finally {
            setSaving(false);
        }
    };

    // Filtra lista de colaboradores
    const filteredCollaborators = useMemo(() => {
        return collaborators.filter(c => {
            const matchesSearch = !searchQuery.trim() || (c.name || '').toLowerCase().includes(searchQuery.toLowerCase().trim());
            const matchesShift = shiftFilter === 'ALL' || (c.shift && c.shift.toLowerCase().includes(shiftFilter.toLowerCase()));
            return matchesSearch && matchesShift;
        });
    }, [collaborators, searchQuery, shiftFilter]);

    // Resumo de preenchimento
    const filledCount = useMemo(() => {
        let count = 0;
        collaborators.forEach(c => {
            const m = metricsData[c.id];
            if (m && Object.values(m).some(v => v !== '')) count++;
        });
        return count;
    }, [collaborators, metricsData]);

    // Pontos totais projetados
    const totalProjectedScore = useMemo(() => {
        let total = 0;
        collaborators.forEach(c => {
            const m = metricsData[c.id];
            if (m) {
                const fin = Number(m.Atendimentos_Finalizados) || 0;
                const ligAt = Number(m.Ligacoes_Atendidas) || 0;
                const ligPerd = Number(m.Ligacoes_Perdidas) || 0;
                const hug = Number(m.Atendimentos_Huggy) || 0;
                total += (fin * 1) + (ligAt * 2) + (hug * 1) + (ligPerd * -5);
            }
        });
        return total;
    }, [collaborators, metricsData]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 h-full">
                <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-gray-50 font-sans space-y-6">
            
            {/* HEADER COM ESTILO EXECUTIVO */}
            <header className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 inline-flex items-center gap-1.5 shadow-2xs">
                                <TrendingUp className="w-3.5 h-3.5 text-red-600" />
                                Módulo Operacional • Avaliações Semanais
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                                {collaborators.length} Operadores Elegíveis
                            </span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                            Lançamento de Métricas e Pontuação Semanal
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Preencha as métricas operacionais para apuração de TMA, TME e pontuação. <strong className="text-zinc-700">Cargos de Gestor e Supervisão foram excluídos da lista.</strong>
                        </p>
                    </div>

                    {/* Ações e Data */}
                    <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                        <input 
                            type="file" 
                            accept=".csv" 
                            className="hidden" 
                            ref={fileInputRef} 
                            onChange={handleFileUpload} 
                        />
                        
                        <button 
                            type="button"
                            onClick={downloadTemplate}
                            className="px-3 py-2 bg-white hover:bg-gray-50 text-zinc-700 rounded-xl text-xs font-bold border border-gray-200 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Baixar planilha modelo CSV para importação"
                        >
                            <Download className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Modelo CSV</span>
                        </button>

                        <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-2 bg-white hover:bg-gray-50 text-zinc-700 rounded-xl text-xs font-bold border border-gray-200 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Importar métricas preenchidas em CSV"
                        >
                            <Upload className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Importar</span>
                        </button>

                        {/* Seletor de Data */}
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 shadow-2xs">
                            <Calendar className="w-3.5 h-3.5 text-gray-500" />
                            <span className="text-gray-400 hidden sm:inline">Data:</span>
                            <input 
                                type="date" 
                                value={referenceDate}
                                onChange={(e) => setReferenceDate(e.target.value)}
                                className="bg-transparent outline-none cursor-pointer font-bold text-gray-900"
                            />
                        </div>

                        {/* Botão de Salvar */}
                        <button 
                            type="button"
                            onClick={handleSaveMetrics}
                            disabled={saving}
                            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-950/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 ml-auto sm:ml-0 active:scale-95"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>Salvar Lançamentos</span>
                        </button>
                    </div>
                </div>

                {/* BARRA DE FILTROS & PESQUISA VISUALMENTE APERFEIÇOADA */}
                <div className="pt-3 border-t border-gray-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    
                    {/* Campo de Busca Rápida */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filtrar por nome do operador..."
                            className="w-full pl-9 pr-3.5 py-2 text-xs bg-gray-50/80 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500 outline-none transition-all"
                        />
                    </div>

                    {/* Filtros de Turno Oficiais */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1 hidden sm:inline">Turnos:</span>
                        
                        <button
                            type="button"
                            onClick={() => setShiftFilter('ALL')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                shiftFilter === 'ALL'
                                    ? 'bg-zinc-950 text-white shadow-2xs'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                            }`}
                        >
                            Todos ({collaborators.length})
                        </button>

                        {['Manhã I', 'Manhã II', 'Tarde', 'Noturno'].map(s => {
                            const badge = SHIFT_BADGES[s];
                            const Icon = badge.icon;
                            const count = collaborators.filter(c => c.shift && c.shift.toLowerCase().includes(s.toLowerCase())).length;
                            const isSelected = shiftFilter === s;
                            return (
                                <button
                                    type="button"
                                    key={s}
                                    onClick={() => setShiftFilter(s)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                                        isSelected
                                            ? `${badge.style} shadow-2xs ring-1 ring-zinc-900/20`
                                            : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200'
                                    }`}
                                >
                                    <Icon className="w-3 h-3" />
                                    <span>{s}</span>
                                    <span className="text-[10px] opacity-75 font-mono">({count})</span>
                                </button>
                            );
                        })}

                        {/* Botão de Preenchimento Rápido com Zero */}
                        <button
                            type="button"
                            onClick={handleFillZeros}
                            className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold border border-zinc-200 ml-1 transition-colors cursor-pointer"
                            title="Preenche campos não preenchidos com zero automaticamente"
                        >
                            Zerar Vazios
                        </button>
                    </div>
                </div>

            </header>

            {/* TABELA MODERNA DE LANÇAMENTOS */}
            {filteredCollaborators.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center text-gray-500 space-y-2">
                    <ShieldAlert className="w-8 h-8 text-gray-400 mx-auto" />
                    <h3 className="font-bold text-gray-700 text-base">Nenhum operador elegível encontrado</h3>
                    <p className="text-xs text-gray-400">Verifique os filtros selecionados ou certifique-se de que os colaboradores possuem turno cadastrado.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden flex flex-col">
                    
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-xs">
                            <thead className="bg-zinc-950 text-white">
                                <tr>
                                    <th className="px-4 py-3.5 text-left font-bold tracking-wider">Colaborador</th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-28">Turno</th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-24">Lig. Atendidas<br/><span className="text-[10px] text-emerald-400 font-normal">(+2 pts)</span></th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-24">Lig. Perdidas<br/><span className="text-[10px] text-rose-400 font-normal">(-5 pts)</span></th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-28">TMA Telefonia</th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-28">TME Telefonia</th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-24">Atend. Huggy<br/><span className="text-[10px] text-blue-400 font-normal">(+1 pt)</span></th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-28">TMA Huggy</th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-28">Finalizados<br/><span className="text-[10px] text-purple-400 font-normal">(+1 pt)</span></th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-24 text-amber-400">Pontuação<br/>Projetada</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {filteredCollaborators.map((colab) => {
                                    const metrics = metricsData[colab.id] || {};
                                    const badge = getShiftBadge(colab.shift);
                                    const Icon = badge.icon;

                                    // Cálculo em tempo real da pontuação desta linha
                                    const finalizados = Number(metrics.Atendimentos_Finalizados) || 0;
                                    const ligAtendidas = Number(metrics.Ligacoes_Atendidas) || 0;
                                    const ligPerdidas = Number(metrics.Ligacoes_Perdidas) || 0;
                                    const huggy = Number(metrics.Atendimentos_Huggy) || 0;
                                    const rowScore = (finalizados * 1) + (ligAtendidas * 2) + (huggy * 1) + (ligPerdidas * -5);
                                    const hasEntries = Object.values(metrics).some(v => v !== '');

                                    return (
                                        <tr key={colab.id} className="hover:bg-gray-50/80 transition-colors">
                                            
                                            {/* Colaborador com Avatar e Nome */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden shadow-2xs">
                                                        {(colab.photoURL || colab.photoUrl) ? (
                                                            <img src={colab.photoURL || colab.photoUrl} alt={colab.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            colab.name?.charAt(0)?.toUpperCase() || 'U'
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="font-bold text-gray-900 block truncate">{colab.name}</span>
                                                        <span className="text-[10px] text-gray-400 font-mono truncate block">{colab.email}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Turno com Tag Estilizada */}
                                            <td className="px-3 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-2xs whitespace-nowrap ${badge.style}`}>
                                                    <Icon className="w-3 h-3" />
                                                    <span>{colab.shift}</span>
                                                </span>
                                            </td>

                                            {/* Ligações Atendidas */}
                                            <td className="px-2 py-2">
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    placeholder="0" 
                                                    value={metrics.Ligacoes_Atendidas || ''} 
                                                    onChange={(e) => handleInputChange(colab.id, 'Ligacoes_Atendidas', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-center font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                                                />
                                            </td>

                                            {/* Ligações Perdidas */}
                                            <td className="px-2 py-2">
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    placeholder="0" 
                                                    value={metrics.Ligacoes_Perdidas || ''} 
                                                    onChange={(e) => handleInputChange(colab.id, 'Ligacoes_Perdidas', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-center font-bold text-rose-700 bg-rose-50/40 border border-rose-200 rounded-lg focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all"
                                                />
                                            </td>

                                            {/* TMA Telefonia */}
                                            <td className="px-2 py-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="00:00:00" 
                                                    value={metrics.TMA_Telefonia || ''} 
                                                    onChange={(e) => handleInputChange(colab.id, 'TMA_Telefonia', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-center font-mono font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                                                />
                                            </td>

                                            {/* TME Telefonia */}
                                            <td className="px-2 py-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="00:00:00" 
                                                    value={metrics.TME_Telefonia || ''} 
                                                    onChange={(e) => handleInputChange(colab.id, 'TME_Telefonia', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-center font-mono font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                                                />
                                            </td>

                                            {/* Atendimentos Huggy */}
                                            <td className="px-2 py-2">
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    placeholder="0" 
                                                    value={metrics.Atendimentos_Huggy || ''} 
                                                    onChange={(e) => handleInputChange(colab.id, 'Atendimentos_Huggy', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-center font-bold text-blue-900 bg-blue-50/30 border border-blue-200 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                                />
                                            </td>

                                            {/* TMA Huggy */}
                                            <td className="px-2 py-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="00:00:00" 
                                                    value={metrics.TMA_Huggy || ''} 
                                                    onChange={(e) => handleInputChange(colab.id, 'TMA_Huggy', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-center font-mono font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                                                />
                                            </td>

                                            {/* Atendimentos Finalizados */}
                                            <td className="px-2 py-2">
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    placeholder="0" 
                                                    value={metrics.Atendimentos_Finalizados || ''} 
                                                    onChange={(e) => handleInputChange(colab.id, 'Atendimentos_Finalizados', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-center font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                                                />
                                            </td>

                                            {/* Pontuação Projetada em Tempo Real */}
                                            <td className="px-3 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border shadow-2xs font-mono ${
                                                    hasEntries 
                                                        ? (rowScore >= 0 ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-rose-100 text-rose-900 border-rose-300')
                                                        : 'bg-gray-100 text-gray-400 border-gray-200'
                                                }`}>
                                                    <Award className="w-3 h-3 text-amber-600" />
                                                    {rowScore} pts
                                                </span>
                                            </td>

                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* BARRA DE RODAPÉ COM RESUMO */}
                    <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-4 text-gray-500">
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <strong>{filledCount}</strong> de <strong>{collaborators.length}</strong> colaboradores com dados preenchidos
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1.5">
                                <Award className="w-4 h-4 text-amber-600" />
                                Pontuação Total Projetada: <strong className="text-gray-900 font-mono">{totalProjectedScore} pts</strong>
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <button 
                                type="button"
                                onClick={handleSaveMetrics}
                                disabled={saving}
                                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar Todas as Avaliações
                            </button>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};

export default WeeklyMetrics;
