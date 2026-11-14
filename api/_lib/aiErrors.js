/**
 * Traduz falhas do Gemini em respostas claras para a tela.
 * Antes, qualquer falha virava "Falha ao processar a mensagem" (HTTP 500) e ninguém sabia o motivo.
 * Agora a resposta traz um código, uma explicação em português com o que fazer e um detalhe técnico curto.
 * Nada aqui devolve chaves ou segredos: o texto é limpo antes de sair.
 */

// Remove o que parece chave de API (ex.: AIza...) e limita o tamanho
export const sanitizeDetail = (value, max = 160) => String(value || '')
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[chave oculta]')
    .replace(/(key|token|bearer)[=:\s]+[\w.-]{12,}/gi, '$1=[oculto]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

// O SDK costuma devolver a mensagem como um JSON: {"error":{"code":400,"message":"...","status":"INVALID_ARGUMENT"}}
const parseSdkMessage = (message) => {
    try {
        const parsed = JSON.parse(String(message));
        const inner = parsed?.error || parsed;
        return { code: Number(inner?.code) || null, status: String(inner?.status || ''), text: String(inner?.message || '') };
    } catch {
        return { code: null, status: '', text: String(message || '') };
    }
};

/**
 * @returns {{ httpStatus: number, error: string, message: string, detail: string, retryable: boolean }}
 */
export const classifyGeminiError = (error) => {
    const parsed = parseSdkMessage(error?.message);
    const code = Number(error?.status) || parsed.code || null;
    const apiStatus = (parsed.status || '').toUpperCase();
    const text = `${parsed.text} ${error?.message || ''}`.toLowerCase();
    const detail = sanitizeDetail([code, apiStatus, parsed.text].filter(Boolean).join(' • ') || error?.name || 'erro sem detalhe');

    const make = (httpStatus, errorCode, message, retryable = false) => ({ httpStatus, error: errorCode, message, detail, retryable });

    if (text.includes('api key not valid') || text.includes('api_key_invalid') || text.includes('api key expired') || text.includes('api key not found')) {
        return make(502, 'chave-invalida', 'A chave do Gemini foi recusada. Confira o valor de GEMINI_API_KEY na Vercel (sem aspas nem espaços) e faça um novo deploy.');
    }
    if (code === 403 || apiStatus === 'PERMISSION_DENIED' || text.includes('permission denied') || text.includes('has not been used in project') || text.includes('api has not been enabled')) {
        return make(502, 'chave-sem-permissao', 'A chave não tem permissão para usar este modelo. Gere a chave no Google AI Studio ou ative a Generative Language API no projeto da chave.');
    }
    if (code === 429 || apiStatus === 'RESOURCE_EXHAUSTED' || text.includes('quota') || text.includes('rate limit')) {
        return make(429, 'cota-esgotada', 'A cota da IA acabou ou há chamadas demais agora. Aguarde um pouco e tente de novo; se persistir, confira o plano e os limites da chave no Google AI Studio.', true);
    }
    if (code === 404 || apiStatus === 'NOT_FOUND' || text.includes('is not found for api version') || text.includes('model not found')) {
        return make(502, 'modelo-indisponivel', 'O modelo da IA configurado não está disponível para esta chave.');
    }
    if (code === 503 || code === 500 || apiStatus === 'UNAVAILABLE' || apiStatus === 'INTERNAL' || text.includes('overloaded') || text.includes('high demand')) {
        return make(503, 'ia-sobrecarregada', 'A IA do Google está sobrecarregada no momento. Tente de novo em alguns segundos.', true);
    }
    if (apiStatus === 'FAILED_PRECONDITION' || text.includes('location is not supported') || text.includes('user location')) {
        return make(502, 'regiao-nao-suportada', 'O Gemini não está disponível na região do servidor ou da conta desta chave.');
    }
    if (code === 400 || apiStatus === 'INVALID_ARGUMENT') {
        return make(502, 'pedido-recusado', 'A IA recusou o pedido. Tente uma pergunta menor ou comece uma nova conversa.');
    }
    if (text.includes('bytestring') || text.includes('is not a legal http header value') || text.includes('invalid character in header')) {
        return make(502, 'chave-formato-invalido', `O valor de GEMINI_API_KEY na Vercel contém um caractere inválido (por exemplo aspas curvas). ${CHAVE_AJUDA}`);
    }
    if (error?.name === 'AbortError' || text.includes('timeout') || text.includes('timed out') || text.includes('etimedout')) {
        return make(504, 'tempo-esgotado', 'A IA demorou demais para responder. Tente de novo com uma pergunta mais curta.', true);
    }
    if (text.includes('fetch failed') || text.includes('econnreset') || text.includes('enotfound') || text.includes('network')) {
        return make(502, 'falha-de-rede', 'O servidor não conseguiu falar com a IA do Google. Tente de novo em instantes.', true);
    }
    return make(500, 'erro-desconhecido', 'Ocorreu um erro inesperado ao consultar a IA. O detalhe técnico abaixo ajuda a identificar a causa.');
};

const CHAVE_AJUDA = 'Abra o Google AI Studio, copie só a chave (começa com AIza e não tem espaços, aspas nem texto extra) e cole no campo Value de GEMINI_API_KEY na Vercel; depois faça um novo deploy.';

/**
 * Confere o valor salvo em GEMINI_API_KEY antes de usá-lo.
 * Chaves coladas com aspas curvas, espaços ou texto junto fazem a chamada falhar com um erro confuso
 * ("Cannot convert argument to a ByteString"). Aqui o problema é apontado com a posição do caractere,
 * sem mostrar a chave.
 * @returns {{ ok: true, key: string } | { ok: false, error: string, message: string, detail: string }}
 */
export const inspectApiKey = (raw) => {
    // tira espaços e aspas (retas ou curvas) que costumam vir junto ao colar
    const key = String(raw || '').trim().replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '');
    if (!key) {
        return { ok: false, error: 'chave-nao-configurada', message: 'A chave da IA ainda não foi configurada no servidor. Crie a variável GEMINI_API_KEY na Vercel (sem prefixo VITE_) e faça um novo deploy.', detail: 'GEMINI_API_KEY ausente' };
    }
    const bad = Array.from(key).findIndex(ch => ch.charCodeAt(0) < 33 || ch.charCodeAt(0) > 126);
    if (bad >= 0) {
        const code = Array.from(key)[bad].codePointAt(0);
        const why = code === 32 ? 'há um espaço no meio do valor' : (code > 126 ? 'há um caractere especial (como aspas curvas ou acento)' : 'há uma quebra de linha ou caractere invisível');
        return {
            ok: false,
            error: 'chave-formato-invalido',
            message: `O valor de GEMINI_API_KEY na Vercel não parece uma chave: ${why}. ${CHAVE_AJUDA}`,
            detail: `tamanho ${key.length} • caractere inválido na posição ${bad} (código ${code})`
        };
    }
    if (key.length < 20 || key.length > 120) {
        return {
            ok: false,
            error: 'chave-formato-invalido',
            message: `O valor de GEMINI_API_KEY tem um tamanho incomum (${key.length} caracteres). ${CHAVE_AJUDA}`,
            detail: `tamanho ${key.length}`
        };
    }
    return { ok: true, key };
};

/** Resposta sem texto: normalmente bloqueada pelos filtros de segurança do Gemini. */
export const emptyReplyError = (response) => {
    const reason = String(response?.promptFeedback?.blockReason || response?.candidates?.[0]?.finishReason || '').trim();
    return {
        httpStatus: 502,
        error: 'resposta-vazia',
        message: reason && reason !== 'STOP'
            ? 'A IA não devolveu texto (resposta bloqueada ou interrompida). Reformule a pergunta.'
            : 'A IA não devolveu uma resposta. Tente reformular a pergunta.',
        detail: sanitizeDetail(reason || 'sem texto'),
        retryable: true
    };
};

/** Corpo JSON enviado ao navegador. */
export const errorBody = ({ error, message, detail, retryable }) => ({ error, message, detail, retryable });
