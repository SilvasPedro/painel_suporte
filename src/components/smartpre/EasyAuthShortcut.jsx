import React, { useState } from 'react';
import { ExternalLink, KeyRound, Copy, Check, Loader2, ChevronDown, Settings2, Save } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useNotification } from '../../context/NotificationContext';
import { cn } from '../../utils/cn';
import easyAuthLogo from '../../assets/easyauth_logo.png';

export const EASYAUTH_URL = 'https://app.easyauth.net/signin';
const SETTINGS_DOC = ['smart_pre_settings', 'easyauth'];

const fieldCls = 'w-full px-3 py-2 rounded-xl bg-surface border border-subtle text-sm text-primary-hub placeholder:text-muted-hub focus:outline-none focus:ring-2 focus:ring-rose-500/30';

const copyText = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
};

const CopyButton = ({ label, onCopy }) => {
    const [done, setDone] = useState(false);
    const handle = async () => {
        if (await onCopy()) {
            setDone(true);
            setTimeout(() => setDone(false), 1800);
        }
    };
    return (
        <button
            type="button"
            onClick={handle}
            aria-label={label}
            title={label}
            className="h-8 px-2.5 rounded-lg border border-subtle bg-surface hover:bg-subtle text-xs font-semibold text-secondary-hub flex items-center gap-1.5 cursor-pointer transition-colors"
        >
            {done ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {done ? 'Copiado' : 'Copiar'}
        </button>
    );
};

/**
 * Atalho para o portal de autenticação dos clientes (EasyAuth) + credenciais compartilhadas da equipe.
 * As credenciais NÃO ficam no código (o pacote do site é público): ficam no Firestore (`smart_pre_settings/easyauth`),
 * legíveis só pela equipe do Smart Pre. A senha nunca é exibida na tela, apenas copiada.
 */
export default function EasyAuthShortcut({ canConfigure }) {
    const { showToast } = useNotification();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [creds, setCreds] = useState(null); // null = ainda não carregou; {} = não configurado
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ email: '', password: '' });
    const [saving, setSaving] = useState(false);
    const [logoFailed, setLogoFailed] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const snap = await getDoc(doc(db, ...SETTINGS_DOC));
            setCreds(snap.exists() ? snap.data() : {});
        } catch (error) {
            console.error('Erro ao carregar credenciais do EasyAuth:', error);
            showToast(error?.code === 'permission-denied' ? 'Sem permissão para ver as credenciais. Publique as regras do Firestore.' : 'Não foi possível carregar as credenciais.', 'error');
            setCreds({});
        } finally {
            setLoading(false);
        }
    };

    const toggle = () => {
        const next = !open;
        setOpen(next);
        if (next && creds === null) load();
    };

    const copy = async (value, what) => {
        const ok = await copyText(value);
        showToast(ok ? `${what} copiado.` : 'Não foi possível copiar. Copie manualmente.', ok ? 'success' : 'error');
        return ok;
    };

    const save = async (e) => {
        e.preventDefault();
        const email = form.email.trim();
        if (!email || !form.password) {
            showToast('Informe o e-mail e a senha.', 'error');
            return;
        }
        setSaving(true);
        try {
            await setDoc(doc(db, ...SETTINGS_DOC), { email, password: form.password, updatedAt: new Date() });
            setCreds({ email, password: form.password });
            setForm({ email: '', password: '' });
            setEditing(false);
            showToast('Credenciais salvas.', 'success');
        } catch (error) {
            console.error('Erro ao salvar credenciais do EasyAuth:', error);
            showToast('Não foi possível salvar. Apenas a gestão pode alterar as credenciais.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const configured = Boolean(creds?.email && creds?.password);

    return (
        <div className="flex flex-col items-stretch sm:items-end gap-2">
            <a
                href={EASYAUTH_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 shadow-sm flex items-center justify-center gap-2.5 transition-colors"
                title="Abrir o portal de autenticação dos clientes (EasyAuth)"
            >
                {logoFailed
                    ? <span className="text-sm font-bold text-white">EasyAuth</span>
                    : <img src={easyAuthLogo} alt="EasyAuth" className="h-5 w-auto" onError={() => setLogoFailed(true)} />}
                <span className="text-xs font-semibold text-zinc-300">Portal de autenticação</span>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            </a>

            <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                className="self-center sm:self-end flex items-center gap-1.5 text-xs font-semibold text-secondary-hub hover:text-primary-hub cursor-pointer transition-colors"
            >
                <KeyRound className="w-3.5 h-3.5" /> Ver credenciais
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
            </button>

            {open && (
                <div className="w-full sm:w-80 rounded-2xl border border-subtle bg-surface p-3.5 space-y-3 shadow-sm">
                    {loading ? (
                        <div className="py-3 flex items-center justify-center text-muted-hub"><Loader2 className="w-4 h-4 animate-spin" /></div>
                    ) : editing ? (
                        <form onSubmit={save} className="space-y-2.5">
                            <input aria-label="E-mail do EasyAuth" type="email" autoComplete="off" className={fieldCls} placeholder="E-mail de acesso" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                            <input aria-label="Senha do EasyAuth" type="password" autoComplete="new-password" className={fieldCls} placeholder="Senha" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setEditing(false)} className="h-8 px-3 rounded-lg text-xs font-semibold text-secondary-hub hover:bg-subtle cursor-pointer">Cancelar</button>
                                <button type="submit" disabled={saving} className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60">
                                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvar
                                </button>
                            </div>
                        </form>
                    ) : configured ? (
                        <>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-hub mb-1">E-mail</p>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm text-primary-hub truncate select-all">{creds.email}</span>
                                    <CopyButton label="Copiar e-mail" onCopy={() => copy(creds.email, 'E-mail')} />
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-hub mb-1">Senha</p>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm text-primary-hub tracking-widest select-none" aria-label="Senha oculta">••••••••••</span>
                                    <CopyButton label="Copiar senha" onCopy={() => copy(creds.password, 'Senha')} />
                                </div>
                                <p className="text-[10px] text-muted-hub mt-1">A senha fica oculta; use o botão para copiar.</p>
                            </div>
                        </>
                    ) : (
                        <p className="text-xs text-secondary-hub leading-relaxed">
                            As credenciais ainda não foram cadastradas.{canConfigure ? ' Cadastre abaixo para a equipe poder copiar.' : ' Peça à gestão para cadastrá-las.'}
                        </p>
                    )}

                    {!loading && !editing && canConfigure && (
                        <button
                            type="button"
                            onClick={() => { setForm({ email: creds?.email || '', password: '' }); setEditing(true); }}
                            className="flex items-center gap-1.5 text-[11px] font-semibold text-secondary-hub hover:text-primary-hub cursor-pointer"
                        >
                            <Settings2 className="w-3.5 h-3.5" /> {configured ? 'Alterar credenciais' : 'Cadastrar credenciais'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
