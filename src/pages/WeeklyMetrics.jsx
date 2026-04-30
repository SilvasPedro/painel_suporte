import React, { useState, useEffect } from 'react';
import { Save, Loader2, Calendar, TrendingUp } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNotification } from '../context/NotificationContext';

const WeeklyMetrics = () => {
    const { showToast } = useNotification();
    const [collaborators, setCollaborators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Estado para armazenar os valores digitados na tabela
    // O formato será: { id_do_colaborador: { Ligacoes_Atendidas: "54", TMA_Telefonia: "00:09:05", ... } }
    const [metricsData, setMetricsData] = useState({});

    // Busca os colaboradores em ordem alfabética, igual ao Hub
    useEffect(() => {
        const q = query(collection(db, "collaborators"), orderBy("name", "asc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const docs = [];
            const initialMetrics = {};
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                docs.push({ id: doc.id, ...data });
                
                // Inicializa os campos vazios para cada colaborador
                initialMetrics[doc.id] = {
                    Ligacoes_Atendidas: '',
                    Ligacoes_Perdidas: '',
                    TMA_Telefonia: '',
                    TME_Telefonia: '',
                    Atendimentos_Huggy: '',
                    TMA_Huggy: '',
                    Atendimentos_Finalizados: ''
                };
            });
            
            setCollaborators(docs);
            // Só sobrescreve os inputs se for o carregamento inicial para não apagar o que o usuário já digitou
            setMetricsData(prev => Object.keys(prev).length === 0 ? initialMetrics : prev);
            setLoading(false);
        }, (error) => {
            showToast("Erro ao carregar equipe: " + error.message, "error");
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Função para atualizar o valor digitado em uma célula específica
    const handleInputChange = (colabId, field, value) => {
        setMetricsData(prev => ({
            ...prev,
            [colabId]: {
                ...prev[colabId],
                [field]: value
            }
        }));
    };

// Função para salvar tudo no banco de dados REAL com a PONTUAÇÃO
    const handleSaveMetrics = async () => {
        setSaving(true);
        try {
            const today = new Date();
            const dateString = today.toLocaleDateString('pt-BR');

            const savePromises = Object.entries(metricsData).map(async ([colabId, metrics]) => {
                const hasData = Object.values(metrics).some(val => val !== '');
                if (!hasData) return Promise.resolve();

                // Converte para número e garante que não dê erro se estiver vazio
                const finalizados = Number(metrics.Atendimentos_Finalizados) || 0;
                const ligAtendidas = Number(metrics.Ligacoes_Atendidas) || 0;
                const ligPerdidas = Number(metrics.Ligacoes_Perdidas) || 0;
                const huggy = Number(metrics.Atendimentos_Huggy) || 0;

                // Faz o cálculo da regra de negócio antes de salvar
                const pontuacaoTotal = (finalizados * 1) + (ligAtendidas * 2) + (huggy * 1) + (ligPerdidas * -5);

                return addDoc(collection(db, "weekly_evaluations"), {
                    colabId: colabId,
                    date: dateString,
                    Atendimentos_Finalizados: finalizados,
                    Ligacoes_Atendidas: ligAtendidas,
                    Ligacoes_Perdidas: ligPerdidas,
                    Atendimentos_Huggy: huggy,
                    TMA_Telefonia: metrics.TMA_Telefonia || "00:00:00",
                    TMA_Huggy: metrics.TMA_Huggy || "00:00:00",
                    TME_Telefonia: metrics.TME_Telefonia || "00:00:00",
                    pontuacao: pontuacaoTotal, // SALVANDO A PONTUÇÃO AQUI!
                    createdAt: new Date() 
                });
            });

            await Promise.all(savePromises);
            
            showToast("Avaliações semanais salvas com sucesso no banco!", "success");
            
        } catch (error) {
            console.error(error);
            showToast("Erro ao salvar avaliações no Firebase.", "error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 bg-gray-50 h-full overflow-y-auto flex flex-col">
            <header className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-red-600" />
                        Lançamento de Avaliações
                    </h1>
                    <p className="text-sm text-gray-500">Preencha as métricas semanais da equipe de atendimento.</p>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 shadow-sm">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span>Semana Atual</span>
                    </div>
                    
                    <button
                        onClick={handleSaveMetrics}
                        disabled={saving}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Salvar Lançamentos
                    </button>
                </div>
            </header>

            {/* Container da Tabela com Scroll Horizontal */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="min-w-full divide-y divide-gray-200 text-sm whitespace-nowrap">
                        <thead className="bg-zinc-950 text-white sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold border-r border-zinc-800 sticky left-0 bg-zinc-950 z-20">Colaborador</th>
                                <th className="px-4 py-3 text-left font-semibold border-r border-zinc-800">Turno</th>
                                <th className="px-4 py-3 text-center font-semibold border-r border-zinc-800">Ligações<br/>Atendidas</th>
                                <th className="px-4 py-3 text-center font-semibold border-r border-zinc-800">Ligações<br/>Perdidas</th>
                                <th className="px-4 py-3 text-center font-semibold border-r border-zinc-800">TMA<br/>Telefonia</th>
                                <th className="px-4 py-3 text-center font-semibold border-r border-zinc-800">TME<br/>Telefonia</th>
                                <th className="px-4 py-3 text-center font-semibold border-r border-zinc-800">Atendimentos<br/>Huggy</th>
                                <th className="px-4 py-3 text-center font-semibold border-r border-zinc-800">TMA<br/>Huggy</th>
                                <th className="px-4 py-3 text-center font-semibold">Atendimentos<br/>Finalizados</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {collaborators.map((colab) => (
                                <tr key={colab.id} className="hover:bg-gray-50 transition-colors">
                                    {/* Nome Fixo (Sticky) para não sumir ao rolar para o lado */}
                                    <td className="px-4 py-2 font-medium text-gray-900 border-r border-gray-200 sticky left-0 bg-white group-hover:bg-gray-50">
                                        {colab.name}
                                    </td>
                                    <td className="px-4 py-2 text-gray-600 border-r border-gray-200">
                                        {colab.shift}
                                    </td>
                                    
                                    {/* Inputs de Métricas */}
                                    <td className="px-2 py-2 border-r border-gray-200">
                                        <input type="number" className="w-full min-w-[80px] p-1.5 text-center border border-gray-300 rounded focus:ring-2 focus:ring-red-600 outline-none" placeholder="0"
                                            value={metricsData[colab.id]?.Ligacoes_Atendidas || ''} onChange={(e) => handleInputChange(colab.id, 'Ligacoes_Atendidas', e.target.value)} />
                                    </td>
                                    <td className="px-2 py-2 border-r border-gray-200">
                                        <input type="number" className="w-full min-w-[80px] p-1.5 text-center border border-gray-300 rounded focus:ring-2 focus:ring-red-600 outline-none" placeholder="0"
                                            value={metricsData[colab.id]?.Ligacoes_Perdidas || ''} onChange={(e) => handleInputChange(colab.id, 'Ligacoes_Perdidas', e.target.value)} />
                                    </td>
                                    <td className="px-2 py-2 border-r border-gray-200">
                                        <input type="text" className="w-full min-w-[90px] p-1.5 text-center border border-gray-300 rounded focus:ring-2 focus:ring-red-600 outline-none" placeholder="00:00:00"
                                            value={metricsData[colab.id]?.TMA_Telefonia || ''} onChange={(e) => handleInputChange(colab.id, 'TMA_Telefonia', e.target.value)} />
                                    </td>
                                    <td className="px-2 py-2 border-r border-gray-200">
                                        <input type="text" className="w-full min-w-[90px] p-1.5 text-center border border-gray-300 rounded focus:ring-2 focus:ring-red-600 outline-none" placeholder="00:00:00"
                                            value={metricsData[colab.id]?.TME_Telefonia || ''} onChange={(e) => handleInputChange(colab.id, 'TME_Telefonia', e.target.value)} />
                                    </td>
                                    <td className="px-2 py-2 border-r border-gray-200">
                                        <input type="number" className="w-full min-w-[80px] p-1.5 text-center border border-gray-300 rounded focus:ring-2 focus:ring-red-600 outline-none" placeholder="0"
                                            value={metricsData[colab.id]?.Atendimentos_Huggy || ''} onChange={(e) => handleInputChange(colab.id, 'Atendimentos_Huggy', e.target.value)} />
                                    </td>
                                    <td className="px-2 py-2 border-r border-gray-200">
                                        <input type="text" className="w-full min-w-[90px] p-1.5 text-center border border-gray-300 rounded focus:ring-2 focus:ring-red-600 outline-none" placeholder="00:00:00"
                                            value={metricsData[colab.id]?.TMA_Huggy || ''} onChange={(e) => handleInputChange(colab.id, 'TMA_Huggy', e.target.value)} />
                                    </td>
                                    <td className="px-2 py-2">
                                        <input type="number" className="w-full min-w-[80px] p-1.5 text-center border border-gray-300 rounded focus:ring-2 focus:ring-red-600 outline-none" placeholder="0"
                                            value={metricsData[colab.id]?.Atendimentos_Finalizados || ''} onChange={(e) => handleInputChange(colab.id, 'Atendimentos_Finalizados', e.target.value)} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default WeeklyMetrics;