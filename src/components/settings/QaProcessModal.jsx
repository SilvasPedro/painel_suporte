import React, { useState, useRef } from 'react';
import { 
    X, Plus, Trash2, ArrowUp, ArrowDown, Copy, 
    Sparkles, FileText, CheckCircle2, Eye, Edit3, 
    Layers, Tag, Loader2, Save, HelpCircle, CheckSquare, ListPlus
} from 'lucide-react';

// Exemplos de templates pré-definidos para suporte e provedor
const PRESET_TEMPLATES = [
    {
        id: 'sem_conexao',
        name: 'Sem Conexão / ONU Desligada',
        category: 'Fibra & Redes',
        description: 'Verificação para clientes que relatam falta total de internet ou sinal óptico.',
        checklist: [
            'Confirmou o endereço e o titular da conta no início do atendimento?',
            'Verificou os LEDs da ONU/ONT e questionou o status luminoso ao cliente?',
            'Consultou o status da porta PON na OLT e potência óptica (RX/TX)?',
            'Orientou o cliente a reiniciar o equipamento com intervalo de segurança?',
            'Verificou se há rompimento massivo ou manutenção preventiva na região?',
            'Registrou detalhadamente o chamado ou ordem de serviço no sistema?'
        ]
    },
    {
        id: 'lentidao_wifi',
        name: 'Diagnóstico de Lentidão & Wi-Fi',
        category: 'Wi-Fi & Roteador',
        description: 'Roteiro de triagem para queixas de lentidão, instabilidade e alcance sem fio.',
        checklist: [
            'Questionou se a lentidão ocorre em todos os aparelhos ou em dispositivo específico?',
            'Orientou o teste de velocidade via cabo de rede ou na frequência 5GHz?',
            'Verificou a largura de banda e canal de operação do roteador?',
            'Identificou se há downloads, torrents ou alto consumo simultâneo na rede?',
            'Efetuou o teste de ping e perda de pacotes (loss)?',
            'Explicou a diferença entre rede 2.4GHz e 5GHz de forma didática?'
        ]
    },
    {
        id: 'padrao_n1',
        name: 'Atendimento Padrão & Boas Práticas N1',
        category: 'Suporte N1',
        description: 'Critérios fundamentais de cordialidade, postura e resolução no primeiro nível.',
        checklist: [
            'Realizou a saudação inicial de forma empática e profissional?',
            'Demonstrou escuta ativa sem interromper a fala do cliente?',
            'Confirmou dados cadastrais essenciais antes de alterar configurações?',
            'Manteve o cliente informado durante as pausas ou consultas internas?',
            'Confirmou a solução do problema antes de finalizar o atendimento?',
            'Registrou protocolo e encerrou com mensagem cordial?'
        ]
    },
    {
        id: 'troca_equipamento',
        name: 'Procedimento de Troca de Equipamento',
        category: 'Infraestrutura',
        description: 'Triagem e validação para encaminhamento de substituição de roteador/ONU.',
        checklist: [
            'Constatou falha física no equipamento (porta queimada, reinício em loop, sem sinal)?',
            'Testou fonte de alimentação e cabos de conexão?',
            'Verificou o tempo de uso e compatibilidade com o plano contratado?',
            'Anexou fotos ou evidências no chamado técnico?',
            'Agendou com o cliente o melhor turno para a visita técnica?'
        ]
    }
];

const CATEGORIES = [
    'Geral',
    'Suporte N1',
    'Fibra & Redes',
    'Wi-Fi & Roteador',
    'Infraestrutura',
    'Financeiro',
    'Atendimento'
];

function QaProcessModalContent({
    onClose,
    processToEdit = null,
    onSave,
    isSaving = false
}) {
    const [processName, setProcessName] = useState(processToEdit?.name || '');
    const [category, setCategory] = useState(processToEdit?.category || 'Suporte N1');
    const [description, setDescription] = useState(processToEdit?.description || '');
    const [checklistItems, setChecklistItems] = useState(
        Array.isArray(processToEdit?.checklist) && processToEdit.checklist.length > 0
            ? [...processToEdit.checklist]
            : ['']
    );

    // Controles de interface no modal
    const [modalTab, setModalTab] = useState('editor'); // 'editor' | 'preview'
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [quickInput, setQuickInput] = useState('');
    const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

    // Simulação no preview
    const [previewChecks, setPreviewChecks] = useState({});

    const quickInputRef = useRef(null);

    // --- MANIPULAÇÃO DE ITENS DA CHECKLIST ---
    const handleAddQuickItem = () => {
        if (!quickInput.trim()) return;
        setChecklistItems(prev => [...prev.filter(item => item.trim() !== ''), quickInput.trim()]);
        setQuickInput('');
        if (quickInputRef.current) {
            quickInputRef.current.focus();
        }
    };

    const handleQuickInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddQuickItem();
        }
    };

    const handleAddBlankItem = () => {
        setChecklistItems(prev => [...prev, '']);
    };

    const handleItemChange = (index, value) => {
        setChecklistItems(prev => {
            const copy = [...prev];
            copy[index] = value;
            return copy;
        });
    };

    const handleRemoveItem = (index) => {
        setChecklistItems(prev => {
            const copy = [...prev];
            copy.splice(index, 1);
            return copy.length === 0 ? [''] : copy;
        });
    };

    const handleDuplicateItem = (index) => {
        setChecklistItems(prev => {
            const copy = [...prev];
            const itemToCopy = copy[index];
            copy.splice(index + 1, 0, itemToCopy);
            return copy;
        });
    };

    const handleMoveItem = (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= checklistItems.length) return;
        setChecklistItems(prev => {
            const copy = [...prev];
            const temp = copy[index];
            copy[index] = copy[targetIndex];
            copy[targetIndex] = temp;
            return copy;
        });
    };

    // --- PROCESSAMENTO EM LOTE (COLAR VÁRIAS LINHAS) ---
    const handleApplyBulk = () => {
        if (!bulkText.trim()) {
            setIsBulkOpen(false);
            return;
        }

        const lines = bulkText
            .split('\n')
            .map(line => line.replace(/^[\d+.\-•*)\s]+/, '').trim())
            .filter(line => line.length > 0);

        if (lines.length > 0) {
            setChecklistItems(prev => {
                const currentValid = prev.filter(i => i.trim() !== '');
                return [...currentValid, ...lines];
            });
        }
        setBulkText('');
        setIsBulkOpen(false);
    };

    // --- CARREGAR TEMPLATE PRONTO ---
    const handleLoadTemplate = (template) => {
        setProcessName(template.name);
        setCategory(template.category);
        setDescription(template.description);
        setChecklistItems([...template.checklist]);
        setIsTemplatesOpen(false);
    };

    // --- SUBMISSÃO DO FORMULÁRIO ---
    const handleSubmit = (e) => {
        e.preventDefault();
        const validChecklist = checklistItems
            .map(item => item.trim())
            .filter(item => item.length > 0);

        onSave({
            name: processName.trim(),
            category: category.trim() || 'Geral',
            description: description.trim(),
            checklist: validChecklist
        });
    };

    const validCount = checklistItems.filter(i => i.trim() !== '').length;

    return (
        <div 
            id="qa-process-modal-backdrop"
            className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-3 sm:p-6 z-[90] backdrop-blur-xs animate-in fade-in duration-150"
        >
            <div 
                id="qa-process-modal-container"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-200"
            >
                {/* Cabeçalho do Modal */}
                <div className="p-4 sm:p-5 bg-zinc-950 text-white flex justify-between items-center shrink-0 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 text-red-500 flex items-center justify-center">
                            <CheckSquare className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                                    {processToEdit ? 'Editar Processo QA' : 'Novo Processo de Avaliação'}
                                </h2>
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                                    {validCount} {validCount === 1 ? 'item' : 'itens'}
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Configure as etapas e critérios que serão auditados na rotina de qualidade.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Alternador Editor / Preview */}
                        <div className="hidden sm:flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-xs">
                            <button
                                type="button"
                                onClick={() => setModalTab('editor')}
                                className={`px-3 py-1 rounded-md font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                                    modalTab === 'editor' 
                                        ? 'bg-red-600 text-white shadow-xs' 
                                        : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                <Edit3 className="w-3.5 h-3.5" /> Construtor
                            </button>
                            <button
                                type="button"
                                onClick={() => setModalTab('preview')}
                                className={`px-3 py-1 rounded-md font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                                    modalTab === 'preview' 
                                        ? 'bg-red-600 text-white shadow-xs' 
                                        : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                <Eye className="w-3.5 h-3.5" /> Prévia da Auditoria
                            </button>
                        </div>

                        <button 
                            id="btn-close-process-modal"
                            onClick={onClose}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Sub-barra de alternância mobile */}
                <div className="sm:hidden flex border-b border-gray-200 bg-gray-50 p-1">
                    <button
                        type="button"
                        onClick={() => setModalTab('editor')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                            modalTab === 'editor' ? 'bg-red-600 text-white' : 'text-gray-600'
                        }`}
                    >
                        <Edit3 className="w-3.5 h-3.5" /> Construtor
                    </button>
                    <button
                        type="button"
                        onClick={() => setModalTab('preview')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                            modalTab === 'preview' ? 'bg-red-600 text-white' : 'text-gray-600'
                        }`}
                    >
                        <Eye className="w-3.5 h-3.5" /> Prévia
                    </button>
                </div>

                {/* Corpo do Modal com Scroll */}
                <div className="overflow-y-auto flex-1 p-4 sm:p-6 bg-gray-50/60">
                    {modalTab === 'editor' ? (
                        <form id="qaProcessForm" onSubmit={handleSubmit} className="space-y-6">
                            {/* Card 1: Identificação do Processo */}
                            <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-xs space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-gray-100">
                                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                        <Tag className="w-4 h-4 text-red-600" />
                                        Identificação do Processo
                                    </h3>

                                    {/* Botão de Modelos Prontos */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setIsTemplatesOpen(!isTemplatesOpen)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                                        >
                                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                            <span>Modelos Prontos (Sugestões)</span>
                                        </button>

                                        {isTemplatesOpen && (
                                            <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white border border-gray-200 rounded-xl shadow-xl p-2 z-20 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                                                <div className="p-2 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                                    Selecione um Modelo de Suporte
                                                </div>
                                                {PRESET_TEMPLATES.map(tpl => (
                                                    <button
                                                        key={tpl.id}
                                                        type="button"
                                                        onClick={() => handleLoadTemplate(tpl)}
                                                        className="w-full text-left p-2 rounded-lg hover:bg-red-50 text-gray-800 transition-colors cursor-pointer group"
                                                    >
                                                        <div className="font-bold text-xs text-gray-900 group-hover:text-red-600 flex items-center justify-between">
                                                            <span>{tpl.name}</span>
                                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                                                {tpl.checklist.length} itens
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                                                            {tpl.description}
                                                        </p>
                                                    </button>
                                                ))}
                                                <div className="pt-1 border-t border-gray-100">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsTemplatesOpen(false)}
                                                        className="w-full py-1 text-center text-xs font-medium text-gray-400 hover:text-gray-600 cursor-pointer"
                                                    >
                                                        Fechar
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">
                                            Nome do Processo <span className="text-red-500">*</span>
                                        </label>
                                        <input 
                                            type="text" 
                                            required
                                            value={processName} 
                                            onChange={(e) => setProcessName(e.target.value)} 
                                            placeholder="Ex: Sem Acesso à Internet, Lentidão Wi-Fi, Troca de ONU..." 
                                            className="w-full p-2.5 text-sm font-semibold border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none bg-white transition-all" 
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">
                                            Categoria / Setor
                                        </label>
                                        <select
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                            className="w-full p-2.5 text-sm font-medium border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none bg-white cursor-pointer"
                                        >
                                            {CATEGORIES.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">
                                        Descrição / Instruções para o Auditor <span className="text-gray-400 font-normal">(opcional)</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={description} 
                                        onChange={(e) => setDescription(e.target.value)} 
                                        placeholder="Ex: Utilize este checklist para auditar ligações ou chamados com queixas de perda de sinal..." 
                                        className="w-full p-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-600 outline-none bg-gray-50 focus:bg-white transition-all" 
                                    />
                                </div>
                            </div>

                            {/* Card 2: Construtor de Checklist */}
                            <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-xs space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-gray-100">
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                            <Layers className="w-4 h-4 text-red-600" />
                                            Itens de Verificação da Checklist
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Adicione cada pergunta ou critério objetivo que o colaborador deve cumprir.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* Botão de Colar em Lote */}
                                        <button
                                            type="button"
                                            onClick={() => setIsBulkOpen(!isBulkOpen)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 text-zinc-800 hover:bg-zinc-200 border border-zinc-200 transition-colors cursor-pointer"
                                        >
                                            <ListPlus className="w-3.5 h-3.5 text-zinc-600" />
                                            <span>{isBulkOpen ? 'Ocultar Lote' : 'Colar em Lote'}</span>
                                        </button>

                                        {/* Adicionar campo em branco */}
                                        <button
                                            type="button"
                                            onClick={handleAddBlankItem}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Novo Campo</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Seção Expansível: Colar em Lote */}
                                {isBulkOpen && (
                                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3 animate-in fade-in duration-100">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs font-bold text-zinc-800">
                                                <FileText className="w-4 h-4 text-red-600" />
                                                <span>Importar Várias Perguntas de uma vez (uma por linha)</span>
                                            </div>
                                            <span className="text-[11px] text-zinc-500">Cole de planilhas, Word ou Notion</span>
                                        </div>
                                        <textarea
                                            rows={4}
                                            value={bulkText}
                                            onChange={(e) => setBulkText(e.target.value)}
                                            placeholder={"O colaborador confirmou os dados?\nVerificou os LEDs do roteador?\nEfetuou o teste de velocidade?\nFinalizou de forma cordial?"}
                                            className="w-full p-3 text-xs font-mono bg-white border border-zinc-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none resize-y"
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => { setBulkText(''); setIsBulkOpen(false); }}
                                                className="px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-200 rounded-lg cursor-pointer"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleApplyBulk}
                                                className="px-4 py-1.5 text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                Inserir Perguntas na Lista
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Input Rápido com Atalho ENTER */}
                                <div className="bg-red-50/40 border border-red-100 rounded-xl p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                                    <div className="flex items-center gap-2 text-xs font-bold text-red-900 shrink-0">
                                        <Plus className="w-4 h-4 text-red-600" />
                                        <span>Adição Rápida:</span>
                                    </div>
                                    <div className="flex-1 relative">
                                        <input
                                            ref={quickInputRef}
                                            type="text"
                                            value={quickInput}
                                            onChange={(e) => setQuickInput(e.target.value)}
                                            onKeyDown={handleQuickInputKeyDown}
                                            placeholder="Digite uma nova pergunta e pressione [Enter]..."
                                            className="w-full px-3 py-2 text-xs bg-white border border-red-200 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddQuickItem}
                                        disabled={!quickInput.trim()}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                                    >
                                        Adicionar
                                    </button>
                                </div>

                                {/* Lista Interativa de Itens */}
                                <div className="space-y-2.5 pt-2">
                                    {checklistItems.map((item, index) => (
                                        <div 
                                            key={index} 
                                            className="group flex items-start gap-2 p-2.5 bg-gray-50/80 hover:bg-white border border-gray-200 hover:border-gray-300 rounded-xl transition-all shadow-2xs"
                                        >
                                            {/* Número / Posição */}
                                            <div className="w-7 h-7 rounded-lg bg-gray-200/80 text-gray-700 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                                                {index + 1}
                                            </div>

                                            {/* Campo de Texto */}
                                            <div className="flex-1">
                                                <textarea
                                                    rows={Math.max(1, Math.min(3, Math.ceil((item.length || 1) / 75)))}
                                                    value={item}
                                                    onChange={(e) => handleItemChange(index, e.target.value)}
                                                    placeholder={`Critério ${index + 1} da checklist (ex: O colaborador testou a conexão direta com o cabo?)`}
                                                    className="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-transparent focus:bg-white border border-transparent focus:border-red-500 rounded-lg outline-none resize-none transition-all"
                                                />
                                            </div>

                                            {/* Controles do Item */}
                                            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                                {/* Mover para Cima */}
                                                <button
                                                    type="button"
                                                    disabled={index === 0}
                                                    onClick={() => handleMoveItem(index, -1)}
                                                    title="Mover para cima"
                                                    className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <ArrowUp className="w-3.5 h-3.5" />
                                                </button>

                                                {/* Mover para Baixo */}
                                                <button
                                                    type="button"
                                                    disabled={index === checklistItems.length - 1}
                                                    onClick={() => handleMoveItem(index, 1)}
                                                    title="Mover para baixo"
                                                    className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <ArrowDown className="w-3.5 h-3.5" />
                                                </button>

                                                {/* Duplicar Item */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleDuplicateItem(index)}
                                                    title="Duplicar pergunta"
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>

                                                {/* Excluir Item */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(index)}
                                                    title="Remover pergunta"
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </form>
                    ) : (
                        /* Aba: Prévia Interativa da Auditoria */
                        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-6">
                            <div className="border-b border-gray-100 pb-4">
                                <div className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-red-100 text-red-700 mb-2">
                                    Simulação de Auditoria
                                </div>
                                <h3 className="text-xl font-black text-gray-900">
                                    {processName || 'Nome do Processo'}
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    {description || 'Sem instruções adicionais.'}
                                </p>
                            </div>

                            {/* Barra de Progresso Simulada */}
                            {validCount > 0 && (
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2">
                                    <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                                        <span>Itens em conformidade na simulação:</span>
                                        <span className="font-mono text-red-600">
                                            {Object.values(previewChecks).filter(Boolean).length} de {validCount} (
                                            {Math.round((Object.values(previewChecks).filter(Boolean).length / validCount) * 100)}%)
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-emerald-500 transition-all duration-300"
                                            style={{
                                                width: `${(Object.values(previewChecks).filter(Boolean).length / validCount) * 100}%`
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Lista Simulada com Checkbox */}
                            <div className="space-y-3">
                                {checklistItems.filter(i => i.trim() !== '').map((item, idx) => (
                                    <label
                                        key={idx}
                                        className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                                            previewChecks[idx]
                                                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                                                : 'bg-white border-gray-200 text-gray-800 hover:border-gray-300'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={!!previewChecks[idx]}
                                            onChange={(e) => setPreviewChecks({ ...previewChecks, [idx]: e.target.checked })}
                                            className="w-4 h-4 rounded text-emerald-600 border-gray-300 focus:ring-emerald-500 mt-0.5 cursor-pointer"
                                        />
                                        <div className="text-xs flex-1">
                                            <span className="font-bold text-gray-500 mr-2">{idx + 1}.</span>
                                            <span className={previewChecks[idx] ? 'line-through opacity-80' : 'font-medium'}>
                                                {item}
                                            </span>
                                        </div>
                                    </label>
                                ))}

                                {validCount === 0 && (
                                    <div className="text-center py-8 text-gray-400 text-xs">
                                        Nenhum item válido na checklist para pré-visualizar. Volte para o construtor e adicione perguntas.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Rodapé de Ações */}
                <div className="p-4 sm:p-5 bg-white border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-gray-400" />
                        <span>
                            {validCount === 0 ? (
                                <span className="text-red-500 font-semibold">Adicione pelo menos 1 pergunta válida</span>
                            ) : (
                                <span>{validCount} {validCount === 1 ? 'pergunta configurada' : 'perguntas configuradas'}</span>
                            )}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            disabled={isSaving}
                            className="flex-1 sm:flex-none px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-bold text-xs transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            form="qaProcessForm" 
                            disabled={isSaving || validCount === 0 || !processName.trim()} 
                            className="flex-1 sm:flex-none px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow-xs hover:shadow flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Salvando Processo...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>{processToEdit ? 'Atualizar Processo' : 'Criar Processo'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function QaProcessModal({ 
    isOpen, 
    onClose, 
    processToEdit = null, 
    onSave, 
    isSaving = false 
}) {
    if (!isOpen) return null;

    return (
        <QaProcessModalContent
            key={processToEdit ? (processToEdit.id || processToEdit.name) : 'new'}
            onClose={onClose}
            processToEdit={processToEdit}
            onSave={onSave}
            isSaving={isSaving}
        />
    );
}
