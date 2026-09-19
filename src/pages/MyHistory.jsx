import React, { useState, useEffect, useMemo } from 'react';
import {
    History, MessageSquare, TrendingUp, FileText, ShieldCheck,
    Search, Filter, Database, Hourglass, Eye, X, CalendarDays,
    Star, User, Clock, AlertTriangle, CheckCircle, Phone, ThumbsUp, Minus, ThumbsDown
} from 'lucide-react';
import { collection, onSnapshot, query, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNotification } from '../context/NotificationContext';
import ReactMarkdown from 'react-markdown';

const parseDateObj = (dateStr) => {
    if (!dateStr) return 0;
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
        }
    }
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
        }
    }
    return 0;
};

const formatMonth = (yyyyMm) => {
    if (!yyyyMm) return '--';
    const [year, month] = yyyyMm.split('-');
    return `${month}/${year}`;
};

const getClassificationBadge = (classification) => {
    switch (classification) {
        case 'Positiva': 
            return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1 w-max"><ThumbsUp className="w-3.5 h-3.5"/> Positiva</span>;
        case 'Neutra': 
            return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 flex items-center gap-1 w-max"><Minus className="w-3.5 h-3.5"/> Neutra</span>;
        case 'Negativa': 
            return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1 w-max"><ThumbsDown className="w-3.5 h-3.5"/> Negativa</span>;
        default: 
            return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 flex items-center gap-1 w-max"><Minus className="w-3.5 h-3.5"/> N/A</span>;
    }
};

const MyHistory = ({ currentUserId }) => {
    const { showToast } = useNotification();
    const [activeTab, setActiveTab] = useState('feedbacks');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    const [data, setData] = useState([]);
    const [qaProcesses, setQaProcesses] = useState({});
    const [loading, setLoading] = useState(Boolean(currentUserId));
    const [viewingItem, setViewingItem] = useState(null);

    const handleTabChange = (tab) => {
        if (tab !== activeTab) {
            setActiveTab(tab);
            setLoading(true);
        }
    };

    const getSafeDateString = item => {
        if (item.date) {
            if (typeof item.date === 'string' && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [y, m, d] = item.date.split('-');
                return `${d}/${m}/${y}`;
            }
            return item.date;
        }
        return item.createdAt ? (typeof item.createdAt.toDate === 'function' ? item.createdAt.toDate().toLocaleDateString('pt-BR') : new Date(item.createdAt).toLocaleDateString('pt-BR')) : 'Sem data';
    };

    useEffect(() => {
        const unsubQA = onSnapshot(collection(db, "qa_processes"), snap => {
            const map = {};
            snap.forEach(d => { map[d.id] = d.data(); });
            setQaProcesses(map);
        });

        if (!currentUserId) {
            return () => unsubQA();
        }

        let col = '';
        if (activeTab === 'feedbacks') col = 'feedbacks';
        else if (activeTab === 'metrics') col = 'weekly_evaluations';
        else if (activeTab === 'audits') col = 'qa_audits';
        else if (activeTab === 'monthly') col = 'monthly_evaluations';

        const q = query(collection(db, col));

        const unsub = onSnapshot(q, snap => {
            const res = [];
            snap.forEach(d => {
                const dt = d.data();
                if (dt.colabId === currentUserId || dt.collaboratorId === currentUserId) {
                    res.push({ id: d.id, ...dt });
                }
            });

            res.sort((a, b) => {
                const timeA = a.date ? parseDateObj(a.date) : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
                const timeB = b.date ? parseDateObj(b.date) : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
                return timeB - timeA;
            });

            setData(res);
            setLoading(false);
        });

        return () => { 
            unsubQA(); 
            unsub(); 
        };
    }, [activeTab, currentUserId]);

    const handleMarkAsRead = async (id) => {
        try {
            await updateDoc(doc(db, "feedbacks", id), { read: true });
            showToast("Feedback marcado como lido!", "success");
        } catch {
            showToast("Erro ao atualizar status.", "error");
        }
    };

    const handleViewItem = (item) => {
        setViewingItem(item);
        if (activeTab === 'feedbacks' && !item.read) {
            handleMarkAsRead(item.id);
        }
    };

    const filterOptions = useMemo(() => {
        const months = new Set();
        const dates = new Set();
        data.forEach(item => {
            const safeDate = getSafeDateString(item);
            if (safeDate && safeDate !== 'Sem data') {
                dates.add(safeDate);
                const parts = safeDate.split('/');
                if (parts.length === 3) months.add(`${parts[1]}/${parts[2]}`);
            }
        });
        return {
            months: Array.from(months).sort((a, b) => b.localeCompare(a)),
            dates: Array.from(dates).sort((a, b) => parseDateObj(b) - parseDateObj(a))
        };
    }, [data]);

    const filteredData = data.filter(i => {
        const matchSearch = searchTerm === '' || 
            (i.type && i.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (i.comment && i.comment.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (i.protocol && String(i.protocol).toLowerCase().includes(searchTerm.toLowerCase()));
        const safeDate = getSafeDateString(i);
        const matchDate = dateFilter === '' || safeDate.includes(dateFilter);
        return matchSearch && matchDate;
    });

    return (
        <div className="flex-1 p-6 h-full overflow-y-auto flex flex-col bg-gray-50">
            <header className="mb-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm shrink-0">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <History className="w-6 h-6 text-red-600" /> Meu Histórico
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Acompanhe suas avaliações, feedbacks e auditorias recebidas.
                </p>
            </header>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 shrink-0 space-y-4">
                <div className="flex space-x-2 border-b border-gray-100 pb-3 overflow-x-auto">
                    <button 
                        onClick={() => handleTabChange('feedbacks')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'feedbacks' ? 'bg-red-600 text-white shadow-xs font-bold' : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <MessageSquare className="w-4 h-4" /> Feedbacks
                    </button>
                    <button 
                        onClick={() => handleTabChange('metrics')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'metrics' ? 'bg-red-600 text-white shadow-xs font-bold' : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <TrendingUp className="w-4 h-4" /> Avaliações Semanais
                    </button>
                    <button 
                        onClick={() => handleTabChange('monthly')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'monthly' ? 'bg-red-600 text-white shadow-xs font-bold' : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <FileText className="w-4 h-4" /> Análise Mensal (1:1)
                    </button>
                    <button 
                        onClick={() => handleTabChange('audits')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'audits' ? 'bg-red-600 text-white shadow-xs font-bold' : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <ShieldCheck className="w-4 h-4" /> Auditorias QA
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1 relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                        <input 
                            type="text" 
                            placeholder="Buscar no histórico..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg outline-none text-sm focus:ring-2 focus:ring-red-600 focus:border-red-600" 
                        />
                    </div>

                    <div className="md:w-64 relative">
                        <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none text-sm appearance-none bg-white cursor-pointer text-gray-700 font-medium"
                        >
                            <option value="">Todo o Período</option>
                            {filterOptions.months.length > 0 && (
                                <optgroup label="Por Mês">
                                    {filterOptions.months.map(m => <option key={m} value={m}>{m}</option>)}
                                </optgroup>
                            )}
                            {filterOptions.dates.length > 0 && (
                                <optgroup label="Datas Específicas">
                                    {filterOptions.dates.map(d => <option key={d} value={d}>{d}</option>)}
                                </optgroup>
                            )}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <Hourglass className="w-8 h-8 text-red-600 animate-spin" />
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                        <Database className="w-12 h-12 mb-3 opacity-30 text-gray-400" />
                        <p className="text-base font-medium text-gray-600">Nenhum registro encontrado nesta categoria.</p>
                        <p className="text-xs text-gray-400 mt-1">Seus novos lançamentos aparecerão aqui automaticamente.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto flex-1">
                        <table className="min-w-full divide-y divide-gray-200 text-sm whitespace-nowrap">
                            <thead className="bg-zinc-950 text-white sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 text-left font-semibold text-xs uppercase tracking-wider">Data</th>
                                    <th className="px-6 py-3 text-left font-semibold text-xs uppercase tracking-wider">Resumo</th>
                                    <th className="px-6 py-3 text-right font-semibold text-xs uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredData.map(i => (
                                    <tr key={i.id} className={`hover:bg-gray-50 transition-colors ${activeTab === 'feedbacks' && !i.read ? 'bg-fuchsia-50/30' : ''}`}>
                                        <td className="px-6 py-4 text-gray-600 font-medium">{getSafeDateString(i)}</td>
                                        <td className="px-6 py-4">
                                            {activeTab === 'feedbacks' && (
                                                <div className="flex items-center gap-2">
                                                    {!i.read && <span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse"></span>}
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                                        i.type === 'Elogio' ? 'bg-emerald-100 text-emerald-700' : 
                                                        i.type === 'Ponto de Melhoria' ? 'bg-amber-100 text-amber-700' : 
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {i.type}
                                                    </span>
                                                    <span className="text-xs text-gray-500 truncate max-w-xs">{i.comment || ''}</span>
                                                </div>
                                            )}
                                            {activeTab === 'metrics' && (
                                                <span className="text-gray-600">
                                                    Pontuação Final: <strong className="text-gray-900 font-bold">{i.pontuacao || 0} pts</strong>
                                                    <span className="text-xs text-gray-400 ml-2">| Ligações: {i.Ligacoes_Atendidas || 0} | Huggy: {i.Atendimentos_Huggy || 0}</span>
                                                </span>
                                            )}
                                            {activeTab === 'monthly' && (
                                                <div className="flex items-center gap-3">
                                                    <span className="text-gray-700">Mês: <strong className="text-gray-900">{formatMonth(i.referenceMonth)}</strong></span>
                                                    {getClassificationBadge(i.classification)}
                                                </div>
                                            )}
                                            {activeTab === 'audits' && (
                                                <span className="text-gray-600">
                                                    Status: <strong className={i.status === 'Conforme' ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>{i.status}</strong> 
                                                    <span className="text-gray-400 ml-2">| Protocolo: <strong className="text-gray-800">{i.protocol || '--'}</strong></span>
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-3 items-center">
                                            {activeTab === 'feedbacks' && !i.read && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleMarkAsRead(i.id); }} 
                                                    className="text-[11px] font-bold text-fuchsia-600 hover:text-fuchsia-700 uppercase transition-colors cursor-pointer"
                                                >
                                                    Marcar como lido
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => handleViewItem(i)} 
                                                className="px-2.5 py-1.5 bg-gray-50 hover:bg-red-50 text-gray-700 hover:text-red-600 rounded-lg flex items-center gap-1.5 transition-colors border border-gray-200 cursor-pointer font-medium text-xs"
                                            >
                                                <Eye className="w-3.5 h-3.5 text-red-600" /> Detalhes
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAIS DE VISUALIZAÇÃO DE DETALHES */}
            {viewingItem && (
                activeTab === 'monthly' ? (
                    <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
                        <div className="bg-gray-100 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                                        <CalendarDays className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-lg text-gray-900 leading-tight">Relatório de Avaliação Mensal</h3>
                                        <p className="text-xs text-gray-500">Mês de Referência: <strong className="text-gray-700">{formatMonth(viewingItem.referenceMonth)}</strong></p>
                                    </div>
                                </div>
                                <button onClick={() => setViewingItem(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"><X className="w-5 h-5 text-gray-500" /></button>
                            </div>
                            
                            <div className="p-6 overflow-y-auto flex-1">
                                <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm mx-auto max-w-3xl">
                                    <div className="border-b-2 border-gray-900 pb-4 mb-6 flex justify-between items-end">
                                        <div>
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Colaborador Avaliado</span>
                                            <span className="text-2xl font-black text-gray-900 flex items-center gap-3">
                                                {viewingItem.colabName}
                                                {getClassificationBadge(viewingItem.classification)}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Avaliador Responsável</span>
                                            <span className="text-base font-bold text-gray-700">{viewingItem.evaluatorName || 'Gestão'}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                                                <h4 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                                    <Star className="w-4 h-4 text-amber-500"/> Desempenho e Produtividade
                                                </h4>
                                                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">Nota: <strong className="text-gray-900 text-sm">{viewingItem.performanceScore || '-'}</strong>/10</span>
                                            </div>
                                            <div className="text-gray-800 text-sm prose prose-sm max-w-none">
                                                <ReactMarkdown>{viewingItem.performance || '*Sem observações neste pilar.*'}</ReactMarkdown>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                                                <h4 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                                    <ShieldCheck className="w-4 h-4 text-emerald-500"/> Qualidade e Processos
                                                </h4>
                                                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">Nota: <strong className="text-gray-900 text-sm">{viewingItem.qualityScore || '-'}</strong>/10</span>
                                            </div>
                                            <div className="text-gray-800 text-sm prose prose-sm max-w-none">
                                                <ReactMarkdown>{viewingItem.quality || '*Sem observações neste pilar.*'}</ReactMarkdown>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                                                <h4 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                                    <User className="w-4 h-4 text-blue-500"/> Comportamento e Postura
                                                </h4>
                                                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">Nota: <strong className="text-gray-900 text-sm">{viewingItem.behaviorScore || '-'}</strong>/10</span>
                                            </div>
                                            <div className="text-gray-800 text-sm prose prose-sm max-w-none">
                                                <ReactMarkdown>{viewingItem.behavior || '*Sem observações neste pilar.*'}</ReactMarkdown>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                                                <h4 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-purple-500"/> Assiduidade e Pontualidade
                                                </h4>
                                                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">Nota: <strong className="text-gray-900 text-sm">{viewingItem.punctualityScore || '-'}</strong>/10</span>
                                            </div>
                                            <div className="text-gray-800 text-sm prose prose-sm max-w-none">
                                                <ReactMarkdown>{viewingItem.punctuality || '*Sem observações neste pilar.*'}</ReactMarkdown>
                                            </div>
                                        </div>

                                        {viewingItem.generalComments && (
                                            <div className="space-y-2 pt-4 mt-6 border-t-2 border-gray-100">
                                                <h4 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                                    <MessageSquare className="w-4 h-4 text-gray-500"/> Considerações Finais
                                                </h4>
                                                <div className="text-gray-800 text-sm prose prose-sm max-w-none bg-gray-50 p-4 rounded-lg border border-gray-200">
                                                    <ReactMarkdown>{viewingItem.generalComments}</ReactMarkdown>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-4 bg-white border-t border-gray-200 flex justify-end shrink-0">
                                <button onClick={() => setViewingItem(null)} className="px-6 py-2 bg-gray-900 text-white rounded-lg font-bold hover:bg-black transition-colors cursor-pointer text-sm">Fechar</button>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'metrics' ? (
                    <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col relative max-h-[90vh]">
                            <div className="p-5 bg-zinc-950 text-white flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-500/20 text-red-500 rounded-lg">
                                        <TrendingUp className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-lg leading-tight">Desempenho Semanal</h3>
                                        <p className="text-xs text-gray-400">Data de Referência: <strong className="text-gray-200">{viewingItem.date}</strong></p>
                                    </div>
                                </div>
                                <button onClick={() => setViewingItem(null)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"><X className="w-5 h-5 text-gray-400" /></button>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex flex-col gap-4">
                                        <div className="bg-rose-50 rounded-xl p-4 border border-rose-100 flex flex-col justify-between shadow-xs">
                                            <div className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Ligações Perdidas</div>
                                            <div className="text-3xl font-black text-rose-700">{viewingItem.Ligacoes_Perdidas || 0}</div>
                                        </div>
                                        <div className="bg-white rounded-xl p-4 border border-gray-200 flex flex-col justify-between shadow-xs">
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Phone className="w-4 h-4"/> TME Telefonia</div>
                                            <div className="text-2xl font-black text-gray-800">{viewingItem.TME_Telefonia || '00:00:00'}</div>
                                        </div>
                                        <div className="bg-white rounded-xl p-4 border border-gray-200 flex flex-col justify-between shadow-xs">
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Atendimentos Huggy</div>
                                            <div className="text-2xl font-black text-gray-800">{viewingItem.Atendimentos_Huggy || 0}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-4">
                                        <div className="bg-linear-to-b from-amber-50 to-white rounded-xl p-6 border-2 border-amber-200 flex flex-col items-center justify-center shadow-xs flex-1">
                                            <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4"/> Pontuação Semanal</div>
                                            <div className="text-5xl font-black text-amber-600 my-1">{viewingItem.pontuacao !== undefined ? viewingItem.pontuacao : (Number(viewingItem.Atendimentos_Finalizados || 0) * 1 + Number(viewingItem.Ligacoes_Atendidas || 0) * 2 + Number(viewingItem.Atendimentos_Huggy || 0) * 1 + Number(viewingItem.Ligacoes_Perdidas || 0) * -5)}</div>
                                            <div className="text-xs font-bold text-amber-500">pontos acumulados</div>
                                        </div>
                                        <div className="bg-white rounded-xl p-4 border border-gray-200 flex flex-col justify-between shadow-xs">
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Ligações Atendidas</div>
                                            <div className="text-2xl font-black text-gray-800">{viewingItem.Ligacoes_Atendidas || 0}</div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 flex flex-col justify-between shadow-xs">
                                            <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Atendimentos Finalizados</div>
                                            <div className="text-3xl font-black text-emerald-700">{viewingItem.Atendimentos_Finalizados || 0}</div>
                                        </div>
                                        <div className="bg-white rounded-xl p-4 border border-gray-200 flex flex-col justify-between shadow-xs">
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> TMA Huggy</div>
                                            <div className="text-2xl font-black text-gray-800">{viewingItem.TMA_Huggy || '00:00:00'}</div>
                                        </div>
                                        <div className="bg-white rounded-xl p-4 border border-gray-200 flex flex-col justify-between shadow-xs">
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Phone className="w-4 h-4"/> TMA Telefonia</div>
                                            <div className="text-2xl font-black text-gray-800">{viewingItem.TMA_Telefonia || '00:00:00'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
                        <div className={`bg-white rounded-xl shadow-2xl w-full ${activeTab === 'audits' ? 'max-w-2xl' : 'max-w-lg'} overflow-hidden flex flex-col max-h-[90vh]`}>
                            <div className="p-4 bg-zinc-950 text-white flex justify-between items-center shrink-0">
                                <h3 className="font-bold text-base">Detalhes do Registro</h3>
                                <button onClick={() => setViewingItem(null)} className="p-1 hover:bg-zinc-800 rounded-lg cursor-pointer"><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
                            </div>
                            <div className="p-6 space-y-4 text-sm overflow-y-auto flex-1">
                                {activeTab === 'feedbacks' ? (
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap gap-2">
                                            {viewingItem.type && (
                                                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                                                    viewingItem.type === 'Elogio' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
                                                    viewingItem.type === 'Ponto de Melhoria' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 
                                                    'bg-blue-100 text-blue-700 border border-blue-200'
                                                }`}>
                                                    {viewingItem.type}
                                                </span>
                                            )}
                                            {viewingItem.method && (
                                                <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                                    Canal: {viewingItem.method}
                                                </span>
                                            )}
                                            {viewingItem.protocol && viewingItem.protocol !== "N/A" && (
                                                <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                                    Protocolo: {viewingItem.protocol}
                                                </span>
                                            )}
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Mensagem do Feedback</h4>
                                            <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{viewingItem.comment || 'Sem mensagem descritiva.'}</p>
                                        </div>
                                        {viewingItem.createdBy && (
                                             <div className="flex justify-end text-xs text-gray-500 font-medium">
                                                Enviado por: <strong className="text-gray-800 ml-1">{viewingItem.createdBy}</strong>
                                             </div>
                                        )}
                                    </div>
                                ) : activeTab === 'audits' ? (
                                    <div className="space-y-4">
                                        <div className="flex flex-col items-center justify-center bg-gray-50 rounded-xl p-5 border border-gray-100">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Resultado da Auditoria</div>
                                            <div className={`text-3xl font-black ${viewingItem.status === 'Conforme' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {viewingItem.status || 'N/A'}
                                            </div>
                                            <div className="text-xs font-medium text-gray-500 mt-1">Data: {getSafeDateString(viewingItem)}</div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-white rounded-xl p-3.5 border border-gray-200 shadow-xs">
                                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Protocolo</div>
                                                <span className="font-bold text-gray-900 text-sm">{viewingItem.protocol || 'N/A'}</span>
                                            </div>
                                            <div className="bg-white rounded-xl p-3.5 border border-gray-200 shadow-xs">
                                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Processo Auditado</div>
                                                <div className="text-sm font-bold text-gray-900 truncate">{viewingItem.processName || qaProcesses[viewingItem.processId]?.name || 'N/A'}</div>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-xl p-3.5 border border-gray-200 shadow-xs">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Auditado por</div>
                                            <div className="text-sm font-bold text-gray-900">{viewingItem.evaluatorName || 'N/A'}</div>
                                        </div>

                                        {viewingItem.notes && (
                                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Observações do Auditor</h4>
                                                <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{viewingItem.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                )
            )}
        </div>
    );
};

export default MyHistory;
