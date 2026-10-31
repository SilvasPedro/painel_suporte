import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

// Esquema de sanitização personalizado permitindo classes e atributos de tabela
const customSanitizeSchema = {
    ...defaultSchema,
    attributes: {
        ...defaultSchema.attributes,
        '*': [...(defaultSchema.attributes?.['*'] || []), 'className', 'style'],
        th: [...(defaultSchema.attributes?.th || []), 'align', 'scope'],
        td: [...(defaultSchema.attributes?.td || []), 'align'],
    }
};

export const markdownComponents = {
    // TABELAS COM VISUALIZAÇÃO COMPLETA, BORDAS, HEADER E ZEBRADO
    table: ({ node, ...props }) => (
        <div className="overflow-x-auto my-5 rounded-xl border border-gray-300 dark:border-zinc-700 shadow-sm bg-white dark:bg-zinc-900">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700 border-collapse text-left text-xs sm:text-sm" {...props} />
        </div>
    ),
    thead: ({ node, ...props }) => (
        <thead className="bg-zinc-950 text-white font-bold tracking-wider" {...props} />
    ),
    th: ({ node, ...props }) => (
        <th className="px-4 py-3 font-black text-xs uppercase tracking-wider text-zinc-100 bg-zinc-900 border-b-2 border-zinc-700 whitespace-nowrap shadow-2xs" {...props} />
    ),
    tbody: ({ node, ...props }) => (
        <tbody className="divide-y divide-gray-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900" {...props} />
    ),
    tr: ({ node, ...props }) => (
        <tr className="hover:bg-red-50/50 dark:hover:bg-zinc-800/60 transition-colors odd:bg-white dark:odd:bg-zinc-900 even:bg-gray-50/70 dark:even:bg-zinc-950/40" {...props} />
    ),
    td: ({ node, ...props }) => (
        <td className="px-4 py-3 text-xs sm:text-sm text-gray-800 dark:text-zinc-200 border-b border-gray-200 dark:border-zinc-800 align-top leading-relaxed" {...props} />
    ),

    // CABEÇALHOS ESTATUTÁRIOS
    h1: ({ node, ...props }) => (
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-zinc-100 mt-6 mb-3 pb-2 border-b-2 border-red-600 tracking-tight" {...props} />
    ),
    h2: ({ node, ...props }) => (
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-zinc-100 mt-5 mb-2.5 pb-1.5 border-b border-gray-200 dark:border-zinc-800" {...props} />
    ),
    h3: ({ node, ...props }) => (
        <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-zinc-200 mt-4 mb-2" {...props} />
    ),
    h4: ({ node, ...props }) => (
        <h4 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-zinc-200 mt-3 mb-1.5" {...props} />
    ),

    // PARÁGRAFOS E TIPOGRAFIA
    p: ({ node, ...props }) => (
        <p className="text-xs sm:text-sm text-gray-800 dark:text-zinc-200 leading-relaxed my-2" {...props} />
    ),
    strong: ({ node, ...props }) => (
        <strong className="font-black text-gray-950 dark:text-white" {...props} />
    ),
    em: ({ node, ...props }) => (
        <em className="italic text-gray-700 dark:text-zinc-300" {...props} />
    ),

    // LISTAS
    ul: ({ node, ...props }) => (
        <ul className="list-disc list-inside space-y-1.5 my-3 text-xs sm:text-sm text-gray-800 dark:text-zinc-200 pl-2" {...props} />
    ),
    ol: ({ node, ...props }) => (
        <ol className="list-decimal list-inside space-y-1.5 my-3 text-xs sm:text-sm text-gray-800 dark:text-zinc-200 pl-2" {...props} />
    ),
    li: ({ node, ...props }) => (
        <li className="leading-relaxed" {...props} />
    ),

    // CITAÇÕES E BLOCOS DE DESTAQUE
    blockquote: ({ node, ...props }) => (
        <blockquote className="border-l-4 border-red-500 bg-red-50/60 dark:bg-red-950/20 px-4 py-2.5 rounded-r-xl my-4 text-xs sm:text-sm text-red-950 dark:text-red-200 italic shadow-2xs" {...props} />
    ),

    // CÓDIGO INLINE E BLOCOS
    code: ({ node, inline, className, children, ...props }) => (
        <code className="bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 font-mono text-xs font-semibold" {...props}>
            {children}
        </code>
    ),
    pre: ({ node, ...props }) => (
        <pre className="bg-zinc-950 text-zinc-100 p-4 rounded-xl overflow-x-auto my-4 border border-zinc-800 font-mono text-xs leading-normal" {...props} />
    ),

    // DIVISOR
    hr: ({ node, ...props }) => (
        <hr className="my-6 border-gray-200 dark:border-zinc-800" {...props} />
    ),

    // LINKS
    a: ({ node, ...props }) => (
        <a className="text-red-600 dark:text-red-400 font-bold hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
    )
};

export default function MarkdownRenderer({ content, className = '' }) {
    if (!content) return null;

    return (
        <div className={`markdown-content ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[[rehypeSanitize, customSanitizeSchema]]}
                components={markdownComponents}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
