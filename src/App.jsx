import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PermissionsProvider, usePermissions } from './context/PermissionsContext';
import { NotificationProvider } from './context/NotificationContext';
import { messaging } from './services/firebase';
import { getToken } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './services/firebase';
import FloatingChat from './components/FloatingChat';
import FloatingExtensions from './components/FloatingExtensions';

// Importação das páginas
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';

// ==========================================
// GERENCIADOR DE NOTIFICAÇÕES (Invisível)
// ==========================================
const NotificationManager = () => {
    const { currentUser } = useAuth();

    useEffect(() => {
        async function requestNotificationPermission() {
            try {
                if (!messaging || typeof window === 'undefined' || !('Notification' in window)) {
                    return;
                }
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    const token = await getToken(messaging, { 
                        vapidKey: 'BGK2ZQE-DyWlwEk00nwgXppWc8kmJfidnErECA81peK1iUHkgf32D_9NgXxL73N7mED68U1ZEzRvT43tGQ1x0Vg' 
                    });
                    
                    if (token) {
                        console.log('Token FCM gerado com sucesso:', token);
                        
                        if (currentUser.firestoreId) {
                            try {
                                await updateDoc(doc(db, 'collaborators', currentUser.firestoreId), {
                                    fcmToken: token
                                });
                                console.log('Token salvo no perfil do usuário com sucesso!');
                            } catch (e) {
                                console.error('Erro ao salvar token no banco:', e);
                            }
                        }
                    } else {
                        console.log('Nenhum token de registro disponível.');
                    }
                } else {
                    console.log('Permissão para notificações foi negada pelo usuário.');
                }
            } catch (error) {
                console.error('Erro ao pedir permissão para notificações:', error);
            }
        }

        if (currentUser) {
            requestNotificationPermission();
        }
    }, [currentUser]);

    return null; 
};

// ==========================================
// PROTEÇÃO DE ROTAS (RBAC ATUALIZADO)
// ==========================================
const PrivateRoute = ({ children }) => {
    const { currentUser, loading } = useAuth();
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

    return children;
};

// ==========================================
// GERENCIADOR DE ROTAS (Filho do AuthProvider)
// ==========================================
const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Rota Unificada com RBAC por Perfil */}
            <Route path="/admin/*" element={
                <PrivateRoute>
                    <AdminDashboard />
                </PrivateRoute>
            } />
            
            {/* Redirecionamento de compatibilidade da rota /collaborator para /admin */}
            <Route path="/collaborator/*" element={
                <PrivateRoute>
                    <Navigate to="/admin" replace />
                </PrivateRoute>
            } />

            {/* Redirecionamento Padrão */}
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
    );
};

// ==========================================
// APP PRINCIPAL
// ==========================================
function App() {
    return (
        <NotificationProvider>
            <AuthProvider>
                <PermissionsProvider>
                    <BrowserRouter>
                        <NotificationManager />
                        <AppRoutes />
                        <FloatingChat />
                        <FloatingExtensions />
                    </BrowserRouter>
                </PermissionsProvider>
            </AuthProvider>
        </NotificationProvider>
    );
}

export default App;