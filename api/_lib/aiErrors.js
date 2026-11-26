/**
 * Traduz falhas da IA (Claude, da Anthropic) em respostas claras para a tela.
 * Antes, qualquer falha virava "Falha ao processar a mensagem" (HTTP 500) e ninguém sabia o motivo.
 * Agora a resposta traz um código, uma explicação em português com o que fazer e um detalhe técnico curto.
 * Nada aqui devolve chaves ou segredos: o texto é limpo antes de sair.
 */

// Remove o que parece chave de API (ex.: sk-ant-...) e limita o tamanho
export const sanitizeDetail = (value, max = 160) => String(value || '')
    .replace(/sk-ant-[0-9A-Za-z_-]{6,}/g, '[chave oculta]')
    .replace(/(key|token|bearer)[=:\s]+[\w.-]{12,}/gi, '$1=[oculto]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

// O SDK costuma devolver a mensagem como: 401 {"type":"error","error":{"type":"authentication_error","message":"..."}}
const parseSdkMessage = (error) => {
    const body = error?.error && typeof error.error === 'object' ? error.error : null;
    let inner = body?.error || body;
    if (!inner?.type) {
        const raw = String(error?.message || '');
        const start = raw.indexOf('{');
        if (start >= 0) {
            try {
                const parsed = JSON.parse(raw.slice(start));
                inner = parsed?.error || parsed;
            } catch { /* mensagem sem JSON */ }
        }
    }
    return { type: String(inner?.type || ''), text: String(inner?.message || '') };
};

/**
 * @returns {{ httpStatus: number, error: string, message: string, detail: string, retryable: boolean }}
 */
export const classifyAiError = (error) => {
    const parsed = parseSdkMessage(error);
    const code = Number(error?.status) || null;
    const type = parsed.type.toLowerCase();
    const text = `${parsed.text} ${error?.message || ''}`.toLowerCase();
    const detail = sanitizeDetail([code, type, parsed.text].filter(Boolean).join(' • ') || error?.name || 'erro sem detalhe');

    const make = (httpStatus, errorCode, message, retryable = false) => ({ httpStatus, error: errorCode, message, detail, retryable });

    if (text.includes('bytestring') || text.includes('is not a legal http header value') || text.includes('invalid character in header')) {
        return make(502, 'chave-formato-invalido', `O valor de ANTHROPIC_API_KEY na Vercel contém um caractere inválido (por exemplo aspas curvas). ${CHAVE_AJUDA}`);
    }
    if (code === 401 || type === 'authentication_error' || text.includes('invalid x-api-key') || text.includes('invalid api key')) {
        return make(502, 'chave-invalida', 'A chave da Anthropic foi recusada. Confira o valor de ANTHROPIC_API_KEY na Vercel (sem aspas nem espaços) e faça um novo deploy.');
    }
    if (code === 402 || text.includes('credit balance is too low') || text.includes('billing')) {
        return make(502, 'sem-credito', 'A conta da Anthropic está sem crédito. Adicione saldo em Plans & Billing no Console da Anthropic e tente de novo.');
    }
    if (code === 403 || type === 'permission_error') {
        return make(502, 'chave-sem-permissao', 'A chave não tem permissão para usar este modelo. Gere outra chave no Console da Anthropic ou confira o acesso da organização ao modelo.');
    }
    if (code === 404 || type === 'not_found_error' || text.includes('model not found')) {
        return make(502, 'modelo-indisponivel', 'O modelo da IA não está disponível para esta chave. Defina na Vercel a variável ANTHROPIC_MODEL com um modelo atual, como claude-sonnet-5-5, e faça um novo deploy.');
    }
    if (code === 413 || type === 'request_too_large') {
        return make(502, 'pedido-recusado', 'O pedido ficou grande demais para a IA. Comece uma nova conversa ou peça um recorte menor.');
    }
    if (code === 429 || type === 'rate_limit_error' || text.includes('rate limit')) {
        return make(429, 'cota-esgotada', 'Há chamadas demais para a IA agora ou o limite da conta foi atingido. Aguarde um pouco e tente de novo; se persistir, confira os limites da conta no Console da Anthropic.', true);
    }
    if (code === 529 || code === 503 || code === 500 || type === 'overloaded_error' || type === 'api_error' || text.includes('overloaded')) {
        return make(503, 'ia-sobrecarregada', 'A IA está sobrecarregada no momento. Tente de novo em alguns segundos.', true);
    }
    if (code === 400 || type === 'invalid_request_error') {
        return make(502, 'pedido-recusado', 'A IA recusou o pedido. Tente uma pergunta menor ou comece uma nova conversa.');
    }
    if (error?.name === 'APIConnectionTimeoutError' || error?.name === 'AbortError' || text.includes('timeout') || text.includes('timed out') || text.includes('etimedout')) {
        return make(504, 'tempo-esgotado', 'A IA demorou demais para responder. Tente de novo com uma pergunta mais curta ou um relatório de período menor.', true);
    }
    if (error?.name === 'APIConnectionError' || text.includes('fetch failed') || text.includes('econnreset') || text.includes('enotfound') || text.includes('network') || text.includes('connection error')) {
        return make(502, 'falha-de-rede', 'O servidor não conseguiu falar com a IA. Tente de novo em instantes.', true);
    }
    return make(500, 'erro-desconhecido', 'Ocorreu um erro inesperado ao consultar a IA. O detalhe técnico abaixo ajuda a identificar a causa.');
};

const CHAVE_AJUDA = 'Abra o Console da Anthropic (API Keys), copie só a chave (começa com sk-ant- e não tem espaços, aspas nem texto extra) e cole no campo Value de ANTHROPIC_API_KEY na Vercel; depois faça um novo deploy.';

/**
 * Confere o valor salvo em ANTHROPIC_API_KEY antes de usá-lo.
 * Chaves coladas com aspas curvas, espaços ou texto junto fazem a chamada falhar com um erro confuso
 * ("Cannot convert argument to a ByteString"). Aqui o problema é apontado com a posição do caractere,
 * sem mostrar a chave.
 * @returns {{ ok: true, key: string } | { ok: false, error: string, message: string, detail: string }}
 */
export const inspectApiKey = (raw) => {
    // tira espaços e aspas (retas ou curvas) que costumam vir junto ao colar
    const key = String(raw || '').trim().replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '');
    if (!key) {
        return { ok: false, error: 'chave-nao-configurada', message: 'A chave da IA ainda não foi configurada no servidor. Crie a variável ANTHROPIC_API_KEY na Vercel (sem prefixo VITE_) e faça um novo deploy.', detail: 'ANTHROPIC_API_KEY ausente' };
    }
    const bad = Array.from(key).findIndex(ch => ch.charCodeAt(0) < 33 || ch.charCodeAt(0) > 126);
    if (bad >= 0) {
        const code = Array.from(key)[bad].codePointAt(0);
        const why = code === 32 ? 'há um espaço no meio do valor' : (code > 126 ? 'há um caractere especial (como aspas curvas ou acento)' : 'há uma quebra de linha ou caractere invisível');
        return {
            ok: false,
            error: 'chave-formato-invalido',
            message: `O valor de ANTHROPIC_API_KEY na Vercel não parece uma chave: ${why}. ${CHAVE_AJUDA}`,
            detail: `tamanho ${key.length} • caractere inválido na posição ${bad} (código ${code})`
        };
    }
    if (!key.startsWith('sk-ant-')) {
        return {
            ok: false,
            error: 'chave-formato-invalido',
            message: `O valor de ANTHROPIC_API_KEY não começa com sk-ant-, então não parece uma chave da Anthropic. ${CHAVE_AJUDA}`,
            detail: `tamanho ${key.length} • prefixo diferente de sk-ant-`
        };
    }
    if (key.length < 20 || key.length > 300) {
        return {
            ok: false,
            error: 'chave-formato-invalido',
            message: `O valor de ANTHROPIC_API_KEY tem um tamanho incomum (${key.length} caracteres). ${CHAVE_AJUDA}`,
            detail: `tamanho ${key.length}`
        };
    }
    return { ok: true, key };
};

/** Resposta sem texto: recusa do modelo ou corte por tamanho. */
export const emptyReplyError = (response) => {
    const reason = String(response?.stop_reason || '').trim();
    return {
        httpStatus: 502,
        error: 'resposta-vazia',
        message: reason === 'refusal'
            ? 'A IA não devolveu texto (pedido recusado pelas regras de segurança). Reformule a pergunta.'
            : 'A IA não devolveu uma resposta. Tente reformular a pergunta.',
        detail: sanitizeDetail(reason || 'sem texto'),
        retryable: true
    };
};

/** Corpo JSON enviado ao navegador. */
export const errorBody = ({ error, message, detail, retryable }) => ({ error, message, detail, retryable });
