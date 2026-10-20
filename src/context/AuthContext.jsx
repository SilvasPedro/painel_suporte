/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null); 
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeDoc = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (unsubscribeDoc) {
                unsubscribeDoc();
                unsubscribeDoc = null;
            }

            if (user) {
                try {
                    // Busca o colaborador no banco pelo email que logou (tentando exato e minúsculo)
                    let colabDoc = null;
                    let colabData = null;

                    const q = query(collection(db, "collaborators"), where("email", "==", user.email));
                    let querySnapshot = await getDocs(q);

                    if (querySnapshot.empty && user.email) {
                        const qLower = query(collection(db, "collaborators"), where("email", "==", user.email.toLowerCase()));
                        querySnapshot = await getDocs(qLower);
                    }

                    if (!querySnapshot.empty) {
                        colabDoc = querySnapshot.docs[0];
                        colabData = colabDoc.data();
                        
                        const applyColabData = (data, docId) => {
                            const roleLower = data.role?.toLowerCase() || '';
                            const hasAdminAccess = roleLower.includes('admin') || roleLower.includes('gestor') || roleLower.includes('supervisor') || roleLower.includes('apoio');
                            
                            setUserRole(hasAdminAccess ? 'admin' : 'colab');

                            // Usuário é inativo se active for explicitamente false ou status for 'Inativo'
                            const isInactive = data.active === false || String(data.status || '').toLowerCase() === 'inativo';

                            setCurrentUser({ 
                                ...user, 
                                firestoreId: docId, 
                                ...data,
                                active: data.active !== false && String(data.status || '').toLowerCase() !== 'inativo',
                                isInactive,
                                role: data.role || (hasAdminAccess ? 'Gestor' : 'Colaborador') 
                            });
                        };

                        applyColabData(colabData, colabDoc.id);

                        // Escuta alterações em tempo real no documento do colaborador (ex: se o admin desativar o usuário enquanto ele estiver logado)
                        unsubscribeDoc = onSnapshot(doc(db, "collaborators", colabDoc.id), (snap) => {
                            if (snap.exists()) {
                                applyColabData(snap.data(), snap.id);
                            }
                        });
                    } else {
                        // Se for uma conta master que criou o firebase mas não tá na tabela de equipe
                        setUserRole('admin');
                        setCurrentUser({ 
                            ...user, 
                            firestoreId: user.uid, 
                            role: 'Gestor', 
                            active: true, 
                            isInactive: false 
                        });
                    }
                } catch (error) {
                    console.error("Erro ao buscar perfil:", error);
                    setUserRole('colab'); // Por segurança, se der erro ele vai pra visão restrita
                    setCurrentUser({ ...user, active: true, isInactive: false });
                }
            } else {
                // Ninguém logado
                setCurrentUser(null);
                setUserRole(null);
            }
            setLoading(false);
        });

        return () => {
            if (unsubscribeDoc) unsubscribeDoc();
            unsubscribeAuth();
        };
    }, []);

    const isInactive = Boolean(currentUser?.isInactive);

    return (
        <AuthContext.Provider value={{ currentUser, userRole, isInactive, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
