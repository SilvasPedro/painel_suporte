import React, { useState } from 'react';
import { 
    UserPlus, X, Loader2, User, Mail, Lock, Eye, EyeOff, 
    Shield, ShieldCheck, CheckCircle, Users, Sun, Sunset, Moon, 
    AlertCircle, Check
} from 'lucide-react';
import { registerCollaborator } from '../../services/adminAuth';
import { useNotification } from '../../context/NotificationContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

const ROLE_CARDS = [
    {
        id: 'Colaborador',
        roleKey: 'colaborador',
        title: 'Colaborador',
        tag: 'Analista',
        description: 'Acesso padrão. Visualiza escalas, organograma e rankings operacionais.',
        color: 'border-emerald-500 bg-emerald-50/50 text-emerald-900',
        activeRing: 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/60',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        icon: User
    },
    {
        id: 'Apoio',
        roleKey: 'apoio',
        title: 'Apoio',
        tag: 'Operação',
        description: 'Monitoria diária, acompanhamento de filas e lançamento de escalas.',
        color: 'border-blue-500 bg-blue-50/50 text-blue-900',
        activeRing: 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/60',
        badge: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: Users
    },
    {
        id: 'Supervisor',
        roleKey: 'supervisor',
        title: 'Supervisor',
        tag: 'Liderança',
        description: 'Auditorias de qualidade (QA), acompanhamento de metas e feedbacks.',
        color: 'border-amber-500 bg-amber-50/50 text-amber-900',
        activeRing: 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/60',
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: ShieldCheck
    },
    {
        id: 'Gestor',
        roleKey: 'gestor',
        title: 'Gestor',
        tag: 'Executivo',
        description: 'Controle total. Edição de matriz RBAC, metas, métricas e auditorias.',
        color: 'border-red-500 bg-red-50/50 text-red-900',
        activeRing: 'ring-2 ring-red-500 border-red-500 bg-red-50/60',
        badge: 'bg-red-100 text-red-700 border-red-200',
        icon: Shield
    }
];

const SHIFT_OPTIONS = [
    {
        id: 'Manhã',
        label: 'Manhã',
        hours: '06:00 às 14:00',
        icon: Sun,
        activeClass: 'border-amber-500 bg-amber-50/70 text-amber-950 ring-2 ring-amber-400'
    },
    {
        id: 'Tarde',
        label: 'Tarde',
        hours: '14:00 às 22:00',
        icon: Sunset,
        activeClass: 'border-orange-500 bg-orange-50/70 text-orange-950 ring-2 ring-orange-400'
    },
    {
        id: 'Noite',
        label: 'Noite',
        hours: '22:00 às 06:00',
        icon: Moon,
        activeClass: 'border-zinc-900 bg-zinc-100 text-zinc-950 ring-2 ring-zinc-800'
    }
];

export const CreateCollaboratorModal = ({ onClose, onSuccess }) => {
    const { showToast } = useNotification();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'Colaborador',
        shift: 'Manhã',
        active: true
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!formData.name.trim()) {
            setErrorMsg('Por favor, informe o nome completo.');
            return;
        }
        if (!formData.email.trim()) {
            setErrorMsg('Por favor, informe o e-mail corporativo.');
            return;
        }
        if (!formData.password || formData.password.length < 6) {
            setErrorMsg('A senha provisória deve ter no mínimo 6 caracteres.');
            return;
        }

        setLoading(true);
        try {
            const result = await registerCollaborator(
                formData.name.trim(),
                formData.email.trim().toLowerCase(),
                formData.password,
                formData.role,
                formData.shift
            );

            // Garante o status ativo/inativo salvo
            if (result?.uid && formData.active === false) {
                await updateDoc(doc(db, "collaborators", result.uid), {
                    active: false,
                    status: "Inativo"
                });
            } else if (result?.uid) {
                await updateDoc(doc(db, "collaborators", result.uid), {
                    active: true,
                    status: "Ativo"
                });
            }

            showToast("Colaborador cadastrado com sucesso!", "success");
            onSuccess();
        } catch (error) {
            const msg = error.message || "Erro ao cadastrar colaborador.";
            setErrorMsg(msg);
            showToast(msg, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-zinc-950/60 flex items-center justify-center p-4 z-[70] backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-8 border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
                {/* Header Moderno no tema do sistema */}
                <div className="p-6 bg-zinc-950 flex justify-between items-start text-white border-b border-zinc-800">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-xs">
                            <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-white">Cadastrar Novo Colaborador</h2>
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                                    Equipe
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Crie a conta de acesso e atribua o papel (RBAC) e o turno de trabalho.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800/80 transition-colors"
                        title="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {errorMsg && (
                    <div className="mx-6 mt-6 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                        <span className="font-medium">{errorMsg}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* SEÇÃO 1: DADOS PESSOAIS E CREDENCIAIS */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            1. Informações de Identificação e Login
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                    Nome Completo <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="Ex: Carlos Eduardo de Souza"
                                        value={formData.name} 
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50/50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none text-sm transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                    E-mail Corporativo (Login) <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                                    <input 
                                        type="email" 
                                        required 
                                        placeholder="carlos.souza@empresa.com"
                                        value={formData.email} 
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50/50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none text-sm transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-xs font-bold text-gray-700">
                                        Senha Provisória <span className="text-red-500">*</span>
                                    </label>
                                    <span className="text-[10px] text-gray-400 font-medium">Mínimo 6 dígitos</span>
                                </div>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        required 
                                        minLength={6}
                                        placeholder="••••••••"
                                        value={formData.password} 
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full pl-9 pr-10 py-2.5 bg-gray-50/50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none text-sm transition-all font-mono"
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SEÇÃO 2: PAPEL NO SISTEMA (RBAC) */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Shield className="w-3.5 h-3.5 text-gray-400" />
                                2. Cargo & Perfil de Acesso (RBAC)
                            </h3>
                            <span className="text-[11px] text-gray-500">
                                Selecionado: <strong className="text-gray-800">{formData.role}</strong>
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {ROLE_CARDS.map(r => {
                                const Icon = r.icon;
                                const isSelected = formData.role === r.id;
                                return (
                                    <button
                                        type="button"
                                        key={r.id}
                                        onClick={() => setFormData({ ...formData, role: r.id })}
                                        className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                                            isSelected 
                                                ? r.activeRing 
                                                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${r.badge}`}>
                                                    <Icon className="w-4 h-4" />
                                                </div>
                                                <span className="font-bold text-sm text-gray-900">{r.title}</span>
                                            </div>
                                            {isSelected && (
                                                <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px]">
                                                    <Check className="w-3 h-3 stroke-[3]" />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-gray-500 leading-snug">
                                            {r.description}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* SEÇÃO 3: TURNO DE TRABALHO */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Sun className="w-3.5 h-3.5 text-gray-400" />
                            3. Turno de Trabalho
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            {SHIFT_OPTIONS.map(s => {
                                const Icon = s.icon;
                                const isSelected = formData.shift === s.id;
                                return (
                                    <button
                                        type="button"
                                        key={s.id}
                                        onClick={() => setFormData({ ...formData, shift: s.id })}
                                        className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                                            isSelected 
                                                ? s.activeClass 
                                                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50 text-gray-700'
                                        }`}
                                    >
                                        <Icon className={`w-5 h-5 mb-1 ${
                                            s.id === 'Manhã' ? 'text-amber-500' :
                                            s.id === 'Tarde' ? 'text-orange-500' : 'text-zinc-800'
                                        }`} />
                                        <span className="font-bold text-xs">{s.label}</span>
                                        <span className="text-[10px] text-gray-400 mt-0.5">{s.hours}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* SEÇÃO 4: STATUS OPERACIONAL */}
                    <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                        <div>
                            <span className="text-xs font-bold text-gray-800 block">Status Operacional Inicial</span>
                            <span className="text-[11px] text-gray-500">
                                {formData.active 
                                    ? 'Colaborador ativo e visível nas escalas, rankings e relatórios.' 
                                    : 'Colaborador inativo (apenas arquivado no sistema).'}
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

                    {/* FOOTER COM BOTÕES */}
                    <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            disabled={loading}
                            className="px-5 py-2.5 border border-gray-300 text-gray-700 font-semibold text-xs rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Cadastrando...</span>
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4" />
                                    <span>Cadastrar Colaborador</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
export default CreateCollaboratorModal;
