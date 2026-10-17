import React, { useState, useEffect } from 'react';
import { 
    X, Loader2, MessageSquare, ThumbsUp, AlertTriangle, HelpCircle, 
    Monitor, Phone, MessageCircle, Building2, User, Tag, Check, 
    Sparkles, Clock, CheckCircle2, Hash
} from 'lucide-react';
import { registerFeedback } from '../../services/adminAuth';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { subscribeFeedbackTags, DEFAULT_FEEDBACK_TAGS } from '../../services/feedbackTags';

const FEEDBACK_TYPES = [
    { 
        id: 'Elogio', 
        label: 'Elogio', 
        icon: ThumbsUp, 
        color: 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/60',
        activeRing: 'ring-2 ring-emerald-500/40 bg-emerald-100 text-emerald-900 font-bold border-emerald-500'
    },
    { 
        id: 'Orientação', 
        label: 'Orientação', 
        icon: HelpCircle, 
        color: 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700/60',
        activeRing: 'ring-2 ring-blue-500/40 bg-blue-100 text-blue-900 font-bold border-blue-500'
    },
    { 
        id: 'Ponto de Melhoria', 
        label: 'Ponto de Melhoria', 
        icon: AlertTriangle, 
        color: 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/60',
        activeRing: 'ring-2 ring-amber-500/40 bg-amber-100 text-amber-900 font-bold border-amber-500'
    }
];

const METHODS = [
    { id: 'Presencial', label: 'Presencial', icon: Building2 },
    { id: 'Telefonia', label: 'Telefonia', icon: Phone },
    { id: 'Chat', label: 'Chat', icon: MessageCircle },
    { id: 'Sistema (ERP)', label: 'Sistema (ERP)', icon: Monitor }
];

export const FeedbackModal = ({ colab, onClose }) => {
    const { currentUser } = useAuth();
    const { showToast } = useNotification();
    const [loading, setLoading] = useState(false);

    // Tags carregadas dinamicamente
    const [availableTags, setAvailableTags] = useState(DEFAULT_FEEDBACK_TAGS);

    // Estados do Formulário Estruturado (v3.8.4)
    const [type, setType] = useState('Elogio');
    const [method, setMethod] = useState('Presencial');
    const [hasProtocol, setHasProtocol] = useState(null); // Desmarcado por padrão (null), obrigatório selecionar Sim ou Não
    const [protocol, setProtocol] = useState('');

    // Campos Condicionais
    const [praiseReason, setPraiseReason] = useState('');
    const [guidanceText, setGuidanceText] = useState('');
    const [improvementError, setImprovementError] = useState('');
    const [improvementCorrect, setImprovementCorrect] = useState('');
    const [improvementDeadline, setImprovementDeadline] = useState('');

    // Tags selecionadas
    const [selectedTags, setSelectedTags] = useState([]);

    useEffect(() => {
        const unsub = subscribeFeedbackTags((freshTags) => {
            if (Array.isArray(freshTags) && freshTags.length > 0) {
                setAvailableTags(freshTags);
            }
        });
        return () => unsub();
    }, []);

    const toggleTag = (tagName) => {
        setSelectedTags(prev => 
            prev.includes(tagName)
                ? prev.filter(t => t !== tagName)
                : [...prev, tagName]
        );
    };

    const buildUnifiedComment = () => {
        if (type === 'Elogio') {
            return praiseReason.trim();
        }
        if (type === 'Orientação') {
            return guidanceText.trim();
        }
        if (type === 'Ponto de Melhoria') {
            const parts = [];
            if (improvementError.trim()) {
                parts.push(`**Erro / Oportunidade Observada:**\n${improvementError.trim()}`);
            }
            if (improvementCorrect.trim()) {
                parts.push(`**Conduta Correta Recomendada:**\n${improvementCorrect.trim()}`);
            }
            if (improvementDeadline.trim()) {
                parts.push(`**Prazo para Aplicação:** ${improvementDeadline.trim()}`);
            }
            return parts.join('\n\n');
        }
        return '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validação obrigatória da seleção do switch (Sim / Não)
        if (hasProtocol === null) {
            showToast("Por favor, selecione se possui Protocolo ou ID (Sim ou Não).", "error");
            return;
        }

        // Validação de Protocolo quando marcado como "Sim"
        if (hasProtocol && !protocol.trim()) {
            showToast("Informe o número do Protocolo ou ID.", "error");
            return;
        }

        // Validação condicional por tipo
        if (type === 'Elogio' && !praiseReason.trim()) {
            showToast("Por favor, descreva o motivo do elogio.", "error");
            return;
        }

        if (type === 'Orientação' && !guidanceText.trim()) {
            showToast("Por favor, registre a orientação repassada ao colaborador.", "error");
            return;
        }

        if (type === 'Ponto de Melhoria') {
            if (!improvementError.trim()) {
                showToast("Descreva qual foi o erro / oportunidade identificada.", "error");
                return;
            }
            if (!improvementCorrect.trim()) {
                showToast("Descreva qual seria a forma correta de proceder.", "error");
                return;
            }
            if (!improvementDeadline.trim()) {
                showToast("Informe o prazo para aplicação da solução.", "error");
                return;
            }
        }

        setLoading(true);
        try {
            const unifiedComment = buildUnifiedComment();

            const feedbackPayload = {
                type,
                method,
                hasProtocol,
                protocol: hasProtocol ? protocol.trim() : 'N/A',
                praiseReason: type === 'Elogio' ? praiseReason.trim() : '',
                guidanceText: type === 'Orientação' ? guidanceText.trim() : '',
                improvementError: type === 'Ponto de Melhoria' ? improvementError.trim() : '',
                improvementCorrect: type === 'Ponto de Melhoria' ? improvementCorrect.trim() : '',
                improvementDeadline: type === 'Ponto de Melhoria' ? improvementDeadline.trim() : '',
                tags: selectedTags,
                comment: unifiedComment
            };

            await registerFeedback(colab.id, feedbackPayload, currentUser);
            showToast("Feedback registrado com sucesso!", "success");
            onClose();
        } catch (error) {
            showToast("Erro ao registrar feedback: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-3 sm:p-5 z-[80] backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-6 border border-gray-100 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
                
                {/* Header do Modal */}
                <div className="p-5 bg-gradient-to-r from-red-600 via-red-700 to-red-600 text-white flex justify-between items-center shrink-0 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white border border-white/20 shadow-inner">
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-white">Lançar Novo Feedback</h2>
                                <span className="text-[10px] uppercase font-mono font-bold bg-white/20 text-white px-2 py-0.5 rounded-full border border-white/25">
                                    v3.8.4
                                </span>
                            </div>
                            <p className="text-xs text-red-100 flex items-center gap-1.5 mt-0.5">
                                <User className="w-3.5 h-3.5" /> Colaborador: <span className="font-bold text-white underline decoration-white/40">{colab.name}</span>
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button"
                        onClick={onClose} 
                        className="text-red-200 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                        title="Fechar janela"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Conteúdo com Scroll */}
                <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-5 bg-white">
                    
                    {/* 1. TIPO DE FEEDBACK */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-red-600" />
                                1. Tipo de Feedback <span className="text-red-500">*</span>
                            </label>
                            <span className="text-[11px] text-gray-400 font-medium">Selecione uma categoria</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {FEEDBACK_TYPES.map(t => {
                                const Icon = t.icon;
                                const isSelected = type === t.id;
                                return (
                                    <button
                                        type="button"
                                        key={t.id}
                                        onClick={() => setType(t.id)}
                                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                            isSelected 
                                                ? t.activeRing
                                                : 'border-gray-200 bg-gray-50/50 hover:bg-gray-100/80 text-gray-700'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                            isSelected ? 'bg-white shadow-2xs' : 'bg-gray-200/60'
                                        }`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <span className="text-xs font-bold">{t.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. CANAL / MEIO DE OBSERVAÇÃO */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                                <Monitor className="w-3.5 h-3.5 text-gray-600" />
                                2. Canal / Meio de Observação <span className="text-red-500">*</span>
                            </label>
                            <span className="text-[11px] text-gray-400 font-medium">Onde foi observado</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {METHODS.map(m => {
                                const Icon = m.icon;
                                const isSelected = method === m.id;
                                return (
                                    <button
                                        type="button"
                                        key={m.id}
                                        onClick={() => setMethod(m.id)}
                                        className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                            isSelected 
                                                ? 'border-zinc-950 bg-zinc-950 text-white font-bold shadow-xs' 
                                                : 'border-gray-200 bg-gray-50/50 hover:bg-gray-100/80 text-gray-700'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4 shrink-0" />
                                        <span className="text-xs">{m.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 3. POSSUI PROTOCOLO OU ID? (SWITCH BUTTON SIM/NÃO - OBRIGATÓRIO SELECIONAR) */}
                    <div className={`p-4 rounded-xl border transition-all space-y-3 ${
                        hasProtocol === null 
                            ? 'border-amber-300 bg-amber-50/40' 
                            : 'border-gray-200 bg-gray-50/50'
                    }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-800 block">
                                        Possui Protocolo ou ID? <span className="text-red-500">*</span>
                                    </span>
                                    {hasProtocol === null && (
                                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md animate-pulse">
                                            Obrigatório selecionar
                                        </span>
                                    )}
                                </div>
                                <span className="text-[11px] text-gray-500 block mt-0.5">
                                    Ative caso o apontamento esteja atrelado a um chamado ou protocolo de atendimento.
                                </span>
                            </div>

                            {/* Switch Button Sim / Não Segmentado e Acessível */}
                            <div className="flex items-center gap-1.5 p-1 bg-gray-200/70 rounded-xl self-start sm:self-auto shrink-0 border border-gray-300/60">
                                <button
                                    type="button"
                                    onClick={() => setHasProtocol(false)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        hasProtocol === false
                                            ? 'bg-zinc-900 text-white shadow-xs'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                                    }`}
                                >
                                    Não
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setHasProtocol(true)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        hasProtocol === true
                                            ? 'bg-red-600 text-white shadow-xs'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                                    }`}
                                >
                                    Sim
                                </button>
                            </div>
                        </div>

                        {/* Campo condicional que abre se Sim */}
                        {hasProtocol && (
                            <div className="pt-2 border-t border-gray-200/80 animate-in fade-in slide-in-from-top-1 duration-150">
                                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                                    <Hash className="w-3.5 h-3.5 text-red-600" />
                                    Informe o Protocolo ou ID <span className="text-red-500">*</span>
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="Ex: 2610.9842 ou ID #1042" 
                                    value={protocol}
                                    onChange={e => setProtocol(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl focus:border-red-600 focus:ring-2 focus:ring-red-600/20 outline-none text-sm font-mono font-medium"
                                    autoFocus
                                    required={hasProtocol}
                                />
                            </div>
                        )}
                    </div>

                    {/* 4. CAMPOS CONDICIONAIS PELO TIPO DE FEEDBACK */}
                    <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-4">
                        {/* Se for ELOGIO */}
                        {type === 'Elogio' && (
                            <div className="space-y-2 animate-in fade-in duration-150">
                                <label className="block text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                                    <ThumbsUp className="w-4 h-4 text-emerald-600" />
                                    Motivo do Elogio <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    required
                                    rows="4"
                                    placeholder="Explique o motivo do reconhecimento, o comportamento destacado e o impacto positivo gerado para o cliente e para a equipe..."
                                    value={praiseReason}
                                    onChange={e => setPraiseReason(e.target.value)}
                                    className="w-full p-3 bg-emerald-50/30 border border-emerald-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none text-sm leading-relaxed"
                                />
                            </div>
                        )}

                        {/* Se for ORIENTAÇÃO */}
                        {type === 'Orientação' && (
                            <div className="space-y-2 animate-in fade-in duration-150">
                                <label className="block text-xs font-bold text-blue-900 flex items-center gap-1.5">
                                    <HelpCircle className="w-4 h-4 text-blue-600" />
                                    Orientação Passada ao Colaborador <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    required
                                    rows="4"
                                    placeholder="Descreva detalhadamente a orientação repassada, fluxos a serem seguidos e diretrizes para os atendimentos futuros..."
                                    value={guidanceText}
                                    onChange={e => setGuidanceText(e.target.value)}
                                    className="w-full p-3 bg-blue-50/30 border border-blue-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none text-sm leading-relaxed"
                                />
                            </div>
                        )}

                        {/* Se for PONTO DE MELHORIA (3 CAMPOS) */}
                        {type === 'Ponto de Melhoria' && (
                            <div className="space-y-4 animate-in fade-in duration-150">
                                {/* Campo 1: Erro observado */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                                        Qual foi o erro / oportunidade identificada? <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        required
                                        rows="3"
                                        placeholder="Descreva a falha, desvio de padrão ou ponto fraco observado no atendimento ou processo..."
                                        value={improvementError}
                                        onChange={e => setImprovementError(e.target.value)}
                                        className="w-full p-3 bg-amber-50/30 border border-amber-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none text-sm leading-relaxed"
                                    />
                                </div>

                                {/* Campo 2: Conduta correta */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        Qual seria a forma correta de proceder? <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        required
                                        rows="3"
                                        placeholder="Explique o padrão oficial, como o colaborador deve agir em situações semelhantes e a conduta esperada..."
                                        value={improvementCorrect}
                                        onChange={e => setImprovementCorrect(e.target.value)}
                                        className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 outline-none text-sm leading-relaxed"
                                    />
                                </div>

                                {/* Campo 3: Prazo para aplicação da solução (texto simples) */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                        <Clock className="w-4 h-4 text-red-600" />
                                        Prazo para aplicação da solução <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Imediato, Próximo atendimento, Até 24h, 7 dias úteis..."
                                        value={improvementDeadline}
                                        onChange={e => setImprovementDeadline(e.target.value)}
                                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-600/30 focus:border-red-600 outline-none text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 5. TAGS DO FEEDBACK */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5 text-red-600" />
                                Tags & Competências
                            </label>
                            <span className="text-[11px] text-gray-400">
                                {selectedTags.length > 0 ? `${selectedTags.length} selecionada(s)` : 'Opcional, selecione tags'}
                            </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {availableTags.map(tagName => {
                                const isSelected = selectedTags.includes(tagName);
                                return (
                                    <button
                                        type="button"
                                        key={tagName}
                                        onClick={() => toggleTag(tagName)}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                            isSelected 
                                                ? 'bg-red-600 text-white border-red-600 shadow-xs' 
                                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                                        }`}
                                    >
                                        {isSelected && <Check className="w-3.5 h-3.5" />}
                                        <span>{tagName}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Rodapé com Botões de Ação */}
                    <div className="pt-3 flex items-center justify-end gap-3 border-t border-gray-100">
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
