import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { subscribeSharedCollection } from '../services/dataCache';
import { registerMessagingServiceWorker } from '../services/browserNotifications';

/**
 * Componente invisível de escuta em tempo real para Notificações Push do Navegador
 * Monitora coleções (Feedbacks e Chamados) e notifica o usuário instantaneamente
 */
export const NotificationManager = () => {
    const { currentUser, isInactive } = useAuth();
    const { notify, requestPermission } = useNotification();
    
    // Rastreia IDs já conhecidos para evitar spam em carregamento inicial
    const knownFeedbackIds = useRef(new Set());
    const isFeedbackInitialized = useRef(false);

    // 1. Registra o Service Worker e solicita permissão de forma amigável
    useEffect(() => {
        if (!currentUser || isInactive || currentUser.isInactive) return;

        registerMessagingServiceWorker();

        // Se a permissão ainda for default (não perguntada), solicita suavemente
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            // Aguarda 3 segundos após o login para não ser intrusivo
            const timer = setTimeout(() => {
                requestPermission(currentUser).catch(() => {});
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [currentUser, isInactive, requestPermission]);

    // 2. Função utilitária para abrir o feedback na tela do colaborador
    const openFeedbackInApp = (feedbackItem) => {
        if (typeof window === 'undefined') return;
        
        window.focus();

        // Dispara evento de navegação para a aba "Meu Histórico"
        window.dispatchEvent(new CustomEvent('HUBDESK_NAVIGATE_TAB', {
            detail: { tab: 'history', subtab: 'feedbacks' }
        }));

        // Dispara evento para abrir o modal do feedback específico
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('HUBDESK_OPEN_FEEDBACK', {
                detail: { feedback: feedbackItem }
            }));
        }, 150);
    };

    // 3. Ouve mensagens postadas pelo Service Worker (ao clicar na notificação nativa do sistema)
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleServiceWorkerMessage = (event) => {
            if (event.data?.type === 'HUBDESK_NOTIFICATION_CLICK') {
                const notifData = event.data?.data;
                if (notifData?.feedback) {
                    openFeedbackInApp(notifData.feedback);
                } else {
                    window.dispatchEvent(new CustomEvent('HUBDESK_NAVIGATE_TAB', {
                        detail: { tab: 'history', subtab: 'feedbacks' }
                    }));
                }
            }
        };

        const handleWindowNotificationClick = (event) => {
            const data = event.detail;
            if (data?.feedback) {
                openFeedbackInApp(data.feedback);
            } else if (data?.tab) {
                window.dispatchEvent(new CustomEvent('HUBDESK_NAVIGATE_TAB', {
                    detail: { tab: data.tab }
                }));
            }
        };

        // Ouvinte para simulação manual de teste pelo usuário
        const handleSimulateFeedback = (event) => {
            const simulated = event.detail || {
                id: `sim-${Date.now()}`,
                type: 'Elogio',
                method: 'Sistema',
                comment: 'Parabéns pela dedicação e agilidade no atendimento às demandas críticas do setor!',
                createdBy: 'Liderança HubDesk',
                date: new Date().toLocaleDateString('pt-BR'),
                createdAt: new Date().toISOString()
            };

            notify({
                title: `📢 Novo Feedback: ${simulated.type}`,
                body: `De: ${simulated.createdBy || 'Gestão'}\n"${simulated.comment}"`,
                type: 'feedback',
                tag: `feedback-sim-${Date.now()}`,
                data: { feedback: simulated, type: 'feedback' },
                action: {
                    label: 'Ver Feedback',
                    onClick: () => openFeedbackInApp(simulated)
                },
                onClick: () => openFeedbackInApp(simulated)
            });
        };

        navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
        window.addEventListener('HUBDESK_OPEN_NOTIFICATION', handleWindowNotificationClick);
        window.addEventListener('HUBDESK_SIMULATE_FEEDBACK', handleSimulateFeedback);

        return () => {
            navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
            window.removeEventListener('HUBDESK_OPEN_NOTIFICATION', handleWindowNotificationClick);
            window.removeEventListener('HUBDESK_SIMULATE_FEEDBACK', handleSimulateFeedback);
        };
    }, [notify]);

    // 4. Escuta em TEMPO REAL a coleção 'feedbacks' no Firestore
    useEffect(() => {
        if (!currentUser || isInactive || currentUser.isInactive) return;

        const currentUserId = currentUser.firestoreId || currentUser.uid;
        const currentEmail = currentUser.email?.toLowerCase();
        const currentName = currentUser.name?.trim().toLowerCase();

        const isTargetUser = (item) => {
            if (!item) return false;
            if (currentUserId && (item.colabId === currentUserId || item.collaboratorId === currentUserId)) return true;
            if (currentEmail && (item.colabEmail?.toLowerCase() === currentEmail || item.email?.toLowerCase() === currentEmail)) return true;
            if (currentName && (item.colabName?.toLowerCase() === currentName || item.collaboratorName?.toLowerCase() === currentName)) return true;
            return false;
        };

        const unsubscribe = subscribeSharedCollection('feedbacks', (items) => {
            if (!Array.isArray(items)) return;

            // Primeira execução: popula a lista de IDs existentes sem disparar notificações em massa
            if (!isFeedbackInitialized.current) {
                items.forEach(item => {
                    if (item.id) knownFeedbackIds.current.add(item.id);
                });
                isFeedbackInitialized.current = true;
                return;
            }

            // Execuções subsequentes: identifica feedbacks NOVOS criados para este colaborador
            items.forEach((item) => {
                if (!item || !item.id) return;

                const isKnown = knownFeedbackIds.current.has(item.id);
                if (isKnown) return;

                // Registra ID para não notificar duas vezes
                knownFeedbackIds.current.add(item.id);

                // Verifica se o feedback é direcionado a este usuário
                if (isTargetUser(item)) {
                    // Não notifica se foi criado por ele mesmo
                    if (currentEmail && item.createdBy && item.createdBy.toLowerCase() === currentEmail) {
                        return;
                    }

                    // Dispara a Notificação Push no Navegador + Toast + Som!
                    const feedbackTitle = `📢 Novo Feedback: ${item.type || 'Desempenho'}`;
                    const author = item.createdBy ? `De: ${item.createdBy}\n` : '';
                    const commentPreview = item.comment 
                        ? (item.comment.length > 120 ? item.comment.substring(0, 117) + '...' : item.comment)
                        : 'Você recebeu um novo feedback no sistema.';
                    
                    notify({
                        title: feedbackTitle,
                        body: `${author}"${commentPreview}"`,
                        type: 'feedback',
                        tag: `feedback-${item.id}`,
                        data: {
                            id: item.id,
                            feedback: item,
                            type: 'feedback',
                            tab: 'history'
                        },
                        action: {
                            label: 'Ver Feedback',
                            onClick: () => openFeedbackInApp(item)
                        },
                        onClick: () => openFeedbackInApp(item)
                    });
                }
            });
        });

        return () => {
            unsubscribe();
        };
    }, [currentUser, isInactive, notify]);

    return null;
};

export default NotificationManager;
