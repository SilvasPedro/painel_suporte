// Normaliza um protocolo para comparação: ignora maiúsculas, espaços e o "#" inicial.
// "#984321", " 984321 " e "984321" são o mesmo protocolo.
export function normalizeProtocol(value) {
    return String(value ?? '')
        .trim()
        .replace(/^#+/, '')
        .replace(/\s+/g, '')
        .toLowerCase();
}

// Procura outra auditoria com o mesmo protocolo. `ignoreId` é a auditoria em edição.
export function findDuplicateAudit(audits, protocol, ignoreId = null) {
    const key = normalizeProtocol(protocol);
    if (!key || !Array.isArray(audits)) return null;
    return audits.find(a => a && a.id !== ignoreId && normalizeProtocol(a.protocol) === key) || null;
}
