/**
 * Utilitário de Exportação de Dados em CSV e Markdown (.md)
 * Desenvolvido para o Gerenciador de Dados do Hubdesk (v3.10.1+)
 * Otimizado para planilhas e para anexar na pasta __dados_colaboradores para análise mensal de IA.
 */

import { calculatePerformanceScore } from './scoringCalculations';

/**
 * Escapa valores para formato CSV padrão RFC 4180
 * @param {any} val
 * @returns {string}
 */
export const escapeCsvValue = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
};

/**
 * Dispara o download de um arquivo no navegador via Blob
 * @param {BlobPart} content
 * @param {string} filename
 * @param {string} mimeType
 */
export const downloadBlob = (content, filename, mimeType = 'text/plain;charset=utf-8;') => {
    if (typeof window === 'undefined') return;
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Gera string CSV com BOM UTF-8 (\uFEFF) para compatibilidade nativa com Excel Windows
 * @param {Object} options
 * @param {string[]} options.headers
 * @param {Array<Array<any>>} options.rows
 * @param {string} [options.delimiter=';']
 * @returns {string}
 */
export const generateCsvString = ({ headers, rows, delimiter = ';' }) => {
    const headerLine = headers.map(escapeCsvValue).join(delimiter);
    const bodyLines = rows.map((r) => r.map(escapeCsvValue).join(delimiter));
    return '\uFEFF' + [headerLine, ...bodyLines].join('\r\n');
};

/**
 * Formata um valor seguro para células de tabela Markdown (sem quebras de linha ou pipes soltos)
 * @param {any} val
 * @returns {string}
 */
export const sanitizeMarkdownTableCell = (val) => {
    if (val === null || val === undefined) return '-';
    return String(val)
        .replace(/\|/g, '\\|')
        .replace(/\r?\n/g, ' ')
        .trim() || '-';
};

/**
 * Gera string Markdown estruturada para ingestão por IA e leitura humana
 * @param {Object} options
 * @param {string} options.title
 * @param {string} [options.subtitle]
 * @param {Record<string, string|number>} [options.metadata]
 * @param {Record<string, string|number>} [options.summaryStats]
 * @param {string[]} options.headers
 * @param {Array<Array<any>>} options.rows
 * @param {Array<Object>} [options.detailedItems]
 * @returns {string}
 */
export const generateMarkdownString = ({
    title,
    subtitle,
    metadata = {},
    summaryStats = {},
    headers = [],
    rows = [],
    detailedItems = []
}) => {
    const lines = [];

    // Título Principal
    lines.push(`# ${title}`);
    if (subtitle) {
        lines.push(`> ${subtitle}`);
    }
    lines.push('');

    // Metadados do Relatório
    if (Object.keys(metadata).length > 0) {
        lines.push('## Metadados do Relatório');
        Object.entries(metadata).forEach(([key, val]) => {
            lines.push(`- **${key}:** ${val}`);
        });
        lines.push('');
    }

    // Resumo Estatístico Consolidado
    if (Object.keys(summaryStats).length > 0) {
        lines.push('## Resumo Estatístico Consolidado');
        Object.entries(summaryStats).forEach(([key, val]) => {
            lines.push(`- **${key}:** ${val}`);
        });
        lines.push('');
    }

    // Tabela GFM
    if (headers.length > 0 && rows.length > 0) {
        lines.push('## Tabela Consolidada de Registros');
        const headerRow = `| ${headers.map(sanitizeMarkdownTableCell).join(' | ')} |`;
        const separatorRow = `| ${headers.map(() => ':---').join(' | ')} |`;
        lines.push(headerRow);
        lines.push(separatorRow);
        rows.forEach((row) => {
            lines.push(`| ${row.map(sanitizeMarkdownTableCell).join(' | ')} |`);
        });
        lines.push('');
    }

    // Seção Detalhada para Leitura Analítica da IA
    if (detailedItems.length > 0) {
        lines.push('## Detalhamento Integral para Ingestão por IA');
        lines.push('Esta seção preserva todos os pareceres, notas e observações completas dos registros.');
        lines.push('');

        detailedItems.forEach((item, index) => {
            lines.push(`### Registro #${index + 1} — ${item.title || 'Sem título'}`);
            if (item.properties && Object.keys(item.properties).length > 0) {
                Object.entries(item.properties).forEach(([k, v]) => {
                    if (v !== undefined && v !== null && v !== '') {
                        lines.push(`- **${k}:** ${v}`);
                    }
                });
            }
            if (item.content) {
                lines.push('- **Conteúdo / Parecer Completo:**');
                // Formata bloco de citação
                const contentLines = String(item.content).split(/\r?\n/);
                contentLines.forEach((cL) => {
                    lines.push(`  > ${cL}`);
                });
            }
            lines.push('');
            lines.push('---');
            lines.push('');
        });
    }

    return lines.join('\n');
};

/**
 * Prepara os dados do DataManager conforme a aba ativa para exportação
 * @param {Object} params
 * @param {string} params.activeTab - 'feedbacks' | 'metrics' | 'kpis' | 'audits'
 * @param {Array<Object>} params.data - Registros a exportar
 * @param {Record<string, string>} params.collaboratorsMap - Mapa ID -> Nome
 * @param {Record<string, string>} [params.qaProcesses={}] - Mapa ID Processo -> Nome
 * @param {Object} [params.statsSummary={}] - Resumo estatístico
 * @param {Object} [params.filtersContext={}] - Informações dos filtros (período, colaborador)
 * @returns {{ headers: string[], rows: Array<Array<any>>, detailedItems: Array<Object>, summaryStats: Record<string, any>, title: string, subtitle: string, defaultFilename: string }}
 */
export const prepareDataManagerExport = ({
    activeTab,
    data = [],
    collaboratorsMap = {},
    qaProcesses = {},
    statsSummary = {},
    filtersContext = {}
}) => {
    const nowIso = new Date().toISOString().split('T')[0];
    const colabFilterName = filtersContext.colabFilterName || 'Todos';
    const periodLabel = filtersContext.periodLabel || 'Todos';

    const getColabName = (item) => {
        const id = item.colabId || item.collaboratorId;
        return collaboratorsMap[id] || item.colabName || item.collaboratorName || id || 'Não identificado';
    };

    const getFormattedDate = (item) => {
        if (item.date) {
            if (typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.date)) {
                const [y, m, d] = item.date.substring(0, 10).split('-');
                return `${d}/${m}/${y}`;
            }
            return String(item.date);
        }
        if (item.createdAt) {
            try {
                if (typeof item.createdAt.toDate === 'function') {
                    return item.createdAt.toDate().toLocaleDateString('pt-BR');
                }
                return new Date(item.createdAt).toLocaleDateString('pt-BR');
            } catch {
                return 'Sem data';
            }
        }
        return 'Sem data';
    };

    // 1. ABA: FEEDBACKS
    if (activeTab === 'feedbacks') {
        const headers = [
            'Data',
            'Colaborador',
            'Tipo',
            'Protocolo',
            'Canal / Meio',
            'Autor do Feedback',
            'Status Leitura',
            'Data Leitura',
            'Tags',
            'Comentário'
        ];

        const rows = data.map((item) => {
            const tagsStr = Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || '');
            const readStatus = item.read ? 'Lido' : 'Pendente';
            const readAt = item.readAt ? (typeof item.readAt === 'string' ? item.readAt : new Date(item.readAt).toLocaleString('pt-BR')) : '-';
            return [
                getFormattedDate(item),
                getColabName(item),
                item.type || 'Geral',
                item.protocol || '-',
                item.method || '-',
                item.createdBy || 'Gestão',
                readStatus,
                readAt,
                tagsStr,
                item.comment || ''
            ];
        });

        const detailedItems = data.map((item) => ({
            title: `${getColabName(item)} — ${item.type || 'Feedback'} (${getFormattedDate(item)})`,
            properties: {
                Colaborador: getColabName(item),
                Data: getFormattedDate(item),
                Tipo: item.type || 'Geral',
                Protocolo: item.protocol || '-',
                Canal: item.method || '-',
                'Autor do Feedback': item.createdBy || 'Gestão',
                'Status de Leitura': item.read ? 'Lido pelo colaborador' : 'Pendente de leitura',
                Tags: Array.isArray(item.tags) ? item.tags.join(', ') : item.tags
            },
            content: item.comment || 'Sem comentário registrado.'
        }));

        const summaryStats = {
            'Total de Registros': data.length,
            'Elogios': statsSummary.elogios || data.filter((i) => i.type === 'Elogio').length,
            'Pontos de Melhoria': statsSummary.melhorias || data.filter((i) => i.type === 'Ponto de Melhoria').length,
            'Orientações': statsSummary.orientacoes || data.filter((i) => i.type === 'Orientação').length,
            'Lidos': statsSummary.lidos || data.filter((i) => Boolean(i.read)).length,
            'Pendentes de Leitura': statsSummary.pendentes || data.filter((i) => !i.read).length
        };

        const safeColabPart = colabFilterName !== 'Todos' ? `_${colabFilterName.replace(/\s+/g, '_')}` : '';

        return {
            headers,
            rows,
            detailedItems,
            summaryStats,
            title: 'Hubdesk — Relatório de Feedbacks de Colaboradores',
            subtitle: `Exportação para análise e acompanhamento de feedbacks operacionais (Período: ${periodLabel} | pasta __dados_colaboradores)`,
            defaultFilename: `hubdesk_feedbacks${safeColabPart}_${nowIso}`
        };
    }

    // 2. ABA: DESEMPENHO / MÉTRICAS (weekly_evaluations)
    if (activeTab === 'metrics') {
        const headers = [
            'Data Referência',
            'Colaborador',
            'Atendimentos Finalizados',
            'Atendimentos Huggy',
            'Ligações Atendidas',
            'Ligações Perdidas',
            'TMA Telefonia',
            'TMA Huggy',
            'TME Telefonia',
            'Pontuação (Score)',
            'Avaliador / Supervisor',
            'Observações'
        ];

        const rows = data.map((item) => [
            getFormattedDate(item),
            getColabName(item),
            Number(item.Atendimentos_Finalizados) || 0,
            Number(item.Atendimentos_Huggy) || 0,
            Number(item.Ligacoes_Atendidas) || 0,
            Number(item.Ligacoes_Perdidas) || 0,
            item.TMA_Telefonia || '-',
            item.TMA_Huggy || '-',
            item.TME_Telefonia || '-',
            calculatePerformanceScore(item),
            item.evaluatorName || item.createdBy || 'Sistema',
            item.notes || item.comment || ''
        ]);

        const detailedItems = data.map((item) => ({
            title: `${getColabName(item)} — Desempenho (${getFormattedDate(item)})`,
            properties: {
                Colaborador: getColabName(item),
                'Data de Referência': getFormattedDate(item),
                'Atendimentos Finalizados': item.Atendimentos_Finalizados || 0,
                'Atendimentos Huggy': item.Atendimentos_Huggy || 0,
                'Ligações Atendidas': item.Ligacoes_Atendidas || 0,
                'Ligações Perdidas': item.Ligacoes_Perdidas || 0,
                'TMA Telefonia': item.TMA_Telefonia || '-',
                'TMA Huggy': item.TMA_Huggy || '-',
                'TME Telefonia': item.TME_Telefonia || '-',
                'Pontuação Estimada': `${calculatePerformanceScore(item)} pts`,
                Avaliador: item.evaluatorName || item.createdBy || 'Sistema'
            },
            content: item.notes || item.comment || 'Sem observações adicionais.'
        }));

        let sumFinalizados = 0;
        let sumHuggy = 0;
        let sumScore = 0;
        data.forEach((i) => {
            sumFinalizados += Number(i.Atendimentos_Finalizados) || 0;
            sumHuggy += Number(i.Atendimentos_Huggy) || 0;
            sumScore += calculatePerformanceScore(i);
        });

        const summaryStats = {
            'Total de Avaliações': data.length,
            'Total Atendimentos Finalizados': sumFinalizados,
            'Total Atendimentos Huggy': sumHuggy,
            'Média de Pontuação': data.length > 0 ? `${Math.round(sumScore / data.length)} pts` : '0 pts'
        };

        const safeColabPart = colabFilterName !== 'Todos' ? `_${colabFilterName.replace(/\s+/g, '_')}` : '';

        return {
            headers,
            rows,
            detailedItems,
            summaryStats,
            title: 'Hubdesk — Métricas de Desempenho e Produtividade',
            subtitle: `Relatório para análise quantitativa e qualitativa de produtividade da equipe (Período: ${periodLabel} | pasta __dados_colaboradores)`,
            defaultFilename: `hubdesk_desempenho${safeColabPart}_${nowIso}`
        };
    }

    // 3. ABA: AUDITORIAS QA (qa_audits)
    if (activeTab === 'audits') {
        const getProcessName = (item) => {
            const proc = qaProcesses[item.processId];
            if (typeof proc === 'string') return proc;
            if (proc && typeof proc === 'object') {
                return proc.name || proc.title || proc.processName || item.processId;
            }
            return item.processName || item.process || 'Geral';
        };

        const headers = [
            'Data',
            'Colaborador',
            'Processo Auditado',
            'Status Conformidade',
            'Nota / Pontuação',
            'Protocolo',
            'Auditor / Avaliador',
            'Observações / Parecer'
        ];

        const rows = data.map((item) => {
            const processName = getProcessName(item);
            return [
                getFormattedDate(item),
                getColabName(item),
                processName,
                item.status || 'Não Conforme',
                item.score !== undefined ? `${item.score} pts` : '-',
                item.protocol || '-',
                item.evaluatorName || item.auditorName || 'Auditor',
                item.notes || ''
            ];
        });

        const detailedItems = data.map((item) => {
            const processName = getProcessName(item);
            return {
                title: `${getColabName(item)} — ${item.status || 'Auditoria'} (${getFormattedDate(item)})`,
                properties: {
                    Colaborador: getColabName(item),
                    Data: getFormattedDate(item),
                    Processo: processName,
                    Status: item.status || 'Não Conforme',
                    Nota: item.score !== undefined ? `${item.score} pts` : '-',
                    Protocolo: item.protocol || '-',
                    Auditor: item.evaluatorName || item.auditorName || 'Auditor'
                },
                content: item.notes || 'Sem observações registradas pelo auditor.'
            };
        });

        const conformes = data.filter((i) => i.status === 'Conforme').length;
        const nConformes = data.filter((i) => i.status === 'Não Conforme').length;
        const rate = data.length > 0 ? Math.round((conformes / data.length) * 100) : 0;

        const summaryStats = {
            'Total de Auditorias': data.length,
            'Auditorias Conformes': conformes,
            'Auditorias Não Conformes': nConformes,
            'Taxa de Conformidade': `${rate}%`
        };

        const safeColabPart = colabFilterName !== 'Todos' ? `_${colabFilterName.replace(/\s+/g, '_')}` : '';

        return {
            headers,
            rows,
            detailedItems,
            summaryStats,
            title: 'Hubdesk — Auditorias e Monitorias de Qualidade (QA)',
            subtitle: `Histórico de conformidade de processos e procedimentos de atendimento (Período: ${periodLabel} | pasta __dados_colaboradores)`,
            defaultFilename: `hubdesk_auditorias_qa${safeColabPart}_${nowIso}`
        };
    }

    // 4. ABA: KPIS DO SETOR (sector_kpis)
    const headers = [
        'Data Referência',
        'FCR (%)',
        'TMR',
        'Reincidência (%)',
        'Responsável',
        'Observações'
    ];

    const rows = data.map((item) => [
        getFormattedDate(item),
        item.fcr !== undefined ? `${item.fcr}%` : '-',
        item.tmr || '-',
        item.recurrence !== undefined ? `${item.recurrence}%` : '-',
        item.createdBy || 'Gestão',
        item.notes || ''
    ]);

    const detailedItems = data.map((item) => ({
        title: `KPI Setor (${getFormattedDate(item)})`,
        properties: {
            Data: getFormattedDate(item),
            'FCR (%)': item.fcr !== undefined ? `${item.fcr}%` : '-',
            TMR: item.tmr || '-',
            'Reincidência (%)': item.recurrence !== undefined ? `${item.recurrence}%` : '-',
            Responsável: item.createdBy || 'Gestão'
        },
        content: item.notes || 'Sem notas adicionais.'
    }));

    let sumFcr = 0;
    let sumRec = 0;
    data.forEach((i) => {
        sumFcr += Number(i.fcr) || 0;
        sumRec += Number(i.recurrence) || 0;
    });

    const summaryStats = {
        'Total de Lançamentos': data.length,
        'FCR Médio': data.length > 0 ? `${(sumFcr / data.length).toFixed(1)}%` : '0.0%',
        'Reincidência Média': data.length > 0 ? `${(sumRec / data.length).toFixed(1)}%` : '0.0%'
    };

    return {
        headers,
        rows,
        detailedItems,
        summaryStats,
        title: 'Hubdesk — Indicadores e Metas (KPIs do Setor)',
        subtitle: `Histórico de FCR, TMR e Reincidência operacional do provedor (Período: ${periodLabel} | pasta __dados_colaboradores)`,
        defaultFilename: `hubdesk_kpis_setor_${nowIso}`
    };
};

/**
 * Executa o download de exportação nos formatos .csv ou .md
 * @param {Object} params
 * @param {'csv'|'md'} params.format
 * @param {string} params.activeTab
 * @param {Array<Object>} params.data
 * @param {Record<string, string>} params.collaboratorsMap
 * @param {Record<string, string>} [params.qaProcesses={}]
 * @param {Object} [params.statsSummary={}]
 * @param {Object} [params.filtersContext={}]
 */
export const executeDataExport = ({
    format = 'csv',
    activeTab,
    data = [],
    collaboratorsMap = {},
    qaProcesses = {},
    statsSummary = {},
    filtersContext = {}
}) => {
    const prep = prepareDataManagerExport({
        activeTab,
        data,
        collaboratorsMap,
        qaProcesses,
        statsSummary,
        filtersContext
    });

    if (format === 'csv') {
        const csvContent = generateCsvString({
            headers: prep.headers,
            rows: prep.rows,
            delimiter: ';'
        });
        downloadBlob(csvContent, `${prep.defaultFilename}.csv`, 'text/csv;charset=utf-8;');
        return { success: true, filename: `${prep.defaultFilename}.csv`, format: 'csv', count: data.length };
    }

    if (format === 'md') {
        const metadata = {
            'Origem': 'Hubdesk DataManager v3.10.1',
            'Data da Extração': `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
            'Aba / Módulo': prep.title,
            'Colaborador Selecionado': filtersContext.colabFilterName || 'Todos',
            'Período Aplicado': filtersContext.periodLabel || 'Todos',
            'Total de Registros': data.length,
            'Diretório de Destino': '__dados_colaboradores/ (Para análise mensal de IA)'
        };

        const mdContent = generateMarkdownString({
            title: prep.title,
            subtitle: prep.subtitle,
            metadata,
            summaryStats: prep.summaryStats,
            headers: prep.headers,
            rows: prep.rows,
            detailedItems: prep.detailedItems
        });

        downloadBlob(mdContent, `${prep.defaultFilename}.md`, 'text/markdown;charset=utf-8;');
        return { success: true, filename: `${prep.defaultFilename}.md`, format: 'md', count: data.length };
    }

    throw new Error(`Formato de exportação não suportado: ${format}`);
};
