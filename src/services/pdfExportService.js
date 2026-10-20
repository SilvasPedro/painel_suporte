import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Serviço de Exportação em PDF para Auditorias da Terceirizada (v3.8.2)
 * Gera documento A4 Paisagem profissional com sumário de métricas e tabela de protocolos unificados.
 */
export const exportThirdPartyAuditsPDF = ({
    audits,
    periodLabel = 'Período Atual',
    kpiStats = null,
    generatedBy = 'Gestão HubDesk'
}) => {
    if (!audits || audits.length === 0) {
        throw new Error('Nenhuma auditoria disponível para exportação.');
    }

    // Cria documento A4 Paisagem (297mm x 210mm)
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('pt-BR');
    const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // 1. Barra decorativa superior vermelha (Identidade HubDesk)
    doc.setFillColor(220, 38, 38); // red-600
    doc.rect(0, 0, pageWidth, 4, 'F');

    // 2. Cabeçalho Principal
    doc.setFillColor(24, 24, 27); // zinc-900
    doc.rect(14, 10, 18, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('HD', 23, 21.5, { align: 'center' });

    // Título e Subtítulo
    doc.setTextColor(17, 24, 39); // gray-900
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Auditorias • Equipe Terceirizada', 36, 17);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text(`Anexo de Protocolos Unificados • Período: ${periodLabel} • Total: ${audits.length} atendimentos`, 36, 23);
    doc.text(`Emitido em ${dateFormatted} às ${timeFormatted} • Por: ${generatedBy}`, 36, 27.5);

    // 3. Mini Dashboard de Indicadores no Topo (se houver kpiStats)
    if (kpiStats) {
        const startY = 32;
        const boxWidth = (pageWidth - 28 - 12) / 4; // 4 caixas com espaçamento
        const boxHeight = 15;

        const kpis = [
            { label: 'TOTAL ATENDIMENTOS', value: String(audits.length), color: [30, 41, 59] },
            { label: 'CONFORMIDADE', value: `${kpiStats.compliancePct ?? '--'}%`, color: [16, 185, 129] },
            { label: 'QUALIDADE POSITIVA', value: `${kpiStats.qualityPct ?? '--'}%`, color: [59, 130, 246] },
            { label: 'FCR (RESOLUÇÃO 1º CONTATO)', value: `${kpiStats.fcrPct ?? '--'}%`, color: [139, 92, 246] }
        ];

        kpis.forEach((kpi, idx) => {
            const x = 14 + idx * (boxWidth + 4);
            // Caixa de fundo
            doc.setFillColor(248, 250, 252); // slate-50
            doc.setDrawColor(226, 232, 240); // slate-200
            doc.roundedRect(x, startY, boxWidth, boxHeight, 2, 2, 'FD');

            // Linha lateral de destaque
            doc.setFillColor(...kpi.color);
            doc.rect(x, startY, 2.5, boxHeight, 'F');

            // Textos
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 116, 139);
            doc.text(kpi.label, x + 5, startY + 5);

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...kpi.color);
            doc.text(kpi.value, x + 5, startY + 12);
        });
    }

    // 4. Montagem da Tabela com Protocolos como TEXTO PURO
    const headers = [
        ['Data', 'Protocolo Terceirizada', 'Protocolo MK (ERP)', 'Status', 'Procedimento', 'Qualidade', 'FCR (Saída)', 'Operador', 'Auditor', 'Observações']
    ];

    const rows = audits.map(a => {
        const isCompleted = Boolean(a.procedures && a.quality && a.outcome);
        // Garante que o protocolo permaneça string literal sem truncar ou converter formato
        const protocolText = a.protocol ? String(a.protocol).trim() : 'N/A';
        const erpProtocolText = a.erpProtocol ? String(a.erpProtocol).trim() : '--';

        return [
            a.date ? a.date.split('-').reverse().join('/') : '--',
            protocolText,
            erpProtocolText,
            isCompleted ? 'Concluída' : 'Pendente',
            a.procedures || 'Pendente',
            a.quality || 'Pendente',
            a.outcome || '--',
            a.operatorName || '--',
            a.auditorName || '--',
            a.notes ? String(a.notes).replace(/\n/g, ' ') : '--'
        ];
    });

    const tableStartY = kpiStats ? 51 : 33;

    autoTable(doc, {
        head: headers,
        body: rows,
        startY: tableStartY,
        theme: 'striped',
        styles: {
            fontSize: 7.5,
            cellPadding: 2,
            overflow: 'linebreak',
            textColor: [30, 41, 59],
            font: 'helvetica'
        },
        headStyles: {
            fillColor: [24, 24, 27], // zinc-900
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'left'
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252] // slate-50
        },
        columnStyles: {
            0: { cellWidth: 18, halign: 'center' }, // Data
            1: { cellWidth: 32, fontStyle: 'bold' }, // Protocolo Terceirizada (Preserva formato 2610.XXXXX)
            2: { cellWidth: 30 },                  // Protocolo MK
            3: { cellWidth: 18, halign: 'center' }, // Status
            4: { cellWidth: 23 },                  // Procedimentos
            5: { cellWidth: 22 },                  // Qualidade
            6: { cellWidth: 24 },                  // Saída (FCR)
            7: { cellWidth: 32 },                  // Operador
            8: { cellWidth: 28 },                  // Auditor
            9: { cellWidth: 'auto' }               // Observações
        },
        didParseCell: (data) => {
            // Estilização condicional de células
            if (data.section === 'body') {
                // Coluna Procedimentos (índice 4)
                if (data.column.index === 4) {
                    if (data.cell.raw === 'Conforme') {
                        data.cell.styles.textColor = [16, 185, 129];
                        data.cell.styles.fontStyle = 'bold';
                    } else if (data.cell.raw === 'Não Conforme') {
                        data.cell.styles.textColor = [220, 38, 38];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
                // Coluna Status (índice 3)
                if (data.column.index === 3) {
                    if (data.cell.raw === 'Concluída') {
                        data.cell.styles.textColor = [5, 150, 105];
                    } else {
                        data.cell.styles.textColor = [217, 119, 6];
                    }
                }
            }
        },
        didDrawPage: (data) => {
            // Rodapé em todas as páginas
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184); // slate-400

            // Linha divisória
            doc.setDrawColor(226, 232, 240);
            doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);

            doc.text(
                'HubDesk v3.8.2 • Gestão de Auditorias Terceirizadas • Documento para Anexo e Conferência de Protocolos',
                14,
                pageHeight - 6
            );

            const pageNumber = `Página ${data.pageNumber}`;
            doc.text(pageNumber, pageWidth - 14, pageHeight - 6, { align: 'right' });
        },
        margin: { top: 12, left: 14, right: 14, bottom: 14 }
    });

    // Salva e inicia download do arquivo PDF
    const fileName = `auditorias_terceirizada_${now.toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    return fileName;
};
