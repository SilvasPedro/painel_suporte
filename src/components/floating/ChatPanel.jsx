import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Send, RotateCcw, Copy, Check, AlertCircle, ShieldCheck, PictureInPicture, PictureInPicture2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getCachedCollection } from '../../services/dataCache';
import { getAuthHeaders, readAiError } from '../../services/apiAuth';
import { cn } from '../../utils/cn';
import { buildChatContext, buildChatHistory, SUGGESTED_PROMPTS, CHAT_LIMITS, AI_AGENT_NAME, AI_AGENT_TITLE } from '../../utils/floatingHub';
import {
    CHAT_SIZE, WIDE_BREAKPOINT, PIP_SIZE, clampChatSize, defaultChatSize, resizeFromCorner, resizeByKey,
    loadChatSize, saveChatSize, clearChatSize
} from '../../utils/chatLayout';
import { supportsDocumentPip, openChatPip, watchTheme } from '../../utils/chatPip';
import ClaudeBadge from './ClaudeBadge';
import AtlasAvatar from './AtlasAvatar';

const GREETING = {
    id: 'greeting',
    role: 'assistant',
    greeting: true,
    content: `${AI_AGENT_NAME}: extração de dados do painel, somente leitura. Informe o relatório, o período e os filtros. Áreas: equipe, avaliações, chamados, escalas, agenda e Smart Pre.`
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

// Detalhe técnico curto de um erro de rede do navegador
const sanitizeClientDetail = (error) => String(error?.name || error?.message || 'erro de conexão').slice(0, 80);

function TypingDots() {
    return (
        <span className="inline-flex items-center gap-1" aria-label="O assistente está escrevendo">
            {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-hub animate-bounce" style={{ animationDelay: `${i * 140}ms` }} />
            ))}
        </span>
    );
}

const IS_BROWSER = typeof window !== 'undefined';
const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });
const getStorage = () => {
    try { return window.localStorage; } catch { return null; } // pode lançar erro em janela privada
};

/**
 * Chat com o assistente de IA (exclusivo da gestão). Fica montado enquanto o botão flutuante existe,
 * então a conversa continua ao minimizar. O botão e a abertura ficam no FloatingHub.
 *
 * Tamanho: a alça no canto superior esquerdo redimensiona o painel (o tamanho fica salvo no navegador).
 * Janela flutuante: o botão do cabeçalho leva o chat para uma janela Picture-in-Picture que fica por cima
 * de tudo (Chrome/Edge); fechá-la devolve o chat ao painel. `onRestore` reabre o painel nesse retorno.
 */
export default function ChatPanel({ isOpen, onClose, onRestore }) {
    const [messages, setMessages] = useState([GREETING]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const endRef = useRef(null);
    const inputRef = useRef(null);
    const counter = useRef(0);

    // Tamanho do painel
    const [size, setSize] = useState(() => (IS_BROWSER
        ? loadChatSize(getStorage(), viewport())
        : { w: CHAT_SIZE.defaultW, h: CHAT_SIZE.defaultH }));
    const [wide, setWide] = useState(() => IS_BROWSER && window.innerWidth >= WIDE_BREAKPOINT);
    const [resizing, setResizing] = useState(false);
    const sizeRef = useRef(size);
    const dragRef = useRef(null);

    // Janela flutuante
    const [pipWindow, setPipWindow] = useState(null);
    const [pipNotice, setPipNotice] = useState('');
    const pipRef = useRef(null);
    const onRestoreRef = useRef(onRestore);
    const pipSupported = supportsDocumentPip();

    useEffect(() => { onRestoreRef.current = onRestore; }, [onRestore]);

    const applySize = (next) => {
        sizeRef.current = next;
        setSize(next);
    };

    // Ao girar ou redimensionar a janela do navegador, o painel continua cabendo na tela
    useEffect(() => {
        const onWindowResize = () => {
            setWide(window.innerWidth >= WIDE_BREAKPOINT);
            const next = clampChatSize(sizeRef.current, viewport());
            sizeRef.current = next;
            setSize(next);
        };
        window.addEventListener('resize', onWindowResize);
        return () => window.removeEventListener('resize', onWindowResize);
    }, []);

    // Fechar o chat fecha também a janela flutuante
    useEffect(() => () => { pipRef.current?.close(); }, []);

    const startResize = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        dragRef.current = { w: sizeRef.current.w, h: sizeRef.current.h, x: e.clientX, y: e.clientY };
        setResizing(true);
        e.preventDefault();
    };
    const moveResize = (e) => {
        if (!dragRef.current) return;
        applySize(resizeFromCorner(dragRef.current, { x: e.clientX, y: e.clientY }, viewport()));
    };
    const endResize = (e) => {
        if (!dragRef.current) return;
        dragRef.current = null;
        setResizing(false);
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        saveChatSize(getStorage(), sizeRef.current);
    };
    const resetSize = () => {
        clearChatSize(getStorage());
        applySize(defaultChatSize(viewport()));
    };
    const keyResize = (e) => {
        if (e.key === 'Enter' || e.key === 'Home') { e.preventDefault(); resetSize(); return; }
        const next = resizeByKey(sizeRef.current, e.key, viewport());
        if (next === sizeRef.current) return;
        e.preventDefault();
        applySize(next);
        saveChatSize(getStorage(), next);
    };

    const showPipNotice = (text) => {
        setPipNotice(text);
        setTimeout(() => setPipNotice(''), 5000);
    };

    const openPip = async () => {
        try {
            const pip = await openChatPip(window, PIP_SIZE);
            const stopTheme = watchTheme(document, pip.document);
            const handleClose = () => {
                stopTheme();
                pip.removeEventListener('pagehide', handleClose);
                if (pipRef.current === pip) pipRef.current = null;
                setPipWindow(null);
                onRestoreRef.current?.(); // devolve o chat ao painel
            };
            pip.addEventListener('pagehide', handleClose);
            pipRef.current = pip;
            setPipWindow(pip);
        } catch (error) {
            console.error('Não foi possível abrir a janela flutuante:', error);
            showPipNotice('Não foi possível abrir a janela flutuante.');
        }
    };
    const closePip = () => pipRef.current?.close();

    const nextId = () => { counter.current += 1; return `m${counter.current}`; };
    const hasConversation = messages.some(m => !m.greeting);

    // Role até a última mensagem
    useEffect(() => {
        endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
    }, [messages, isLoading, isOpen]);

    // Foco no campo ao abrir (no painel ou na janela flutuante)
    useEffect(() => {
        if (isOpen || pipWindow) inputRef.current?.focus();
    }, [isOpen, pipWindow]);

    const send = async (rawText, { isRetry = false } = {}) => {
        const text = String(rawText || '').trim();
        if (!text || isLoading) return;
        if (text.length > CHAT_LIMITS.message) {
            setMessages(prev => [...prev, { id: nextId(), role: 'assistant', error: true, content: `A mensagem passa de ${CHAT_LIMITS.message} caracteres. Resuma a pergunta.` }]);
            return;
        }

        // Ao tentar de novo, a pergunta já está na conversa: não repete a bolha nem o histórico
        const lastUser = [...messages].reverse().find(m => m.role === 'user');
        const alreadyShown = isRetry && lastUser && lastUser.content === text;
        const history = buildChatHistory(alreadyShown ? messages.filter(m => m.id !== lastUser.id) : messages);
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
        setMessages(prev => (alreadyShown
            ? prev.filter(m => !m.error)
            : [...prev.filter(m => !m.error), { id: nextId(), role: 'user', content: text }]));
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
            const data = await response.json().catch(() => null);

            if (response.ok && data?.reply) {
                setMessages(prev => [...prev, {
                    id: nextId(), role: 'assistant', content: data.reply,
                    consultas: Array.isArray(data.consultas) ? data.consultas.slice(0, 12) : []
                }]);
            } else {
                const failure = response.ok
                    ? { message: 'A IA não devolveu uma resposta. Tente reformular a pergunta.', detail: `HTTP ${response.status} • resposta vazia`, retryable: true }
                    : readAiError(response.status, data);
                setMessages(prev => [...prev, {
                    id: nextId(), role: 'assistant', error: true, retry: failure.retryable ? text : '',
                    content: failure.message, detail: failure.detail
                }]);
            }
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            setMessages(prev => [...prev, {
                id: nextId(), role: 'assistant', error: true, retry: text,
                content: error?.message?.includes('Entre no sistema') ? error.message : 'Não foi possível conectar ao servidor. Confira sua internet e tente de novo.',
                detail: sanitizeClientDetail(error)
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

    const inPip = Boolean(pipWindow);
    const pipTitle = !pipSupported
        ? 'Janela flutuante indisponível neste navegador (use o Chrome ou o Edge)'
        : (inPip ? 'Voltar ao painel' : 'Janela flutuante: fica por cima de tudo');

    const panel = (
        <section
            id="floating-chat-panel"
            role="dialog"
            aria-label={`${AI_AGENT_NAME}, ${AI_AGENT_TITLE}`}
            aria-hidden={!isOpen && !inPip}
            className={inPip
                ? 'w-screen h-screen bg-surface flex flex-col overflow-hidden'
                : cn(
                    'fixed bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[26rem] z-50 origin-bottom-right transition-all duration-200',
                    'bg-surface border border-subtle rounded-3xl shadow-2xl flex flex-col overflow-hidden',
                    isOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-90 opacity-0 pointer-events-none invisible',
                    resizing && 'transition-none select-none'
                )}
            style={inPip
                ? undefined
                : (wide
                    ? { width: size.w, height: size.h, maxHeight: 'calc(100vh - 8rem)' }
                    : { height: '36rem', maxHeight: 'calc(100vh - 8rem)' })}
        >
            {/* Alça de redimensionar (canto superior esquerdo): arraste, use as setas ou clique duas vezes para restaurar */}
            {wide && !inPip && (
                <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Redimensionar o chat. Arraste ou use as setas do teclado; Enter restaura o tamanho."
                    tabIndex={isOpen ? 0 : -1}
                    onPointerDown={startResize}
                    onPointerMove={moveResize}
                    onPointerUp={endResize}
                    onPointerCancel={endResize}
                    onDoubleClick={resetSize}
                    onKeyDown={keyResize}
                    title="Arraste para redimensionar (duplo clique restaura o tamanho)"
                    className="absolute top-1.5 left-1.5 z-10 w-6 h-6 flex items-center justify-center rounded-lg cursor-nwse-resize touch-none text-muted-hub hover:text-rose-600 hover:bg-subtle focus-visible:text-rose-600 focus-visible:bg-subtle focus-visible:outline-none transition-colors"
                >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M10.5 1.5 1.5 10.5M10.5 6 6 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                </div>
            )}

            {/* Cabeçalho */}
            <header className={cn('py-3 border-b border-subtle flex items-center gap-1 sm:gap-2 shrink-0 bg-surface', wide && !inPip ? 'pl-9 pr-3' : 'pl-3 pr-2 sm:px-4')}>
                <AtlasAvatar size={44} className="shrink-0 rounded-2xl shadow-sm ring-1 ring-rose-500/30" />
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-primary-hub leading-tight font-brand truncate">{AI_AGENT_NAME}</h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs text-muted-hub whitespace-nowrap">{AI_AGENT_TITLE}</span>
                        <ClaudeBadge />
                    </div>
                </div>
                <button
                    type="button"
                    onClick={inPip ? closePip : openPip}
                    disabled={!pipSupported}
                    className="p-2 rounded-xl text-secondary-hub hover:text-primary-hub hover:bg-subtle disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title={pipTitle}
                    aria-label={inPip ? 'Voltar o chat para o painel' : 'Abrir o chat em janela flutuante'}
                >
                    {inPip ? <PictureInPicture className="w-4 h-4" aria-hidden="true" /> : <PictureInPicture2 className="w-4 h-4" aria-hidden="true" />}
                </button>
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
                {!inPip && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-secondary-hub hover:text-primary-hub hover:bg-subtle transition-colors cursor-pointer"
                        title="Minimizar (a conversa é mantida)"
                        aria-label="Minimizar chat"
                    >
                        <Minus className="w-4 h-4" aria-hidden="true" />
                    </button>
                )}
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
                                    msg.error ? 'bg-rose-500/10 border-rose-500/30 text-rose-600' : 'border-subtle overflow-hidden'
                                )}>
                                    {msg.error ? <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" /> : <AtlasAvatar size={28} shape="circle" />}
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
                                    {!isUser && !msg.error && msg.consultas?.length > 0 && (
                                        <p className="mt-2 pt-2 border-t border-subtle text-xs text-muted-hub break-words" title="Dados lidos no banco para montar esta resposta">
                                            Consultou: {msg.consultas.join(' · ')}
                                        </p>
                                    )}
                                    {msg.error && msg.detail && (
                                        <p className="mt-1.5 text-xs font-mono opacity-80 break-words" title="Detalhe técnico do erro">
                                            {msg.detail}
                                        </p>
                                    )}
                                    {msg.error && msg.retry && (
                                        <button
                                            type="button"
                                            onClick={() => send(msg.retry, { isRetry: true })}
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
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border border-subtle overflow-hidden">
                            <AtlasAvatar size={28} shape="circle" />
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
                        placeholder="Informe o relatório, o período e os filtros"
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
                {pipNotice && (
                    <p role="status" className="mt-1 text-xs text-rose-600 dark:text-rose-400 px-1">{pipNotice}</p>
                )}
            </form>
        </section>
    );

    // Na janela flutuante o mesmo painel é desenhado dentro do documento dela; o painel fixo some do site
    return inPip ? createPortal(panel, pipWindow.document.body) : panel;
}
