import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import { useNotification } from '../context/NotificationContext';
import { subscribeSharedCollection } from '../services/dataCache';
import { NOTIFICATION_EVENTS, inboxOptions, describeWebhookResult } from '../services/notificationEvents';
import { registerMessagingServiceWorker } from '../services/browserNotifications';
import { resolveUserName } from '../utils/userResolvers';

/**
 * Componente invisível de escuta em tempo real para Notificações Push do Navegador (v3.8.1)
 * Monitora coleções:
 * 1. 'feedbacks': Notifica colaborador quando recebe feedback.
 * 2. 'critical_reports' (Nova Demanda): Notifica usuários Gestores quando um novo relatório é aberto.
 * 3. 'critical_reports' (Mudança de Status): Notifica o colaborador que abriu o relatório quando seu status é alterado.
 */
export const NotificationManager = () => {
    const { currentUser, isInactive, userRole } = useAuth();
    const { normalizedRole, isMasterAdmin } = usePermissions();
    const { notify, requestPermission, showToast } = useNotification();
    
    // Rastreia os avisos pessoais já vistos (feedback, avaliação semanal e 1:1 mensal)
    const knownInboxIds = useRef(new Set());
    const isInboxInitialized = useRef(false);

    // Rastreia relatórios conhecidos e seus status anteriores: Map<reportId, { status: string, creatorId: string }>
    const knownReportsMap = useRef(new Map());
    const isReportsInitialized = useRef(false);

    // 1. Registra o Service Worker e solicita permissão de forma amigável
    useEffect(() => {
        if (!currentUser || isInactive || currentUser.isInactive) return;

        registerMessagingServiceWorker();

        // Se a permissão ainda for default (não perguntada), solicita suavemente
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            const timer = setTimeout(() => {
                requestPermission(currentUser).catch(() => {});
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [currentUser, isInactive, requestPermission]);

    // 2. Funções utilitárias para abrir itens na aplicação
    // Abre Meu Histórico na aba do aviso (feedbacks, métricas semanais ou 1:1 mensal)
    const openHistoryInApp = (subtab) => {
        if (typeof window === 'undefined') return;
        window.focus();
        window.dispatchEvent(new CustomEvent('HUBDESK_NAVIGATE_TAB', { detail: { tab: 'history', subtab } }));
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('HUBDESK_OPEN_HISTORY_TAB', { detail: { subtab } }));
        }, 200);
    };

    const openFeedbackInApp = (feedbackItem) => {
        if (typeof window === 'undefined') return;
        
        window.focus();

        window.dispatchEvent(new CustomEvent('HUBDESK_NAVIGATE_TAB', {
            detail: { tab: 'history', subtab: 'feedbacks' }
        }));

        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('HUBDESK_OPEN_FEEDBACK', {
                detail: { feedback: feedbackItem }
            }));
        }, 150);
    };

    const openReportInApp = (reportItem) => {
        if (typeof window === 'undefined') return;
        
        window.focus();

        window.dispatchEvent(new CustomEvent('HUBDESK_NAVIGATE_TAB', {
            detail: { tab: 'reports' }
        }));

        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('HUBDESK_OPEN_REPORT', {
                detail: { report: reportItem }
            }));
        }, 150);
    };

    // 3. Ouve mensagens postadas pelo Service Worker e eventos de simulação de teste
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleServiceWorkerMessage = (event) => {
            if (event.data?.type === 'HUBDESK_NOTIFICATION_CLICK') {
                const notifData = event.data?.data;
                if (notifData?.feedback) {
                    openFeedbackInApp(notifData.feedback);
                } else if (notifData?.report) {
                    openReportInApp(notifData.report);
                } else if (notifData?.tab) {
                    window.dispatchEvent(new CustomEvent('HUBDESK_NAVIGATE_TAB', {
                        detail: { tab: notifData.tab }
                    }));
                }
            }
        };

        const handleWindowNotificationClick = (event) => {
            const data = event.detail;
            if (data?.feedback) {
                openFeedbackInApp(data.feedback);
            } else if (data?.report) {
                openReportInApp(data.report);
            } else if (data?.tab) {
                window.dispatchEvent(new CustomEvent('HUBDESK_NAVIGATE_TAB', {
                    detail: { tab: data.tab }
                }));
            }
        };

        // Simulação de Feedback (Teste manual)
        const handleSimulateFeedback = (event) => {
            const simulated = event.detail || {
                id: `sim-fb-${Date.now()}`,
                type: 'Elogio',
                method: 'Sistema',
                comment: 'Parabéns pela dedicação e agilidade no atendimento às demandas críticas do setor!',
                createdBy: 'Liderança HubDesk',
                date: new Date().toLocaleDateString('pt-BR'),
                createdAt: new Date().toISOString()
            };

            notify({
                title: `📢 Novo Feedback: ${simulated.type}`,
                body: `De: ${resolveUserName(simulated.createdBy) || 'Gestão'}\n"${simulated.comment}"`,
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

        // Simulação de Novo Relatório para Gestor (Teste manual)
        const handleSimulateNewReport = (event) => {
            const simulated = event.detail || {
                id: `sim-rep-${Date.now()}`,
                title: 'Lentidão no sistema de integração ERP',
                type: 'Falha Operacional',
                priority: 'Alta',
                protocol: 'DEM-9842',
                status: 'Pendente',
                creatorName: 'Eduardo Caetano',
                description: 'Identificado travamento recorrente durante consulta de protocolos de clientes.',
                date: new Date().toISOString().split('T')[0]
            };

            notify({
                title: `📋 Nova Solicitação/Relatório: ${simulated.type}`,
                body: `Aberto por: ${simulated.creatorName} • Protocolo #${simulated.protocol}\n"${simulated.description}"`,
                type: 'report',
                tag: `report-new-sim-${Date.now()}`,
                data: { report: simulated, type: 'report', tab: 'reports' },
                action: {
                    label: 'Ver Relatório',
                    onClick: () => openReportInApp(simulated)
                },
                onClick: () => openReportInApp(simulated)
            });
        };

        // Simulação de Alteração de Status para Colaborador (Teste manual)
        const handleSimulateStatusChange = (event) => {
            const simulated = event.detail || {
                id: `sim-status-${Date.now()}`,
                title: 'Ajuste de cadastro de cliente bloqueado',
                type: 'Análise de Erro',
                protocol: 'DEM-4120',
                status: 'Resolvido',
                adminComment: 'Ajuste concluído no banco de dados e acesso liberado com sucesso.'
            };

            notify({
                title: `🔄 Status Atualizado: ${simulated.status}`,
                body: `Sua solicitação (#${simulated.protocol}) foi marcada como "${simulated.status}".\nParecer: "${simulated.adminComment}"`,
                type: 'report_status',
                tag: `report-status-sim-${Date.now()}`,
                data: { report: simulated, type: 'report', tab: 'reports' },
                action: {
                    label: 'Ver Atualização',
                    onClick: () => openReportInApp(simulated)
                },
                onClick: () => openReportInApp(simulated)
            });
        };

        navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
        window.addEventListener('HUBDESK_OPEN_NOTIFICATION', handleWindowNotificationClick);
        window.addEventListener('HUBDESK_SIMULATE_FEEDBACK', handleSimulateFeedback);
        window.addEventListener('HUBDESK_SIMULATE_NEW_REPORT', handleSimulateNewReport);
        window.addEventListener('HUBDESK_SIMULATE_REPORT_STATUS', handleSimulateStatusChange);

        return () => {
            navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
            window.removeEventListener('HUBDESK_OPEN_NOTIFICATION', handleWindowNotificationClick);
            window.removeEventListener('HUBDESK_SIMULATE_FEEDBACK', handleSimulateFeedback);
            window.removeEventListener('HUBDESK_SIMULATE_NEW_REPORT', handleSimulateNewReport);
            window.removeEventListener('HUBDESK_SIMULATE_REPORT_STATUS', handleSimulateStatusChange);
        };
    }, [notify]);

    // Resultado do aviso ao canal da equipe: quem lançou o item vê se o aviso saiu (ou por que não saiu)
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const handleWebhookResult = (e) => {
            const info = describeWebhookResult(e.detail?.status, e.detail?.reason);
            if (info) showToast(info.text, info.type);
        };
        window.addEventListener('HUBDESK_WEBHOOK_RESULT', handleWebhookResult);
        return () => window.removeEventListener('HUBDESK_WEBHOOK_RESULT', handleWebhookResult);
    }, [showToast]);

    // 4. Caixa de avisos pessoal: o lançamento de feedback, avaliação semanal ou 1:1 mensal grava um
    // aviso endereçado ao colaborador. Em vez de baixar as coleções inteiras, escutamos só os avisos
    // dele ainda não lidos (poucos documentos).
    useEffect(() => {
        if (!currentUser || isInactive || currentUser.isInactive) return;

        const currentUserId = currentUser.firestoreId || currentUser.uid;
        if (!currentUserId) return;

        const unsubscribe = subscribeSharedCollection('notifications', (items) => {
            if (!Array.isArray(items)) return;

            // Primeira execução: só memoriza o que já estava pendente (o indicador do menu cuida disso)
            if (!isInboxInitialized.current) {
                items.forEach(item => {
                    if (item.id) knownInboxIds.current.add(item.id);
                });
                isInboxInitialized.current = true;
                return;
            }

            items.forEach((item) => {
                if (!item?.id || knownInboxIds.current.has(item.id)) return;
                knownInboxIds.current.add(item.id);
                if (item.read) return;

                const def = NOTIFICATION_EVENTS[item.event];
                if (!def) return;

                const goToHistory = () => openHistoryInApp(def.subtab);

                notify({
                    title: item.title || `${def.icon} ${def.label}`,
                    body: item.body || 'Você tem uma novidade no Hubdesk.',
                    type: 'feedback',
                    tag: `inbox-${item.id}`,
                    data: {
                        id: item.refId || item.id,
                        type: item.event,
                        tab: 'history',
                        subtab: def.subtab
                    },
                    action: { label: 'Abrir', onClick: goToHistory },
                    onClick: goToHistory
                });

                window.dispatchEvent(new CustomEvent('HUBDESK_TRIGGER_PULSE', {
                    detail: { target: 'history' }
                }));
            });
        }, inboxOptions(currentUserId));

        return () => unsubscribe();
    }, [currentUser, isInactive, notify]);

    // 5. Escuta em TEMPO REAL a coleção 'critical_reports' (Regras v3.8.1)
    // REGRA 1: Novo relatório -> Usuários com role de "Gestor" recebem notificação
    // REGRA 2: Alteração de status -> Usuário que abriu o relatório recebe notificação
    useEffect(() => {
        if (!currentUser || isInactive || currentUser.isInactive) return;

        const currentUserId = currentUser.firestoreId || currentUser.uid;
        const currentEmail = currentUser.email?.toLowerCase();
        const currentName = currentUser.name?.trim().toLowerCase();

        // Determina se o usuário atual possui role de "Gestor"
        const roleStr = String(currentUser?.role || '').toLowerCase();
        const isGestor = Boolean(
            isMasterAdmin ||
            normalizedRole === 'gestor' ||
            normalizedRole === 'supervisor' ||
            userRole === 'admin' ||
            roleStr.includes('gestor') ||
            roleStr.includes('admin') ||
            roleStr.includes('supervis') ||
            roleStr.includes('gerente') ||
            roleStr.includes('coordenador')
        );

        const isCreatorOfReport = (report) => {
            if (!report) return false;
            if (currentUserId && report.creatorId === currentUserId) return true;
            if (currentEmail && report.creatorEmail?.toLowerCase() === currentEmail) return true;
            if (currentName && report.creatorName?.trim().toLowerCase() === currentName) return true;
            return false;
        };

        const unsubscribe = subscribeSharedCollection('critical_reports', (items) => {
            if (!Array.isArray(items)) return;

            // Primeira execução: armazena todos os relatórios conhecidos e seus status iniciais
            if (!isReportsInitialized.current) {
                items.forEach((rep) => {
                    if (rep.id) {
                        knownReportsMap.current.set(rep.id, {
                            status: rep.status || 'Pendente',
                            creatorId: rep.creatorId,
                            creatorEmail: rep.creatorEmail,
                            creatorName: rep.creatorName
                        });
                    }
                });
                isReportsInitialized.current = true;
                return;
            }

            // Execuções subsequentes
            items.forEach((rep) => {
                if (!rep || !rep.id) return;

                const repStatus = rep.status || 'Pendente';
                const isKnown = knownReportsMap.current.has(rep.id);

                // =========================================================================
                // REGRA 1: NOVO RELATÓRIO -> Notifica todos os usuários com papel de "Gestor"
                // =========================================================================
                if (!isKnown) {
                    knownReportsMap.current.set(rep.id, {
                        status: repStatus,
                        creatorId: rep.creatorId,
                        creatorEmail: rep.creatorEmail,
                        creatorName: rep.creatorName
                    });

                    // Verifica se quem está logado é um Gestor e NÃO foi quem criou o chamado
                    const createdByCurrentUser = isCreatorOfReport(rep);

                    if (isGestor && !createdByCurrentUser) {
                        const reporter = resolveUserName(rep.creatorName || rep.creatorEmail) || 'Colaborador';
                        const protocolBadge = rep.protocol ? ` • #${rep.protocol}` : '';
                        const desc = rep.description 
                            ? (rep.description.length > 110 ? rep.description.substring(0, 107) + '...' : rep.description)
                            : (rep.title || 'Nova solicitação aguardando despacho da liderança.');

                        notify({
                            title: `📋 Nova Solicitação: ${rep.type || 'Relatório Crítico'}`,
                            body: `Aberto por: ${reporter}${protocolBadge}\n"${desc}"`,
                            type: 'report',
                            tag: `report-new-${rep.id}`,
                            data: {
                                id: rep.id,
                                report: rep,
                                type: 'report',
                                tab: 'reports'
                            },
                            action: {
                                label: 'Ver Relatório',
                                onClick: () => openReportInApp(rep)
                            },
                            onClick: () => openReportInApp(rep)
                        });
                    }
                    return;
                }

                // =========================================================================
                // REGRA 2: ALTERAÇÃO DE STATUS -> Notifica o usuário que abriu o relatório
                // =========================================================================
                const prevData = knownReportsMap.current.get(rep.id);
                if (prevData && prevData.status !== repStatus) {
                    // Atualiza o status armazenado
                    knownReportsMap.current.set(rep.id, {
                        ...prevData,
                        status: repStatus
                    });

                    // Verifica se o usuário logado é o autor que abriu este chamado
                    const isMyReport = isCreatorOfReport(rep) || isCreatorOfReport(prevData);

                    // Evita notificar se o próprio criador foi quem atualizou o status (ex: edição própria)
                    const updatedByMe = currentName && rep.lastUpdatedBy && rep.lastUpdatedBy.toLowerCase() === currentName;

                    if (isMyReport && !updatedByMe) {
                        const protocolStr = rep.protocol ? `Protocolo #${rep.protocol}` : (rep.title || 'Sua solicitação');
                        const authorStaff = rep.lastUpdatedBy ? resolveUserName(rep.lastUpdatedBy) : 'Gestão';
                        const parecesPreview = rep.adminComment 
                            ? `\nParecer de ${authorStaff}: "${rep.adminComment.length > 70 ? rep.adminComment.substring(0, 67) + '...' : rep.adminComment}"`
                            : '';

                        notify({
                            title: `🔄 Status Atualizado: ${repStatus}`,
                            body: `${protocolStr} foi alterado para "${repStatus}".${parecesPreview}`,
                            type: 'report_status',
                            tag: `report-status-${rep.id}-${repStatus}`,
                            data: {
                                id: rep.id,
                                report: rep,
                                type: 'report',
                                tab: 'reports'
                            },
                            action: {
                                label: 'Ver Solicitação',
                                onClick: () => openReportInApp(rep)
                            },
                            onClick: () => openReportInApp(rep)
                        });
                    }
                }
            });
        }, (!isGestor && currentUserId) ? { where: [['creatorId', '==', currentUserId]] } : {});

        return () => {
            unsubscribe();
        };
    }, [currentUser, isInactive, isMasterAdmin, normalizedRole, userRole, notify]);

    return null;
};

export default NotificationManager;
