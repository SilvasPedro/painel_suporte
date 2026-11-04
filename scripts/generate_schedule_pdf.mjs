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

async function generateSchedulePDF() {
  console.log("Iniciando geração do PDF de escalas operacionais com Luiz Guilherme...");

  // Garante imagens em PNG com alta definição
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

  // Paleta de Cores Institucional ETECC TELECOM
  const primaryRed = [228, 4, 44];       // #E4042C (Vermelho Etecc)
  const darkRed = [153, 0, 26];          // #99001A (Vinho Etecc)
  const darkSlate = [15, 23, 42];        // #0F172A (Slate 900)
  const mutedText = [71, 85, 105];       // #475569 (Slate 600)
  const lightBg = [248, 250, 252];       // #F8FAFC (Slate 50)
  const borderColor = [226, 232, 240];   // #E2E8F0 (Slate 200)
  const accentBlue = [37, 99, 235];      // #2563EB (Azul Operacional)
  const accentAmber = [217, 119, 6];     // #D97706 (Âmbar/Aviso)
  const lightRedBg = [254, 242, 242];    // #FEF2F2
  const lightBlueBg = [239, 246, 255];   // #EFF6FF

  function drawHeader(title, subtitle) {
    // Linha de acabamento superior vermelha
    doc.setFillColor(...primaryRed);
    doc.rect(0, 0, pageWidth, 3.5, "F");

    // Logo Isotipo Etecc no canto superior esquerdo
    doc.addImage(isoB64, "PNG", 14, 8, 16, 11.55);

    // Título do documento
    doc.setTextColor(...darkSlate);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(title, 34, 15);

    // Subtítulo
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...mutedText);
    doc.text(subtitle, 34, 21);

    // Linha divisória
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.4);
    doc.line(14, 25.5, pageWidth - 14, 25.5);
  }

  function drawFooter(pageNo, totalPages) {
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.4);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);

    // Logo oficial Etecc Telecom no rodapé
    doc.addImage(logoB64, "PNG", 14, pageHeight - 12.5, 30, 9.15);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...mutedText);
    doc.text("Hubdesk Suporte Tecnico | Etecc Telecom - Escalas Operacionais", 48, pageHeight - 7);
    doc.text(`Pagina ${pageNo} de ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: "right" });
  }

  // =========================================================================
  // PÁGINA 1: VISÃO GERAL, REGRAS DE TRANSIÇÃO E GRADE OFICIAL DE TURNOS
  // =========================================================================
  drawHeader(
    "COMUNICADO OPERACIONAL - ESCALAS DIARIAS",
    "Atualizacao e Distribuicao dos Postos de Atendimento • Novembro / 2026"
  );

  let currentY = 31;

  // Box 1: Comunicado e Contexto das Férias
  doc.setFillColor(...lightRedBg);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(14, currentY, pageWidth - 28, 22, 2, 2, "FD");

  doc.setFillColor(...primaryRed);
  doc.rect(14, currentY, 2.5, 22, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkRed);
  doc.text("[COMUNICADO GERAL] ADEQUACAO OPERACIONAL POR PERIODO DE FERIAS", 19, currentY + 5.5);

  doc.setFontSize(7.8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkSlate);
  const contextLines = [
    "Informamos a toda a equipe de suporte a programacao oficial das escalas operacionais para o mes de Novembro/2026.",
    "Devido ao periodo de ferias de Gustavo Mistro (Tarde) e Sarah de Almeida (Manha I), a operacao operara em duas fases",
    "planejadas com o reforco de Luiz Guilherme no turno Manha II (09:00 as 15:15) cobrindo canais de Telefonia e Huggy."
  ];
  doc.text(contextLines, 19, currentY + 10.5);

  currentY += 26;

  // Box 2: Grade de Turnos Oficiais
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkSlate);
  doc.text("GRADE DE HORARIOS E TURNOS OFICIAIS", 14, currentY);
  currentY += 3.5;

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    theme: "plain",
    head: [["Turno", "Horario", "Intervalo", "Escopo e Foco Operacional"]],
    body: [
      ["Manha I", "08:00 as 14:15", "15 min", "Abertura da operacao e absorcao inicial de alta demanda matutina"],
      ["Manha II", "09:00 as 15:15", "15 min", "Reforco intermediario, pico matinal e transicao para o almoco"],
      ["Tarde", "11:00 as 17:15", "15 min", "Suporte continuo, cobertura do pico de almoco e suporte interno"],
      ["Noturno", "13:45 as 20:00", "15 min", "Fechamento da operacao interna e transicao para a terceirizada"],
      ["Terceirizada", "20:00 as 08:00", "Conforme escala", "Operacao externa homologada (noturno continuo e madrugada)"]
    ],
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: darkSlate
    },
    headStyles: {
      fillColor: darkSlate,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: "bold" },
      1: { cellWidth: 32, fontStyle: "bold", textColor: primaryRed },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: "auto" }
    },
    alternateRowStyles: {
      fillColor: lightBg
    }
  });

  currentY = doc.lastAutoTable.finalY + 6;

  // Box 3: Resumo das Movimentações por Colaborador
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkSlate);
  doc.text("QUADRO COMPARATIVO DE MOVIMENTACOES", 14, currentY);
  currentY += 3.5;

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    theme: "plain",
    head: [["Colaborador", "Papel Habitual", "Fase 1 (Ate 15/11)", "Fase 2 (A partir de 16/11)", "Status"]],
    body: [
      ["Gustavo Mistro", "Tarde (11h as 17h15)", "Ferias Regulamentares", "Ferias Regulamentares", "Ausente"],
      ["Sarah Almeida", "Manha I (08h as 14h15)", "Ferias Regulamentares", "Ferias Regulamentares", "Ausente"],
      ["Jefferson Ribeiro", "Tarde (11h as 17h15)", "Mantido na Tarde (11h as 17h15)", "Mantido na Tarde (11h as 17h15)", "Ativo"],
      ["Luiz Guilherme", "Manha II (09h as 15h15)", "09:00 as 15:15 (Telefonia / Huggy)", "09:00 as 15:15 (Telefonia / Huggy)", "Ativo"],
      ["Eduardo Caetano", "Apoio / Gestao", "08:00 as 14:15 (Cob. Sarah no Huggy)", "09:00 as 15:15 (Retorno Apoio/Gestao)", "Alterado"],
      ["Ana Beatriz Jesus", "Noturno (13h45 as 20h)", "Noturno (13h45 as 20h00)", "08:00 as 14:15 (Abertura Oficial Huggy)", "Alterado"],
      ["Luana Angelo", "Manha I (08h as 14h15)", "08:00 as 14:15 (Telefonia Abertura)", "09:00 as 15:15 (Manha II - Telefonia)", "Alterado"]
    ],
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: darkSlate
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5
    },
    columnStyles: {
      0: { cellWidth: 34, fontStyle: "bold" },
      1: { cellWidth: 34 },
      2: { cellWidth: 46 },
      3: { cellWidth: 46 },
      4: { cellWidth: 22, halign: "center", fontStyle: "bold" }
    },
    alternateRowStyles: {
      fillColor: lightBg
    },
    didParseCell: function(data) {
      if (data.section === "body" && data.column.index === 4) {
        if (data.cell.raw === "Alterado") {
          data.cell.styles.textColor = primaryRed;
        } else if (data.cell.raw === "Ausente") {
          data.cell.styles.textColor = mutedText;
        } else {
          data.cell.styles.textColor = [16, 185, 129];
        }
      }
    }
  });

  currentY = doc.lastAutoTable.finalY + 5;

  // Box 4: Diretrizes Operacionais
  doc.setFillColor(...lightBlueBg);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(14, currentY, pageWidth - 28, 23, 2, 2, "FD");

  doc.setFillColor(...accentBlue);
  doc.rect(14, currentY, 2.5, 23, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.text("ORIENTACOES E BOAS PRATICAS PARA A EQUIPE", 19, currentY + 4.5);

  doc.setFontSize(7.2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkSlate);
  const guidelines = [
    "- Pontualidade: Iniciar o login no PABX e na plataforma Huggy com 5 minutos de antecedencia ao horario escalado.",
    "- Intervalo Intrajornada: O intervalo de 15 minutos deve ser coordenado com o parceiro de canal para nao desguarnecer a fila.",
    "- Rotatividade de Canais: Os colaboradores escalados alternam entre Voz e Chat para dinamizar a rotina e manter o SLA.",
    "- Duvidas e Solicitacoes: Qualquer impedimento deve ser reportado com antecedencia a supervisao imediata."
  ];
  doc.text(guidelines, 19, currentY + 9);

  drawFooter(1, 3);

  // =========================================================================
  // PÁGINA 2: ESCALA OPERACIONAL • FASE 1 (PRÉ 16/11)
  // =========================================================================
  doc.addPage();
  drawHeader(
    "FASE 1: ESCALA PRE 16/11 (04/11 ATE 15/11/2026)",
    "Distribuicao Diaria por Postos de Atendimento (Telefonia, Huggy e Apoio)"
  );

  currentY = 30;

  // Banner informativo da Fase 1
  doc.setFillColor(254, 243, 199); // light amber
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(14, currentY, pageWidth - 28, 14, 2, 2, "FD");

  doc.setFillColor(...accentAmber);
  doc.rect(14, currentY, 2.5, 14, "F");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(146, 64, 14);
  doc.text("VIGENCIA: 04/11/2026 ATE 15/11/2026 • COBERTURA DE ABERTURA", 19, currentY + 5);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkSlate);
  doc.text("Eduardo Caetano entra as 08:00 cobrindo Sarah Almeida. Luiz Guilherme alocado as 09:00. Luana Angelo na abertura (08:00).", 19, currentY + 9.5);

  currentY += 18;

  // Dados da Fase 1 (com Luiz Guilherme)
  const phase1Rows = [
    [
      "Segunda-feira\n(08h as 20h)",
      "- Danilo dos Santos (08h)\n- Luana Angelo (08h)\n- Victor Silva (08h)\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)\n- Ana Beatriz Jesus (13h45)",
      "- Thiago Nathan (08h)\n- Eduardo Caetano (08h) [COB]\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ],
    [
      "Terca-feira\n(08h as 20h)",
      "- Luana Angelo (08h)\n- Thiago Nathan (08h)\n- Eduardo Caetano (08h) [COB]\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Danilo dos Santos (08h)\n- Victor Silva (08h)\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)\n- Ana Beatriz Jesus (13h45)",
      "- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ],
    [
      "Quarta-feira\n(08h as 20h)",
      "- Danilo dos Santos (08h)\n- Victor Silva (08h)\n- Eduardo Caetano (08h) [COB]\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)\n- Ana Beatriz Jesus (13h45)",
      "- Luana Angelo (08h)\n- Thiago Nathan (08h)\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ],
    [
      "Quinta-feira\n(08h as 20h)",
      "- Danilo dos Santos (08h)\n- Luana Angelo (08h)\n- Thiago Nathan (08h)\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Victor Silva (08h)\n- Eduardo Caetano (08h) [COB]\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)\n- Ana Beatriz Jesus (13h45)",
      "- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ],
    [
      "Sexta-feira\n(08h as 20h)",
      "- Luana Angelo (08h)\n- Victor Silva (08h)\n- Eduardo Caetano (08h) [COB]\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)\n- Ana Beatriz Jesus (13h45)",
      "- Danilo dos Santos (08h)\n- Thiago Nathan (08h)\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ],
    [
      "Sabado\n(08h as 20h)",
      "- Danilo dos Santos (08h)\n- Thiago Nathan (08h)\n- Eduardo Caetano (08h) [COB]\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Luana Angelo (08h)\n- Victor Silva (08h)\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)\n- Ana Beatriz Jesus (13h45)",
      "- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ]
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    theme: "plain",
    head: [["Dia da Semana", "Telefonia (Voz)", "Huggy (Chat)", "Apoio Operacional"]],
    body: phase1Rows,
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
      fontSize: 8
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

  // Box inferior: Resumo de Alocação da Fase 1
  doc.setFillColor(...lightBg);
  doc.setDrawColor(...borderColor);
  doc.roundedRect(14, currentY, pageWidth - 28, 14, 2, 2, "FD");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkSlate);
  doc.text("ESTRUTURA DE COBERTURA DIARIA (FASE 1):", 18, currentY + 5);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...mutedText);
  doc.text("• Abertura (08h): 5 operadores | • Reforco Matinal (09h): 4 operadores | • Pico Geral (11h as 14h15): 15 operadores ativos simultaneamente.", 18, currentY + 9.5);

  drawFooter(2, 3);

  // =========================================================================
  // PÁGINA 3: ESCALA OPERACIONAL • FASE 2 (PÓS 16/11)
  // =========================================================================
  doc.addPage();
  drawHeader(
    "FASE 2: ESCALA POS 16/11 (A PARTIR DE 16/11/2026)",
    "Distribuicao Definitiva dos Postos de Atendimento (Telefonia, Huggy e Apoio)"
  );

  currentY = 30;

  // Banner informativo da Fase 2
  doc.setFillColor(236, 253, 245); // light emerald
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14, currentY, pageWidth - 28, 14, 2, 2, "FD");

  doc.setFillColor(16, 185, 129); // emerald
  doc.rect(14, currentY, 2.5, 14, "F");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(6, 95, 70);
  doc.text("VIGENCIA: A PARTIR DE 16/11/2026 • RETORNO E REESTRUTURACAO DEFINITIVA", 19, currentY + 5);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkSlate);
  doc.text("Ana Beatriz Jesus na abertura (08:00). Luana Angelo e Luiz Guilherme em Manha II (09:00). Eduardo Caetano no Apoio (09:00).", 19, currentY + 9.5);

  currentY += 18;

  // Dados da Fase 2 (com Luiz Guilherme)
  const phase2Rows = [
    [
      "Segunda-feira\n(08h as 20h)",
      "- Danilo dos Santos (08h)\n- Victor Silva (08h)\n- Luana Angelo (09h) [NOVO]\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)",
      "- Thiago Nathan (08h)\n- Ana Beatriz Jesus (08h) [NOVO]\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Eduardo Caetano (09h) [RETORNO]\n- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ],
    [
      "Terca-feira\n(08h as 20h)",
      "- Thiago Nathan (08h)\n- Ana Beatriz Jesus (08h) [NOVO]\n- Luana Angelo (09h) [NOVO]\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Danilo dos Santos (08h)\n- Victor Silva (08h)\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)",
      "- Eduardo Caetano (09h) [RETORNO]\n- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ],
    [
      "Quarta-feira\n(08h as 20h)",
      "- Danilo dos Santos (08h)\n- Victor Silva (08h)\n- Ana Beatriz Jesus (08h) [NOVO]\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)",
      "- Thiago Nathan (08h)\n- Luana Angelo (09h) [NOVO]\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Eduardo Caetano (09h) [RETORNO]\n- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ],
    [
      "Quinta-feira\n(08h as 20h)",
      "- Danilo dos Santos (08h)\n- Thiago Nathan (08h)\n- Luana Angelo (09h) [NOVO]\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Victor Silva (08h)\n- Ana Beatriz Jesus (08h) [NOVO]\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)",
      "- Eduardo Caetano (09h) [RETORNO]\n- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ],
    [
      "Sexta-feira\n(08h as 20h)",
      "- Victor Silva (08h)\n- Ana Beatriz Jesus (08h) [NOVO]\n- Luana Angelo (09h) [NOVO]\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)",
      "- Danilo dos Santos (08h)\n- Thiago Nathan (08h)\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Eduardo Caetano (09h) [RETORNO]\n- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ],
    [
      "Sábado\n(08h as 20h)",
      "- Danilo dos Santos (08h)\n- Thiago Nathan (08h)\n- Ana Beatriz Jesus (08h) [NOVO]\n- Carolini Pontes (09h)\n- Luiz Guilherme (09h)\n- Douglas Ferreira (13h45)\n- Eduardo Silva Veira (13h45)\n- Heitor Hugo (13h45)",
      "- Victor Silva (08h)\n- Luana Angelo (09h) [NOVO]\n- Ana Beatriz Pereira (09h)\n- Jefferson Ribeiro (11h)\n- Henri Suzuki (13h45)\n- Matheus Santos (13h45)",
      "- Eduardo Caetano (09h) [RETORNO]\n- Lucas Werner (09h)\n- Alejandro Eduardo (11h)\n- Pedro Pinze (13h45)"
    ]
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    theme: "plain",
    head: [["Dia da Semana", "Telefonia (Voz)", "Huggy (Chat)", "Apoio Operacional"]],
    body: phase2Rows,
    styles: {
      fontSize: 6.8,
      cellPadding: 1.8,
      textColor: darkSlate,
      valign: "top"
    },
    headStyles: {
      fillColor: darkSlate,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8
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

  // Box inferior: Resumo de Alocação da Fase 2 & Validação
  doc.setFillColor(...lightBg);
  doc.setDrawColor(...borderColor);
  doc.roundedRect(14, currentY, pageWidth - 28, 14, 2, 2, "FD");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkSlate);
  doc.text("ESTRUTURA DE COBERTURA DIARIA (FASE 2):", 18, currentY + 5);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...mutedText);
  doc.text("• Abertura (08h): 4 operadores | • Reforco Manha II (09h): 6 operadores | • Apoio Operacional integralmente alocado.", 18, currentY + 9.5);

  drawFooter(3, 3);

  // Salva o PDF gerado
  const outPath = path.resolve("extracao_relatorios/comunicado_escalas_diarias_novembro_2026.pdf");
  const pdfBytes = doc.output("arraybuffer");
  fs.writeFileSync(outPath, Buffer.from(pdfBytes));

  console.log(`\n==========================================================`);
  console.log(` PDF ATUALIZADO COM SUCESSO: ${outPath}`);
  console.log(` Tamanho: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
  console.log(`==========================================================\n`);
}

generateSchedulePDF().catch(err => {
  console.error("Erro ao gerar PDF:", err);
  process.exit(1);
});
