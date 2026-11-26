/**
 * Gera public/atlas-bot.svg (a imagem do Atlas Bot) a partir do mesmo componente que o chat usa,
 * para o arquivo e a tela nunca divergirem.
 *
 * Uso: npx tsx scripts/generate-atlas-svg.mjs
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AtlasAvatar from '../src/components/floating/AtlasAvatar.jsx';

const markup = renderToStaticMarkup(
    React.createElement(AtlasAvatar, { size: 512, shape: 'tile', decorative: false, title: 'Atlas Bot - Agente de IA Hubdesk' })
);

const target = fileURLToPath(new URL('../public/atlas-bot.svg', import.meta.url));
writeFileSync(target, `<?xml version="1.0" encoding="UTF-8"?>\n${markup}\n`, 'utf8');
console.log(`Gerado: ${target} (${markup.length} caracteres)`);
