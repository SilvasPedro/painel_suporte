import { describe, it, expect, vi } from 'vitest';
import {
    escapeCsvValue,
    generateCsvString,
    sanitizeMarkdownTableCell,
    generateMarkdownString,
    prepareDataManagerExport,
    executeDataExport
} from './dataExport';

describe('dataExport - Utilitários de Exportação', () => {
    describe('escapeCsvValue', () => {
        it('deve escapar strings normais entre aspas', () => {
            expect(escapeCsvValue('Texto simples')).toBe('"Texto simples"');
        });

        it('deve escapar aspas duplas internas duplicando-as (RFC 4180)', () => {
            expect(escapeCsvValue('Texto com "aspas"')).toBe('"Texto com ""aspas"""');
        });

        it('deve tratar null e undefined como aspas vazias', () => {
            expect(escapeCsvValue(null)).toBe('""');
            expect(escapeCsvValue(undefined)).toBe('""');
        });

        it('deve converter números e booleanos para string entre aspas', () => {
            expect(escapeCsvValue(123)).toBe('"123"');
            expect(escapeCsvValue(true)).toBe('"true"');
        });
    });

    describe('generateCsvString', () => {
        it('deve gerar CSV com BOM UTF-8 (\\uFEFF) e delimitador ;', () => {
            const headers = ['Nome', 'Idade', 'Status'];
            const rows = [
                ['João Silva', 28, 'Ativo'],
                ['Maria; Santos', 32, 'Pendente']
            ];
            const csv = generateCsvString({ headers, rows, delimiter: ';' });

            expect(csv.startsWith('\uFEFF')).toBe(true);
            expect(csv).toContain('"Nome";"Idade";"Status"');
            expect(csv).toContain('"João Silva";"28";"Ativo"');
            expect(csv).toContain('"Maria; Santos";"32";"Pendente"');
        });
    });

    describe('sanitizeMarkdownTableCell', () => {
        it('deve substituir pipes e quebras de linha', () => {
            const raw = 'Linha 1\nLinha 2 | teste';
            const sanitized = sanitizeMarkdownTableCell(raw);
            expect(sanitized).toBe('Linha 1 Linha 2 \\| teste');
        });

        it('deve retornar hífen para valores nulos ou vazios', () => {
            expect(sanitizeMarkdownTableCell(null)).toBe('-');
            expect(sanitizeMarkdownTableCell('')).toBe('-');
        });
    });

    describe('generateMarkdownString', () => {
        it('deve gerar cabeçalho, metadados, resumo e tabela GFM', () => {
            const md = generateMarkdownString({
                title: 'Relatório Mensal IA',
                subtitle: 'Exportação para pasta __dados_colaboradores',
                metadata: { 'Colaborador': 'Carlos', 'Mês': 'Outubro 2026' },
                summaryStats: { 'Total': 10, 'Aprovados': 8 },
                headers: ['Data', 'Item', 'Valor'],
                rows: [
                    ['2026-10-01', 'Atendimento A', '100%'],
                    ['2026-10-02', 'Atendimento B', '95%']
                ],
                detailedItems: [
                    {
                        title: 'Parecer do Feedback 1',
                        properties: { Tipo: 'Elogio', Protocolo: '123' },
                        content: 'Excelente atendimento prestado.'
                    }
                ]
            });

            expect(md).toContain('# Relatório Mensal IA');
            expect(md).toContain('> Exportação para pasta __dados_colaboradores');
            expect(md).toContain('## Metadados do Relatório');
            expect(md).toContain('- **Colaborador:** Carlos');
            expect(md).toContain('## Resumo Estatístico Consolidado');
            expect(md).toContain('- **Total:** 10');
            expect(md).toContain('## Tabela Consolidada de Registros');
            expect(md).toContain('| Data | Item | Valor |');
            expect(md).toContain('| :--- | :--- | :--- |');
            expect(md).toContain('| 2026-10-01 | Atendimento A | 100% |');
            expect(md).toContain('## Detalhamento Integral para Ingestão por IA');
            expect(md).toContain('### Registro #1 — Parecer do Feedback 1');
            expect(md).toContain('- **Tipo:** Elogio');
            expect(md).toContain('  > Excelente atendimento prestado.');
        });
    });

    describe('prepareDataManagerExport - Aba Feedbacks', () => {
        it('deve preparar dados de feedbacks com status de leitura e pareceres completos', () => {
            const feedbacksData = [
                {
                    id: 'fb-1',
                    colabId: 'c1',
                    date: '2026-10-15',
                    type: 'Elogio',
                    protocol: 'PROT-1001',
                    method: 'Huggy',
                    createdBy: 'Supervisor A',
                    read: true,
                    readAt: '2026-10-16T10:00:00.000Z',
                    tags: ['Proatividade', 'Agilidade'],
                    comment: 'Atendimento muito ágil e cordial ao cliente.'
                },
                {
                    id: 'fb-2',
                    colabId: 'c2',
                    date: '2026-10-20',
                    type: 'Ponto de Melhoria',
                    protocol: 'PROT-1002',
                    method: 'Telefonia',
                    createdBy: 'Supervisor B',
                    read: false,
                    tags: 'Atenção aos procedimentos',
                    comment: 'Necessário registrar o protocolo antes de finalizar.'
                }
            ];

            const colabMap = { c1: 'Carlos Silva', c2: 'Ana Souza' };

            const prep = prepareDataManagerExport({
                activeTab: 'feedbacks',
                data: feedbacksData,
                collaboratorsMap: colabMap,
                filtersContext: { colabFilterName: 'Carlos Silva', periodLabel: 'Este Mês' }
            });

            expect(prep.title).toContain('Relatório de Feedbacks');
            expect(prep.headers).toContain('Status Leitura');
            expect(prep.headers).toContain('Comentário');
            expect(prep.rows.length).toBe(2);
            expect(prep.rows[0][1]).toBe('Carlos Silva');
            expect(prep.rows[0][6]).toBe('Lido');
            expect(prep.rows[1][1]).toBe('Ana Souza');
            expect(prep.rows[1][6]).toBe('Pendente');
            expect(prep.detailedItems[0].content).toContain('Atendimento muito ágil');
            expect(prep.summaryStats['Total de Registros']).toBe(2);
            expect(prep.summaryStats['Elogios']).toBe(1);
            expect(prep.summaryStats['Pontos de Melhoria']).toBe(1);
        });
    });

    describe('prepareDataManagerExport - Aba Desempenho (metrics)', () => {
        it('deve preparar métricas com cálculo de score de desempenho', () => {
            const metricsData = [
                {
                    id: 'met-1',
                    colabId: 'c1',
                    date: '2026-10-22',
                    Atendimentos_Finalizados: 80,
                    Atendimentos_Huggy: 50,
                    Ligacoes_Atendidas: 30,
                    Ligacoes_Perdidas: 2,
                    TMA_Telefonia: '03:15',
                    TMA_Huggy: '08:40',
                    TME_Telefonia: '00:15',
                    evaluatorName: 'Gestor QA',
                    notes: 'Semana de alta produtividade.'
                }
            ];

            const colabMap = { c1: 'Carlos Silva' };

            const prep = prepareDataManagerExport({
                activeTab: 'metrics',
                data: metricsData,
                collaboratorsMap: colabMap
            });

            expect(prep.title).toContain('Métricas de Desempenho');
            expect(prep.headers).toContain('Pontuação (Score)');
            expect(prep.rows.length).toBe(1);
            expect(prep.rows[0][1]).toBe('Carlos Silva');
            expect(typeof prep.rows[0][9]).toBe('number');
            expect(prep.detailedItems[0].properties['Pontuação Estimada']).toContain('pts');
        });
    });

    describe('prepareDataManagerExport - Aba Auditorias (audits)', () => {
        it('deve preparar auditorias com status, taxa de conformidade e notas', () => {
            const auditsData = [
                {
                    id: 'aud-1',
                    colabId: 'c1',
                    date: '2026-10-18',
                    processId: 'proc-1',
                    status: 'Conforme',
                    score: 100,
                    protocol: 'PROT-999',
                    evaluatorName: 'Auditor Alpha',
                    notes: 'Script seguido à risca.'
                },
                {
                    id: 'aud-2',
                    colabId: 'c1',
                    date: '2026-10-19',
                    processId: 'proc-1',
                    status: 'Não Conforme',
                    score: 60,
                    protocol: 'PROT-1000',
                    evaluatorName: 'Auditor Beta',
                    notes: 'Faltou confirmação dos dados cadastrais.'
                }
            ];

            const colabMap = { c1: 'Carlos Silva' };
            const qaProcesses = { 'proc-1': { name: 'Atendimento Suporte N1' } };

            const prep = prepareDataManagerExport({
                activeTab: 'audits',
                data: auditsData,
                collaboratorsMap: colabMap,
                qaProcesses
            });

            expect(prep.title).toContain('Auditorias e Monitorias de Qualidade');
            expect(prep.summaryStats['Total de Auditorias']).toBe(2);
            expect(prep.summaryStats['Auditorias Conformes']).toBe(1);
            expect(prep.summaryStats['Taxa de Conformidade']).toBe('50%');
            expect(prep.rows[0][2]).toBe('Atendimento Suporte N1');
        });
    });

    describe('prepareDataManagerExport - Aba KPIs (kpis)', () => {
        it('deve preparar KPIs do setor calculando médias de FCR e Reincidência', () => {
            const kpisData = [
                { id: 'k1', date: '2026-09-01', fcr: 82.5, tmr: '04:10', recurrence: 15.2 },
                { id: 'k2', date: '2026-10-01', fcr: 86.5, tmr: '03:45', recurrence: 12.8 }
            ];

            const prep = prepareDataManagerExport({
                activeTab: 'kpis',
                data: kpisData
            });

            expect(prep.title).toContain('Indicadores e Metas');
            expect(prep.summaryStats['Total de Lançamentos']).toBe(2);
            expect(prep.summaryStats['FCR Médio']).toBe('84.5%');
            expect(prep.summaryStats['Reincidência Média']).toBe('14.0%');
        });
    });

    describe('executeDataExport', () => {
        it('deve suportar exportação em CSV e Markdown', () => {
            // Mock do window / document para ambiente jsdom / node
            const fakeUrl = 'blob:http://localhost/fake';
            global.URL.createObjectURL = vi.fn(() => fakeUrl);
            global.URL.revokeObjectURL = vi.fn();

            const mockData = [
                { id: '1', date: '2026-10-25', colabId: 'c1', type: 'Elogio', comment: 'Show' }
            ];

            const csvResult = executeDataExport({
                format: 'csv',
                activeTab: 'feedbacks',
                data: mockData,
                collaboratorsMap: { c1: 'Carlos' }
            });

            expect(csvResult.success).toBe(true);
            expect(csvResult.format).toBe('csv');
            expect(csvResult.filename).toContain('.csv');

            const mdResult = executeDataExport({
                format: 'md',
                activeTab: 'feedbacks',
                data: mockData,
                collaboratorsMap: { c1: 'Carlos' }
            });

            expect(mdResult.success).toBe(true);
            expect(mdResult.format).toBe('md');
            expect(mdResult.filename).toContain('.md');
        });
    });
});
