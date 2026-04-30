import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Edit, FileText, MessageSquare, Sun, Sunset, Moon, X, Loader2, Calendar, Phone, PhoneMissed, CheckCircle, Clock } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { registerCollaborator, updateCollaboratorProfile, registerFeedback } from '../services/adminAuth';
import { useNotification } from '../context/NotificationContext';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CollaboratorsHub = () => {
    const { showToast } = useNotification();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingColab, setEditingColab] = useState(null);
    const [feedbackColab, setFeedbackColab] = useState(null);
    const [reportColab, setReportColab] = useState(null); // Estado do Relatório
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

    // --- LÓGICA DO GRÁFICO DE TURNOS ---
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
                            onFeedback={() => setFeedbackColab(colab)}
                            onReport={() => setReportColab(colab)}
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

            {/* Renderiza o Modal de Edição */}
            {editingColab && (
                <EditCollaboratorModal
                    colab={editingColab}
                    onClose={() => setEditingColab(null)}
                />
            )}

            {/* Renderiza o Modal de Feedback */}
            {feedbackColab && (
                <FeedbackModal
                    colab={feedbackColab}
                    onClose={() => setFeedbackColab(null)}
                />
            )}

            {/* Renderiza o Modal de Relatório */}
            {reportColab && (
                <ReportDashboardModal
                    colab={reportColab}
                    onClose={() => setReportColab(null)}
                />
            )}
        </div>
    );
};

// --- COMPONENTE DO CARD ---
const CollaboratorCard = ({ colab, onEdit, onFeedback, onReport }) => (
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
            <button onClick={onEdit} className="flex flex-col items-center gap-1 p-2 text-zinc-500 hover:text-zinc-950 hover:bg-white rounded-lg transition-all">
                <Edit className="w-4 h-4" />
                <span className="text-[9px] font-bold uppercase">Editar</span>
            </button>
            <button onClick={onReport} className="flex flex-col items-center gap-1 p-2 text-red-600 hover:bg-white rounded-lg transition-all">
                <FileText className="w-4 h-4" />
                <span className="text-[9px] font-bold uppercase">Relatório</span>
            </button>
            <button onClick={onFeedback} className="flex flex-col items-center gap-1 p-2 text-red-600 hover:bg-white rounded-lg transition-all">
                <MessageSquare className="w-4 h-4" />
                <span className="text-[9px] font-bold uppercase">Feedback</span>
            </button>
        </div>
    </div>
);

// --- COMPONENTE DO MODAL DE EDIÇÃO ---
const EditCollaboratorModal = ({ colab, onClose }) => {
    const { showToast } = useNotification();
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

// --- COMPONENTE DO MODAL DE CRIAÇÃO ---
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

// --- COMPONENTE DO MODAL DE RELATÓRIO (DASHBOARD) ---
// --- COMPONENTE DO MODAL DE RELATÓRIO (DASHBOARD COM DADOS REAIS) ---
// --- COMPONENTE DO MODAL DE RELATÓRIO (DASHBOARD COM DADOS REAIS E PONTUAÇÃO) ---
const ReportDashboardModal = ({ colab, onClose }) => {
    const [period, setPeriod] = useState('ultimos_30');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    const timeToDecimal = (timeStr) => {
        if (!timeStr) return 0;
        const parts = timeStr.split(':');
        if (parts.length !== 3) return 0;
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        const seconds = parseInt(parts[2], 10);
        return (hours * 60) + minutes + (seconds / 60);
    };

    const formatTime = (decimalMinutes) => {
        if (!decimalMinutes && decimalMinutes !== 0) return "00:00:00";
        const totalSeconds = Math.round(decimalMinutes * 60);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // NOVA FUNÇÃO: Calcula a pontuação baseada na regra de negócio
    const calcularPontuacao = (metrics) => {
        if (!metrics) return 0;
        const ptsFinalizados = (metrics.finalizados || 0) * 1;
        const ptsLigacoes = (metrics.ligAtendidas || 0) * 2;
        const ptsHuggy = (metrics.huggyVol || 0) * 1;
        const ptsPerdidas = (metrics.ligPerdidas || 0) * -5;
        
        return ptsFinalizados + ptsLigacoes + ptsHuggy + ptsPerdidas;
    };

    useEffect(() => {
        const q = query(
            collection(db, "weekly_evaluations"),
            where("colabId", "==", colab.id)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedData = [];
            snapshot.forEach((doc) => {
                const dbData = doc.data();
                fetchedData.push({
                    id: doc.id,
                    date: dbData.date || 'Semana Atual',
                    finalizados: Number(dbData.Atendimentos_Finalizados) || 0,
                    ligAtendidas: Number(dbData.Ligacoes_Atendidas) || 0,
                    ligPerdidas: Number(dbData.Ligacoes_Perdidas) || 0,
                    huggyVol: Number(dbData.Atendimentos_Huggy) || 0,
                    tmaTel: timeToDecimal(dbData.TMA_Telefonia),
                    tmaHuggy: timeToDecimal(dbData.TMA_Huggy),
                    tme: timeToDecimal(dbData.TME_Telefonia)
                });
            });
            setData(fetchedData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [colab.id, period]);

    const currentData = data.length > 0 ? data[data.length - 1] : {
        finalizados: 0, ligAtendidas: 0, ligPerdidas: 0, huggyVol: 0, tmaTel: 0, tme: 0, tmaHuggy: 0
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center z-[70] backdrop-blur-sm">
                <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[70] backdrop-blur-sm">
            <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-5 bg-zinc-950 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <FileText className="w-5 h-5 text-red-500" />
                            Relatório de Desempenho
                        </h2>
                        <p className="text-sm text-zinc-400">Analisando métricas de: <span className="text-white font-medium">{colab.name}</span></p>
                    </div>
                    <div className="flex items-center gap-4">
                        <select 
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="bg-zinc-900 border border-zinc-700 text-sm rounded-lg px-3 py-2 outline-none focus:border-red-500 transition-colors text-white"
                        >
                            <option value="ultimos_30">Últimos 30 dias</option>
                            <option value="este_mes">Este mês</option>
                            <option value="todo_periodo">Todo o período</option>
                        </select>
                        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {data.length === 0 ? (
                        <div className="text-center py-20 flex flex-col items-center justify-center">
                            <FileText className="w-16 h-16 text-gray-300 mb-4" />
                            <h3 className="text-lg font-bold text-gray-700">Nenhum dado encontrado</h3>
                            <p className="text-gray-500">Ainda não há avaliações lançadas para este colaborador.</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-white border border-gray-200 p-3 rounded-xl flex items-center gap-2 shadow-sm">
                                <Calendar className="w-5 h-5 text-red-600" />
                                <span className="font-medium text-gray-700">Visualizando dados de:</span>
                                <span className="font-bold text-gray-900">{currentData.date || 'Último lançamento'}</span>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                    <h3 className="text-sm font-bold text-gray-700 text-center mb-6 flex items-center justify-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-emerald-500" /> 
                                        Evolução: Atendimentos Finalizados
                                    </h3>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={data}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                                                <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                                <Bar dataKey="finalizados" fill="#86efac" radius={[4, 4, 0, 0]} name="Atendimentos Finalizados" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                        <h3 className="text-sm font-bold text-gray-700 text-center mb-6 flex items-center justify-center gap-2">
                                            <Clock className="w-4 h-4 text-blue-500" /> 
                                            Evolução TMA Telefonia
                                        </h3>
                                        <div className="h-56">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={data}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} tickFormatter={formatTime} />
                                                    <Tooltip contentStyle={{borderRadius: '8px'}} formatter={(value) => formatTime(value)} />
                                                    <Line type="monotone" dataKey="tmaTel" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} name="TMA Telefonia" />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                        <h3 className="text-sm font-bold text-gray-700 text-center mb-6 flex items-center justify-center gap-2">
                                            <MessageSquare className="w-4 h-4 text-purple-500" /> 
                                            Evolução TMA Huggy
                                        </h3>
                                        <div className="h-56">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={data}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} tickFormatter={formatTime} />
                                                    <Tooltip contentStyle={{borderRadius: '8px'}} formatter={(value) => formatTime(value)} />
                                                    <Line type="monotone" dataKey="tmaHuggy" stroke="#a855f7" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} name="TMA Huggy" />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 pt-4">
                                {/* CARD ATUALIZADO AQUI */}
                                <ReportCard 
                                    title="Pontuação Total" 
                                    value={`${calcularPontuacao(currentData)} pts`} 
                                    valueColor={calcularPontuacao(currentData) < 0 ? "text-red-600" : "text-amber-500"} 
                                    // icon={<Award className="w-4 h-4 text-amber-500"/>} <-- Descomente essa linha se tiver adicionado o Award no topo do arquivo
                                />
                                <ReportCard title="Atend. Finalizados" value={currentData.finalizados} valueColor="text-emerald-600" />
                                <ReportCard title="Lig. Recebidas" value={currentData.ligAtendidas} icon={<Phone className="w-4 h-4 text-blue-500"/>} />
                                <ReportCard title="Lig. Perdidas" value={currentData.ligPerdidas} valueColor="text-red-600" icon={<PhoneMissed className="w-4 h-4 text-red-500"/>} />
                                <ReportCard title="Vol. Huggy" value={currentData.huggyVol} />
                                
                                <ReportCard title="TMA Tel" value={formatTime(currentData.tmaTel)} valueColor="text-blue-600" />
                                <ReportCard title="TME Tel" value={formatTime(currentData.tme)} />
                                <ReportCard title="TMA Huggy" value={formatTime(currentData.tmaHuggy)} valueColor="text-purple-600" />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const ReportCard = ({ title, value, valueColor = "text-gray-900", icon }) => (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            {icon}
            {title}
        </div>
        <div className={`text-2xl font-black ${valueColor}`}>
            {value}
        </div>
    </div>
);

export default CollaboratorsHub;