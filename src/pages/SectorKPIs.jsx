import React, { useState, useEffect, useMemo } from 'react';
import { 
    TrendingUp, Target, Clock, RefreshCw, Plus, Save, Loader2, Calendar, X, BarChart2, Filter
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, addDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNotification } from '../context/NotificationContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// --- FUNÇÕES DE CONVERSÃO DE TEMPO ---
const timeToDecimal = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length !== 3) return 0;
    return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10) + (parseInt(parts[2], 10) / 60);
};

const formatTime = (decimalMinutes) => {
    if (!decimalMinutes && decimalMinutes !== 0) return "00:00:00";
    const totalSeconds = Math.round(decimalMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Formata YYYY-MM para MM/YYYY
const formatMonthLabel = (yyyyMm) => {
    if (!yyyyMm) return '--';
    const [year, month] = yyyyMm.split('-');
    return `${month}/${year}`;
};

const SectorKPIs = () => {
    const { showToast } = useNotification();
    
    const [kpis, setKpis] = useState([]);
    const [goals, setGoals] = useState({ tmr: '00:20:00', fcr: 80, recurrence: 20 });
    const [loading, setLoading] = useState(true);

    // Filtros
    const [monthFilter, setMonthFilter] = useState('');

    // Controles do Modal de Novo Lançamento
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        tmr: '00:00:00',
        fcr: '',
        recurrence: ''
    });

    useEffect(() => {
        // Busca as Metas Globais cadastradas na tela de Configurações
        const unsubGoals = onSnapshot(doc(db, "system_settings", "sector_goals"), (docSnap) => {
            if (docSnap.exists()) {
                setGoals(docSnap.data());
            }
        });

        // Busca o histórico de KPIs lançados
        const q = query(collection(db, "sector_kpis"), orderBy("date", "asc"));
        const unsubKpis = onSnapshot(q, (snap) => {
            const fetchedData = [];
            snap.forEach(doc => {
                fetchedData.push({ id: doc.id, ...doc.data() });
            });
            setKpis(fetchedData);
            setLoading(false);
        });

        return () => { unsubGoals(); unsubKpis(); };
    }, []);

    // --- PREPARAÇÃO DOS DADOS E FILTROS ---
    
    // Extrai todos os meses únicos que possuem dados (YYYY-MM)
    const availableMonths = useMemo(() => {
        const months = new Set();
        kpis.forEach(k => {
            if (k.date) {
                const [year, month] = k.date.split('-');
                months.add(`${year}-${month}`);
            }
        });
        return Array.from(months).sort().reverse(); // Do mais recente pro mais antigo
    }, [kpis]);

    // Aplica o filtro de mês sobre os dados puros
    const filteredKpisRaw = useMemo(() => {
        if (!monthFilter) return kpis;
        return kpis.filter(k => k.date && k.date.startsWith(monthFilter));
    }, [kpis, monthFilter]);

    // Prepara os dados pro formato que o gráfico lê
    const chartData = useMemo(() => {
        return filteredKpisRaw.map(kpi => ({
            date: kpi.date ? kpi.date.split('-').reverse().slice(0, 2).join('/') : '--/--', // Formata para DD/MM
            fcr: Number(kpi.fcr) || 0,
            recurrence: Number(kpi.recurrence) || 0,
            tmrDec: timeToDecimal(kpi.tmr),
            tmrLabel: kpi.tmr || '00:00:00'
        }));
    }, [filteredKpisRaw]);

    const goalTmrDec = timeToDecimal(goals.tmr);

    // Pega o último registro (baseado no filtro) para os cards de destaque
    const currentKpi = filteredKpisRaw.length > 0 ? filteredKpisRaw[filteredKpisRaw.length - 1] : { tmr: '00:00:00', fcr: 0, recurrence: 0 };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                date: formData.date,
                tmr: formData.tmr,
                fcr: Number(formData.fcr),
                recurrence: Number(formData.recurrence),
                createdAt: new Date()
            };

            await addDoc(collection(db, "sector_kpis"), payload);
            showToast("KPIs do setor registrados com sucesso!", "success");
            setIsModalOpen(false);
            setFormData({ date: new Date().toISOString().split('T')[0], tmr: '00:00:00', fcr: '', recurrence: '' });
        } catch (error) {
            showToast("Erro ao salvar KPIs.", "error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex-1 flex justify-center items-center h-full"><Loader2 className="w-8 h-8 text-red-600 animate-spin" /></div>;
    }

    return (
        <div className="flex-1 p-6 h-full overflow-y-auto bg-gray-50 flex flex-col">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-red-600" /> Indicadores do Setor (KPIs)
                    </h1>
                    <p className="text-sm text-gray-500">Acompanhamento de metas globais da equipe de suporte.</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold transition-colors shadow-sm"
                >
                    <Plus className="w-5 h-5" /> Lançar Atualização
                </button>
            </header>

            {/* BARRA DE FILTROS */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 shrink-0 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" /> Filtro de Exibição
                </span>
                <div className="w-full md:w-64 relative">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <select 
                        value={monthFilter}
                        onChange={(e) => setMonthFilter(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none text-sm appearance-none bg-white cursor-pointer text-gray-600 font-medium"
                    >
                        <option value="">Todo o Período</option>
                        {availableMonths.map(m => (
                            <option key={m} value={m}>{formatMonthLabel(m)}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* CARDS DE RESUMO (ÚLTIMO LANÇAMENTO) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 shrink-0">
                <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200 flex flex-col relative overflow-hidden h-full">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">TMR Global Atual</h3>
                        <div className="p-1 bg-gray-50 rounded-full border border-gray-100"><Clock className="w-5 h-5 text-purple-500" /></div>
                    </div>
                    <div className="flex items-end gap-2 mt-1">
                        <div className={`text-3xl font-extrabold tracking-tight ${timeToDecimal(currentKpi.tmr) <= goalTmrDec ? 'text-emerald-600' : 'text-red-600'}`}>
                            {currentKpi.tmr}
                        </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between items-center">
                        <div className="text-[10px] text-gray-400 font-medium">Tempo Médio de Resolução</div>
                        <div className="text-[10px] text-gray-500 font-bold bg-gray-50 px-2 py-0.5 rounded border border-gray-100">Meta: ≤ {goals.tmr}</div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200 flex flex-col relative overflow-hidden h-full">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">FCR Global Atual</h3>
                        <div className="p-1 bg-gray-50 rounded-full border border-gray-100"><Target className="w-5 h-5 text-rose-500" /></div>
                    </div>
                    <div className="flex items-end gap-2 mt-1">
                        <div className={`text-3xl font-extrabold tracking-tight ${currentKpi.fcr >= goals.fcr ? 'text-emerald-600' : 'text-red-600'}`}>
                            {currentKpi.fcr}%
                        </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between items-center">
                        <div className="text-[10px] text-gray-400 font-medium">First Call Resolution</div>
                        <div className="text-[10px] text-gray-500 font-bold bg-gray-50 px-2 py-0.5 rounded border border-gray-100">Meta: ≥ {goals.fcr}%</div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200 flex flex-col relative overflow-hidden h-full">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Reincidência Atual</h3>
                        <div className="p-1 bg-gray-50 rounded-full border border-gray-100"><RefreshCw className="w-5 h-5 text-blue-500" /></div>
                    </div>
                    <div className="flex items-end gap-2 mt-1">
                        <div className={`text-3xl font-extrabold tracking-tight ${currentKpi.recurrence <= goals.recurrence ? 'text-emerald-600' : 'text-red-600'}`}>
                            {currentKpi.recurrence}%
                        </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between items-center">
                        <div className="text-[10px] text-gray-400 font-medium">Taxa de Retorno do Cliente</div>
                        <div className="text-[10px] text-gray-500 font-bold bg-gray-50 px-2 py-0.5 rounded border border-gray-100">Meta: ≤ {goals.recurrence}%</div>
                    </div>
                </div>
            </div>

            {/* ÁREA DOS GRÁFICOS INDIVIDUAIS COM METAS */}
            {chartData.length === 0 ? (
                <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center text-gray-400 flex flex-col items-center justify-center flex-1">
                    <BarChart2 className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-lg font-medium">Nenhum KPI lançado para este período.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                    
                    {/* GRÁFICO 1: FCR */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col h-80">
                        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Target className="w-4 h-4 text-rose-500" /> Evolução FCR (%)
                        </h3>
                        <div className="flex-1 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorFcr" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} tickFormatter={(val) => `${val}%`} />
                                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(val) => [`${val}%`, "FCR"]} />
                                    {/* Linha de Meta */}
                                    <ReferenceLine y={goals.fcr} stroke="#10b981" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'insideTopLeft', value: `Meta: ${goals.fcr}%`, fill: '#10b981', fontSize: 12, fontWeight: 'bold' }} />
                                    <Area type="monotone" dataKey="fcr" stroke="#f43f5e" strokeWidth={3} fill="url(#colorFcr)" activeDot={{r: 6}} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* GRÁFICO 2: TMR */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col h-80">
                        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-purple-500" /> Evolução TMR (Tempo de Resolução)
                        </h3>
                        <div className="flex-1 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorTmr" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} tickFormatter={formatTime} />
                                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(val, name, props) => [props.payload.tmrLabel, "TMR"]} />
                                    {/* Linha de Meta */}
                                    <ReferenceLine y={goalTmrDec} stroke="#e4022c" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'insideTopLeft', value: `Limite: ${goals.tmr}`, fill: '#e4022c', fontSize: 12, fontWeight: 'bold' }} />
                                    <Area type="monotone" dataKey="tmrDec" stroke="#a855f7" strokeWidth={3} fill="url(#colorTmr)" activeDot={{r: 6}} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* GRÁFICO 3: REINCIDÊNCIA */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col h-80 lg:col-span-2">
                        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-blue-500" /> Evolução de Reincidência (%)
                        </h3>
                        <div className="flex-1 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} tickFormatter={(val) => `${val}%`} />
                                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(val) => [`${val}%`, "Reincidência"]} />
                                    {/* Linha de Meta */}
                                    <ReferenceLine y={goals.recurrence} stroke="#e4022c" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'insideTopLeft', value: `Limite: ${goals.recurrence}%`, fill: '#e4022c', fontSize: 12, fontWeight: 'bold' }} />
                                    <Area type="monotone" dataKey="recurrence" stroke="#3b82f6" strokeWidth={3} fill="url(#colorRec)" activeDot={{r: 6}} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>
            )}

            {/* MODAL DE NOVO LANÇAMENTO */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="p-5 bg-zinc-950 text-white flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-red-500" />
                                Lançar KPIs do Período
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-gray-50">
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Referência da Atualização</label>
                                    <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none font-medium" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">FCR Global (%)</label>
                                    <input type="number" step="0.1" required placeholder="Ex: 85" value={formData.fcr} onChange={(e) => setFormData({...formData, fcr: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none font-bold" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">TMR Global (HH:MM:SS)</label>
                                    <input type="step" step="1" required placeholder="00:15:30" value={formData.tmr} onChange={(e) => setFormData({...formData, tmr: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none font-bold" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Taxa de Reincidência (%)</label>
                                    <input type="number" step="0.1" required placeholder="Ex: 15" value={formData.recurrence} onChange={(e) => setFormData({...formData, recurrence: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none font-bold" />
                                </div>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-white font-bold transition-colors shadow-sm">Cancelar</button>
                                <button type="submit" disabled={saving} className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold transition-colors disabled:opacity-70 flex justify-center items-center gap-2 shadow-sm">
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    Salvar Atualização
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SectorKPIs;