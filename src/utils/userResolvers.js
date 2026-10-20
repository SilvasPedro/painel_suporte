import { getCachedCollection } from '../services/dataCache';

/**
 * Converte qualquer identificador de autor/registrador (seja e-mail ou nome bruto)
 * no Nome Completo e legível do usuário no sistema.
 * Exemplo: 'pedrosouzactt@gmail.com' -> 'Pedro Silva'
 */
export const resolveUserName = (identifier, collaboratorsList = null) => {
    if (!identifier || typeof identifier !== 'string') return 'Gestão';
    
    const trimmed = identifier.trim();
    if (!trimmed) return 'Gestão';

    // Se já for um nome puro sem '@', retorna direto
    if (!trimmed.includes('@')) {
        return trimmed;
    }

    const lowerEmail = trimmed.toLowerCase();

    // 1. Busca na lista de colaboradores em memória ou cache singleton
    const colabs = collaboratorsList || getCachedCollection('collaborators') || [];
    if (Array.isArray(colabs) && colabs.length > 0) {
        const found = colabs.find(c => 
            c?.email?.toLowerCase() === lowerEmail || 
            c?.colabEmail?.toLowerCase() === lowerEmail
        );
        if (found && (found.name || found.colabName)) {
            return found.name || found.colabName;
        }
    }

    // 2. Busca no usuário salvo em sessão local
    try {
        if (typeof window !== 'undefined') {
            const keys = ['hubdesk_current_user', 'authUser', 'currentUser'];
            for (const k of keys) {
                const raw = sessionStorage.getItem(k) || localStorage.getItem(k);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed?.email?.toLowerCase() === lowerEmail && (parsed?.name || parsed?.displayName)) {
                        return parsed.name || parsed.displayName;
                    }
                }
            }
        }
    } catch {
        // Ignora erros de parse do storage
    }

    // 3. Tratamento para contas conhecidas de administradores e gestores
    const prefix = trimmed.split('@')[0];
    if (prefix.toLowerCase().includes('pedrosouza') || prefix.toLowerCase().includes('pedro.silva')) {
        return 'Pedro Silva';
    }

    // 4. Formata o prefixo do e-mail com iniciais maiúsculas (ex: joao.souza -> Joao Souza)
    return prefix
        .replace(/[._-]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ') || 'Gestor';
};

export default resolveUserName;
