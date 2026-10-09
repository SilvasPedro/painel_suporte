import React, { useState, useEffect, useMemo } from 'react';
import { 
    Headphones, PhoneIncoming, PhoneMissed, CheckCircle2, XCircle, 
    AlertCircle, ThumbsUp, ThumbsDown, Plus, Search, Filter, 
    Download, Edit2, Trash2, Eye, X, Save, Loader2, Calendar, 
    User, FileText, Database, TrendingUp, BarChart2, Check, 
    Copy, ArrowRight, ShieldCheck, Target, Clock, AlertTriangle, 
    Users, RefreshCw, Sparkles, ChevronRight
} from 'lucide-react';
import { 
    collection, doc, addDoc, updateDoc, deleteDoc, setDoc 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeSharedCollection } from '../services/dataCache';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
    Legend, Cell, PieChart, Pie 
} from 'recharts';

// Lista oficial dos processos exigidos
const OFFICIAL_PROCESSES = [
    'Sem acesso',
    'Lentidão/Oscilação',
    'Suporte TV',
    'Informações',
    'Assuntos Financeiros'
];

export default function ThirdPartyAudits() {
    const { showToast } = useNotification();
    const { currentUser } = useAuth();
    const { canEdit } = usePermissions();
    const hasEditPermission = canEdit('third_party_audits');

    // Estados de dados
    const [audits, setAudits] = useState([]);
    const [savedOperators, setSavedOperators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    // Meta mensal de auditorias (padrão 100 ou customizada)
    const [monthlyGoal, setMonthlyGoal] = useState(() => {
        const saved = localStorage.getItem('hubdesk_third_party_goal');
        return saved ? Number(saved) : 100;
    });
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [tempGoal, setTempGoal] = useState(monthlyGoal);

    // Mês selecionado para análise (padrão: mês corrente YYYY-MM)
    const currentMonthKey = useMemo(() => {
        const d = new Date();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${d.getFullYear()}-${m}`;
    }, []);

    const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
    const [periodFilterType, setPeriodFilterType] = useState('current'); // 'current' | 'all' | 'custom'

    // Filtros de busca e listagem
    const [searchTerm, setSearchTerm] = useState('');
    const [operatorFilter, setOperatorFilter] = useState('all');
    const [processFilter, setProcessFilter] = useState('all');
    const [outcomeFilter, setOutcomeFilter] = useState('all'); // 'all' | 'Resolvido' | 'Encaminhado'
    const [proceduresFilter, setProceduresFilter] = useState('all'); // 'all' | 'Conforme' | 'Não conforme'
    const [qualityFilter, setQualityFilter] = useState('all'); // 'all' | 'Positiva' | 'Neutra' | 'Negativa'
    const [callStatusFilter, setCallStatusFilter] = useState('all'); // 'all' | 'Atendida' | 'Abandonada'
    const [onlyRepeatsFilter, setOnlyRepeatsFilter] = useState(false);

    // Modais
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingAudit, setEditingAudit] = useState(null);
    const [viewingAudit, setViewingAudit] = useState(null);
    const [copiedField, setCopiedField] = useState(null);

    // Estado do formulário
    const initialFormState = {
        date: new Date().toISOString().split('T')[0],
        protocol: '',
        callStatus: 'Atendida', // 'Atendida' | 'Abandonada'
        procedures: 'Conforme', // 'Conforme' | 'Não conforme'
        quality: 'Positiva',    // 'Positiva' | 'Neutra' | 'Negativa'
        process: 'Sem acesso',
        operatorName: '',
        erpProtocol: '',
        clientName: '',
        outcome: 'Resolvido',   // 'Resolvido' | 'Encaminhado'
        notes: ''
    };
    const [formData, setFormData] = useState(initialFormState);

    // 1. Escuta em tempo real das auditorias
    useEffect(() => {
        const unsubAudits = subscribeSharedCollection('third_party_audits', (items) => {
            const list = [...items];
            // Ordena da mais recente para a mais antiga
            list.sort((a, b) => {
                const dateA = a.date || '';
                const dateB = b.date || '';
                return dateB.localeCompare(dateA);
            });
            setAudits(list);
            setLoading(false);
        });

        // 2. Escuta operadores salvos
        const unsubOperators = subscribeSharedCollection('third_party_operators', (items) => {
            const names = items.map(i => i.name || i.id).filter(Boolean);
            setSavedOperators(names);
        });

        return () => {
            unsubAudits();
            unsubOperators();
        };
    }, []);

    // Lista unificada e única de operadores (salvos + encontrados nas auditorias)
    const allAvailableOperators = useMemo(() => {
        const set = new Set(savedOperators.map(s => s.trim()));
        audits.forEach(a => {
            if (a.operatorName && a.operatorName.trim()) {
                set.add(a.operatorName.trim());
            }
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [savedOperators, audits]);

    // Meses disponíveis no banco para seleção rápida
    const availableMonths = useMemo(() => {
        const set = new Set();
        set.add(currentMonthKey);
        audits.forEach(a => {
            if (a.date && a.date.length >= 7) {
                set.add(a.date.substring(0, 7));
            }
        });
        return Array.from(set).sort().reverse();
    }, [audits, currentMonthKey]);

    // Salvar meta mensal no localStorage
    const handleSaveGoal = () => {
        const val = Number(tempGoal);
        if (val > 0) {
            setMonthlyGoal(val);
            localStorage.setItem('hubdesk_third_party_goal', String(val));
            showToast(`Meta mensal ajustada para ${val} auditorias.`, 'success');
        }
        setIsEditingGoal(false);
    };

    // Histórico de repetições por cliente no universo global (para checagem de reincidência fora de horário)
    const clientHistoryMap = useMemo(() => {
        const map = {};
        audits.forEach(audit => {
            const raw = audit.clientName ? audit.clientName.trim().toLowerCase() : '';
            if (raw) {
                if (!map[raw]) {
                    map[raw] = [];
                }
                map[raw].push(audit);
            }
        });
        return map;
    }, [audits]);

    // Verificação de reincidência do cliente no formulário em tempo real
    const currentClientRepeats = useMemo(() => {
        const name = formData.clientName ? formData.clientName.trim().toLowerCase() : '';
        if (!name || name.length < 3) return [];
        return clientHistoryMap[name] || [];
    }, [formData.clientName, clientHistoryMap]);

    // Filtra as auditorias pelo período selecionado (Mês selecionado ou Todas)
    const periodAudits = useMemo(() => {
        if (periodFilterType === 'all') return audits;
        return audits.filter(a => {
            if (!a.date) return false;
            return a.date.startsWith(selectedMonth);
        });
    }, [audits, periodFilterType, selectedMonth]);

    // Lista final após aplicação de todos os filtros de busca e categorias
    const filteredAudits = useMemo(() => {
        return periodAudits.filter(item => {
            // Busca textual
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchClient = (item.clientName || '').toLowerCase().includes(term);
                const matchOperator = (item.operatorName || '').toLowerCase().includes(term);
                const matchProtocol = (item.protocol || '').toLowerCase().includes(term);
                const matchErp = (item.erpProtocol || '').toLowerCase().includes(term);
                const matchNotes = (item.notes || '').toLowerCase().includes(term);
                if (!matchClient && !matchOperator && !matchProtocol && !matchErp && !matchNotes) {
                    return false;
                }
            }

            // Filtro de Operador
            if (operatorFilter !== 'all' && (item.operatorName || '').trim() !== operatorFilter) {
                return false;
            }

            // Filtro de Processo
            if (processFilter !== 'all' && item.process !== processFilter) {
                return false;
            }

            // Filtro de Saída (FCR)
            if (outcomeFilter !== 'all' && item.outcome !== outcomeFilter) {
                return false;
            }

            // Filtro de Procedimentos
            if (proceduresFilter !== 'all' && item.procedures !== proceduresFilter) {
                return false;
            }

            // Filtro de Qualidade
            if (qualityFilter !== 'all' && item.quality !== qualityFilter) {
                return false;
            }

            // Filtro de Status da chamada terceirizada
            if (callStatusFilter !== 'all' && item.callStatus !== callStatusFilter) {
                return false;
            }

            // Filtro apenas reincidentes
            if (onlyRepeatsFilter) {
                const cKey = item.clientName ? item.clientName.trim().toLowerCase() : '';
                const totalCalls = clientHistoryMap[cKey]?.length || 0;
                if (totalCalls < 2) return false;
            }

            return true;
        });
    }, [
        periodAudits, searchTerm, operatorFilter, processFilter, 
        outcomeFilter, proceduresFilter, qualityFilter, callStatusFilter, 
        onlyRepeatsFilter, clientHistoryMap
    ]);

    // ========================================================
    // CÁLCULO DAS MÉTRICAS E INDICADORES OFICIAIS
    // ========================================================
    const metrics = useMemo(() => {
        const total = periodAudits.length;
        if (total === 0) {
            return {
                total: 0,
                progressPercent: 0,
                fcrPercent: 0,
                totalResolved: 0,
                totalForwarded: 0,
                repeatRatePercent: 0,
                uniqueClientsCount: 0,
                repeatClientsCount: 0,
                repeatCallsCount: 0,
                compliancePercent: 0,
                totalConforme: 0,
                totalNaoConforme: 0,
                qualityPositive: 0,
                qualityNeutral: 0,
                qualityNegative: 0,
                qualityPositiveRate: 0,
                callsAnswered: 0,
                callsAbandoned: 0,
                answeredRate: 0
            };
        }

        // 1. Progresso do Mês (% feita em relação à meta)
        const progressPercent = Math.min(100, Math.round((total / monthlyGoal) * 100));

        // 2. FCR (First Call Resolution com base na Saída)
        // Saída = 'Resolvido' (FCR Sucesso) vs 'Encaminhado'
        const totalResolved = periodAudits.filter(a => a.outcome === 'Resolvido').length;
        const totalForwarded = periodAudits.filter(a => a.outcome === 'Encaminhado').length;
        const fcrPercent = Math.round((totalResolved / total) * 100);

        // 3. Taxa de Reincidência dos Clientes
        // Analisa clientes que ligaram mais de 1 vez no universo do período
        const clientsSeen = {};
        periodAudits.forEach(a => {
            const key = a.clientName ? a.clientName.trim().toLowerCase() : '';
            if (key) {
                clientsSeen[key] = (clientsSeen[key] || 0) + 1;
            }
        });
        const clientKeys = Object.keys(clientsSeen);
        const uniqueClientsCount = clientKeys.length;
        const repeatClients = clientKeys.filter(k => clientsSeen[k] > 1);
        const repeatClientsCount = repeatClients.length;

        // Chamadas que pertencem a clientes reincidentes
        const repeatCallsCount = periodAudits.filter(a => {
            const key = a.clientName ? a.clientName.trim().toLowerCase() : '';
            return key && clientsSeen[key] > 1;
        }).length;

        // % de reincidência baseada em chamadas que foram reincidentes
        const repeatRatePercent = Math.round((repeatCallsCount / total) * 100);

        // 4. Procedimentos (Conforme vs Não conforme)
        const totalConforme = periodAudits.filter(a => a.procedures === 'Conforme').length;
        const totalNaoConforme = total - totalConforme;
        const compliancePercent = Math.round((totalConforme / total) * 100);

        // 5. Qualidade (Positiva, Neutra, Negativa)
        const qualityPositive = periodAudits.filter(a => a.quality === 'Positiva').length;
        const qualityNeutral = periodAudits.filter(a => a.quality === 'Neutra').length;
        const qualityNegative = periodAudits.filter(a => a.quality === 'Negativa').length;
        const qualityPositiveRate = Math.round((qualityPositive / total) * 100);

        // 6. Chamadas da Terceirizada (Atendida vs Abandonada)
        const callsAnswered = periodAudits.filter(a => a.callStatus === 'Atendida').length;
        const callsAbandoned = periodAudits.filter(a => a.callStatus === 'Abandonada').length;
        const answeredRate = Math.round((callsAnswered / total) * 100);

        return {
            total,
            progressPercent,
            fcrPercent,
            totalResolved,
            totalForwarded,
            repeatRatePercent,
            uniqueClientsCount,
            repeatClientsCount,
            repeatCallsCount,
            compliancePercent,
            totalConforme,
            totalNaoConforme,
            qualityPositive,
            qualityNeutral,
            qualityNegative,
            qualityPositiveRate,
            callsAnswered,
            callsAbandoned,
            answeredRate
        };
    }, [periodAudits, monthlyGoal]);

    // Dados para gráfico de Processos Realizados
    const processChartData = useMemo(() => {
        const counts = {};
        OFFICIAL_PROCESSES.forEach(p => { counts[p] = 0; });
        periodAudits.forEach(a => {
            const p = a.process || 'Outros';
            counts[p] = (counts[p] || 0) + 1;
        });

        return Object.keys(counts).map(proc => ({
            name: proc,
            quantidade: counts[proc],
            percent: periodAudits.length > 0 ? Math.round((counts[proc] / periodAudits.length) * 100) : 0
        })).sort((a, b) => b.quantidade - a.quantidade);
    }, [periodAudits]);

    // Dados de desempenho por operador terceirizado
    const operatorStatsData = useMemo(() => {
        const map = {};
        periodAudits.forEach(a => {
            const op = (a.operatorName || 'Não informado').trim();
            if (!map[op]) {
                map[op] = { name: op, total: 0, resolvidos: 0, conformes: 0 };
            }
            map[op].total += 1;
            if (a.outcome === 'Resolvido') map[op].resolvidos += 1;
            if (a.procedures === 'Conforme') map[op].conformes += 1;
        });

        return Object.values(map)
            .map(o => ({
                ...o,
                fcr: Math.round((o.resolvidos / o.total) * 100),
                conformidade: Math.round((o.conformes / o.total) * 100)
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 7);
    }, [periodAudits]);

    // Top clientes reincidentes para consulta rápida de reincidência fora de horário
    const topRepeatClients = useMemo(() => {
        const map = {};
        periodAudits.forEach(a => {
            const key = a.clientName ? a.clientName.trim() : '';
            if (key) {
                if (!map[key]) {
                    map[key] = { name: key, count: 0, lastDate: a.date, processes: new Set() };
                }
                map[key].count += 1;
                if (a.process) map[key].processes.add(a.process);
                if (a.date > map[key].lastDate) map[key].lastDate = a.date;
            }
        });

        return Object.values(map)
            .filter(c => c.count > 1)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [periodAudits]);

    // Copiar texto para o clipboard
    const handleCopy = (text, fieldId) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        showToast('Copiado para a área de transferência!', 'success');
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Abertura do modal de criação
    const handleOpenCreateModal = () => {
        setEditingAudit(null);
        setFormData({
            ...initialFormState,
            date: new Date().toISOString().split('T')[0]
        });
        setIsFormModalOpen(true);
    };

    // Abertura do modal de edição
    const handleOpenEditModal = (audit) => {
        setEditingAudit(audit);
        setFormData({
            date: audit.date || new Date().toISOString().split('T')[0],
            protocol: audit.protocol || '',
            callStatus: audit.callStatus || 'Atendida',
            procedures: audit.procedures || 'Conforme',
            quality: audit.quality || 'Positiva',
            process: audit.process || 'Sem acesso',
            operatorName: audit.operatorName || '',
            erpProtocol: audit.erpProtocol || '',
            clientName: audit.clientName || '',
            outcome: audit.outcome || 'Resolvido',
            notes: audit.notes || ''
        });
        setIsFormModalOpen(true);
    };

    // Submissão do formulário (Criação ou Edição)
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.protocol.trim()) {
            showToast('Informe o protocolo da chamada terceirizada.', 'error');
            return;
        }

        if (!formData.operatorName.trim()) {
            showToast('Informe o nome do operador terceirizado.', 'error');
            return;
        }

        if (!formData.clientName.trim()) {
            showToast('Informe o nome do cliente.', 'error');
            return;
        }

        setSaving(true);
        try {
            const cleanOperator = formData.operatorName.trim();
            const cleanClient = formData.clientName.trim();

            const payload = {
                date: formData.date,
                protocol: formData.protocol.trim(),
                callStatus: formData.callStatus,
                procedures: formData.procedures,
                quality: formData.quality,
                process: formData.process,
                operatorName: cleanOperator,
                erpProtocol: formData.erpProtocol.trim(),
                clientName: cleanClient,
                outcome: formData.outcome,
                notes: formData.notes.trim(),
                updatedAt: new Date()
            };

            if (editingAudit) {
                await updateDoc(doc(db, 'third_party_audits', editingAudit.id), payload);
                showToast('Auditoria atualizada com sucesso!', 'success');
            } else {
                payload.createdAt = new Date();
                payload.auditorName = currentUser?.name || currentUser?.displayName || 'Auditor';
                payload.auditorId = currentUser?.firestoreId || currentUser?.uid || '';
                await addDoc(collection(db, 'third_party_audits'), payload);
                showToast('Auditoria registrada com sucesso!', 'success');
            }

            // Salva o nome do operador no catálogo persistente caso ainda não exista
            if (cleanOperator) {
                const operatorDocId = cleanOperator.toLowerCase().replace(/[^a-z0-9]/g, '_');
                await setDoc(doc(db, 'third_party_operators', operatorDocId), {
                    name: cleanOperator,
                    lastUsedAt: new Date()
                }, { merge: true });
            }

            setIsFormModalOpen(false);
            setEditingAudit(null);
        } catch (error) {
            console.error('Erro ao salvar auditoria:', error);
            showToast('Erro ao salvar auditoria: ' + error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Exclusão de auditoria
    const handleDelete = async (id) => {
        try {
            await deleteDoc(doc(db, 'third_party_audits', id));
            showToast('Auditoria excluída com sucesso!', 'success');
            setDeletingId(null);
            if (viewingAudit?.id === id) setViewingAudit(null);
        } catch (error) {
            console.error('Erro ao excluir:', error);
            showToast('Erro ao excluir: ' + error.message, 'error');
        }
    };

    // Exportação em formato CSV
    const handleExportCSV = () => {
        if (filteredAudits.length === 0) {
            showToast('Nenhuma auditoria para exportar.', 'warning');
            return;
        }

        const headers = [
            'Data', 'Protocolo Terceirizada', 'Status Chamada', 
            'Procedimentos', 'Qualidade', 'Processo Realizado', 
            'Operador', 'Protocolo MK (ERP)', 'Cliente', 'Saída (FCR)', 
            'Auditor', 'Observações'
        ];

        const rows = filteredAudits.map(a => [
            a.date || '',
            `"${(a.protocol || '').replace(/"/g, '""')}"`,
            a.callStatus || '',
            a.procedures || '',
            a.quality || '',
            `"${(a.process || '').replace(/"/g, '""')}"`,
            `"${(a.operatorName || '').replace(/"/g, '""')}"`,
            `"${(a.erpProtocol || '').replace(/"/g, '""')}"`,
            `"${(a.clientName || '').replace(/"/g, '""')}"`,
            a.outcome || '',
            `"${(a.auditorName || '').replace(/"/g, '""')}"`,
            `"${(a.notes || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + 
            [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `auditorias_terceirizadas_${selectedMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Exportação concluída com sucesso!', 'success');
    };

    return (
        <div className="flex-1 p-4 sm:p-6 lg:p-8 bg-gray-50 h-full overflow-y-auto font-sans">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* ======================================================== */}
                {/* 1. CABEÇALHO EXECUTIVO E CONTROLES GERAIS                */}
                {/* ======================================================== */}
                <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs p-5 sm:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-zinc-900 text-white flex items-center justify-center shrink-0 shadow-md">
                            <Headphones className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                                    Auditorias de Qualidade Terceirizada
                                </h1>
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                                    Equipe Externa
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Acompanhamento de conformidade, FCR na saída e reincidência de clientes fora de horário.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
                        {/* Seletor de Período/Mês */}
                        <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs">
                            <button
                                type="button"
                                onClick={() => {
                                    setPeriodFilterType('current');
                                    setSelectedMonth(currentMonthKey);
                                }}
                                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                                    periodFilterType === 'current' 
                                        ? 'bg-white text-gray-900 shadow-2xs' 
                                        : 'text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                Mês Vigente
                            </button>
                            <button
                                type="button"
                                onClick={() => setPeriodFilterType('all')}
                                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                                    periodFilterType === 'all' 
                                        ? 'bg-white text-gray-900 shadow-2xs' 
                                        : 'text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                Todo o Histórico
                            </button>
                            {periodFilterType !== 'all' && (
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => {
                                        setSelectedMonth(e.target.value);
                                        setPeriodFilterType('custom');
                                    }}
                                    className="ml-1 bg-transparent font-bold text-gray-800 text-xs px-2 py-1 outline-none cursor-pointer border-l border-gray-200"
                                >
                                    {availableMonths.map(m => (
                                        <option key={m} value={m}>
                                            {m.split('-')[1]}/{m.split('-')[0]}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Botão Exportar CSV */}
                        <button
                            type="button"
                            onClick={handleExportCSV}
                            className="px-3.5 py-2 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl border border-gray-200 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            title="Exportar dados filtrados em CSV"
                        >
                            <Download className="w-3.5 h-3.5 text-gray-500" />
                            <span className="hidden sm:inline">Exportar</span>
                        </button>

                        {/* Botão Nova Auditoria */}
                        {hasEditPermission && (
                            <button
                                type="button"
                                onClick={handleOpenCreateModal}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md shadow-red-950/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Lançar Auditoria</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* ======================================================== */}
                {/* 2. CARD PRINCIPAL: STATUS DE PROGRESSO MENSAL (% FEITO)  */}
                {/* ======================================================== */}
                <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-red-950 text-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-md border border-zinc-800/80 relative overflow-hidden">
                    <div className="absolute right-0 top-0 bottom-0 w-96 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 relative z-10">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-zinc-300 border border-white/20">
                                    <Clock className="w-3 h-3 text-amber-400" />
                                    Progresso do Período ({periodFilterType === 'all' ? 'Geral' : selectedMonth})
                                </span>
                                <span className="text-[11px] text-zinc-400 font-medium">
                                    Auditorias realizadas vs Meta estipulada
                                </span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1 flex items-baseline gap-2">
                                <span>{metrics.total} auditorias lançadas</span>
                                <span className="text-xs font-normal text-zinc-400">
                                    de {monthlyGoal} previstas
                                </span>
                            </h2>
                        </div>

                        {/* Indicador Numérico Grande e Ajuste de Meta */}
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <span className="text-3xl sm:text-4xl font-black text-amber-400">
                                    {metrics.progressPercent}%
                                </span>
                                <span className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                                    Meta do Mês
                                </span>
                            </div>

                            {/* Botão para editar meta */}
                            {hasEditPermission && (
                                <div className="border-l border-zinc-800 pl-3">
                                    {!isEditingGoal ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTempGoal(monthlyGoal);
                                                setIsEditingGoal(true);
                                            }}
                                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-xl transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                                            title="Editar meta de auditorias"
                                        >
                                            <Target className="w-4 h-4 text-amber-400" />
                                            <span className="text-[11px] hidden sm:inline">Ajustar Meta</span>
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-700">
                                            <input
                                                type="number"
                                                min="1"
                                                value={tempGoal}
                                                onChange={(e) => setTempGoal(e.target.value)}
                                                className="w-16 px-2 py-1 bg-zinc-950 text-white rounded text-xs text-center font-bold outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleSaveGoal}
                                                className="p-1 bg-red-600 hover:bg-red-700 text-white rounded cursor-pointer"
                                                title="Salvar meta"
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsEditingGoal(false)}
                                                className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded cursor-pointer"
                                                title="Cancelar"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Barra de Progresso com Gradiente */}
                    <div className="space-y-1.5 relative z-10">
                        <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/60 p-0.5">
                            <div 
                                className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 shadow-sm"
                                style={{ width: `${metrics.progressPercent}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                            <span>0 auditorias</span>
                            <span>
                                {metrics.total >= monthlyGoal ? (
                                    <strong className="text-emerald-400">🎉 Meta mensal alcançada!</strong>
                                ) : (
                                    `Faltam ${monthlyGoal - metrics.total} auditorias para atingir 100% da meta`
                                )}
                            </span>
                            <span>{monthlyGoal} auditorias</span>
                        </div>
                    </div>
                </div>

                {/* ======================================================== */}
                {/* 3. GRID DE KPIS E MÉTRICAS CHAVE (FCR, REINCIDÊNCIA, QA) */}
                {/* ======================================================== */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* CARD 1: FCR (FIRST CALL RESOLUTION) */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2 hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                FCR (Resolução 1ª Chamada)
                            </span>
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="flex items-baseline justify-between">
                            <span className={`text-2xl sm:text-3xl font-black ${
                                metrics.fcrPercent >= 70 ? 'text-emerald-600' : metrics.fcrPercent >= 50 ? 'text-amber-600' : 'text-red-600'
                            }`}>
                                {metrics.fcrPercent}%
                            </span>
                            <span className="text-xs text-gray-500 font-medium">
                                Base: Saída
                            </span>
                        </div>
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600">
                            <span className="flex items-center gap-1 font-bold text-emerald-700">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                {metrics.totalResolved} Resolvidos
                            </span>
                            <span className="flex items-center gap-1 text-gray-500">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                {metrics.totalForwarded} Encaminhados
                            </span>
                        </div>
                    </div>

                    {/* CARD 2: REINCIDÊNCIA DE CLIENTES FORA DE HORÁRIO */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2 hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                Taxa de Reincidência
                            </span>
                            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                <RefreshCw className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="flex items-baseline justify-between">
                            <span className={`text-2xl sm:text-3xl font-black ${
                                metrics.repeatRatePercent <= 15 ? 'text-emerald-600' : metrics.repeatRatePercent <= 30 ? 'text-amber-600' : 'text-red-600'
                            }`}>
                                {metrics.repeatRatePercent}%
                            </span>
                            <span className="text-xs text-gray-500 font-medium">
                                Clientes recorrentes
                            </span>
                        </div>
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600">
                            <span className="text-gray-700 font-medium">
                                <strong>{metrics.repeatClientsCount}</strong> clientes reincidentes
                            </span>
                            <span className="text-gray-400">
                                {metrics.uniqueClientsCount} clientes únicos
                            </span>
                        </div>
                    </div>

                    {/* CARD 3: CONFORMIDADE DE PROCEDIMENTOS */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2 hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                Conformidade de Procedimentos
                            </span>
                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="flex items-baseline justify-between">
                            <span className={`text-2xl sm:text-3xl font-black ${
                                metrics.compliancePercent >= 85 ? 'text-emerald-600' : metrics.compliancePercent >= 70 ? 'text-blue-600' : 'text-red-600'
                            }`}>
                                {metrics.compliancePercent}%
                            </span>
                            <span className="text-xs text-gray-500 font-medium">
                                Conformes
                            </span>
                        </div>
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600">
                            <span className="text-emerald-700 font-bold">
                                {metrics.totalConforme} Conformes
                            </span>
                            <span className="text-red-600 font-medium">
                                {metrics.totalNaoConforme} Não Conformes
                            </span>
                        </div>
                    </div>

                    {/* CARD 4: QUALIDADE DO ATENDIMENTO */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2 hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                Qualidade Geral
                            </span>
                            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                <ThumbsUp className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="flex items-baseline justify-between">
                            <span className="text-2xl sm:text-3xl font-black text-purple-700">
                                {metrics.qualityPositiveRate}%
                            </span>
                            <span className="text-xs text-gray-500 font-medium">
                                Avaliação Positiva
                            </span>
                        </div>
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600">
                            <span className="text-emerald-600 font-bold">👍 {metrics.qualityPositive}</span>
                            <span className="text-gray-500 font-bold">😐 {metrics.qualityNeutral}</span>
                            <span className="text-red-600 font-bold">👎 {metrics.qualityNegative}</span>
                        </div>
                    </div>

                </div>

                {/* ======================================================== */}
                {/* 4. SEÇÃO GRÁFICA: PROCESSOS & OPERADORES TERCEIRIZADOS   */}
                {/* ======================================================== */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Card 1: Gráfico de Processos Realizados */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <div>
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <BarChart2 className="w-4 h-4 text-red-600" />
                                    Demandas por Processo
                                </h3>
                                <p className="text-[11px] text-gray-400">
                                    Motivos dos atendimentos auditados
                                </p>
                            </div>
                            <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-lg">
                                {periodAudits.length}
                            </span>
                        </div>

                        {periodAudits.length === 0 ? (
                            <div className="h-56 flex flex-col items-center justify-center text-gray-400 text-xs italic">
                                Nenhum lançamento no período.
                            </div>
                        ) : (
                            <div className="h-60 pt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={processChartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                        <XAxis type="number" stroke="#9ca3af" fontSize={10} allowDecimals={false} />
                                        <YAxis dataKey="name" type="category" width={110} stroke="#4b5563" fontSize={10} tickLine={false} />
                                        <Tooltip 
                                            formatter={(value) => [`${value} atendimentos`, 'Volume']}
                                            labelFormatter={(label) => `Processo: ${label}`}
                                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                                        />
                                        <Bar dataKey="quantidade" radius={[0, 8, 8, 0]}>
                                            {processChartData.map((entry, index) => {
                                                const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
                                                return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                            })}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Card 2: Desempenho dos Operadores Terceirizados */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs space-y-3 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <Users className="w-4 h-4 text-blue-600" />
                                    Operadores Terceirizados
                                </h3>
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                    FCR & QA
                                </span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-2">
                                Produtividade e resolução da equipe externa:
                            </p>

                            <div className="space-y-2 mt-3 max-h-56 overflow-y-auto pr-1">
                                {operatorStatsData.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic text-center py-6">
                                        Nenhum operador com atendimentos no período.
                                    </p>
                                ) : (
                                    operatorStatsData.map((op, idx) => (
                                        <div 
                                            key={idx}
                                            onClick={() => setOperatorFilter(op.name)}
                                            className="p-2.5 rounded-xl bg-gray-50 hover:bg-blue-50/50 border border-gray-200 hover:border-blue-200 transition-colors flex items-center justify-between cursor-pointer group"
                                            title="Clique para filtrar por este operador"
                                        >
                                            <div className="min-w-0 pr-2">
                                                <span className="text-xs font-bold text-gray-900 group-hover:text-blue-600 block truncate">
                                                    {op.name}
                                                </span>
                                                <span className="text-[10px] text-gray-500">
                                                    {op.total} chamada{op.total > 1 ? 's' : ''} auditada{op.total > 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800" title="First Call Resolution">
                                                    FCR {op.fcr}%
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800" title="Conformidade">
                                                    QA {op.conformidade}%
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-400 text-center">
                            Clique em um operador para filtrar sua amostragem
                        </div>
                    </div>

                    {/* Card 3: Top Clientes Reincidentes Fora de Horário */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs space-y-3 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <RefreshCw className="w-4 h-4 text-amber-600" />
                                    Reincidências Fora de Horário
                                </h3>
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    Atenção
                                </span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-2">
                                Clientes com múltiplos contatos registrados neste período:
                            </p>

                            <div className="space-y-2 mt-3 max-h-56 overflow-y-auto pr-1">
                                {topRepeatClients.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic text-center py-6">
                                        Nenhuma reincidência de cliente detectada no período.
                                    </p>
                                ) : (
                                    topRepeatClients.map((client, idx) => (
                                        <div 
                                            key={idx}
                                            onClick={() => setSearchTerm(client.name)}
                                            className="p-2.5 rounded-xl bg-gray-50 hover:bg-red-50/50 border border-gray-200 hover:border-red-200 transition-colors flex items-center justify-between cursor-pointer group"
                                            title="Clique para filtrar apenas as chamadas deste cliente"
                                        >
                                            <div className="min-w-0 pr-2">
                                                <span className="text-xs font-bold text-gray-900 group-hover:text-red-600 block truncate">
                                                    {client.name}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    Último contato em {client.lastDate}
                                                </span>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                                                {client.count} chamadas
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-400 text-center">
                            Acompanhe para evitar desgaste do cliente no plantão
                        </div>
                    </div>

                </div>

                {/* ======================================================== */}
                {/* 5. BARRA DE FILTROS E BUSCA AVANÇADA                     */}
                {/* ======================================================== */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs space-y-3">
                    <div className="flex flex-col md:flex-row items-center gap-3">
                        
                        {/* Campo de Busca Universal */}
                        <div className="relative flex-1 w-full">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar por cliente, operador, protocolo terceirizada ou MK..."
                                className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-red-600"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Filtros em Linha */}
                        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                            
                            {/* Operador */}
                            <select
                                value={operatorFilter}
                                onChange={(e) => setOperatorFilter(e.target.value)}
                                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none cursor-pointer focus:ring-2 focus:ring-red-600"
                            >
                                <option value="all">Todos os Operadores</option>
                                {allAvailableOperators.map(op => (
                                    <option key={op} value={op}>{op}</option>
                                ))}
                            </select>

                            {/* Processo */}
                            <select
                                value={processFilter}
                                onChange={(e) => setProcessFilter(e.target.value)}
                                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none cursor-pointer focus:ring-2 focus:ring-red-600"
                            >
                                <option value="all">Todos os Processos</option>
                                {OFFICIAL_PROCESSES.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>

                            {/* Saída / FCR */}
                            <select
                                value={outcomeFilter}
                                onChange={(e) => setOutcomeFilter(e.target.value)}
                                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none cursor-pointer focus:ring-2 focus:ring-red-600"
                            >
                                <option value="all">Todas as Saídas (FCR)</option>
                                <option value="Resolvido">Resolvido (FCR Sim)</option>
                                <option value="Encaminhado">Encaminhado (FCR Não)</option>
                            </select>

                            {/* Procedimentos */}
                            <select
                                value={proceduresFilter}
                                onChange={(e) => setProceduresFilter(e.target.value)}
                                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none cursor-pointer focus:ring-2 focus:ring-red-600"
                            >
                                <option value="all">Procedimento</option>
                                <option value="Conforme">Conforme</option>
                                <option value="Não conforme">Não conforme</option>
                            </select>

                            {/* Qualidade */}
                            <select
                                value={qualityFilter}
                                onChange={(e) => setQualityFilter(e.target.value)}
                                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none cursor-pointer focus:ring-2 focus:ring-red-600"
                            >
                                <option value="all">Qualidade</option>
                                <option value="Positiva">Positiva</option>
                                <option value="Neutra">Neutra</option>
                                <option value="Negativa">Negativa</option>
                            </select>

                            {/* Status da Chamada */}
                            <select
                                value={callStatusFilter}
                                onChange={(e) => setCallStatusFilter(e.target.value)}
                                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none cursor-pointer focus:ring-2 focus:ring-red-600"
                            >
                                <option value="all">Status Chamada</option>
                                <option value="Atendida">Atendida</option>
                                <option value="Abandonada">Abandonada</option>
                            </select>

                            {/* Toggle Reincidentes */}
                            <button
                                type="button"
                                onClick={() => setOnlyRepeatsFilter(!onlyRepeatsFilter)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors border flex items-center gap-1.5 cursor-pointer ${
                                    onlyRepeatsFilter 
                                        ? 'bg-amber-500 text-white border-amber-600 shadow-2xs' 
                                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                                }`}
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Apenas Reincidentes</span>
                            </button>

                            {/* Limpar Filtros */}
                            {(searchTerm || operatorFilter !== 'all' || processFilter !== 'all' || outcomeFilter !== 'all' || proceduresFilter !== 'all' || qualityFilter !== 'all' || callStatusFilter !== 'all' || onlyRepeatsFilter) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setOperatorFilter('all');
                                        setProcessFilter('all');
                                        setOutcomeFilter('all');
                                        setProceduresFilter('all');
                                        setQualityFilter('all');
                                        setCallStatusFilter('all');
                                        setOnlyRepeatsFilter(false);
                                    }}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                    title="Limpar todos os filtros"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                    </div>
                </div>

                {/* ======================================================== */}
                {/* 6. TABELA DE AUDITORIAS                                  */}
                {/* ======================================================== */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-gray-900 uppercase tracking-wider">
                                Registros de Auditoria
                            </span>
                            <span className="text-xs text-gray-400 font-normal">
                                ({filteredAudits.length} de {audits.length} total)
                            </span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center flex flex-col items-center justify-center text-gray-400 space-y-2">
                            <Loader2 className="w-6 h-6 animate-spin text-red-600" />
                            <span className="text-xs font-medium">Carregando auditorias terceirizadas...</span>
                        </div>
                    ) : filteredAudits.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center justify-center text-gray-400 space-y-2">
                            <Headphones className="w-10 h-10 text-gray-300 mb-1" />
                            <h4 className="text-sm font-bold text-gray-700">Nenhuma auditoria encontrada</h4>
                            <p className="text-xs text-gray-500 max-w-sm">
                                Não há auditorias lançadas para este filtro ou período. Utilize o botão "Lançar Auditoria" para cadastrar uma nova avaliação.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-gray-600">
                                <thead className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">Data</th>
                                        <th className="px-4 py-3">Protocolos</th>
                                        <th className="px-4 py-3">Cliente</th>
                                        <th className="px-4 py-3">Operador</th>
                                        <th className="px-4 py-3">Processo</th>
                                        <th className="px-4 py-3">Procedimento</th>
                                        <th className="px-4 py-3">Qualidade</th>
                                        <th className="px-4 py-3">Status Chamada</th>
                                        <th className="px-4 py-3">Saída (FCR)</th>
                                        <th className="px-4 py-3 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredAudits.map((item) => {
                                        const cKey = item.clientName ? item.clientName.trim().toLowerCase() : '';
                                        const totalClientCalls = clientHistoryMap[cKey]?.length || 0;
                                        const isRepeat = totalClientCalls > 1;

                                        return (
                                            <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                                                
                                                {/* Data */}
                                                <td className="px-4 py-3.5 whitespace-nowrap font-medium text-gray-900">
                                                    {item.date ? item.date.split('-').reverse().join('/') : '--'}
                                                </td>

                                                {/* Protocolo Terceirizada & MK */}
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-gray-900">
                                                            <span>#{item.protocol}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCopy(item.protocol, `prot_${item.id}`)}
                                                                className="text-gray-400 hover:text-gray-700 cursor-pointer"
                                                                title="Copiar protocolo"
                                                            >
                                                                {copiedField === `prot_${item.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                                            </button>
                                                        </div>
                                                        {item.erpProtocol && (
                                                            <div className="flex items-center gap-1 text-[10px] text-gray-500 font-mono">
                                                                <span>MK: {item.erpProtocol}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Nome do Cliente com Badge de Reincidência */}
                                                <td className="px-4 py-3.5">
                                                    <div className="space-y-0.5">
                                                        <span className="font-bold text-gray-900 block truncate max-w-44">
                                                            {item.clientName}
                                                        </span>
                                                        {isRepeat && (
                                                            <span 
                                                                onClick={() => setSearchTerm(item.clientName)}
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer hover:bg-amber-200"
                                                                title="Cliente reincidente! Clique para filtrar todas as chamadas deste cliente"
                                                            >
                                                                <RefreshCw className="w-2.5 h-2.5" />
                                                                Reincidente ({totalClientCalls}x)
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Operador Terceirizado */}
                                                <td className="px-4 py-3.5 whitespace-nowrap font-medium text-gray-800">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-5 h-5 rounded-full bg-zinc-800 text-white flex items-center justify-center text-[10px] font-bold">
                                                            {(item.operatorName || 'O').charAt(0).toUpperCase()}
                                                        </div>
                                                        <span>{item.operatorName}</span>
                                                    </div>
                                                </td>

                                                {/* Processo Realizado */}
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                                        {item.process || 'Sem acesso'}
                                                    </span>
                                                </td>

                                                {/* Procedimentos */}
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        item.procedures === 'Conforme' 
                                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                                            : 'bg-red-100 text-red-800 border border-red-200'
                                                    }`}>
                                                        {item.procedures === 'Conforme' ? (
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                        ) : (
                                                            <XCircle className="w-3 h-3 text-red-600" />
                                                        )}
                                                        {item.procedures || 'Conforme'}
                                                    </span>
                                                </td>

                                                {/* Qualidade */}
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                                        item.quality === 'Positiva'
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : item.quality === 'Neutra'
                                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                            : 'bg-red-50 text-red-700 border border-red-200'
                                                    }`}>
                                                        {item.quality === 'Positiva' ? '👍 Positiva' : item.quality === 'Neutra' ? '😐 Neutra' : '👎 Negativa'}
                                                    </span>
                                                </td>

                                                {/* Status Chamada (Terceirizada) */}
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                                        item.callStatus === 'Atendida'
                                                            ? 'bg-gray-100 text-gray-800 border border-gray-200'
                                                            : 'bg-red-50 text-red-700 border border-red-200 font-bold'
                                                    }`}>
                                                        {item.callStatus === 'Atendida' ? (
                                                            <PhoneIncoming className="w-3 h-3 text-emerald-600" />
                                                        ) : (
                                                            <PhoneMissed className="w-3 h-3 text-red-600" />
                                                        )}
                                                        {item.callStatus || 'Atendida'}
                                                    </span>
                                                </td>

                                                {/* Saída (Resolvido vs Encaminhado = FCR) */}
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-2xs ${
                                                        item.outcome === 'Resolvido'
                                                            ? 'bg-emerald-600 text-white'
                                                            : 'bg-blue-600 text-white'
                                                    }`}>
                                                        {item.outcome === 'Resolvido' ? (
                                                            <Check className="w-3 h-3" />
                                                        ) : (
                                                            <ArrowRight className="w-3 h-3" />
                                                        )}
                                                        {item.outcome || 'Resolvido'}
                                                    </span>
                                                </td>

                                                {/* Ações */}
                                                <td className="px-4 py-3.5 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewingAudit(item)}
                                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                            title="Ver detalhes da auditoria e histórico do cliente"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                        {hasEditPermission && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenEditModal(item)}
                                                                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                                                    title="Editar auditoria"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setDeletingId(item.id)}
                                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                                    title="Excluir auditoria"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>

                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ======================================================== */}
                {/* 7. MODAL DE CADASTRO / EDIÇÃO DE AUDITORIA               */}
                {/* ======================================================== */}
                {isFormModalOpen && (
                    <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-3 sm:p-4 z-[80] backdrop-blur-xs">
                        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
                            
                            {/* Cabeçalho do Modal */}
                            <div className="p-5 bg-zinc-950 text-white flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-red-600/30 border border-red-500/40 text-red-400 flex items-center justify-center">
                                        <Headphones className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-white">
                                            {editingAudit ? 'Editar Auditoria Terceirizada' : 'Nova Auditoria Terceirizada'}
                                        </h3>
                                        <p className="text-[11px] text-zinc-400">
                                            Preencha as informações coletadas no admin e verifique a conformidade.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsFormModalOpen(false)}
                                    className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Formulário com Scroll */}
                            <form id="auditThirdPartyForm" onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 bg-gray-50 flex-1">
                                
                                {/* 1. DADOS COLETADOS NO SISTEMA ADMIN DA TERCEIRIZADA */}
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
                                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-1.5">
                                        <PhoneIncoming className="w-3.5 h-3.5 text-red-600" />
                                        1. Chamada Coletada no Admin Terceirizada
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {/* Data */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                Data da Chamada *
                                            </label>
                                            <input
                                                type="date"
                                                required
                                                value={formData.date}
                                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-red-600 font-medium"
                                            />
                                        </div>

                                        {/* Protocolo da Terceirizada */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                Protocolo Chamada *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Ex: #PBX-94821"
                                                value={formData.protocol}
                                                onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
                                                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono outline-none focus:bg-white focus:ring-2 focus:ring-red-600"
                                            />
                                        </div>

                                        {/* Status da Chamada */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                Status da Chamada *
                                            </label>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, callStatus: 'Atendida' })}
                                                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                                        formData.callStatus === 'Atendida'
                                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                                                    }`}
                                                >
                                                    <PhoneIncoming className="w-3 h-3" />
                                                    Atendida
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, callStatus: 'Abandonada' })}
                                                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                                        formData.callStatus === 'Abandonada'
                                                            ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                                                    }`}
                                                >
                                                    <PhoneMissed className="w-3 h-3" />
                                                    Abandonada
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. OPERADOR E PROTOCOLO MK (ERP) */}
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
                                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5 text-red-600" />
                                        2. Atendimento & Identificação
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* Nome do Operador (Salvo após informado e exibido em lista suspensa) */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                Nome do Operador Terceirizado *
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    required
                                                    list="operatorsDatalist"
                                                    placeholder="Selecione ou digite novo operador..."
                                                    value={formData.operatorName}
                                                    onChange={(e) => setFormData({ ...formData, operatorName: e.target.value })}
                                                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-red-600 font-medium"
                                                />
                                                <datalist id="operatorsDatalist">
                                                    {allAvailableOperators.map(op => (
                                                        <option key={op} value={op} />
                                                    ))}
                                                </datalist>
                                            </div>
                                            <span className="text-[10px] text-gray-400 mt-0.5 block">
                                                Salvo automaticamente para as próximas listas suspensas.
                                            </span>
                                        </div>

                                        {/* Protocolo MK (ERP) */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                Protocolo no MK (ERP)
                                            </label>
                                            <div className="relative">
                                                <Database className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                                                <input
                                                    type="text"
                                                    placeholder="Protocolo ERP para consulta posterior..."
                                                    value={formData.erpProtocol}
                                                    onChange={(e) => setFormData({ ...formData, erpProtocol: e.target.value })}
                                                    className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono outline-none focus:bg-white focus:ring-2 focus:ring-red-600"
                                                />
                                            </div>
                                            <span className="text-[10px] text-gray-400 mt-0.5 block">
                                                Permite auditar diretamente no ERP posteriormente.
                                            </span>
                                        </div>
                                    </div>

                                    {/* Nome do Cliente com Detector de Reincidência */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                            Nome do Cliente (Consulta de Reincidência Fora de Horário) *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Nome completo do cliente atendido..."
                                            value={formData.clientName}
                                            onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-red-600 font-medium"
                                        />

                                        {/* Alerta em tempo real de reincidência */}
                                        {currentClientRepeats.length > 0 && (
                                            <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-amber-900 text-[11px] animate-in fade-in">
                                                <RefreshCw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                                <div>
                                                    <strong className="block font-bold">
                                                        Atenção: Cliente Reincidente Fora de Horário!
                                                    </strong>
                                                    <span>
                                                        Já constam {currentClientRepeats.length} chamada(s) registrada(s) para este cliente.
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 3. AVALIAÇÃO DE QUALIDADE, PROCESSO E SAÍDA */}
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
                                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-1.5">
                                        <ShieldCheck className="w-3.5 h-3.5 text-red-600" />
                                        3. Critérios de Qualidade & Saída (FCR)
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        
                                        {/* Procedimentos */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                Procedimentos *
                                            </label>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, procedures: 'Conforme' })}
                                                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                                        formData.procedures === 'Conforme'
                                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                                                    }`}
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Conforme
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, procedures: 'Não conforme' })}
                                                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                                        formData.procedures === 'Não conforme'
                                                            ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                                                    }`}
                                                >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    Não conforme
                                                </button>
                                            </div>
                                        </div>

                                        {/* Qualidade */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                Qualidade do Atendimento *
                                            </label>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {['Positiva', 'Neutra', 'Negativa'].map(q => (
                                                    <button
                                                        key={q}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, quality: q })}
                                                        className={`py-2 text-[11px] font-bold rounded-xl border transition-all cursor-pointer text-center ${
                                                            formData.quality === q
                                                                ? q === 'Positiva'
                                                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                                                    : q === 'Neutra'
                                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                                    : 'bg-red-600 text-white border-red-600'
                                                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                                                        }`}
                                                    >
                                                        {q}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                        
                                        {/* Processo Realizado */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                Processo Realizado *
                                            </label>
                                            <select
                                                required
                                                value={formData.process}
                                                onChange={(e) => setFormData({ ...formData, process: e.target.value })}
                                                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:bg-white focus:ring-2 focus:ring-red-600 cursor-pointer"
                                            >
                                                {OFFICIAL_PROCESSES.map(proc => (
                                                    <option key={proc} value={proc}>{proc}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Saída (Encaminhado / Resolvido = FCR) */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                Saída da Chamada (Cálculo FCR) *
                                            </label>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, outcome: 'Resolvido' })}
                                                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                                        formData.outcome === 'Resolvido'
                                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs ring-2 ring-emerald-500/20'
                                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                                                    }`}
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                    Resolvido (FCR)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, outcome: 'Encaminhado' })}
                                                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                                        formData.outcome === 'Encaminhado'
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs ring-2 ring-blue-500/20'
                                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                                                    }`}
                                                >
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                    Encaminhado
                                                </button>
                                            </div>
                                        </div>

                                    </div>

                                    {/* Observações / Parecer */}
                                    <div className="pt-1">
                                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                            Observações / Parecer do Auditor (Opcional)
                                        </label>
                                        <textarea
                                            rows="2"
                                            placeholder="Detalhes adicionais, anotações de falha ou elogio ao operador..."
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 outline-none focus:bg-white focus:ring-2 focus:ring-red-600 resize-none leading-relaxed"
                                        />
                                    </div>
                                </div>

                            </form>

                            {/* Rodapé do Modal */}
                            <div className="p-4 bg-white border-t border-gray-200 flex gap-2.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsFormModalOpen(false)}
                                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-bold text-xs transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    form="auditThirdPartyForm"
                                    disabled={saving}
                                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-colors disabled:opacity-70 flex justify-center items-center gap-1.5 shadow-sm cursor-pointer"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Salvar Auditoria
                                </button>
                            </div>

                        </div>
                    </div>
                )}

                {/* ======================================================== */}
                {/* 8. MODAL DE VISUALIZAÇÃO DE DETALHES DA AUDITORIA        */}
                {/* ======================================================== */}
                {viewingAudit && (
                    <div className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-3 sm:p-4 z-[80] backdrop-blur-xs">
                        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                            
                            <div className="p-5 bg-zinc-950 text-white flex justify-between items-center shrink-0 border-b border-zinc-800">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-red-600/30 text-red-400 flex items-center justify-center">
                                        <Headphones className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white">
                                            Auditoria #{viewingAudit.protocol}
                                        </h3>
                                        <span className="text-[10px] text-zinc-400">
                                            Data: {viewingAudit.date} • Auditor: {viewingAudit.auditorName || 'Auditor'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setViewingAudit(null)}
                                    className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-4 text-xs bg-gray-50 flex-1">
                                
                                {/* Badges Principais */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                                        <span className="text-[10px] text-gray-400 block font-bold">Saída (FCR)</span>
                                        <span className={`font-black text-xs block mt-0.5 ${viewingAudit.outcome === 'Resolvido' ? 'text-emerald-700' : 'text-blue-700'}`}>
                                            {viewingAudit.outcome || 'Resolvido'}
                                        </span>
                                    </div>
                                    <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                                        <span className="text-[10px] text-gray-400 block font-bold">Procedimento</span>
                                        <span className={`font-bold text-xs block mt-0.5 ${viewingAudit.procedures === 'Conforme' ? 'text-emerald-700' : 'text-red-700'}`}>
                                            {viewingAudit.procedures || 'Conforme'}
                                        </span>
                                    </div>
                                    <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                                        <span className="text-[10px] text-gray-400 block font-bold">Qualidade</span>
                                        <span className="font-bold text-xs text-gray-800 block mt-0.5">
                                            {viewingAudit.quality || 'Positiva'}
                                        </span>
                                    </div>
                                    <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                                        <span className="text-[10px] text-gray-400 block font-bold">Status Chamada</span>
                                        <span className="font-bold text-xs text-gray-800 block mt-0.5">
                                            {viewingAudit.callStatus || 'Atendida'}
                                        </span>
                                    </div>
                                </div>

                                {/* Dados da Chamada */}
                                <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2.5">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <span className="text-[10px] text-gray-400 block font-bold uppercase">Operador Terceirizado</span>
                                            <span className="font-bold text-gray-900 text-sm">{viewingAudit.operatorName}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-400 block font-bold uppercase">Processo Realizado</span>
                                            <span className="font-bold text-gray-900 text-sm">{viewingAudit.process}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                                        <div>
                                            <span className="text-[10px] text-gray-400 block font-bold uppercase">Cliente</span>
                                            <span className="font-bold text-gray-900">{viewingAudit.clientName}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-400 block font-bold uppercase">Protocolo no MK (ERP)</span>
                                            <span className="font-mono font-bold text-gray-900">{viewingAudit.erpProtocol || 'Não informado'}</span>
                                        </div>
                                    </div>

                                    {viewingAudit.notes && (
                                        <div className="pt-2 border-t border-gray-100">
                                            <span className="text-[10px] text-gray-400 block font-bold uppercase mb-1">Observações do Auditor</span>
                                            <p className="p-3 bg-gray-50 rounded-lg text-gray-700 leading-relaxed whitespace-pre-wrap">
                                                {viewingAudit.notes}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Histórico de Reincidência Deste Cliente */}
                                {viewingAudit.clientName && clientHistoryMap[viewingAudit.clientName.trim().toLowerCase()]?.length > 1 && (
                                    <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 space-y-2">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase">
                                            <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                                            <span>Histórico de Chamadas deste Cliente ({clientHistoryMap[viewingAudit.clientName.trim().toLowerCase()].length} atendimentos)</span>
                                        </div>
                                        <p className="text-[11px] text-amber-800">
                                            Outras chamadas registradas fora de horário para o cliente <strong>{viewingAudit.clientName}</strong>:
                                        </p>
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                            {clientHistoryMap[viewingAudit.clientName.trim().toLowerCase()].map((ch, idx) => (
                                                <div key={idx} className="p-2 rounded-lg bg-white border border-amber-200 text-[11px] flex items-center justify-between">
                                                    <div>
                                                        <span className="font-bold text-gray-900">{ch.date}</span> • #{ch.protocol}
                                                        <span className="text-gray-500 block text-[10px]">{ch.operatorName} • {ch.process}</span>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ch.outcome === 'Resolvido' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                                                        {ch.outcome}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            </div>

                            <div className="p-4 bg-white border-t border-gray-200 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setViewingAudit(null)}
                                    className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                                >
                                    Fechar
                                </button>
                            </div>

                        </div>
                    </div>
                )}

                {/* ======================================================== */}
                {/* 9. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO                      */}
                {/* ======================================================== */}
                {deletingId && (
                    <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[90] backdrop-blur-xs">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-6 animate-in zoom-in-95 duration-150">
                            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-red-600">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-bold text-gray-900 mb-1">Excluir Auditoria?</h3>
                            <p className="text-gray-500 text-xs mb-5 leading-relaxed">
                                Tem certeza de que deseja excluir este registro de auditoria? Esta ação não pode ser desfeita.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setDeletingId(null)}
                                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(deletingId)}
                                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
                                >
                                    Sim, Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
