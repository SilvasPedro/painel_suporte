import React, { useState } from 'react';
import { Phone, Headphones, Save, Loader2, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

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

            // Tenta também sincronizar na coleção 'users' se houver documento
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
                className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-red-200 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Cabeçalho de Destaque */}
                <div className="p-6 bg-gradient-to-r from-red-600 via-red-700 to-rose-700 text-white relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0 shadow-xs">
                            <Phone className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full text-white/90 mb-1">
                                <Sparkles className="w-3 h-3 text-amber-300" />
                                Cadastro Obrigatório • v3.9
                            </span>
                            <h2 className="text-base font-black text-white leading-tight">
                                Informações de Contato
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Corpo do Modal */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <strong className="block font-bold">Atualização de Segurança e Comunicação</strong>
                            Para continuar utilizando a plataforma, preencha o seu telefone/WhatsApp e o seu ramal. Esses dados são indispensáveis para a comunicação entre a equipe.
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2 animate-in fade-in">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Telefone / WhatsApp */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-800 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-red-600" />
                                Telefone / WhatsApp de Contato
                            </span>
                            <span className="text-[10px] text-red-600 font-bold uppercase">*Obrigatório</span>
                        </label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={handlePhoneChange}
                            placeholder="(11) 98765-4321"
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-all placeholder:text-gray-400"
                            autoFocus
                        />
                        <p className="text-[10px] text-gray-500">
                            Número com DDD para contato direto e integração com WhatsApp.
                        </p>
                    </div>

                    {/* Ramal */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-800 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Headphones className="w-3.5 h-3.5 text-red-600" />
                                Número do seu Ramal
                            </span>
                            <span className="text-[10px] text-red-600 font-bold uppercase">*Obrigatório</span>
                        </label>
                        <input
                            type="text"
                            value={ramal}
                            onChange={handleRamalChange}
                            placeholder="Ex: 2045 ou 20"
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-all placeholder:text-gray-400"
                        />
                        <p className="text-[10px] text-gray-500">
                            Número do seu ramal VoIP interno para ligações entre operadores.
                        </p>
                    </div>

                    {/* Botão de Salvar Obrigatório */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-red-950/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99]"
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
