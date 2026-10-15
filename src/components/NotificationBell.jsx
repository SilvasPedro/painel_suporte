import React, { useState, useRef, useEffect } from 'react';
import { 
    Bell, CheckCircle2, AlertTriangle, XCircle, Volume2, 
    VolumeX, Sparkles, Send, Play, ShieldAlert, ArrowRight, X, Info
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { subscribeSharedCollection } from '../services/dataCache';

export const NotificationBell = () => {
    const { 
        permission, 
        requestPermission, 
        testNotification, 
        soundEnabled, 
        toggleSound,
        showToast
    } = useNotification();
    const { currentUser } = useAuth();
    
    const [isOpen, setIsOpen] = useState(false);
    const [isRequesting, setIsRequesting] = useState(false);
    const [unreadFeedbacksCount, setUnreadFeedbacksCount] = useState(0);
    const dropdownRef = useRef(null);

    // Escuta contagem de feedbacks não lidos para este usuário
    useEffect(() => {
        if (!currentUser) return;
        const currentUserId = currentUser.firestoreId || currentUser.uid;

        const unsubscribe = subscribeSharedCollection('feedbacks', (items) => {
            if (!Array.isArray(items)) return;
            const unread = items.filter(f => 
                (f.colabId === currentUserId || f.collaboratorId === currentUserId) && 
                !f.read
            ).length;
            setUnreadFeedbacksCount(unread);
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Fecha ao clicar fora
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleRequest = async () => {
        setIsRequesting(true);
        try {
            const res = await requestPermission(currentUser);
            if (res.status === 'granted') {
                showToast("Notificações ativadas com sucesso no navegador!", "success");
            } else if (res.status === 'denied') {
                showToast("Notificações foram bloqueadas pelo navegador.", "error");
            }
        } catch {
            showToast("Erro ao solicitar permissão de notificações.", "error");
        } finally {
            setIsRequesting(false);
        }
    };

    const handleSimulateFeedback = () => {
        const userName = currentUser?.name || 'Colaborador';
        window.dispatchEvent(new CustomEvent('HUBDESK_SIMULATE_FEEDBACK', {
            detail: {
                id: `sim-${Date.now()}`,
                type: 'Elogio',
                method: 'Sistema',
                colabName: userName,
                comment: `Excelente desempenho no fechamento das demandas críticas da equipe. Parabéns, ${userName}!`,
                createdBy: 'Coordenação de Suporte',
                date: new Date().toLocaleDateString('pt-BR'),
                createdAt: new Date().toISOString()
            }
        }));
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* BOTÃO DO SINO NO HEADER */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                    isOpen 
                        ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white' 
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800'
                }`}
                title="Notificações Push do Navegador"
                aria-label="Abrir central de notificações"
            >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />

                {/* Indicador de Status da Permissão ou Feedbacks Não Lidos */}
                {unreadFeedbacksCount > 0 ? (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
                        {unreadFeedbacksCount > 9 ? '9+' : unreadFeedbacksCount}
                    </span>
                ) : permission === 'granted' ? (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-zinc-900" />
                ) : permission === 'denied' ? (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-zinc-900" />
                ) : (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                )}
            </button>

            {/* PAINEL SUSPENSO (DROPDOWN) */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                    {/* CABEÇALHO DO PAINEL */}
                    <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center">
                                <Bell className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-wider text-white">Notificações Push</h3>
                                <p className="text-[10px] text-zinc-400">Alertas de Feedbacks & Chamados</p>
                            </div>
                        </div>

                        <button 
                            onClick={() => setIsOpen(false)}
                            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
                        {/* STATUS DA PERMISSÃO NO NAVEGADOR */}
                        <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                            permission === 'granted' 
                                ? 'bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200' 
                                : permission === 'denied'
                                ? 'bg-rose-50/80 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800/40 text-rose-900 dark:text-rose-200'
                                : 'bg-amber-50/80 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40 text-amber-900 dark:text-amber-200'
                        }`}>
                            <div className="shrink-0 mt-0.5">
                                {permission === 'granted' && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                                {permission === 'denied' && <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
                                {permission === 'default' && <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="text-[11px] font-black uppercase tracking-wider">
                                        {permission === 'granted' ? 'Notificações Ativas' : permission === 'denied' ? 'Bloqueadas pelo Navegador' : 'Aguardando Permissão'}
                                    </span>
                                </div>
                                <p className="text-xs leading-relaxed opacity-90">
                                    {permission === 'granted' 
                                        ? 'Você receberá avisos do navegador assim que um feedback for registrado para você, mesmo com a aba em segundo plano.' 
                                        : permission === 'denied'
                                        ? 'O navegador bloqueou as notificações. Para ativar, clique no ícone de cadeado na barra de endereços e altere para "Permitir".'
                                        : 'Ative as notificações para ser avisado no navegador quando a liderança lançar um feedback para o seu usuário.'}
                                </p>

                                {permission !== 'granted' && permission !== 'denied' && (
                                    <button
                                        type="button"
                                        onClick={handleRequest}
                                        disabled={isRequesting}
                                        className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-xs cursor-pointer"
                                    >
                                        <Bell className="w-3.5 h-3.5" />
                                        <span>{isRequesting ? 'Solicitando...' : 'Ativar no Navegador'}</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* CONFIGURAÇÃO DE SOM */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-200">
                                    {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <VolumeX className="w-4 h-4 text-zinc-400" />}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-900 dark:text-zinc-100">Sinal Sonoro</p>
                                    <p className="text-[10px] text-gray-500 dark:text-zinc-400">Tocar som suave ao receber notificação</p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => toggleSound()}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    soundEnabled 
                                        ? 'bg-emerald-600 text-white shadow-xs' 
                                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                                }`}
                            >
                                {soundEnabled ? 'Ligado' : 'Mudo'}
                            </button>
                        </div>

                        {/* ÁREA DE TESTE E VALIDAÇÃO */}
                        <div className="p-3.5 rounded-xl bg-zinc-900 dark:bg-zinc-950 text-white border border-zinc-800 space-y-2.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 uppercase tracking-wider">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                <span>Testar Funcionamento</span>
                            </div>
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                                Clique para validar se o seu navegador exibe o popup nativo e emite o alerta sonoro:
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={testNotification}
                                    className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all border border-zinc-700 cursor-pointer"
                                    title="Disparar notificação de teste"
                                >
                                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Testar Push</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSimulateFeedback}
                                    className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                                    title="Simular a chegada de um feedback para você"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Simular Feedback</span>
                                </button>
                            </div>
                        </div>

                        {/* DICA DE FLUXO */}
                        <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 flex items-start gap-2 text-blue-900 dark:text-blue-300">
                            <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                            <p className="text-[11px] leading-relaxed">
                                <strong>Como funciona na prática:</strong> Quando qualquer gestor lançar um Feedback (Elogio, Ponto de Melhoria ou Orientação) para você, o navegador exibirá o aviso nativo imediatamente e um clique levará direto para o detalhe do feedback.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
