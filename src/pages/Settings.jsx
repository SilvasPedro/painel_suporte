import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Target, ShieldCheck, Loader2, Save, Shield, Eye, Clock, Headphones, CheckCircle2, Sparkles } from 'lucide-react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNotification } from '../context/NotificationContext';
import { usePermissions } from '../context/PermissionsContext';
import RbacSettingsTab from '../components/RbacSettingsTab';
import QaProcessesTab from '../components/settings/QaProcessesTab';
import { SYSTEM_SHIFTS, THIRD_PARTY_SCHEDULE_INFO, saveSystemShiftsInfo } from '../services/userProfile';

const Settings = () => {
    const { showToast } = useNotification();
    const { canEdit, activeRoleInfo, normalizedRole } = usePermissions();
    const isEditable = canEdit('settings');

    const [activeTab, setActiveTab] = useState('goals');

    // Estado das Metas
    const [goals, setGoals] = useState({ tmr: '00:20:00', fcr: 80, recurrence: 20 });
    const [savingGoals, setSavingGoals] = useState(false);

    // Estado dos Processos QA
    const [processes, setProcesses] = useState([]);
    const [loadingProcesses, setLoadingProcesses] = useState(true);

    useEffect(() => {
        // Listener de Metas
        const unsubGoals = onSnapshot(doc(db, "system_settings", "sector_goals"), (docSnap) => {
            if (docSnap.exists()) setGoals(docSnap.data());
        });

        // Listener de Processos QA
        const unsubProcesses = onSnapshot(collection(db, "qa_processes"), (snap) => {
            const fetched = [];
            snap.forEach(d => fetched.push({ id: d.id, ...d.data() }));
            fetched.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setProcesses(fetched);
            setLoadingProcesses(false);
        });

        return () => { unsubGoals(); unsubProcesses(); };
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
                    <Target className="w-4 h-4"/> Metas Globais
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
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-2xl">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2"><Target className="w-5 h-5 text-red-500"/> Metas do Setor</h2>
                    <form onSubmit={handleSaveGoals} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Meta TMR (hh:mm:ss)</label>
                                <input type="step" step="1" required disabled={!isEditable} value={goals.tmr} onChange={(e) => setGoals({...goals, tmr: e.target.value})} className={`w-full p-2 border rounded-lg outline-none ${!isEditable ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300 focus:ring-2 focus:ring-red-600'}`} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Meta FCR (%)</label>
                                <input type="number" required disabled={!isEditable} value={goals.fcr} onChange={(e) => setGoals({...goals, fcr: Number(e.target.value)})} className={`w-full p-2 border rounded-lg outline-none ${!isEditable ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300 focus:ring-2 focus:ring-red-600'}`} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Taxa de Reincidência (%)</label>
                                <input type="number" required disabled={!isEditable} value={goals.recurrence} onChange={(e) => setGoals({...goals, recurrence: Number(e.target.value)})} className={`w-full p-2 border rounded-lg outline-none ${!isEditable ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300 focus:ring-2 focus:ring-red-600'}`} />
                            </div>
                        </div>
                        {isEditable ? (
                            <button type="submit" disabled={savingGoals} className="py-2.5 px-6 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold transition-colors disabled:opacity-70 flex items-center gap-2 cursor-pointer">
                                {savingGoals ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Salvar Metas
                            </button>
                        ) : (
                            <div className="text-xs text-gray-400 italic">
                                * Apenas usuários com permissão de edição em Configurações podem alterar as metas do setor.
                            </div>
                        )}
                    </form>
                </div>
            )}

            {activeTab === 'qa' && (
                <QaProcessesTab 
                    processes={processes} 
                    loading={loadingProcesses} 
                    isEditable={isEditable} 
                />
            )}
        </div>
    );
};

export default Settings;