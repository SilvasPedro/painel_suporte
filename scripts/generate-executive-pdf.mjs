import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

function ensurePng(svgPath, outPngPath, width, height) {
  if (fs.existsSync(outPngPath)) return;
  const svg = fs.readFileSync(svgPath, "utf8");
  const html = `<!DOCTYPE html><html><head><style>* { margin: 0; padding: 0; } html, body { background: transparent !important; width: ${width}px; height: ${height}px; overflow: hidden; } svg { width: 100%; height: 100%; display: block; }</style></head><body>${svg}</body></html>`;
  const b64 = Buffer.from(html).toString("base64");
  const dataUrl = `data:text/html;base64,${b64}`;
  const absOut = path.resolve(outPngPath);
  const cmd = `"${edgePath}" --headless=new --disable-gpu --default-background-color=00000000 --window-size=${width},${height} --screenshot="${absOut}" "${dataUrl}"`;
  execSync(cmd, { stdio: "ignore" });
}

async function generateExecutivePDF() {
  // Garantir que os PNGs transparentes de alta resolução dos SVGs existam
  ensurePng("public/ISOTIPO ETECC TELECOM VERMELHO.svg", "scripts/isotipo.png", 400, 289);
  ensurePng("public/LOGO ETECC TELECOM VERMELHO.svg", "scripts/logo_etecc.png", 800, 244);

  const isoB64 = "data:image/png;base64," + fs.readFileSync("scripts/isotipo.png").toString("base64");
  const logoB64 = "data:image/png;base64," + fs.readFileSync("scripts/logo_etecc.png").toString("base64");

  const jspdfModule = await import("jspdf");
  const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Cores institucionais
  const primaryRed = [228, 4, 44];       // ETECC Red
  const darkSlate = [15, 23, 42];        // Slate-900
  const mutedText = [100, 116, 139];     // Slate-500
  const lightBg = [248, 250, 252];       // Slate-50
  const borderColor = [226, 232, 240];   // Slate-200

  function drawHeader(title, subtitle) {
    // Linha superior vermelha
    doc.setFillColor(...primaryRed);
    doc.rect(0, 0, pageWidth, 3.5, "F");

    // Inserção da LOGO ISOTIPO ETECC no topo esquerdo (PNG nítido com fundo transparente)
    // 16mm largura x 11.55mm altura
    doc.addImage(isoB64, "PNG", 14, 8, 16, 11.55);

    // Título e Subtítulo
    doc.setTextColor(...darkSlate);
    doc.setFontSize(13.5);
    doc.setFont("helvetica", "bold");
    doc.text(title, 34, 15);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...mutedText);
    doc.text(subtitle, 34, 21);

    doc.setDrawColor(...borderColor);
    doc.line(14, 25.5, pageWidth - 14, 25.5);
  }

  function drawFooter(pageNo, totalPages) {
    doc.setDrawColor(...borderColor);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);

    // Inserção da LOGO ETECC TELECOM VERMELHO completa no rodapé
    // 30mm largura x 9.15mm altura
    doc.addImage(logoB64, "PNG", 14, pageHeight - 12.5, 30, 9.15);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...mutedText);
    doc.text("Relatório Executivo de Gestão | Hubdesk Suporte Técnico", 48, pageHeight - 7);
    doc.text(`Página ${pageNo} de ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: "right" });
  }

  // ==========================================
  // PÁGINA 1
  // ==========================================
  drawHeader(
    "RELATÓRIO EXECUTIVO DE DESEMPENHO OPERACIONAL",
    "Período Avaliado: 06/01/2026 até 31/10/2026 | 05 Colaboradores"
  );

  // Top KPI summary boxes
  const kpiY = 30.5;
  const kpiBoxW = (pageWidth - 28 - 9) / 4;
  const kpiBoxH = 16;
  const kpis = [
    { label: "TOTAL ATENDIMENTOS", value: "7.823", sub: "ERP + Chat + Voz", color: [30, 41, 59] },
    { label: "CONFORMIDADE QA", value: "89,8%", sub: "Média Histórica", color: [16, 185, 129] },
    { label: "TMA MÉDIO GERAL", value: "08m56s", sub: "Voz | 25m24s Chat", color: [59, 130, 246] },
    { label: "SALDO FEEDBACKS", value: "80,6%", sub: "25 Elogios de 31", color: primaryRed }
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (kpiBoxW + 3);
    doc.setFillColor(...lightBg);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(x, kpiY, kpiBoxW, kpiBoxH, 2, 2, "FD");

    doc.setFillColor(...kpi.color);
    doc.rect(x, kpiY, 2, kpiBoxH, "F");

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...mutedText);
    doc.text(kpi.label, x + 5, kpiY + 4.5);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, x + 5, kpiY + 10.5);

    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...mutedText);
    doc.text(kpi.sub, x + 5, kpiY + 14);
  });

  // Context box
  let currentY = 50.5;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, currentY, pageWidth - 28, 22, 2, 2, "F");
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkSlate);
  doc.text("Resumo de Escopo para a Liderança:", 18, currentY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(51, 65, 85);
  const summaryText = "Este relatório consolida o desempenho operacional no período exato de 06/01/2026 até 31/10/2026 (23 semanas operacionais de 2026). " +
    "Colaboradores: Alejandro Eduardo, Heitor Hugo, Matheus Santos, Thiago Nathan e Victor Silva. " +
    "As avaliações mensais 1:1 foram desconsideradas nesta análise devido à disparidade de atualização cadastral. " +
    "O grupo atingiu 7.823 atendimentos com média de 89,8% em QA. O ponto crítico de gestão identificado é a sobrecarga na telefonia: mais de 67% das chamadas foram absorvidas por apenas dois operadores.";
  const splitSummary = doc.splitTextToSize(summaryText, pageWidth - 36);
  doc.text(splitSummary, 18, currentY + 10);

  // Table
  currentY = 76.5;
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkSlate);
  doc.text("1. Matriz Comparativa Consolidada (06/01/2026 a 31/10/2026)", 14, currentY);

  const tableHeaders = [
    ["Colaborador", "Turno", "Vol. Total", "ERP", "Chat", "Voz At.", "Taxa Voz", "TMA Voz", "TMA Chat", "QA (%)", "Feedbacks"]
  ];

  const tableData = [
    ["Heitor Hugo", "Manhã I", "2.141", "919", "798", "424", "92,2%", "09m49s", "28m00s", "88,9%", "3 Elogios / 1 Orient."],
    ["Matheus Santos", "Noturno", "1.790", "783", "602", "405", "94,2%", "07m47s", "23m03s", "100,0%", "3 Elogios / 2 Orient."],
    ["Victor Silva Alves", "Manhã I", "1.488", "779", "521", "188", "96,4%", "09m11s", "23m53s", "87,5%", "7 Elogios / 1 Melhoria"],
    ["Alejandro Eduardo", "Tarde", "1.330", "648", "593", "89", "67,4%", "09m55s", "27m59s", "77,8%*", "8 Elogios / 1 Orient."],
    ["Thiago Nathan", "Manhã I", "1.074", "619", "336", "119", "100,0%", "07m59s", "24m06s", "100,0%", "4 Elogios / 1 Melhoria"]
  ];

  autoTable(doc, {
    startY: currentY + 3,
    head: tableHeaders,
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: darkSlate,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
      halign: "center",
      cellPadding: 2
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: [30, 41, 59],
      halign: "center",
      cellPadding: 2
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold", cellWidth: 32 },
      1: { cellWidth: 15 },
      2: { fontStyle: "bold", textColor: primaryRed, cellWidth: 16 },
      3: { cellWidth: 12 },
      4: { cellWidth: 12 },
      5: { cellWidth: 13 },
      6: { cellWidth: 14 },
      7: { cellWidth: 14 },
      8: { cellWidth: 14 },
      9: { fontStyle: "bold", cellWidth: 14 },
      10: { halign: "left", cellWidth: 26 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14 }
  });

  const noteY = doc.lastAutoTable.finalY + 3;
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...mutedText);
  doc.text("* Alejandro Eduardo evoluiu de 60% para 100% de conformidade QA nas auditorias do ciclo de Outubro/2026.", 14, noteY);

  // Rankings Highlights Block
  const finalTableY = noteY + 6;
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkSlate);
  doc.text("2. Destaques por Pilar Operacional", 14, finalTableY);

  const colW = (pageWidth - 28 - 9) / 2;
  const rankBlocks = [
    {
      title: "[VOLUME] Capacidade de Absorção da Demanda",
      items: [
        "1º Heitor Hugo: 2.141 entregas (Líder geral na operação)",
        "2º Matheus Santos: 1.790 entregas (Alta consistência no noturno)",
        "3º Victor Silva: 1.488 entregas (Tração contínua e estável)"
      ],
      x: 14,
      y: finalTableY + 4
    },
    {
      title: "[AGILIDADE] Menor Tempo Médio de Atendimento",
      items: [
        "1º Matheus Santos: 07m47s Voz / 23m03s Chat (Líder)",
        "2º Thiago Nathan: 07m59s Voz / 24m06s Chat (Muito ágil)",
        "3º Victor Silva: 23m53s Chat / 03m30s Voz rápida"
      ],
      x: 14 + colW + 3,
      y: finalTableY + 4
    },
    {
      title: "[QUALIDADE] Conformidade de Processos (QA)",
      items: [
        "1º Matheus Santos e Thiago Nathan: 100% Conforme",
        "2º Heitor Hugo: 88,9% Conforme (Apenas 1 desvio pontual)",
        "3º Victor Silva: 87,5% Conforme (100% no mês recente)"
      ],
      x: 14,
      y: finalTableY + 28
    },
    {
      title: "[RECONHECIMENTO] Clima e Satisfação",
      items: [
        "1º Alejandro Eduardo: 8 elogios (Mentoria técnica da equipe)",
        "2º Victor Silva: 7 elogios (Avaliação 5 estrelas no Google)",
        "3º Thiago Nathan: 4 elogios (Didática clara com clientes)"
      ],
      x: 14 + colW + 3,
      y: finalTableY + 28
    }
  ];

  rankBlocks.forEach(b => {
    doc.setFillColor(...lightBg);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(b.x, b.y, colW, 20, 1.5, 1.5, "FD");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkSlate);
    doc.text(b.title, b.x + 3.5, b.y + 4.5);

    doc.setFontSize(6.7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    b.items.forEach((it, idx) => {
      doc.text(`- ${it}`, b.x + 3.5, b.y + 9 + idx * 4);
    });
  });

  drawFooter(1, 2);

  // ==========================================
  // PÁGINA 2
  // ==========================================
  doc.addPage();
  drawHeader(
    "RELATÓRIO EXECUTIVO DE DESEMPENHO OPERACIONAL",
    "Raio-X Individual dos Colaboradores e Plano de Ação Estratégico"
  );

  let p2Y = 30.5;
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkSlate);
  doc.text("3. Raio-X Individual dos Colaboradores", 14, p2Y);

  const colabProfiles = [
    {
      name: "Heitor Hugo (Turno Manhã I | Operação)",
      badge: "Líder em Volume: 2.141 Atendimentos",
      highlights: "Principal pulmão da central. Líder em finalizações no ERP (919) e telefonia (424). Rápida notificação à supervisão em chamadas sensíveis e alta assiduidade.",
      improvements: "Tornar o diálogo verbal mais dinâmico para diminuir pausas silenciosas com o cliente em linha. Reforçar o aviso prévio de desconexão antes de alterar senhas Wi-Fi."
    },
    {
      name: "Matheus Santos (Turno Noturno | Fechamento)",
      badge: "Maior Eficiência: 100% QA | Menor TMA",
      highlights: "Maior precisão e velocidade da equipe. Menores TMAs em voz e chat com 100% de conformidade QA. Conduz o fechamento e plantões de domingo com grande estabilidade.",
      improvements: "Auditar com maior frequência sua caixa de chamados pendentes (caso de 15 dias sem movimentação). Alertar sobre necessidade de estudo prévio de viabilidade técnica em pontos adicionais."
    },
    {
      name: "Victor Silva Alves (Polo Peruíbe | Manhã I)",
      badge: "Satisfação Máxima: CSAT 4.68 | Elogio Google",
      highlights: "Excelência no atendimento com avaliação espontânea de 5 estrelas no Google. Alta autonomia operando no polo Peruíbe com múltiplos sistemas em migração. Ótimo diagnóstico técnico remoto.",
      improvements: "Agrupar mensagens curtas em balões estruturados no Huggy para reduzir custos de disparos da plataforma. Enviar posicionamentos intermediários durante preenchimento de O.S. no chat."
    },
    {
      name: "Alejandro Eduardo (Turno Tarde | Apoio Operacional)",
      badge: "Mentoria Técnica & Treinamentos | 8 Elogios",
      highlights: "Papel estratégico de multiplicador e suporte avançado, capacitando a equipe nos novos ERPs (TopSapp) e OLTs. Menor tempo de espera em voz (10s) e forte proatividade em melhorias sistêmicas.",
      improvements: "Aumentar a prontidão na telefonia receptiva (taxa de 67,4% com 43 ligações perdidas). Controlar silêncios em chamadas telefônicas (retornos verbais a cada 30-40 segundos)."
    },
    {
      name: "Thiago Nathan (Turno Manhã I | Abertura)",
      badge: "Disciplina Impecável: 100% QA | Pontualidade",
      highlights: "Pontualidade exemplar (100% das batidas entre 07:55 e 07:58). Gabarito de 100% em QA com escrita correta e excelente didática para apoiar clientes leigos e documentações internas.",
      improvements: "Manter a fila receptiva de telefonia sempre ativa durante todo o expediente (já foi advertido por fila inativa). Margem para elevar o volume global de entregas (1.074)."
    }
  ];

  let cardY = p2Y + 4;
  colabProfiles.forEach(c => {
    doc.setFillColor(...lightBg);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(14, cardY, pageWidth - 28, 25, 1.5, 1.5, "FD");

    doc.setFontSize(8.2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkSlate);
    doc.text(c.name, 17, cardY + 5);

    doc.setFontSize(6.7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryRed);
    doc.text(c.badge, pageWidth - 17, cardY + 5, { align: "right" });

    doc.setFontSize(6.9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 101, 52);
    doc.text("Destaques:", 17, cardY + 10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const splitH = doc.splitTextToSize(c.highlights, pageWidth - 49);
    doc.text(splitH, 32, cardY + 10);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 83, 9);
    doc.text("Melhorias:", 17, cardY + 18);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const splitI = doc.splitTextToSize(c.improvements, pageWidth - 49);
    doc.text(splitI, 32, cardY + 18);

    cardY += 28;
  });

  // Recomendações Estratégicas
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkSlate);
  doc.text("4. Recomendações Estratégicas para a Liderança", 14, cardY + 3);

  const recommendations = [
    "1. Rebalanceamento da Telefonia: Envolver Thiago e Alejandro ativamente na escala receptiva para equilibrar com Heitor e Matheus, evitando sobrecarga.",
    "2. FinOps em Mensageria: Instituir orientação formal de envio de mensagens estruturadas no Huggy, reduzindo o custo por disparo da plataforma.",
    "3. Protocolo de Silêncio: Fixar retorno verbal obrigatório a cada 35 segundos em ligações e atualização a cada 3 minutos no chat durante preenchimento de O.S.",
    "4. Alavancagem de Talentos: Aproveitar a didática de Thiago e a técnica de Alejandro em treinamentos, e a postura de Victor e Matheus como padrão de monitoria."
  ];

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, cardY + 6, pageWidth - 28, 26, 1.5, 1.5, "F");

  doc.setFontSize(7.2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  recommendations.forEach((rec, idx) => {
    doc.text(rec, 17, cardY + 11.5 + idx * 5.5);
  });

  drawFooter(2, 2);

  const outputPath = path.resolve(process.cwd(), "extracao_relatorios/relatorio_executivo_gestao.pdf");
  const pdfBytes = doc.output("arraybuffer");
  fs.writeFileSync(outputPath, Buffer.from(pdfBytes));
  console.log("PDF executivo com logos ETECC gerado com sucesso em:", outputPath);
}

generateExecutivePDF().catch(err => {
  console.error("Erro:", err);
  process.exit(1);
});
