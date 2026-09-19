import React, { useState } from 'react';
import { 
    X, Loader2, User, Mail, Sun, Sunset, Moon, 
    KeyRound, Check, Shield, ShieldCheck, Users, Edit3
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { updateCollaboratorProfile } from '../../services/adminAuth';
import { useNotification } from '../../context/NotificationContext';

const ROLE_CARDS = [
    { id: 'Colaborador', title: 'Colaborador', icon: User, badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    { id: 'Apoio', title: 'Apoio', icon: Users, badge: 'bg-blue-100 text-blue-800 border-blue-200' },
    { id: 'Supervisor', title: 'Supervisor', icon: ShieldCheck, badge: 'bg-amber-100 text-amber-800 border-amber-200' },
    { id: 'Gestor', title: 'Gestor', icon: Shield, badge: 'bg-red-100 text-red-700 border-red-200' }
];

const SHIFT_OPTIONS = [
    { id: 'Manhã', label: 'Manhã', hours: '06h - 14h', icon: Sun },
    { id: 'Tarde', label: 'Tarde', hours: '14h - 22h', icon: Sunset },
    { id: 'Noite', label: 'Noite', hours: '22h - 06h', icon: Moon }
];

export const EditCollaboratorModal = ({ colab, onClose }) => {
    const { showToast } = useNotification();
    const [formData, setFormData] = useState({
        name: colab.name || '',
        role: colab.role || 'Colaborador',
        shift: colab.shift || 'Manhã',
        active: colab.active !== false
    });
    const [loading, setLoading] = useState(false);
    const [resetting, setResetting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateCollaboratorProfile(colab.id, {
                name: formData.name.trim(),
                role: formData.role,
                shift: formData.shift,
                active: formData.active,
                status: formData.active ? 'Ativo' : 'Inativo'
            });
            showToast("Dados do colaborador atualizados com sucesso!", "success");
            onClose();
        } catch (error) {
            showToast("Erro ao atualizar: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!window.confirm(`Deseja enviar um e-mail com link de redefinição de senha para ${colab.email}?`)) return;
        
        setResetting(true);
        try {
            await sendPasswordResetEmail(auth, colab.email);
            showToast("E-mail de redefinição enviado com sucesso!", "success");
        } catch (error) {
            console.error(error);
            showToast("Erro ao enviar e-mail: " + error.message, "error");
        } finally {
            setResetting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-zinc-950/60 flex items-center justify-center p-4 z-[70] backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden my-8 border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="p-5 bg-zinc-950 flex justify-between items-center text-white border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
                            <Edit3 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Editar Perfil do Colaborador</h2>
                            <p className="text-xs text-zinc-400">Atualize informações cadastrais, turno e cargo.</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Nome */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Nome Completo</label>
                        <div className="relative">
                            <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                            <input 
                                type="text" 
                                required 
                                value={formData.name} 
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50/50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-600 outline-none text-sm"
                            />
                        </div>
                    </div>

                    {/* Email (Apenas Leitura) */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">E-mail Corporativo (Identificador Único)</label>
                        <div className="relative">
                            <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                            <input 
                                type="email" 
                                disabled 
                                value={colab.email || ''} 
                                className="w-full pl-9 pr-3.5 py-2.5 border border-gray-200 bg-gray-100 text-gray-500 rounded-xl outline-none cursor-not-allowed text-sm"
                            />
                        </div>
                    </div>

                    {/* Cargo RBAC */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">Cargo / Nível RBAC</label>
                        <div className="grid grid-cols-2 gap-2.5">
                            {ROLE_CARDS.map(r => {
                                const Icon = r.icon;
                                const isSelected = formData.role === r.id;
                                return (
                                    <button
                                        type="button"
                                        key={r.id}
                                        onClick={() => setFormData({ ...formData, role: r.id })}
                                        className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                                            isSelected 
                                                ? 'border-red-600 bg-red-50/60 ring-1 ring-red-600 font-bold text-gray-900' 
                                                : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${r.badge}`}>
                                                <Icon className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xs">{r.title}</span>
                                        </div>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-red-600 stroke-[3]" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Turno */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">Turno de Trabalho</label>
                        <div className="grid grid-cols-3 gap-2.5">
                            {SHIFT_OPTIONS.map(s => {
                                const Icon = s.icon;
                                const isSelected = formData.shift === s.id;
                                return (
                                    <button
                                        type="button"
                                        key={s.id}
                                        onClick={() => setFormData({ ...formData, shift: s.id })}
                                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                                            isSelected 
                                                ? 'border-zinc-900 bg-zinc-900 text-white font-bold shadow-xs' 
                                                : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4 mb-1" />
                                        <span className="text-xs">{s.label}</span>
                                        <span className={`text-[10px] ${isSelected ? 'text-zinc-300' : 'text-gray-400'}`}>{s.hours}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Status Operacional */}
                    <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                        <div>
                            <span className="text-xs font-bold text-gray-800 block">Status Operacional</span>
                            <span className="text-[11px] text-gray-500">
                                {formData.active ? 'Colaborador ativo na equipe' : 'Colaborador inativo (arquivado)'}
                            </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={formData.active} 
                                onChange={e => setFormData({ ...formData, active: e.target.checked })} 
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                        </label>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            disabled={loading}
                            className="px-5 py-2.5 border border-gray-300 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="px-6 py-2.5 bg-zinc-950 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>

                {/* Box de redefinição de senha */}
                <div className="p-4 bg-red-50/60 border-t border-red-100 flex items-center justify-between">
                    <div>
                        <h4 className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5 text-red-600" />
                            Redefinição de Senha
                        </h4>
                        <p className="text-[11px] text-red-700/80">Envia link seguro no e-mail do colaborador para definir nova senha.</p>
                    </div>
                    <button 
                        type="button" 
                        onClick={handleResetPassword}
                        disabled={resetting}
                        className="px-3.5 py-2 bg-white border border-red-200 text-red-700 hover:bg-red-600 hover:text-white rounded-lg transition-colors text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                        {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                        <span>Enviar Link</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
export default EditCollaboratorModal;
