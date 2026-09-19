import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Loader2, Calendar, Phone, PhoneMissed, CheckCircle, Clock, 
    Filter, FileText, MessageSquare, Award, ArrowUpRight, TrendingUp
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

const timeToDecimal = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length !== 3) return 0;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    return (hours * 60) + minutes + (seconds / 60);
};

const formatTime = (decimalMinutes) => {
    if (!decimalMinutes && decimalMinutes !== 0) return "00:00:00";
    const totalSeconds = Math.round(decimalMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
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

export const ReportDashboardModal = ({ colab, onClose }) => {
    const [dateFilter, setDateFilter] = useState('');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(
            collection(db, "weekly_evaluations"),
            where("colabId", "==", colab.id)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedData = [];
            snapshot.forEach((doc) => {
                const dbData = doc.data();
                fetchedData.push({
                    id: doc.id,
                    date: dbData.date || 'Semana Atual',
                    finalizados: Number(dbData.Atendimentos_Finalizados) || 0,
                    ligAtendidas: Number(dbData.Ligacoes_Atendidas) || 0,
                    ligPerdidas: Number(dbData.Ligacoes_Perdidas) || 0,
                    huggyVol: Number(dbData.Atendimentos_Huggy) || 0,
                    tmaTel: timeToDecimal(dbData.TMA_Telefonia),
                    tmaHuggy: timeToDecimal(dbData.TMA_Huggy),
                    tme: timeToDecimal(dbData.TME_Telefonia),
                    createdAt: dbData.createdAt
                });
            });

            fetchedData.sort((a, b) => {
                const timeA = a.date !== 'Semana Atual' ? parseDateObj(a.date) : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
                const timeB = b.date !== 'Semana Atual' ? parseDateObj(b.date) : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
                return timeA - timeB; 
            });

            setData(fetchedData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [colab.id]);

    const filterOptions = useMemo(() => {
        const months = new Set();
        const dates = new Set();

        data.forEach(item => {
            const safeDate = item.date;
            if (safeDate && safeDate !== 'Sem data' && safeDate !== 'Semana Atual') {
                dates.add(safeDate);
                const parts = safeDate.split('/');
                if (parts.length === 3) {
                    months.add(`${parts[1]}/${parts[2]}`);
                }
            }
        });

        const sortedDates = Array.from(dates).sort((a, b) => parseDateObj(b) - parseDateObj(a));
        const sortedMonths = Array.from(months).sort((a, b) => {
            const [m1, y1] = a.split('/');
            const [m2, y2] = b.split('/');
            return new Date(y2, m2 - 1, 1).getTime() - new Date(y1, m1 - 1, 1).getTime();
        });

        return { months: sortedMonths, dates: sortedDates };
    }, [data]);

    const filteredData = useMemo(() => {
        return data.filter(item => {
            if (dateFilter === '') return true;
            return item.date.includes(dateFilter);
        });
    }, [data, dateFilter]);

    const currentData = filteredData.length > 0 ? filteredData[filteredData.length - 1] : {
        finalizados: 0, ligAtendidas: 0, ligPerdidas: 0, huggyVol: 0, tmaTel: 0, tme: 0, tmaHuggy: 0
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center z-[70] backdrop-blur-xs">
                <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[70] backdrop-blur-xs">
            <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
                {/* Header */}
                <div className="p-5 bg-zinc-950 flex flex-col md:flex-row justify-between items-start md:items-center text-white shrink-0 gap-4 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-white">Relatório Individual de Desempenho</h2>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                                    {colab.role || 'Colaborador'}
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400">
                                Análise de produtividade e histórico de: <span className="text-white font-semibold">{colab.name}</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                            <select 
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-xs appearance-none bg-zinc-900 cursor-pointer text-white font-medium"
                            >
                                <option value="">Todo o Período</option>
                                {filterOptions.months.length > 0 && (
                                    <optgroup label="Por Mês" className="bg-white text-gray-900">
                                        {filterOptions.months.map(m => <option key={m} value={m}>{m}</option>)}
                                    </optgroup>
                                )}
                                {filterOptions.dates.length > 0 && (
                                    <optgroup label="Datas Específicas" className="bg-white text-gray-900">
                                        {filterOptions.dates.map(d => <option key={d} value={d}>{d}</option>)}
                                    </optgroup>
                                )}
                            </select>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors shrink-0">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {filteredData.length === 0 ? (
                        <div className="text-center py-20 flex flex-col items-center justify-center">
                            <FileText className="w-14 h-14 text-gray-300 mb-3" />
                            <h3 className="text-base font-bold text-gray-800">Nenhum dado lançado para este período</h3>
                            <p className="text-xs text-gray-500 mt-1">Ainda não há avaliações semanais cadastradas para este colaborador.</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-white border border-gray-200 p-3.5 rounded-xl flex items-center justify-between shadow-2xs">
                                <div className="flex items-center gap-2 text-xs">
                                    <Calendar className="w-4 h-4 text-red-600" />
                                    <span className="font-medium text-gray-600">Período de Referência Mais Recente:</span>
                                    <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{currentData.date || 'Último lançamento'}</span>
                                </div>
                                <div className="text-xs text-gray-500">
                                    Total de semanas registradas: <strong className="text-gray-800">{filteredData.length}</strong>
                                </div>
                            </div>

                            {/* Gráficos */}
                            <div className="space-y-6">
                                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-emerald-500" /> 
                                            Evolução de Atendimentos Finalizados
                                        </h3>
                                        <span className="text-[11px] text-gray-400 font-medium">Histórico por data de corte</span>
                                    </div>
                                    <div className="h-60">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={filteredData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} />
                                                <Tooltip cursor={{fill: '#F9FAFB'}} contentStyle={{borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px'}} />
                                                <Bar dataKey="finalizados" fill="#10b981" radius={[4, 4, 0, 0]} name="Atendimentos Finalizados" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                                        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-blue-500" /> 
                                            Evolução TMA Telefonia
                                        </h3>
                                        <div className="h-52">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={filteredData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} dy={10} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} tickFormatter={formatTime} />
                                                    <Tooltip contentStyle={{borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px'}} formatter={(value) => formatTime(value)} />
                                                    <Line type="monotone" dataKey="tmaTel" stroke="#3b82f6" strokeWidth={2.5} dot={{r: 4}} name="TMA Telefonia" />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                                        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <MessageSquare className="w-4 h-4 text-purple-500" /> 
                                            Evolução TMA Huggy (Chat)
                                        </h3>
                                        <div className="h-52">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={filteredData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} dy={10} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} tickFormatter={formatTime} />
                                                    <Tooltip contentStyle={{borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px'}} formatter={(value) => formatTime(value)} />
                                                    <Line type="monotone" dataKey="tmaHuggy" stroke="#a855f7" strokeWidth={2.5} dot={{r: 4}} name="TMA Huggy" />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Resumo em cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-2">
                                <ReportCard title="Pontuação Total" value={`${calcularPontuacao(currentData)} pts`} valueColor={calcularPontuacao(currentData) < 0 ? "text-red-600" : "text-emerald-600"} icon={<Award className="w-3.5 h-3.5 text-amber-500" />} />
                                <ReportCard title="Finalizados" value={currentData.finalizados} valueColor="text-emerald-600" icon={<CheckCircle className="w-3.5 h-3.5 text-emerald-500" />} />
                                <ReportCard title="Lig. Recebidas" value={currentData.ligAtendidas} icon={<Phone className="w-3.5 h-3.5 text-blue-500"/>} />
                                <ReportCard title="Lig. Perdidas" value={currentData.ligPerdidas} valueColor={currentData.ligPerdidas > 0 ? "text-red-600" : "text-gray-900"} icon={<PhoneMissed className="w-3.5 h-3.5 text-red-500"/>} />
                                <ReportCard title="Vol. Huggy" value={currentData.huggyVol} icon={<MessageSquare className="w-3.5 h-3.5 text-purple-500" />} />
                                <ReportCard title="TMA Tel" value={formatTime(currentData.tmaTel)} valueColor="text-blue-600" icon={<Clock className="w-3.5 h-3.5 text-blue-500" />} />
                                <ReportCard title="TME Tel" value={formatTime(currentData.tme)} icon={<Clock className="w-3.5 h-3.5 text-gray-500" />} />
                                <ReportCard title="TMA Huggy" value={formatTime(currentData.tmaHuggy)} valueColor="text-purple-600" icon={<Clock className="w-3.5 h-3.5 text-purple-500" />} />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const ReportCard = ({ title, value, valueColor = "text-gray-900", icon }) => (
    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs flex flex-col items-center justify-center text-center">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{icon}{title}</div>
        <div className={`text-xl font-black ${valueColor}`}>{value}</div>
    </div>
);

export default ReportDashboardModal;
