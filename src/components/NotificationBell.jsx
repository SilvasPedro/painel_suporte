import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
    Bell, CheckCircle2, AlertTriangle, XCircle, Volume2, 
    VolumeX, Sparkles, Send, Play, ArrowRight, X, Info,
    Check, CheckCheck, Trash2, BellOff, MessageSquare,
    ClipboardList, RefreshCw, Clock, Filter
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

const formatNotificationTime = (timestamp) => {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = Math.max(0, now - timestamp);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Agora há pouco';
    if (minutes < 60) return `${minutes} min atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d atrás`;
    return new Date(timestamp).toLocaleDateString('pt-BR');
};

export const NotificationBell = () => {
    const { 
        permission, 
        requestPermission, 
        testNotification, 
        soundEnabled, 
        toggleSound,
        showToast,
        notificationHistory,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications,
        clearPulseHistory,
        clearPulseReports
    } = useNotification();
    const { currentUser } = useAuth();
    
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('recent'); // 'recent' | 'settings'
    const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
    const [isRequesting, setIsRequesting] = useState(false);
    const dropdownRef = useRef(null);

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

    // Filtra lista de histórico
    const filteredHistory = useMemo(() => {
        if (!Array.isArray(notificationHistory)) return [];
        if (filterUnreadOnly) {
            return notificationHistory.filter(item => !item.read);
        }
        return notificationHistory;
    }, [notificationHistory, filterUnreadOnly]);

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

    // Navega e abre o item correspondente ao clicar na notificação
    const handleNotificationClick = (item) => {
        // Marca como lida
        if (!item.read) {
            markAsRead(item.id);
        }

        if (item.type === 'feedback') {
            clearPulseHistory();
            window.dispatchEvent(new CustomEvent('HUBDESK_NAVIGATE_TAB', {
                detail: { tab: 'history', subtab: 'feedbacks' }
            }));
            if (item.data?.feedback) {
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('HUBDESK_OPEN_FEEDBACK', {
                        detail: { feedback: item.data.feedback }
                    }));
                }, 150);
            }
        } else if (item.type === 'report' || item.type === 'report_status') {
            clearPulseReports();
            window.dispatchEvent(new CustomEvent('HUBDESK_NAVIGATE_TAB', {
                detail: { tab: 'reports' }
            }));
            if (item.data?.report) {
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('HUBDESK_OPEN_REPORT', {
                        detail: { report: item.data.report }
                    }));
                }, 150);
            }
        } else if (item.data?.tab) {
            window.dispatchEvent(new CustomEvent('HUBDESK_NAVIGATE_TAB', {
                detail: { tab: item.data.tab }
            }));
        }

        setIsOpen(false);
    };

    // Simulador de Feedback
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
        setActiveTab('recent');
    };

    // Simulador de Novo Relatório
    const handleSimulateNewReport = () => {
        window.dispatchEvent(new CustomEvent('HUBDESK_SIMULATE_NEW_REPORT', {
            detail: {
                id: `sim-rep-${Date.now()}`,
                title: 'Lentidão no sistema de integração ERP',
                type: 'Falha Operacional',
                priority: 'Alta',
                protocol: 'DEM-9842',
                status: 'Pendente',
                creatorName: 'Eduardo Caetano',
                description: 'Identificado travamento recorrente durante consulta de protocolos de clientes.',
                date: new Date().toISOString().split('T')[0]
            }
        }));
        setActiveTab('recent');
    };

    // Simulador de Alteração de Status
    const handleSimulateStatusChange = () => {
        window.dispatchEvent(new CustomEvent('HUBDESK_SIMULATE_REPORT_STATUS', {
            detail: {
                id: `sim-status-${Date.now()}`,
                title: 'Ajuste de cadastro de cliente bloqueado',
                type: 'Análise de Erro',
                protocol: 'DEM-4120',
                status: 'Resolvido',
                adminComment: 'Ajuste concluído no banco de dados e acesso liberado com sucesso.'
            }
        }));
        setActiveTab('recent');
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
                title="Histórico de Notificações & Alertas"
                aria-label="Abrir central de notificações"
            >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />

                {/* Badge de Notificações Não Lidas ou Indicador de Status */}
                {unreadCount > 0 ? (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                ) : permission === 'granted' ? (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-zinc-900" />
                ) : permission === 'denied' ? (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-zinc-900" />
                ) : (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                )}
            </button>

            {/* PAINEL SUSPENSO (DROPDOWN MODERNO) */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-84 sm:w-96 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                    {/* CABEÇALHO DO PAINEL */}
                    <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center">
                                <Bell className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-white">Notificações</h3>
                                    {unreadCount > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-red-600 text-white">
                                            {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-zinc-400">Feedbacks & Tarefas em Tempo Real</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button 
                                    onClick={markAllAsRead}
                                    title="Marcar todas como lidas"
                                    className="text-xs text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="hidden sm:inline text-[10px]">Ler todas</span>
                                </button>
                            )}
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                                title="Fechar painel"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* ABAS DO PAINEL */}
                    <div className="flex border-b border-gray-100 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-900/60 p-1 gap-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab('recent')}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                activeTab === 'recent'
                                    ? 'bg-white dark:bg-zinc-800 text-red-600 dark:text-red-400 shadow-2xs'
                                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                            }`}
                        >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Histórico Recente</span>
                            {notificationHistory?.length > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                    unreadCount > 0 
                                        ? 'bg-red-500 text-white' 
                                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                                }`}>
                                    {notificationHistory.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('settings')}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                activeTab === 'settings'
                                    ? 'bg-white dark:bg-zinc-800 text-red-600 dark:text-red-400 shadow-2xs'
                                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                            }`}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Ajustes & Testes</span>
                        </button>
                    </div>

                    {/* CONTEÚDO DA ABA: HISTÓRICO RECENTE (v3.8.3) */}
                    {activeTab === 'recent' && (
                        <div className="p-3 space-y-3">
                            {/* Barra de Filtros e Ações do Histórico */}
                            {notificationHistory?.length > 0 && (
                                <div className="flex items-center justify-between text-xs px-1">
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setFilterUnreadOnly(false)}
                                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                                                !filterUnreadOnly
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                                                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                                            }`}
                                        >
                                            Todas ({notificationHistory.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFilterUnreadOnly(true)}
                                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                                                filterUnreadOnly
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                                                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                                            }`}
                                        >
                                            Não lidas ({unreadCount})
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={clearAllNotifications}
                                        className="text-[11px] text-zinc-400 hover:text-rose-500 transition-colors flex items-center gap-1 cursor-pointer"
                                        title="Limpar todas as notificações do histórico"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        <span>Limpar tudo</span>
                                    </button>
                                </div>
                            )}

                            {/* Lista de Notificações */}
                            {filteredHistory.length === 0 ? (
                                <div className="p-6 text-center space-y-3 bg-gray-50/50 dark:bg-zinc-800/30 rounded-xl border border-gray-100 dark:border-zinc-800/60">
                                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                                        <BellOff className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-800 dark:text-zinc-200">
                                            {filterUnreadOnly ? 'Nenhuma notificação não lida' : 'Histórico limpo'}
                                        </p>
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto">
                                            {filterUnreadOnly
                                                ? 'Você já leu todas as suas notificações recentes.'
                                                : 'Quando novos feedbacks forem lançados ou tarefas forem atualizadas, o histórico ficará salvo aqui.'}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleSimulateFeedback}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-all shadow-xs cursor-pointer"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        <span>Simular Notificação</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
                                    {filteredHistory.map((item) => {
                                        const isFeedback = item.type === 'feedback';
                                        const isReport = item.type === 'report';
                                        const isStatus = item.type === 'report_status';

                                        return (
                                            <div
                                                key={item.id}
                                                className={`group relative p-3 rounded-xl border transition-all text-left ${
                                                    !item.read
                                                        ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 shadow-2xs'
                                                        : 'bg-white dark:bg-zinc-800/60 border-gray-100 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700'
                                                }`}
                                            >
                                                <div className="flex items-start gap-2.5">
                                                    {/* Ícone de Categoria */}
                                                    <div 
                                                        onClick={() => handleNotificationClick(item)}
                                                        className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center cursor-pointer transition-transform group-hover:scale-105 ${
                                                            isFeedback
                                                                ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20'
                                                                : isReport
                                                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                                                : isStatus
                                                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                                                : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                                        }`}
                                                    >
                                                        {isFeedback && <MessageSquare className="w-4 h-4" />}
                                                        {isReport && <ClipboardList className="w-4 h-4" />}
                                                        {isStatus && <RefreshCw className="w-4 h-4" />}
                                                        {!isFeedback && !isReport && !isStatus && <Bell className="w-4 h-4" />}
                                                    </div>

                                                    {/* Conteúdo da Notificação */}
                                                    <div 
                                                        className="flex-1 min-w-0 cursor-pointer"
                                                        onClick={() => handleNotificationClick(item)}
                                                    >
                                                        <div className="flex items-center justify-between gap-1 mb-0.5">
                                                            <h4 className={`text-xs font-bold truncate ${
                                                                !item.read 
                                                                    ? 'text-gray-900 dark:text-white font-black' 
                                                                    : 'text-gray-700 dark:text-zinc-300'
                                                            }`}>
                                                                {item.title}
                                                            </h4>
                                                            <span className="text-[10px] text-zinc-400 shrink-0 font-medium whitespace-nowrap">
                                                                {formatNotificationTime(item.timestamp)}
                                                            </span>
                                                        </div>

                                                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                                                            {item.message}
                                                        </p>

                                                        {item.actionLabel && (
                                                            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline">
                                                                <span>{item.actionLabel}</span>
                                                                <ArrowRight className="w-3 h-3" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Ações: Marcar como lida e Apagar (v3.8.3) */}
                                                    <div className="flex flex-col gap-1 shrink-0 ml-1">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                markAsRead(item.id);
                                                            }}
                                                            className={`p-1 rounded-md transition-colors cursor-pointer ${
                                                                item.read
                                                                    ? 'text-zinc-300 dark:text-zinc-600 hover:text-zinc-500'
                                                                    : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                                                            }`}
                                                            title={item.read ? 'Notificação já lida' : 'Marcar como lida'}
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteNotification(item.id);
                                                            }}
                                                            className="p-1 rounded-md text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                                            title="Apagar do histórico"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* CONTEÚDO DA ABA: CONFIGURAÇÕES & TESTES */}
                    {activeTab === 'settings' && (
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
                                    <span>Simuladores de Validação</span>
                                </div>
                                <p className="text-[11px] text-zinc-400 leading-relaxed">
                                    Dispare alertas simulados para testar o popup nativo, gravação no histórico e a bolinha vermelha pulsante na barra lateral:
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
                                        title="Simular a chegada de um feedback para você (aciona bolinha em Meu Histórico)"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        <span>Feedback (Colab)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleSimulateNewReport}
                                        className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all border border-zinc-700 cursor-pointer"
                                        title="Simular notificação de novo relatório para usuários Gestores (aciona bolinha em Tarefas & Relatórios)"
                                    >
                                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                        <span>Novo Relatório (Gestor)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleSimulateStatusChange}
                                        className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all border border-zinc-700 cursor-pointer"
                                        title="Simular alteração de status para o solicitante (aciona bolinha em Tarefas & Relatórios)"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                                        <span>Status Alterado (Colab)</span>
                                    </button>
                                </div>
                            </div>

                            {/* DICA DE FLUXO v3.8.3 */}
                            <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 flex items-start gap-2 text-blue-900 dark:text-blue-300">
                                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                                <div className="text-[11px] leading-relaxed space-y-1">
                                    <p><strong>Atualização de Notificações (v3.8.3):</strong></p>
                                    <ul className="list-disc ml-3.5 space-y-0.5">
                                        <li><strong>Histórico Recente:</strong> Registra e preserva as notificações recebidas com ações de marcar como lida e apagar.</li>
                                        <li><strong>Bolinha Vermelha Pulsante na Barra Lateral:</strong> Aparece na opção <em>"Meu Histórico"</em> ao receber novo feedback, e na opção <em>"Tarefas & Relatórios"</em> para novos chamados ou alterações de status.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
