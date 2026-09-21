import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Target, ShieldCheck, Loader2, Save, Shield, Eye } from 'lucide-react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNotification } from '../context/NotificationContext';
import { usePermissions } from '../context/PermissionsContext';
import RbacSettingsTab from '../components/RbacSettingsTab';
import QaProcessesTab from '../components/settings/QaProcessesTab';

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
            </div>

            {activeTab === 'roles' && (
                <RbacSettingsTab />
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