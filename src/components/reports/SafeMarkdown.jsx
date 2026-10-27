import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { sanitizeMarkdownInput } from '../../types/request.types';

/**
 * Schema estrito de sanitização para GitHub Flavored Markdown (GFM)
 * Permite tabelas, listas de tarefas, blocos de código e formatação de texto,
 * bloqueando rigorosamente tags e atributos executáveis (XSS).
 */
const SAFE_MARKDOWN_SCHEMA = {
    ...defaultSchema,
    tagNames: Array.from(
        new Set([
            ...(defaultSchema.tagNames || []),
            'table',
            'thead',
            'tbody',
            'tfoot',
            'tr',
            'th',
            'td',
            'del',
            'input',
            'hr',
            'br',
            'pre',
            'code',
            'blockquote',
            'ul',
            'ol',
            'li',
            'p',
            'strong',
            'em',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'a'
        ])
    ).filter(
        (tag) =>
            !['script', 'iframe', 'object', 'embed', 'style', 'form', 'button', 'textarea', 'select', 'meta', 'link'].includes(
                tag
            )
    ),
    attributes: {
        ...defaultSchema.attributes,
        a: ['href', 'title'],
        th: ['align'],
        td: ['align'],
        input: [['type', 'checkbox'], 'checked', 'disabled'],
        code: ['className']
    },
    protocols: {
        ...defaultSchema.protocols,
        href: ['http', 'https', 'mailto']
    }
};

/**
 * Componente de Renderização Markdown Seguro (v3.10.1)
 * Suporta GFM (tabelas | col | col |, checklists, blocos de código, links e ênfase)
 * com sanitização anti-XSS via rehype-sanitize e estilização responsiva Tailwind.
 */
export default function SafeMarkdown({
    content = '',
    className = '',
    variant = 'light'
}) {
    const cleanContent = useMemo(() => sanitizeMarkdownInput(content), [content]);

    const isDarkVariant = variant === 'dark';

    if (!cleanContent.trim()) {
        return (
            <p className={`text-xs italic ${isDarkVariant ? 'text-slate-400' : 'text-gray-400'}`}>
                Nenhum detalhe adicional informado.
            </p>
        );
    }

    return (
        <div
            className={`prose dark:prose-invert max-w-none text-sm leading-relaxed break-words ${
                isDarkVariant ? 'text-slate-200' : 'text-gray-800'
            } ${className}`}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[[rehypeSanitize, SAFE_MARKDOWN_SCHEMA]]}
                components={{
                    h1: ({ children }) => (
                        <h1 className="text-base sm:text-lg font-extrabold mt-3 mb-2 pb-1 border-b border-gray-200 dark:border-zinc-700">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-sm sm:text-base font-bold mt-3 mb-1.5 pb-1 border-b border-gray-200/80 dark:border-zinc-700/80">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-sm font-bold mt-2.5 mb-1">
                            {children}
                        </h3>
                    ),
                    p: ({ children }) => (
                        <p className="mb-2.5 last:mb-0 leading-relaxed whitespace-pre-line">
                            {children}
                        </p>
                    ),
                    ul: ({ children }) => (
                        <ul className="list-disc pl-5 mb-2.5 space-y-1">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal pl-5 mb-2.5 space-y-1">
                            {children}
                        </ol>
                    ),
                    li: ({ children }) => (
                        <li className="leading-relaxed">
                            {children}
                        </li>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote
                            className={`border-l-4 pl-3 py-1 my-2.5 italic rounded-r-lg ${
                                isDarkVariant
                                    ? 'border-sky-500 bg-slate-900/70 text-slate-300'
                                    : 'border-blue-500 bg-blue-50/50 text-gray-700'
                            }`}
                        >
                            {children}
                        </blockquote>
                    ),
                    a: ({ href, children }) => {
                        const safeHref =
                            href && /^(https?:\/\/|mailto:)/i.test(href) ? href : '#';
                        return (
                            <a
                                href={safeHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`font-semibold underline underline-offset-2 transition-colors ${
                                    isDarkVariant
                                        ? 'text-sky-400 hover:text-sky-300'
                                        : 'text-blue-600 hover:text-blue-800'
                                }`}
                            >
                                {children}
                            </a>
                        );
                    },
                    code: ({ inline, className: codeClass, children, ...props }) => {
                        const isBlock = !inline && (codeClass || String(children).includes('\n'));
                        if (isBlock) {
                            return (
                                <code
                                    className="block font-mono text-xs leading-relaxed overflow-x-auto"
                                    {...props}
                                >
                                    {children}
                                </code>
                            );
                        }
                        return (
                            <code
                                className={`px-1.5 py-0.5 rounded font-mono text-xs border ${
                                    isDarkVariant
                                        ? 'bg-slate-800 text-amber-300 border-slate-700'
                                        : 'bg-gray-100 text-rose-700 border-gray-200'
                                }`}
                                {...props}
                            >
                                {children}
                            </code>
                        );
                    },
                    pre: ({ children }) => (
                        <pre
                            className={`p-3 rounded-xl font-mono text-xs overflow-x-auto my-2.5 border ${
                                isDarkVariant
                                    ? 'bg-slate-950 text-slate-100 border-slate-800'
                                    : 'bg-zinc-900 text-zinc-100 border-zinc-800'
                            }`}
                        >
                            {children}
                        </pre>
                    ),
                    table: ({ children }) => (
                        <div
                            className={`my-3 w-full overflow-x-auto rounded-xl border shadow-2xs ${
                                isDarkVariant ? 'border-slate-700' : 'border-gray-200'
                            }`}
                        >
                            <table
                                className={`w-full border-collapse text-left text-xs ${
                                    isDarkVariant ? 'divide-y divide-slate-700' : 'divide-y divide-gray-200'
                                }`}
                            >
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead
                            className={
                                isDarkVariant
                                    ? 'bg-slate-800/90 text-slate-200 font-bold uppercase tracking-wider text-[11px]'
                                    : 'bg-gray-100 text-gray-800 font-bold uppercase tracking-wider text-[11px]'
                            }
                        >
                            {children}
                        </thead>
                    ),
                    tbody: ({ children }) => (
                        <tbody
                            className={
                                isDarkVariant
                                    ? 'divide-y divide-slate-800 bg-slate-900/40'
                                    : 'divide-y divide-gray-200 bg-white'
                            }
                        >
                            {children}
                        </tbody>
                    ),
                    tr: ({ children }) => (
                        <tr
                            className={
                                isDarkVariant
                                    ? 'hover:bg-slate-800/50 transition-colors'
                                    : 'hover:bg-gray-50/80 transition-colors'
                            }
                        >
                            {children}
                        </tr>
                    ),
                    th: ({ children, style }) => (
                        <th
                            style={style}
                            className={`px-3 py-2 font-bold border-r last:border-r-0 ${
                                isDarkVariant ? 'border-slate-700 text-slate-200' : 'border-gray-200 text-gray-800'
                            }`}
                        >
                            {children}
                        </th>
                    ),
                    td: ({ children, style }) => (
                        <td
                            style={style}
                            className={`px-3 py-2 align-top border-r last:border-r-0 ${
                                isDarkVariant ? 'border-slate-800 text-slate-200' : 'border-gray-200 text-gray-700'
                            }`}
                        >
                            {children}
                        </td>
                    ),
                    hr: () => (
                        <hr
                            className={`my-3 border-t ${
                                isDarkVariant ? 'border-slate-800' : 'border-gray-200'
                            }`}
                        />
                    ),
                    input: ({ checked }) => (
                        <input
                            type="checkbox"
                            checked={Boolean(checked)}
                            disabled
                            readOnly
                            className="mr-1.5 rounded border-gray-300 text-red-600 focus:ring-0 align-middle"
                        />
                    )
                }}
            >
                {cleanContent}
            </ReactMarkdown>
        </div>
    );
}
