import React, { useState, useEffect } from 'react';
import { 
    AlertOctagon, Plus, Search, Eye, Edit2, Trash2, X, Loader2, AlertTriangle, FileText, CheckCircle, Clock, Filter
} from 'lucide-react';
import { collection, onSnapshot, query, doc, addDoc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

const Reports = () => {
    const { showToast } = useNotification();
    const { currentUser, userRole } = useAuth();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Controles de Modais
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewingReport, setViewingReport] = useState(null);
    const [deletingReport, setDeletingReport] = useState(null);
    
    // Form State
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        identificationMethod: 'Atendimento (Chat/Voz)',
        affectedClient: 'Não',
        howAffected: '',
        protocol: '',
        description: '',
        status: 'Pendente',
        closingComment: '' // NOVO CAMPO: Comentário de encerramento
    });
    const [saving, setSaving] = useState(false);

    // --- BUSCA DE DADOS COM REGRA DE VISÃO ---
    useEffect(() => {
        if (!currentUser) return;

        let q;
        // Se for admin, vê tudo. Se não, vê apenas os que ele mesmo criou.
        if (userRole === 'admin') {
            q = query(collection(db, "critical_reports"));
        } else {
            q = query(collection(db, "critical_reports"), where("creatorId", "==", currentUser.firestoreId));
        }
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedData = [];
            snapshot.forEach((doc) => {
                fetchedData.push({ id: doc.id, ...doc.data() });
            });
            
            // Ordenação pelo mais recente
            fetchedData.sort((a, b) => {
                const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return dateB - dateA;
            });
            
            setReports(fetchedData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, userRole]);

    // --- FILTRAGEM ---
    const filteredReports = reports.filter(r => {
        const matchSearch = searchTerm === '' || 
            (r.title && r.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (r.protocol && r.protocol.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (r.creatorName && r.creatorName.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchStatus = statusFilter === '' || r.status === statusFilter;

        return matchSearch && matchStatus;
    });

    // --- PERMISSÕES ---
    const canEditOrDelete = (report) => {
        return userRole === 'admin' || report.creatorId === currentUser.firestoreId;
    };

    const canChangeStatus = userRole === 'admin';

    // --- AÇÕES DO FORMULÁRIO ---
    const openNewReportModal = () => {
        setEditingId(null);
        setFormData({
            title: '',
            date: new Date().toISOString().split('T')[0],
            identificationMethod: 'Atendimento (Chat/Voz)',
            affectedClient: 'Não',
            howAffected: '',
            protocol: '',
            description: '',
            status: 'Pendente',
            closingComment: ''
        });
        setIsModalOpen(true);
    };

    const openEditModal = (report) => {
        setEditingId(report.id);
        setFormData({
            title: report.title || '',
            date: report.date || '',
            identificationMethod: report.identificationMethod || '',
            affectedClient: report.affectedClient || 'Não',
            howAffected: report.howAffected || '',
            protocol: report.protocol || '',
            description: report.description || '',
            status: report.status || 'Pendente',
            closingComment: report.closingComment || ''
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const reportPayload = {
                ...formData,
                updatedAt: new Date()
            };

            if (editingId) {
                await updateDoc(doc(db, "critical_reports", editingId), reportPayload);
                showToast("Relatório atualizado com sucesso!", "success");
            } else {
                reportPayload.creatorId = currentUser.firestoreId;
                reportPayload.creatorName = currentUser.name;
                reportPayload.createdAt = new Date();
                await addDoc(collection(db, "critical_reports"), reportPayload);
                showToast("Relatório criado com sucesso!", "success");
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
            await deleteDoc(doc(db, "critical_reports", deletingReport.id));
            showToast("Relatório excluído permanentemente.", "success");
            setDeletingReport(null);
        } catch (error) {
            showToast("Erro ao excluir: " + error.message, "error");
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Resolvido':
                return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1 w-max"><CheckCircle className="w-3 h-3"/> Resolvido</span>;
            case 'Em Andamento':
                return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 flex items-center gap-1 w-max"><Loader2 className="w-3 h-3 animate-spin"/> Em Andamento</span>;
            default:
                return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 flex items-center gap-1 w-max"><Clock className="w-3 h-3"/> Pendente</span>;
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 h-full">
                <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 h-full overflow-y-auto bg-gray-50 flex flex-col">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <AlertOctagon className="w-6 h-6 text-red-600" />
                        Registro de Erros Críticos
                    </h1>
                    <p className="text-sm text-gray-500">Documentação e acompanhamento de problemas e falhas graves.</p>
                </div>
                <button 
                    onClick={openNewReportModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold transition-colors shadow-sm"
                >
                    <Plus className="w-5 h-5" />
                    Adicionar Registro
                </button>
            </header>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 shrink-0 flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                    <input 
                        type="text" 
                        placeholder="Buscar por título, protocolo ou autor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none text-sm"
                    />
                </div>
                
                <div className="sm:w-64 relative">
                    <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none text-sm appearance-none bg-white cursor-pointer text-gray-600 font-medium"
                    >
                        <option value="">Todos os Status</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Em Andamento">Em Andamento</option>
                        <option value="Resolvido">Resolvido</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                {filteredReports.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                        <FileText className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-lg font-medium text-gray-500">Nenhum relatório encontrado.</p>
                        <p className="text-sm">Os registros criados aparecerão aqui.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto flex-1">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-zinc-950 text-white sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 text-left font-semibold">Data</th>
                                    <th className="px-6 py-3 text-left font-semibold">Status</th>
                                    <th className="px-6 py-3 text-left font-semibold">Título</th>
                                    <th className="px-6 py-3 text-left font-semibold">Meio Identificação</th>
                                    <th className="px-6 py-3 text-left font-semibold">Afetou Cliente?</th>
                                    <th className="px-6 py-3 text-left font-semibold">Criado Por</th>
                                    <th className="px-6 py-3 text-right font-semibold">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredReports.map((report) => (
                                    <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                            {report.date ? new Date(report.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'Sem data'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(report.status)}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-900 max-w-[200px] truncate" title={report.title}>
                                            {report.title}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 font-medium">
                                            {report.identificationMethod}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`font-bold ${report.affectedClient === 'Sim' ? 'text-red-600' : 'text-gray-500'}`}>
                                                {report.affectedClient}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {report.creatorName}
                                        </td>
                                        
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            <button onClick={() => setViewingReport(report)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Ver Detalhes">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            
                                            {canEditOrDelete(report) && (
                                                <>
                                                    <button onClick={() => openEditModal(report)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="Editar">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setDeletingReport(report)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Excluir">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 bg-zinc-950 text-white flex justify-between items-center shrink-0">
                            <h3 className="font-bold flex items-center gap-2">
                                <AlertOctagon className="w-4 h-4 text-red-500" />
                                {editingId ? 'Editar Relatório de Erro' : 'Novo Relatório de Erro'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            <form id="reportForm" onSubmit={handleSubmit} className="space-y-4">
                                
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título do Relato</label>
                                    <input type="text" required placeholder="Ex: Queda na integração de pagamentos..." value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none font-medium" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data do Ocorrido</label>
                                        <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Meio de Identificação</label>
                                        <select required value={formData.identificationMethod} onChange={(e) => setFormData({...formData, identificationMethod: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none">
                                            <option value="Atendimento (Chat/Voz)">Atendimento (Chat/Voz)</option>
                                            <option value="Monitoramento Interno">Monitoramento Interno</option>
                                            <option value="ReclameAqui / Ouvidoria">ReclameAqui / Ouvidoria</option>
                                            <option value="Relato Externo (Parceiro)">Relato Externo (Parceiro)</option>
                                            <option value="Outros">Outros</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Afetou o Cliente?</label>
                                        <select required value={formData.affectedClient} onChange={(e) => setFormData({...formData, affectedClient: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none">
                                            <option value="Não">Não</option>
                                            <option value="Sim">Sim</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Protocolo (Opcional)</label>
                                        <input type="text" placeholder="Ex: 2026040182" value={formData.protocol} onChange={(e) => setFormData({...formData, protocol: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
                                    </div>
                                </div>

                                {formData.affectedClient === 'Sim' && (
                                    <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                                        <label className="block text-xs font-bold text-red-800 uppercase mb-1">Como afetou o cliente?</label>
                                        <textarea required rows="2" placeholder="Descreva o impacto..." value={formData.howAffected} onChange={(e) => setFormData({...formData, howAffected: e.target.value})} className="w-full p-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-600 outline-none bg-white" />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição Detalhada / Informações Adicionais</label>
                                    <textarea required rows="4" placeholder="Descreva o erro crítico, passo a passo, evidências..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
                                </div>

                                {/* ÁREA EXCLUSIVA DO ADMIN - STATUS E COMENTÁRIO DE ENCERRAMENTO */}
                                {canChangeStatus && (
                                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-4 mt-2">
                                        <div>
                                            <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Status do Problema</label>
                                            <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full p-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white font-bold text-blue-900">
                                                <option value="Pendente">Pendente</option>
                                                <option value="Em Andamento">Em Andamento</option>
                                                <option value="Resolvido">Resolvido</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Comentário de Resolução / Encerramento</label>
                                            <textarea 
                                                rows="2" 
                                                placeholder="O que foi feito pela equipe para resolver este problema?" 
                                                value={formData.closingComment} 
                                                onChange={(e) => setFormData({...formData, closingComment: e.target.value})} 
                                                className="w-full p-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-800" 
                                            />
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>
                        
                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3 shrink-0">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white font-medium transition-colors">Cancelar</button>
                            <button type="submit" form="reportForm" disabled={saving} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-70 flex justify-center items-center gap-2">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertOctagon className="w-4 h-4" />}
                                Salvar Registro
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE VISUALIZAÇÃO DE DETALHES */}
            {viewingReport && (
                <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 bg-zinc-950 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2 truncate max-w-[80%]" title={viewingReport.title}>
                                {viewingReport.title || 'Detalhes do Relatório'}
                            </h3>
                            <button onClick={() => setViewingReport(null)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                                <div>
                                    <span className="block text-xs font-bold text-gray-400 uppercase">Status Atual</span>
                                    <div className="mt-1">{getStatusBadge(viewingReport.status)}</div>
                                </div>
                                <div className="text-right">
                                    <span className="block text-xs font-bold text-gray-400 uppercase">Data Ocorrido</span>
                                    <span className="block font-medium text-gray-900">{viewingReport.date ? new Date(viewingReport.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '--'}</span>
                                </div>
                            </div>

                            {/* COMENTÁRIO DE ENCERRAMENTO DESTACADO (SE EXISTIR) */}
                            {viewingReport.closingComment && (
                                <div className={`p-4 rounded-lg border ${viewingReport.status === 'Resolvido' ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
                                    <span className={`block text-xs font-bold uppercase mb-1 ${viewingReport.status === 'Resolvido' ? 'text-emerald-800' : 'text-blue-800'}`}>
                                        Comentário de Encerramento (Admin)
                                    </span>
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{viewingReport.closingComment}</p>
                                </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-xs font-bold text-gray-400 uppercase">Identificação</span>
                                    <span className="block text-gray-900">{viewingReport.identificationMethod}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-bold text-gray-400 uppercase">Protocolo vinculado</span>
                                    <span className="block text-gray-900">{viewingReport.protocol || 'Nenhum'}</span>
                                </div>
                            </div>

                            <div>
                                <span className="block text-xs font-bold text-gray-400 uppercase">Autor do Relato</span>
                                <span className="block text-gray-900">{viewingReport.creatorName}</span>
                            </div>

                            <div className={`p-3 rounded-lg ${viewingReport.affectedClient === 'Sim' ? 'bg-red-50 border border-red-100' : 'bg-gray-50 border border-gray-100'}`}>
                                <span className={`block text-xs font-bold uppercase mb-1 ${viewingReport.affectedClient === 'Sim' ? 'text-red-800' : 'text-gray-500'}`}>Afetou o Cliente?</span>
                                <span className="block font-bold mb-2">{viewingReport.affectedClient}</span>
                                {viewingReport.affectedClient === 'Sim' && (
                                    <>
                                        <span className="block text-xs font-bold text-red-800 uppercase mt-2 mb-1">Como:</span>
                                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{viewingReport.howAffected}</p>
                                    </>
                                )}
                            </div>

                            <div>
                                <span className="block text-xs font-bold text-gray-400 uppercase mb-1">Descrição do Problema</span>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-100">{viewingReport.description}</p>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-200">
                            <button onClick={() => setViewingReport(null)} className="w-full py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300">Fechar Detalhes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE DELEÇÃO */}
            {deletingReport && (
                <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-6">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Apagar Relatório?</h3>
                        <p className="text-gray-500 text-sm mb-6">Esta ação não pode ser desfeita. O registro deste erro será removido permanentemente.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeletingReport(null)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Cancelar</button>
                            <button onClick={handleDelete} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Sim, Apagar</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Reports;