import React, { useState } from 'react';
import { Phone, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function FloatingExtensions() {
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser } = useAuth();

  if (!currentUser || currentUser.role === 'Admin') return null;

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 p-4 rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 transition-all duration-300 z-50 flex items-center justify-center ${
          isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        <Phone className="w-6 h-6" />
      </button>

      {/* Janela dos ramais */}
      <div
        className={`fixed bottom-6 right-6 w-80 md:w-96 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 z-50 border border-gray-100 origin-bottom-right ${
          isOpen
            ? 'scale-100 opacity-100'
            : 'scale-0 opacity-0 pointer-events-none'
        }`}
        style={{ maxHeight: 'calc(100vh - 100px)' }}
      >
        {/* Header */}
        <div className="bg-red-600 p-4 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            <h3 className="font-semibold text-lg">Ramais</h3>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo (lista de ramais) */}
        <div className="p-4 overflow-y-auto flex-1 bg-gray-50 text-gray-800 space-y-6">
          
          {/* Grupo: Ramais Padrão */}
          <div>
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Principal</h4>
            <ul className="space-y-2">
              <li className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-100">
                <span className="font-medium">Suporte</span>
                <span className="font-mono bg-red-100 text-red-700 px-2 py-1 rounded text-sm font-bold">20</span>
              </li>
              <li className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-100">
                <span className="font-medium">Financeiro</span>
                <span className="font-mono bg-red-100 text-red-700 px-2 py-1 rounded text-sm font-bold">21</span>
              </li>
              <li className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-100">
                <span className="font-medium">Comercial</span>
                <span className="font-mono bg-red-100 text-red-700 px-2 py-1 rounded text-sm font-bold">22</span>
              </li>
              <li className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-100">
                <span className="font-medium">Torre de Serviços</span>
                <span className="font-mono bg-red-100 text-red-700 px-2 py-1 rounded text-sm font-bold">25</span>
              </li>
              <li className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-100">
                <span className="font-medium">Retenção</span>
                <span className="font-mono bg-red-100 text-red-700 px-2 py-1 rounded text-sm font-bold">28</span>
              </li>
              <li className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-100">
                <span className="font-medium">Cobrança</span>
                <span className="font-mono bg-red-100 text-red-700 px-2 py-1 rounded text-sm font-bold">32</span>
              </li>
              <li className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-100">
                <span className="font-medium">Auto Desbloqueio (Bot)</span>
                <span className="font-mono bg-red-100 text-red-700 px-2 py-1 rounded text-sm font-bold">5002</span>
              </li>
            </ul>
          </div>

          {/* Grupo: Ramais de Feriado */}
          <div>
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Feriado</h4>
            <ul className="space-y-2">
              <li className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-100">
                <span className="font-medium">Suporte Feriado</span>
                <span className="font-mono bg-orange-100 text-orange-700 px-2 py-1 rounded text-sm font-bold">27</span>
              </li>
              <li className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-100">
                <span className="font-medium">Financeiro Feriado</span>
                <span className="font-mono bg-orange-100 text-orange-700 px-2 py-1 rounded text-sm font-bold">34</span>
              </li>
              <li className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-100">
                <span className="font-medium">Comercial Feriado</span>
                <span className="font-mono bg-orange-100 text-orange-700 px-2 py-1 rounded text-sm font-bold">30</span>
              </li>
            </ul>
          </div>

          {/* Legendas e Horários */}
          <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm space-y-3">
            <div className="space-y-1">
              <p className="flex items-center gap-2"><span className="text-red-600 font-bold">##</span> - Transferência Direta</p>
              <p className="flex items-center gap-2"><span className="text-red-600 font-bold">**</span> - Transferência Assistida</p>
            </div>
            
            <div className="pt-2 border-t border-red-200">
              <p className="font-semibold text-red-800 mb-1">Horários resolve:</p>
              <p className="text-red-700">Seg a Sex: 08:30 às 17:00</p>
              <p className="text-red-700">Sáb: 08:30 às 16:00</p>
            </div>
          </div>
          
        </div>
      </div>
    </>
  );
}
