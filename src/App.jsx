import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

// Importando as Telas
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import CollaboratorDashboard from './pages/CollaboratorDashboard';

const AppRoutes = () => {
  const { currentUser, userRole, loading } = useAuth();

  // 1. Tela de carregamento enquanto o Firebase decide se o cara tá logado ou não
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  // 2. Se não tem ninguém logado, mostra o Login
  if (!currentUser) {
    return <Login />;
  }

  // 3. Se logou e for admin/gestor, mostra o dashboard completo da gestão
  if (userRole === 'admin') {
    return <AdminDashboard />;
  }

  // 4. Se logou e for colaborador comum, manda pro dashboard individual DELE
  return <CollaboratorDashboard currentUserId={currentUser.firestoreId} />;
};

const App = () => {
  return (
    <NotificationProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </NotificationProvider>
  );
};

export default App;