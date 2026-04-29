import React, { useState, useEffect } from 'react';
import { observeAuth } from './services/auth';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard'; // Você criará esta a seguir
import { NotificationProvider } from './context/NotificationContext';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = observeAuth((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <NotificationProvider>
    <div className="App">
      {user ? <AdminDashboard user={user} /> : <Login />}
    </div>
    </NotificationProvider>
  );
}

export default App;