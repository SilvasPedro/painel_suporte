import React, { useState } from 'react';
import { 
    X, Loader2, MessageSquare, ThumbsUp, AlertTriangle, HelpCircle, 
    Monitor, Phone, MessageCircle, Building2, User
} from 'lucide-react';
import { registerFeedback } from '../../services/adminAuth';
import { useNotification } from '../../context/NotificationContext';

const FEEDBACK_TYPES = [
    { id: 'Elogio', label: 'Elogio', icon: ThumbsUp, color: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
    { id: 'Ponto de Melhoria', label: 'Ponto de Melhoria', icon: AlertTriangle, color: 'border-amber-500 bg-amber-50 text-amber-800' },
    { id: 'Orientação', label: 'Orientação', icon: HelpCircle, color: 'border-blue-500 bg-blue-50 text-blue-800' }
];

const METHODS = [
    { id: 'Presencial', label: 'Presencial', icon: Building2 },
    { id: 'Telefonia', label: 'Telefonia', icon: Phone },
    { id: 'Chat', label: 'Chat', icon: MessageCircle },
    { id: 'Sistema', label: 'Sistema', icon: Monitor }
];

export const FeedbackModal = ({ colab, onClose }) => {
    const { showToast } = useNotification();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        type: 'Elogio',
        method: 'Presencial',
        protocol: '',
        comment: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.comment.trim()) {
            showToast("Informe as observações do feedback.", "error");
            return;
        }

        setLoading(true);
        try {
            await registerFeedback(colab.id, formData);
            showToast("Feedback registrado com sucesso!", "success");
            onClose();
        } catch (error) {
            showToast("Erro ao registrar feedback: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-zinc-950/60 flex items-center justify-center p-4 z-[70] backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden my-8 border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="p-5 bg-red-600 flex justify-between items-center text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Registrar Feedback</h2>
                            <p className="text-xs text-red-100 flex items-center gap-1.5 mt-0.5">
                                <User className="w-3.5 h-3.5" /> Colaborador: <span className="font-semibold text-white">{colab.name}</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-red-200 hover:text-white p-1 rounded-lg hover:bg-red-700 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Tipo de Feedback */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">Tipo de Feedback</label>
                        <div className="grid grid-cols-3 gap-2.5">
                            {FEEDBACK_TYPES.map(t => {
                                const Icon = t.icon;
                                const isSelected = formData.type === t.id;
                                return (
                                    <button
                                        type="button"
                                        key={t.id}
                                        onClick={() => setFormData({ ...formData, type: t.id })}
                                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                                            isSelected 
                                                ? `${t.color} font-bold ring-2 ring-red-600/30` 
                                                : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span className="text-xs">{t.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Meio de Observação */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">Canal / Meio de Observação</label>
                        <div className="grid grid-cols-4 gap-2">
                            {METHODS.map(m => {
                                const Icon = m.icon;
                                const isSelected = formData.method === m.id;
                                return (
                                    <button
                                        type="button"
                                        key={m.id}
                                        onClick={() => setFormData({ ...formData, method: m.id })}
                                        className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                                            isSelected 
                                                ? 'border-zinc-900 bg-zinc-900 text-white font-bold' 
                                                : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span className="text-[11px]">{m.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Protocolo Opcional */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">
                            Protocolo / Referência de Chamado <span className="text-gray-400 font-normal text-[11px]">(Opcional)</span>
                        </label>
                        <input 
                            type="text" 
                            placeholder="Ex: 20260919-0412" 
                            value={formData.protocol}
                            onChange={e => setFormData({ ...formData, protocol: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-600 outline-none text-sm"
                        />
                    </div>

                    {/* Comentários */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">
                            Comentários & Recomendações <span className="text-red-500">*</span>
                        </label>
                        <textarea 
                            required 
                            rows="4" 
                            placeholder="Descreva o contexto do feedback, pontos observados e orientações alinhadas com o colaborador..." 
                            value={formData.comment}
                            onChange={e => setFormData({ ...formData, comment: e.target.value })}
                            className="w-full p-3 bg-gray-50/50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-600 outline-none text-sm resize-none"
                        />
                    </div>

                    {/* Footer */}
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
                            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar Feedback'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
export default FeedbackModal;
