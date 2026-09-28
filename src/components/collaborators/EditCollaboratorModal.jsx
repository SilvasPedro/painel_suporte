import React, { useState } from 'react';
import { 
    X, Loader2, User, Mail, Sun, Sunset, Moon, 
    KeyRound, Check, Shield, ShieldCheck, Users, Edit3,
    Trophy, Sparkles, Headphones, Award, Star, Zap, Rocket, CalendarCheck, Network
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { updateCollaboratorProfile } from '../../services/adminAuth';
import { useNotification } from '../../context/NotificationContext';
import { BADGES_CATALOG, calculateUserLevel, THIRD_PARTY_SCHEDULE_INFO } from '../../services/userProfile';

const BADGE_ICONS = {
    Trophy,
    Zap,
    Star,
    ShieldCheck,
    Rocket,
    CalendarCheck,
    Network,
    Award
};

const ROLE_CARDS = [
    { id: 'Colaborador', title: 'Colaborador', icon: User, badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    { id: 'Apoio', title: 'Apoio', icon: Users, badge: 'bg-blue-100 text-blue-800 border-blue-200' },
    { id: 'Supervisor', title: 'Supervisor', icon: ShieldCheck, badge: 'bg-amber-100 text-amber-800 border-amber-200' },
    { id: 'Gestor', title: 'Gestor', icon: Shield, badge: 'bg-red-100 text-red-700 border-red-200' }
];

const SHIFT_OPTIONS = [
    { id: 'Manhã I', label: 'Manhã I', hours: '08:00 até 14:15', icon: Sun },
    { id: 'Manhã II', label: 'Manhã II', hours: '09:00 até 15:15', icon: Sun },
    { id: 'Tarde', label: 'Tarde', hours: '11:00 até 17:15', icon: Sunset },
    { id: 'Noturno', label: 'Noturno', hours: '13:45 até 20:00', icon: Moon }
];

export const EditCollaboratorModal = ({ colab, onClose }) => {
    const { showToast } = useNotification();
    const initialShift = colab.shift === 'Manhã' ? 'Manhã I' : (colab.shift === 'Noite' ? 'Noturno' : (colab.shift || 'Manhã I'));
    const [formData, setFormData] = useState({
        name: colab.name || '',
        role: colab.role || 'Colaborador',
        shift: initialShift,
        active: colab.active !== false,
        badges: Array.isArray(colab.badges) ? colab.badges : ['top_tma', 'destaque_qa']
    });
    const [loading, setLoading] = useState(false);
    const [resetting, setResetting] = useState(false);

    const userLevel = calculateUserLevel(formData.badges);

    const handleToggleBadge = (badgeId) => {
        setFormData(prev => {
            const exists = prev.badges.includes(badgeId);
            const nextBadges = exists 
                ? prev.badges.filter(id => id !== badgeId)
                : [...prev.badges, badgeId];
            return { ...prev, badges: nextBadges };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateCollaboratorProfile(colab.id, {
                name: formData.name.trim(),
                role: formData.role,
                shift: formData.shift,
                active: formData.active,
                badges: formData.badges,
                status: formData.active ? 'Ativo' : 'Inativo'
            });
            showToast("Dados do colaborador e insígnias atualizados com sucesso!", "success");
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
        <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-3 sm:p-5 z-[70] backdrop-blur-xs">
            {/* Modal Formatado na Proporção 16:9 Widescreen (Altura Contida na Tela) */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
                
                {/* Header Fixo */}
                <div className="px-5 py-4 bg-zinc-950 flex justify-between items-center text-white border-b border-zinc-800 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                            <Edit3 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                                <span>Editar Perfil do Colaborador</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                                    16:9 View
                                </span>
                            </h2>
                            <p className="text-xs text-zinc-400">Atualize dados cadastrais, turno, cargo e emblemas de desempenho.</p>
                        </div>
                    </div>
                    <button 
                        type="button"
                        onClick={onClose} 
                        className="text-zinc-400 hover:text-white p-2 rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Fechar janela"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Conteúdo em Grid Horizontal 16:9 com Duas Colunas Equilibradas */}
                <form id="edit-colab-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 bg-gray-50/50">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                        
                        {/* COLUNA 1: DADOS CADASTRAIS, CARGO & TURNO */}
                        <div className="space-y-4">
                            
                            {/* Nome Completo */}
                            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">Nome Completo</label>
                                <div className="relative">
                                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                                    <input 
                                        type="text" 
                                        required 
                                        value={formData.name} 
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full pl-9 pr-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-600 outline-none text-sm transition-all"
                                        placeholder="Nome e Sobrenome"
                                    />
                                </div>
                            </div>

                            {/* Email (Apenas Leitura) */}
                            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">E-mail Corporativo (Identificador Auth)</label>
                                <div className="relative">
                                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                                    <input 
                                        type="email" 
                                        disabled 
                                        value={colab.email || ''} 
                                        className="w-full pl-9 pr-3.5 py-2 border border-gray-200 bg-gray-100 text-gray-500 rounded-xl outline-none cursor-not-allowed text-sm"
                                    />
                                </div>
                            </div>

                            {/* Cargo RBAC */}
                            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                                <label className="block text-xs font-bold text-gray-700">Cargo / Nível RBAC</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {ROLE_CARDS.map(r => {
                                        const Icon = r.icon;
                                        const isSelected = formData.role === r.id;
                                        return (
                                            <button
                                                type="button"
                                                key={r.id}
                                                onClick={() => setFormData({ ...formData, role: r.id })}
                                                className={`p-2 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                                                    isSelected 
                                                        ? 'border-red-600 bg-red-50/70 ring-1 ring-red-600 font-bold text-gray-900 shadow-2xs' 
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

                            {/* Turno de Trabalho Oficial */}
                            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                                <label className="block text-xs font-bold text-gray-700">Turno de Trabalho Oficial</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {SHIFT_OPTIONS.map(s => {
                                        const Icon = s.icon;
                                        const isSelected = formData.shift === s.id;
                                        return (
                                            <button
                                                type="button"
                                                key={s.id}
                                                onClick={() => setFormData({ ...formData, shift: s.id })}
                                                className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                                                    isSelected 
                                                        ? 'border-zinc-900 bg-zinc-900 text-white font-bold shadow-xs' 
                                                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                                                }`}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <Icon className="w-3.5 h-3.5" />
                                                    <span className="text-xs">{s.label}</span>
                                                </div>
                                                <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-zinc-300' : 'text-gray-400'}`}>
                                                    {s.hours}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Nota da Operação Noturna */}
                                <div className="p-2 bg-amber-50/80 border border-amber-200/80 rounded-lg flex items-center gap-2 text-[11px] text-amber-900">
                                    <Headphones className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>
                                        <strong>Operação Terceirizada:</strong> Das 20:00 às 08:00 o atendimento é mantido por equipe parceira.
                                    </span>
                                </div>
                            </div>

                        </div>

                        {/* COLUNA 2: EMBLEMAS, STATUS OPERACIONAL & SENHA */}
                        <div className="space-y-4">
                            
                            {/* Emblemas & Insígnias */}
                            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                                        <span>Emblemas & Insígnias (Gestão)</span>
                                    </label>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                                        <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                                        Nível {userLevel} de 8 ({formData.badges.length}/8)
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 p-2 bg-gray-50 rounded-xl border border-gray-200 max-h-48 overflow-y-auto">
                                    {BADGES_CATALOG.map(badge => {
                                        const IconComponent = BADGE_ICONS[badge.iconName] || Trophy;
                                        const isUnlocked = formData.badges.includes(badge.id);
                                        return (
                                            <button
                                                type="button"
                                                key={badge.id}
                                                onClick={() => handleToggleBadge(badge.id)}
                                                className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all cursor-pointer ${
                                                    isUnlocked
                                                        ? 'border-amber-400 bg-amber-50/90 text-gray-900 shadow-2xs font-semibold'
                                                        : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                                                }`}
                                            >
                                                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                                                    isUnlocked ? badge.bgColor : 'bg-gray-100 border-gray-200 text-gray-300'
                                                }`}>
                                                    <IconComponent className={`w-3 h-3 ${isUnlocked ? badge.textColor : 'text-gray-300'}`} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-[11px] block truncate">{badge.title}</span>
                                                </div>
                                                {isUnlocked && <Check className="w-3 h-3 text-amber-600 shrink-0 stroke-[2.5]" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Status Operacional */}
                            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs flex items-center justify-between">
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

                            {/* Box de Redefinição de Senha */}
                            <div className="p-3.5 bg-red-50/70 border border-red-200/80 rounded-xl flex items-center justify-between gap-3">
                                <div>
                                    <h4 className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                                        <KeyRound className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                        Redefinição de Senha
                                    </h4>
                                    <p className="text-[11px] text-red-700/80">Envia link seguro no e-mail cadastrado.</p>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={handleResetPassword}
                                    disabled={resetting}
                                    className="px-3 py-1.5 bg-white border border-red-200 text-red-700 hover:bg-red-600 hover:text-white rounded-lg transition-colors text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
                                >
                                    {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                                    <span>Enviar Link</span>
                                </button>
                            </div>

                        </div>

                    </div>
                </form>

                {/* Footer Fixo com Botões Visíveis sem Rolagem */}
                <div className="px-5 py-3.5 bg-gray-100/80 border-t border-gray-200 flex items-center justify-between shrink-0">
                    <div className="text-xs text-gray-500 font-mono hidden sm:block">
                        ID: <span className="font-semibold text-gray-700">{colab.id}</span>
                    </div>
                    <div className="flex items-center gap-2.5 ml-auto">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            disabled={loading}
                            className="px-4 py-2 border border-gray-300 bg-white text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            form="edit-colab-form"
                            disabled={loading}
                            className="px-6 py-2 bg-zinc-950 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Alterações'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
export default EditCollaboratorModal;
