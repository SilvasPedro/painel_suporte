import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    TrendingUp, Save, Loader2, Calendar, Upload, Download, 
    Search, Filter, Sun, Sunset, Moon, Users, Sparkles, Check, 
    ShieldAlert, Award, Hash, CheckCircle2, PhoneCall, PhoneOff,
    MessageSquare, CheckSquare, Zap, RefreshCw, BarChart3, AlertCircle, AlertTriangle, X
} from 'lucide-react';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeSharedCollection } from '../services/dataCache';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { normalizeRole } from '../services/rbac';
import { BorderBeam } from '../components/magicui/BorderBeam';
import { calculatePerformanceScore, getHuggyStats } from '../utils/scoringCalculations';
import { buildNotification, addNotificationToBatch, dispatchTeamWebhook } from '../services/notificationEvents';

const SHIFT_BADGES = {
    'Manhã I': {
        icon: Sun,
        style: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-bold',
        dot: 'bg-amber-500'
    },
    'Manhã II': {
        icon: Sun,
        style: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20 font-bold',
        dot: 'bg-yellow-500'
    },
    'Tarde': {
        icon: Sunset,
        style: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 font-bold',
        dot: 'bg-orange-500'
    },
    'Noturno': {
        icon: Moon,
        style: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-bold',
        dot: 'bg-indigo-500'
    }
};

// Campos lançados por colaborador (chave no banco, rótulo exibido na validação)
const METRIC_FIELDS = [
    ['Ligacoes_Atendidas', 'Lig. Atendidas'],
    ['Ligacoes_Perdidas', 'Lig. Perdidas'],
    ['Ligacoes_Realizadas', 'Lig. Realizadas'],
    ['TMA_Telefonia', 'TMA Telefonia'],
    ['TME_Telefonia', 'TME Telefonia'],
    ['Huggy_Iniciados', 'Huggy Iniciados'],
    ['Huggy_Finalizados', 'Huggy Finalizados'],
    ['TMA_Huggy', 'TMA Huggy'],
    ['Atendimentos_Finalizados', 'Finalizados']
];
const COUNT_FIELDS = ['Ligacoes_Atendidas', 'Ligacoes_Perdidas', 'Ligacoes_Realizadas', 'Huggy_Iniciados', 'Huggy_Finalizados', 'Atendimentos_Finalizados'];
const TIME_FIELDS = ['TMA_Telefonia', 'TME_Telefonia', 'TMA_Huggy'];
const FIELD_LABELS = Object.fromEntries(METRIC_FIELDS);
const TIME_REGEX = /^\d{1,2}:\d{2}:\d{2}$/;

// Um campo só conta como preenchido se tiver conteúdo (espaços em branco não valem)
const isFilled = (v) => v !== null && v !== undefined && String(v).trim() !== '';

const getShiftBadge = (shift) => {
    if (!shift) return { icon: Sun, style: 'bg-subtle text-muted-hub border-subtle', dot: 'bg-zinc-400' };
    const s = String(shift).trim();
    if (s.includes('Manhã I') || s === 'Manha I') return SHIFT_BADGES['Manhã I'];
    if (s.includes('Manhã II') || s === 'Manha II') return SHIFT_BADGES['Manhã II'];
    if (s.toLowerCase().includes('tard')) return SHIFT_BADGES['Tarde'];
    if (s.toLowerCase().includes('noturn') || s.toLowerCase().includes('noit')) return SHIFT_BADGES['Noturno'];
    if (s.toLowerCase().includes('manh')) return SHIFT_BADGES['Manhã I'];
    return { icon: Sun, style: 'bg-subtle text-muted-hub border-subtle', dot: 'bg-zinc-400' };
};

const WeeklyMetrics = () => {
    const { showToast } = useNotification();
    const { currentUser } = useAuth();
    const [collaborators, setCollaborators] = useState([]);
    const [metricsData, setMetricsData] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hiddenNoShift, setHiddenNoShift] = useState([]); // ativos que não aparecem por falta de turno
    const [review, setReview] = useState(null); // resultado da validação aguardando confirmação
    const [highlightIds, setHighlightIds] = useState(() => new Set()); // linhas vazias a revisar

    const fileInputRef = useRef(null);

    // Filtros e busca
    const [searchQuery, setSearchQuery] = useState('');
    const [shiftFilter, setShiftFilter] = useState('ALL'); // 'ALL', 'Manhã I', 'Manhã II', 'Tarde', 'Noturno'

    // Estado para a data de referência (formato YYYY-MM-DD para o input)
    const [referenceDate, setReferenceDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        const unsubscribe = subscribeSharedCollection("collaborators", (items) => {
            const colabs = [];
            const initialMetrics = {};
            const noShift = [];
            
            items.forEach((data) => {
                // REGRA CRÍTICA: Ignora inativos, sem turno OU usuários com cargo de Gestor e Supervisão
                const roleNorm = normalizeRole(data.role);
                const rawRole = (data.role || '').toLowerCase().trim();
                const isLideranca = (
                    roleNorm === 'gestor' || 
                    roleNorm === 'supervisor' || 
                    rawRole.includes('gest') || 
                    rawRole.includes('superv') || 
                    rawRole === 'manager'
                );

                if (data.active === false || isLideranca) {
                    return;
                }
                if (!data.shift || data.shift.trim() === '') {
                    // Ativo, mas sem turno: não aparece na lista e, por isso, não recebe avaliação
                    noShift.push(data.name || data.email || data.id);
                    return;
                }

                colabs.push(data);
                initialMetrics[data.id] = {
                    Ligacoes_Atendidas: '',
                    Ligacoes_Perdidas: '',
                    Ligacoes_Realizadas: '',
                    TMA_Telefonia: '',
                    TME_Telefonia: '',
                    Huggy_Iniciados: '',
                    Huggy_Finalizados: '',
                    TMA_Huggy: '',
                    Atendimentos_Finalizados: ''
                };
            });

            colabs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            
            setCollaborators(colabs);
            setHiddenNoShift(noShift);
            // Preserva valores já preenchidos
            setMetricsData(prev => Object.keys(prev).length === 0 ? initialMetrics : prev);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleInputChange = (colabId, field, value) => {
        setMetricsData(prev => ({
            ...prev,
            [colabId]: {
                ...(prev[colabId] || {}),
                [field]: value
            }
        }));
    };

    // Preenchimento rápido de zeros nos campos vazios
    const handleFillZeros = () => {
        setMetricsData(prev => {
            const next = { ...prev };
            collaborators.forEach(c => {
                const cur = next[c.id] || {};
                next[c.id] = {
                    Ligacoes_Atendidas: cur.Ligacoes_Atendidas !== '' ? cur.Ligacoes_Atendidas : '0',
                    Ligacoes_Perdidas: cur.Ligacoes_Perdidas !== '' ? cur.Ligacoes_Perdidas : '0',
                    Ligacoes_Realizadas: cur.Ligacoes_Realizadas !== '' && cur.Ligacoes_Realizadas !== undefined ? cur.Ligacoes_Realizadas : '0',
                    TMA_Telefonia: cur.TMA_Telefonia !== '' ? cur.TMA_Telefonia : '00:00:00',
                    TME_Telefonia: cur.TME_Telefonia !== '' ? cur.TME_Telefonia : '00:00:00',
                    Huggy_Iniciados: cur.Huggy_Iniciados !== '' && cur.Huggy_Iniciados !== undefined ? cur.Huggy_Iniciados : '0',
                    Huggy_Finalizados: cur.Huggy_Finalizados !== '' && cur.Huggy_Finalizados !== undefined ? cur.Huggy_Finalizados : '0',
                    TMA_Huggy: cur.TMA_Huggy !== '' ? cur.TMA_Huggy : '00:00:00',
                    Atendimentos_Finalizados: cur.Atendimentos_Finalizados !== '' ? cur.Atendimentos_Finalizados : '0'
                };
            });
            return next;
        });
        showToast("Campos vazios preenchidos com valores padrão!", "info");
    };

    // --- FUNÇÕES DE IMPORTAÇÃO E EXPORTAÇÃO CSV ---
    const downloadTemplate = () => {
        // Mesma ordem das colunas da tela de lançamento (a importação lê pelo nome do cabeçalho)
        const headers = ["Nome", "Ligacoes_Atendidas", "Ligacoes_Perdidas", "Ligacoes_Realizadas", "TMA_Telefonia", "TME_Telefonia", "Huggy_Iniciados", "Huggy_Finalizados", "TMA_Huggy", "Atendimentos_Finalizados"];
        const rows = collaborators.map(c => [c.name, "0", "0", "0", "00:00:00", "00:00:00", "0", "0", "00:00:00", "0"]);
        
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `modelo_metricas_${referenceDate}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const lines = text.split(/\r?\n/); 
            
            if (lines.length < 2) {
                showToast("O arquivo parece estar vazio ou tem um formato inválido.", "error");
                return;
            }

            const delimiter = lines[0].includes(';') ? ';' : ',';
            const newMetrics = { ...metricsData };
            let importedCount = 0;
            const notFound = [];
            const normHeader = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
            const headerRow = lines[0].split(delimiter).map(normHeader);
            // Procura a coluna pelo nome; se não houver, usa a posição do modelo antigo (quando existir)
            const colIndex = (aliases, fallback = -1) => {
                const idx = headerRow.findIndex(h => aliases.includes(h));
                return idx >= 0 ? idx : fallback;
            };
            const IDX = {
                atendidas: colIndex(['ligacoesatendidas'], 1),
                perdidas: colIndex(['ligacoesperdidas'], 2),
                tmaTel: colIndex(['tmatelefonia'], 3),
                tmeTel: colIndex(['tmetelefonia'], 4),
                iniciados: colIndex(['huggyiniciados']),
                // Modelos antigos tinham só "Atendimentos_Huggy": passa a valer como Huggy Finalizados
                finalizadosHuggy: colIndex(['huggyfinalizados', 'atendimentoshuggy']),
                tmaHuggy: colIndex(['tmahuggy'], 6),
                finalizados: colIndex(['atendimentosfinalizados'], 7),
                realizadas: colIndex(['ligacoesrealizadas'], 8)
            };
            const cell = (row, idx, fallback) => (idx >= 0 && row[idx] ? row[idx] : fallback);
            const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

            for (let i = 1; i < lines.length; i++) {
                const row = lines[i].split(delimiter).map(item => item?.trim() || '');
                if (row.length < 2 || !row[0]) continue;
                
                const colabName = row[0];
                const colab = collaborators.find(c => norm(c.name) === norm(colabName));
                
                if (colab) {
                    newMetrics[colab.id] = {
                        Ligacoes_Atendidas: cell(row, IDX.atendidas, '0'),
                        Ligacoes_Perdidas: cell(row, IDX.perdidas, '0'),
                        TMA_Telefonia: cell(row, IDX.tmaTel, '00:00:00'),
                        TME_Telefonia: cell(row, IDX.tmeTel, '00:00:00'),
                        Huggy_Iniciados: cell(row, IDX.iniciados, '0'),
                        Huggy_Finalizados: cell(row, IDX.finalizadosHuggy, '0'),
                        TMA_Huggy: cell(row, IDX.tmaHuggy, '00:00:00'),
                        Atendimentos_Finalizados: cell(row, IDX.finalizados, '0'),
                        Ligacoes_Realizadas: cell(row, IDX.realizadas, '0')
                    };
                    importedCount++;
                } else {
                    notFound.push(colabName);
                }
            }

            setMetricsData(newMetrics);
            showToast(`${importedCount} colaboradores importados com sucesso!`, "success");
            if (notFound.length > 0) {
                showToast(`${notFound.length} nome(s) do arquivo não foram encontrados e NÃO serão lançados: ${notFound.slice(0, 5).join(', ')}${notFound.length > 5 ? '…' : ''}`, "warning");
            }
        };
        
        reader.readAsText(file);
        e.target.value = null;
    };

    // Analisa o lançamento atual: quem recebe avaliação, quem não recebe nada e possíveis problemas
    const analyzeLaunch = () => {
        const ready = [];
        const empty = [];
        const issues = [];

        collaborators.forEach((colab) => {
            const m = metricsData[colab.id] || {};
            const filled = METRIC_FIELDS.filter(([key]) => isFilled(m[key]));

            if (filled.length === 0) {
                empty.push(colab);
                return;
            }
            ready.push(colab);

            const warnings = [];
            const missing = METRIC_FIELDS.filter(([key]) => !isFilled(m[key])).map(([, label]) => label);
            if (missing.length > 0) {
                warnings.push(`Campos vazios (serão gravados como 0): ${missing.join(', ')}`);
            }
            COUNT_FIELDS.forEach((key) => {
                if (isFilled(m[key])) {
                    const n = Number(m[key]);
                    if (!Number.isInteger(n) || n < 0) warnings.push(`${FIELD_LABELS[key]}: valor inválido (${m[key]})`);
                }
            });
            TIME_FIELDS.forEach((key) => {
                if (isFilled(m[key]) && !TIME_REGEX.test(String(m[key]).trim())) {
                    warnings.push(`${FIELD_LABELS[key]}: formato esperado HH:MM:SS (${m[key]})`);
                }
            });
            const hIni = Number(m.Huggy_Iniciados) || 0;
            const hFin = Number(m.Huggy_Finalizados) || 0;
            if (hFin > hIni) {
                warnings.push(`Huggy Finalizados (${hFin}) maior que Iniciados (${hIni}): aproveitamento limitado a 100%`);
            }
            if (warnings.length > 0) issues.push({ colab, warnings });
        });

        return { ready, empty, issues };
    };

    // Clique em "Salvar": valida antes. Só segue direto se todos os colaboradores estiverem completos.
    const handleSaveMetrics = () => {
        if (saving) return;
        const analysis = analyzeLaunch();

        if (analysis.ready.length === 0) {
            showToast('Nenhum colaborador tem dados preenchidos. Preencha as métricas antes de salvar.', 'warning');
            return;
        }

        if (analysis.empty.length > 0 || analysis.issues.length > 0 || hiddenNoShift.length > 0) {
            setReview(analysis);
            return;
        }

        persistMetrics(analysis.ready);
    };

    // Volta para a tela destacando as linhas que ficaram sem lançamento
    const handleBackToReview = () => {
        if (review) setHighlightIds(new Set(review.empty.map(c => c.id)));
        setShiftFilter('ALL');
        setSearchQuery('');
        setReview(null);
    };

    // Grava tudo em um único lote: ou todos recebem a avaliação, ou nenhum (sem duplicar em nova tentativa)
    const persistMetrics = async (readyColabs) => {
        setSaving(true);
        try {
            const [year, month, day] = referenceDate.split('-');
            const dateString = `${day}/${month}/${year}`;
            // Cada colaborador gera 2 documentos (avaliação + aviso): 200 colaboradores por lote
            const BATCH_SIZE = 200;
            const authorName = currentUser?.name || currentUser?.displayName || 'Liderança';

            for (let i = 0; i < readyColabs.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                readyColabs.slice(i, i + BATCH_SIZE).forEach((colab) => {
                    const metrics = metricsData[colab.id] || {};
                    const finalizados = Number(metrics.Atendimentos_Finalizados) || 0;
                    const ligAtendidas = Number(metrics.Ligacoes_Atendidas) || 0;
                    const ligPerdidas = Number(metrics.Ligacoes_Perdidas) || 0;
                    const ligRealizadas = Number(metrics.Ligacoes_Realizadas) || 0;
                    const huggyIniciados = Number(metrics.Huggy_Iniciados) || 0;
                    const huggyFinalizados = Number(metrics.Huggy_Finalizados) || 0;

                    // Fórmula oficial de pontuação (pesos centralizados em scoringCalculations)
                    const pontuacaoTotal = calculatePerformanceScore({
                        Atendimentos_Finalizados: finalizados,
                        Ligacoes_Atendidas: ligAtendidas,
                        Ligacoes_Realizadas: ligRealizadas,
                        Huggy_Iniciados: huggyIniciados,
                        Huggy_Finalizados: huggyFinalizados,
                        Ligacoes_Perdidas: ligPerdidas
                    });

                    const evalRef = doc(collection(db, "weekly_evaluations"));
                    batch.set(evalRef, {
                        colabId: colab.id,
                        colabName: colab.name || '',
                        shift: colab.shift || '',
                        date: dateString,
                        Atendimentos_Finalizados: finalizados,
                        Ligacoes_Atendidas: ligAtendidas,
                        Ligacoes_Perdidas: ligPerdidas,
                        Ligacoes_Realizadas: ligRealizadas,
                        Huggy_Iniciados: huggyIniciados,
                        Huggy_Finalizados: huggyFinalizados,
                        Huggy_Aproveitamento: getHuggyStats({ Huggy_Iniciados: huggyIniciados, Huggy_Finalizados: huggyFinalizados }).percentual,
                        TMA_Telefonia: String(metrics.TMA_Telefonia || '').trim() || "00:00:00",
                        TMA_Huggy: String(metrics.TMA_Huggy || '').trim() || "00:00:00",
                        TME_Telefonia: String(metrics.TME_Telefonia || '').trim() || "00:00:00",
                        pontuacao: pontuacaoTotal,
                        createdAt: new Date()
                    });

                    // Aviso pessoal gravado junto com a avaliação (o app do colaborador só escuta os próprios avisos)
                    addNotificationToBatch(batch, buildNotification({
                        event: 'weekly_evaluation',
                        toUserId: colab.id,
                        toUserName: colab.name || '',
                        refId: evalRef.id,
                        title: '📊 Nova Avaliação Semanal',
                        body: `Sua avaliação da semana (${dateString}) foi lançada: ${pontuacaoTotal} pts. Veja os detalhes em Meu Histórico.`,
                        authorName: authorName,
                        meta: { date: dateString, pontuacao: pontuacaoTotal }
                    }));
                });
                await batch.commit();
            }

            // Aviso genérico ao canal da equipe (sem nomes ou notas); falhas não atrapalham o salvamento
            void dispatchTeamWebhook({ event: 'weekly_evaluation' });

            const skipped = collaborators.length - readyColabs.length;
            showToast(
                skipped > 0
                    ? `${readyColabs.length} avaliações salvas. ${skipped} colaborador(es) ficaram sem avaliação nesta data.`
                    : `${readyColabs.length} avaliações salvas com sucesso no banco de dados!`,
                "success"
            );

            // Limpa os campos após salvar
            const resetMetrics = {};
            collaborators.forEach(c => {
                resetMetrics[c.id] = {
                    Ligacoes_Atendidas: '', Ligacoes_Perdidas: '', Ligacoes_Realizadas: '', TMA_Telefonia: '',
                    TME_Telefonia: '', Huggy_Iniciados: '', Huggy_Finalizados: '', TMA_Huggy: '', Atendimentos_Finalizados: ''
                };
            });
            setMetricsData(resetMetrics);
            setHighlightIds(new Set());
            setReview(null);

        } catch (error) {
            console.error(error);
            showToast("Erro ao salvar avaliações (nenhuma foi gravada, pode tentar novamente): " + error.message, "error");
        } finally {
            setSaving(false);
        }
    };

    // Filtra lista de colaboradores
    const filteredCollaborators = useMemo(() => {
        return collaborators.filter(c => {
            const matchesSearch = !searchQuery.trim() || (c.name || '').toLowerCase().includes(searchQuery.toLowerCase().trim());
            const matchesShift = shiftFilter === 'ALL' || (c.shift && c.shift.toLowerCase().includes(shiftFilter.toLowerCase()));
            return matchesSearch && matchesShift;
        });
    }, [collaborators, searchQuery, shiftFilter]);

    // Resumo de preenchimento
    const filledCount = useMemo(() => {
        let count = 0;
        collaborators.forEach(c => {
            const m = metricsData[c.id];
            if (m && Object.values(m).some(isFilled)) count++;
        });
        return count;
    }, [collaborators, metricsData]);

    // Métricas agregadas projetadas
    const aggregates = useMemo(() => {
        let totalScore = 0;
        let totalCalls = 0;
        let totalLostCalls = 0;
        let totalHuggy = 0;
        let totalTickets = 0;

        collaborators.forEach(c => {
            const m = metricsData[c.id];
            if (m) {
                const fin = Number(m.Atendimentos_Finalizados) || 0;
                const ligAt = Number(m.Ligacoes_Atendidas) || 0;
                const ligPerd = Number(m.Ligacoes_Perdidas) || 0;
                totalScore += calculatePerformanceScore({
                    Atendimentos_Finalizados: fin,
                    Ligacoes_Atendidas: ligAt,
                    Ligacoes_Realizadas: Number(m.Ligacoes_Realizadas) || 0,
                    Huggy_Iniciados: Number(m.Huggy_Iniciados) || 0,
                    Huggy_Finalizados: Number(m.Huggy_Finalizados) || 0,
                    Ligacoes_Perdidas: ligPerd
                });
                totalCalls += ligAt;
                totalLostCalls += ligPerd;
                totalHuggy += Number(m.Huggy_Finalizados) || 0;
                totalTickets += fin;
            }
        });

        const avgScore = filledCount > 0 ? (totalScore / filledCount).toFixed(1) : '0';
        const coveragePercent = collaborators.length > 0 ? Math.round((filledCount / collaborators.length) * 100) : 0;

        return {
            totalScore,
            totalCalls,
            totalLostCalls,
            totalHuggy,
            totalTickets,
            avgScore,
            coveragePercent
        };
    }, [collaborators, metricsData, filledCount]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-canvas h-full">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                    <span className="text-xs font-semibold text-muted-hub tracking-wide uppercase">Carregando painel de métricas...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-canvas font-sans space-y-6">
            
            {/* HERO HEADER EXECUTIVO COM DESIGN BENTO */}
            <div className="relative">

                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-2 text-xs font-semibold text-rose-500 uppercase tracking-wider"><TrendingUp className="w-3.5 h-3.5" />Módulo Operacional • Avaliações Semanais</span>
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-subtle text-secondary-hub border border-subtle">
                                {collaborators.length} Operadores Elegíveis
                            </span>
                        </div>
                        <h1 className="font-brand text-2xl sm:text-3xl font-bold text-primary-hub tracking-tight">
                            Lançamento de Métricas & Pontuação
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-hub max-w-2xl leading-relaxed">
                            Registro semanal de volumetria, TMA, TME e cálculo dinâmico de score. 
                            <span className="block sm:inline text-secondary-hub font-medium ml-0 sm:ml-1">Cargos de Gestão e Supervisão são desconsiderados nesta apuração.</span>
                        </p>
                    </div>

                    {/* Ações Rápidas de Topo */}
                    <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                        <input 
                            type="file" 
                            accept=".csv" 
                            className="hidden" 
                            ref={fileInputRef} 
                            onChange={handleFileUpload} 
                        />
                        
                        <button 
                            type="button"
                            onClick={downloadTemplate}
                            className="px-3.5 py-2.5 bg-subtle hover:bg-surface text-secondary-hub hover:text-primary-hub rounded-xl text-xs font-bold border border-subtle shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                            title="Baixar planilha modelo CSV para importação"
                        >
                            <Download className="w-3.5 h-3.5 text-muted-hub" />
                            <span>Modelo CSV</span>
                        </button>

                        <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3.5 py-2.5 bg-subtle hover:bg-surface text-secondary-hub hover:text-primary-hub rounded-xl text-xs font-bold border border-subtle shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                            title="Importar métricas preenchidas em CSV"
                        >
                            <Upload className="w-3.5 h-3.5 text-muted-hub" />
                            <span>Importar</span>
                        </button>

                        {/* Seletor de Data */}
                        <div className="flex items-center gap-2 bg-subtle border border-subtle px-3 py-2 rounded-xl text-xs font-bold text-secondary-hub shadow-xs">
                            <Calendar className="w-3.5 h-3.5 text-rose-500" />
                            <span className="text-muted-hub hidden sm:inline">Data:</span>
                            <input 
                                type="date" 
                                value={referenceDate}
                                onChange={(e) => setReferenceDate(e.target.value)}
                                className="bg-transparent outline-none cursor-pointer font-bold text-primary-hub text-xs"
                            />
                        </div>

                        {/* Botão de Salvar Principal */}
                        <button 
                            type="button"
                            onClick={handleSaveMetrics}
                            disabled={saving}
                            className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-950/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 ml-auto sm:ml-0 active:scale-95"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>Salvar Lançamentos</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* BENTO STATS - KPIs DE COBERTURA & VOLUMETRIA */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-surface border border-subtle p-4 rounded-2xl shadow-xs">
                    <div className="flex items-center justify-between text-muted-hub mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Cobertura</span>
                        <CheckSquare className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-primary-hub tracking-tight font-mono">{filledCount}/{collaborators.length}</span>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">({aggregates.coveragePercent}%)</span>
                    </div>
                    <div className="w-full bg-subtle h-1.5 rounded-full mt-2.5 overflow-hidden">
                        <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${aggregates.coveragePercent}%` }}
                        />
                    </div>
                </div>

                <div className="bg-surface border border-subtle p-4 rounded-2xl shadow-xs">
                    <div className="flex items-center justify-between text-muted-hub mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Pontos Totais</span>
                        <Award className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-primary-hub tracking-tight font-mono">{aggregates.totalScore}</span>
                        <span className="text-xs font-medium text-muted-hub">pts projetados</span>
                    </div>
                    <div className="text-[11px] text-muted-hub mt-2 font-mono">
                        Média: <strong className="text-secondary-hub">{aggregates.avgScore} pts</strong> / op
                    </div>
                </div>

                <div className="bg-surface border border-subtle p-4 rounded-2xl shadow-xs">
                    <div className="flex items-center justify-between text-muted-hub mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Telefonia</span>
                        <PhoneCall className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-primary-hub tracking-tight font-mono">{aggregates.totalCalls}</span>
                        <span className="text-xs font-bold text-rose-500">(-{aggregates.totalLostCalls} perdidas)</span>
                    </div>
                    <div className="text-[11px] text-muted-hub mt-2 font-mono">
                        Atendidas (+2 pts) e Perdidas (-5 pts)
                    </div>
                </div>

                <div className="bg-surface border border-subtle p-4 rounded-2xl shadow-xs">
                    <div className="flex items-center justify-between text-muted-hub mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Huggy & Tickets</span>
                        <MessageSquare className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-primary-hub tracking-tight font-mono">{aggregates.totalHuggy + aggregates.totalTickets}</span>
                        <span className="text-xs font-medium text-muted-hub">ações</span>
                    </div>
                    <div className="text-[11px] text-muted-hub mt-2 font-mono">
                        Huggy ({aggregates.totalHuggy}) • Tickets ({aggregates.totalTickets})
                    </div>
                </div>
            </div>

            {/* BARRA DE CONTROLE: BUSCA E FILTROS DE TURNO */}
            <div className="bg-surface border border-subtle p-4 rounded-2xl shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Campo de Busca Rápida */}
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-muted-hub absolute left-3.5 top-3" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filtrar por nome do operador..."
                        className="w-full pl-9 pr-3.5 py-2 text-xs bg-subtle border border-subtle rounded-xl text-primary-hub placeholder:text-muted-hub focus:bg-surface focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all font-medium"
                    />
                </div>

                {/* Filtros de Turno Oficiais */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-muted-hub uppercase tracking-wider mr-1 hidden sm:inline">Turnos:</span>
                    
                    <button
                        type="button"
                        onClick={() => setShiftFilter('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            shiftFilter === 'ALL'
                                ? 'bg-primary-hub text-white dark:text-zinc-950 border-transparent shadow-xs'
                                : 'bg-subtle hover:bg-surface text-secondary-hub border-subtle'
                        }`}
                    >
                        Todos ({collaborators.length})
                    </button>

                    {['Manhã I', 'Manhã II', 'Tarde', 'Noturno'].map(s => {
                        const badge = SHIFT_BADGES[s];
                        const Icon = badge.icon;
                        const count = collaborators.filter(c => c.shift && c.shift.toLowerCase().includes(s.toLowerCase())).length;
                        const isSelected = shiftFilter === s;
                        return (
                            <button
                                type="button"
                                key={s}
                                onClick={() => setShiftFilter(s)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                                    isSelected
                                        ? `${badge.style} shadow-xs ring-1 ring-rose-500/30`
                                        : 'bg-subtle hover:bg-surface text-secondary-hub border-subtle'
                                }`}
                            >
                                <Icon className="w-3 h-3" />
                                <span>{s}</span>
                                <span className="text-[10px] opacity-75 font-mono">({count})</span>
                            </button>
                        );
                    })}

                    {/* Botão de Preenchimento Rápido com Zero */}
                    <button
                        type="button"
                        onClick={handleFillZeros}
                        className="px-3 py-1.5 bg-subtle hover:bg-surface text-secondary-hub hover:text-primary-hub rounded-xl text-xs font-bold border border-subtle ml-1 transition-all cursor-pointer"
                        title="Preenche campos não preenchidos com zero automaticamente"
                    >
                        Zerar Vazios
                    </button>
                </div>
            </div>

            {/* TABELA ENTERPRISE DE LANÇAMENTOS */}
            {filteredCollaborators.length === 0 ? (
                <div className="bg-surface rounded-3xl border border-dashed border-subtle p-12 text-center text-muted-hub space-y-2">
                    <ShieldAlert className="w-8 h-8 text-muted-hub mx-auto" />
                    <h3 className="font-bold text-primary-hub text-base">Nenhum operador elegível encontrado</h3>
                    <p className="text-xs text-muted-hub">Verifique os filtros selecionados ou certifique-se de que os colaboradores possuem turno cadastrado.</p>
                </div>
            ) : (
                <div className="bg-surface rounded-3xl border border-subtle shadow-xs overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                            <thead>
                                <tr className="bg-subtle/80 text-muted-hub border-b border-subtle">
                                    <th className="px-4 py-3.5 text-left font-bold tracking-wider">Colaborador</th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-28">Turno</th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-24">
                                        Lig. Atendidas<br/><span className="text-[10px] text-emerald-500 font-semibold">(+2 pts)</span>
                                    </th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-24">
                                        Lig. Perdidas<br/><span className="text-[10px] text-rose-500 font-semibold">(-5 pts)</span>
                                    </th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-24">
                                        Lig. Realizadas<br/><span className="text-[10px] text-teal-500 font-semibold">(+1 pt)</span>
                                    </th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-28">TMA Telefonia</th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-28">TME Telefonia</th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-24">
                                        Huggy<br/>Iniciados
                                    </th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-24">
                                        Huggy<br/>Finalizados
                                    </th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-28">
                                        % Aproveit.<br/><span className="text-[10px] text-blue-500 font-semibold">(0,5 pt por 1%)</span>
                                    </th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-28">TMA Huggy</th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-28">
                                        Finalizados<br/><span className="text-[10px] text-purple-500 font-semibold">(+1 pt)</span>
                                    </th>
                                    <th className="px-3 py-3.5 text-center font-bold tracking-wider w-28 text-amber-500">
                                        Pontuação<br/>Projetada
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCollaborators.map((colab) => {
                                    const metrics = metricsData[colab.id] || {};
                                    const badge = getShiftBadge(colab.shift);
                                    const Icon = badge.icon;

                                    // Cálculo em tempo real da pontuação desta linha
                                    const finalizados = Number(metrics.Atendimentos_Finalizados) || 0;
                                    const ligAtendidas = Number(metrics.Ligacoes_Atendidas) || 0;
                                    const ligPerdidas = Number(metrics.Ligacoes_Perdidas) || 0;
                                    const huggyStats = getHuggyStats({
                                        Huggy_Iniciados: Number(metrics.Huggy_Iniciados) || 0,
                                        Huggy_Finalizados: Number(metrics.Huggy_Finalizados) || 0
                                    });
                                    const rowScore = calculatePerformanceScore({
                                        Atendimentos_Finalizados: finalizados,
                                        Ligacoes_Atendidas: ligAtendidas,
                                        Ligacoes_Realizadas: Number(metrics.Ligacoes_Realizadas) || 0,
                                        Huggy_Iniciados: Number(metrics.Huggy_Iniciados) || 0,
                                        Huggy_Finalizados: Number(metrics.Huggy_Finalizados) || 0,
                                        Ligacoes_Perdidas: ligPerdidas
                                    });
                                    const hasEntries = Object.values(metrics).some(isFilled);
                                    const needsReview = highlightIds.has(colab.id) && !hasEntries;

                                    return (
                                        <tr 
                                            key={colab.id} 
                                            className={`border-b border-subtle last:border-b-0 transition-colors ${needsReview ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/40' : 'hover:bg-subtle/50'}`}
                                        >
                                            {/* Colaborador com Avatar e Nome */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-xl bg-subtle text-primary-hub flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-subtle shadow-2xs">
                                                        {(colab.photoURL || colab.photoUrl) ? (
                                                            <img src={colab.photoURL || colab.photoUrl} alt={colab.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            colab.name?.charAt(0)?.toUpperCase() || 'U'
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="font-bold text-primary-hub block truncate">{colab.name}</span>
                                                        <span className="text-[10px] text-muted-hub font-mono truncate block">{colab.email}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Turno com Tag Estilizada */}
                                            <td className="px-3 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-2xs whitespace-nowrap ${badge.style}`}>
                                                    <Icon className="w-3 h-3" />
                                                    <span>{colab.shift}</span>
                                                </span>
                                            </td>

                                            {/* Ligações Atendidas */}
                                            <td className="px-2 py-2">
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    placeholder="0" 
                                                    value={metrics.Ligacoes_Atendidas || ''} 
                                                    onChange={(e) => handleInputChange(colab.id, 'Ligacoes_Atendidas', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-center font-bold text-primary-hub bg-subtle border border-subtle rounded-xl focus:bg-surface focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none transition-all"
                                                />
                                            </td>

                                            {/* Ligações Perdidas */}
                                            <td className="px-2 py-2">
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    placeholder="0" 
                                                    value={metrics.Ligacoes_Perdidas || ''} 
                                                    onChange={(e) => handleInputChange(colab.id, 'Ligacoes_Perdidas', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-center font-bold text-rose-600 dark:text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-xl focus:bg-surface focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none transition-all"
                                                />
                                            </td>

                                            {/* Ligações Realizadas (ativas) */}
                                            <td className="px-2 py-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="0"
                                                    value={metrics.Ligacoes_Realizadas || ''}
                                                    onChange={(e) => handleInputChange(colab.id, 'Ligacoes_Realizadas', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-center font-bold text-teal-700 dark:text-teal-400 bg-teal-500/5 border border-teal-500/20 rounded-xl focus:bg-surface focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                                                />
                                            </td>

                                            {/* TMA Telefonia */}
                                            <td className="px-2 py-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="00:00:00" 
                                                    value={metrics.TMA_Telefonia || ''} 
                                                    onChange={(e) => handleInputChange(colab.id, 'TMA_Telefonia', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-center font-mono font-bold text-primary-hub bg-subtle border border-subtle rounded-xl focus:bg-surface focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none transition-all"
                                                />
                                            </td>

                                            {/* TME Telefonia */}
                                            <td className="px-2 py-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="00:00:00" 
                                                    value={metrics.TME_Telefonia || ''} 
                                                    onChange={(e) => handleInputChange(colab.id, 'TME_Telefonia', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-center font-mono font-bold text-primary-hub bg-subtle border border-subtle rounded-xl focus:bg-surface focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none transition-all"
                                                />
                                            </td>

                                            {/* Huggy Iniciados */}
                                            <td className="px-2 py-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="0"
                                                    value={metrics.Huggy_Iniciados || ''}
                                                    onChange={(e) => handleInputChange(colab.id, 'Huggy_Iniciados', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-center font-bold text-blue-600 dark:text-blue-400 bg-blue-500/5 border border-blue-500/20 rounded-xl focus:bg-surface focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                                />
                                            </td>

                                            {/* Huggy Finalizados */}
                                            <td className="px-2 py-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="0"
                                                    value={metrics.Huggy_Finalizados || ''}
                                                    onChange={(e) => handleInputChange(colab.id, 'Huggy_Finalizados', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-center font-bold text-blue-600 dark:text-blue-400 bg-blue-500/5 border border-blue-500/20 rounded-xl focus:bg-surface focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                                />
                                            </td>

                                            {/* % de aproveitamento Huggy (calculado) */}
                                            <td className="px-3 py-2 text-center">
                                                <div className="inline-flex flex-col items-center leading-tight">
                                                    <span className={`font-mono font-black text-sm ${huggyStats.percentual >= 80 ? 'text-emerald-600 dark:text-emerald-400' : huggyStats.percentual > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-hub'}`}>
                                                        {huggyStats.percentual}%
                                                    </span>
                                                    <span className="text-[10px] text-muted-hub font-mono">+{huggyStats.pontos} pts</span>
                                                </div>
                                            </td>

                                            {/* TMA Huggy */}
                                            <td className="px-2 py-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="00:00:00" 
                                                    value={metrics.TMA_Huggy || ''} 
                                                    onChange={(e) => handleInputChange(colab.id, 'TMA_Huggy', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-center font-mono font-bold text-primary-hub bg-subtle border border-subtle rounded-xl focus:bg-surface focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none transition-all"
                                                />
                                            </td>

                                            {/* Atendimentos Finalizados */}
                                            <td className="px-2 py-2">
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    placeholder="0" 
                                                    value={metrics.Atendimentos_Finalizados || ''} 
                                                    onChange={(e) => handleInputChange(colab.id, 'Atendimentos_Finalizados', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-center font-bold text-purple-600 dark:text-purple-400 bg-purple-500/5 border border-purple-500/20 rounded-xl focus:bg-surface focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                                                />
                                            </td>

                                            {/* Pontuação Projetada em Tempo Real */}
                                            <td className="px-3 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border shadow-2xs font-mono ${
                                                    hasEntries 
                                                        ? (rowScore >= 0 
                                                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' 
                                                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20')
                                                        : 'bg-subtle text-muted-hub border-subtle'
                                                }`}>
                                                    <Award className="w-3 h-3 text-amber-500" />
                                                    {rowScore} pts
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* BARRA DE RODAPÉ COM RESUMO */}
                    <div className="p-4 bg-subtle/40 border-t border-subtle flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                        <div className="flex flex-wrap items-center gap-4 text-muted-hub">
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span><strong className="text-primary-hub">{filledCount}</strong> de <strong className="text-primary-hub">{collaborators.length}</strong> preenchidos</span>
                            </span>
                            <span className="hidden sm:inline text-muted-hub">•</span>
                            <span className="flex items-center gap-1.5">
                                <Award className="w-4 h-4 text-amber-500" />
                                <span>Pontuação Total: <strong className="text-primary-hub font-mono">{aggregates.totalScore} pts</strong></span>
                            </span>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <button 
                                type="button"
                                onClick={handleSaveMetrics}
                                disabled={saving}
                                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-950/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar Todas as Avaliações
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* VALIDAÇÃO ANTES DE SALVAR: quem não receberá avaliação */}
            {review && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs">
                    <div className="bg-surface border border-subtle rounded-3xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
                        <div className="px-6 py-5 border-b border-subtle flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="font-brand text-lg font-bold text-primary-hub">Confirmar lançamento</h2>
                                    <p className="text-xs text-secondary-hub mt-0.5">
                                        Data de referência: <strong className="text-primary-hub">{referenceDate.split('-').reverse().join('/')}</strong>.
                                        {' '}Revise antes de gravar.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReview(null)}
                                className="p-1.5 text-muted-hub hover:text-primary-hub hover:bg-subtle rounded-lg cursor-pointer"
                                aria-label="Fechar"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="px-6 py-4 overflow-y-auto space-y-4 text-xs">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center">
                                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{review.ready.length}</div>
                                    <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">receberão avaliação</div>
                                </div>
                                <div className={`rounded-2xl border p-3 text-center ${review.empty.length > 0 ? 'border-rose-500/30 bg-rose-500/10' : 'border-subtle bg-subtle'}`}>
                                    <div className={`text-2xl font-black ${review.empty.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-hub'}`}>{review.empty.length}</div>
                                    <div className="text-[11px] font-bold text-secondary-hub">não receberão nada</div>
                                </div>
                                <div className={`rounded-2xl border p-3 text-center ${review.issues.length > 0 ? 'border-amber-500/30 bg-amber-500/10' : 'border-subtle bg-subtle'}`}>
                                    <div className={`text-2xl font-black ${review.issues.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-hub'}`}>{review.issues.length}</div>
                                    <div className="text-[11px] font-bold text-secondary-hub">com pontos de atenção</div>
                                </div>
                            </div>

                            {review.empty.length > 0 && (
                                <section>
                                    <h3 className="font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider text-[11px] mb-2">
                                        Marcados para não receber avaliação ({review.empty.length})
                                    </h3>
                                    <p className="text-[11px] text-muted-hub mb-2">Nenhuma métrica foi preenchida para estes colaboradores.</p>
                                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {review.empty.map(c => {
                                            const badge = getShiftBadge(c.shift);
                                            return (
                                                <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-subtle border border-subtle">
                                                    <span className="font-bold text-primary-hub truncate">{c.name}</span>
                                                    <span className={`px-2 py-0.5 rounded-full border text-[10px] whitespace-nowrap ${badge.style}`}>{c.shift}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            )}

                            {review.issues.length > 0 && (
                                <section>
                                    <h3 className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider text-[11px] mb-2">
                                        Pontos de atenção ({review.issues.length})
                                    </h3>
                                    <ul className="space-y-1.5">
                                        {review.issues.map(({ colab, warnings }) => (
                                            <li key={colab.id} className="px-3 py-2 rounded-xl bg-subtle border border-subtle">
                                                <span className="font-bold text-primary-hub">{colab.name}</span>
                                                <ul className="mt-0.5 list-disc list-inside text-[11px] text-secondary-hub">
                                                    {warnings.map((w, i) => <li key={i}>{w}</li>)}
                                                </ul>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}

                            {hiddenNoShift.length > 0 && (
                                <section className="rounded-2xl border border-subtle bg-subtle p-3">
                                    <h3 className="font-bold text-secondary-hub uppercase tracking-wider text-[11px] mb-1">
                                        Ativos fora desta lista ({hiddenNoShift.length})
                                    </h3>
                                    <p className="text-[11px] text-muted-hub">
                                        Sem turno cadastrado, por isso não aparecem no lançamento e não receberão avaliação: <strong className="text-secondary-hub">{hiddenNoShift.join(', ')}</strong>.
                                    </p>
                                </section>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-subtle flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                            <button
                                type="button"
                                onClick={handleBackToReview}
                                disabled={saving}
                                className="px-5 py-2.5 rounded-xl border border-strong text-secondary-hub hover:bg-subtle text-xs font-bold cursor-pointer disabled:opacity-50"
                            >
                                Voltar e revisar
                            </button>
                            <button
                                type="button"
                                onClick={() => persistMetrics(review.ready)}
                                disabled={saving}
                                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                <span>Confirmar e salvar {review.ready.length} avaliações</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WeeklyMetrics;
