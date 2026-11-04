import * as fs from "fs";
import * as path from "path";

// Grade de Dezembro/2026 com Efetivo Pleno (20 colaboradores operacionais)
// 8 Telefonia + 8 Huggy + 4 Apoio por dia = 20 alocações/dia = 120 alocações na semana
const escalaDezembro = [
  // ==================== SEGUNDA-FEIRA ====================
  // Telefonia (8)
  { dia: "Segunda", canal: "Telefonia", colab: "Danilo dos Santos Amaro", turno: "08:00 às 14:15" },
  { dia: "Segunda", canal: "Telefonia", colab: "Victor Silva Alves", turno: "08:00 às 14:15" },
  { dia: "Segunda", canal: "Telefonia", colab: "Sarah Almeida", turno: "08:00 às 14:15" },
  { dia: "Segunda", canal: "Telefonia", colab: "Luana Ângelo", turno: "09:00 às 15:15" },
  { dia: "Segunda", canal: "Telefonia", colab: "Ana Beatriz Pereira", turno: "09:00 às 15:15" },
  { dia: "Segunda", canal: "Telefonia", colab: "Jefferson Ribeiro", turno: "11:00 às 17:15" },
  { dia: "Segunda", canal: "Telefonia", colab: "Henri Suzuki", turno: "13:45 às 20:00" },
  { dia: "Segunda", canal: "Telefonia", colab: "Matheus Santos", turno: "13:45 às 20:00" },

  // Huggy (8)
  { dia: "Segunda", canal: "Huggy", colab: "Thiago Nathan", turno: "08:00 às 14:15" },
  { dia: "Segunda", canal: "Huggy", colab: "Ana Beatriz Jesus", turno: "08:00 às 14:15" },
  { dia: "Segunda", canal: "Huggy", colab: "Carolini Pontes", turno: "09:00 às 15:15" },
  { dia: "Segunda", canal: "Huggy", colab: "Luiz Guilherme", turno: "09:00 às 15:15" },
  { dia: "Segunda", canal: "Huggy", colab: "Gustavo Mistro", turno: "11:00 às 17:15" },
  { dia: "Segunda", canal: "Huggy", colab: "Douglas Ferreira Cruz", turno: "13:45 às 20:00" },
  { dia: "Segunda", canal: "Huggy", colab: "Eduardo Silva Veira", turno: "13:45 às 20:00" },
  { dia: "Segunda", canal: "Huggy", colab: "Heitor Hugo", turno: "13:45 às 20:00" },

  // Apoio (4)
  { dia: "Segunda", canal: "Apoio", colab: "Eduardo Caetano", turno: "09:00 às 15:15" },
  { dia: "Segunda", canal: "Apoio", colab: "Lucas Werner", turno: "09:00 às 15:15" },
  { dia: "Segunda", canal: "Apoio", colab: "Alejandro Eduardo", turno: "11:00 às 17:15" },
  { dia: "Segunda", canal: "Apoio", colab: "Pedro Pinze", turno: "13:45 às 20:00" },

  // ==================== TERÇA-FEIRA ====================
  // Telefonia (8)
  { dia: "Terça", canal: "Telefonia", colab: "Thiago Nathan", turno: "08:00 às 14:15" },
  { dia: "Terça", canal: "Telefonia", colab: "Ana Beatriz Jesus", turno: "08:00 às 14:15" },
  { dia: "Terça", canal: "Telefonia", colab: "Carolini Pontes", turno: "09:00 às 15:15" },
  { dia: "Terça", canal: "Telefonia", colab: "Luiz Guilherme", turno: "09:00 às 15:15" },
  { dia: "Terça", canal: "Telefonia", colab: "Gustavo Mistro", turno: "11:00 às 17:15" },
  { dia: "Terça", canal: "Telefonia", colab: "Douglas Ferreira Cruz", turno: "13:45 às 20:00" },
  { dia: "Terça", canal: "Telefonia", colab: "Eduardo Silva Veira", turno: "13:45 às 20:00" },
  { dia: "Terça", canal: "Telefonia", colab: "Heitor Hugo", turno: "13:45 às 20:00" },

  // Huggy (8)
  { dia: "Terça", canal: "Huggy", colab: "Danilo dos Santos Amaro", turno: "08:00 às 14:15" },
  { dia: "Terça", canal: "Huggy", colab: "Victor Silva Alves", turno: "08:00 às 14:15" },
  { dia: "Terça", canal: "Huggy", colab: "Sarah Almeida", turno: "08:00 às 14:15" },
  { dia: "Terça", canal: "Huggy", colab: "Luana Ângelo", turno: "09:00 às 15:15" },
  { dia: "Terça", canal: "Huggy", colab: "Ana Beatriz Pereira", turno: "09:00 às 15:15" },
  { dia: "Terça", canal: "Huggy", colab: "Jefferson Ribeiro", turno: "11:00 às 17:15" },
  { dia: "Terça", canal: "Huggy", colab: "Henri Suzuki", turno: "13:45 às 20:00" },
  { dia: "Terça", canal: "Huggy", colab: "Matheus Santos", turno: "13:45 às 20:00" },

  // Apoio (4)
  { dia: "Terça", canal: "Apoio", colab: "Eduardo Caetano", turno: "09:00 às 15:15" },
  { dia: "Terça", canal: "Apoio", colab: "Lucas Werner", turno: "09:00 às 15:15" },
  { dia: "Terça", canal: "Apoio", colab: "Alejandro Eduardo", turno: "11:00 às 17:15" },
  { dia: "Terça", canal: "Apoio", colab: "Pedro Pinze", turno: "13:45 às 20:00" },

  // ==================== QUARTA-FEIRA ====================
  // Telefonia (8)
  { dia: "Quarta", canal: "Telefonia", colab: "Danilo dos Santos Amaro", turno: "08:00 às 14:15" },
  { dia: "Quarta", canal: "Telefonia", colab: "Victor Silva Alves", turno: "08:00 às 14:15" },
  { dia: "Quarta", canal: "Telefonia", colab: "Thiago Nathan", turno: "08:00 às 14:15" },
  { dia: "Quarta", canal: "Telefonia", colab: "Luana Ângelo", turno: "09:00 às 15:15" },
  { dia: "Quarta", canal: "Telefonia", colab: "Ana Beatriz Pereira", turno: "09:00 às 15:15" },
  { dia: "Quarta", canal: "Telefonia", colab: "Jefferson Ribeiro", turno: "11:00 às 17:15" },
  { dia: "Quarta", canal: "Telefonia", colab: "Henri Suzuki", turno: "13:45 às 20:00" },
  { dia: "Quarta", canal: "Telefonia", colab: "Matheus Santos", turno: "13:45 às 20:00" },

  // Huggy (8)
  { dia: "Quarta", canal: "Huggy", colab: "Sarah Almeida", turno: "08:00 às 14:15" },
  { dia: "Quarta", canal: "Huggy", colab: "Ana Beatriz Jesus", turno: "08:00 às 14:15" },
  { dia: "Quarta", canal: "Huggy", colab: "Carolini Pontes", turno: "09:00 às 15:15" },
  { dia: "Quarta", canal: "Huggy", colab: "Luiz Guilherme", turno: "09:00 às 15:15" },
  { dia: "Quarta", canal: "Huggy", colab: "Gustavo Mistro", turno: "11:00 às 17:15" },
  { dia: "Quarta", canal: "Huggy", colab: "Douglas Ferreira Cruz", turno: "13:45 às 20:00" },
  { dia: "Quarta", canal: "Huggy", colab: "Eduardo Silva Veira", turno: "13:45 às 20:00" },
  { dia: "Quarta", canal: "Huggy", colab: "Heitor Hugo", turno: "13:45 às 20:00" },

  // Apoio (4)
  { dia: "Quarta", canal: "Apoio", colab: "Eduardo Caetano", turno: "09:00 às 15:15" },
  { dia: "Quarta", canal: "Apoio", colab: "Lucas Werner", turno: "09:00 às 15:15" },
  { dia: "Quarta", canal: "Apoio", colab: "Alejandro Eduardo", turno: "11:00 às 17:15" },
  { dia: "Quarta", canal: "Apoio", colab: "Pedro Pinze", turno: "13:45 às 20:00" },

  // ==================== QUINTA-FEIRA ====================
  // Telefonia (8)
  { dia: "Quinta", canal: "Telefonia", colab: "Sarah Almeida", turno: "08:00 às 14:15" },
  { dia: "Quinta", canal: "Telefonia", colab: "Ana Beatriz Jesus", turno: "08:00 às 14:15" },
  { dia: "Quinta", canal: "Telefonia", colab: "Carolini Pontes", turno: "09:00 às 15:15" },
  { dia: "Quinta", canal: "Telefonia", colab: "Luiz Guilherme", turno: "09:00 às 15:15" },
  { dia: "Quinta", canal: "Telefonia", colab: "Gustavo Mistro", turno: "11:00 às 17:15" },
  { dia: "Quinta", canal: "Telefonia", colab: "Douglas Ferreira Cruz", turno: "13:45 às 20:00" },
  { dia: "Quinta", canal: "Telefonia", colab: "Eduardo Silva Veira", turno: "13:45 às 20:00" },
  { dia: "Quinta", canal: "Telefonia", colab: "Heitor Hugo", turno: "13:45 às 20:00" },

  // Huggy (8)
  { dia: "Quinta", canal: "Huggy", colab: "Danilo dos Santos Amaro", turno: "08:00 às 14:15" },
  { dia: "Quinta", canal: "Huggy", colab: "Victor Silva Alves", turno: "08:00 às 14:15" },
  { dia: "Quinta", canal: "Huggy", colab: "Thiago Nathan", turno: "08:00 às 14:15" },
  { dia: "Quinta", canal: "Huggy", colab: "Luana Ângelo", turno: "09:00 às 15:15" },
  { dia: "Quinta", canal: "Huggy", colab: "Ana Beatriz Pereira", turno: "09:00 às 15:15" },
  { dia: "Quinta", canal: "Huggy", colab: "Jefferson Ribeiro", turno: "11:00 às 17:15" },
  { dia: "Quinta", canal: "Huggy", colab: "Henri Suzuki", turno: "13:45 às 20:00" },
  { dia: "Quinta", canal: "Huggy", colab: "Matheus Santos", turno: "13:45 às 20:00" },

  // Apoio (4)
  { dia: "Quinta", canal: "Apoio", colab: "Eduardo Caetano", turno: "09:00 às 15:15" },
  { dia: "Quinta", canal: "Apoio", colab: "Lucas Werner", turno: "09:00 às 15:15" },
  { dia: "Quinta", canal: "Apoio", colab: "Alejandro Eduardo", turno: "11:00 às 17:15" },
  { dia: "Quinta", canal: "Apoio", colab: "Pedro Pinze", turno: "13:45 às 20:00" },

  // ==================== SEXTA-FEIRA ====================
  // Telefonia (8)
  { dia: "Sexta", canal: "Telefonia", colab: "Danilo dos Santos Amaro", turno: "08:00 às 14:15" },
  { dia: "Sexta", canal: "Telefonia", colab: "Sarah Almeida", turno: "08:00 às 14:15" },
  { dia: "Sexta", canal: "Telefonia", colab: "Ana Beatriz Jesus", turno: "08:00 às 14:15" },
  { dia: "Sexta", canal: "Telefonia", colab: "Luana Ângelo", turno: "09:00 às 15:15" },
  { dia: "Sexta", canal: "Telefonia", colab: "Ana Beatriz Pereira", turno: "09:00 às 15:15" },
  { dia: "Sexta", canal: "Telefonia", colab: "Jefferson Ribeiro", turno: "11:00 às 17:15" },
  { dia: "Sexta", canal: "Telefonia", colab: "Henri Suzuki", turno: "13:45 às 20:00" },
  { dia: "Sexta", canal: "Telefonia", colab: "Matheus Santos", turno: "13:45 às 20:00" },

  // Huggy (8)
  { dia: "Sexta", canal: "Huggy", colab: "Victor Silva Alves", turno: "08:00 às 14:15" },
  { dia: "Sexta", canal: "Huggy", colab: "Thiago Nathan", turno: "08:00 às 14:15" },
  { dia: "Sexta", canal: "Huggy", colab: "Carolini Pontes", turno: "09:00 às 15:15" },
  { dia: "Sexta", canal: "Huggy", colab: "Luiz Guilherme", turno: "09:00 às 15:15" },
  { dia: "Sexta", canal: "Huggy", colab: "Gustavo Mistro", turno: "11:00 às 17:15" },
  { dia: "Sexta", canal: "Huggy", colab: "Douglas Ferreira Cruz", turno: "13:45 às 20:00" },
  { dia: "Sexta", canal: "Huggy", colab: "Eduardo Silva Veira", turno: "13:45 às 20:00" },
  { dia: "Sexta", canal: "Huggy", colab: "Heitor Hugo", turno: "13:45 às 20:00" },

  // Apoio (4)
  { dia: "Sexta", canal: "Apoio", colab: "Eduardo Caetano", turno: "09:00 às 15:15" },
  { dia: "Sexta", canal: "Apoio", colab: "Lucas Werner", turno: "09:00 às 15:15" },
  { dia: "Sexta", canal: "Apoio", colab: "Alejandro Eduardo", turno: "11:00 às 17:15" },
  { dia: "Sexta", canal: "Apoio", colab: "Pedro Pinze", turno: "13:45 às 20:00" },

  // ==================== SÁBADO ====================
  // Telefonia (8)
  { dia: "Sábado", canal: "Telefonia", colab: "Victor Silva Alves", turno: "08:00 às 14:15" },
  { dia: "Sábado", canal: "Telefonia", colab: "Thiago Nathan", turno: "08:00 às 14:15" },
  { dia: "Sábado", canal: "Telefonia", colab: "Carolini Pontes", turno: "09:00 às 15:15" },
  { dia: "Sábado", canal: "Telefonia", colab: "Luiz Guilherme", turno: "09:00 às 15:15" },
  { dia: "Sábado", canal: "Telefonia", colab: "Gustavo Mistro", turno: "11:00 às 17:15" },
  { dia: "Sábado", canal: "Telefonia", colab: "Douglas Ferreira Cruz", turno: "13:45 às 20:00" },
  { dia: "Sábado", canal: "Telefonia", colab: "Eduardo Silva Veira", turno: "13:45 às 20:00" },
  { dia: "Sábado", canal: "Telefonia", colab: "Heitor Hugo", turno: "13:45 às 20:00" },

  // Huggy (8)
  { dia: "Sábado", canal: "Huggy", colab: "Danilo dos Santos Amaro", turno: "08:00 às 14:15" },
  { dia: "Sábado", canal: "Huggy", colab: "Sarah Almeida", turno: "08:00 às 14:15" },
  { dia: "Sábado", canal: "Huggy", colab: "Ana Beatriz Jesus", turno: "08:00 às 14:15" },
  { dia: "Sábado", canal: "Huggy", colab: "Luana Ângelo", turno: "09:00 às 15:15" },
  { dia: "Sábado", canal: "Huggy", colab: "Ana Beatriz Pereira", turno: "09:00 às 15:15" },
  { dia: "Sábado", canal: "Huggy", colab: "Jefferson Ribeiro", turno: "11:00 às 17:15" },
  { dia: "Sábado", canal: "Huggy", colab: "Henri Suzuki", turno: "13:45 às 20:00" },
  { dia: "Sábado", canal: "Huggy", colab: "Matheus Santos", turno: "13:45 às 20:00" },

  // Apoio (4)
  { dia: "Sábado", canal: "Apoio", colab: "Eduardo Caetano", turno: "09:00 às 15:15" },
  { dia: "Sábado", canal: "Apoio", colab: "Lucas Werner", turno: "09:00 às 15:15" },
  { dia: "Sábado", canal: "Apoio", colab: "Alejandro Eduardo", turno: "11:00 às 17:15" },
  { dia: "Sábado", canal: "Apoio", colab: "Pedro Pinze", turno: "13:45 às 20:00" },
];

function generateCsv(items, filename) {
  const header = "Dia;Canal;Colaborador;Turno";
  const rows = items.map(it => `"${it.dia}";"${it.canal}";"${it.colab}";"${it.turno}"`);
  const content = "\uFEFF" + [header, ...rows].join("\r\n");
  fs.writeFileSync(filename, content, "utf8");
  console.log(`Generated: ${filename} (${items.length} rows)`);
}

const outDir = path.resolve("extracao_relatorios");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

generateCsv(escalaDezembro, path.join(outDir, "escala_diaria_dezembro_2026.csv"));

// Validação matemática
const byDay = {};
const byColab = {};

escalaDezembro.forEach(r => {
  byDay[r.dia] = byDay[r.dia] || { Telefonia: 0, Huggy: 0, Apoio: 0 };
  byDay[r.dia][r.canal]++;

  byColab[r.colab] = byColab[r.colab] || { turno: r.turno, Telefonia: 0, Huggy: 0, Apoio: 0, total: 0 };
  byColab[r.colab][r.canal]++;
  byColab[r.colab].total++;
});

console.log("\n=== DISTRIBUIÇÃO DIÁRIA (DEZEMBRO) ===");
console.table(byDay);

console.log("\n=== DISTRIBUIÇÃO POR COLABORADOR (DEZEMBRO) ===");
console.table(byColab);

