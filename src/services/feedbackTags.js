import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { subscribeSharedDocument } from './dataCache';

export const DEFAULT_FEEDBACK_TAGS = [
    'Processo',
    'Agilidade',
    'Conhecimento',
    'Qualidade',
    'Cooperação',
    'Pontualidade',
    'Comportamento'
];

const SETTINGS_COLLECTION = 'system_settings';
const TAGS_DOC_ID = 'feedback_tags';

/**
 * Inscreve um componente para receber a lista atualizada de tags de feedback
 */
export const subscribeFeedbackTags = (callback) => {
    return subscribeSharedDocument(SETTINGS_COLLECTION, TAGS_DOC_ID, (docData) => {
        if (docData && Array.isArray(docData.tags) && docData.tags.length > 0) {
            callback(docData.tags);
        } else {
            callback(DEFAULT_FEEDBACK_TAGS);
        }
    });
};

/**
 * Salva a lista de tags no Firestore
 */
export const saveFeedbackTags = async (tags) => {
    const cleanTags = Array.from(new Set(tags.map(t => String(t).trim()).filter(Boolean)));
    const docRef = doc(db, SETTINGS_COLLECTION, TAGS_DOC_ID);
    await setDoc(docRef, {
        tags: cleanTags,
        updatedAt: new Date().toISOString()
    }, { merge: true });
    return cleanTags;
};

/**
 * Carrega tags uma única vez
 */
export const getFeedbackTagsOnce = async () => {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, TAGS_DOC_ID);
        const snap = await getDoc(docRef);
        if (snap.exists() && Array.isArray(snap.data()?.tags) && snap.data().tags.length > 0) {
            return snap.data().tags;
        }
    } catch {
        // Fallback em caso de offline
    }
    return DEFAULT_FEEDBACK_TAGS;
};
