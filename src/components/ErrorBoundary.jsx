import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { 
            hasError: false, 
            error: null, 
            errorInfo: null 
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error("ErrorBoundary capturou uma falha não tratada:", error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        if (this.props.onReset) {
            this.props.onReset();
        } else {
            window.location.reload();
        }
    };

    handleGoHome = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        window.location.href = '/home';
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback({
                    error: this.state.error,
                    resetErrorBoundary: this.handleReset
                });
            }

            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8 text-center">
                        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-sm">
                            <AlertTriangle className="w-8 h-8" />
                        </div>

                        <h2 className="text-xl font-black text-gray-900 tracking-tight">
                            Ops! Ocorreu uma instabilidade
                        </h2>

                        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                            O módulo encontrou um erro inesperado ao processar os dados visuais. Seus dados no servidor continuam salvos e seguros.
                        </p>

                        {process.env.NODE_ENV !== 'production' && this.state.error && (
                            <div className="mt-4 p-3 bg-red-50 text-red-800 rounded-lg text-left text-xs font-mono overflow-auto max-h-32 border border-red-200">
                                <strong>{this.state.error.toString()}</strong>
                            </div>
                        )}

                        <div className="mt-6 flex flex-col sm:flex-row gap-3">
                            <button
                                type="button"
                                onClick={this.handleReset}
                                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Recarregar Módulo
                            </button>
                            <button
                                type="button"
                                onClick={this.handleGoHome}
                                className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Home className="w-4 h-4" />
                                Início
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
