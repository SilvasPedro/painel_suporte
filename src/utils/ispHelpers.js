/**
 * UTILITÁRIOS E REGRAS DE NEGÓCIO PARA SUPORTE TÉCNICO DE ISP / TELECOM
 * Gestão de SLA Parametrizável, Máscaras e Scripts Rápidos
 */
import { normalizeCategory } from '../types/request.types';
import { subscribeSharedDocument } from '../services/dataCache';

// Tabela de SLAs dinâmicos padrão por Categoria e Tipo (em horas)
// Projetado para aceitar parametrização dinâmica vinda do Firestore (system_settings/sla_config)
export const DEFAULT_SLA_CONFIG = {
    // Categorias Oficiais
    'error_analysis': { targetHours: 48, label: 'Análise de Erro (48h)', level: 'warning' },
    'system_improvement': { targetHours: 120, label: 'Melhoria de Sistema (120h)', level: 'normal' },
    'facility_improvement': { targetHours: 72, label: 'Melhoria de Ambiente (72h)', level: 'normal' },
    'other': { targetHours: 72, label: 'Outros (72h)', level: 'normal' },

    // Compatibilidade com Tipos Legados
    'Análise de Erro': { targetHours: 48, label: 'Análise de Erro (48h)', level: 'warning' },
    'Melhoria de Sistema': { targetHours: 120, label: 'Melhoria de Sistema (120h)', level: 'normal' },
    'Melhoria de Ambiente': { targetHours: 72, label: 'Melhoria de Ambiente (72h)', level: 'normal' },
    'Outros': { targetHours: 72, label: 'Outros (72h)', level: 'normal' },
    'Falha Massiva / Rompimento': { targetHours: 2, label: 'Crítico (2h)', level: 'critical' },
    'Sem Conexão (LOS / ONU Desalinhada)': { targetHours: 4, label: 'Alto (4h)', level: 'high' },
    'Roteador Travado / Queda PPPoE': { targetHours: 4, label: 'Médio (4h)', level: 'medium' },
    'Lentidão / Alta Latência / Perda de Pacotes': { targetHours: 6, label: 'Médio (6h)', level: 'medium' },
    'default': { targetHours: 72, label: 'Padrão (72h)', level: 'normal' }
};

// Armazenamento em memória reativo do SLA vindo do Firestore
let dynamicSlaStore = null;

export const setDynamicSlaStore = (config) => {
    dynamicSlaStore = config;
};

// Sincronização automática com system_settings/sla_config via FinOps cache
try {
    subscribeSharedDocument("system_settings", "sla_config", (docData) => {
        if (docData) {
            dynamicSlaStore = docData;
        }
    });
} catch {
    // Inicialização silenciosa caso o banco ainda não tenha instanciado
}

/**
 * Helper para obter as horas de SLA de uma categoria ou ticket
 * Prioriza customSlaConfig explícito, dynamicSlaStore e fallback DEFAULT_SLA_CONFIG
 */
export const getCategorySlaHours = (categoryOrType = '', customSlaConfig = null) => {
    const config = customSlaConfig || dynamicSlaStore || DEFAULT_SLA_CONFIG;
    const cat = normalizeCategory(categoryOrType);
    if (config[cat]?.targetHours !== undefined) {
        return Number(config[cat].targetHours);
    }
    if (typeof config[cat] === 'number') {
        return config[cat];
    }
    if (config[categoryOrType]?.targetHours !== undefined) {
        return Number(config[categoryOrType].targetHours);
    }
    if (typeof config[categoryOrType] === 'number') {
        return config[categoryOrType];
    }
    return config.default?.targetHours || 72;
};

/**
 * Calcula o tempo decorrido, prazo final e o status de SLA de uma solicitação / chamado
 * Suporta customSlaConfig vindo do Firestore caso configurado
 */
export const calculateSlaStatus = (ticket, customSlaConfig = null) => {
    if (!ticket) { 
        return { 
            status: 'ok', 
            label: 'No Prazo', 
            remainingText: '--', 
            remainingHours: 0, 
            percentElapsed: 0,
            badgeClass: 'text-slate-500 bg-slate-100 border-slate-200'
        };
    }

    // Se já estiver concluído/resolvido, o SLA é congelado
    const statusNormalized = String(ticket.status || '').toLowerCase();
    if (['resolvido', 'concluído', 'concluido', 'fechado', 'completed', 'resolved'].includes(statusNormalized)) {
        return {
            status: 'resolved',
            label: 'Resolvido',
            remainingText: 'Encerrado',
            remainingHours: 0,
            percentElapsed: 100,
            badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
        };
    }

    // Identifica o timestamp de abertura
    let createdTime = null;
    if (ticket.createdAt?.toMillis) {
        createdTime = ticket.createdAt.toMillis();
    } else if (ticket.createdAt?.seconds) {
        createdTime = ticket.createdAt.seconds * 1000;
    } else if (ticket.createdAt instanceof Date) {
        createdTime = ticket.createdAt.getTime();
    } else if (ticket.date) {
        createdTime = new Date(ticket.date).getTime();
    } else {
        createdTime = Date.now();
    }

    // Determina as horas alvo de SLA
    let targetHours = ticket.slaHours;
    if (!targetHours) {
        targetHours = getCategorySlaHours(ticket.category || ticket.type, customSlaConfig);
    }

    // Se houver targetDueDate explícito salvo no documento
    let targetTime = null;
    if (ticket.targetDueDate?.toMillis) {
        targetTime = ticket.targetDueDate.toMillis();
    } else if (ticket.targetDueDate?.seconds) {
        targetTime = ticket.targetDueDate.seconds * 1000;
    } else if (ticket.targetDueDate instanceof Date) {
        targetTime = ticket.targetDueDate.getTime();
    } else {
        targetTime = createdTime + (targetHours * 60 * 60 * 1000);
    }

    const now = Date.now();
    const remainingMs = targetTime - now;
    const totalDurationMs = Math.max(1, targetTime - createdTime);
    const elapsedMs = Math.max(0, now - createdTime);
    const percentElapsed = Math.min(100, Math.round((elapsedMs / totalDurationMs) * 100));

    const remainingMinutes = Math.round(remainingMs / (60 * 1000));
    const remainingHours = Math.round(remainingMinutes / 60);

    // SLA Estourado / Vencido
    if (remainingMs <= 0) {
        const breachedHours = Math.abs(remainingHours);
        const text = breachedHours === 0 ? 'SLA Estourado' : `SLA Estourado (+${breachedHours}h)`;
        return {
            status: 'breached',
            label: 'SLA Estourado',
            remainingText: text,
            remainingHours: -breachedHours,
            percentElapsed: 100,
            badgeClass: 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/40 font-semibold'
        };
    }

    // Vence Hoje / Atenção (< 24h ou > 75% decorrido)
    if (remainingMinutes <= 1440 || percentElapsed >= 75) {
        let text = `Restam ${remainingHours}h`;
        if (remainingHours <= 1) {
            text = `${Math.max(1, remainingMinutes)}m restantes`;
        } else if (remainingHours <= 12) {
            text = `Vence hoje (${remainingHours}h)`;
        }

        return {
            status: 'warning',
            label: 'Atenção',
            remainingText: text,
            remainingHours,
            percentElapsed,
            badgeClass: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/40 font-medium'
        };
    }

    // No Prazo Normal
    return {
        status: 'ok',
        label: 'No Prazo',
        remainingText: `Restam ${remainingHours}h`,
        remainingHours,
        percentElapsed,
        badgeClass: 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700'
    };
};

/**
 * Máscara automática de MAC Address (XX:XX:XX:XX:XX:XX)
 */
export const maskMacAddress = (value = '') => {
    const clean = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase().slice(0, 12);
    const parts = clean.match(/.{1,2}/g);
    return parts ? parts.join(':') : clean;
};

/**
 * Máscara básica para IPv4 (192.168.0.1)
 */
export const maskIpAddress = (value = '') => {
    return value.replace(/[^0-9.]/g, '').slice(0, 15);
};

/**
 * Scripts e Comandos Rápidos de Suporte ISP
 */
export const ISP_QUICK_SCRIPTS = [
    {
        id: 'onu_reboot',
        title: 'Reinicialização Remota de ONU',
        category: 'Acesso',
        command: 'system reboot force',
        notes: 'Reinicia o equipamento ótico remotamente via OMCI sem necessidade de deslocamento.'
    },
    {
        id: 'optical_power',
        title: 'Verificação de Potência Óptica',
        category: 'Fibra',
        command: 'show interface optical rx-power tx-power',
        notes: 'Parâmetro de conformidade: RX entre -15.0 dBm e -25.0 dBm. Acima de -27.0 dBm indica atenuação ou conector sujo.'
    },
    {
        id: 'pppoe_reset',
        title: 'Limpar Sessão PPPoE Travada',
        category: 'Autenticação',
        command: 'clear pppoe session interface vlan',
        notes: 'Derruba a conexão presa no BNG/Concentrador para forçar nova autenticação com IP fresco.'
    },
    {
        id: 'dns_recommendation',
        title: 'DNS Padrão do Provedor',
        category: 'Rede',
        command: 'Primário: 1.1.1.1 | Secundário: 8.8.8.8 | Local: 10.0.0.1',
        notes: 'Servidores DNS rápidos e resilientes com baixa latência nacional.'
    }
];
