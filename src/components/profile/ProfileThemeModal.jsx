import React, { useState } from 'react';
import { Palette, X, Check, Image as ImageIcon, Grid3x3, Sparkles, Type, RotateCcw } from 'lucide-react';
import {
    PAGE_BG_PRESETS, PROFILE_PATTERNS, ACCENT_COLORS, DEFAULT_PROFILE_THEME,
    TAGLINE_MAX, sanitizeProfileTheme, sanitizeImageUrl, buildPatternStyle, hexToRgba
} from '../../utils/profileTheme';
import { ProfileThemeLayer } from './ProfileThemeLayer';

const TABS = [
    { id: 'bg', label: 'Fundo da tela', icon: ImageIcon },
    { id: 'pattern', label: 'Patterns', icon: Grid3x3 },
    { id: 'accent', label: 'Destaque', icon: Sparkles },
    { id: 'tagline', label: 'Frase', icon: Type }
];

const Slider = ({ label, value, min, max, suffix = '', onChange }) => (
    <label className="block">
        <span className="flex justify-between text-[11px] font-bold text-secondary-hub mb-1">
            <span>{label}</span>
            <span className="font-mono text-muted-hub">{Math.round(value)}{suffix}</span>
        </span>
        <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-rose-600" />
    </label>
);

/**
 * Modal de personalização do perfil: fundo da tela (preset ou imagem HTTPS), padrões coloridos,
 * cor de destaque, cartões translúcidos e frase de status. Trabalha num rascunho e só devolve
 * o tema ao confirmar (a gravação acontece em "Salvar Alterações" do perfil).
 */
export const ProfileThemeModal = ({ initialTheme, accentFallback = '#e11d48', onConfirm, onClose }) => {
    const [draft, setDraft] = useState(() => sanitizeProfileTheme(initialTheme));
    const [tab, setTab] = useState('bg');
    const [imageInput, setImageInput] = useState(() => sanitizeProfileTheme(initialTheme).bg.imageUrl);
    const [imageError, setImageError] = useState('');

    const setBg = (patch) => setDraft(d => ({ ...d, bg: { ...d.bg, ...patch } }));
    const setPattern = (patch) => setDraft(d => ({ ...d, pattern: { ...d.pattern, ...patch } }));

    const applyImage = () => {
        const raw = imageInput.trim();
        if (!raw) { setImageError(''); setBg({ imageUrl: '' }); return; }
        const clean = sanitizeImageUrl(raw);
        if (!clean) { setImageError('Use um link que comece com https:// e não tenha espaços, aspas ou parênteses.'); return; }
        setImageError('');
        setBg({ imageUrl: clean });
    };

    const accent = draft.accent || accentFallback;

    return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="relative bg-surface rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-subtle" onClick={(e) => e.stopPropagation()}>
                <div className="p-5 bg-gradient-to-r from-rose-600 to-red-700 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center"><Palette className="w-5 h-5" /></div>
                        <div>
                            <h3 className="text-sm font-bold">Personalizar Perfil</h3>
                            <p className="text-[11px] text-rose-100">Fundo, patterns e cores para deixar o perfil com a sua cara</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar" className="p-2 rounded-xl hover:bg-white/15 cursor-pointer"><X className="w-4 h-4" /></button>
                </div>

                <div className="overflow-y-auto p-5 space-y-4">
                    {/* Pré-visualização ao vivo */}
                    <div className="relative h-32 rounded-2xl border border-subtle overflow-hidden bg-canvas" style={{ borderColor: draft.accent || undefined }}>
                        <ProfileThemeLayer theme={draft} />
                        <div className="relative z-10 h-full flex items-center gap-3 p-4">
                            <div className={`w-14 h-14 rounded-2xl bg-surface border-2 flex items-center justify-center text-lg font-black text-primary-hub shrink-0 ${draft.glass ? 'opacity-90' : ''}`} style={{ borderColor: accent }}>Eu</div>
                            <div className={`px-3 py-2 rounded-xl ${draft.glass ? 'backdrop-blur-md bg-white/20 dark:bg-black/30' : 'bg-surface'} border border-subtle min-w-0`}>
                                <p className="text-xs font-black text-primary-hub">Seu nome</p>
                                <p className="text-[11px] font-semibold truncate" style={{ color: accent }}>{draft.tagline || 'Sua frase de status aparece aqui'}</p>
                            </div>
                        </div>
                    </div>

                    <div role="tablist" className="flex gap-1 p-1 bg-subtle rounded-xl overflow-x-auto">
                        {TABS.map(({ id, label, icon }) => (
                            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer transition-all ${tab === id ? 'bg-surface text-primary-hub shadow-xs' : 'text-muted-hub hover:text-primary-hub'}`}>
                                {React.createElement(icon, { className: 'w-3.5 h-3.5' })}{label}
                            </button>
                        ))}
                    </div>

                    {tab === 'bg' && (
                        <div className="space-y-4">
                            <div>
                                <p className="text-[11px] font-bold text-secondary-hub mb-2">Cores e degradês</p>
                                <div className="grid grid-cols-5 gap-2">
                                    {PAGE_BG_PRESETS.map(p => {
                                        const selected = !draft.bg.imageUrl && draft.bg.preset === p.id;
                                        return (
                                            <button key={p.id} type="button" onClick={() => { setBg({ preset: p.id, imageUrl: '' }); setImageInput(''); setImageError(''); }}
                                                title={p.name} aria-label={p.name} aria-pressed={selected}
                                                className={`relative h-12 rounded-xl border-2 cursor-pointer transition-all ${selected ? 'border-rose-500 scale-105' : 'border-subtle hover:border-strong'}`}
                                                style={p.css ? { backgroundImage: p.css } : undefined}>
                                                {!p.css && <span className="text-[9px] font-bold text-muted-hub">Padrão</span>}
                                                {selected && <Check className="absolute top-1 right-1 w-3.5 h-3.5 text-white drop-shadow" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-secondary-hub mb-1.5">Ou use uma imagem (link HTTPS)</p>
                                <div className="flex gap-2">
                                    <input type="url" value={imageInput} onChange={(e) => setImageInput(e.target.value)} onBlur={applyImage}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyImage(); } }}
                                        placeholder="https://exemplo.com/meu-fundo.jpg"
                                        className="flex-1 px-3 py-2 bg-subtle border border-subtle rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-primary-hub placeholder:text-muted-hub" />
                                    <button type="button" onClick={applyImage} className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer">Aplicar</button>
                                </div>
                                {imageError && <p className="text-[11px] text-rose-600 mt-1">{imageError}</p>}
                            </div>
                            {draft.bg.imageUrl && (
                                <Slider label="Escurecer a imagem (melhora a leitura)" value={draft.bg.dim} min={0} max={80} suffix="%" onChange={(dim) => setBg({ dim })} />
                            )}
                            <label className="flex items-center gap-2.5 text-xs font-semibold text-primary-hub cursor-pointer">
                                <input type="checkbox" checked={draft.glass} onChange={(e) => setDraft(d => ({ ...d, glass: e.target.checked }))} className="w-4 h-4 accent-rose-600" />
                                Cartões translúcidos (efeito vidro sobre o fundo)
                            </label>
                        </div>
                    )}

                    {tab === 'pattern' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                {PROFILE_PATTERNS.map(p => {
                                    const selected = draft.pattern.id === p.id;
                                    const style = p.id === 'none' ? null : buildPatternStyle({ pattern: { id: p.id, color: '#64748b', opacity: 55, size: 80 } });
                                    return (
                                        <button key={p.id} type="button" onClick={() => setPattern({ id: p.id })} aria-pressed={selected} title={p.name}
                                            className={`relative h-14 rounded-xl border-2 bg-subtle overflow-hidden cursor-pointer transition-all ${selected ? 'border-rose-500 scale-105' : 'border-subtle hover:border-strong'}`}>
                                            {style && <span className="absolute inset-0" style={style} />}
                                            <span className="absolute inset-x-0 bottom-0 text-[9px] font-bold bg-surface/85 text-primary-hub py-0.5">{p.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {draft.pattern.id !== 'none' && (
                                <>
                                    <div>
                                        <p className="text-[11px] font-bold text-secondary-hub mb-2">Cor do pattern</p>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {['#ffffff', '#000000', ...ACCENT_COLORS].map(c => (
                                                <button key={c} type="button" onClick={() => setPattern({ color: c })} aria-label={`Cor ${c}`} aria-pressed={draft.pattern.color === c}
                                                    className={`w-7 h-7 rounded-full border-2 cursor-pointer ${draft.pattern.color === c ? 'border-rose-500 scale-110' : 'border-subtle'}`} style={{ backgroundColor: c }} />
                                            ))}
                                            <input type="color" value={draft.pattern.color} onChange={(e) => setPattern({ color: e.target.value })} aria-label="Escolher outra cor" className="w-8 h-8 rounded-lg border border-subtle bg-transparent cursor-pointer" />
                                            <span className="w-7 h-7 rounded-full border border-subtle" style={{ backgroundColor: hexToRgba(draft.pattern.color, draft.pattern.opacity) }} title="Cor com a opacidade atual" />
                                        </div>
                                    </div>
                                    <Slider label="Intensidade" value={draft.pattern.opacity} min={5} max={60} suffix="%" onChange={(opacity) => setPattern({ opacity })} />
                                    <Slider label="Tamanho" value={draft.pattern.size} min={60} max={200} suffix="%" onChange={(size) => setPattern({ size })} />
                                </>
                            )}
                        </div>
                    )}

                    {tab === 'accent' && (
                        <div>
                            <p className="text-[11px] font-bold text-secondary-hub mb-2">Cor de destaque (moldura do avatar, contorno do cartão principal e frase de status)</p>
                            <div className="flex flex-wrap items-center gap-2">
                                <button type="button" onClick={() => setDraft(d => ({ ...d, accent: '' }))} aria-pressed={!draft.accent}
                                    className={`px-3 h-8 rounded-full border-2 text-[11px] font-bold cursor-pointer ${!draft.accent ? 'border-rose-500 text-primary-hub' : 'border-subtle text-muted-hub'}`}>Padrão</button>
                                {ACCENT_COLORS.map(c => (
                                    <button key={c} type="button" onClick={() => setDraft(d => ({ ...d, accent: c }))} aria-label={`Destaque ${c}`} aria-pressed={draft.accent === c}
                                        className={`w-8 h-8 rounded-full border-2 cursor-pointer ${draft.accent === c ? 'border-primary-hub scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                                ))}
                                <input type="color" value={accent} onChange={(e) => setDraft(d => ({ ...d, accent: e.target.value }))} aria-label="Escolher outra cor" className="w-8 h-8 rounded-lg border border-subtle bg-transparent cursor-pointer" />
                            </div>
                        </div>
                    )}

                    {tab === 'tagline' && (
                        <div>
                            <label className="text-[11px] font-bold text-secondary-hub block mb-1.5">Frase de status (aparece abaixo do seu nome)</label>
                            <input type="text" value={draft.tagline} maxLength={TAGLINE_MAX} onChange={(e) => setDraft(d => ({ ...d, tagline: e.target.value }))}
                                placeholder="Ex.: Café, chamados e boas ideias ☕"
                                className="w-full px-3 py-2 bg-subtle border border-subtle rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-primary-hub placeholder:text-muted-hub" />
                            <p className="text-[10px] text-muted-hub mt-1 text-right">{draft.tagline.length}/{TAGLINE_MAX}</p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-subtle flex items-center justify-between gap-2 shrink-0">
                    <button type="button" onClick={() => { setDraft(sanitizeProfileTheme(DEFAULT_PROFILE_THEME)); setImageInput(''); setImageError(''); }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-strong text-secondary-hub hover:bg-subtle text-xs font-bold cursor-pointer">
                        <RotateCcw className="w-3.5 h-3.5" />Restaurar padrão
                    </button>
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-secondary-hub hover:bg-subtle cursor-pointer">Cancelar</button>
                        <button type="button" onClick={() => onConfirm(draft)} className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold cursor-pointer">Aplicar ao perfil</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileThemeModal;
