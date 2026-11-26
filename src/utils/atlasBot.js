/**
 * Geometria do Atlas Bot, o agente de IA do Hubdesk.
 *
 * A marca do Hubdesk é um trevo de elipses sobrepostas (três "pétalas" a 120 graus, cada uma feita de várias
 * elipses finas giradas em leque). Aqui a marca é gerada por código para poder ser desenhada em qualquer tamanho
 * dentro do avatar, sem depender de arquivo de imagem.
 */

export const ATLAS_NAME = 'Atlas Bot';
export const ATLAS_TITLE = 'Agente de IA Hubdesk';

// Paleta do avatar (a identidade do Hubdesk é carmesim/rose)
export const ATLAS_COLORS = {
    bgFrom: '#3b0a17',
    bgTo: '#12060a',
    bodyFrom: '#f43f5e',
    bodyTo: '#be123c',
    shellFrom: '#ffffff',
    shellTo: '#ffe4e6',
    visor: '#1c0a10',
    eye: '#fb7185',
    globe: '#fb7185',
    accent: '#be123c'
};

/**
 * Elipses da marca em torno da origem (0,0). Cada pétala é um conjunto de elipses finas giradas em leque.
 * @param {{ radius?: number, steps?: number, fan?: number }} options
 * @returns {{ rotate: number, ellipses: { cx: number, cy: number, rx: number, ry: number, rotate: number }[] }[]}
 */
export const trefoilPetals = ({ radius = 40, steps = 12, fan = 80 } = {}) => {
    const safeSteps = Math.max(2, Math.round(steps));
    return [0, 120, 240].map((rotate) => ({
        rotate,
        ellipses: Array.from({ length: safeSteps }, (_, i) => {
            const t = i / (safeSteps - 1);
            return {
                cx: 0,
                cy: -radius * 0.5,
                rx: round2(radius * (0.3 + 0.12 * Math.sin(t * Math.PI))),
                ry: round2(radius * 0.62),
                rotate: round2(-fan / 2 + fan * t)
            };
        })
    }));
};

const round2 = (n) => Math.round(n * 100) / 100;
