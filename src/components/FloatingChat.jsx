import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Olá! Sou a IA do Hubdesk. Como posso ajudar você hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextData, setContextData] = useState(null);
  const messagesEndRef = useRef(null);
  
  const { currentUser } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Carregar dados de contexto quando o chat for aberto
  useEffect(() => {
    async function fetchContextData() {
      try {
        // Buscar colaboradores
        const colabsSnap = await getDocs(collection(db, "collaborators"));
        const colabs = colabsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Buscar avaliações semanais (limitando aos mais recentes ou pegando todos se forem poucos)
        const evalsSnap = await getDocs(collection(db, "weekly_evaluations"));
        const evals = evalsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Buscar KPIs
        const kpiSnap = await getDocs(collection(db, "sector_kpis"));
        const kpis = kpiSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        setContextData({
          appInfo: "Painel Hubdesk - Suporte Técnico",
          collaborators: colabs,
          evaluations: evals,
          sectorKpis: kpis
        });
      } catch (error) {
        console.error("Erro ao carregar contexto:", error);
      }
    }

    if (isOpen && !contextData) {
      fetchContextData();
    }
  }, [isOpen, contextData]);

  if (!currentUser || currentUser.role !== 'Admin') return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages,
          contextData: contextData || { appInfo: "Painel Hubdesk - Suporte Técnico" }
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Desculpe, ocorreu um erro ao processar sua solicitação.' }]);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro de conexão. Tente novamente mais tarde.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 p-4 rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 transition-all duration-300 z-50 flex items-center justify-center ${isOpen ? 'scale-0' : 'scale-100 hover:scale-110'}`}
        aria-label="Abrir chat IA"
      >
        <MessageSquare size={24} />
      </button>

      {/* Janela do Chat */}
      <div 
        className={`fixed bottom-6 right-6 w-80 sm:w-96 h-[500px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col transition-all duration-300 z-50 transform origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}
      >
        {/* Cabeçalho */}
        <div className="bg-red-600 text-white p-4 rounded-t-2xl flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <Bot size={20} />
            <h3 className="font-semibold text-sm">Hubdesk AI</h3>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-white hover:bg-red-700 p-1 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Área de mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                  msg.role === 'user' 
                    ? 'bg-red-600 text-white rounded-tr-sm' 
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm prose-red max-w-none dark:prose-invert markdown-body text-sm text-gray-700">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-red-600" />
                <span className="text-xs text-gray-500">A IA está digitando...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Área de Input */}
        <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-gray-100 rounded-b-2xl">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Faça uma pergunta..."
              className="flex-1 bg-gray-100 border-transparent rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-colors"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-full bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 transition-colors flex-shrink-0"
            >
              <Send size={16} className={isLoading ? 'opacity-0' : 'opacity-100'} />
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
