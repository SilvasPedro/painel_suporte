import React from 'react';

/** Ícone no estilo do Microsoft Excel: planilha verde com o "X" branco. */
export default function ExcelIcon({ className = 'w-4 h-4' }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
            <rect x="9" y="3" width="13" height="18" rx="1.6" fill="#fff" fillOpacity="0.92" />
            <path d="M12 7.5h8M12 11h8M12 14.5h8M12 18h8" stroke="#1d6f42" strokeOpacity="0.55" strokeWidth="1" />
            <path d="M16 3v18" stroke="#1d6f42" strokeOpacity="0.55" strokeWidth="1" />
            <rect x="1.5" y="5" width="13" height="14" rx="1.8" fill="#107c41" stroke="#fff" strokeOpacity="0.85" strokeWidth="1" />
            <path d="M5 8.6l5 6.8M10 8.6l-5 6.8" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
    );
}
