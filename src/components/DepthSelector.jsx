import React from 'react';
import { Box, Square } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { DEPTH_MODES } from '../utils/depthMode';

const OPTIONS = [
    { id: '3d', label: '3D', icon: Box },
    { id: 'flat', label: 'Flat', icon: Square }
];

// Alternador de efeito visual dos ícones e botões: relevo 3D ou flat.
export default function DepthSelector({ showLabels = true, className = '' }) {
    const { depth, setDepth } = useTheme();

    return (
        <div
            id="depth-selector"
            className={`inline-flex items-center p-1 rounded-xl bg-gray-200/45 backdrop-blur-md border border-white/50 gap-0.5 ${className}`}
            role="group"
            aria-label="Efeito dos ícones e botões"
        >
            {OPTIONS.map((opt) => {
                const { id, label } = opt;
                const Icon = opt.icon;
                const active = depth === id;
                return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setDepth(id)}
                        aria-pressed={active}
                        title={`${DEPTH_MODES[id].name}: ${DEPTH_MODES[id].description}`}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors duration-200 cursor-pointer ${
                            active
                                ? 'bg-white/80 border border-white/70 text-gray-900 font-bold shadow-[0_0_0_1px_rgba(0,0,0,0.06)]'
                                : 'border border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-red-500' : 'text-gray-400'}`} />
                        {showLabels && <span className="whitespace-nowrap">{label}</span>}
                    </button>
                );
            })}
        </div>
    );
}
