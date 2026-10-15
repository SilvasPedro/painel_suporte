import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PermissionsProvider, usePermissions } from './context/PermissionsContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import FloatingExtensions from './components/FloatingExtensions';

// Importação das páginas
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import AccountInactive from './pages/AccountInactive';

import NotificationManager from './components/NotificationManager';

// ==========================================
// PROTEÇÃO DE ROTAS (RBAC ATUALIZADO)
// ==========================================
const PrivateRoute = ({ children }) => {
    const { currentUser, isInactive, loading } = useAuth();
    const { loadingPermissions } = usePermissions();

    if (loading || loadingPermissions) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    // Se o usuário estiver inativo no sistema, bloqueia o acesso e direciona para a tela de aviso
    if (isInactive || currentUser.isInactive) {
        return <Navigate to="/inactive" replace />;
    }

    return children;
};

// ==========================================
// ROTA DEDICADA PARA USUÁRIO INATIVO
// ==========================================
const InactiveRoute = () => {
    const { currentUser, isInactive, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    // Se o usuário estiver ativo, não deve ficar preso na tela de inativo
    if (!isInactive && !currentUser.isInactive) {
        return <Navigate to="/home" replace />;
    }

    return <AccountInactive />;
};

// ==========================================
// REDIRECIONAMENTO RAIZ INTELIGENTE
// ==========================================
const RootRedirect = () => {
    const { currentUser, isInactive, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    if (isInactive || currentUser.isInactive) {
        return <Navigate to="/inactive" replace />;
    }

    return <Navigate to="/home" replace />;
};

// ==========================================
// GERENCIADOR DE ROTAS (Filho do AuthProvider)
// ==========================================
const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Rota exclusiva para aviso de usuário desativado */}
            <Route path="/inactive" element={<InactiveRoute />} />

            {/* Rota Unificada Genérica com RBAC por Perfil */}
            <Route path="/home/*" element={
                <PrivateRoute>
                    <AdminDashboard />
                </PrivateRoute>
            } />

            {/* Rota alternativa /logged com suporte a navegação direta */}
            <Route path="/logged/*" element={
                <PrivateRoute>
                    <AdminDashboard />
                </PrivateRoute>
            } />
            
            {/* Redirecionamento de compatibilidade das rotas legadas (/admin e /collaborator) para /home */}
            <Route path="/admin/*" element={
                <PrivateRoute>
                    <Navigate to="/home" replace />
                </PrivateRoute>
            } />
            <Route path="/collaborator/*" element={
                <PrivateRoute>
                    <Navigate to="/home" replace />
                </PrivateRoute>
            } />

            {/* Redirecionamento Padrão */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<RootRedirect />} />
        </Routes>
    );
};

// ==========================================
// APP PRINCIPAL
// ==========================================
function App() {
    return (
        <ThemeProvider>
            <NotificationProvider>
                <AuthProvider>
                    <PermissionsProvider>
                        <BrowserRouter>
                            <NotificationManager />
                            <AppRoutes />
                            <FloatingExtensions />
                        </BrowserRouter>
                    </PermissionsProvider>
                </AuthProvider>
            </NotificationProvider>
        </ThemeProvider>
    );
}

export default App;