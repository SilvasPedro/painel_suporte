import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Headphones, PhoneIncoming, PhoneMissed, CheckCircle2, XCircle, 
    AlertCircle, ThumbsUp, ThumbsDown, Plus, Search, Filter, 
    Download, Edit2, Trash2, Eye, X, Save, Loader2, Calendar, 
    User, FileText, Database, TrendingUp, BarChart2, Check, 
    Copy, ArrowRight, ShieldCheck, Target, Clock, AlertTriangle, 
    Users, RefreshCw, Sparkles, ChevronRight, Upload, FileUp, FileSpreadsheet
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

    // Referência para input de importação de arquivo CSV
    const fileInputRef = useRef(null);
    const [isImporting, setIsImporting] = useState(false);

    // Estados de dados
    const [audits, setAudits] = useState([]);
    const [savedOperators, setSavedOperators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    // Mês selecionado para análise (padrão: mês corrente YYYY-MM)
    const currentMonthKey = useMemo(() => {
        const d = new Date();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${d.getFullYear()}-${m}`;
    }, []);

    // Mês anterior (YYYY-MM)
    const previousMonthKey = useMemo(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${d.getFullYear()}-${m}`;
    }, []);

    const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
    // Tipos de filtro por período: 'current' | 'previous' | 'last7' | 'last30' | 'custom' | 'month' | 'all'
    const [periodType, setPeriodType] = useState('current');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    // Filtros de busca e listagem
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'completed'
    const [operatorFilter, setOperatorFilter] = useState('all');
    const [processFilter, setProcessFilter] = useState('all');
    const [outcomeFilter, setOutcomeFilter] = useState('all'); // 'all' | 'Resolvido' | 'Encaminhado'
    const [proceduresFilter, setProceduresFilter] = useState('all'); // 'all' | 'Conforme' | 'Não conforme'
    const [qualityFilter, setQualityFilter] = useState('all'); // 'all' | 'Positiva' | 'Neutra' | 'Negativa'
    const [onlyRepeatsFilter, setOnlyRepeatsFilter] = useState(false);

    // Modais
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingAudit, setEditingAudit] = useState(null);
    const [viewingAudit, setViewingAudit] = useState(null);
    const [copiedField, setCopiedField] = useState(null);

    // Regra de validação: Verificação de auditoria concluída vs pendente de preenchimento
    const isAuditCompleted = (a) => Boolean(
        a.clientName && a.clientName.trim() && 
        a.operatorName && a.operatorName.trim() && 
        a.procedures && a.outcome
    );
    const isAuditPending = (a) => !isAuditCompleted(a);

    // Estado do formulário - O campo 'date' inicia SEMPRE em branco para nova auditoria manual
    // Procedimentos e Saída iniciam desmarcados para o auditor selecionar obrigatoriamente
    // Qualidade inicia marcada como Neutra por padrão
    // CallStatus fixado em 'Atendida' (apenas atendidas são registradas)
    const initialFormState = {
        date: '',               // SEMPRE em branco para nova auditoria (obrigatório informar)
        protocol: '',
        callStatus: 'Atendida', // Apenas chamadas atendidas são registradas
        procedures: '',         // Desmarcado por padrão para seleção ativa do auditor
        quality: 'Neutra',      // Padrão marcada qualidade Neutra
        process: 'Sem acesso',
        operatorName: '',
        erpProtocol: '',
        clientName: '',
        outcome: '',            // Desmarcado por padrão para seleção ativa do auditor
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

    // Verificação de protocolo já existente no sistema (evita duplicidade de auditorias)
    const duplicateProtocolAudit = useMemo(() => {
        const raw = (formData.protocol || '').trim().toLowerCase();
        if (!raw) return null;
        return audits.find(a => {
            if (editingAudit && a.id === editingAudit.id) return false;
            return (a.protocol || '').trim().toLowerCase() === raw;
        }) || null;
    }, [formData.protocol, audits, editingAudit]);

    // Atalhos para preenchimento rápido do parecer do auditor
    const handleApplyNoteShortcut = (shortcutText) => {
        setFormData(prev => {
            if (!prev.notes.trim()) {
                return { ...prev, notes: shortcutText };
            }
            if (prev.notes.includes(shortcutText)) {
                return prev;
            }
            return { ...prev, notes: `${prev.notes.trim()}\n${shortcutText}` };
        });
    };
    const handleApplyCommentShortcut = handleApplyNoteShortcut;

    // Filtra as auditorias pelo período selecionado (Mês vigente, anterior, últimos dias, intervalo personalizado ou todas)
    const periodAudits = useMemo(() => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        return audits.filter(a => {
            if (!a.date) return false;

            if (periodType === 'all') return true;

            if (periodType === 'current') {
                return a.date.startsWith(currentMonthKey);
            }

            if (periodType === 'previous') {
                return a.date.startsWith(previousMonthKey);
            }

            if (periodType === 'month') {
                return a.date.startsWith(selectedMonth);
            }

            if (periodType === 'last7') {
                const d7 = new Date();
                d7.setDate(d7.getDate() - 7);
                const d7Str = d7.toISOString().split('T')[0];
                return a.date >= d7Str && a.date <= todayStr;
            }

            if (periodType === 'last30') {
                const d30 = new Date();
                d30.setDate(d30.getDate() - 30);
                const d30Str = d30.toISOString().split('T')[0];
                return a.date >= d30Str && a.date <= todayStr;
            }

            if (periodType === 'custom') {
                if (customStartDate && a.date < customStartDate) return false;
                if (customEndDate && a.date > customEndDate) return false;
                return true;
            }

            return true;
        });
    }, [audits, periodType, currentMonthKey, previousMonthKey, selectedMonth, customStartDate, customEndDate]);

    // Rótulo legível do período selecionado
    const activePeriodLabel = useMemo(() => {
        if (periodType === 'current') return `Mês Vigente (${currentMonthKey.split('-')[1]}/${currentMonthKey.split('-')[0]})`;
        if (periodType === 'previous') return `Mês Anterior (${previousMonthKey.split('-')[1]}/${previousMonthKey.split('-')[0]})`;
        if (periodType === 'last7') return 'Últimos 7 Dias';
        if (periodType === 'last30') return 'Últimos 30 Dias';
        if (periodType === 'month') return `Mês ${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]}`;
        if (periodType === 'custom') {
            if (customStartDate && customEndDate) return `${customStartDate.split('-').reverse().join('/')} até ${customEndDate.split('-').reverse().join('/')}`;
            if (customStartDate) return `A partir de ${customStartDate.split('-').reverse().join('/')}`;
            if (customEndDate) return `Até ${customEndDate.split('-').reverse().join('/')}`;
            return 'Intervalo Personalizado';
        }
        return 'Todo o Histórico';
    }, [periodType, currentMonthKey, previousMonthKey, selectedMonth, customStartDate, customEndDate]);

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

            // Filtro de Status de Preenchimento da Auditoria (Pendentes vs Concluídas)
            if (statusFilter === 'pending' && !isAuditPending(item)) {
                return false;
            }
            if (statusFilter === 'completed' && !isAuditCompleted(item)) {
                return false;
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

            // Filtro apenas reincidentes
            if (onlyRepeatsFilter) {
                const cKey = item.clientName ? item.clientName.trim().toLowerCase() : '';
                const totalCalls = clientHistoryMap[cKey]?.length || 0;
                if (totalCalls < 2) return false;
            }

            return true;
        });
    }, [
        periodAudits, searchTerm, statusFilter, operatorFilter, processFilter, 
        outcomeFilter, proceduresFilter, qualityFilter, 
        onlyRepeatsFilter, clientHistoryMap
    ]);

    // ========================================================
    // CÁLCULO DAS MÉTRICAS E INDICADORES OFICIAIS
    // ========================================================
    const metrics = useMemo(() => {
        const total = periodAudits.length;
        const completedAudits = periodAudits.filter(isAuditCompleted);
        const pendingAudits = periodAudits.filter(isAuditPending);
        const completedCount = completedAudits.length;
        const pendingCount = pendingAudits.length;

        if (total === 0) {
            return {
                total: 0,
                completedCount: 0,
                pendingCount: 0,
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
                totalQualityRated: 0,
                qualityPositiveRate: 0
            };
        }

        // 1. Progresso Atual: % de atendimentos concluídos e quantas pendentes
        const progressPercent = total > 0 ? Math.round((completedCount / total) * 100) : 100;

        // 2. FCR (First Call Resolution com base nas auditorias já preenchidas)
        const totalResolved = completedAudits.filter(a => a.outcome === 'Resolvido').length;
        const totalForwarded = completedAudits.filter(a => a.outcome === 'Encaminhado').length;
        const fcrPercent = completedCount > 0 ? Math.round((totalResolved / completedCount) * 100) : 0;

        // 3. Taxa de Reincidência dos Clientes
        const clientsSeen = {};
        completedAudits.forEach(a => {
            const key = a.clientName ? a.clientName.trim().toLowerCase() : '';
            if (key) {
                clientsSeen[key] = (clientsSeen[key] || 0) + 1;
            }
        });
        const clientKeys = Object.keys(clientsSeen);
        const uniqueClientsCount = clientKeys.length;
        const repeatClients = clientKeys.filter(k => clientsSeen[k] > 1);
        const repeatClientsCount = repeatClients.length;

        // Chamadas pertencentes a clientes reincidentes
        const repeatCallsCount = completedAudits.filter(a => {
            const key = a.clientName ? a.clientName.trim().toLowerCase() : '';
            return key && clientsSeen[key] > 1;
        }).length;

        const repeatRatePercent = completedCount > 0 ? Math.round((repeatCallsCount / completedCount) * 100) : 0;

        // 4. Procedimentos (Conforme vs Não conforme)
        const totalConforme = completedAudits.filter(a => a.procedures === 'Conforme').length;
        const totalNaoConforme = completedCount - totalConforme;
        const compliancePercent = completedCount > 0 ? Math.round((totalConforme / completedCount) * 100) : 0;

        // 5. Qualidade (Positiva, Neutra, Negativa)
        // REGRA OFICIAL: Somente Positivos x Negativos (Neutros excluídos do divisor)
        const qualityPositive = completedAudits.filter(a => a.quality === 'Positiva').length;
        const qualityNeutral = completedAudits.filter(a => a.quality === 'Neutra').length;
        const qualityNegative = completedAudits.filter(a => a.quality === 'Negativa').length;
        
        const totalQualityRated = qualityPositive + qualityNegative;
        const qualityPositiveRate = totalQualityRated > 0 
            ? Math.round((qualityPositive / totalQualityRated) * 100) 
            : 0;

        return {
            total,
            completedCount,
            pendingCount,
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
            totalQualityRated,
            qualityPositiveRate
        };
    }, [periodAudits]);

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
                map[op] = { name: op, total: 0, resolvidos: 0, conformes: 0, qualPos: 0, qualNeg: 0, qualNeu: 0 };
            }
            map[op].total += 1;
            if (a.outcome === 'Resolvido') map[op].resolvidos += 1;
            if (a.procedures === 'Conforme') map[op].conformes += 1;
            if (a.quality === 'Positiva') map[op].qualPos += 1;
            if (a.quality === 'Negativa') map[op].qualNeg += 1;
            if (a.quality === 'Neutra') map[op].qualNeu += 1;
        });

        return Object.values(map)
            .map(o => {
                const ratedQual = o.qualPos + o.qualNeg;
                return {
                    ...o,
                    fcr: Math.round((o.resolvidos / o.total) * 100),
                    conformidade: Math.round((o.conformes / o.total) * 100),
                    qualidade: ratedQual > 0 ? Math.round((o.qualPos / ratedQual) * 100) : 0
                };
            })
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);
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

    // Abertura do modal de criação (garante data em branco para exigir preenchimento manual)
    const handleOpenCreateModal = () => {
        setEditingAudit(null);
        setFormData({
            ...initialFormState,
            date: '', // SEMPRE em branco na criação de nova auditoria
            procedures: '', // Desmarcado por padrão para o auditor selecionar
            outcome: '', // Desmarcado por padrão para o auditor selecionar
            quality: 'Neutra' // Padrão marcada qualidade Neutra
        });
        setIsFormModalOpen(true);
    };

    // Abertura do modal de edição (mantém a data salva da auditoria)
    const handleOpenEditModal = (audit) => {
        setEditingAudit(audit);
        setFormData({
            date: audit.date || '',
            protocol: audit.protocol || '',
            callStatus: audit.callStatus || 'Atendida',
            procedures: audit.procedures || '',
            quality: audit.quality || 'Neutra',
            process: audit.process || 'Sem acesso',
            operatorName: audit.operatorName || '',
            erpProtocol: audit.erpProtocol || '',
            clientName: audit.clientName || '',
            outcome: audit.outcome || '',
            notes: audit.notes || ''
        });
        setIsFormModalOpen(true);
    };

    // Submissão do formulário (Criação ou Edição)
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validação obrigatória da data para evitar lançamentos com datas erradas
        if (!formData.date || !formData.date.trim()) {
            showToast('A data da chamada é obrigatória. Por favor, informe a data.', 'error');
            return;
        }

        if (!formData.protocol.trim()) {
            showToast('Informe o protocolo da chamada terceirizada.', 'error');
            return;
        }

        // Validação de regra anti-duplicidade: protocolo já existente no sistema
        const cleanProtocol = formData.protocol.trim();
        const existingProtocol = audits.find(a => 
            a.protocol && 
            a.protocol.trim().toLowerCase() === cleanProtocol.toLowerCase() &&
            (!editingAudit || a.id !== editingAudit.id)
        );

        if (existingProtocol) {
            showToast('Erro: protocolo já existente no sistema! Não é permitido lançar auditorias duplicadas.', 'error');
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

        // Validação dos campos desmarcados por padrão
        if (!formData.procedures) {
            showToast('Selecione se o procedimento foi Conforme ou Não conforme.', 'error');
            return;
        }

        if (!formData.outcome) {
            showToast('Selecione a saída da chamada (Resolvido ou Encaminhado).', 'error');
            return;
        }

        setSaving(true);
        try {
            const cleanOperator = formData.operatorName.trim();
            const cleanClient = formData.clientName.trim();

            const payload = {
                date: formData.date,
                protocol: formData.protocol.trim(),
                callStatus: 'Atendida', // Só estamos registrando as chamadas atendidas
                procedures: formData.procedures,
                quality: formData.quality || 'Neutra',
                process: formData.process || 'Sem acesso',
                operatorName: cleanOperator,
                erpProtocol: (formData.erpProtocol || '').trim(),
                clientName: cleanClient,
                outcome: formData.outcome,
                notes: (formData.notes || '').trim(),
                updatedAt: new Date()
            };

            if (editingAudit) {
                await updateDoc(doc(db, 'third_party_audits', editingAudit.id), payload);
                showToast('Auditoria preenchida/atualizada com sucesso!', 'success');
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

    // Download do Modelo CSV Oficial para Importação
    const handleDownloadTemplate = () => {
        const headers = [
            'Data',
            'Protocolo',
            'Protocolo MK',
            'Cliente',
            'Operador',
            'Processo',
            'Procedimento',
            'Qualidade',
            'Saida(FCR)',
            'Comentario'
        ];
        const today = new Date().toISOString().split('T')[0];
        const sampleRows = [
            [today, '#PBX-94821', '', '', '', '', '', '', '', ''],
            [today, '#PBX-94822', '', '', '', '', '', '', '', ''],
            [today, '#PBX-94823', 'MK-44021', 'João da Silva', 'Carlos Alberto', 'Sem acesso', 'Conforme', 'Positiva', 'Resolvido', 'Problema resolvido remotamente após reinício de sinal']
        ];
        const csvContent = '\uFEFF' + [headers.join(';'), ...sampleRows.map(r => r.join(';'))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'modelo_importacao_auditorias.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Modelo de CSV baixado com sucesso! Preencha a data e o protocolo.', 'success');
    };

    // Importação em Lote via Arquivo .CSV com descarte de protocolos duplicados
    const handleImportCSV = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const text = await file.text();
            const cleanText = text.replace(/^\uFEFF/, '').trim();
            if (!cleanText) {
                showToast('O arquivo CSV selecionado está vazio.', 'warning');
                return;
            }

            const lines = cleanText.split(/\r?\n/).filter(line => line.trim().length > 0);
            if (lines.length < 2) {
                showToast('O arquivo CSV deve conter pelo menos o cabeçalho e uma linha de dados.', 'warning');
                return;
            }

            // Identifica delimitador (; ou , ou tab)
            const firstLine = lines[0];
            let delimiter = ';';
            const semicolonCount = (firstLine.match(/;/g) || []).length;
            const commaCount = (firstLine.match(/,/g) || []).length;
            const tabCount = (firstLine.match(/\t/g) || []).length;
            if (commaCount > semicolonCount && commaCount > tabCount) delimiter = ',';
            else if (tabCount > semicolonCount && tabCount > commaCount) delimiter = '\t';

            const splitLine = (line) => {
                const result = [];
                let cur = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"' || char === "'") {
                        if (inQuotes && line[i + 1] === char) {
                            cur += char;
                            i++;
                        } else {
                            inQuotes = !inQuotes;
                        }
                    } else if (char === delimiter && !inQuotes) {
                        result.push(cur.trim());
                        cur = '';
                    } else {
                        cur += char;
                    }
                }
                result.push(cur.trim());
                return result;
            };

            const rawHeaders = splitLine(lines[0]).map(h => 
                h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
            );

            const dateIdx = rawHeaders.findIndex(h => h.includes('data') || h.includes('date'));
            const protIdx = rawHeaders.findIndex(h => (h.includes('protocolo') && !h.includes('mk') && !h.includes('erp')) || h === 'protocolo' || h === 'chamada' || h.includes('atendimento'));
            const mkIdx = rawHeaders.findIndex(h => h.includes('mk') || h.includes('erp'));
            const clientIdx = rawHeaders.findIndex(h => h.includes('cliente') || h.includes('client'));
            const opIdx = rawHeaders.findIndex(h => h.includes('operador') || h.includes('atendente') || h.includes('operator'));
            const procIdx = rawHeaders.findIndex(h => h.includes('processo'));
            const procedIdx = rawHeaders.findIndex(h => h.includes('procedimento'));
            const qualIdx = rawHeaders.findIndex(h => h.includes('qualidade'));
            const outcomeIdx = rawHeaders.findIndex(h => h.includes('saida') || h.includes('fcr') || h.includes('resolucao'));
            const notesIdx = rawHeaders.findIndex(h => h.includes('comentario') || h.includes('observ') || h.includes('parecer') || h.includes('nota'));

            const normalizeDate = (raw) => {
                if (!raw) return '';
                const clean = raw.trim();
                if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
                const dmyMatch = clean.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
                if (dmyMatch) {
                    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
                }
                const ymdMatch = clean.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
                if (ymdMatch) {
                    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
                }
                return clean;
            };

            // Conjunto para descarte de duplicados existentes no sistema e no próprio arquivo
            const existingProtocolsSet = new Set(
                audits.map(a => (a.protocol || '').trim().toLowerCase()).filter(Boolean)
            );
            const batchProtocolsSet = new Set();

            let discardedCount = 0;
            const newAudits = [];

            for (let i = 1; i < lines.length; i++) {
                const cols = splitLine(lines[i]);
                if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

                const rawDate = dateIdx >= 0 ? cols[dateIdx] : cols[0];
                const rawProt = protIdx >= 0 ? cols[protIdx] : (cols[1] || cols[0]);

                const cleanProtocol = (rawProt || '').replace(/^["']|["']$/g, '').trim();
                if (!cleanProtocol) continue;

                const lowerProt = cleanProtocol.toLowerCase();

                // Regra oficial: Se o usuário tentar importar um protocolo já existente no sistema, esse protocolo deve ser descartado.
                if (existingProtocolsSet.has(lowerProt) || batchProtocolsSet.has(lowerProt)) {
                    discardedCount++;
                    continue;
                }

                batchProtocolsSet.add(lowerProt);
                existingProtocolsSet.add(lowerProt);

                const formattedDate = normalizeDate(rawDate) || new Date().toISOString().split('T')[0];
                const erpProtocol = mkIdx >= 0 && cols[mkIdx] ? cols[mkIdx].replace(/^["']|["']$/g, '').trim() : '';
                const clientName = clientIdx >= 0 && cols[clientIdx] ? cols[clientIdx].replace(/^["']|["']$/g, '').trim() : '';
                const operatorName = opIdx >= 0 && cols[opIdx] ? cols[opIdx].replace(/^["']|["']$/g, '').trim() : '';
                
                let process = 'Sem acesso';
                if (procIdx >= 0 && cols[procIdx]) {
                    const rawP = cols[procIdx].replace(/^["']|["']$/g, '').trim();
                    const matchP = OFFICIAL_PROCESSES.find(p => p.toLowerCase() === rawP.toLowerCase());
                    if (matchP) process = matchP;
                    else if (rawP) process = rawP;
                }

                let procedures = '';
                if (procedIdx >= 0 && cols[procedIdx]) {
                    const rawProc = cols[procedIdx].toLowerCase();
                    if (rawProc.includes('nao') || rawProc.includes('não')) procedures = 'Não conforme';
                    else if (rawProc.includes('conforme')) procedures = 'Conforme';
                }

                let quality = 'Neutra';
                if (qualIdx >= 0 && cols[qualIdx]) {
                    const rawQ = cols[qualIdx].toLowerCase();
                    if (rawQ.includes('pos')) quality = 'Positiva';
                    else if (rawQ.includes('neg')) quality = 'Negativa';
                    else if (rawQ.includes('neu')) quality = 'Neutra';
                }

                let outcome = '';
                if (outcomeIdx >= 0 && cols[outcomeIdx]) {
                    const rawO = cols[outcomeIdx].toLowerCase();
                    if (rawO.includes('resolv')) outcome = 'Resolvido';
                    else if (rawO.includes('encaminh')) outcome = 'Encaminhado';
                }

                const notes = notesIdx >= 0 && cols[notesIdx] ? cols[notesIdx].replace(/^["']|["']$/g, '').trim() : '';

                newAudits.push({
                    date: formattedDate,
                    protocol: cleanProtocol,
                    callStatus: 'Atendida', // Só estamos registrando chamadas atendidas
                    erpProtocol,
                    clientName,
                    operatorName,
                    process,
                    procedures,
                    quality,
                    outcome,
                    notes,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    auditorName: currentUser?.name || currentUser?.displayName || 'Auditor',
                    auditorId: currentUser?.firestoreId || currentUser?.uid || ''
                });
            }

            if (newAudits.length === 0) {
                if (discardedCount > 0) {
                    showToast(`Nenhum atendimento novo: todos os ${discardedCount} protocolo(s) já existem no sistema e foram descartados.`, 'warning');
                } else {
                    showToast('Nenhum dado válido encontrado no arquivo CSV.', 'warning');
                }
                return;
            }

            // Persistência em lote no Firestore
            for (const item of newAudits) {
                await addDoc(collection(db, 'third_party_audits'), item);
                if (item.operatorName) {
                    const opId = item.operatorName.toLowerCase().replace(/[^a-z0-9]/g, '_');
                    await setDoc(doc(db, 'third_party_operators', opId), {
                        name: item.operatorName,
                        lastUsedAt: new Date()
                    }, { merge: true });
                }
            }

            if (discardedCount > 0) {
                showToast(`Importação concluída: ${newAudits.length} atendimento(s) importado(s). ${discardedCount} protocolo(s) já existente(s) foram descartados.`, 'success');
            } else {
                showToast(`Importação concluída: ${newAudits.length} atendimento(s) importado(s) com sucesso para auditoria!`, 'success');
            }
        } catch (error) {
            console.error('Erro ao importar CSV:', error);
            showToast('Erro ao importar CSV: ' + error.message, 'error');
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Exportação em formato CSV
    const handleExportCSV = () => {
        if (filteredAudits.length === 0) {
            showToast('Nenhuma auditoria para exportar.', 'warning');
            return;
        }

        const headers = [
            'Data', 'Protocolo Terceirizada', 'Status Preenchimento', 
            'Procedimentos', 'Qualidade', 'Processo Realizado', 
            'Operador', 'Protocolo MK (ERP)', 'Cliente', 'Saída (FCR)', 
            'Auditor', 'Observações'
        ];

        const rows = filteredAudits.map(a => [
            a.date || '',
            `"${(a.protocol || '').replace(/"/g, '""')}"`,
            isAuditCompleted(a) ? 'Concluída' : 'Pendente',
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
        link.setAttribute('download', `auditorias_terceirizadas_${periodType}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Exportação concluída com sucesso!', 'success');
    };

    return (
        <div className="flex-1 p-3 sm:p-5 lg:p-6 bg-gray-50 h-full overflow-y-auto font-sans">
            {/* Input Oculto de Arquivo CSV */}
            <input 
                type="file"
                ref={fileInputRef}
                onChange={handleImportCSV}
                accept=".csv, .txt"
                className="hidden"
            />

            <div className="w-full max-w-none space-y-4 sm:space-y-5">

                {/* ======================================================== */}
                {/* 1. CABEÇALHO EXECUTIVO E CONTROLES GERAIS                */}
                {/* ======================================================== */}
                <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs p-4 sm:p-5 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-red-600 to-zinc-900 text-white flex items-center justify-center shrink-0 shadow-md">
                            <Headphones className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                                    Auditorias de Qualidade Terceirizada
                                </h1>
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                                    Equipe Externa • v3.7.2
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Importação de atendimentos via CSV, auditoria de conformidade, FCR na saída e reincidência fora de horário.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start xl:justify-end">
                        {/* Botão Baixar Modelo CSV */}
                        <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            className="px-3 py-2 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            title="Baixar modelo de CSV com colunas pré-formatadas para importação"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Modelo CSV</span>
                        </button>

                        {/* Botão Importar CSV */}
                        {hasEditPermission && (
                            <button
                                type="button"
                                disabled={isImporting}
                                onClick={() => fileInputRef.current?.click()}
                                className="px-3.5 py-2 bg-white hover:bg-blue-50 text-blue-800 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                title="Importar atendimentos via arquivo .CSV (Data e Protocolo)"
                            >
                                {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> : <Upload className="w-3.5 h-3.5 text-blue-600" />}
                                <span>Importar CSV</span>
                            </button>
                        )}

                        {/* Botão Exportar CSV */}
                        <button
                            type="button"
                            onClick={handleExportCSV}
                            className="px-3 py-2 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl border border-gray-200 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            title="Exportar dados filtrados em CSV"
                        >
                            <Download className="w-3.5 h-3.5 text-gray-500" />
                            <span>Exportar CSV</span>
                        </button>

                        {/* Botão Nova Auditoria */}
                        {hasEditPermission && (
                            <button
                                type="button"
                                onClick={handleOpenCreateModal}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md shadow-red-950/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Lançar Manual</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* ======================================================== */}
                {/* 1.1 BARRA COMPLETA DE FILTRO POR PERÍODO                 */}
                {/* ======================================================== */}
                <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs p-3.5 sm:p-4 space-y-3">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-red-600 shrink-0" />
                            <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                                Filtrar por Período:
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                                {activePeriodLabel}
                            </span>
                            <span className="text-xs text-gray-400 font-medium">
                                • {periodAudits.length} registro{periodAudits.length !== 1 ? 's' : ''} no período
                            </span>
                        </div>

                        {/* Presets Rápidos de Período */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setPeriodType('current')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    periodType === 'current'
                                        ? 'bg-red-600 text-white shadow-2xs'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                            >
                                Mês Vigente
                            </button>

                            <button
                                type="button"
                                onClick={() => setPeriodType('previous')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    periodType === 'previous'
                                        ? 'bg-red-600 text-white shadow-2xs'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                            >
                                Mês Anterior
                            </button>

                            <button
                                type="button"
                                onClick={() => setPeriodType('last7')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    periodType === 'last7'
                                        ? 'bg-red-600 text-white shadow-2xs'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                            >
                                Últimos 7 Dias
                            </button>

                            <button
                                type="button"
                                onClick={() => setPeriodType('last30')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    periodType === 'last30'
                                        ? 'bg-red-600 text-white shadow-2xs'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                            >
                                Últimos 30 Dias
                            </button>

                            <button
                                type="button"
                                onClick={() => setPeriodType('custom')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    periodType === 'custom'
                                        ? 'bg-red-600 text-white shadow-2xs'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                            >
                                Intervalo (De - Até)
                            </button>

                            {/* Dropdown de Meses Anteriores */}
                            <select
                                value={periodType === 'month' ? selectedMonth : ''}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        setSelectedMonth(e.target.value);
                                        setPeriodType('month');
                                    }
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer outline-none border ${
                                    periodType === 'month'
                                        ? 'bg-red-600 text-white border-red-600'
                                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                                }`}
                            >
                                <option value="" disabled>Outros Meses...</option>
                                {availableMonths.map(m => (
                                    <option key={m} value={m} className="bg-white text-gray-800">
                                        Mês {m.split('-')[1]}/{m.split('-')[0]}
                                    </option>
                                ))}
                            </select>

                            <button
                                type="button"
                                onClick={() => setPeriodType('all')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    periodType === 'all'
                                        ? 'bg-zinc-900 text-white shadow-2xs'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                            >
                                Todo o Histórico
                            </button>
                        </div>
                    </div>

                    {/* Inputs de Data Inicial e Final quando Período Personalizado está selecionado */}
                    {periodType === 'custom' && (
                        <div className="pt-2.5 border-t border-gray-100 flex flex-wrap items-center gap-3 bg-red-50/50 p-2.5 rounded-xl border border-red-100 text-xs animate-in fade-in">
                            <span className="font-bold text-red-900 flex items-center gap-1">
                                <Filter className="w-3.5 h-3.5 text-red-600" />
                                Definir Intervalo de Datas:
                            </span>

                            <div className="flex items-center gap-1.5">
                                <label className="text-gray-600 font-semibold text-[11px]">De:</label>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-red-600 font-medium"
                                />
                            </div>

                            <div className="flex items-center gap-1.5">
                                <label className="text-gray-600 font-semibold text-[11px]">Até:</label>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-red-600 font-medium"
                                />
                            </div>

                            {(customStartDate || customEndDate) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCustomStartDate('');
                                        setCustomEndDate('');
                                    }}
                                    className="px-2 py-1 text-red-700 hover:bg-red-100 rounded-lg font-bold text-[11px] cursor-pointer"
                                >
                                    Limpar datas
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* ======================================================== */}
                {/* 2. CARD PRINCIPAL: PROGRESSO ATUAL (% E PENDENTES)       */}
                {/* ======================================================== */}
                <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-red-950 text-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-md border border-zinc-800/80 relative overflow-hidden">
                    <div className="absolute right-0 top-0 bottom-0 w-96 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 relative z-10">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-zinc-300 border border-white/20">
                                    <Clock className="w-3 h-3 text-amber-400" />
                                    Progresso do Período ({activePeriodLabel})
                                </span>
                                <span className="text-[11px] text-zinc-400 font-medium">
                                    Acompanhamento em tempo real de atendimentos preenchidos
                                </span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1 flex items-baseline gap-2">
                                <span>{metrics.completedCount} auditorias concluídas</span>
                                <span className="text-xs font-normal text-zinc-400">
                                    de {metrics.total} registradas no período
                                </span>
                            </h2>
                        </div>

                        {/* Indicador Numérico Grande e Resumo de Pendentes */}
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <span className={`text-3xl sm:text-4xl font-black ${
                                    metrics.progressPercent === 100 && metrics.total > 0
                                        ? 'text-emerald-400'
                                        : metrics.progressPercent >= 70
                                        ? 'text-amber-400'
                                        : 'text-red-400'
                                }`}>
                                    {metrics.progressPercent}%
                                </span>
                                <span className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                                    Progresso Atual
                                </span>
                            </div>

                            <div className="border-l border-zinc-800 pl-4 space-y-1">
                                <div className="flex items-center gap-1.5">
                                    <span className={`w-2.5 h-2.5 rounded-full ${metrics.pendingCount > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></span>
                                    <span className="text-xs font-bold text-zinc-200">
                                        {metrics.pendingCount} pendente{metrics.pendingCount !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                {metrics.pendingCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
                                        className="text-[11px] text-amber-400 hover:text-amber-300 underline font-bold cursor-pointer block"
                                    >
                                        {statusFilter === 'pending' ? 'Ver todas' : 'Filtrar pendentes'}
                                    </button>
                                )}
                            </div>
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
                            <span>0%</span>
                            <span>
                                {metrics.total === 0 ? (
                                    'Nenhum atendimento importado neste período'
                                ) : metrics.pendingCount === 0 ? (
                                    <strong className="text-emerald-400">🎉 Todos os atendimentos do período estão 100% auditados!</strong>
                                ) : (
                                    `Faltam preencher ${metrics.pendingCount} atendimento(s) pendente(s)`
                                )}
                            </span>
                            <span>100%</span>
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
                                Qualidade (Positivos x Negativos)
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
                                {metrics.totalQualityRated > 0 ? `${metrics.qualityPositive} de ${metrics.totalQualityRated} avaliados` : 'Sem avaliações'}
                            </span>
                        </div>
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600">
                            <span className="text-emerald-600 font-bold" title="Positivos (somam a favor)">👍 {metrics.qualityPositive}</span>
                            <span className="text-gray-400 font-medium" title="Neutros não descontam nem somam no % total">😐 {metrics.qualityNeutral} <span className="text-[9px] text-gray-400 font-normal">(Neutros)</span></span>
                            <span className="text-red-600 font-bold" title="Negativos (descontam contra)">👎 {metrics.qualityNegative}</span>
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
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800" title="Conformidade de Procedimentos">
                                                    Conf {op.conformidade}%
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800" title="Qualidade (Positivos x Negativos, sem neutros)">
                                                    QA {op.qualidade}%
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
                            
                            {/* Filtro de Status de Preenchimento */}
                            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter('all')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        statusFilter === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    Todos ({periodAudits.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter('pending')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                        statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-2xs' : 'text-amber-700 hover:bg-amber-50'
                                    }`}
                                >
                                    <AlertCircle className="w-3 h-3" />
                                    Pendentes ({metrics.pendingCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter('completed')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                        statusFilter === 'completed' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:bg-emerald-50'
                                    }`}
                                >
                                    <CheckCircle2 className="w-3 h-3" />
                                    Concluídas ({metrics.completedCount})
                                </button>
                            </div>

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
                            {(searchTerm || statusFilter !== 'all' || operatorFilter !== 'all' || processFilter !== 'all' || outcomeFilter !== 'all' || proceduresFilter !== 'all' || qualityFilter !== 'all' || onlyRepeatsFilter) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setStatusFilter('all');
                                        setOperatorFilter('all');
                                        setProcessFilter('all');
                                        setOutcomeFilter('all');
                                        setProceduresFilter('all');
                                        setQualityFilter('all');
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
                                Não há auditorias lançadas para este filtro ou período. Utilize o botão "Importar CSV" ou "Lançar Manual" para cadastrar avaliações.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left text-xs text-gray-600 table-auto">
                                <thead className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-3 py-2.5 whitespace-nowrap">Data</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap">Protocolos</th>
                                        <th className="px-2.5 py-2.5 whitespace-nowrap">Status</th>
                                        <th className="px-3 py-2.5 min-w-[130px]">Cliente</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap">Operador</th>
                                        <th className="px-2.5 py-2.5 whitespace-nowrap">Processo</th>
                                        <th className="px-2.5 py-2.5 whitespace-nowrap">Procedimento</th>
                                        <th className="px-2.5 py-2.5 whitespace-nowrap">Qualidade</th>
                                        <th className="px-2.5 py-2.5 whitespace-nowrap">Saída (FCR)</th>
                                        <th className="px-3 py-2.5 text-right whitespace-nowrap">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredAudits.map((item) => {
                                        const cKey = item.clientName ? item.clientName.trim().toLowerCase() : '';
                                        const totalClientCalls = clientHistoryMap[cKey]?.length || 0;
                                        const isRepeat = totalClientCalls > 1;
                                        const completed = isAuditCompleted(item);

                                        return (
                                            <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                                                
                                                {/* Data */}
                                                <td className="px-3 py-2.5 whitespace-nowrap font-medium text-gray-900">
                                                    {item.date ? item.date.split('-').reverse().join('/') : '--'}
                                                </td>

                                                {/* Protocolo Terceirizada & MK */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-gray-900">
                                                            <span>#{item.protocol}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCopy(item.protocol, `prot_${item.id}`)}
                                                                className="text-gray-400 hover:text-gray-700 cursor-pointer p-0.5"
                                                                title="Copiar protocolo"
                                                            >
                                                                {copiedField === `prot_${item.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                                            </button>
                                                        </div>
                                                        {item.erpProtocol ? (
                                                            <div className="flex items-center gap-1 text-[10px] text-gray-500 font-mono">
                                                                <span>MK: {item.erpProtocol}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] text-amber-500/70 font-mono italic">
                                                                <span>Sem MK</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Status da Auditoria (Concluída vs Pendente) */}
                                                <td className="px-2.5 py-2.5 whitespace-nowrap">
                                                    {completed ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                            Concluída
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                            <AlertCircle className="w-3 h-3 text-amber-600" />
                                                            Pendente
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Nome do Cliente com Badge de Reincidência */}
                                                <td className="px-3 py-2.5">
                                                    <div className="space-y-0.5 min-w-[120px]">
                                                        {item.clientName ? (
                                                            <span className="font-bold text-gray-900 block truncate" title={item.clientName}>
                                                                {item.clientName}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] font-medium text-amber-600 italic">
                                                                Aguardando cliente...
                                                            </span>
                                                        )}
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
                                                <td className="px-3 py-2.5 whitespace-nowrap font-medium text-gray-800">
                                                    {item.operatorName ? (
                                                        <div className="flex items-center gap-1.5 min-w-[110px]">
                                                            <div className="w-5 h-5 rounded-full bg-zinc-800 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                                                                {item.operatorName.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className="truncate" title={item.operatorName}>{item.operatorName}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px] text-gray-400 italic">Não informado</span>
                                                    )}
                                                </td>

                                                {/* Processo Realizado */}
                                                <td className="px-2.5 py-2.5 whitespace-nowrap">
                                                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                                        {item.process || 'Sem acesso'}
                                                    </span>
                                                </td>

                                                {/* Procedimentos */}
                                                <td className="px-2.5 py-2.5 whitespace-nowrap">
                                                    {item.procedures ? (
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
                                                            {item.procedures}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                            Pendente
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Qualidade */}
                                                <td className="px-2.5 py-2.5 whitespace-nowrap">
                                                    {item.quality ? (
                                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                                            item.quality === 'Positiva'
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                : item.quality === 'Neutra'
                                                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                : 'bg-red-50 text-red-700 border border-red-200'
                                                        }`}>
                                                            {item.quality === 'Positiva' ? '👍 Positiva' : item.quality === 'Neutra' ? '😐 Neutra' : '👎 Negativa'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-400 italic">Neutra</span>
                                                    )}
                                                </td>

                                                {/* Saída (Resolvido vs Encaminhado = FCR) */}
                                                <td className="px-2.5 py-2.5 whitespace-nowrap">
                                                    {item.outcome ? (
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
                                                            {item.outcome}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                            Pendente
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Ações */}
                                                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewingAudit(item)}
                                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                            title="Ver detalhes da auditoria"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                        {hasEditPermission && (
                                                            <>
                                                                {!completed ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenEditModal(item)}
                                                                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                                                                        title="Pressione para preencher os dados pendentes desta auditoria"
                                                                    >
                                                                        <Edit2 className="w-3 h-3" />
                                                                        <span>Preencher</span>
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenEditModal(item)}
                                                                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                                                        title="Editar auditoria"
                                                                    >
                                                                        <Edit2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
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

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* Data - Obrigatoriamente em branco na criação */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[11px] font-bold text-gray-700">
                                                    Data da Chamada *
                                                </label>
                                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                                    Obrigatório
                                                </span>
                                            </div>
                                            <input
                                                type="date"
                                                required
                                                value={formData.date}
                                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                                className={`w-full p-2 bg-gray-50 border rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-red-600 font-medium ${
                                                    !formData.date ? 'border-amber-400 bg-amber-50/20 ring-1 ring-amber-300' : 'border-gray-200'
                                                }`}
                                            />
                                            {!formData.date && (
                                                <span className="text-[10px] text-amber-600 mt-1 block font-medium">
                                                    Campo em branco obrigatório para evitar datas erradas.
                                                </span>
                                            )}
                                        </div>

                                        {/* Protocolo da Terceirizada com Validação Anti-Duplicidade */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-[11px] font-bold text-gray-700">
                                                    Protocolo Chamada *
                                                </label>
                                                {duplicateProtocolAudit && (
                                                    <span className="text-[10px] font-bold text-red-600 flex items-center gap-1 animate-pulse">
                                                        <AlertCircle className="w-3 h-3 text-red-600" />
                                                        protocolo já existente
                                                    </span>
                                                )}
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Ex: #PBX-94821"
                                                value={formData.protocol}
                                                onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
                                                className={`w-full p-2 bg-gray-50 border rounded-xl text-xs font-mono outline-none focus:bg-white font-medium transition-all ${
                                                    duplicateProtocolAudit
                                                        ? 'border-red-500 bg-red-50/50 text-red-900 ring-2 ring-red-400 focus:ring-red-500'
                                                        : 'border-gray-200 focus:ring-2 focus:ring-red-600'
                                                }`}
                                            />
                                            {duplicateProtocolAudit && (
                                                <div className="mt-1.5 p-2 bg-red-50 border border-red-200 rounded-lg text-[10px] text-red-700 font-medium flex items-start gap-1.5 animate-fadeIn">
                                                    <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                                                    <div>
                                                        <span className="font-bold">Protocolo já existente no sistema:</span> Este protocolo já foi registrado
                                                        {duplicateProtocolAudit.date ? ` em ${duplicateProtocolAudit.date.split('-').reverse().join('/')}` : ''}
                                                        {duplicateProtocolAudit.clientName ? ` para o cliente "${duplicateProtocolAudit.clientName}"` : ''}
                                                        {duplicateProtocolAudit.operatorName ? ` (Operador: ${duplicateProtocolAudit.operatorName})` : ''}.
                                                        Informe um protocolo único para evitar duplicidade de auditorias.
                                                    </div>
                                                </div>
                                            )}
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
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[11px] font-bold text-gray-700">
                                                    Procedimentos *
                                                </label>
                                                {!formData.procedures ? (
                                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                                        Selecione uma opção
                                                    </span>
                                                ) : (
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                                        formData.procedures === 'Conforme'
                                                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                                            : 'text-red-700 bg-red-50 border-red-200'
                                                    }`}>
                                                        {formData.procedures}
                                                    </span>
                                                )}
                                            </div>
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
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[11px] font-bold text-gray-700">
                                                    Saída da Chamada (Cálculo FCR) *
                                                </label>
                                                {!formData.outcome ? (
                                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                                        Selecione uma opção
                                                    </span>
                                                ) : (
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                                        formData.outcome === 'Resolvido'
                                                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                                            : 'text-blue-700 bg-blue-50 border-blue-200'
                                                    }`}>
                                                        {formData.outcome}
                                                    </span>
                                                )}
                                            </div>
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

                                    {/* Observações / Parecer com Atalhos Rápidos */}
                                    <div className="pt-1 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-[11px] font-bold text-gray-700">
                                                Observações / Parecer do Auditor (Opcional)
                                            </label>
                                            {formData.notes && (
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, notes: '' })}
                                                    className="text-[10px] text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                                >
                                                    Limpar texto
                                                </button>
                                            )}
                                        </div>

                                        {/* Botões de atalho rápido */}
                                        <div className="bg-gray-50/80 p-2.5 rounded-xl border border-gray-200/90 space-y-1.5">
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                <Sparkles className="w-3 h-3 text-amber-500" />
                                                Atalhos rápidos para o comentário:
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleApplyCommentShortcut('Problema foi resolvido remotamente pelo operador após procedimentos.')}
                                                    className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 hover:text-emerald-900 border border-emerald-200/80 rounded-lg text-[11px] font-medium transition-all text-left flex items-start gap-2 cursor-pointer shadow-2xs hover:shadow-xs active:scale-98 group"
                                                    title="Clique para adicionar este parecer ao comentário"
                                                >
                                                    <span className="w-4 h-4 rounded-full bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                                                        <Check className="w-2.5 h-2.5 text-emerald-700" />
                                                    </span>
                                                    <span className="leading-snug">Problema foi resolvido remotamente pelo operador após procedimentos.</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleApplyCommentShortcut('Atendimento encaminhado para equipe N2/N3.')}
                                                    className="px-2.5 py-1.5 bg-white hover:bg-blue-50 text-blue-800 hover:text-blue-900 border border-blue-200/80 rounded-lg text-[11px] font-medium transition-all text-left flex items-start gap-2 cursor-pointer shadow-2xs hover:shadow-xs active:scale-98 group"
                                                    title="Clique para adicionar este parecer ao comentário"
                                                >
                                                    <span className="w-4 h-4 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center shrink-0 mt-0.5">
                                                        <ArrowRight className="w-2.5 h-2.5 text-blue-700" />
                                                    </span>
                                                    <span className="leading-snug">Atendimento encaminhado para equipe N2/N3.</span>
                                                </button>
                                            </div>
                                        </div>

                                        <textarea
                                            rows="3"
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
                                    disabled={saving || Boolean(duplicateProtocolAudit)}
                                    title={duplicateProtocolAudit ? 'Protocolo já existente no sistema' : 'Salvar auditoria'}
                                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-1.5 shadow-sm cursor-pointer"
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
