import React, { useId } from 'react';
import { ATLAS_COLORS as C, ATLAS_NAME, trefoilPetals } from '../../utils/atlasBot';

// Marca do Hubdesk (trevo de elipses) desenhada em (0,0)
function HubdeskMark({ radius, stroke, strokeWidth, opacity = 1 }) {
    return (
        <g fill="none" stroke={stroke} strokeWidth={strokeWidth} opacity={opacity}>
            {trefoilPetals({ radius }).map(petal => (
                <g key={petal.rotate} transform={`rotate(${petal.rotate})`}>
                    {petal.ellipses.map((e, i) => (
                        <ellipse key={i} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} transform={`rotate(${e.rotate})`} />
                    ))}
                </g>
            ))}
        </g>
    );
}

/**
 * Avatar do Atlas Bot: robô de headset (suporte) sustentando o globo, como o Titã Atlas, com a marca do
 * Hubdesk no peito. É um SVG puro, com fundo próprio, então funciona igual nos temas claro, papel e escuro.
 *
 * shape: "tile" (quadrado arredondado, padrão) ou "circle" (para as bolinhas e os avatares pequenos).
 */
export default function AtlasAvatar({ size = 40, shape = 'tile', className = '', title = ATLAS_NAME, decorative = true }) {
    // O id sem ":" funciona dentro de url(#...)
    const uid = `atlas-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
    const radius = shape === 'circle' ? 128 : 56;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            width={size}
            height={size}
            className={className}
            role={decorative ? undefined : 'img'}
            aria-hidden={decorative ? 'true' : undefined}
            aria-label={decorative ? undefined : title}
            focusable="false"
        >
            {!decorative && <title>{title}</title>}
            <defs>
                <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor={C.bgFrom} />
                    <stop offset="1" stopColor={C.bgTo} />
                </linearGradient>
                <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={C.bodyFrom} />
                    <stop offset="1" stopColor={C.bodyTo} />
                </linearGradient>
                <linearGradient id={`${uid}-shell`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={C.shellFrom} />
                    <stop offset="1" stopColor={C.shellTo} />
                </linearGradient>
                <clipPath id={`${uid}-tile`}>
                    <rect width="256" height="256" rx={radius} />
                </clipPath>
                <clipPath id={`${uid}-globe`}>
                    <circle cx="128" cy="152" r="98" />
                </clipPath>
            </defs>

            <g clipPath={`url(#${uid}-tile)`}>
                <rect width="256" height="256" fill={`url(#${uid}-bg)`} />

                {/* Globo que o Atlas sustenta: contorno, paralelos e meridianos */}
                <g fill="none" stroke={C.globe}>
                    <circle cx="128" cy="152" r="98" strokeWidth="3.5" opacity="0.55" />
                    <g clipPath={`url(#${uid}-globe)`} strokeWidth="2" opacity="0.3">
                        <line x1="30" y1="152" x2="226" y2="152" />
                        <line x1="30" y1="112" x2="226" y2="112" />
                        <line x1="30" y1="192" x2="226" y2="192" />
                        <line x1="128" y1="54" x2="128" y2="250" />
                        <ellipse cx="128" cy="152" rx="44" ry="98" />
                        <ellipse cx="128" cy="152" rx="76" ry="98" />
                    </g>
                </g>

                {/* Corpo, pescoço e placa do peito com a marca do Hubdesk */}
                <path d="M44 256 C44 206 82 178 128 178 C174 178 212 206 212 256 Z" fill={`url(#${uid}-body)`} />
                <rect x="112" y="158" width="32" height="26" rx="8" fill={C.accent} />
                <g transform="translate(128 222)">
                    <HubdeskMark radius={27} stroke="#ffffff" strokeWidth="1" opacity="0.92" />
                </g>

                {/* Headset: arco por trás da cabeça */}
                <path d="M66 112 C66 40 190 40 190 112" fill="none" stroke={C.accent} strokeWidth="9" strokeLinecap="round" />

                {/* Cabeça */}
                <rect x="66" y="64" width="124" height="104" rx="38" fill={`url(#${uid}-shell)`} stroke="#fecdd3" strokeWidth="2" />
                <circle cx="60" cy="118" r="15" fill={C.accent} stroke="#fff1f2" strokeWidth="3" />
                <circle cx="196" cy="118" r="15" fill={C.accent} stroke="#fff1f2" strokeWidth="3" />
                {/* Microfone do headset (na frente, saindo do fone direito) */}
                <path d="M196 132 C196 158 192 172 176 174" fill="none" stroke={C.accent} strokeWidth="5" strokeLinecap="round" />
                <circle cx="173" cy="174" r="8" fill={C.accent} stroke="#fff1f2" strokeWidth="2.5" />

                {/* Visor e olhos */}
                <rect x="82" y="88" width="92" height="56" rx="28" fill={C.visor} />
                <rect x="100" y="106" width="21" height="20" rx="10" fill={C.eye} />
                <rect x="135" y="106" width="21" height="20" rx="10" fill={C.eye} />
                <circle cx="108" cy="111" r="3.2" fill="#ffffff" opacity="0.85" />
                <circle cx="143" cy="111" r="3.2" fill="#ffffff" opacity="0.85" />
            </g>
        </svg>
    );
}
