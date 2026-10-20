import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Target, ShieldCheck, Loader2, Save, Shield, Eye, Clock, Headphones, CheckCircle2, Sparkles, Bell, Volume2, VolumeX, Send, AlertTriangle, XCircle, Info, Tag, Activity, RotateCcw } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeSharedDocument, subscribeSharedCollection } from '../services/dataCache';
import { useNotification } from '../context/NotificationContext';
import { usePermissions } from '../context/PermissionsContext';
import RbacSettingsTab from '../components/RbacSettingsTab';
import QaProcessesTab from '../components/settings/QaProcessesTab';
import FeedbackTagsTab from '../components/settings/FeedbackTagsTab';
import { SYSTEM_SHIFTS, THIRD_PARTY_SCHEDULE_INFO, saveSystemShiftsInfo } from '../services/userProfile';

const DEFAULT_SLA_PRESETS = {
    error_analysis: 48,
    system_improvement: 120,
    facility_improvement: 72,
    other: 72,
};

const Settings = () => {
    const { showToast, permission, requestPermission, testNotification, soundEnabled, toggleSound } = useNotification();
    const { canEdit, activeRoleInfo, normalizedRole } = usePermissions();
    const isEditable = canEdit('settings');

    const [activeTab, setActiveTab] = useState('goals');

    // Estado das Metas Estratégicas
    const [goals, setGoals] = useState({ tmr: '00:20:00', fcr: 80, recurrence: 20, qa: 85 });
    const [savingGoals, setSavingGoals] = useState(false);

    // Estado dos Prazos de SLA
    const [slaConfig, setSlaConfig] = useState(DEFAULT_SLA_PRESETS);
    const [savingSla, setSavingSla] = useState(false);

    // Estado dos Processos QA
    const [processes, setProcesses] = useState([]);
    const [loadingProcesses, setLoadingProcesses] = useState(true);

    useEffect(() => {
        // Listener de Metas via cache compartilhado
        const unsubGoals = subscribeSharedDocument("system_settings", "sector_goals", (docData) => {
            if (docData) {
                setGoals(prev => ({
                    ...prev,
                    ...docData,
                    qa: docData.qa !== undefined ? docData.qa : prev.qa
                }));
            }
        });

        // Listener de SLA via cache compartilhado
        const unsubSla = subscribeSharedDocument("system_settings", "sla_config", (docData) => {
            if (docData) {
                setSlaConfig(prev => ({
                    error_analysis: docData.error_analysis?.targetHours ?? (typeof docData.error_analysis === 'number' ? docData.error_analysis : prev.error_analysis),
                    system_improvement: docData.system_improvement?.targetHours ?? (typeof docData.system_improvement === 'number' ? docData.system_improvement : prev.system_improvement),
                    facility_improvement: docData.facility_improvement?.targetHours ?? (typeof docData.facility_improvement === 'number' ? docData.facility_improvement : prev.facility_improvement),
                    other: docData.other?.targetHours ?? (typeof docData.other === 'number' ? docData.other : prev.other),
                }));
            }
        });

        // Listener de Processos QA via cache compartilhado
        const unsubProcesses = subscribeSharedCollection("qa_processes", (items) => {
            const fetched = [...items];
            fetched.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setProcesses(fetched);
            setLoadingProcesses(false);
        });

        return () => { unsubGoals(); unsubSla(); unsubProcesses(); };
    }, []);

    // --- SALVAR METAS ---
    const handleSaveGoals = async (e) => {
        e.preventDefault();
        setSavingGoals(true);
        try {
            await setDoc(doc(db, "system_settings", "sector_goals"), goals);
            showToast("Metas atualizadas com sucesso!", "success");
        } catch {
            showToast("Erro ao atualizar metas.", "error");
        } finally {
            setSavingGoals(false);
        }
    };

    // --- SALVAR SLAS ---
    const handleSaveSla = async (e) => {
        e.preventDefault();
        setSavingSla(true);
        try {
            const payload = {
                error_analysis: { targetHours: Number(slaConfig.error_analysis), label: 'Análise de Erro' },
                system_improvement: { targetHours: Number(slaConfig.system_improvement), label: 'Melhoria de Sistema' },
                facility_improvement: { targetHours: Number(slaConfig.facility_improvement), label: 'Melhoria de Ambiente' },
                other: { targetHours: Number(slaConfig.other), label: 'Outros' },
                updatedAt: new Date().toISOString()
            };
            await setDoc(doc(db, "system_settings", "sla_config"), payload);
            showToast("Prazos de SLA atualizados com sucesso!", "success");
        } catch {
            showToast("Erro ao salvar SLA.", "error");
        } finally {
            setSavingSla(false);
        }
    };

    // --- RESTAURAR PADRÕES DE FÁBRICA SLA ---
    const handleResetDefaultSla = () => {
        setSlaConfig(DEFAULT_SLA_PRESETS);
        showToast("Padrões ISP restaurados no formulário (48h, 120h, 72h, 72h). Clique em 'Salvar' para gravar.", "info");
    };

    return (
        <div className="flex-1 p-6 h-full overflow-y-auto bg-gray-50 flex flex-col">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <SettingsIcon className="w-6 h-6 text-red-600" /> Configurações do Sistema
                    </h1>
                    <p className="text-sm text-gray-500">Ajuste de metas e padronização de processos.</p>
                </div>
                {!isEditable && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold">
                        <Eye className="w-4 h-4 text-amber-600" />
                        Apenas Leitura ({activeRoleInfo?.label || normalizedRole})
                    </div>
                )}
            </header>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 shrink-0 flex space-x-2 overflow-x-auto">
                <button onClick={() => setActiveTab('goals')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${activeTab === 'goals' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <Target className="w-4 h-4"/> Metas Globais & SLA
                </button>
                <button onClick={() => setActiveTab('qa')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${activeTab === 'qa' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <ShieldCheck className="w-4 h-4"/> Processos QA & Checklists
                </button>
                <button onClick={() => setActiveTab('roles')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${activeTab === 'roles' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <Shield className="w-4 h-4"/> Cargos e Permissões (RBAC)
                </button>
                <button onClick={() => setActiveTab('shifts')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${activeTab === 'shifts' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <Clock className="w-4 h-4"/> Expedientes & Turnos
                </button>
                <button onClick={() => setActiveTab('feedback_tags')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${activeTab === 'feedback_tags' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <Tag className="w-4 h-4"/> Tags de Feedback
                </button>
                <button onClick={() => setActiveTab('notifications')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${activeTab === 'notifications' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <Bell className="w-4 h-4"/> Notificações Push
                </button>
            </div>

            {activeTab === 'roles' && (
                <RbacSettingsTab />
            )}

            {activeTab === 'shifts' && (
                <div className="space-y-6 max-w-4xl">
                    {/* Card dos Turnos Oficiais */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                            <div>
                                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-red-600" />
                                    Expedientes Oficiais da Operação (v3.6)
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Jornadas de trabalho homologadas para analistas e equipes de suporte.
                                </p>
                            </div>
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full flex items-center gap-1 self-start sm:self-auto">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Ativos no Sistema
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                            {SYSTEM_SHIFTS.map(shift => (
                                <div key={shift.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-black uppercase text-gray-900">{shift.label}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${shift.badge}`}>
                                                {shift.id}
                                            </span>
                                        </div>
                                        <div className="text-lg font-mono font-black text-gray-900 mt-1">
                                            {shift.hours}
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-gray-200/80 text-[11px] text-gray-500">
                                        Início: <strong>{shift.start}</strong> • Término: <strong>{shift.end}</strong>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Card Oficial da Operação Terceirizada Noturna */}
                    <div className="bg-zinc-950 rounded-2xl border border-zinc-800 shadow-xl p-6 text-white space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                                    <Headphones className="w-5 h-5 text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                                        {THIRD_PARTY_SCHEDULE_INFO.title}
                                    </h3>
                                    <p className="text-xs text-zinc-400 mt-0.5">
                                        Período assumido por terceirizada homologada para atendimento noturno contínuo.
                                    </p>
                                </div>
                            </div>
                            <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full self-start sm:self-auto flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                                Salvo nas Configurações do Sistema
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                                    Horário de Cobertura
                                </span>
                                <span className="text-2xl font-mono font-black text-amber-400 mt-1 block">
                                    {THIRD_PARTY_SCHEDULE_INFO.hours}
                                </span>
                                <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
                                    {THIRD_PARTY_SCHEDULE_INFO.description}
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
                                <div>
                                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                                        Finalidade no Sistema
                                    </span>
                                    <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                                        {THIRD_PARTY_SCHEDULE_INFO.note} Essa informação está registrada na base do sistema para planejamento de transição de turnos e futuras escalas.
                                    </p>
                                </div>
                                {isEditable && (
                                    <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const ok = await saveSystemShiftsInfo();
                                                if (ok) showToast('Informações de turnos e terceirizada sincronizadas no Firestore!', 'success');
                                            }}
                                            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Save className="w-3.5 h-3.5" /> Re-sincronizar no Firestore
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'goals' && (
                <div className="space-y-6 max-w-5xl">
                    
                    {/* ========================================================================= */}
                    {/* BLOCO 1: METAS ESTRATÉGICAS DO SETOR (TMR, FCR, REINCIDÊNCIA, QA)        */}
                    {/* ========================================================================= */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                            <div>
                                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                    <Target className="w-5 h-5 text-red-600" />
                                    Metas Estratégicas Globais da Operação
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Parâmetros de referência utilizados para cálculo de conformidade nos cockpits e evolução histórica.
                                </p>
                            </div>
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full flex items-center gap-1.5 self-start sm:self-auto">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Cockpit de KPIs Ativo
                            </span>
                        </div>

                        <form onSubmit={handleSaveGoals} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                
                                {/* Card 1: Meta TMR */}
                                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-purple-800">
                                                Meta TMR Setor
                                            </span>
                                            <div className="p-1 rounded-md bg-purple-100 text-purple-700">
                                                <Clock className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-purple-900/70 mb-3">
                                            Tempo médio máximo de resposta tolerado
                                        </p>
                                        <div>
                                            <label className="block text-[10px] font-bold text-purple-700 uppercase mb-1">Formato (hh:mm:ss)</label>
                                            <input 
                                                type="text" 
                                                placeholder="00:20:00"
                                                required 
                                                disabled={!isEditable} 
                                                value={goals.tmr || ''} 
                                                onChange={(e) => setGoals({...goals, tmr: e.target.value})} 
                                                className={`w-full px-3 py-2 border rounded-lg font-mono font-bold text-sm outline-none transition-all ${
                                                    !isEditable 
                                                        ? 'bg-purple-100/50 border-purple-200 text-purple-900 cursor-not-allowed' 
                                                        : 'bg-white border-purple-300 text-purple-950 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600'
                                                }`} 
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-purple-200/60 text-[11px] text-purple-800/80 font-medium">
                                        Objetivo: <strong>≤ {goals.tmr || '00:20:00'}</strong>
                                    </div>
                                </div>

                                {/* Card 2: Meta FCR */}
                                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                                                Meta FCR (1º Contato)
                                            </span>
                                            <div className="p-1 rounded-md bg-emerald-100 text-emerald-700">
                                                <Target className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-emerald-900/70 mb-3">
                                            Resolução imediata no primeiro contato
                                        </p>
                                        <div>
                                            <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Percentual Mínimo (%)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    max="100"
                                                    required 
                                                    disabled={!isEditable} 
                                                    value={goals.fcr ?? 80} 
                                                    onChange={(e) => setGoals({...goals, fcr: Number(e.target.value)})} 
                                                    className={`w-full px-3 py-2 pr-8 border rounded-lg font-mono font-bold text-sm outline-none transition-all ${
                                                        !isEditable 
                                                            ? 'bg-emerald-100/50 border-emerald-200 text-emerald-900 cursor-not-allowed' 
                                                            : 'bg-white border-emerald-300 text-emerald-950 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600'
                                                    }`} 
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700 pointer-events-none">%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-emerald-200/60 text-[11px] text-emerald-800/80 font-medium">
                                        Objetivo: <strong>≥ {goals.fcr ?? 80}%</strong>
                                    </div>
                                </div>

                                {/* Card 3: Taxa de Reincidência */}
                                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                                                Reincidência Máxima
                                            </span>
                                            <div className="p-1 rounded-md bg-blue-100 text-blue-700">
                                                <Activity className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-blue-900/70 mb-3">
                                            Limite aceitável de chamados reincidentes
                                        </p>
                                        <div>
                                            <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Teto Máximo (%)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    max="100"
                                                    required 
                                                    disabled={!isEditable} 
                                                    value={goals.recurrence ?? 20} 
                                                    onChange={(e) => setGoals({...goals, recurrence: Number(e.target.value)})} 
                                                    className={`w-full px-3 py-2 pr-8 border rounded-lg font-mono font-bold text-sm outline-none transition-all ${
                                                        !isEditable 
                                                            ? 'bg-blue-100/50 border-blue-200 text-blue-900 cursor-not-allowed' 
                                                            : 'bg-white border-blue-300 text-blue-950 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600'
                                                    }`} 
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-700 pointer-events-none">%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-blue-200/60 text-[11px] text-blue-800/80 font-medium">
                                        Objetivo: <strong>≤ {goals.recurrence ?? 20}%</strong>
                                    </div>
                                </div>

                                {/* Card 4: Meta QA Operação */}
                                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">
                                                Índice QA Operação
                                            </span>
                                            <div className="p-1 rounded-md bg-indigo-100 text-indigo-700">
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-indigo-900/70 mb-3">
                                            Qualidade média de auditorias e checklists
                                        </p>
                                        <div>
                                            <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1">Percentual Mínimo (%)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    max="100"
                                                    required 
                                                    disabled={!isEditable} 
                                                    value={goals.qa ?? 85} 
                                                    onChange={(e) => setGoals({...goals, qa: Number(e.target.value)})} 
                                                    className={`w-full px-3 py-2 pr-8 border rounded-lg font-mono font-bold text-sm outline-none transition-all ${
                                                        !isEditable 
                                                            ? 'bg-indigo-100/50 border-indigo-200 text-indigo-900 cursor-not-allowed' 
                                                            : 'bg-white border-indigo-300 text-indigo-950 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600'
                                                    }`} 
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-700 pointer-events-none">%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-indigo-200/60 text-[11px] text-indigo-800/80 font-medium">
                                        Objetivo: <strong>≥ {goals.qa ?? 85}%</strong>
                                    </div>
                                </div>

                            </div>

                            {isEditable ? (
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                                    <span className="text-xs text-gray-500">
                                        As metas salvas são propagadas instantaneamente para os cockpits e filtros de KPIs.
                                    </span>
                                    <button 
                                        type="submit" 
                                        disabled={savingGoals} 
                                        className="py-2.5 px-6 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold text-sm transition-all shadow-xs disabled:opacity-70 flex items-center gap-2 cursor-pointer"
                                    >
                                        {savingGoals ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Metas Estratégicas
                                    </button>
                                </div>
                            ) : (
                                <div className="text-xs text-gray-400 italic pt-2">
                                    * Apenas usuários com permissão de edição em Configurações podem alterar as metas do setor.
                                </div>
                            )}
                        </form>
                    </div>

                    {/* ========================================================================= */}
                    {/* BLOCO 2: PARAMETRIZAÇÃO DE SLA (TAREFAS, RELATÓRIOS E DEMANDAS ISP)        */}
                    {/* ========================================================================= */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                            <div>
                                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-red-600" />
                                    Prazos de SLA (Tarefas, Demandas & Relatórios)
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Defina o tempo limite (em horas) para triagem, resposta e resolução por categoria de chamado ISP.
                                </p>
                            </div>
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full flex items-center gap-1.5 self-start sm:self-auto">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Sincronização em Tempo Real
                            </span>
                        </div>

                        <form onSubmit={handleSaveSla} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                
                                {/* SLA 1: Análise de Erro */}
                                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                                                Análise de Erro
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                                                Falhas
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-rose-900/70 mb-3">
                                            Divergências em atendimentos, falhas operacionais e gargalos
                                        </p>
                                        <div>
                                            <label className="block text-[10px] font-bold text-rose-700 uppercase mb-1">Prazo Alvo (Horas)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    max="720"
                                                    required 
                                                    disabled={!isEditable} 
                                                    value={slaConfig.error_analysis} 
                                                    onChange={(e) => setSlaConfig({...slaConfig, error_analysis: Number(e.target.value)})} 
                                                    className={`w-full px-3 py-2 pr-8 border rounded-lg font-mono font-bold text-sm outline-none transition-all ${
                                                        !isEditable 
                                                            ? 'bg-rose-100/50 border-rose-200 text-rose-900 cursor-not-allowed' 
                                                            : 'bg-white border-rose-300 text-rose-950 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600'
                                                    }`} 
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-rose-700 pointer-events-none">h</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-rose-200/60 text-[11px] text-rose-800/80 font-medium flex items-center justify-between">
                                        <span>Equivalência:</span>
                                        <strong>{(Number(slaConfig.error_analysis) / 24).toFixed(1)} dias</strong>
                                    </div>
                                </div>

                                {/* SLA 2: Melhoria de Sistema */}
                                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">
                                                Melhoria de Sistema
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 border border-indigo-200">
                                                Software
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-indigo-900/70 mb-3">
                                            Solicitações de ajustes em ERP, automações e softwares
                                        </p>
                                        <div>
                                            <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1">Prazo Alvo (Horas)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    max="720"
                                                    required 
                                                    disabled={!isEditable} 
                                                    value={slaConfig.system_improvement} 
                                                    onChange={(e) => setSlaConfig({...slaConfig, system_improvement: Number(e.target.value)})} 
                                                    className={`w-full px-3 py-2 pr-8 border rounded-lg font-mono font-bold text-sm outline-none transition-all ${
                                                        !isEditable 
                                                            ? 'bg-indigo-100/50 border-indigo-200 text-indigo-900 cursor-not-allowed' 
                                                            : 'bg-white border-indigo-300 text-indigo-950 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600'
                                                    }`} 
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-700 pointer-events-none">h</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-indigo-200/60 text-[11px] text-indigo-800/80 font-medium flex items-center justify-between">
                                        <span>Equivalência:</span>
                                        <strong>{(Number(slaConfig.system_improvement) / 24).toFixed(1)} dias</strong>
                                    </div>
                                </div>

                                {/* SLA 3: Melhoria de Ambiente */}
                                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                                                Melhoria Ambiente
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                Estrutura
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-emerald-900/70 mb-3">
                                            Infraestrutura física, cadeiras, periféricos e ergonomia
                                        </p>
                                        <div>
                                            <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Prazo Alvo (Horas)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    max="720"
                                                    required 
                                                    disabled={!isEditable} 
                                                    value={slaConfig.facility_improvement} 
                                                    onChange={(e) => setSlaConfig({...slaConfig, facility_improvement: Number(e.target.value)})} 
                                                    className={`w-full px-3 py-2 pr-8 border rounded-lg font-mono font-bold text-sm outline-none transition-all ${
                                                        !isEditable 
                                                            ? 'bg-emerald-100/50 border-emerald-200 text-emerald-900 cursor-not-allowed' 
                                                            : 'bg-white border-emerald-300 text-emerald-950 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600'
                                                    }`} 
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700 pointer-events-none">h</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-emerald-200/60 text-[11px] text-emerald-800/80 font-medium flex items-center justify-between">
                                        <span>Equivalência:</span>
                                        <strong>{(Number(slaConfig.facility_improvement) / 24).toFixed(1)} dias</strong>
                                    </div>
                                </div>

                                {/* SLA 4: Outros */}
                                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-purple-800">
                                                Outras Demandas
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 border border-purple-200">
                                                Geral
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-purple-900/70 mb-3">
                                            Comunicados internos, tarefas avulsas e alinhamentos
                                        </p>
                                        <div>
                                            <label className="block text-[10px] font-bold text-purple-700 uppercase mb-1">Prazo Alvo (Horas)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    max="720"
                                                    required 
                                                    disabled={!isEditable} 
                                                    value={slaConfig.other} 
                                                    onChange={(e) => setSlaConfig({...slaConfig, other: Number(e.target.value)})} 
                                                    className={`w-full px-3 py-2 pr-8 border rounded-lg font-mono font-bold text-sm outline-none transition-all ${
                                                        !isEditable 
                                                            ? 'bg-purple-100/50 border-purple-200 text-purple-900 cursor-not-allowed' 
                                                            : 'bg-white border-purple-300 text-purple-950 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600'
                                                    }`} 
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-purple-700 pointer-events-none">h</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-purple-200/60 text-[11px] text-purple-800/80 font-medium flex items-center justify-between">
                                        <span>Equivalência:</span>
                                        <strong>{(Number(slaConfig.other) / 24).toFixed(1)} dias</strong>
                                    </div>
                                </div>

                            </div>

                            {isEditable ? (
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleResetDefaultSla}
                                        className="text-xs font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrões de Fábrica ISP (48h, 120h, 72h, 72h)
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={savingSla} 
                                        className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all shadow-xs disabled:opacity-70 flex items-center gap-2 cursor-pointer"
                                    >
                                        {savingSla ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Prazos de SLA
                                    </button>
                                </div>
                            ) : (
                                <div className="text-xs text-gray-400 italic pt-2">
                                    * Apenas administradores com permissão de edição podem parametrizar as regras de SLA.
                                </div>
                            )}
                        </form>
                    </div>

                </div>
            )}

            {activeTab === 'qa' && (
                <QaProcessesTab 
                    processes={processes} 
                    loading={loadingProcesses} 
                    isEditable={isEditable} 
                />
            )}

            {activeTab === 'feedback_tags' && (
                <FeedbackTagsTab />
            )}

            {activeTab === 'notifications' && (
                <div className="space-y-6 max-w-4xl">
                    {/* Card de Status da Notificação do Navegador */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                            <div>
                                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-red-600" />
                                    Notificações Push no Navegador (Web Push)
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Configuração de alertas nativos do navegador para feedbacks de desempenho e atualizações de chamados.
                                </p>
                            </div>

                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                                permission === 'granted'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : permission === 'denied'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                                {permission === 'granted' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                                {permission === 'denied' && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                                {permission === 'default' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                                {permission === 'granted' ? 'Permissão Ativa' : permission === 'denied' ? 'Bloqueada no Navegador' : 'Aguardando Permissão'}
                            </span>
                        </div>

                        {/* Explicação e Ação de Permissão */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 space-y-2">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">Como funciona o alerta</h3>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    Quando a gestão ou supervisão registra um <strong>Feedback</strong> para um colaborador (ex: Eduardo Caetano), o colaborador que estiver com o sistema aberto em seu computador receberá uma <strong>notificação nativa do sistema operacional/navegador</strong> na tela, mesmo se estiver em outra aba ou minimizado.
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 space-y-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">Ação de Permissão</h3>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    {permission === 'granted' 
                                        ? 'Seu navegador já está autorizado a emitir popups nativos de alertas.'
                                        : permission === 'denied'
                                        ? 'O navegador bloqueou as notificações. Clique no ícone de ajustes/cadeado na barra de endereços do navegador e marque Notificações como "Permitir".'
                                        : 'Clique no botão abaixo para autorizar as notificações no navegador deste dispositivo.'}
                                </p>
                                {permission !== 'granted' && permission !== 'denied' && (
                                    <button
                                        type="button"
                                        onClick={() => requestPermission()}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                                    >
                                        <Bell className="w-4 h-4" />
                                        <span>Solicitar Permissão Agora</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Sinal Sonoro */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 border border-zinc-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-700 shadow-2xs">
                                    {soundEnabled ? <Volume2 className="w-5 h-5 text-emerald-600" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-gray-900">Alerta Sonoro Suave (Chime)</h4>
                                    <p className="text-xs text-gray-500">Tocar sinal acústico agradável ao receber um feedback ou despacho.</p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => toggleSound()}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    soundEnabled 
                                        ? 'bg-emerald-600 text-white shadow-xs' 
                                        : 'bg-zinc-200 text-zinc-700'
                                }`}
                            >
                                {soundEnabled ? 'Som Ligado' : 'Mudo'}
                            </button>
                        </div>

                        {/* Painel de Testes */}
                        <div className="p-5 rounded-xl bg-zinc-950 text-white border border-zinc-800 space-y-3">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-400" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Testar no seu Computador</h3>
                            </div>
                            <p className="text-xs text-zinc-400">
                                Dispare um teste imediato para conferir a notificação nativa do navegador, o sinal sonoro e o toast interativo:
                            </p>

                            <div className="flex flex-wrap gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={testNotification}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all border border-zinc-700 cursor-pointer"
                                >
                                    <Bell className="w-4 h-4 text-emerald-400" />
                                    <span>Disparar Notificação de Teste</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        window.dispatchEvent(new CustomEvent('HUBDESK_SIMULATE_FEEDBACK', {
                                            detail: {
                                                id: `sim-test-${Date.now()}`,
                                                type: 'Elogio',
                                                method: 'Sistema',
                                                comment: 'Teste prático: Notificação push de feedback entregue com sucesso!',
                                                createdBy: 'Gestão HubDesk',
                                                date: new Date().toLocaleDateString('pt-BR'),
                                                createdAt: new Date().toISOString()
                                            }
                                        }));
                                    }}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                                >
                                    <Send className="w-4 h-4" />
                                    <span>Simular Chegada de Feedback Real</span>
                                </button>
                            </div>
                        </div>

                        {/* Guia Informativo com o exemplo de Eduardo Caetano */}
                        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                            <div className="text-xs text-blue-900 leading-relaxed space-y-1">
                                <p className="font-bold">Validação de Teste Multi-Usuário (Exemplo: Eduardo Caetano):</p>
                                <ol className="list-decimal ml-4 space-y-1 text-blue-800">
                                    <li>Abra uma janela normal com o usuário do colaborador (ex: Eduardo Caetano) e confirme que as notificações estão ativadas no sininho do topo.</li>
                                    <li>Em outra janela (ou no computador do Gestor), acesse a aba <strong>Colaboradores</strong> ou <strong>Gestor de Dados</strong> e clique no botão de <strong>Feedback</strong> para o Eduardo Caetano.</li>
                                    <li>Ao salvar o feedback, o Firestore sincroniza em tempo real e a tela do Eduardo Caetano exibirá a notificação nativa do navegador imediatamente com som e botão direto para abrir o histórico!</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;