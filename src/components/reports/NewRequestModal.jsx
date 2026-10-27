import React from 'react';
import TaskFormModal from './TaskFormModal';

/**
 * NewRequestModal (Compatibilidade Hubdesk v3.10.1)
 * Re-exporta e encapsula o TaskFormModal com o layout em Grid moderno para O.S. e Tarefas.
 */
export { TaskFormModal };

export default function NewRequestModal(props) {
    return <TaskFormModal {...props} />;
}
