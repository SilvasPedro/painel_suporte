import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Minus, Send, RotateCcw, Copy, Check, AlertCircle, ShieldCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getCachedCollection } from '../../services/dataCache';
import { getAuthHeaders, describeAiError } from '../../services/apiAuth';
import { cn } from '../../utils/cn';
import { buildChatContext, buildChatHistory, SUGGESTED_PROMPTS, CHAT_LIMITS } from '../../utils/floatingHub';

const GREETING = {
    id: 'greeting',
    role: 'assistant',
    greeting: true,
    content: 'Olá! Sou o assistente do Hubdesk. Posso resumir o desempenho da equipe, apontar pontos de atenção e ajudar a interpretar os KPIs.'
};

// Estilo das respostas em Markdown (o projeto não usa o plugin typography do Tailwind)
const MARKDOWN_COMPONENTS = {
    p: (props) => <p className="leading-relaxed [&:not(:last-child)]:mb-2" {...props} />,
    ul: (props) => <ul className="list-disc pl-5 space-y-1 mb-2" {...props} />,
    ol: (props) => <ol className="list-decimal pl-5 space-y-1 mb-2" {...props} />,
    li: (props) => <li className="leading-relaxed" {...props} />,
    strong: (props) => <strong className="font-semibold text-primary-hub" {...props} />,
    h1: (props) => <h4 className="text-sm font-bold text-primary-hub mt-2 mb-1" {...props} />,
    h2: (props) => <h4 className="text-sm font-bold text-primary-hub mt-2 mb-1" {...props} />,
    h3: (props) => <h4 className="text-xs font-bold uppercase tracking-wide text-secondary-hub mt-3 mb-1" {...props} />,
    a: (props) => <a className="text-rose-600 underline" target="_blank" rel="noopener noreferrer" {...props} />,
    code: (props) => <code className="px-1 py-0.5 rounded bg-canvas border border-subtle font-mono text-[12px]" {...props} />,
    table: (props) => <div className="overflow-x-auto my-2"><table className="min-w-full text-xs border-collapse" {...props} /></div>,
    th: (props) => <th className="border border-subtle bg-canvas px-2 py-1 text-left font-semibold" {...props} />,
    td: (props) => <td className="border border-subtle px-2 py-1" {...props} />
};

function TypingDots() {
    return (
        <span className="inline-flex items-center gap-1" aria-label="O assistente está escrevendo">
            {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-hub animate-bounce" style={{ animationDelay: `${i * 140}ms` }} />
            ))}
        </span>
    );
}

/**
 * Chat com o assistente de IA (exclusivo da gestão). Fica montado enquanto o botão flutuante existe,
 * então a conversa continua ao minimizar. O botão e a abertura ficam no FloatingHub.
 */
export default function ChatPanel({ isOpen, onClose }) {
    const [messages, setMessages] = useState([GREETING]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const endRef = useRef(null);
    const inputRef = useRef(null);
    const counter = useRef(0);

    const nextId = () => { counter.current += 1; return `m${counter.current}`; };
    const hasConversation = messages.some(m => !m.greeting);

    // Role até a última mensagem
    useEffect(() => {
        endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
    }, [messages, isLoading, isOpen]);

    // Foco no campo ao abrir
    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    const send = async (rawText) => {
        const text = String(rawText || '').trim();
        if (!text || isLoading) return;
        if (text.length > CHAT_LIMITS.message) {
            setMessages(prev => [...prev, { id: nextId(), role: 'assistant', error: true, content: `A mensagem passa de ${CHAT_LIMITS.message} caracteres. Resuma a pergunta.` }]);
            return;
        }

        const history = buildChatHistory(messages);
        // Contexto (colaboradores, avaliações e KPIs do cache), sempre atual e cabendo no limite do servidor
        let contextData;
        try {
            contextData = buildChatContext({
                collaborators: getCachedCollection('collaborators'),
                evaluations: getCachedCollection('weekly_evaluations'),
                sectorKpis: getCachedCollection('sector_kpis')
            });
        } catch (error) {
            console.error('Erro ao carregar contexto:', error);
            contextData = { appInfo: 'Painel Hubdesk - Suporte Técnico' };
        }
        setMessages(prev => [...prev.filter(m => !m.error), { id: nextId(), role: 'user', content: text }]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({
                    message: text,
                    history,
                    contextData
                })
            });
            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: data.reply || 'Não consegui gerar uma resposta.' }]);
            } else {
                setMessages(prev => [...prev, {
                    id: nextId(), role: 'assistant', error: true, retry: text,
                    content: describeAiError(response.status, 'Desculpe, ocorreu um erro ao processar sua solicitação.')
                }]);
            }
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            setMessages(prev => [...prev, {
                id: nextId(), role: 'assistant', error: true, retry: text,
                content: error?.message?.includes('Entre no sistema') ? error.message : 'Erro de conexão. Tente novamente em instantes.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        send(input);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send(input);
        }
    };

    const handleNewConversation = () => {
        setMessages([GREETING]);
        setInput('');
        inputRef.current?.focus();
    };

    const handleCopy = (msg) => {
        if (!navigator?.clipboard?.writeText) return;
        navigator.clipboard.writeText(msg.content);
        setCopiedId(msg.id);
        setTimeout(() => setCopiedId(null), 1800);
    };

    return (
        <section
            id="floating-chat-panel"
            role="dialog"
            aria-label="Assistente de IA do Hubdesk"
            aria-hidden={!isOpen}
            className={cn(
                'fixed bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[26rem] z-50 origin-bottom-right transition-all duration-200',
                'bg-surface border border-subtle rounded-3xl shadow-2xl flex flex-col overflow-hidden',
                isOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-90 opacity-0 pointer-events-none invisible'
            )}
            style={{ height: '36rem', maxHeight: 'calc(100vh - 8rem)' }}
        >
            {/* Cabeçalho */}
            <header className="px-4 py-3 border-b border-subtle flex items-center gap-3 shrink-0 bg-surface">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-primary-hub leading-tight font-brand">Assistente Hubdesk</h3>
                    <p className="text-xs text-muted-hub flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                        IA com os dados do painel
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleNewConversation}
                    disabled={!hasConversation && !isLoading}
                    className="p-2 rounded-xl text-secondary-hub hover:text-primary-hub hover:bg-subtle disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Nova conversa"
                    aria-label="Nova conversa"
                >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-xl text-secondary-hub hover:text-primary-hub hover:bg-subtle transition-colors cursor-pointer"
                    title="Minimizar (a conversa é mantida)"
                    aria-label="Minimizar chat"
                >
                    <Minus className="w-4 h-4" aria-hidden="true" />
                </button>
            </header>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-canvas" role="log" aria-live="polite">
                {messages.map(msg => {
                    const isUser = msg.role === 'user';
                    return (
                        <div key={msg.id} className={cn('flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}>
                            {!isUser && (
                                <div className={cn(
                                    'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border',
                                    msg.error ? 'bg-rose-500/10 border-rose-500/30 text-rose-600' : 'bg-surface border-subtle text-rose-600 dark:text-rose-400'
                                )}>
                                    {msg.error ? <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" /> : <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />}
                                </div>
                            )}
                            <div className={cn('max-w-[85%] min-w-0 group', isUser && 'flex justify-end')}>
                                <div className={cn(
                                    'px-3.5 py-2.5 rounded-2xl text-sm break-words',
                                    isUser && 'bg-rose-600 text-white rounded-br-md',
                                    !isUser && !msg.error && 'bg-surface border border-subtle text-secondary-hub rounded-tl-md',
                                    msg.error && 'bg-rose-500/5 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-tl-md'
                                )}>
                                    {isUser || msg.error ? (
                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                    ) : (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>{msg.content}</ReactMarkdown>
                                    )}
                                    {msg.error && msg.retry && (
                                        <button
                                            type="button"
                                            onClick={() => send(msg.retry)}
                                            disabled={isLoading}
                                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-300 underline cursor-pointer disabled:opacity-50"
                                        >
                                            <RotateCcw className="w-3 h-3" aria-hidden="true" />Tentar novamente
                                        </button>
                                    )}
                                </div>
                                {!isUser && !msg.error && !msg.greeting && (
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(msg)}
                                        className="mt-1 ml-1 inline-flex items-center gap-1 text-xs text-muted-hub hover:text-primary-hub cursor-pointer"
                                        aria-label="Copiar resposta"
                                    >
                                        {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-500" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                                        {copiedId === msg.id ? 'Copiado' : 'Copiar'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {!hasConversation && !isLoading && (
                    <div className="pt-1" aria-label="Sugestões de perguntas">
                        <p className="text-xs font-semibold text-muted-hub uppercase tracking-wider mb-2">Sugestões</p>
                        <div className="flex flex-wrap gap-2">
                            {SUGGESTED_PROMPTS.map(prompt => (
                                <button
                                    key={prompt}
                                    type="button"
                                    onClick={() => send(prompt)}
                                    className="px-3 py-1.5 rounded-full text-xs font-semibold text-secondary-hub bg-surface border border-subtle hover:border-rose-500/40 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer text-left"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {isLoading && (
                    <div className="flex gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-surface border border-subtle text-rose-600 dark:text-rose-400">
                            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                        </div>
                        <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-surface border border-subtle"><TypingDots /></div>
                    </div>
                )}
                <div ref={endRef} />
            </div>

            {/* Campo de envio */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-subtle bg-surface shrink-0">
                <div className="flex items-end gap-2 rounded-2xl border border-subtle bg-canvas px-3 py-2 focus-within:border-rose-500/50 focus-within:ring-2 focus-within:ring-rose-500/20 transition-colors">
                    <textarea
                        ref={inputRef}
                        rows={1}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Pergunte sobre a equipe, KPIs ou escalas"
                        aria-label="Mensagem para o assistente"
                        maxLength={CHAT_LIMITS.message}
                        disabled={isLoading}
                        className="flex-1 bg-transparent resize-none outline-none text-sm text-primary-hub placeholder:text-muted-hub max-h-28 py-1 [field-sizing:content]"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="p-2 rounded-xl bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0 cursor-pointer"
                        aria-label="Enviar mensagem"
                    >
                        <Send className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>
                <p className="mt-2 text-xs text-muted-hub flex items-center gap-1.5 px-1">
                    <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
                    Exclusivo da gestão. A IA pode errar: confira os dados importantes.
                </p>
            </form>
        </section>
    );
}
