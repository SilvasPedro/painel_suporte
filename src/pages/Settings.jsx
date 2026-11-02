import React, { useState, useEffect } from 'react';
import { 
    Settings as SettingsIcon, Target, ShieldCheck, Loader2, Save, Shield, Eye, 
    Clock, Headphones, CheckCircle2, Sparkles, Bell, Volume2, VolumeX, Send, 
    AlertTriangle, XCircle, Info, Tag, Activity, RotateCcw, Zap, Server, Check,
    Sliders, Smartphone, ArrowRight
} from 'lucide-react';
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
            showToast("Metas globais atualizadas com sucesso no banco de dados!", "success");
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
            showToast("Prazos de SLA propagados com sucesso para todo o sistema!", "success");
        } catch {
            showToast("Erro ao salvar SLA.", "error");
        } finally {
            setSavingSla(false);
        }
    };

    // --- RESTAURAR PADRÕES DE FÁBRICA SLA ---
    const handleResetDefaultSla = () => {
        setSlaConfig(DEFAULT_SLA_PRESETS);
        showToast("Padrões ISP restaurados no formulário (48h, 120h, 72h, 72h). Clique em 'Salvar Prazos de SLA' para gravar.", "info");
    };

    // SLA Médio Calculado
    const averageSlaHours = Math.round(
        (Number(slaConfig.error_analysis || 48) + 
         Number(slaConfig.system_improvement || 120) + 
         Number(slaConfig.facility_improvement || 72) + 
         Number(slaConfig.other || 72)) / 4
    );

    return (
        <div className="w-full min-w-0 flex-1 p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-canvas flex flex-col font-sans space-y-6">
            
            {/* CABEÇALHO EXECUTIVO (NO FUNDO DA PÁGINA) */}
            <header className="mb-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-rose-500 uppercase tracking-wider">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Governança & Parametrização Central</span>
                    </div>
                    <h1 className="font-brand text-2xl sm:text-3xl font-bold text-primary-hub tracking-tight">
                        Configurações do Sistema
                    </h1>
                    <p className="text-xs text-secondary-hub mt-0.5">
                        Gerenciamento de diretrizes corporativas, SLAs parametrizados, matriz RBAC e notificações Web Push.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {!isEditable ? (
                        <div className="flex items-center gap-2 px-3.5 py-2 bg-surface border border-subtle text-secondary-hub rounded-xl text-xs font-semibold shadow-xs">
                            <Eye className="w-4 h-4 text-amber-500" />
                            <span>Modo Visualização ({activeRoleInfo?.label || normalizedRole})</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3.5 py-2 bg-surface border border-subtle text-secondary-hub rounded-xl text-xs font-semibold shadow-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>Acesso Total ({activeRoleInfo?.label || normalizedRole})</span>
                        </div>
                    )}
                </div>
            </header>

            {/* GRID BENTO DE INDICADORES VIVOS DE GOVERNANÇA (100% WIDTH) */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* KPI 1: Metas Estratégicas */}
                <div className="p-4 rounded-2xl bg-surface border border-subtle shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-hub">Metas Setoriais</span>
                        <Target className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="mt-2">
                        <div className="text-lg sm:text-xl font-black text-primary-hub font-mono">
                            FCR ≥{goals.fcr}% <span className="text-xs font-normal text-muted-hub">| QA ≥{goals.qa}%</span>
                        </div>
                        <span className="text-[11px] text-secondary-hub block mt-0.5">TMR alvo: ≤{goals.tmr}</span>
                    </div>
                </div>

                {/* KPI 2: SLAs Parametrizados */}
                <div className="p-4 rounded-2xl bg-surface border border-subtle shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-hub">Prazos de SLA</span>
                        <Clock className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="mt-2">
                        <div className="text-lg sm:text-xl font-black text-primary-hub font-mono">
                            {averageSlaHours}h <span className="text-xs font-normal text-muted-hub">médio</span>
                        </div>
                        <span className="text-[11px] text-secondary-hub block mt-0.5">4 categorias ativas no ISP</span>
                    </div>
                </div>

                {/* KPI 3: Cobertura de Turnos */}
                <div className="p-4 rounded-2xl bg-surface border border-subtle shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-hub">Expedientes</span>
                        <Headphones className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="mt-2">
                        <div className="text-lg sm:text-xl font-black text-primary-hub font-mono">
                            24 Horas <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">100%</span>
                        </div>
                        <span className="text-[11px] text-secondary-hub block mt-0.5">4 turnos + Noturno terceirizado</span>
                    </div>
                </div>

                {/* KPI 4: Web Push & Som */}
                <div className="p-4 rounded-2xl bg-surface border border-subtle shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-hub">Web Push & Som</span>
                        <Bell className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="mt-2">
                        <div className="text-lg sm:text-xl font-black text-primary-hub">
                            {permission === 'granted' ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Autorizado</span>
                            ) : permission === 'denied' ? (
                                <span className="text-rose-600 dark:text-rose-400 font-bold">Bloqueado</span>
                            ) : (
                                <span className="text-amber-600 dark:text-amber-400 font-bold">Pendente</span>
                            )}
                        </div>
                        <span className="text-[11px] text-secondary-hub block mt-0.5">
                            Chime acústico: {soundEnabled ? 'Ativo' : 'Desativado'}
                        </span>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            <div className="w-full bg-surface rounded-3xl border border-subtle shadow-xs p-6 lg:p-8 relative overflow-hidden shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5" /> Governança v4.0
                            </span>
                            <span className="text-xs text-muted-hub">&bull;</span>
                            <span className="text-xs font-semibold text-secondary-hub">Parametrização Central da Operação</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-primary-hub tracking-tight flex items-center gap-3">
                            <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 text-white flex items-center justify-center shadow-md shadow-rose-950/20">
                                <SettingsIcon className="w-5 h-5 text-white" />
                            </span>
                            Configurações do Sistema
                        </h1>
                        <p className="text-xs sm:text-sm text-secondary-hub max-w-3xl leading-relaxed">
                            Gerenciamento de diretrizes corporativas, SLAs com conformidade automática, matriz de controle RBAC granular, turnos de cobertura e notificações Web Push.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
                        {!isEditable ? (
                            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-bold">
                                <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                <span>Modo Visualização ({activeRoleInfo?.label || normalizedRole})</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span>Acesso Total ({activeRoleInfo?.label || normalizedRole})</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Grid Bento de Indicadores Vivos de Governança (100% Width) */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-subtle">
                    {/* KPI 1: Metas Estratégicas */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-subtle/60 border border-subtle flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-hub">Metas Setoriais</span>
                            <Target className="w-4 h-4 text-rose-500" />
                        </div>
                        <div className="mt-2">
                            <div className="text-lg sm:text-xl font-black text-primary-hub font-mono">
                                FCR ≥{goals.fcr}% <span className="text-xs font-normal text-muted-hub">| QA ≥{goals.qa}%</span>
                            </div>
                            <span className="text-[11px] text-secondary-hub block mt-0.5">TMR alvo: ≤{goals.tmr}</span>
                        </div>
                    </div>

                    {/* KPI 2: SLAs Parametrizados */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-subtle/60 border border-subtle flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-hub">Prazos de SLA</span>
                            <Clock className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div className="mt-2">
                            <div className="text-lg sm:text-xl font-black text-primary-hub font-mono">
                                {averageSlaHours}h <span className="text-xs font-normal text-muted-hub">médio</span>
                            </div>
                            <span className="text-[11px] text-secondary-hub block mt-0.5">4 categorias ativas no ISP</span>
                        </div>
                    </div>

                    {/* KPI 3: Cobertura de Turnos */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-subtle/60 border border-subtle flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-hub">Expedientes</span>
                            <Headphones className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="mt-2">
                            <div className="text-lg sm:text-xl font-black text-primary-hub font-mono">
                                24 Horas <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">100%</span>
                            </div>
                            <span className="text-[11px] text-secondary-hub block mt-0.5">4 turnos + Noturno terceirizado</span>
                        </div>
                    </div>

                    {/* KPI 4: Web Push & Som */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-subtle/60 border border-subtle flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-hub">Web Push & Som</span>
                            <Bell className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="mt-2">
                            <div className="text-lg sm:text-xl font-black text-primary-hub">
                                {permission === 'granted' ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Autorizado</span>
                                ) : permission === 'denied' ? (
                                    <span className="text-rose-600 dark:text-rose-400 font-bold">Bloqueado</span>
                                ) : (
                                    <span className="text-amber-600 dark:text-amber-400 font-bold">Pendente</span>
                                )}
                            </div>
                            <span className="text-[11px] text-secondary-hub block mt-0.5">
                                Chime acústico: {soundEnabled ? 'Ativo' : 'Desativado'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* BARRA DE NAVEGAÇÃO DE ABAS EXPANSIVA (100% WIDTH COM PILL DOCK)          */}
            {/* ========================================================================= */}
            <div className="w-full bg-surface p-2 rounded-2xl border border-subtle shadow-xs shrink-0 flex items-center space-x-2 overflow-x-auto no-scrollbar">
                <button 
                    onClick={() => setActiveTab('goals')} 
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs transition-all whitespace-nowrap cursor-pointer border ${
                        activeTab === 'goals' 
                            ? 'bg-rose-600 text-white border-transparent shadow-xs font-bold' 
                            : 'bg-subtle text-secondary-hub hover:bg-surface border-subtle font-medium'
                    }`}
                >
                    <Target className="w-4 h-4" /> Metas Globais & SLA
                </button>
                <button 
                    onClick={() => setActiveTab('qa')} 
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs transition-all whitespace-nowrap cursor-pointer border ${
                        activeTab === 'qa' 
                            ? 'bg-rose-600 text-white border-transparent shadow-xs font-bold' 
                            : 'bg-subtle text-secondary-hub hover:bg-surface border-subtle font-medium'
                    }`}
                >
                    <ShieldCheck className="w-4 h-4" /> Processos QA & Checklists
                </button>
                <button 
                    onClick={() => setActiveTab('roles')} 
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs transition-all whitespace-nowrap cursor-pointer border ${
                        activeTab === 'roles' 
                            ? 'bg-rose-600 text-white border-transparent shadow-xs font-bold' 
                            : 'bg-subtle text-secondary-hub hover:bg-surface border-subtle font-medium'
                    }`}
                >
                    <Shield className="w-4 h-4" /> Cargos e Permissões (RBAC)
                </button>
                <button 
                    onClick={() => setActiveTab('shifts')} 
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs transition-all whitespace-nowrap cursor-pointer border ${
                        activeTab === 'shifts' 
                            ? 'bg-rose-600 text-white border-transparent shadow-xs font-bold' 
                            : 'bg-subtle text-secondary-hub hover:bg-surface border-subtle font-medium'
                    }`}
                >
                    <Clock className="w-4 h-4" /> Expedientes & Turnos
                </button>
                <button 
                    onClick={() => setActiveTab('feedback_tags')} 
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs transition-all whitespace-nowrap cursor-pointer border ${
                        activeTab === 'feedback_tags' 
                            ? 'bg-rose-600 text-white border-transparent shadow-xs font-bold' 
                            : 'bg-subtle text-secondary-hub hover:bg-surface border-subtle font-medium'
                    }`}
                >
                    <Tag className="w-4 h-4" /> Tags de Feedback
                </button>
                <button 
                    onClick={() => setActiveTab('notifications')} 
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs transition-all whitespace-nowrap cursor-pointer border ${
                        activeTab === 'notifications' 
                            ? 'bg-rose-600 text-white border-transparent shadow-xs font-bold' 
                            : 'bg-subtle text-secondary-hub hover:bg-surface border-subtle font-medium'
                    }`}
                >
                    <Bell className="w-4 h-4" /> Notificações Push
                </button>
            </div>

            {/* ========================================================================= */}
            {/* ABA: CARGOS E PERMISSÕES (RBAC)                                           */}
            {/* ========================================================================= */}
            {activeTab === 'roles' && (
                <div className="w-full">
                    <RbacSettingsTab />
                </div>
            )}

            {/* ========================================================================= */}
            {/* ABA: EXPEDIENTES & TURNOS (100% WIDTH COM TIMELINE 24H)                   */}
            {/* ========================================================================= */}
            {activeTab === 'shifts' && (
                <div className="w-full space-y-6">
                    {/* Linha do Tempo Visual 24 Horas */}
                    <div className="w-full bg-surface rounded-3xl border border-subtle shadow-xs p-6 lg:p-8 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-subtle pb-4">
                            <div>
                                <h2 className="text-base sm:text-lg font-bold text-primary-hub flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                    Linha do Tempo de Cobertura Contínua (24 Horas)
                                </h2>
                                <p className="text-xs text-secondary-hub mt-0.5">
                                    Visualização esquemática da transição de escala entre os turnos diurnos e o serviço terceirizado noturno.
                                </p>
                            </div>
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 rounded-full flex items-center gap-1.5 self-start sm:self-auto">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Sem Gargalos Operacionais
                            </span>
                        </div>

                        {/* Régua de Horas Visual */}
                        <div className="space-y-3">
                            <div className="flex justify-between text-[11px] font-mono font-bold text-muted-hub px-1">
                                <span>00:00</span>
                                <span>04:00</span>
                                <span>08:00</span>
                                <span>12:00</span>
                                <span>16:00</span>
                                <span>20:00</span>
                                <span>24:00</span>
                            </div>

                            {/* Barras de Turno na Timeline */}
                            <div className="space-y-2 pt-1">
                                {/* Terceirizada Noturna (22h - 06h) */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-secondary-hub">
                                        <span className="font-bold flex items-center gap-1.5">
                                            <Headphones className="w-3.5 h-3.5 text-amber-500" />
                                            {THIRD_PARTY_SCHEDULE_INFO.title}
                                        </span>
                                        <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400 font-bold">{THIRD_PARTY_SCHEDULE_INFO.hours}</span>
                                    </div>
                                    <div className="h-4 bg-subtle rounded-full overflow-hidden flex relative">
                                        {/* 00h às 06h (25% do dia) */}
                                        <div className="w-[25%] bg-amber-500/80 h-full rounded-l-full" title="00:00 às 06:00"></div>
                                        {/* Espaço diurno 06h às 22h (66.6%) */}
                                        <div className="w-[66.6%] h-full"></div>
                                        {/* 22h às 24h (8.4% do dia) */}
                                        <div className="w-[8.4%] bg-amber-500/80 h-full rounded-r-full" title="22:00 às 24:00"></div>
                                    </div>
                                </div>

                                {/* Turno 1 Manhã (07h - 16h) */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-secondary-hub">
                                        <span className="font-bold flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                            Turno Manhã (07:00 às 16:00)
                                        </span>
                                        <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-bold">07:00 - 16:00</span>
                                    </div>
                                    <div className="h-4 bg-subtle rounded-full overflow-hidden flex">
                                        <div className="w-[29.1%] h-full"></div>
                                        <div className="w-[37.5%] bg-blue-500/80 h-full rounded-full" title="07:00 às 16:00"></div>
                                        <div className="w-[33.4%] h-full"></div>
                                    </div>
                                </div>

                                {/* Turno 2 Intermediário (08h - 17h) */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-secondary-hub">
                                        <span className="font-bold flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                            Turno Intermediário (08:00 às 17:00)
                                        </span>
                                        <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">08:00 - 17:00</span>
                                    </div>
                                    <div className="h-4 bg-subtle rounded-full overflow-hidden flex">
                                        <div className="w-[33.3%] h-full"></div>
                                        <div className="w-[37.5%] bg-emerald-500/80 h-full rounded-full" title="08:00 às 17:00"></div>
                                        <div className="w-[29.2%] h-full"></div>
                                    </div>
                                </div>

                                {/* Turno 3 Tarde (13h - 22h) */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-secondary-hub">
                                        <span className="font-bold flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                            Turno Tarde (13:00 às 22:00)
                                        </span>
                                        <span className="font-mono text-[11px] text-purple-600 dark:text-purple-400 font-bold">13:00 - 22:00</span>
                                    </div>
                                    <div className="h-4 bg-subtle rounded-full overflow-hidden flex">
                                        <div className="w-[54.1%] h-full"></div>
                                        <div className="w-[37.5%] bg-purple-500/80 h-full rounded-full" title="13:00 às 22:00"></div>
                                        <div className="w-[8.4%] h-full"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Cards dos Turnos Oficiais em Grid 100% */}
                    <div className="w-full bg-surface rounded-3xl border border-subtle shadow-xs p-6 lg:p-8 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-subtle pb-3">
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-primary-hub flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                    Expedientes Oficiais da Operação Interna
                                </h3>
                                <p className="text-xs text-secondary-hub mt-0.5">
                                    Jornadas de trabalho homologadas para analistas de suporte, triagem e monitoramento.
                                </p>
                            </div>
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 rounded-full flex items-center gap-1 self-start sm:self-auto">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Ativos no Sistema
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                            {SYSTEM_SHIFTS.map(shift => (
                                <div key={shift.id} className="p-4 rounded-2xl border border-subtle bg-subtle/50 flex flex-col justify-between hover:border-border-hub transition-colors">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-black uppercase text-primary-hub">{shift.label}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${shift.badge}`}>
                                                {shift.id}
                                            </span>
                                        </div>
                                        <div className="text-xl font-mono font-black text-primary-hub mt-1">
                                            {shift.hours}
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-subtle text-xs text-secondary-hub">
                                        Início: <strong className="text-primary-hub">{shift.start}</strong> • Término: <strong className="text-primary-hub">{shift.end}</strong>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Card Oficial da Operação Terceirizada Noturna */}
                    <div className="w-full bg-surface rounded-3xl border border-subtle shadow-xs p-6 lg:p-8 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-subtle pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                                    <Headphones className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-primary-hub flex items-center gap-2">
                                        {THIRD_PARTY_SCHEDULE_INFO.title}
                                    </h3>
                                    <p className="text-xs text-secondary-hub mt-0.5">
                                        Período assumido por parceiro homologado para atendimento noturno contínuo.
                                    </p>
                                </div>
                            </div>
                            <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full self-start sm:self-auto flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                                Salvo nas Configurações do Sistema
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                            <div className="p-4 rounded-2xl bg-subtle border border-subtle space-y-2">
                                <span className="text-[11px] font-bold text-secondary-hub uppercase tracking-wider block">
                                    Horário de Cobertura Noturna
                                </span>
                                <span className="text-2xl font-mono font-black text-amber-600 dark:text-amber-400 block">
                                    {THIRD_PARTY_SCHEDULE_INFO.hours}
                                </span>
                                <p className="text-xs text-secondary-hub leading-relaxed">
                                    {THIRD_PARTY_SCHEDULE_INFO.description}
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl bg-subtle border border-subtle flex flex-col justify-between">
                                <div>
                                    <span className="text-[11px] font-bold text-secondary-hub uppercase tracking-wider block">
                                        Finalidade no Sistema
                                    </span>
                                    <p className="text-xs text-secondary-hub mt-1 leading-relaxed">
                                        {THIRD_PARTY_SCHEDULE_INFO.note} Essa informação está registrada na base do sistema para planejamento de transição de turnos e futuras escalas.
                                    </p>
                                </div>
                                {isEditable && (
                                    <div className="mt-4 pt-3 border-t border-subtle flex justify-end">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const ok = await saveSystemShiftsInfo();
                                                if (ok) showToast('Informações de turnos e terceirizada sincronizadas no Firestore!', 'success');
                                            }}
                                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
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

            {/* ========================================================================= */}
            {/* ABA: METAS GLOBAIS & SLA (100% WIDTH COM CARDS BENTO E ALTO CONTRASTE)   */}
            {/* ========================================================================= */}
            {activeTab === 'goals' && (
                <div className="w-full space-y-6">
                    
                    {/* BLOCO 1: METAS ESTRATÉGICAS DO SETOR */}
                    <div className="w-full bg-surface rounded-3xl border border-subtle shadow-xs p-6 lg:p-8 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-subtle pb-4">
                            <div>
                                <h2 className="text-base sm:text-lg font-bold text-primary-hub flex items-center gap-2">
                                    <Target className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                    Metas Estratégicas Globais da Operação
                                </h2>
                                <p className="text-xs text-secondary-hub mt-0.5">
                                    Parâmetros de referência utilizados para cálculo de conformidade nos cockpits, relatórios e evolução histórica.
                                </p>
                            </div>
                            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/25 px-3 py-1 rounded-full flex items-center gap-1.5 self-start sm:self-auto">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Cockpit de KPIs Ativo
                            </span>
                        </div>

                        <form onSubmit={handleSaveGoals} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                
                                {/* Card 1: Meta TMR */}
                                <div className="p-4 rounded-2xl border border-subtle bg-subtle/50 flex flex-col justify-between hover:border-border-hub transition-colors">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-primary-hub">
                                                Meta TMR Setor
                                            </span>
                                            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                                <Clock className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <p className="text-xs text-secondary-hub mb-3">
                                            Tempo médio máximo de resposta tolerado
                                        </p>
                                        <div>
                                            <label className="block text-[10px] font-bold text-secondary-hub uppercase mb-1">Formato (hh:mm:ss)</label>
                                            <input 
                                                type="text" 
                                                placeholder="00:20:00"
                                                required 
                                                disabled={!isEditable} 
                                                value={goals.tmr || ''} 
                                                onChange={(e) => setGoals({...goals, tmr: e.target.value})} 
                                                className={`w-full px-3 py-2.5 border rounded-xl font-mono font-bold text-sm outline-none transition-all ${
                                                    !isEditable 
                                                        ? 'bg-subtle border-subtle text-muted-hub cursor-not-allowed' 
                                                        : 'bg-surface border-subtle text-primary-hub focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                                                }`} 
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-subtle text-xs text-secondary-hub flex items-center justify-between">
                                        <span>Objetivo operacional:</span>
                                        <strong className="text-primary-hub font-mono">≤ {goals.tmr || '00:20:00'}</strong>
                                    </div>
                                </div>

                                {/* Card 2: Meta FCR */}
                                <div className="p-4 rounded-2xl border border-subtle bg-subtle/50 flex flex-col justify-between hover:border-border-hub transition-colors">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-primary-hub">
                                                Meta FCR (1º Contato)
                                            </span>
                                            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                <Target className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <p className="text-xs text-secondary-hub mb-3">
                                            Resolução imediata no primeiro contato
                                        </p>
                                        <div>
                                            <label className="block text-[10px] font-bold text-secondary-hub uppercase mb-1">Percentual Mínimo (%)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    max="100"
                                                    required 
                                                    disabled={!isEditable} 
                                                    value={goals.fcr ?? 80} 
                                                    onChange={(e) => setGoals({...goals, fcr: Number(e.target.value)})} 
                                                    className={`w-full px-3 py-2.5 pr-8 border rounded-xl font-mono font-bold text-sm outline-none transition-all ${
                                                        !isEditable 
                                                            ? 'bg-subtle border-subtle text-muted-hub cursor-not-allowed' 
                                                            : 'bg-surface border-subtle text-primary-hub focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                                                    }`} 
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-secondary-hub pointer-events-none">%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-subtle text-xs text-secondary-hub flex items-center justify-between">
                                        <span>Objetivo operacional:</span>
                                        <strong className="text-emerald-600 dark:text-emerald-400 font-mono">≥ {goals.fcr ?? 80}%</strong>
                                    </div>
                                </div>

                                {/* Card 3: Taxa de Reincidência */}
                                <div className="p-4 rounded-2xl border border-subtle bg-subtle/50 flex flex-col justify-between hover:border-border-hub transition-colors">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-primary-hub">
                                                Reincidência Máxima
                                            </span>
                                            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                <Activity className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <p className="text-xs text-secondary-hub mb-3">
                                            Limite aceitável de chamados reincidentes
                                        </p>
                                        <div>
                                            <label className="block text-[10px] font-bold text-secondary-hub uppercase mb-1">Teto Máximo (%)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    max="100"
                                                    required 
                                                    disabled={!isEditable} 
                                                    value={goals.recurrence ?? 20} 
                                                    onChange={(e) => setGoals({...goals, recurrence: Number(e.target.value)})} 
                                                    className={`w-full px-3 py-2.5 pr-8 border rounded-xl font-mono font-bold text-sm outline-none transition-all ${
                                                        !isEditable 
                                                            ? 'bg-subtle border-subtle text-muted-hub cursor-not-allowed' 
                                                            : 'bg-surface border-subtle text-primary-hub focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                                                    }`} 
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-secondary-hub pointer-events-none">%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-subtle text-xs text-secondary-hub flex items-center justify-between">
                                        <span>Objetivo operacional:</span>
                                        <strong className="text-blue-600 dark:text-blue-400 font-mono">≤ {goals.recurrence ?? 20}%</strong>
                                    </div>
                                </div>

                                {/* Card 4: Meta QA Operação */}
                                <div className="p-4 rounded-2xl border border-subtle bg-subtle/50 flex flex-col justify-between hover:border-border-hub transition-colors">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-primary-hub">
                                                Índice QA Operação
                                            </span>
                                            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                                <ShieldCheck className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <p className="text-xs text-secondary-hub mb-3">
                                            Qualidade média de auditorias e checklists
                                        </p>
                                        <div>
                                            <label className="block text-[10px] font-bold text-secondary-hub uppercase mb-1">Percentual Mínimo (%)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    max="100"
                                                    required 
                                                    disabled={!isEditable} 
                                                    value={goals.qa ?? 85} 
                                                    onChange={(e) => setGoals({...goals, qa: Number(e.target.value)})} 
                                                    className={`w-full px-3 py-2.5 pr-8 border rounded-xl font-mono font-bold text-sm outline-none transition-all ${
                                                        !isEditable 
                                                            ? 'bg-subtle border-subtle text-muted-hub cursor-not-allowed' 
                                                            : 'bg-surface border-subtle text-primary-hub focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                                                    }`} 
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-secondary-hub pointer-events-none">%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-subtle text-xs text-secondary-hub flex items-center justify-between">
                                        <span>Objetivo operacional:</span>
                                        <strong className="text-indigo-600 dark:text-indigo-400 font-mono">≥ {goals.qa ?? 85}%</strong>
                                    </div>
                                </div>

                            </div>

                            {isEditable ? (
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                                    <span className="text-xs text-secondary-hub">
                                        As metas salvas são propagadas instantaneamente para os cockpits, cockpits de colaboradores e auditorias.
                                    </span>
                                    <button 
                                        type="submit" 
                                        disabled={savingGoals} 
                                        className="py-2.5 px-6 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-rose-950/20 disabled:opacity-70 flex items-center gap-2 cursor-pointer active:scale-95"
                                    >
                                        {savingGoals ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Metas Estratégicas
                                    </button>
                                </div>
                            ) : (
                                <div className="text-xs text-secondary-hub italic pt-2">
                                    * Apenas usuários com permissão de edição em Configurações podem alterar as metas do setor.
                                </div>
                            )}
                        </form>
                    </div>

                    {/* BLOCO 2: PARAMETRIZAÇÃO DE SLA ISP */}
                    <div className="w-full bg-surface rounded-3xl border border-subtle shadow-xs p-6 lg:p-8 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-subtle pb-4">
                            <div>
                                <h2 className="text-base sm:text-lg font-bold text-primary-hub flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                    Prazos de SLA (Tarefas, Demandas & Chamados ISP)
                                </h2>
                                <p className="text-xs text-secondary-hub mt-0.5">
                                    Defina o tempo limite máximo em horas por categoria de chamado para cálculo de estouro e alertas visuais.
                                </p>
                            </div>
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 rounded-full flex items-center gap-1.5 self-start sm:self-auto">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Sincronização em Tempo Real
                            </span>
                        </div>

                        <form onSubmit={handleSaveSla} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                
                                {/* SLA 1: Análise de Erro */}
                                <div className="p-4 rounded-2xl border border-subtle bg-subtle/50 flex flex-col justify-between hover:border-border-hub transition-colors">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-primary-hub">
                                                Análise de Erro
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                                Falhas
                                            </span>
                                        </div>
                                        <p className="text-xs text-secondary-hub mb-3">
                                            Divergências operacionais, bugs críticos e gargalos
                                        </p>
                                        <div>
                                            <label className="block text-[10px] font-bold text-secondary-hub uppercase mb-1">Prazo Alvo (Horas)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    max="720"
                                                    required 
                                                    disabled={!isEditable} 
                                                    value={slaConfig.error_analysis} 
                                                    onChange={(e) => setSlaConfig({...slaConfig, error_analysis: Number(e.target.value)})} 
                                                    className={`w-full px-3 py-2.5 pr-8 border rounded-xl font-mono font-bold text-sm outline-none transition-all ${
                                                        !isEditable 
                                                            ? 'bg-subtle border-subtle text-muted-hub cursor-not-allowed' 
                                                            : 'bg-surface border-subtle text-primary-hub focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                                                    }`} 
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-secondary-hub pointer-events-none">h</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-subtle text-xs text-secondary-hub flex items-center justify-between">
                                        <span>Equivalência em dias:</span>
                                        <strong className="text-primary-hub font-mono">{(Number(slaConfig.error_analysis) / 24).toFixed(1)} dias</strong>
                                    </div>
                                </div>

                                {/* SLA 2: Melhoria de Sistema */}
                                <div className="p-4 rounded-2xl border border-subtle bg-subtle/50 flex flex-col justify-between hover:border-border-hub transition-colors">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-primary-hub">
                                                Melhoria de Sistema
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                                Software
                                            </span>
                                        </div>
                                        <p className="text-xs text-secondary-hub mb-3">
                                            Ajustes em ERP, automações, scripts e integrações
                                        </p>
                                        <div>
                                            <label className="block text-[10px] font-bold text-secondary-hub uppercase mb-1">Prazo Alvo (Horas)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    max="720"
                                                    required 
                                                    disabled={!isEditable} 
                                                    value={slaConfig.system_improvement} 
                                                    onChange={(e) => setSlaConfig({...slaConfig, system_improvement: Number(e.target.value)})} 
                                                    className={`w-full px-3 py-2.5 pr-8 border rounded-xl font-mono font-bold text-sm outline-none transition-all ${
                                                        !isEditable 
                                                            ? 'bg-subtle border-subtle text-muted-hub cursor-not-allowed' 
                                                            : 'bg-surface border-subtle text-primary-hub focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                                                    }`} 
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-secondary-hub pointer-events-none">h</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-subtle text-xs text-secondary-hub flex items-center justify-between">
                                        <span>Equivalência em dias:</span>
                                        <strong className="text-primary-hub font-mono">{(Number(slaConfig.system_improvement) / 24).toFixed(1)} dias</strong>
                                    </div>
                                </div>

                                {/* SLA 3: Melhoria de Ambiente */}
                                <div className="p-4 rounded-2xl border border-subtle bg-subtle/50 flex flex-col justify-between hover:border-border-hub transition-colors">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-primary-hub">
                                                Melhoria Ambiente
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                Estrutura
                                            </span>
                                        </div>
                                        <p className="text-xs text-secondary-hub mb-3">
                                            Infraestrutura física, estações, rede e periféricos
                                        </p>
                                        <div>
                                            <label className="block text-[10px] font-bold text-secondary-hub uppercase mb-1">Prazo Alvo (Horas)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    max="720"
                                                    required 
                                                    disabled={!isEditable} 
                                                    value={slaConfig.facility_improvement} 
                                                    onChange={(e) => setSlaConfig({...slaConfig, facility_improvement: Number(e.target.value)})} 
                                                    className={`w-full px-3 py-2.5 pr-8 border rounded-xl font-mono font-bold text-sm outline-none transition-all ${
                                                        !isEditable 
                                                            ? 'bg-subtle border-subtle text-muted-hub cursor-not-allowed' 
                                                            : 'bg-surface border-subtle text-primary-hub focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                                                    }`} 
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-secondary-hub pointer-events-none">h</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-subtle text-xs text-secondary-hub flex items-center justify-between">
                                        <span>Equivalência em dias:</span>
                                        <strong className="text-primary-hub font-mono">{(Number(slaConfig.facility_improvement) / 24).toFixed(1)} dias</strong>
                                    </div>
                                </div>

                                {/* SLA 4: Outros */}
                                <div className="p-4 rounded-2xl border border-subtle bg-subtle/50 flex flex-col justify-between hover:border-border-hub transition-colors">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-primary-hub">
                                                Outras Demandas
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                                Geral
                                            </span>
                                        </div>
                                        <p className="text-xs text-secondary-hub mb-3">
                                            Comunicados internos, alinhamentos e tarefas avulsas
                                        </p>
                                        <div>
                                            <label className="block text-[10px] font-bold text-secondary-hub uppercase mb-1">Prazo Alvo (Horas)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    max="720"
                                                    required 
                                                    disabled={!isEditable} 
                                                    value={slaConfig.other} 
                                                    onChange={(e) => setSlaConfig({...slaConfig, other: Number(e.target.value)})} 
                                                    className={`w-full px-3 py-2.5 pr-8 border rounded-xl font-mono font-bold text-sm outline-none transition-all ${
                                                        !isEditable 
                                                            ? 'bg-subtle border-subtle text-muted-hub cursor-not-allowed' 
                                                            : 'bg-surface border-subtle text-primary-hub focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                                                    }`} 
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-secondary-hub pointer-events-none">h</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-subtle text-xs text-secondary-hub flex items-center justify-between">
                                        <span>Equivalência em dias:</span>
                                        <strong className="text-primary-hub font-mono">{(Number(slaConfig.other) / 24).toFixed(1)} dias</strong>
                                    </div>
                                </div>

                            </div>

                            {isEditable ? (
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleResetDefaultSla}
                                        className="text-xs font-semibold text-secondary-hub hover:text-primary-hub flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrões de Fábrica ISP (48h, 120h, 72h, 72h)
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={savingSla} 
                                        className="py-2.5 px-6 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-rose-950/20 disabled:opacity-70 flex items-center gap-2 cursor-pointer active:scale-95"
                                    >
                                        {savingSla ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Prazos de SLA
                                    </button>
                                </div>
                            ) : (
                                <div className="text-xs text-secondary-hub italic pt-2">
                                    * Apenas administradores com permissão de edição podem parametrizar as regras de SLA.
                                </div>
                            )}
                        </form>
                    </div>

                </div>
            )}

            {/* ========================================================================= */}
            {/* ABA: PROCESSOS QA & CHECKLISTS                                            */}
            {/* ========================================================================= */}
            {activeTab === 'qa' && (
                <div className="w-full">
                    <QaProcessesTab 
                        processes={processes} 
                        loading={loadingProcesses} 
                        isEditable={isEditable} 
                    />
                </div>
            )}

            {/* ========================================================================= */}
            {/* ABA: TAGS DE FEEDBACK                                                     */}
            {/* ========================================================================= */}
            {activeTab === 'feedback_tags' && (
                <div className="w-full">
                    <FeedbackTagsTab />
                </div>
            )}

            {/* ========================================================================= */}
            {/* ABA: NOTIFICAÇÕES PUSH (100% WIDTH COM SIMULADOR INTERATIVO)              */}
            {/* ========================================================================= */}
            {activeTab === 'notifications' && (
                <div className="w-full space-y-6">
                    {/* Status da Permissão e Central de Notificações */}
                    <div className="w-full bg-surface rounded-3xl border border-subtle shadow-xs p-6 lg:p-8 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-subtle pb-4">
                            <div>
                                <h2 className="text-base sm:text-lg font-bold text-primary-hub flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                    Notificações Push no Navegador (Web Push)
                                </h2>
                                <p className="text-xs text-secondary-hub mt-0.5">
                                    Configuração de alertas nativos do navegador para feedbacks de desempenho e atualizações de chamados em tempo real.
                                </p>
                            </div>

                            <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border ${
                                permission === 'granted'
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                                    : permission === 'denied'
                                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'
                                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25'
                            }`}>
                                {permission === 'granted' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                                {permission === 'denied' && <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
                                {permission === 'default' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                                {permission === 'granted' ? 'Permissão Ativa' : permission === 'denied' ? 'Bloqueada no Navegador' : 'Aguardando Permissão'}
                            </span>
                        </div>

                        {/* Layout Bento de 2 Colunas: Centro de Controle e Simulador Interativo */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* Coluna 1: Permissão e Chime */}
                            <div className="space-y-4">
                                <div className="p-5 rounded-2xl bg-subtle border border-subtle space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-primary-hub">
                                            Status do Dispositivo
                                        </h3>
                                        <span className="text-[11px] font-mono text-secondary-hub">ServiceWorker Ativo</span>
                                    </div>
                                    <p className="text-xs text-secondary-hub leading-relaxed">
                                        {permission === 'granted' 
                                            ? 'Seu navegador está devidamente homologado para emitir popups nativos mesmo com a janela do sistema em segundo plano ou minimizada.'
                                            : permission === 'denied'
                                            ? 'O navegador bloqueou as notificações para este domínio. Clique no ícone de cadeado na barra de endereços do navegador e marque Notificações como "Permitir".'
                                            : 'O navegador ainda não autorizou notificações para esta sessão. Clique no botão abaixo para conceder permissão imediata.'}
                                    </p>
                                    {permission !== 'granted' && permission !== 'denied' && (
                                        <button
                                            type="button"
                                            onClick={() => requestPermission()}
                                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                                        >
                                            <Bell className="w-4 h-4" />
                                            <span>Conceder Permissão Web Push Agora</span>
                                        </button>
                                    )}
                                </div>

                                {/* Sinal Sonoro Suave */}
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-subtle border border-subtle">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-surface border border-subtle flex items-center justify-center text-primary-hub shadow-xs">
                                            {soundEnabled ? <Volume2 className="w-5 h-5 text-emerald-500" /> : <VolumeX className="w-5 h-5 text-muted-hub" />}
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-primary-hub">Alerta Acústico Suave (Chime)</h4>
                                            <p className="text-xs text-secondary-hub">Tocar sinal suave ao receber feedbacks, despachos e auditorias.</p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => toggleSound()}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                            soundEnabled 
                                                ? 'bg-emerald-600 text-white shadow-xs' 
                                                : 'bg-subtle text-secondary-hub border border-subtle'
                                        }`}
                                    >
                                        {soundEnabled ? 'Som Ativado' : 'Mudo'}
                                    </button>
                                </div>

                                {/* Botões de Disparo */}
                                <div className="p-4 rounded-2xl bg-subtle border border-subtle space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary-hub">Testes em Tempo Real</h4>
                                    <div className="flex flex-wrap gap-2.5">
                                        <button
                                            type="button"
                                            onClick={testNotification}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface hover:bg-subtle text-primary-hub text-xs font-bold transition-all border border-subtle cursor-pointer active:scale-95"
                                        >
                                            <Bell className="w-4 h-4 text-emerald-500" />
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
                                                        comment: 'Excelente desempenho no atendimento aos chamados de alta prioridade nesta semana!',
                                                        createdBy: 'Supervisão Operacional',
                                                        date: new Date().toLocaleDateString('pt-BR'),
                                                        createdAt: new Date().toISOString()
                                                    }
                                                }));
                                            }}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                                        >
                                            <Send className="w-4 h-4" />
                                            <span>Simular Chegada de Feedback Real</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Coluna 2: Simulador Visual Interativo da Notificação */}
                            <div className="p-5 rounded-2xl bg-gradient-to-br from-subtle/80 to-subtle/30 border border-subtle flex flex-col justify-between space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-hub flex items-center gap-1.5">
                                            <Smartphone className="w-3.5 h-3.5 text-rose-500" /> Simulador Visual de Notificação
                                        </span>
                                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                            Preview Fiel
                                        </span>
                                    </div>
                                    <p className="text-xs text-secondary-hub leading-relaxed">
                                        Veja exatamente como o colaborador visualiza o alerta nativo na tela do computador ao receber um novo feedback ou atualização:
                                    </p>
                                </div>

                                {/* Banner Visual do Toast Desktop */}
                                <div className="p-4 rounded-2xl bg-surface border border-subtle shadow-lg space-y-3 relative overflow-hidden">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                                            <Sparkles className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-xs font-bold text-primary-hub truncate">
                                                    HubDesk Operação &bull; Novo Feedback
                                                </h5>
                                                <span className="text-[10px] text-muted-hub font-mono">Agora</span>
                                            </div>
                                            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                                                Elogio registrado pela Supervisão
                                            </p>
                                            <p className="text-xs text-secondary-hub mt-1 line-clamp-2 leading-relaxed">
                                                "Parabéns pelo comprometimento e agilidade na resolução dos chamados de rota crítica hoje!"
                                            </p>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-subtle flex items-center justify-between text-[11px]">
                                        <span className="text-muted-hub">Clique na notificação para visualizar o histórico</span>
                                        <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 cursor-pointer">
                                            Abrir <ArrowRight className="w-3 h-3" />
                                        </span>
                                    </div>
                                </div>

                                {/* Dica de Boas Práticas */}
                                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-secondary-hub flex items-start gap-2.5">
                                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                    <span>
                                        O canal Web Push opera em harmonia com a política de privacidade corporativa, notificando exclusivamente eventos pertinentes ao perfil operacional ativo.
                                    </span>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
