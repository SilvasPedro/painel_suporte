import React, { useState } from 'react';
import { Phone, Headphones, Save, Loader2, AlertCircle, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { BorderBeam } from '../magicui/BorderBeam';

const formatPhoneNumber = (val) => {
    if (!val) return '';
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

export const MandatoryContactModal = () => {
    const { currentUser, isInactive } = useAuth();
    const { showToast } = useNotification();

    const [phone, setPhone] = useState(() => formatPhoneNumber(currentUser?.phone || ''));
    const [ramal, setRamal] = useState(() => currentUser?.ramal || currentUser?.slackOrTeams || '');
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [dismissed, setDismissed] = useState(false);

    // Verifica se os dados de contato já estão cadastrados
    const rawPhoneDigits = (currentUser?.phone || '').replace(/\D/g, '');
    const hasPhone = rawPhoneDigits.length >= 8;
    const hasRamal = Boolean((currentUser?.ramal && String(currentUser.ramal).trim().length > 0) || (currentUser?.slackOrTeams && String(currentUser.slackOrTeams).trim().length > 0));

    // Não exibe se o usuário não estiver logado, estiver inativo, já preencheu tudo ou salvou com sucesso
    if (!currentUser || isInactive || (hasPhone && hasRamal) || dismissed) {
        return null;
    }

    const handlePhoneChange = (e) => {
        setErrorMsg('');
        setPhone(formatPhoneNumber(e.target.value));
    };

    const handleRamalChange = (e) => {
        setErrorMsg('');
        setRamal(e.target.value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        const cleanPhone = phone.trim();
        const digits = cleanPhone.replace(/\D/g, '');
        const cleanRamal = ramal.trim();

        if (digits.length < 8) {
            setErrorMsg('Por favor, informe um número de telefone ou WhatsApp válido com DDD.');
            return;
        }

        if (!cleanRamal) {
            setErrorMsg('Por favor, informe o número do seu ramal interno de atendimento.');
            return;
        }

        setSaving(true);
        try {
            const firestoreId = currentUser.firestoreId || currentUser.uid;
            if (!firestoreId) {
                throw new Error('Identificador de usuário não encontrado.');
            }

            const payload = {
                phone: cleanPhone,
                ramal: cleanRamal,
                slackOrTeams: cleanRamal,
                updatedAt: new Date().toISOString()
            };

            // Atualiza na coleção 'collaborators'
            const colabRef = doc(db, 'collaborators', firestoreId);
            await setDoc(colabRef, payload, { merge: true });

            // Sincroniza também na coleção 'users' se houver documento
            try {
                const userRef = doc(db, 'users', firestoreId);
                await setDoc(userRef, payload, { merge: true });
            } catch {
                // Silencioso se 'users' não for usada pelo perfil
            }

            setDismissed(true);
            showToast('Contatos atualizados com sucesso! Acesso liberado ao HubDesk.', 'success');
        } catch (err) {
            console.error('Erro ao atualizar contatos obrigatórios:', err);
            setErrorMsg('Erro ao salvar os contatos: ' + (err.message || 'Tente novamente.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div 
                className="relative bg-surface rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-subtle animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* BorderBeam sutil destacando a obrigatoriedade com elegância */}
                <BorderBeam size={220} duration={8} colorFrom="#f43f5e" colorTo="#e11d48" borderWidth={1.5} />

                {/* Cabeçalho de Destaque com visual corporativo */}
                <div className="p-6 bg-gradient-to-r from-rose-600 via-rose-700 to-red-800 text-white relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0 shadow-sm">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black tracking-widest uppercase bg-white/20 text-white px-2 py-0.5 rounded-full border border-white/25">
                                    Segurança & Comunicação
                                </span>
                            </div>
                            <h2 className="text-base sm:text-lg font-black tracking-tight text-white mt-1">
                                Cadastro de Contatos
                            </h2>
                            <p className="text-xs text-rose-100">
                                Preencha seus dados de comunicação interna
                            </p>
                        </div>
                    </div>
                </div>

                {/* Formulário com design de alta fidelidade */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="p-3.5 bg-subtle border border-subtle rounded-2xl text-xs text-secondary-hub leading-relaxed flex items-start gap-3">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                            <strong className="block font-bold text-primary-hub mb-0.5">Atualização Obrigatória</strong>
                            Para navegar no HubDesk, informe seu WhatsApp/Telefone e Ramal. Esses dados são indispensáveis para os fluxos da equipe e plantões.
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2 animate-in fade-in">
                            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Telefone / WhatsApp */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-primary-hub flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-rose-500" />
                                Telefone / WhatsApp de Contato
                            </span>
                            <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">*Obrigatório</span>
                        </label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={handlePhoneChange}
                            placeholder="(11) 98765-4321"
                            className="w-full px-3.5 py-2.5 bg-subtle border border-subtle rounded-xl text-xs font-medium text-primary-hub outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all placeholder:text-muted-hub"
                            autoFocus
                        />
                        <p className="text-[10px] text-muted-hub">
                            Número com DDD para contato direto e integração com WhatsApp.
                        </p>
                    </div>

                    {/* Ramal */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-primary-hub flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Headphones className="w-3.5 h-3.5 text-rose-500" />
                                Número do seu Ramal
                            </span>
                            <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">*Obrigatório</span>
                        </label>
                        <input
                            type="text"
                            value={ramal}
                            onChange={handleRamalChange}
                            placeholder="Ex: 2045 ou 20"
                            className="w-full px-3.5 py-2.5 bg-subtle border border-subtle rounded-xl text-xs font-medium text-primary-hub outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all placeholder:text-muted-hub"
                        />
                        <p className="text-[10px] text-muted-hub">
                            Número do seu ramal VoIP interno para ligações entre operadores.
                        </p>
                    </div>

                    {/* Botão de Salvar */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full py-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-rose-900/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Validando e Gravando...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Salvar e Continuar no HubDesk</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MandatoryContactModal;
