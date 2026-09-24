import React, { useState, useEffect, useMemo } from 'react';
import { 
    ShieldCheck, Plus, Loader2, AlertTriangle, PieChart as PieIcon 
} from 'lucide-react';
import { collection, onSnapshot, query, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

import AuditMetrics from '../components/audits/AuditMetrics';
import AuditFilters from '../components/audits/AuditFilters';
import AuditRanking from '../components/audits/AuditRanking';
import AuditTable from '../components/audits/AuditTable';
import AuditFormModal from '../components/audits/AuditFormModal';
import AuditDetailsModal from '../components/audits/AuditDetailsModal';

export default function Audits() {
    const { showToast } = useNotification();
    const { currentUser } = useAuth();
    
    const [audits, setAudits] = useState([]);
    const [qaProcesses, setQaProcesses] = useState([]);
    const [collaboratorsMap, setCollaboratorsMap] = useState({});
    const [collaboratorsList, setCollaboratorsList] = useState([]);
    const [loading, setLoading] = useState(true);

    // Estados de Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [periodFilter, setPeriodFilter] = useState('all'); // 'all' | 'today' | '7d' | 'month'
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'Conforme' | 'Não Conforme'
    const [processFilter, setProcessFilter] = useState('all');
    const [colabFilter, setColabFilter] = useState('all');
    const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'oldest' | 'score_desc' | 'score_asc'

    // Modais
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingAudit, setEditingAudit] = useState(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [viewingAudit, setViewingAudit] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [saving, setSaving] = useState(false);

    // --- CARREGAMENTO DO FIRESTORE EM TEMPO REAL ---
    useEffect(() => {
        // 1. Busca Colaboradores
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

        // 2. Busca Processos/Checklists de QA
        const unsubProcesses = onSnapshot(collection(db, "qa_processes"), (snap) => {
            const fetched = [];
            snap.forEach(d => fetched.push({ id: d.id, ...d.data() }));
            fetched.sort((a, b) => a.name.localeCompare(b.name));
            setQaProcesses(fetched);
        });

        // 3. Busca Auditorias
        const qAudits = query(collection(db, "qa_audits"));
        const unsubAudits = onSnapshot(qAudits, (snap) => {
            const fetched = [];
            snap.forEach(d => fetched.push({ id: d.id, ...d.data() }));
            setAudits(fetched);
            setLoading(false);
        });

        return () => { 
            unsubColabs(); 
            unsubProcesses(); 
            unsubAudits(); 
        };
    }, []);

    // --- FILTRAGEM E ORDENAÇÃO DE AUDITORIAS ---
    const filteredAudits = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const sevenDaysAgo = startOfToday - (7 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        return audits.filter(audit => {
            // 1. Filtro de Texto (busca)
            if (searchTerm.trim()) {
                const query = searchTerm.toLowerCase();
                const colabName = (collaboratorsMap[audit.colabId] || '').toLowerCase();
                const protocol = (audit.protocol || '').toLowerCase();
                const processName = (audit.processName || '').toLowerCase();
                const notes = (audit.notes || '').toLowerCase();

                const match = colabName.includes(query) || 
                              protocol.includes(query) || 
                              processName.includes(query) || 
                              notes.includes(query);
                if (!match) return false;
            }

            // 2. Filtro de Status
            if (statusFilter !== 'all' && audit.status !== statusFilter) {
                return false;
            }

            // 3. Filtro de Processo
            if (processFilter !== 'all' && audit.processId !== processFilter) {
                return false;
            }

            // 4. Filtro de Colaborador
            if (colabFilter !== 'all' && audit.colabId !== colabFilter) {
                return false;
            }

            // 5. Filtro de Período
            if (periodFilter !== 'all' && audit.date) {
                const auditTime = new Date(audit.date).getTime();
                if (periodFilter === 'today' && auditTime < startOfToday) {
                    return false;
                }
                if (periodFilter === '7d' && auditTime < sevenDaysAgo) {
                    return false;
                }
                if (periodFilter === 'month' && auditTime < startOfMonth) {
                    return false;
                }
            }

            return true;
        }).sort((a, b) => {
            // Ordenação
            if (sortBy === 'recent') {
                const timeA = a.date ? new Date(a.date).getTime() : 0;
                const timeB = b.date ? new Date(b.date).getTime() : 0;
                return timeB - timeA;
            }
            if (sortBy === 'oldest') {
                const timeA = a.date ? new Date(a.date).getTime() : 0;
                const timeB = b.date ? new Date(b.date).getTime() : 0;
                return timeA - timeB;
            }
            if (sortBy === 'score_desc') {
                const scoreA = a.score !== undefined ? a.score : (a.status === 'Conforme' ? 100 : 0);
                const scoreB = b.score !== undefined ? b.score : (b.status === 'Conforme' ? 100 : 0);
                return scoreB - scoreA;
            }
            if (sortBy === 'score_asc') {
                const scoreA = a.score !== undefined ? a.score : (a.status === 'Conforme' ? 100 : 0);
                const scoreB = b.score !== undefined ? b.score : (b.status === 'Conforme' ? 100 : 0);
                return scoreA - scoreB;
            }
            return 0;
        });
    }, [audits, searchTerm, statusFilter, processFilter, colabFilter, periodFilter, sortBy, collaboratorsMap]);

    // --- CÁLCULO DE DASHBOARD STATS E RANKING ---
    const { dashboardStats, rankingData, pieData } = useMemo(() => {
        const stats = { 
            total: 0, 
            conformes: 0, 
            naoConformes: 0, 
            taxa: 0,
            evaluatedColabsCount: 0,
            totalColabsCount: collaboratorsList.length
        };
        const colabStats = {};

        // Baseia as estatísticas na seleção filtrada atual
        filteredAudits.forEach(audit => {
            stats.total++;
            const isConforme = audit.status === 'Conforme';
            
            if (isConforme) stats.conformes++;
            else stats.naoConformes++;

            if (audit.colabId) {
                if (!colabStats[audit.colabId]) {
                    colabStats[audit.colabId] = { 
                        id: audit.colabId, 
                        name: collaboratorsMap[audit.colabId] || 'Desconhecido', 
                        total: 0, 
                        conformes: 0 
                    };
                }
                colabStats[audit.colabId].total++;
                if (isConforme) colabStats[audit.colabId].conformes++;
            }
        });

        stats.taxa = stats.total > 0 ? ((stats.conformes / stats.total) * 100).toFixed(1) : '0.0';
        stats.evaluatedColabsCount = Object.keys(colabStats).length;

        const ranking = Object.values(colabStats).map(c => ({
            ...c,
            taxa: ((c.conformes / c.total) * 100).toFixed(1)
        })).sort((a, b) => parseFloat(b.taxa) - parseFloat(a.taxa) || b.total - a.total); 

        const pData = [
            { name: 'Conformes', value: stats.conformes, color: '#10b981' },
            { name: 'Não Conformes', value: stats.naoConformes, color: '#ef4444' }
        ];

        return { dashboardStats: stats, rankingData: ranking, pieData: pData };
    }, [filteredAudits, collaboratorsMap, collaboratorsList]);

    const hasActiveFilters = searchTerm !== '' || periodFilter !== 'all' || statusFilter !== 'all' || processFilter !== 'all' || colabFilter !== 'all' || sortBy !== 'recent';

    const handleResetFilters = () => {
        setSearchTerm('');
        setPeriodFilter('all');
        setStatusFilter('all');
        setProcessFilter('all');
        setColabFilter('all');
        setSortBy('recent');
    };

    // --- AÇÕES DO FORMULÁRIO (SALVAR AUDITORIA) ---
    const handleOpenNewModal = () => {
        setEditingAudit(null);
        setIsFormModalOpen(true);
    };

    const handleOpenEditModal = (audit) => {
        setEditingAudit(audit);
        setIsFormModalOpen(true);
    };

    const handleOpenViewModal = (audit) => {
        setViewingAudit(audit);
        setIsDetailsModalOpen(true);
    };

    const handleSaveAudit = async (payload) => {
        setSaving(true);
        try {
            const dataToSave = {
                ...payload,
                updatedAt: new Date()
            };

            if (editingAudit?.id) {
                await updateDoc(doc(db, "qa_audits", editingAudit.id), dataToSave);
                showToast("Auditoria atualizada com sucesso!", "success");
            } else {
                dataToSave.evaluatorId = currentUser?.firestoreId || currentUser?.uid || 'unknown';
                dataToSave.evaluatorName = currentUser?.name || currentUser?.displayName || currentUser?.email || 'Administrador';
                dataToSave.createdAt = new Date();
                
                await addDoc(collection(db, "qa_audits"), dataToSave);
                showToast("Auditoria registrada com sucesso!", "success");
            }
            setIsFormModalOpen(false);
            setEditingAudit(null);
        } catch (error) {
            showToast("Erro ao salvar: " + error.message, "error");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAudit = async () => {
        if (!deletingId) return;
        try {
            await deleteDoc(doc(db, "qa_audits", deletingId));
            showToast("Auditoria removida com sucesso.", "success");
            setDeletingId(null);
        } catch (error) {
            showToast("Erro ao excluir auditoria: " + error.message, "error");
        }
    };

    // --- EXPORTAR CSV ---
    const handleExportCsv = () => {
        if (filteredAudits.length === 0) {
            showToast("Nenhum registro para exportar com os filtros atuais.", "error");
            return;
        }

        const headers = ["Data", "Colaborador", "Protocolo", "Canal", "Processo", "Status", "Score(%)", "Avaliador", "Observações"];
        const rows = filteredAudits.map(a => [
            `"${a.date || ''}"`,
            `"${(collaboratorsMap[a.colabId] || 'Desconhecido').replace(/"/g, '""')}"`,
            `"${(a.protocol || '').replace(/"/g, '""')}"`,
            `"${(a.channel || 'Ticket').replace(/"/g, '""')}"`,
            `"${(a.processName || '').replace(/"/g, '""')}"`,
            `"${a.status || ''}"`,
            `"${a.score !== undefined ? a.score : (a.status === 'Conforme' ? 100 : 0)}"`,
            `"${(a.evaluatorName || '').replace(/"/g, '""')}"`,
            `"${(a.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `auditorias_qa_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast("Relatório CSV gerado com sucesso!", "success");
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col justify-center items-center h-full bg-gray-50">
                <Loader2 className="w-9 h-9 text-red-600 animate-spin mb-3" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Carregando painel de qualidade...
                </span>
            </div>
        );
    }

    return (
        <div className="flex-1 p-4 sm:p-6 h-full overflow-y-auto bg-gray-50 flex flex-col">
            {/* Cabeçalho da Página */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs shrink-0">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-sm shrink-0">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                            Auditorias de Qualidade (QA)
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Gestão de conformidade, checklists auditáveis e histórico de desempenho da equipe.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
                    <button 
                        id="btn-nova-auditoria"
                        onClick={handleOpenNewModal} 
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs hover:shadow cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nova Auditoria</span>
                    </button>
                </div>
            </header>

            {/* Painel de Métricas e Indicadores Rápidos */}
            <AuditMetrics stats={dashboardStats} targetRate={80} />

            {/* Linha Analítica: Distribuição (Gráfico Donut) e Ranking de Conformidade */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 shrink-0">
                {/* Gráfico de Distribuição Donut (4 colunas no desktop) */}
                <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                            <PieIcon className="w-4 h-4 text-gray-500" />
                            Distribuição dos Resultados
                        </h3>
                        <span className="text-[10px] font-mono font-bold text-gray-400">
                            {dashboardStats.total} avaliações
                        </span>
                    </div>

                    <div className="h-56 my-auto flex items-center justify-center">
                        {dashboardStats.total === 0 ? (
                            <div className="text-center text-gray-400 text-xs">
                                Sem dados no período filtrado.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={pieData} 
                                        cx="50%" 
                                        cy="50%" 
                                        innerRadius={55} 
                                        outerRadius={80} 
                                        paddingAngle={5} 
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip 
                                        contentStyle={{
                                            borderRadius: '12px', 
                                            border: '1px solid #e5e7eb', 
                                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                            fontSize: '12px',
                                            fontWeight: 'bold'
                                        }} 
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Rodapé do Card do Gráfico */}
                    <div className="pt-2 border-t border-gray-100 flex justify-between text-xs">
                        <span className="text-gray-500">Aproveitamento Global:</span>
                        <span className={`font-black font-mono ${
                            parseFloat(dashboardStats.taxa) >= 80 ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                            {dashboardStats.taxa}% de conformidade
                        </span>
                    </div>
                </div>

                {/* Ranking de Conformidade dos Colaboradores (8 colunas no desktop) */}
                <div className="lg:col-span-8">
                    <AuditRanking rankingData={rankingData} targetRate={80} />
                </div>
            </div>

            {/* Barra de Filtros Completos */}
            <AuditFilters
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                periodFilter={periodFilter}
                setPeriodFilter={setPeriodFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                processFilter={processFilter}
                setProcessFilter={setProcessFilter}
                colabFilter={colabFilter}
                setColabFilter={setColabFilter}
                sortBy={sortBy}
                setSortBy={setSortBy}
                onResetFilters={handleResetFilters}
                hasActiveFilters={hasActiveFilters}
                processesList={qaProcesses}
                collaboratorsList={collaboratorsList}
                totalFiltered={filteredAudits.length}
                onExportCsv={handleExportCsv}
            />

            {/* Tabela de Auditorias Completa com Paginação */}
            <AuditTable
                audits={filteredAudits}
                collaboratorsMap={collaboratorsMap}
                onView={handleOpenViewModal}
                onEdit={handleOpenEditModal}
                onDelete={(id) => setDeletingId(id)}
            />

            {/* Modal de Nova / Editar Auditoria */}
            <AuditFormModal
                isOpen={isFormModalOpen}
                onClose={() => { setIsFormModalOpen(false); setEditingAudit(null); }}
                auditToEdit={editingAudit}
                collaboratorsList={collaboratorsList}
                qaProcesses={qaProcesses}
                onSave={handleSaveAudit}
                isSaving={saving}
            />

            {/* Modal de Detalhes da Auditoria */}
            <AuditDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => { setIsDetailsModalOpen(false); setViewingAudit(null); }}
                audit={viewingAudit}
                collaboratorName={viewingAudit ? collaboratorsMap[viewingAudit.colabId] : ''}
                onEdit={(audit) => {
                    setIsDetailsModalOpen(false);
                    handleOpenEditModal(audit);
                }}
            />

            {/* Modal de Confirmação de Exclusão */}
            {deletingId && (
                <div 
                    id="audit-delete-dialog-backdrop"
                    className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-4 z-[90] backdrop-blur-xs animate-in fade-in duration-150"
                >
                    <div 
                        id="audit-delete-dialog"
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-6 border border-gray-200"
                    >
                        <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-7 h-7" />
                        </div>
                        <h3 className="text-base font-bold text-gray-900 mb-1.5">
                            Excluir Registro de Auditoria?
                        </h3>
                        <p className="text-gray-500 text-xs mb-6 leading-relaxed">
                            Esta ação removerá esta auditoria permanentemente do histórico e atualizará os índices de conformidade da equipe.
                        </p>
                        <div className="flex gap-2.5">
                            <button 
                                type="button"
                                onClick={() => setDeletingId(null)} 
                                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="button"
                                onClick={handleDeleteAudit} 
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-colors shadow-xs cursor-pointer"
                            >
                                Sim, Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
