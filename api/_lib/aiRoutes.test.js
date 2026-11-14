import { describe, it, expect } from 'vitest';
import chatHandler from '../chat.js';
import insightsHandler from '../insights.js';

const run = async (handler, req) => {
    const out = { headers: {} };
    const res = {
        setHeader: (k, v) => { out.headers[k] = v; },
        status: (code) => { out.status = code; return { json: (body) => { out.body = body; return out; } }; }
    };
    await handler(req, res);
    return out;
};

describe('rotas de IA exigem login', () => {
    const bodies = {
        chat: { message: 'Quantos chamados estão abertos?' },
        insights: { dadosColaborador: { nota: 9 } }
    };

    for (const [name, handler] of [['chat', chatHandler], ['insights', insightsHandler]]) {
        it(`/api/${name}: sem token responde 401 e nunca chega na IA`, async () => {
            const out = await run(handler, { method: 'POST', headers: {}, body: bodies[name] });
            expect(out.status).toBe(401);
            expect(out.body.error).toBe('nao-autenticado');
            expect(out.headers['Cache-Control']).toBe('no-store');
        });

        it(`/api/${name}: token inválido responde 401`, async () => {
            const out = await run(handler, { method: 'POST', headers: { authorization: 'Bearer abc.def.ghi' }, body: bodies[name] });
            expect(out.status).toBe(401);
        });

        it(`/api/${name}: só aceita POST`, async () => {
            const out = await run(handler, { method: 'GET', headers: {} });
            expect(out.status).toBe(405);
        });
    }
});
