// Preenche `accessLevel` nos colaboradores que ainda não têm o campo, PRESERVANDO o acesso atual
// (o nível é derivado do cargo, igual ao fallback do app e das regras do Firestore).
// Também confere se o id do documento é igual ao uid do Firebase Auth, que as regras exigem.
//
// Uso (por padrão só LISTA, não grava nada):
//   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\caminho\service-account.json"
//   node scripts/migrate-access-levels.mjs            # simulação
//   node scripts/migrate-access-levels.mjs --apply    # grava
//
// Ids internos (ver src/services/rbac.js): gestor = Supervisor, supervisor = Líder, apoio = Apoio,
// colaborador = Operacional, qualidade = Qualidade (esta só é atribuída manualmente pelo Hub).
// O cargo (campo role) não é alterado.

import admin from 'firebase-admin';

const LEVELS = ['gestor', 'supervisor', 'apoio', 'colaborador', 'qualidade'];

// Mesma lógica de normalizeRole em src/services/rbac.js (copiada para não importar o SDK de cliente)
const normalizeRole = (roleString) => {
    if (!roleString) return 'colaborador';
    const lower = String(roleString).trim().toLowerCase();
    if (lower.includes('gestor') || lower.includes('admin') || lower.includes('gerente') || lower.includes('coordenador')) return 'gestor';
    if (lower.includes('supervis')) return 'supervisor';
    if (lower.includes('apoio') || lower.includes('assistente')) return 'apoio';
    return 'colaborador';
};

const apply = process.argv.includes('--apply');

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();
const auth = admin.auth();

const snap = await db.collection('collaborators').get();
const summary = { total: snap.size, jaTinha: 0, atualizar: 0, uidDiferente: 0, semConta: 0 };
const writes = [];
const porNivel = {};

for (const d of snap.docs) {
    const data = d.data();

    // O id do documento deve ser o uid do Auth (as regras leem collaborators/{request.auth.uid})
    if (data.email) {
        try {
            const user = await auth.getUserByEmail(data.email);
            if (user.uid !== d.id) {
                summary.uidDiferente++;
                console.warn(`! ${data.email}: id do doc (${d.id}) difere do uid do Auth (${user.uid}). As regras não vão reconhecer o nível deste usuário.`);
            }
        } catch {
            summary.semConta++;
            console.warn(`! ${data.email}: sem conta no Firebase Auth.`);
        }
    }

    if (LEVELS.includes(data.accessLevel)) {
        summary.jaTinha++;
        continue;
    }

    const level = normalizeRole(data.role);
    porNivel[level] = (porNivel[level] || 0) + 1;
    summary.atualizar++;
    console.log(`${apply ? 'GRAVAR' : 'simular'}: ${data.name || d.id} (cargo "${data.role || ''}") -> ${level}`);
    writes.push({ ref: d.ref, level });
}

if (apply) {
    for (let i = 0; i < writes.length; i += 400) {
        const batch = db.batch();
        writes.slice(i, i + 400).forEach(({ ref, level }) => batch.update(ref, { accessLevel: level }));
        await batch.commit();
    }
}

console.log('\nResumo:', summary);
console.log('Por nível (ids internos):', porNivel);
console.log(apply ? 'Alterações gravadas.' : 'Simulação: nada foi gravado. Rode com --apply para gravar.');
