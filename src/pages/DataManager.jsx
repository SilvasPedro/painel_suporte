import React, { useState, useEffect } from 'react';
import { 
    Database, Search, Calendar, Eye, Edit2, Trash2, X, Loader2, 
    MessageSquare, TrendingUp, Target, AlertTriangle, ShieldCheck, 
    ShieldAlert, CheckCircle2, MessageCircle, PhoneCall, PhoneMissed, 
    Clock, Award, Sparkles, User, Hash, FileText, Check, BarChart2
} from 'lucide-react';
import { collection, onSnapshot, query, doc, deleteDoc, updateDoc } from 'firebase/firestore';
const collectionMap = {
    "feedbacks": "feedbacks",
    "metrics": "weekly_evaluations",
    "kpis": "sector_kpis",
    "audits": "qa_audits"
};
import { db } from '../services/firebase';
import { useNotification } from '../context/NotificationContext';
import { usePermissions } from '../context/PermissionsContext';

// --- CÁLCULO DE PONTUAÇÃO DO DESEMPENHO ---
const calculateScore = (item = {}) => {
    const finalizados = Number(item.Atendimentos_Finalizados) || 0;
    const ligAtendidas = Number(item.Ligacoes_Atendidas) || 0;
    const huggy = Number(item.Atendimentos_Huggy) || 0;
    const ligPerdidas = Number(item.Ligacoes_Perdidas) || 0;
    return (finalizados * 1) + (ligAtendidas * 2) + (huggy * 1) + (ligPerdidas * -5);
};

// --- DICIONÁRIO DE TRADUÇÃO (BANCO DE DADOS -> TELA) ---
const translateKey = (key) => {
    const dictionary = {
        createdBy: 'Criado por',
        collaboratorId: 'Colaborador',
        colabId: 'Colaborador',
        protocol: 'Protocolo',
        comment: 'Comentário',
        method: 'Meio / Canal',
        type: 'Tipo',
        date: 'Data Referência',
        fcr: 'FCR (%)',
        tmr: 'TMR',
        recurrence: 'Reincidência (%)',
        Atendimentos_Finalizados: 'Atendimentos Finalizados',
        Atendimentos_Huggy: 'Atendimentos Huggy',
        Ligacoes_Atendidas: 'Ligações Atendidas',
        Ligacoes_Perdidas: 'Ligações Perdidas',
        TMA_Telefonia: 'TMA Telefonia',
        TMA_Huggy: 'TMA Huggy',
        TME_Telefonia: 'TME Telefonia',
        evaluatorName: 'Avaliador',
        evaluatorId: 'ID Avaliador',
        notes: 'Observações do Auditor',
        status: 'Status'
    };
    return dictionary[key] || key;
};

const DataManager = () => {
    const { showToast } = useNotification();
    const { canEdit, activeRoleInfo, normalizedRole } = usePermissions();
    const isEditable = canEdit('datamanager');
    
    // Adicionado a aba 'audits'
    const [activeTab, setActiveTab] = useState('feedbacks'); 
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [collaboratorsMap, setCollaboratorsMap] = useState({});
    const [collaboratorsInfo, setCollaboratorsInfo] = useState({});
    const [qaProcesses, setQaProcesses] = useState({});
    
    const [viewingItem, setViewingItem] = useState(null);
    const [editingItem, setEditingItem] = useState(null);
    const [deletingItem, setDeletingItem] = useState(null);

    // Mapeamento atualizado das coleções

    const getSafeDateString = (item) => {
        if (item.date) {
            if (typeof item.date === 'string' && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [year, month, day] = item.date.split('-');
                return `${day}/${month}/${year}`;
            }
            return item.date;
        }
        if (item.createdAt) {
            if (typeof item.createdAt.toDate === 'function') {
                return new Date(item.createdAt.toDate()).toLocaleDateString('pt-BR');
            }
            try {
                return new Date(item.createdAt).toLocaleDateString('pt-BR');
            } catch {
                return 'Data inválida';
            }
        }
        return 'Sem data';
    };

    useEffect(() => {
        const unsubColabs = onSnapshot(collection(db, "collaborators"), (snapshot) => {
            const map = {};
            const infoMap = {};
            snapshot.forEach((doc) => {
                const d = doc.data();
                map[doc.id] = d.name;
                infoMap[doc.id] = { id: doc.id, ...d };
            });
            setCollaboratorsMap(map);
            setCollaboratorsInfo(infoMap);
        });
        
        const unsubQA = onSnapshot(collection(db, "qa_processes"), (snapshot) => {
            const map = {};
            snapshot.forEach((doc) => {
                map[doc.id] = doc.data();
            });
            setQaProcesses(map);
        });

        return () => {
            unsubColabs();
            unsubQA();
        };
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        const currentCollection = collectionMap[activeTab];
        const q = query(collection(db, currentCollection)); 
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedData = [];
            snapshot.forEach((doc) => {
                fetchedData.push({ id: doc.id, ...doc.data() });
            });
            
            fetchedData.sort((a, b) => {
                const getDateValue = (item) => {
                    if (item.date) {
                        if (typeof item.date === 'string' && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            return new Date(item.date).getTime();
                        }
                    }
                    if (item.createdAt && typeof item.createdAt.toMillis === 'function') {
                        return item.createdAt.toMillis();
                    }
                    if (item.createdAt) {
                        return new Date(item.createdAt).getTime();
                    }
                    return 0;
                };
                return getDateValue(b) - getDateValue(a);
            });
            
            setData(fetchedData);
            setLoading(false);
        }, (error) => {
            showToast("Erro ao carregar dados: " + error.message, "error");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [activeTab, showToast]);

    const filteredData = data.filter(item => {
        const mappedName = collaboratorsMap[item.colabId || item.collaboratorId] || '';
        
        const matchSearch = searchTerm === '' || 
            (item.colabName && item.colabName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (mappedName.toLowerCase().includes(searchTerm.toLowerCase())) || 
            (item.type && item.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (activeTab === 'audits' && item.protocol && item.protocol.toLowerCase().includes(searchTerm.toLowerCase()));
            
        const safeDate = getSafeDateString(item);
        const matchDate = dateFilter === '' || safeDate.includes(dateFilter);
            
        return matchSearch && matchDate;
    });

    const handleDelete = async () => {
        try {
            await deleteDoc(doc(db, collectionMap[activeTab], deletingItem.id));
            showToast("Registro apagado com sucesso!", "success");
            setDeletingItem(null);
        } catch (error) {
            showToast("Erro ao apagar: " + error.message, "error");
        }
    };

    const handleEditSave = async (updatedData) => {
        try {
            const docRef = doc(db, collectionMap[activeTab], editingItem.id);
            await updateDoc(docRef, updatedData);
            showToast("Registro atualizado com sucesso!", "success");
            setEditingItem(null);
        } catch (error) {
            showToast("Erro ao atualizar: " + error.message, "error");
        }
    };

    return (
        <div className="flex-1 p-6 bg-gray-50 h-full overflow-y-auto flex flex-col">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Database className="w-6 h-6 text-red-600" />
                        Gerenciador de Dados
                    </h1>
                    <p className="text-sm text-gray-500">Auditoria, edição e exclusão de registros do sistema.</p>
                </div>
                {!isEditable && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold">
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                        Modo Leitura ({activeRoleInfo?.label || normalizedRole})
                    </div>
                )}
            </header>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 shrink-0 space-y-4">
                <div className="flex space-x-2 border-b border-gray-100 pb-4 overflow-x-auto">
                    <TabButton active={activeTab === 'feedbacks'} onClick={() => setActiveTab('feedbacks')} icon={<MessageSquare className="w-4 h-4"/>} text="Feedbacks" />
                    <TabButton active={activeTab === 'metrics'} onClick={() => setActiveTab('metrics')} icon={<TrendingUp className="w-4 h-4"/>} text="Desempenho" />
                    <TabButton active={activeTab === 'kpis'} onClick={() => setActiveTab('kpis')} icon={<Target className="w-4 h-4"/>} text="KPIs do Setor" />
                    <TabButton active={activeTab === 'audits'} onClick={() => setActiveTab('audits')} icon={<ShieldCheck className="w-4 h-4"/>} text="Auditorias QA" />
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                        <input 
                            type="text" 
                            placeholder={activeTab === 'kpis' ? "Busca desativada para KPIs globais..." : "Buscar por colaborador, tipo, ou protocolo..."}
                            disabled={activeTab === 'kpis'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none disabled:bg-gray-100"
                        />
                    </div>
                    <div className="md:w-64 relative">
                        <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                        <input 
                            type="text" 
                            placeholder="Filtrar data (ex: 13/04)"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                        <Database className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-lg font-medium text-gray-500">Nenhum registro encontrado.</p>
                        <p className="text-sm">Tente ajustar os filtros de busca.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto flex-1">
                        <table className="min-w-full divide-y divide-gray-200 text-sm whitespace-nowrap">
                            <thead className="bg-zinc-950 text-white sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 text-left font-semibold">Data / Registro</th>
                                    {activeTab !== 'kpis' && <th className="px-6 py-3 text-left font-semibold">Colaborador</th>}
                                    <th className="px-6 py-3 text-left font-semibold">Resumo do Dado</th>
                                    <th className="px-6 py-3 text-right font-semibold">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredData.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-gray-500">
                                            {getSafeDateString(item)}
                                        </td>
                                        
                                        {activeTab !== 'kpis' && (
                                            <td className="px-6 py-4 font-bold text-gray-900 truncate max-w-[250px]">
                                                {collaboratorsMap[item.colabId || item.collaboratorId] || item.colabName || item.colabId || item.collaboratorId || 'Desconhecido'}
                                            </td>
                                        )}

                                        <td className="px-6 py-4">
                                            {activeTab === 'feedbacks' && (
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                                    item.type === 'Elogio' ? 'bg-emerald-100 text-emerald-700' : 
                                                    item.type === 'Ponto de Melhoria' ? 'bg-amber-100 text-amber-700' : 
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {item.type}
                                                </span>
                                            )}
                                            {activeTab === 'metrics' && (
                                                <span className="text-gray-600">
                                                    Finalizados: <strong className="text-gray-900">{item.Atendimentos_Finalizados || 0}</strong> | Huggy: <strong className="text-gray-900">{item.Atendimentos_Huggy || 0}</strong>
                                                </span>
                                            )}
                                            {activeTab === 'kpis' && (
                                                <span className="text-gray-600">
                                                    FCR: <strong className="text-gray-900">{item.fcr}%</strong> | TMR: <strong className="text-gray-900">{item.tmr}</strong> | Reincidência: <strong className="text-gray-900">{item.recurrence}%</strong>
                                                </span>
                                            )}
                                            {activeTab === 'audits' && (
                                                <span className="text-gray-600">
                                                    Status: <strong className={item.status === 'Conforme' ? 'text-emerald-600' : 'text-red-600'}>{item.status}</strong> | Protocolo: <strong className="text-gray-900">{item.protocol || '--'}</strong>
                                                </span>
                                            )}
                                        </td>
                                        
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            <button onClick={() => setViewingItem(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded cursor-pointer" title="Ver detalhes">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            {isEditable && (
                                                <>
                                                    <button onClick={() => setEditingItem(item)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded cursor-pointer" title="Editar">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setDeletingItem(item)} className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer" title="Excluir">
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

            {viewingItem && (
                <ViewModal 
                    activeTab={activeTab} 
                    collaboratorsMap={collaboratorsMap} 
                    collaboratorsInfo={collaboratorsInfo}
                    qaProcesses={qaProcesses} 
                    item={viewingItem} 
                    getSafeDateString={getSafeDateString}
                    onClose={() => setViewingItem(null)} 
                />
            )}
            {deletingItem && <DeleteModal onClose={() => setDeletingItem(null)} onConfirm={handleDelete} />}
            {editingItem && (
                <EditModal 
                    activeTab={activeTab} 
                    collaboratorsMap={collaboratorsMap}
                    collaboratorsInfo={collaboratorsInfo}
                    qaProcesses={qaProcesses}
                    item={editingItem} 
                    onClose={() => setEditingItem(null)} 
                    onSave={handleEditSave} 
                />
            )}
        </div>
    );
};

const TabButton = ({ active, onClick, icon, text }) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
            active ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
        }`}
    >
        {icon}
        {text}
    </button>
);

// ==========================================
// MODAL DE VISUALIZAÇÃO DE DETALHES
// ==========================================
const ViewModal = ({ activeTab, item, collaboratorsMap, collaboratorsInfo, qaProcesses, getSafeDateString, onClose }) => {
    const colabId = item.colabId || item.collaboratorId;
    const colabName = (collaboratorsMap && collaboratorsMap[colabId]) || item.colabName || 'Colaborador';
    const colabData = (collaboratorsInfo && collaboratorsInfo[colabId]) || {};
    const dateFormatted = getSafeDateString(item);
    const scoreTotal = item.pontuacao !== undefined ? Number(item.pontuacao) : calculateScore(item);

    // Campos ignorados da iteração padrão de extras
    const standardFields = [
        'id', 'createdAt', 'updatedAt', 'colabId', 'collaboratorId', 'colabName', 
        'read', 'evaluatorId', 'checklistResults', 'processId', 'date', 'pontuacao',
        'Atendimentos_Finalizados', 'Atendimentos_Huggy', 'Ligacoes_Atendidas', 'Ligacoes_Perdidas',
        'TMA_Telefonia', 'TME_Telefonia', 'TMA_Huggy', 'type', 'method', 'protocol', 
        'comment', 'createdBy', 'fcr', 'tmr', 'recurrence', 'status', 'evaluatorName', 'notes'
    ];

    const extraEntries = Object.entries(item)
        .filter(([key]) => !standardFields.includes(key))
        .sort(([a], [b]) => a.localeCompare(b));

    const getModalTitle = () => {
        switch (activeTab) {
            case 'metrics': return 'Avaliação de Desempenho';
            case 'feedbacks': return 'Detalhes do Feedback';
            case 'kpis': return 'Indicadores do Setor (KPIs)';
            case 'audits': return 'Auditoria de Qualidade (QA)';
            default: return 'Detalhes do Registro';
        }
    };

    return (
        <div className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-4 z-[80] backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${activeTab === 'metrics' || activeTab === 'audits' ? 'max-w-2xl' : 'max-w-xl'} overflow-hidden flex flex-col max-h-[92vh] border border-gray-100`}>
                
                {/* CABEÇALHO DO MODAL */}
                <div className="p-4 bg-zinc-950 text-white flex justify-between items-center shrink-0 border-b border-zinc-800">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center">
                            {activeTab === 'metrics' && <TrendingUp className="w-4 h-4" />}
                            {activeTab === 'feedbacks' && <MessageSquare className="w-4 h-4" />}
                            {activeTab === 'kpis' && <Target className="w-4 h-4" />}
                            {activeTab === 'audits' && <ShieldCheck className="w-4 h-4" />}
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-white tracking-tight">{getModalTitle()}</h3>
                            <p className="text-[11px] text-zinc-400">Dados cadastrados no sistema Hubdesk</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* CORPO DO MODAL */}
                <div className="p-6 space-y-6 text-sm overflow-y-auto flex-1 bg-gray-50/50">

                    {/* ========================================================= */}
                    {/* VISUALIZAÇÃO DEDICADA: DESEMPENHO (METRICS) */}
                    {/* ========================================================= */}
                    {activeTab === 'metrics' && (
                        <div className="space-y-6">
                            {/* HERO CARD DO COLABORADOR */}
                            <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 p-4 sm:p-5 text-white rounded-2xl shadow-sm border border-zinc-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center text-white text-lg font-black shadow-inner shrink-0">
                                        {colabName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">{colabName}</h4>
                                            {colabData.role && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-700/80 text-zinc-300 font-medium border border-zinc-600">
                                                    {colabData.role}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2.5 text-xs text-zinc-400 mt-1">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5 text-red-400" />
                                                Ref: <strong className="text-zinc-200">{dateFormatted}</strong>
                                            </span>
                                            {colabData.shift && (
                                                <span>• Turno: <strong className="text-zinc-200">{colabData.shift}</strong></span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* SCORE BADGE */}
                                <div className="bg-zinc-800/90 border border-zinc-700/80 rounded-xl px-4 py-2.5 flex items-center gap-3 shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
                                    <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                                        <Award className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">Pontuação Geral</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-white">{scoreTotal}</span>
                                            <span className="text-xs font-semibold text-amber-400">pts</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SEÇÃO 1: VOLUME & PRODUTIVIDADE */}
                            <div>
                                <div className="flex items-center justify-between mb-2.5">
                                    <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                                        <BarChart2 className="w-4 h-4 text-blue-600" />
                                        Volume de Atendimentos
                                    </h5>
                                    <span className="text-[11px] text-gray-400">Chamadas e conversas computadas</span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {/* Finalizados */}
                                    <div className="bg-white p-3.5 rounded-xl border border-blue-100/90 shadow-xs relative overflow-hidden">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-semibold text-gray-600">Finalizados</span>
                                            <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                        <div className="text-2xl font-black text-gray-900 tracking-tight">
                                            {item.Atendimentos_Finalizados ?? 0}
                                        </div>
                                        <div className="mt-1.5 text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded w-fit">
                                            +1 pt / chamado
                                        </div>
                                    </div>

                                    {/* Huggy */}
                                    <div className="bg-white p-3.5 rounded-xl border border-purple-100/90 shadow-xs relative overflow-hidden">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-semibold text-gray-600">Huggy (Chat)</span>
                                            <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center">
                                                <MessageCircle className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                        <div className="text-2xl font-black text-gray-900 tracking-tight">
                                            {item.Atendimentos_Huggy ?? 0}
                                        </div>
                                        <div className="mt-1.5 text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded w-fit">
                                            +1 pt / chat
                                        </div>
                                    </div>

                                    {/* Atendidas */}
                                    <div className="bg-white p-3.5 rounded-xl border border-emerald-100/90 shadow-xs relative overflow-hidden">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-semibold text-gray-600">Atendidas</span>
                                            <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                <PhoneCall className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                        <div className="text-2xl font-black text-gray-900 tracking-tight">
                                            {item.Ligacoes_Atendidas ?? 0}
                                        </div>
                                        <div className="mt-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded w-fit">
                                            +2 pts / ligação
                                        </div>
                                    </div>

                                    {/* Perdidas */}
                                    <div className="bg-white p-3.5 rounded-xl border border-red-100/90 shadow-xs relative overflow-hidden">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-semibold text-gray-600">Perdidas</span>
                                            <div className="w-6 h-6 rounded-md bg-red-50 text-red-600 flex items-center justify-center">
                                                <PhoneMissed className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                        <div className="text-2xl font-black text-red-600 tracking-tight">
                                            {item.Ligacoes_Perdidas ?? 0}
                                        </div>
                                        <div className="mt-1.5 text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded w-fit">
                                            -5 pts penalidade
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SEÇÃO 2: MÉTRICAS DE TEMPO */}
                            <div>
                                <div className="flex items-center justify-between mb-2.5">
                                    <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                                        <Clock className="w-4 h-4 text-amber-600" />
                                        Métricas de Tempo (SLA)
                                    </h5>
                                    <span className="text-[11px] text-gray-400">Padrão HH:MM:SS</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* TMA Telefonia */}
                                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">TMA Telefonia</span>
                                            <span className="text-base font-mono font-bold text-gray-900">{item.TMA_Telefonia || '00:00:00'}</span>
                                        </div>
                                    </div>

                                    {/* TME Telefonia */}
                                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">TME Telefonia</span>
                                            <span className="text-base font-mono font-bold text-gray-900">{item.TME_Telefonia || '00:00:00'}</span>
                                        </div>
                                    </div>

                                    {/* TMA Huggy */}
                                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 shrink-0">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">TMA Huggy</span>
                                            <span className="text-base font-mono font-bold text-gray-900">{item.TMA_Huggy || '00:00:00'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SEÇÃO 3: CÁLCULO DA PONTUAÇÃO */}
                            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-700">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    Composição Detalhada do Cálculo
                                </div>
                                <div className="text-xs text-gray-600 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                    <span>({item.Atendimentos_Finalizados || 0} × 1)</span>
                                    <span>+</span>
                                    <span>({item.Atendimentos_Huggy || 0} × 1)</span>
                                    <span>+</span>
                                    <span>({item.Ligacoes_Atendidas || 0} × 2)</span>
                                    <span>-</span>
                                    <span>({item.Ligacoes_Perdidas || 0} × 5)</span>
                                    <span>=</span>
                                    <span className="font-bold text-gray-900 text-sm bg-white px-2 py-0.5 rounded border border-gray-200">
                                        {scoreTotal} pontos
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* VISUALIZAÇÃO DEDICADA: FEEDBACKS */}
                    {/* ========================================================= */}
                    {activeTab === 'feedbacks' && (
                        <div className="space-y-4">
                            {/* CABEÇALHO DO FEEDBACK */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                                        {colabName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Colaborador Avaliado</span>
                                        <h4 className="text-base font-bold text-gray-900">{colabName}</h4>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Data do Feedback</span>
                                    <span className="text-sm font-semibold text-gray-900 flex items-center gap-1 justify-end">
                                        <Calendar className="w-3.5 h-3.5 text-red-500" />
                                        {dateFormatted}
                                    </span>
                                </div>
                            </div>

                            {/* TIPO E CANAL */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Classificação</span>
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                        item.type === 'Elogio' ? 'bg-emerald-100 text-emerald-800' :
                                        item.type === 'Ponto de Melhoria' ? 'bg-amber-100 text-amber-800' :
                                        item.type === 'Reclamação' ? 'bg-red-100 text-red-800' :
                                        item.type === 'Sugestão' ? 'bg-blue-100 text-blue-800' :
                                        'bg-purple-100 text-purple-800'
                                    }`}>
                                        {item.type || 'Não informado'}
                                    </span>
                                </div>

                                <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Meio / Canal</span>
                                    <span className="text-sm font-bold text-gray-800">{item.method || 'Geral'}</span>
                                </div>

                                <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Protocolo</span>
                                    <span className="text-sm font-mono font-bold text-gray-800">{item.protocol || '--'}</span>
                                </div>
                            </div>

                            {/* COMENTÁRIO */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                                <span className="text-xs font-bold text-gray-600 uppercase flex items-center gap-1.5 mb-2">
                                    <MessageSquare className="w-4 h-4 text-red-500" />
                                    Comentário do Feedback
                                </span>
                                <div className="p-3.5 bg-gray-50 rounded-lg border border-gray-100 text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">
                                    {item.comment || 'Nenhum comentário registrado.'}
                                </div>
                            </div>

                            {item.createdBy && (
                                <div className="text-xs text-gray-400 text-right">
                                    Registrado por: <strong className="text-gray-600">{item.createdBy}</strong>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* VISUALIZAÇÃO DEDICADA: KPIS */}
                    {/* ========================================================= */}
                    {activeTab === 'kpis' && (
                        <div className="space-y-4">
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Indicadores do Setor</span>
                                    <h4 className="text-base font-bold text-gray-900">Período de Referência</h4>
                                </div>
                                <span className="text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-red-500" />
                                    {dateFormatted}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-xs">
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase block mb-1">FCR (Resolução 1º Contato)</span>
                                    <span className="text-2xl font-black text-gray-900">{item.fcr ?? 0}%</span>
                                    <p className="text-[10px] text-gray-400 mt-1">Meta setorial de qualidade</p>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-xs">
                                    <span className="text-[10px] font-bold text-blue-600 uppercase block mb-1">TMR (Tempo Médio Resposta)</span>
                                    <span className="text-2xl font-black text-gray-900">{item.tmr || '00:00'}</span>
                                    <p className="text-[10px] text-gray-400 mt-1">Tempo de primeira resposta</p>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-xs">
                                    <span className="text-[10px] font-bold text-amber-600 uppercase block mb-1">Reincidência</span>
                                    <span className="text-2xl font-black text-gray-900">{item.recurrence ?? 0}%</span>
                                    <p className="text-[10px] text-gray-400 mt-1">Taxa de chamados repetidos</p>
                                </div>
                            </div>

                            {item.createdBy && (
                                <div className="text-xs text-gray-400 text-right">
                                    Registrado por: <strong className="text-gray-600">{item.createdBy}</strong>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* VISUALIZAÇÃO DEDICADA: AUDITORIAS QA */}
                    {/* ========================================================= */}
                    {activeTab === 'audits' && (
                        <div className="space-y-4">
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                                        {colabName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Colaborador Auditado</span>
                                        <h4 className="text-base font-bold text-gray-900">{colabName}</h4>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Status da Auditoria</span>
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                        item.status === 'Conforme' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                        {item.status === 'Conforme' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                        {item.status || 'Pendente'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Protocolo</span>
                                    <span className="text-sm font-mono font-bold text-gray-900">{item.protocol || '--'}</span>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Data Auditoria</span>
                                    <span className="text-sm font-bold text-gray-900">{dateFormatted}</span>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Avaliador</span>
                                    <span className="text-sm font-bold text-gray-900">{item.evaluatorName || 'Sistema'}</span>
                                </div>
                            </div>

                            {item.notes && (
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                                    <span className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Observações do Auditor</span>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.notes}</p>
                                </div>
                            )}

                            {/* CHECKLIST DA AUDITORIA */}
                            {item.checklistResults && Object.keys(item.checklistResults).length > 0 && (
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                                    <h5 className="text-xs font-bold text-gray-700 uppercase flex items-center gap-2 mb-3">
                                        <ShieldCheck className="w-4 h-4 text-red-500" /> Checklist da Avaliação
                                    </h5>
                                    <div className="space-y-2.5">
                                        {Object.entries(item.checklistResults).map(([idx, status]) => {
                                            const process = qaProcesses && item.processId ? qaProcesses[item.processId] : null;
                                            const question = process?.checklist?.[idx] || `Item de verificação ${Number(idx) + 1}`;
                                            let statusColor = "text-gray-600 bg-gray-100 border-gray-200";
                                            if (status === 'Passou') statusColor = "text-emerald-700 bg-emerald-50 border-emerald-200";
                                            if (status === 'Falhou') statusColor = "text-red-700 bg-red-50 border-red-200";
                                            return (
                                                <div key={idx} className="flex justify-between items-start gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200/80">
                                                    <span className="text-sm text-gray-700 font-medium leading-snug">{question}</span>
                                                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 border ${statusColor}`}>
                                                        {status}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* INFORMAÇÕES ADICIONAIS (SE HOUVER CAMPOS EXTRAS) */}
                    {/* ========================================================= */}
                    {extraEntries.length > 0 && (
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-3">Outros Dados Cadastrados</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {extraEntries.map(([key, value]) => {
                                    let displayVal = value;
                                    if (value && typeof value === 'object') {
                                        if (typeof value.toDate === 'function') {
                                            displayVal = value.toDate().toLocaleString('pt-BR');
                                        } else {
                                            displayVal = JSON.stringify(value);
                                        }
                                    }
                                    return (
                                        <div key={key} className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase">{translateKey(key)}</span>
                                            <span className="block text-gray-800 font-medium text-xs mt-0.5">{displayVal?.toString() || 'Vazio'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* RODAPÉ DO MODAL */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
                    <button 
                        onClick={onClose} 
                        className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors shadow-sm"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

const DeleteModal = ({ onClose, onConfirm }) => (
    <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Apagar Registro?</h3>
            <p className="text-gray-500 text-sm mb-6">Esta ação não pode ser desfeita. O dado será removido permanentemente dos relatórios e gráficos.</p>
            <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Cancelar</button>
                <button onClick={onConfirm} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Sim, Apagar</button>
            </div>
        </div>
    </div>
);

// ==========================================
// MODAL DE EDIÇÃO DE DADOS (ESTILIZADO & ORDENADO)
// ==========================================
const EditModal = ({ activeTab, item, collaboratorsMap, collaboratorsInfo, qaProcesses, onClose, onSave }) => {
    const [formData, setFormData] = useState({ ...item });
    const colabId = formData.colabId || formData.collaboratorId;
    const colabName = (collaboratorsMap && collaboratorsMap[colabId]) || formData.colabName || 'Colaborador';
    const colabData = (collaboratorsInfo && collaboratorsInfo[colabId]) || {};

    const handleChange = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const liveScore = calculateScore(formData);

    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToUpdate = { ...formData };
        delete dataToUpdate.id;
        delete dataToUpdate.createdAt;

        // Se for Desempenho (metrics), garante os tipos numéricos e atualiza a pontuação calculada
        if (activeTab === 'metrics') {
            dataToUpdate.Atendimentos_Finalizados = Number(formData.Atendimentos_Finalizados) || 0;
            dataToUpdate.Atendimentos_Huggy = Number(formData.Atendimentos_Huggy) || 0;
            dataToUpdate.Ligacoes_Atendidas = Number(formData.Ligacoes_Atendidas) || 0;
            dataToUpdate.Ligacoes_Perdidas = Number(formData.Ligacoes_Perdidas) || 0;
            dataToUpdate.pontuacao = liveScore;
        }

        onSave(dataToUpdate);
    };

    const getEditTitle = () => {
        switch (activeTab) {
            case 'metrics': return 'Editar Avaliação de Desempenho';
            case 'feedbacks': return 'Editar Registro de Feedback';
            case 'kpis': return 'Editar Indicadores (KPIs)';
            case 'audits': return 'Editar Auditoria de Qualidade';
            default: return 'Editar Registro';
        }
    };

    return (
        <div className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-4 z-[80] backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${activeTab === 'metrics' || activeTab === 'audits' ? 'max-w-2xl' : 'max-w-xl'} overflow-hidden flex flex-col max-h-[92vh] border border-gray-100`}>
                
                {/* CABEÇALHO DO MODAL DE EDIÇÃO */}
                <div className="p-4 bg-zinc-950 text-white flex justify-between items-center shrink-0 border-b border-zinc-800">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                            <Edit2 className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-white tracking-tight">{getEditTitle()}</h3>
                            <p className="text-[11px] text-zinc-400">Altere os campos com precisão e consistência</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {/* FORMULÁRIO COM ORDEM FIXA E ESTRUTURADA */}
                <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
                    <form id="editForm" onSubmit={handleSubmit} className="space-y-5">

                        {/* ========================================================= */}
                        {/* FORMULÁRIO: DESEMPENHO (METRICS) */}
                        {/* ========================================================= */}
                        {activeTab === 'metrics' && (
                            <div className="space-y-5">
                                {/* BANNER FIXO DO COLABORADOR */}
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white font-bold text-base shrink-0">
                                            {colabName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Colaborador</span>
                                                {colabData.role && (
                                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 font-medium">
                                                        {colabData.role}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="text-base font-bold text-gray-900">{colabName}</h4>
                                        </div>
                                    </div>

                                    <div className="w-full sm:w-auto">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Data de Referência</label>
                                        <input 
                                            type="date"
                                            value={formData.date || ''}
                                            onChange={(e) => handleChange('date', e.target.value)}
                                            className="w-full sm:w-auto px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none bg-white"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* SEÇÃO 1: VOLUME DE ATENDIMENTOS (ORDEM FIXA) */}
                                <div>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <h5 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                                            <BarChart2 className="w-4 h-4 text-blue-600" />
                                            Volume de Atendimentos
                                        </h5>
                                        <span className="text-[11px] text-gray-400">Insira valores numéricos inteiros</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* Finalizados */}
                                        <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-xs">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-xs font-bold text-gray-700">Atendimentos Finalizados</label>
                                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">+1 pt</span>
                                            </div>
                                            <input 
                                                type="number"
                                                min="0"
                                                value={formData.Atendimentos_Finalizados ?? ''}
                                                onChange={(e) => handleChange('Atendimentos_Finalizados', e.target.value === '' ? '' : Number(e.target.value))}
                                                className="w-full p-2 text-base font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="0"
                                            />
                                        </div>

                                        {/* Huggy */}
                                        <div className="bg-white p-3.5 rounded-xl border border-purple-100 shadow-xs">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-xs font-bold text-gray-700">Atendimentos Huggy (Chat)</label>
                                                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">+1 pt</span>
                                            </div>
                                            <input 
                                                type="number"
                                                min="0"
                                                value={formData.Atendimentos_Huggy ?? ''}
                                                onChange={(e) => handleChange('Atendimentos_Huggy', e.target.value === '' ? '' : Number(e.target.value))}
                                                className="w-full p-2 text-base font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                                placeholder="0"
                                            />
                                        </div>

                                        {/* Ligações Atendidas */}
                                        <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-xs">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-xs font-bold text-gray-700">Ligações Atendidas</label>
                                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">+2 pts</span>
                                            </div>
                                            <input 
                                                type="number"
                                                min="0"
                                                value={formData.Ligacoes_Atendidas ?? ''}
                                                onChange={(e) => handleChange('Ligacoes_Atendidas', e.target.value === '' ? '' : Number(e.target.value))}
                                                className="w-full p-2 text-base font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                                placeholder="0"
                                            />
                                        </div>

                                        {/* Ligações Perdidas */}
                                        <div className="bg-white p-3.5 rounded-xl border border-red-100 shadow-xs">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-xs font-bold text-gray-700">Ligações Perdidas</label>
                                                <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">-5 pts penalidade</span>
                                            </div>
                                            <input 
                                                type="number"
                                                min="0"
                                                value={formData.Ligacoes_Perdidas ?? ''}
                                                onChange={(e) => handleChange('Ligacoes_Perdidas', e.target.value === '' ? '' : Number(e.target.value))}
                                                className="w-full p-2 text-base font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* SEÇÃO 2: MÉTRICAS DE TEMPO (ORDEM FIXA) */}
                                <div>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <h5 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                                            <Clock className="w-4 h-4 text-amber-600" />
                                            Tempos Médios (TMA / TME)
                                        </h5>
                                        <span className="text-[11px] text-gray-400">Formato HH:MM:SS</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">TMA Telefonia</label>
                                            <input 
                                                type="text"
                                                value={formData.TMA_Telefonia || ''}
                                                onChange={(e) => handleChange('TMA_Telefonia', e.target.value)}
                                                placeholder="00:00:00"
                                                className="w-full p-2 font-mono font-bold text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                                            />
                                        </div>

                                        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">TME Telefonia</label>
                                            <input 
                                                type="text"
                                                value={formData.TME_Telefonia || ''}
                                                onChange={(e) => handleChange('TME_Telefonia', e.target.value)}
                                                placeholder="00:00:00"
                                                className="w-full p-2 font-mono font-bold text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                                            />
                                        </div>

                                        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">TMA Huggy</label>
                                            <input 
                                                type="text"
                                                value={formData.TMA_Huggy || ''}
                                                onChange={(e) => handleChange('TMA_Huggy', e.target.value)}
                                                placeholder="00:00:00"
                                                className="w-full p-2 font-mono font-bold text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* PRÉVIA DINÂMICA DA PONTUAÇÃO EM TEMPO REAL */}
                                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                                            <Sparkles className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-amber-900 block">Pontuação Recalculada em Tempo Real</span>
                                            <p className="text-[11px] text-amber-700">A pontuação será gravada automaticamente com base nos valores editados.</p>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <div className="flex items-baseline gap-1 justify-end">
                                            <span className="text-2xl font-black text-amber-900">{liveScore}</span>
                                            <span className="text-xs font-bold text-amber-700">pts</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========================================================= */}
                        {/* FORMULÁRIO: FEEDBACKS */}
                        {/* ========================================================= */}
                        {activeTab === 'feedbacks' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Data Referência</label>
                                        <input 
                                            type="date"
                                            value={formData.date || ''}
                                            onChange={(e) => handleChange('date', e.target.value)}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tipo de Feedback</label>
                                        <select 
                                            value={formData.type || 'Elogio'} 
                                            onChange={(e) => handleChange('type', e.target.value)}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm"
                                        >
                                            <option value="Elogio">Elogio</option>
                                            <option value="Ponto de Melhoria">Ponto de Melhoria</option>
                                            <option value="Reclamação">Reclamação</option>
                                            <option value="Sugestão">Sugestão</option>
                                            <option value="Dúvida">Dúvida</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Meio / Canal</label>
                                        <select 
                                            value={formData.method || 'Chat'} 
                                            onChange={(e) => handleChange('method', e.target.value)}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm"
                                        >
                                            <option value="Chat">Chat</option>
                                            <option value="Telefone">Telefone</option>
                                            <option value="WhatsApp">WhatsApp</option>
                                            <option value="E-mail">E-mail</option>
                                            <option value="Presencial">Presencial</option>
                                            <option value="Videoconferência">Videoconferência</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Protocolo</label>
                                        <input 
                                            type="text"
                                            value={formData.protocol || ''}
                                            onChange={(e) => handleChange('protocol', e.target.value)}
                                            placeholder="Ex: 2026-09871"
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Comentário Detalhado</label>
                                    <textarea 
                                        rows="4"
                                        value={formData.comment || ''} 
                                        onChange={(e) => handleChange('comment', e.target.value)}
                                        className="w-full p-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm leading-relaxed"
                                        placeholder="Descreva o feedback..."
                                    />
                                </div>
                            </div>
                        )}

                        {/* ========================================================= */}
                        {/* FORMULÁRIO: KPIS */}
                        {/* ========================================================= */}
                        {activeTab === 'kpis' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Mês / Data de Referência</label>
                                    <input 
                                        type="date"
                                        value={formData.date || ''}
                                        onChange={(e) => handleChange('date', e.target.value)}
                                        className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">FCR (%)</label>
                                        <input 
                                            type="number"
                                            step="0.1"
                                            value={formData.fcr ?? ''}
                                            onChange={(e) => handleChange('fcr', e.target.value === '' ? '' : Number(e.target.value))}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-bold"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">TMR</label>
                                        <input 
                                            type="text"
                                            value={formData.tmr || ''}
                                            onChange={(e) => handleChange('tmr', e.target.value)}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-bold"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Reincidência (%)</label>
                                        <input 
                                            type="number"
                                            step="0.1"
                                            value={formData.recurrence ?? ''}
                                            onChange={(e) => handleChange('recurrence', e.target.value === '' ? '' : Number(e.target.value))}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-bold"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========================================================= */}
                        {/* FORMULÁRIO: AUDITORIAS QA */}
                        {/* ========================================================= */}
                        {activeTab === 'audits' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Data da Auditoria</label>
                                        <input 
                                            type="date"
                                            value={formData.date || ''}
                                            onChange={(e) => handleChange('date', e.target.value)}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Status Geral</label>
                                        <select 
                                            value={formData.status || 'Conforme'} 
                                            onChange={(e) => handleChange('status', e.target.value)}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-bold"
                                        >
                                            <option value="Conforme">Conforme</option>
                                            <option value="Não Conforme">Não Conforme</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Protocolo</label>
                                        <input 
                                            type="text"
                                            value={formData.protocol || ''}
                                            onChange={(e) => handleChange('protocol', e.target.value)}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Observações do Auditor</label>
                                    <textarea 
                                        rows="4"
                                        value={formData.notes || ''} 
                                        onChange={(e) => handleChange('notes', e.target.value)}
                                        className="w-full p-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm"
                                    />
                                </div>

                                {/* CHECKLIST DA AUDITORIA */}
                                {formData.checklistResults && Object.keys(formData.checklistResults).length > 0 && (
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                                        <h5 className="text-xs font-bold text-gray-700 uppercase flex items-center gap-2 mb-3">
                                            <ShieldCheck className="w-4 h-4 text-red-500" /> Checklist da Avaliação
                                        </h5>
                                        <div className="space-y-2.5">
                                            {Object.entries(formData.checklistResults).map(([idx, status]) => {
                                                const process = qaProcesses && formData.processId ? qaProcesses[formData.processId] : null;
                                                const question = process?.checklist?.[idx] || `Item de verificação ${Number(idx) + 1}`;
                                                return (
                                                    <div key={idx} className="flex justify-between items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                                        <span className="text-xs text-gray-700 font-medium leading-snug">{question}</span>
                                                        <select
                                                            value={status}
                                                            onChange={(e) => {
                                                                const updated = { ...formData.checklistResults, [idx]: e.target.value };
                                                                handleChange('checklistResults', updated);
                                                            }}
                                                            className="p-1.5 text-xs font-bold rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-600 outline-none"
                                                        >
                                                            <option value="Passou">Passou</option>
                                                            <option value="Falhou">Falhou</option>
                                                        </select>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                </div>
                
                {/* RODAPÉ DO FORMULÁRIO */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3 justify-end shrink-0">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-white font-medium transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit" 
                        form="editForm" 
                        className="px-6 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 font-bold transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                    >
                        <Check className="w-4 h-4" />
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DataManager;