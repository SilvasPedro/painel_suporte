/**
 * UTILITÁRIOS UNIFICADOS DE TEMPO E DATAS (HubDesk - DRY)
 * Centraliza conversão de TMA, TMR, TME e formatações de data
 */

/**
 * Converte string de tempo "HH:MM:SS" ou "MM:SS" em minutos decimais
 * Exemplo: "00:05:30" => 5.5 minutos
 */
export const timeToDecimal = (timeStr) => {
    if (!timeStr || timeStr === '--' || timeStr === '00:00:00' || timeStr === '-') return 0;
    const parts = String(timeStr).split(':');
    if (parts.length === 3) {
        const hours = parseInt(parts[0], 10) || 0;
        const minutes = parseInt(parts[1], 10) || 0;
        const seconds = parseInt(parts[2], 10) || 0;
        return (hours * 60) + minutes + (seconds / 60);
    }
    if (parts.length === 2) {
        const minutes = parseInt(parts[0], 10) || 0;
        const seconds = parseInt(parts[1], 10) || 0;
        return minutes + (seconds / 60);
    }
    return 0;
};

/**
 * Converte minutos decimais de volta para formato "HH:MM:SS"
 * Exemplo: 5.5 => "00:05:30"
 */
export const formatTime = (decimalMinutes) => {
    if (!decimalMinutes && decimalMinutes !== 0) return "00:00:00";
    const totalSeconds = Math.max(0, Math.round(decimalMinutes * 60));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Formata data para o padrão curto brasileiro "DD/MM"
 * Suporta formatos "YYYY-MM-DD" e "DD/MM/YYYY"
 */
export const formatDateBR = (dateStr) => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
        const [, m, d] = dateStr.split('-');
        return `${d}/${m}`;
    }
    if (dateStr.includes('/')) {
        const [d, m] = dateStr.split('/');
        return `${d}/${m}`;
    }
    return dateStr;
};

/**
 * Converte data string para timestamp em milissegundos para ordenação cronológica
 */
export const parseDateSort = (dateStr) => {
    if (!dateStr) return 0;
    try {
        if (dateStr.includes('-')) {
            const [y, m, d] = dateStr.split('-');
            return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10)).getTime();
        }
        if (dateStr.includes('/')) {
            const [d, m, y] = dateStr.split('/');
            return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10)).getTime();
        }
        const parsed = new Date(dateStr).getTime();
        return isNaN(parsed) ? 0 : parsed;
    } catch {
        return 0;
    }
};
