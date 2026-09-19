/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null); 
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // Busca o colaborador no banco pelo email que logou
                    const q = query(collection(db, "collaborators"), where("email", "==", user.email));
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        const colabDoc = querySnapshot.docs[0];
                        const colabData = colabDoc.data();
                        
                        // Define quem tem acesso administrativo/operacional baseado no cargo
                        const roleLower = colabData.role?.toLowerCase() || '';
                        const hasAdminAccess = roleLower.includes('admin') || roleLower.includes('gestor') || roleLower.includes('supervisor') || roleLower.includes('apoio');
                        if (hasAdminAccess) {
                            setUserRole('admin');
                        } else {
                            setUserRole('colab');
                        }
                        
                        // Salva os dados logados mantendo o cargo real (Gestor, Supervisor, Apoio, Colaborador)
                        setCurrentUser({ 
                            ...user, 
                            firestoreId: colabDoc.id, 
                            ...colabData, 
                            role: colabData.role || (hasAdminAccess ? 'Gestor' : 'Colaborador') 
                        });
                    } else {
                        // Se for uma conta master que criou o firebase mas não tá na tabela de equipe
                        setUserRole('admin');
                        setCurrentUser({ ...user, firestoreId: user.uid, role: 'Gestor' });
                    }
                } catch (error) {
                    console.error("Erro ao buscar perfil:", error);
                    setUserRole('colab'); // Por segurança, se der erro ele vai pra visão restrita
                    setCurrentUser(user);
                }
            } else {
                // Ninguém logado
                setCurrentUser(null);
                setUserRole(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    return (
        <AuthContext.Provider value={{ currentUser, userRole, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);