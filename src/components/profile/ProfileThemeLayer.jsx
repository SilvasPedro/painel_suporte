import React from 'react';
import { buildBackgroundStyle, buildPatternStyle, sanitizeProfileTheme } from '../../utils/profileTheme';

/**
 * Camadas visuais do tema (fundo + escurecimento + padrão). Posicione dentro de um contêiner `relative`;
 * ocupa todo o contêiner e não captura cliques.
 */
export const ProfileThemeLayer = ({ theme, className = '' }) => {
    const t = sanitizeProfileTheme(theme);
    const bgStyle = buildBackgroundStyle(t);
    const patternStyle = buildPatternStyle(t);
    if (!bgStyle && !patternStyle) return null;

    return (
        <div aria-hidden="true" className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            {bgStyle && <div className="absolute inset-0" style={bgStyle} />}
            {bgStyle && t.bg.imageUrl && t.bg.dim > 0 && (
                <div className="absolute inset-0 bg-black" style={{ opacity: t.bg.dim / 100 }} />
            )}
            {patternStyle && <div className="absolute inset-0" style={patternStyle} />}
        </div>
    );
};

export default ProfileThemeLayer;
