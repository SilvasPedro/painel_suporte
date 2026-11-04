import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  where 
} from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDyJHliLhSH5Oxq9iS5m1WA2yfFNgfQQAE",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "prodigyapp-73141.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "prodigyapp-73141",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "prodigyapp-73141.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "573565202933",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:573565202933:web:c0615b224663a0931430bc",
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || "G-TD5TN22MEN"
};

const TARGET_NAMES = [
  "Alejandro Eduardo",
  "Heitor Hugo",
  "Matheus Santos",
  "Thiago Nathan",
  "Victor Silva"
];

function normalizeStr(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatDate(val) {
  if (!val) return "N/A";
  if (val && typeof val.toDate === "function") {
    return val.toDate().toLocaleString("pt-BR");
  }
  if (val && typeof val.toMillis === "function") {
    return new Date(val.toMillis()).toLocaleString("pt-BR");
  }
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split("-");
      return `${d}/${m}/${y}`;
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
    return val;
  }
  if (val instanceof Date) return val.toLocaleDateString("pt-BR");
  return String(val);
}

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("==========================================================");
  console.log(" Hubdesk - Extração Completa de Dados de Colaboradores");
  console.log("==========================================================");

  let email = process.argv[2] || process.env.ADMIN_EMAIL;
  let password = process.argv[3] || process.env.ADMIN_PASSWORD;

  if (!email) {
    email = await promptUser("Digite seu e-mail de Administrador/Gestor: ");
  }
  if (!password) {
    password = await promptUser("Digite sua senha: ");
  }

  if (!email || !password) {
    console.error("Erro: E-mail e senha são necessários para autenticar no Firestore.");
    process.exit(1);
  }

  console.log(`\nConectando como: ${email}...`);
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log(`Autenticado com sucesso! UID: ${userCredential.user.uid}`);
  } catch (err) {
    console.error(`Falha na autenticação: ${err.message}`);
    process.exit(1);
  }

  console.log("\nCarregando catálogo de colaboradores...");
  const colabsSnapshot = await getDocs(collection(db, "collaborators"));
  const allColabs = [];
  colabsSnapshot.forEach((docSnap) => {
    allColabs.push({ id: docSnap.id, ...docSnap.data() });
  });

  console.log(`Total de colaboradores cadastrados no banco: ${allColabs.length}`);

  // Encontra os 5 colaboradores alvos
  const targetColabs = [];
  for (const targetName of TARGET_NAMES) {
    const normTarget = normalizeStr(targetName);
    const found = allColabs.find((c) => {
      const name = normalizeStr(c.name || c.colabName || "");
      return name.includes(normTarget) || normTarget.includes(name);
    });

    if (found) {
      targetColabs.push({
        targetSearch: targetName,
        id: found.id,
        name: found.name || found.colabName || targetName,
        raw: found
      });
      console.log(`  [OK] Encontrado: ${targetName} -> ID: ${found.id} ("${found.name || found.colabName}")`);
    } else {
      console.warn(`  [AVISO] Colaborador não encontrado exatamente: ${targetName}`);
      // Tentar busca por primeiro nome ou sobrenome
      const partial = allColabs.find((c) => {
        const name = normalizeStr(c.name || c.colabName || "");
        const parts = normTarget.split(" ");
        return parts.length > 0 && name.includes(parts[0]) && name.includes(parts[parts.length - 1]);
      });
      if (partial) {
        targetColabs.push({
          targetSearch: targetName,
          id: partial.id,
          name: partial.name || partial.colabName || targetName,
          raw: partial
        });
        console.log(`  [OK - Parcial] Vinculado: ${targetName} -> ID: ${partial.id} ("${partial.name || partial.colabName}")`);
      }
    }
  }

  if (targetColabs.length === 0) {
    console.error("Nenhum dos 5 colaboradores foi localizado no banco de dados.");
    process.exit(1);
  }

  // Carrega Processos QA para mapear nomes de processos
  const processesMap = {};
  try {
    const procSnap = await getDocs(collection(db, "qa_processes"));
    procSnap.forEach((d) => {
      processesMap[d.id] = d.data().name || d.data().title || d.id;
    });
  } catch (err) {
    console.warn("Aviso ao carregar processos QA:", err.message);
  }

  const outputDir = path.resolve(process.cwd(), "extracao_relatorios");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const masterReport = [];
  masterReport.push("# Relatório Consolidado de Extração - Gestão de Suporte");
  masterReport.push(`> Gerado em: ${new Date().toLocaleString("pt-BR")}`);
  masterReport.push(`> Solicitante: ${email}`);
  masterReport.push(`> Escopo: Histórico completo dos 5 colaboradores selecionados`);
  masterReport.push("");
  masterReport.push("---");
  masterReport.push("");

  for (const colab of targetColabs) {
    console.log(`\nExtraindo dados de: ${colab.name} (ID: ${colab.id})...`);

    // 1. Perfil
    const profile = colab.raw;

    // 2. Feedbacks
    let feedbacks = [];
    try {
      // Tenta query por colabId
      const q1 = query(collection(db, "feedbacks"), where("colabId", "==", colab.id));
      const s1 = await getDocs(q1);
      s1.forEach((d) => feedbacks.push({ id: d.id, ...d.data() }));

      // Tenta também query por collaboratorId se houver
      const q2 = query(collection(db, "feedbacks"), where("collaboratorId", "==", colab.id));
      const s2 = await getDocs(q2);
      s2.forEach((d) => {
        if (!feedbacks.some((f) => f.id === d.id)) {
          feedbacks.push({ id: d.id, ...d.data() });
        }
      });
    } catch (e) {
      console.warn(`  Aviso feedbacks (${colab.name}):`, e.message);
    }
    console.log(`  -> Feedbacks: ${feedbacks.length} registros`);

    // 3. Auditorias QA
    let audits = [];
    try {
      const q1 = query(collection(db, "qa_audits"), where("colabId", "==", colab.id));
      const s1 = await getDocs(q1);
      s1.forEach((d) => audits.push({ id: d.id, ...d.data() }));

      const q2 = query(collection(db, "qa_audits"), where("collaboratorId", "==", colab.id));
      const s2 = await getDocs(q2);
      s2.forEach((d) => {
        if (!audits.some((a) => a.id === d.id)) {
          audits.push({ id: d.id, ...d.data() });
        }
      });
    } catch (e) {
      console.warn(`  Aviso auditorias QA (${colab.name}):`, e.message);
    }
    console.log(`  -> Auditorias QA: ${audits.length} registros`);

    // 4. Métricas Semanais
    let weeklyMetrics = [];
    try {
      const q1 = query(collection(db, "weekly_evaluations"), where("colabId", "==", colab.id));
      const s1 = await getDocs(q1);
      s1.forEach((d) => weeklyMetrics.push({ id: d.id, ...d.data() }));

      const q2 = query(collection(db, "weekly_evaluations"), where("collaboratorId", "==", colab.id));
      const s2 = await getDocs(q2);
      s2.forEach((d) => {
        if (!weeklyMetrics.some((w) => w.id === d.id)) {
          weeklyMetrics.push({ id: d.id, ...d.data() });
        }
      });
    } catch (e) {
      console.warn(`  Aviso avaliações semanais (${colab.name}):`, e.message);
    }
    console.log(`  -> Métricas Semanais: ${weeklyMetrics.length} registros`);

    // 5. Avaliações Mensais 1:1
    let monthlyEvals = [];
    try {
      const q1 = query(collection(db, "monthly_evaluations"), where("colabId", "==", colab.id));
      const s1 = await getDocs(q1);
      s1.forEach((d) => monthlyEvals.push({ id: d.id, ...d.data() }));

      const q2 = query(collection(db, "monthly_evaluations"), where("collaboratorId", "==", colab.id));
      const s2 = await getDocs(q2);
      s2.forEach((d) => {
        if (!monthlyEvals.some((m) => m.id === d.id)) {
          monthlyEvals.push({ id: d.id, ...d.data() });
        }
      });
    } catch (e) {
      console.warn(`  Aviso avaliações mensais (${colab.name}):`, e.message);
    }
    console.log(`  -> Avaliações Mensais 1:1: ${monthlyEvals.length} registros`);

    // Ordenar dados por data decrescente
    const sortByDateDesc = (a, b) => {
      const getT = (item) => {
        if (item.date) return new Date(item.date).getTime() || 0;
        if (item.createdAt?.toMillis) return item.createdAt.toMillis();
        if (item.createdAt) return new Date(item.createdAt).getTime() || 0;
        return 0;
      };
      return getT(b) - getT(a);
    };

    feedbacks.sort(sortByDateDesc);
    audits.sort(sortByDateDesc);
    weeklyMetrics.sort(sortByDateDesc);
    monthlyEvals.sort(sortByDateDesc);

    // Gerar Markdown individual do colaborador
    const cLines = [];
    cLines.push(`# Relatório Individual: ${colab.name}`);
    cLines.push(`**ID no Sistema:** \`${colab.id}\``);
    cLines.push(`**Email:** ${profile.email || "N/A"}`);
    cLines.push(`**Cargo / Função:** ${profile.role || "Colaborador"}`);
    cLines.push(`**Turno:** ${profile.shift || "N/A"}`);
    cLines.push(`**Status:** ${profile.status || (profile.isInactive ? "Inativo" : "Ativo")}`);
    cLines.push(`**Data de Cadastro:** ${formatDate(profile.createdAt)}`);
    cLines.push("");

    cLines.push("## Resumo Geral dos Indicadores");
    cLines.push("| Categoria | Total de Registros | Observação Principal |");
    cLines.push("| :--- | :--- | :--- |");
    cLines.push(`| **Auditorias QA Realizadas** | ${audits.length} | Conformes: ${audits.filter(a => a.status === 'Conforme' || a.score >= 80).length} |`);
    cLines.push(`| **Feedbacks Registrados** | ${feedbacks.length} | Elogios / Orientações / Alinhamentos |`);
    cLines.push(`| **Lançamentos Semanais (Métricas)** | ${weeklyMetrics.length} | Semanas registradas na operação |`);
    cLines.push(`| **Avaliações Mensais 1:1** | ${monthlyEvals.length} | Ciclos formais de gestão |`);
    cLines.push("");

    // Seção de Auditorias QA
    cLines.push("## 1. Histórico Completo de Auditorias QA");
    if (audits.length === 0) {
      cLines.push("_Nenhuma auditoria de qualidade registrada no histórico deste colaborador._\n");
    } else {
      cLines.push("| Data | Protocolo | Canal | Processo | Status / Conformidade | Nota / Score | Avaliador |");
      cLines.push("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
      for (const a of audits) {
        const procName = processesMap[a.processId] || a.processName || a.process || "-";
        const score = a.score !== undefined ? `${a.score}%` : (a.conformityScore !== undefined ? `${a.conformityScore}%` : "-");
        cLines.push(`| ${formatDate(a.date || a.createdAt)} | ${a.protocol || a.protocolo || "-"} | ${a.method || a.channel || "-"} | ${procName} | **${a.status || "-"}** | ${score} | ${a.evaluatorName || a.evaluatorId || "-"} |`);
      }
      cLines.push("");

      // Detalhes / Observações das auditorias
      const auditsWithNotes = audits.filter(a => a.notes || a.feedback || a.observations);
      if (auditsWithNotes.length > 0) {
        cLines.push("### Detalhamento das Observações de QA");
        for (const a of auditsWithNotes) {
          cLines.push(`- **Data ${formatDate(a.date || a.createdAt)} (Protocolo: ${a.protocol || "N/A"}):**`);
          cLines.push(`  > ${a.notes || a.feedback || a.observations}`);
        }
        cLines.push("");
      }
    }

    // Seção de Feedbacks
    cLines.push("## 2. Histórico de Feedbacks Recebidos");
    if (feedbacks.length === 0) {
      cLines.push("_Nenhum feedback registrado no histórico deste colaborador._\n");
    } else {
      cLines.push("| Data | Tipo | Motivo / Título | Gestor / Autor | Confirmado / Lido |");
      cLines.push("| :--- | :--- | :--- | :--- | :--- |");
      for (const f of feedbacks) {
        const isRead = f.read ? "Sim" : "Pendente";
        cLines.push(`| ${formatDate(f.date || f.createdAt)} | **${f.type || f.feedbackType || "Geral"}** | ${f.reason || f.title || "-"} | ${f.createdBy || f.authorName || "Gestão"} | ${isRead} |`);
      }
      cLines.push("");

      cLines.push("### Conteúdo e Comentários dos Feedbacks");
      for (const f of feedbacks) {
        cLines.push(`#### Feedback - ${formatDate(f.date || f.createdAt)} (${f.type || "Geral"})`);
        cLines.push(`- **Gestor:** ${f.createdBy || f.authorName || "Gestão"}`);
        if (f.reason) cLines.push(`- **Motivo:** ${f.reason}`);
        if (f.tags && f.tags.length > 0) cLines.push(`- **Tags:** ${Array.isArray(f.tags) ? f.tags.join(", ") : f.tags}`);
        cLines.push(`- **Mensagem / Orientações:**`);
        cLines.push(`  > ${f.comment || f.message || f.description || "_Sem descrição_"}`);
        cLines.push("");
      }
    }

    // Seção de Métricas Semanais
    cLines.push("## 3. Histórico de Métricas Semanais");
    if (weeklyMetrics.length === 0) {
      cLines.push("_Nenhuma métrica semanal registrada no histórico deste colaborador._\n");
    } else {
      cLines.push("| Período / Data | Atend. Finalizados | Huggy | Telefonia Atendidas | Telefonia Perdidas | TMA Telefonia | TMA Huggy | FCR (%) | Reincidência (%) |");
      cLines.push("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
      for (const w of weeklyMetrics) {
        cLines.push(`| ${formatDate(w.date || w.period || w.createdAt)} | ${w.Atendimentos_Finalizados ?? w.completedTickets ?? "-"} | ${w.Atendimentos_Huggy ?? w.huggyTickets ?? "-"} | ${w.Ligacoes_Atendidas ?? w.callsAnswered ?? "-"} | ${w.Ligacoes_Perdidas ?? w.callsMissed ?? "-"} | ${w.TMA_Telefonia ?? "-"} | ${w.TMA_Huggy ?? "-"} | ${w.fcr ? `${w.fcr}%` : "-"} | ${w.recurrence ? `${w.recurrence}%` : "-"} |`);
      }
      cLines.push("");
    }

    // Seção de Avaliações Mensais 1:1
    cLines.push("## 4. Avaliações Mensais 1:1");
    if (monthlyEvals.length === 0) {
      cLines.push("_Nenhuma avaliação mensal 1:1 registrada no histórico deste colaborador._\n");
    } else {
      for (const m of monthlyEvals) {
        const ciclo = m.referenceMonth || m.month || m.period || formatDate(m.date || m.createdAt);
        cLines.push(`### Ciclo: ${ciclo} - ${m.title || "Alinhamento 1:1"} (Avaliador: ${m.evaluatorName || "Gestão"})`);
        if (m.classification) cLines.push(`- **Classificação:** ${m.classification}`);
        if (m.score !== undefined) cLines.push(`- **Nota Global:** ${m.score}`);
        if (m.strengths) cLines.push(`- **Pontos Fortes:** ${m.strengths}`);
        if (m.improvements) cLines.push(`- **Pontos a Desenvolver:** ${m.improvements}`);
        if (m.actionPlan) cLines.push(`- **Plano de Ação:** ${m.actionPlan}`);
        if (m.comments) cLines.push(`- **Comentários Gerais:** ${m.comments}`);
        if (m.contentMarkdown) {
          cLines.push(`\n#### Conteúdo da Avaliação 1:1:\n${m.contentMarkdown}\n`);
        }
        cLines.push("");
      }
    }

    cLines.push("---");
    cLines.push("");

    const singleColabMarkdown = cLines.join("\n");
    const sanitizedFilename = `extracao_${colab.name.replace(/\s+/g, "_")}.md`;
    fs.writeFileSync(path.join(outputDir, sanitizedFilename), singleColabMarkdown, "utf8");
    console.log(`  -> Arquivo individual salvo: extracao_relatorios/${sanitizedFilename}`);

    // Acumula no relatório geral mestre
    masterReport.push(singleColabMarkdown);
  }

  const masterFile = path.join(outputDir, "relatorio_completo_5_colaboradores.md");
  fs.writeFileSync(masterFile, masterReport.join("\n"), "utf8");
  console.log(`\n==========================================================`);
  console.log(` EXTRAÇÃO CONCLUÍDA COM SUCESSO!`);
  console.log(` Relatório Consolidado: extracao_relatorios/relatorio_completo_5_colaboradores.md`);
  console.log(`==========================================================\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro fatal durante a extração:", err);
  process.exit(1);
});
