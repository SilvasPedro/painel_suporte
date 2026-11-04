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

async function generateDecemberPDF() {
  console.log("Iniciando geração do PDF da Escala de Dezembro/2026...");

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

  // Cores Institucionais
  const primaryRed = [228, 4, 44];       // #E4042C
  const darkRed = [153, 0, 26];          // #99001A
  const darkSlate = [15, 23, 42];        // #0F172A
  const mutedText = [71, 85, 105];       // #475569
  const lightBg = [248, 250, 252];       // #F8FAFC
  const borderColor = [226, 232, 240];   // #E2E8F0
  const emeraldColor = [16, 185, 129];   // #10B981
  const lightEmeraldBg = [236, 253, 245];
  const lightRedBg = [254, 242, 242];

  function drawHeader(title, subtitle) {
    doc.setFillColor(...primaryRed);
    doc.rect(0, 0, pageWidth, 3.5, "F");

    doc.addImage(isoB64, "PNG", 14, 8, 16, 11.55);

    doc.setTextColor(...darkSlate);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(title, 34, 15);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...mutedText);
    doc.text(subtitle, 34, 21);

    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.4);
    doc.line(14, 25.5, pageWidth - 14, 25.5);
  }

  function drawFooter(pageNo, totalPages) {
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.4);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);

    doc.addImage(logoB64, "PNG", 14, pageHeight - 12.5, 30, 9.15);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...mutedText);
    doc.text("Hubdesk Suporte Tecnico | Etecc Telecom - Escalas Operacionais", 48, pageHeight - 7);
    doc.text(`Pagina ${pageNo} de ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: "right" });
  }

  // ==========================================
  // PÁGINA 1: VISÃO GERAL, EFETIVO E BALANÇO INDIVIDUAL
  // ==========================================
  drawHeader(
    "COMUNICADO OPERACIONAL - ESCALA DIARIA DEZEMBRO/2026",
    "Planejamento com Efetivo Pleno • Sem Ferias • Distribuicao 100% Simetrica"
  );

  let currentY = 31;

  // Box 1: Contexto e Efetivo Pleno
  doc.setFillColor(...lightEmeraldBg);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14, currentY, pageWidth - 28, 22, 2, 2, "FD");

  doc.setFillColor(...emeraldColor);
  doc.rect(14, currentY, 2.5, 22, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(6, 95, 70);
  doc.text("[EFETIVO PLENO] OPERACAO 100% DISPONIVEL EM DEZEMBRO/2026", 19, currentY + 5.5);

  doc.setFontSize(7.8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkSlate);
  const contextLines = [
    "Em Dezembro/2026 nao teremos colaboradores de ferias. Contamos com o retorno oficial de Gustavo Mistro e Sarah Almeida,",
    "alem da efetivacao de Luiz Guilherme. A operacao operara com 20 colaboradores diarios, atingindo paridade absoluta:",
    "exatamente 8 operadores na Telefonia, 8 no Huggy e 4 no Apoio, com escala 50%/50% (3 dias em cada canal) para todo o time."
  ];
  doc.text(contextLines, 19, currentY + 10.5);

  currentY += 26;

  // Box 2: Tabela de Balanço Individual de Todos os Colaboradores
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkSlate);
  doc.text("QUADRO DE BALANCO INDIVIDUAL SEMANAL (DEZEMBRO/2026)", 14, currentY);
  currentY += 3.5;

  const colabBalanco = [
    ["Danilo dos Santos Amaro", "08:00 as 14:15", "3 dias", "3 dias", "-", "50% / 50%"],
    ["Victor Silva Alves", "08:00 as 14:15", "3 dias", "3 dias", "-", "50% / 50%"],
    ["Sarah Almeida (Retorno)", "08:00 as 14:15", "3 dias", "3 dias", "-", "50% / 50%"],
    ["Thiago Nathan", "08:00 as 14:15", "3 dias", "3 dias", "-", "50% / 50%"],
    ["Ana Beatriz Jesus", "08:00 as 14:15", "3 dias", "3 dias", "-", "50% / 50%"],
    ["Luana Angelo", "09:00 as 15:15", "3 dias", "3 dias", "-", "50% / 50%"],
    ["Ana Beatriz Pereira", "09:00 as 15:15", "3 dias", "3 dias", "-", "50% / 50%"],
    ["Carolini Pontes", "09:00 as 15:15", "3 dias", "3 dias", "-", "50% / 50%"],
    ["Luiz Guilherme", "09:00 as 15:15", "3 dias", "3 dias", "-", "50% / 50%"],
    ["Jefferson Ribeiro", "11:00 as 17:15", "3 dias", "3 dias", "-", "50% / 50%"],
    ["Gustavo Mistro (Retorno)", "11:00 as 17:15", "3 dias", "3 dias", "-", "50% / 50%"],
    ["Henri Suzuki", "13:45 as 20:00", "3 dias", "3 dias", "-", "50% / 50%"],
    ["Matheus Santos", "13:45 as 20:00", "3 dias", "3 dias", "-", "50% / 50%"],
    ["Douglas Ferreira Cruz", "13:45 as 20:00", "3 dias", "3 dias", "-", "50% / 50%"],
    ["Eduardo Silva Veira", "13:45 as 20:00", "3 dias", "3 dias", "-", "50% / 50%"],
    ["Heitor Hugo", "13:45 as 20:00", "3 dias", "3 dias", "-", "50% / 50%"],
    ["Eduardo Caetano", "09:00 as 15:15", "-", "-", "6 dias", "Apoio / Gestao"],
    ["Lucas Werner", "09:00 as 15:15", "-", "-", "6 dias", "Apoio Tecnico"],
    ["Alejandro Eduardo", "11:00 as 17:15", "-", "-", "6 dias", "Apoio Tecnico"],
    ["Pedro Pinze", "13:45 as 20:00", "-", "-", "6 dias", "Apoio Tecnico"]
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    theme: "plain",
    head: [["Colaborador", "Turno", "Telefonia", "Huggy", "Apoio", "Proporcao Semanal"]],
    body: colabBalanco,
    styles: {
      fontSize: 6.8,
      cellPadding: 1.6,
      textColor: darkSlate
    },
    headStyles: {
      fillColor: darkSlate,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.2
    },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: "bold" },
      1: { cellWidth: 32 },
      2: { cellWidth: 22, halign: "center", fontStyle: "bold", textColor: primaryRed },
      3: { cellWidth: 22, halign: "center", fontStyle: "bold", textColor: [37, 99, 235] },
      4: { cellWidth: 22, halign: "center", fontStyle: "bold" },
      5: { cellWidth: "auto", halign: "center", fontStyle: "bold", textColor: [6, 95, 70] }
    },
    alternateRowStyles: {
      fillColor: lightBg
    }
  });

  drawFooter(1, 2);

  // ==========================================
  // PÁGINA 2: TABELA COMPLETA SEMANAL DE DEZEMBRO/2026
  // ==========================================
  doc.addPage();
  drawHeader(
    "GRADE SEMANAL OFICIAL • DEZEMBRO/2026",
    "Distribuicao Diaria: 8 Telefonia (Voz) • 8 Huggy (Chat) • 4 Apoio Operacional"
  );

  currentY = 30;

  // Tabela Semanal Completa de Dezembro
  const dezRows = [
    [
      "Segunda-feira\n(08h as 20h)",
      "- Danilo dos Santos (08h)\n- Victor Silva (08h)\n- Sarah Almeida (08h)\n- Luana Angelo (09h)\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)",
      "- Thiago Nathan (08h)\n- Ana Beatriz Jesus (08h)\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Gustavo Mistro (11h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Eduardo Caetano (09h)\n- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ],
    [
      "Terca-feira\n(08h as 20h)",
      "- Thiago Nathan (08h)\n- Ana Beatriz Jesus (08h)\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Gustavo Mistro (11h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Danilo dos Santos (08h)\n- Victor Silva (08h)\n- Sarah Almeida (08h)\n- Luana Angelo (09h)\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)",
      "- Eduardo Caetano (09h)\n- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ],
    [
      "Quarta-feira\n(08h as 20h)",
      "- Danilo dos Santos (08h)\n- Victor Silva (08h)\n- Thiago Nathan (08h)\n- Luana Angelo (09h)\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)",
      "- Sarah Almeida (08h)\n- Ana Beatriz Jesus (08h)\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Gustavo Mistro (11h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Eduardo Caetano (09h)\n- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ],
    [
      "Quinta-feira\n(08h as 20h)",
      "- Sarah Almeida (08h)\n- Ana Beatriz Jesus (08h)\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Gustavo Mistro (11h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Danilo dos Santos (08h)\n- Victor Silva (08h)\n- Thiago Nathan (08h)\n- Luana Angelo (09h)\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)",
      "- Eduardo Caetano (09h)\n- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ],
    [
      "Sexta-feira\n(08h as 20h)",
      "- Danilo dos Santos (08h)\n- Sarah Almeida (08h)\n- Ana Beatriz Jesus (08h)\n- Luana Angelo (09h)\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)",
      "- Victor Silva (08h)\n- Thiago Nathan (08h)\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Gustavo Mistro (11h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Eduardo Caetano (09h)\n- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ],
    [
      "Sabado\n(08h as 20h)",
      "- Victor Silva (08h)\n- Thiago Nathan (08h)\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Gustavo Mistro (11h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Danilo dos Santos (08h)\n- Sarah Almeida (08h)\n- Ana Beatriz Jesus (08h)\n- Luana Angelo (09h)\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)",
      "- Eduardo Caetano (09h)\n- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ]
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    theme: "plain",
    head: [["Dia da Semana", "Telefonia (Voz) • 8 op", "Huggy (Chat) • 8 op", "Apoio Operacional • 4 op"]],
    body: dezRows,
    styles: {
      fontSize: 6.8,
      cellPadding: 1.8,
      textColor: darkSlate,
      valign: "top"
    },
    headStyles: {
      fillColor: primaryRed,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.8
    },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: "bold" },
      1: { cellWidth: 58 },
      2: { cellWidth: 58 },
      3: { cellWidth: 38 }
    },
    alternateRowStyles: {
      fillColor: lightBg
    }
  });

  currentY = doc.lastAutoTable.finalY + 5;

  // Box inferior: Resumo de Cobertura
  doc.setFillColor(...lightBg);
  doc.setDrawColor(...borderColor);
  doc.roundedRect(14, currentY, pageWidth - 28, 14, 2, 2, "FD");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkSlate);
  doc.text("ESTRUTURA DE COBERTURA DIARIA DE DEZEMBRO/2026:", 18, currentY + 5);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...mutedText);
  doc.text("• Abertura (08h): 5 operadores | • Reforco Manha II (09h): 6 operadores | • Pico Geral (11h as 14h15): 14 operadores em fila + 3 em apoio.", 18, currentY + 9.5);

  drawFooter(2, 2);

  const outPath = path.resolve("extracao_relatorios/escala_diaria_dezembro_2026.pdf");
  const pdfBytes = doc.output("arraybuffer");
  fs.writeFileSync(outPath, Buffer.from(pdfBytes));

  console.log(`\n==========================================================`);
  console.log(` PDF DE DEZEMBRO GERADO COM SUCESSO: ${outPath}`);
  console.log(` Tamanho: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
  console.log(`==========================================================\n`);
}

generateDecemberPDF().catch(err => {
  console.error("Erro ao gerar PDF de Dezembro:", err);
  process.exit(1);
});
