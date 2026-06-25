import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, doc, setDoc, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore';
import { 
    Save, Calendar, MessageSquare, Ticket, Clock, 
    Activity, AlertCircle, Plus, FileText, Edit2, Trash2, X
} from 'lucide-react';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';

export default function DailyDemandLaunch() {
    // Modal & Form States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTickets, setStartTickets] = useState('');
    const [startChats, setStartChats] = useState('');
    const [endTickets, setEndTickets] = useState('');
    const [endChats, setEndChats] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');

    // Data States
    const [historicalData, setHistoricalData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistoricalData();
    }, []);

    // Popula o form ao editar ou se já houver dado na data (Ex: Manhã já preencheu, Tarde vai completar)
    useEffect(() => {
        if (isModalOpen) {
            const todayData = historicalData.find(d => d.date === date);
            if (todayData) {
                // Usando ?? para garantir que o 0 seja respeitado e não convertido para vazio
                setStartTickets(todayData.startTickets ?? '');
                setStartChats(todayData.startChats ?? '');
                setEndTickets(todayData.endTickets ?? '');
                setEndChats(todayData.endChats ?? '');
            } else {
                setStartTickets('');
                setStartChats('');
                setEndTickets('');
                setEndChats('');
            }
        }
    }, [date, historicalData, isModalOpen]);

    const fetchHistoricalData = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'dailyDemand'), orderBy('date', 'asc'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHistoricalData(data);
        } catch (error) {
            console.error('Erro ao buscar dados históricos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        // Validação: Exige pelo menos um campo preenchido
        if (startTickets === '' && startChats === '' && endTickets === '' && endChats === '') {
            setMessage('Erro: Preencha pelo menos um dos campos para salvar.');
            return;
        }

        setIsSaving(true);
        setMessage('');

        try {
            const docRef = doc(db, 'dailyDemand', date);
            const payload = {
                date,
                startTickets: startTickets !== '' ? Number(startTickets) : null,
                startChats: startChats !== '' ? Number(startChats) : null,
                endTickets: endTickets !== '' ? Number(endTickets) : null,
                endChats: endChats !== '' ? Number(endChats) : null,
                updatedAt: new Date().toISOString(),
            };

            await setDoc(docRef, payload, { merge: true });
            setMessage('Salvo com sucesso!');
            fetchHistoricalData(); 
            
            setTimeout(() => {
                setMessage('');
                setIsModalOpen(false);
            }, 1500);
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
            setMessage('Erro ao salvar. Verifique sua conexão.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if(window.confirm('Tem certeza que deseja excluir este registro?')) {
            try {
                await deleteDoc(doc(db, 'dailyDemand', id));
                fetchHistoricalData();
            } catch (error) {
                console.error("Erro ao deletar", error);
            }
        }
    };

    const openEdit = (dataRecord) => {
        setDate(dataRecord.date);
        setIsModalOpen(true);
    };

    // --- Metric Calculations ---
    const getMetrics = () => {
        if (historicalData.length === 0) return { avgStartTickets: 0, avgStartChats: 0, avgEndTickets: 0, avgEndChats: 0 };

        let totalStartTickets = 0, totalStartChats = 0;
        let totalEndTickets = 0, totalEndChats = 0;
        let startCount = 0, endCount = 0;

        historicalData.forEach(d => {
            // Conta apenas os dias em que houve lançamento de Início
            if (d.startTickets !== null && d.startTickets !== undefined) {
                totalStartTickets += d.startTickets;
                totalStartChats += d.startChats || 0;
                startCount++;
            }
            // Conta apenas os dias em que houve lançamento de Fim
            if (d.endTickets !== null && d.endTickets !== undefined) {
                totalEndTickets += d.endTickets;
                totalEndChats += d.endChats || 0;
                endCount++;
            }
        });

        const avgStartTickets = startCount > 0 ? Math.round(totalStartTickets / startCount) : 0;
        const avgStartChats = startCount > 0 ? Math.round(totalStartChats / startCount) : 0;
        const avgEndTickets = endCount > 0 ? Math.round(totalEndTickets / endCount) : 0;
        const avgEndChats = endCount > 0 ? Math.round(totalEndChats / endCount) : 0;

        return { avgStartTickets, avgStartChats, avgEndTickets, avgEndChats };
    };

    const metrics = getMetrics();
    const sortedData = [...historicalData].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="p-6 w-full mx-auto space-y-6">
            
            {/* Cabeçalho no padrão Auditoria QA */}
            <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                        <Activity className="w-6 h-6 text-red-600" />
                        Demanda e Fila Diária
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">
                        Acompanhamento padronizado do volume de chamados e chats.
                    </p>
                </div>
                <button 
                    onClick={() => { setDate(new Date().toISOString().split('T')[0]); setIsModalOpen(true); }}
                    className="bg-[#E60000] hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Plus className="w-5 h-5" /> Novo Registro
                </button>
            </div>

            {/* Grid de KPIs Todos com Fundo Preto */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#111111] rounded-xl shadow-sm border border-black p-5 flex flex-col justify-center">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Ticket className="w-3.5 h-3.5"/> MÉDIA INÍCIO (CHAMADOS)
                    </div>
                    <div className="text-3xl font-black text-white">{metrics.avgStartTickets}</div>
                </div>

                <div className="bg-[#111111] rounded-xl shadow-sm border border-black p-5 flex flex-col justify-center">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5"/> MÉDIA INÍCIO (CHATS)
                    </div>
                    <div className="text-3xl font-black text-white">{metrics.avgStartChats}</div>
                </div>

                <div className="bg-[#111111] rounded-xl shadow-sm border border-black p-5 flex flex-col justify-center">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Ticket className="w-3.5 h-3.5"/> MÉDIA FIM (CHAMADOS)
                    </div>
                    <div className="text-3xl font-black text-white">{metrics.avgEndTickets}</div>
                </div>

                <div className="bg-[#111111] rounded-xl shadow-sm border border-black p-5 flex flex-col justify-center">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5"/> MÉDIA FIM (CHATS)
                    </div>
                    <div className="text-3xl font-black text-white">{metrics.avgEndChats}</div>
                </div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
                    <h3 className="text-sm font-bold text-zinc-900 mb-6">Evolução de Chamados (Início x Fim)</h3>
                    <div className="h-64 w-full">
                        {historicalData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={historicalData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tick={{fontSize: 11, fill: '#71717a'}} tickFormatter={(val) => val.split('-').slice(1).join('/')} axisLine={false} tickLine={false} />
                                    <YAxis tick={{fontSize: 11, fill: '#71717a'}} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                    <Legend wrapperStyle={{fontSize: '11px', paddingTop: '10px'}} iconType="circle" />
                                    <Line type="monotone" dataKey="startTickets" name="Início" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{r: 6}} connectNulls />
                                    <Line type="monotone" dataKey="endTickets" name="Fim" stroke="#E60000" strokeWidth={3} dot={false} connectNulls />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-zinc-400 text-sm">Sem dados suficientes</div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
                    <h3 className="text-sm font-bold text-zinc-900 mb-6">Distribuição de Chats na Fila (Início)</h3>
                    <div className="h-64 w-full">
                        {historicalData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={historicalData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tick={{fontSize: 11, fill: '#71717a'}} tickFormatter={(val) => val.split('-').slice(1).join('/')} axisLine={false} tickLine={false} />
                                    <YAxis tick={{fontSize: 11, fill: '#71717a'}} axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{fill: '#f4f4f5'}} contentStyle={{borderRadius: '8px', border: '1px solid #e4e4e7'}} />
                                    <Bar dataKey="startChats" name="Chats no Início" fill="#00B87C" radius={[4, 4, 0, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-zinc-400 text-sm">Sem dados suficientes</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabela de Últimos Registros */}
            <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
                <div className="p-5 border-b border-zinc-200 flex justify-between items-center bg-white">
                    <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-zinc-500" /> Últimos Registros
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#111111] text-white text-[11px] uppercase tracking-wider font-semibold">
                                <th className="p-4">Data</th>
                                <th className="p-4">Chamados (Início)</th>
                                <th className="p-4">Chats (Início)</th>
                                <th className="p-4">Chamados (Fim)</th>
                                <th className="p-4">Chats (Fim)</th>
                                <th className="p-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-zinc-700 divide-y divide-zinc-100">
                            {sortedData.length > 0 ? sortedData.slice(0, 10).map((row) => (
                                <tr key={row.id} className="hover:bg-zinc-50 transition-colors">
                                    <td className="p-4 font-medium">
                                        {row.date.split('-').reverse().join('/')}
                                    </td>
                                    <td className="p-4">{row.startTickets !== null && row.startTickets !== undefined ? row.startTickets : '-'}</td>
                                    <td className="p-4">{row.startChats !== null && row.startChats !== undefined ? row.startChats : '-'}</td>
                                    <td className="p-4">{row.endTickets !== null && row.endTickets !== undefined ? row.endTickets : '-'}</td>
                                    <td className="p-4">{row.endChats !== null && row.endChats !== undefined ? row.endChats : '-'}</td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-end gap-3">
                                            <button onClick={() => openEdit(row)} className="text-amber-500 hover:text-amber-600 transition-colors">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(row.id)} className="text-red-500 hover:text-red-600 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" className="p-6 text-center text-zinc-500 text-sm">
                                        Nenhum registro encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-3 bg-zinc-50 border-t border-zinc-200 text-center text-xs text-zinc-500">
                    Exibindo os últimos 10 dias registrados.
                </div>
            </div>

            {/* Modal de Lançamento */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-red-600" />
                                Registro Diário
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-6">
                            {message && (
                                <div className={`p-3 rounded-lg text-sm mb-5 flex items-center gap-2 font-medium ${message.includes('Erro') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                    <AlertCircle className="w-4 h-4" /> {message}
                                </div>
                            )}

                            <form onSubmit={handleSave} className="space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Data Referência</label>
                                    <div className="relative">
                                        <Calendar className="w-5 h-5 absolute left-3 top-2.5 text-zinc-400" />
                                        <input 
                                            type="date" 
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full pl-10 pr-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-zinc-700 font-medium transition-all"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200 space-y-4">
                                    <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-zinc-400" /> Início do Expediente
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-zinc-500 mb-1 font-medium">Chamados Pendentes</label>
                                            <input type="number" min="0" value={startTickets} onChange={e => setStartTickets(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-md outline-none focus:border-zinc-400 text-sm" placeholder="Opcional" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-zinc-500 mb-1 font-medium">Chats na Fila</label>
                                            <input type="number" min="0" value={startChats} onChange={e => setStartChats(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-md outline-none focus:border-zinc-400 text-sm" placeholder="Opcional" />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200 space-y-4">
                                    <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-zinc-400" /> Fim do Expediente
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-zinc-500 mb-1 font-medium">Chamados Pendentes</label>
                                            <input type="number" min="0" value={endTickets} onChange={e => setEndTickets(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-md outline-none focus:border-zinc-400 text-sm" placeholder="Opcional" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-zinc-500 mb-1 font-medium">Chats na Fila</label>
                                            <input type="number" min="0" value={endChats} onChange={e => setEndChats(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-md outline-none focus:border-zinc-400 text-sm" placeholder="Opcional" />
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="w-full bg-[#E60000] hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm mt-2"
                                >
                                    {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Save className="w-5 h-5" />}
                                    {isSaving ? 'Salvando...' : 'Salvar Registro'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}