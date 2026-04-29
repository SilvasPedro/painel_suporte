import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Edit, FileText, MessageSquare, Sun, Sunset, Moon, X, Loader2 } from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { registerCollaborator, updateCollaboratorProfile, registerFeedback } from '../services/adminAuth';
import { useNotification } from '../context/NotificationContext';

const CollaboratorsHub = () => {
    const { showToast } = useNotification();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingColab, setEditingColab] = useState(null); // Estado para controlar quem está sendo editado
    const [feedbackColab, setFeedbackColab] = useState(null);
    const [collaborators, setCollaborators] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- CONEXÃO EM TEMPO REAL COM O FIREBASE ---
    useEffect(() => {
        const q = query(collection(db, "collaborators"), orderBy("name", "asc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const docs = [];
            querySnapshot.forEach((doc) => {
                docs.push({ id: doc.id, ...doc.data() });
            });
            setCollaborators(docs);
            setLoading(false);
        }, (error) => {
            showToast("Erro ao carregar colaboradores: " + error.message, "error");
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // --- LÓGICA DO GRÁFICO ---
    const total = collaborators.length;
    const manha = collaborators.filter(c => c.shift === 'Manhã').length;
    const tarde = collaborators.filter(c => c.shift === 'Tarde').length;
    const noite = collaborators.filter(c => c.shift === 'Noite').length;
    const getPercent = (value) => total > 0 ? (value / total) * 100 : 0;

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 bg-gray-50 h-full overflow-y-auto">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Hub de Colaboradores</h1>
                    <p className="text-sm text-gray-500">Total de {total} colaboradores registrados.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
                >
                    <UserPlus className="w-5 h-5" />
                    Novo Colaborador
                </button>
            </header>

            {/* Gráfico de Distribuição por Turno */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Distribuição por Turno</h2>
                <div className="flex items-center gap-4 mb-3">
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden flex">
                        <div style={{ width: `${getPercent(manha)}%` }} className="bg-amber-400 transition-all duration-700"></div>
                        <div style={{ width: `${getPercent(tarde)}%` }} className="bg-orange-500 transition-all duration-700"></div>
                        <div style={{ width: `${getPercent(noite)}%` }} className="bg-zinc-900 transition-all duration-700"></div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                        <span className="font-medium text-gray-700">Manhã: {manha} ({getPercent(manha).toFixed(0)}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                        <span className="font-medium text-gray-700">Tarde: {tarde} ({getPercent(tarde).toFixed(0)}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-zinc-900"></div>
                        <span className="font-medium text-gray-700">Noite: {noite} ({getPercent(noite).toFixed(0)}%)</span>
                    </div>
                </div>
            </div>

            {/* Grid de Cards dos Colaboradores */}
            {collaborators.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Nenhum colaborador cadastrado ainda.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {collaborators.map((colab) => (
                        <CollaboratorCard
                            key={colab.id}
                            colab={colab}
                            onEdit={() => setEditingColab(colab)}
                            onFeedback={() => setFeedbackColab(colab)} // Adicione esta linha
                        />
                    ))}
                </div>
            )}

            {/* Renderiza o Modal de Criação */}
            {isCreateModalOpen && (
                <CreateCollaboratorModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={() => setIsCreateModalOpen(false)}
                />
            )}

            {/* Renderiza o Modal de Edição (Se houver alguém selecionado) */}
            {editingColab && (
                <EditCollaboratorModal
                    colab={editingColab}
                    onClose={() => setEditingColab(null)}
                />
            )}
        </div>
    );
};

// --- COMPONENTE DO CARD ---
const CollaboratorCard = ({ colab, onEdit, onFeedback }) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md hover:border-red-200">
        <div className="p-5 border-b border-gray-100 flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-zinc-950 text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
                {colab.name?.charAt(0)}
            </div>
            <div className="overflow-hidden">
                <h3 className="font-bold text-gray-900 truncate">{colab.name}</h3>
                <p className="text-xs text-gray-500 mb-2 truncate">{colab.email}</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${colab.shift === 'Manhã' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                    colab.shift === 'Tarde' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                        'bg-zinc-100 text-zinc-700 border border-zinc-200'
                    }`}>
                    {colab.shift}
                </span>
            </div>
        </div>

        <div className="p-2 bg-gray-50 grid grid-cols-3 gap-1">
            {/* Botão de Editar aciona a função passada por propriedade */}
            <button onClick={onEdit} className="flex flex-col items-center gap-1 p-2 text-zinc-500 hover:text-zinc-950 hover:bg-white rounded-lg transition-all">
                <Edit className="w-4 h-4" />
                <span className="text-[9px] font-bold uppercase">Editar</span>
            </button>
            <button className="flex flex-col items-center gap-1 p-2 text-red-600 hover:bg-white rounded-lg transition-all">
                <FileText className="w-4 h-4" />
                <span className="text-[9px] font-bold uppercase">Relatório</span>
            </button>
            <button onClick={onFeedback} className="flex flex-col items-center gap-1 p-2 text-red-600 hover:bg-white rounded-lg transition-all">                <MessageSquare className="w-4 h-4" />
                <span className="text-[9px] font-bold uppercase">Feedback</span>
            </button>
        </div>
    </div>
);

// --- COMPONENTE DO MODAL DE EDIÇÃO ---
const EditCollaboratorModal = ({ colab, onClose }) => {
    const { showToast } = useNotification();
    // Inicializa o formulário com os dados que vieram do banco
    const [formData, setFormData] = useState({
        name: colab.name,
        role: colab.role,
        shift: colab.shift
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateCollaboratorProfile(colab.id, formData);
            showToast("Dados do colaborador atualizados com sucesso!", "success");
            onClose();
        } catch (error) {
            showToast("Erro ao atualizar: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-zinc-950/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-5 bg-zinc-950 flex justify-between items-center text-white">
                    <h2 className="text-lg font-bold">Editar Perfil</h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                        <input type="text" required value={formData.name} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                            onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">E-mail (Apenas Leitura)</label>
                        <input type="email" disabled value={colab.email} className="w-full p-2 border border-gray-200 bg-gray-50 text-gray-500 rounded-lg outline-none cursor-not-allowed" title="O e-mail de acesso não pode ser alterado por aqui." />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                            <input type="text" required value={formData.role} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                                onChange={e => setFormData({ ...formData, role: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Turno</label>
                            <select value={formData.shift} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none" onChange={e => setFormData({ ...formData, shift: e.target.value })}>
                                <option value="Manhã">Manhã</option>
                                <option value="Tarde">Tarde</option>
                                <option value="Noite">Noite</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
                        <button type="submit" disabled={loading} className="flex-1 py-2 px-4 bg-zinc-900 text-white rounded-lg hover:bg-black transition-colors disabled:opacity-50">
                            {loading ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- COMPONENTE DO MODAL DE CRIAÇÃO (O que você já tinha) ---
const CreateCollaboratorModal = ({ onClose, onSuccess }) => {
    const { showToast } = useNotification();
    const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'Analista de Suporte', shift: 'Manhã' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await registerCollaborator(formData.name, formData.email, formData.password, formData.role, formData.shift);
            showToast("Colaborador cadastrado com sucesso!", "success");
            onSuccess();
        } catch (error) {
            showToast(error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    {
        feedbackColab && (
            <FeedbackModal
                colab={feedbackColab}
                onClose={() => setFeedbackColab(null)}
            />
        )
    }

    return (
        <div className="fixed inset-0 bg-zinc-950/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-5 bg-zinc-950 flex justify-between items-center text-white">
                    <h2 className="text-lg font-bold">Cadastrar Novo Colaborador</h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                        <input type="text" required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                            onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">E-mail (Login)</label>
                        <input type="email" required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                            onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Senha Provisória</label>
                        <input type="password" required minLength="6" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                            onChange={e => setFormData({ ...formData, password: e.target.value })} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                            <input type="text" required defaultValue="Analista de Suporte" className="w-full p-2 border border-gray-300 rounded-lg outline-none"
                                onChange={e => setFormData({ ...formData, role: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Turno</label>
                            <select className="w-full p-2 border border-gray-300 rounded-lg outline-none" onChange={e => setFormData({ ...formData, shift: e.target.value })}>
                                <option value="Manhã">Manhã</option>
                                <option value="Tarde">Tarde</option>
                                <option value="Noite">Noite</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
                        <button type="submit" disabled={loading} className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                            {loading ? 'Cadastrando...' : 'Salvar Cadastro'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- COMPONENTE DO MODAL DE FEEDBACK ---
const FeedbackModal = ({ colab, onClose }) => {
    const { showToast } = useNotification();
    const [loading, setLoading] = useState(false);

    // Estado do formulário
    const [formData, setFormData] = useState({
        type: 'Elogio',
        method: 'Presencial',
        protocol: '',
        comment: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Chama a função passando o ID do colaborador e os dados
            await registerFeedback(colab.id, formData);
            showToast("Feedback registrado com sucesso!", "success");
            onClose();
        } catch (error) {
            showToast("Erro ao registrar feedback: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-zinc-950/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-5 bg-red-600 flex justify-between items-center text-white">
                    <div>
                        <h2 className="text-lg font-bold">Registrar Feedback</h2>
                        <p className="text-xs text-red-100">Para: {colab.name}</p>
                    </div>
                    <button onClick={onClose} className="text-red-200 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Feedback</label>
                            <select className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600"
                                onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                <option value="Elogio">Elogio</option>
                                <option value="Ponto de Melhoria">Ponto de Melhoria</option>
                                <option value="Orientação">Orientação</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Meio de Observação</label>
                            <select className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600"
                                onChange={e => setFormData({ ...formData, method: e.target.value })}>
                                <option value="Presencial">Presencial</option>
                                <option value="Sistema">Sistema</option>
                                <option value="Telefonia">Telefonia</option>
                                <option value="Chat">Chat</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Protocolo de Atendimento <span className="text-gray-400 font-normal">(Opcional)</span>
                        </label>
                        <input type="text" placeholder="Ex: 2026041288..." className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                            onChange={e => setFormData({ ...formData, protocol: e.target.value })} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Comentários e Observações</label>
                        <textarea required rows="3" placeholder="Descreva o contexto do feedback..." className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none resize-none"
                            onChange={e => setFormData({ ...formData, comment: e.target.value })}></textarea>
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
                        <button type="submit" disabled={loading} className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                            {loading ? 'Registrando...' : 'Registrar Feedback'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CollaboratorsHub;