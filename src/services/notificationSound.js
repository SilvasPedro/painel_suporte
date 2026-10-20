// Serviço sintetizador de som para notificações (0 dependências externas, 0 arquivos faltantes)
const SOUND_STORAGE_KEY = 'hubdesk_notification_sound_enabled';

export const isSoundEnabled = () => {
    try {
        const val = localStorage.getItem(SOUND_STORAGE_KEY);
        return val === null ? true : val === 'true';
    } catch {
        return true;
    }
};

export const setSoundEnabled = (enabled) => {
    try {
        localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
        // Ignora silenciosamente
    }
};

let audioCtx = null;

const getAudioContext = () => {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    
    if (!audioCtx) {
        audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
};

/**
 * Toca um sinal sonoro cristalino (chime harmônico com fade suave)
 */
export const playNotificationChime = (type = 'feedback') => {
    if (!isSoundEnabled()) return;
    
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        
        // Frequências harmônicas baseadas no tipo de notificação
        // Feedback = D5 (587Hz) para A5 (880Hz) — tom agradável e distinto
        const notes = type === 'test' 
            ? [523.25, 659.25, 783.99] // C5 -> E5 -> G5 (acorde maior de teste)
            : [587.33, 880.00];         // D5 -> A5 (chime de feedback)

        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.12);

            // Envelope acústico suave
            gain.gain.setValueAtTime(0.0001, now + idx * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.2, now + idx * 0.12 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.35);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + idx * 0.12);
            osc.stop(now + idx * 0.12 + 0.36);
        });
    } catch (err) {
        console.warn('Não foi possível tocar o som da notificação:', err);
    }
};
