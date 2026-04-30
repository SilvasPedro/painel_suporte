import React, { useState } from 'react';
import { Key, Save, Loader2, ShieldCheck } from 'lucide-react';
import { updatePassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useNotification } from '../context/NotificationContext';

const Settings = () => {
    const { showToast } = useNotification();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        
        if (newPassword !== confirmPassword) {
            showToast("As senhas não coincidem!", "error");
            return;
        }

        if (newPassword.length < 6) {
            showToast("A nova senha deve ter no mínimo 6 caracteres.", "error");
            return;
        }

        setLoading(true);
        try {
            // Atualiza a senha do usuário que está logado no momento
            await updatePassword(auth.currentUser, newPassword);
            showToast("Sua senha foi alterada com sucesso!", "success");
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            // O Firebase exige que o login seja recente para mudar a senha
            if (error.code === 'auth/requires-recent-login') {
                showToast("Sua sessão expirou. Saia do sistema, faça login novamente e tente alterar a senha.", "error");
            } else {
                showToast("Erro ao alterar senha: " + error.message, "error");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 p-6 bg-gray-50 h-full overflow-y-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-red-600" />
                        Configurações da Conta
                    </h1>
                    <p className="text-sm text-gray-500">Gerencie suas credenciais e preferências de acesso.</p>
                </div>
            </header>

            <div className="max-w-xl bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Key className="w-5 h-5 text-gray-500" />
                    Alterar Senha de Acesso
                </h2>
                
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nova Senha</label>
                        <input 
                            type="password" 
                            required
                            placeholder="Mínimo 6 caracteres"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none text-gray-900"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Confirmar Nova Senha</label>
                        <input 
                            type="password" 
                            required
                            placeholder="Repita a nova senha"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none text-gray-900"
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full mt-4 py-3 px-4 bg-zinc-950 text-white rounded-lg hover:bg-black transition-colors font-bold flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        SALVAR NOVA SENHA
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Settings;