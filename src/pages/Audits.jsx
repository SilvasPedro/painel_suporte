import React, { useState, useEffect, useMemo } from 'react';
import { 
    ShieldCheck, Plus, Search, Eye, Edit2, Trash2, X, Loader2, 
    AlertTriangle, CheckCircle, XCircle, BarChart2, Award, FileText
} from 'lucide-react';
import { collection, onSnapshot, query, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

const Audits = () => {
    const { showToast } = useNotification();
    const { currentUser } = useAuth();
    const [audits, setAudits] = useState([]);
    const [collaboratorsMap, setCollaboratorsMap] = useState({});
    const [collaboratorsList, setCollaboratorsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        colabId: '',
        date: new Date().toISOString().split('T')[0],
        protocol: '',
        status: 'Conforme',
        notes: ''
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const unsubColabs = onSnapshot(collection(db, "collaborators"), (snap) => {
            const map = {};
            const list = [];
            snap.forEach(d => {
                map[d.id] = d.data().name;
                list.push({ id: d.id, name: d.data().name });
            });
            list.sort((a, b) => a.name.localeCompare(b.name));
            setCollaboratorsMap(map);
            setCollaboratorsList(list);
        });

        const qAudits = query(collection(db, "qa_audits"));
        const unsubAudits = onSnapshot(qAudits, (snap) => {
            const fetched = [];
            snap.forEach(d => fetched.push({ id: d.id, ...d.data() }));
            
            fetched.sort((a, b) => {
                const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return dateB - dateA;
            });
            
            setAudits(fetched);
            setLoading(false);
        });

        return () => { unsubColabs(); unsubAudits(); };
    }, []);

    const { dashboardStats, rankingData, pieData } = useMemo(() => {
        const stats = { total: 0, conformes: 0, naoConformes: 0, taxa: 0 };
        const colabStats = {};

        audits.forEach(audit => {
            stats.total++;
            const isConforme = audit.status === 'Conforme';
            
            if (isConforme) stats.conformes++;
            else stats.naoConformes++;

            if (!colabStats[audit.colabId]) {
                colabStats[audit.colabId] = { id: audit.colabId, name: collaboratorsMap[audit.colabId] || 'Desconhecido', total: 0, conformes: 0 };
            }
            colabStats[audit.colabId].total++;
            if (isConforme) colabStats[audit.colabId].conformes++;
        });

        stats.taxa = stats.total > 0 ? ((stats.conformes / stats.total) * 100).toFixed(1) : 0;

        const ranking = Object.values(colabStats).map(c => ({
            ...c,
            taxa: ((c.conformes / c.total) * 100).toFixed(1)
        })).sort((a, b) => b.taxa - a.taxa || b.total - a.total); 

        const pData = [
            { name: 'Conformes', value: stats.conformes, color: '#10b981' },
            { name: 'Não Conformes', value: stats.naoConformes, color: '#ef4444' }
        ];

        return { dashboardStats: stats, rankingData: ranking, pieData: pData };
    }, [audits, collaboratorsMap]);

    const openNewModal = () => {
        setEditingId(null);
        setFormData({ colabId: '', date: new Date().toISOString().split('T')[0], protocol: '', status: 'Conforme', notes: '' });
        setIsModalOpen(true);
    };

    const openEditModal = (audit) => {
        setEditingId(audit.id);
        setFormData({
            colabId: audit.colabId || '',
            date: audit.date || '',
            protocol: audit.protocol || '',
            status: audit.status || 'Conforme',
            notes: audit.notes || ''
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.colabId) {
            showToast("Selecione um colaborador.", "error");
            return;
        }

        setSaving(true);
        try {
            const payload = { ...formData, updatedAt: new Date() };

            if (editingId) {
                await updateDoc(doc(db, "qa_audits", editingId), payload);
                showToast("Auditoria atualizada!", "success");
            } else {
                payload.evaluatorId = currentUser?.firestoreId || currentUser?.uid || 'unknown';
                payload.evaluatorName = currentUser?.name || currentUser?.displayName || currentUser?.email || 'Administrador';
                payload.createdAt = new Date();
                
                await addDoc(collection(db, "qa_audits"), payload);
                showToast("Auditoria registrada com sucesso!", "success");
            }
            setIsModalOpen(false);
        } catch (error) {
            showToast("Erro ao salvar: " + error.message, "error");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            await deleteDoc(doc(db, "qa_audits", deletingId));
            showToast("Auditoria excluída.", "success");
            setDeletingId(null);
        } catch (error) {
            showToast("Erro ao excluir.", "error");
        }
    };

    const filteredAudits = audits.filter(a => {
        const colabName = collaboratorsMap[a.colabId] || '';
        return searchTerm === '' || 
               colabName.toLowerCase().includes(searchTerm.toLowerCase()) || 
               (a.protocol && a.protocol.toLowerCase().includes(searchTerm.toLowerCase()));
    });

    if (loading) {
        return <div className="flex-1 flex justify-center items-center h-full"><Loader2 className="w-8 h-8 text-red-600 animate-spin" /></div>;
    }

    return (
        <div className="flex-1 p-6 h-full overflow-y-auto bg-gray-50 flex flex-col">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-red-600" /> Auditorias de Qualidade (QA)
                    </h1>
                    <p className="text-sm text-gray-500">Acompanhamento de conformidade dos atendimentos.</p>
                </div>
                <button onClick={openNewModal} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold transition-colors shadow-sm">
                    <Plus className="w-5 h-5" /> Nova Auditoria
                </button>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 shrink-0">
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><BarChart2 className="w-3 h-3"/> Total Auditado</span>
                    <span className="text-3xl font-extrabold text-gray-900 mt-2">{dashboardStats.total}</span>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between border-l-4 border-l-emerald-500">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Conformes</span>
                    <span className="text-3xl font-extrabold text-gray-900 mt-2">{dashboardStats.conformes}</span>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between border-l-4 border-l-red-500">
                    <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest flex items-center gap-1"><XCircle className="w-3 h-3"/> Não Conformes</span>
                    <span className="text-3xl font-extrabold text-gray-900 mt-2">{dashboardStats.naoConformes}</span>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between relative overflow-hidden bg-zinc-950 text-white">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> Taxa Global (QA)</span>
                    <span className="text-3xl font-extrabold mt-2 text-emerald-400">{dashboardStats.taxa}%</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 shrink-0">
                
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center h-80">
                    <h3 className="text-sm font-bold text-gray-700 w-full text-left mb-2">Distribuição de Resultados</h3>
                    {dashboardStats.total === 0 ? (
                        <p className="text-gray-400 text-sm m-auto">Sem dados suficientes.</p>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                </Pie>
                                <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm col-span-1 lg:col-span-2 flex flex-col h-80 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-500" />
                        <h3 className="text-sm font-bold text-gray-700">Ranking de Conformidade (QA)</h3>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2">
                        {rankingData.length === 0 ? (
                            <p className="text-gray-400 text-sm text-center mt-10">Nenhum colaborador avaliado.</p>
                        ) : (
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-gray-400 text-[10px] uppercase tracking-wider text-left border-b border-gray-100">
                                        <th className="pb-2 pl-4">Posição</th>
                                        <th className="pb-2">Colaborador</th>
                                        <th className="pb-2 text-center">Auditorias</th>
                                        <th className="pb-2 text-right pr-4">Taxa (%)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rankingData.map((colab, index) => (
                                        <tr key={colab.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                            <td className="py-3 pl-4 font-bold text-gray-500">{index + 1}º</td>
                                            <td className="py-3 font-medium text-gray-900">{colab.name}</td>
                                            <td className="py-3 text-center text-gray-500">{colab.total}</td>
                                            <td className="py-3 text-right pr-4">
                                                <span className={`font-bold px-2 py-1 rounded-lg ${colab.taxa >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                                    {colab.taxa}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><FileText className="w-4 h-4"/> Últimos 3 Registros</h3>
                    <div className="relative w-64">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2" />
                        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-500" />
                    </div>
                </div>
                <div className="overflow-x-auto flex-1">
                    <table className="min-w-full divide-y divide-gray-200 text-sm whitespace-nowrap">
                        <thead className="bg-zinc-950 text-white sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 text-left font-semibold">Data</th>
                                <th className="px-6 py-3 text-left font-semibold">Colaborador</th>
                                <th className="px-6 py-3 text-left font-semibold">Protocolo</th>
                                <th className="px-6 py-3 text-left font-semibold">Resultado</th>
                                <th className="px-6 py-3 text-right font-semibold">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredAudits.length === 0 ? (
                                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-400">Nenhuma auditoria encontrada.</td></tr>
                            ) : (
                                // AQUI ESTÁ A LIMITAÇÃO PARA 3 REGISTROS:
                                filteredAudits.slice(0, 3).map((a) => (
                                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-gray-500">
                                            {a.date ? new Date(a.date).toLocaleDateString('pt-BR', {timeZone:'UTC'}) : '--'}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-900">{collaboratorsMap[a.colabId] || 'Desconhecido'}</td>
                                        <td className="px-6 py-4 text-gray-600">{a.protocol || '--'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-max ${a.status === 'Conforme' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {a.status === 'Conforme' ? <CheckCircle className="w-3 h-3"/> : <XCircle className="w-3 h-3"/>}
                                                {a.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            <button onClick={() => openEditModal(a)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => setDeletingId(a.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-3 bg-gray-50 border-t border-gray-100 text-center text-xs text-gray-500 font-medium">
                    Para visualizar o histórico completo de auditorias, acesse o painel de <strong>Gestão de Dados</strong>.
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="p-4 bg-zinc-950 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-red-500" /> {editingId ? 'Editar Auditoria' : 'Nova Auditoria'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto">
                            <form id="auditForm" onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Colaborador</label>
                                    <select required value={formData.colabId} onChange={(e) => setFormData({...formData, colabId: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none">
                                        <option value="" disabled>Selecione um colaborador...</option>
                                        {collaboratorsList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data do Contato</label>
                                        <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Protocolo / ID</label>
                                        <input type="text" required placeholder="Ex: 202604018..." value={formData.protocol} onChange={(e) => setFormData({...formData, protocol: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Resultado (QA)</label>
                                    <div className="flex gap-4">
                                        <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${formData.status === 'Conforme' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}>
                                            <input type="radio" name="status" value="Conforme" checked={formData.status === 'Conforme'} onChange={(e) => setFormData({...formData, status: e.target.value})} className="hidden" />
                                            <CheckCircle className="w-5 h-5"/> <span className="font-bold">Conforme</span>
                                        </label>
                                        <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${formData.status === 'Não Conforme' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}>
                                            <input type="radio" name="status" value="Não Conforme" checked={formData.status === 'Não Conforme'} onChange={(e) => setFormData({...formData, status: e.target.value})} className="hidden" />
                                            <XCircle className="w-5 h-5"/> <span className="font-bold">Inconforme</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Observações do Auditor</label>
                                    <textarea rows="3" placeholder="Anotações, pontos de atenção, erros cometidos..." value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
                                </div>
                            </form>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white font-medium transition-colors">Cancelar</button>
                            <button type="submit" form="auditForm" disabled={saving} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-70 flex justify-center items-center gap-2">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Auditoria'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deletingId && (
                <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-6">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8 text-red-600" /></div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Apagar Auditoria?</h3>
                        <p className="text-gray-500 text-sm mb-6">Esta ação removerá o registro permanentemente do sistema.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeletingId(null)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Cancelar</button>
                            <button onClick={handleDelete} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Sim, Apagar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Audits;