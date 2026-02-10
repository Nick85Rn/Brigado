import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Definiamo il tipo Shift (o importalo dai tipi condivisi)
interface Shift {
  id: string;
  employee_name: string;
  date: string;
  start_time: string;
  end_time: string;
  role?: string;
}

interface DraggableEmployeeProps {
  id: string;       // <--- Aggiungiamo questa proprietà richiesta
  shift: Shift;
  onClick: () => void;
}

const DraggableEmployee: React.FC<DraggableEmployeeProps> = ({ id, shift, onClick }) => {
  // Hook di dnd-kit per rendere l'elemento trascinabile
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: id,
    data: shift, // Passiamo i dati del turno per recuperarli al drop
  });

  const style = {
    // apply transform serve a muovere l'elemento mentre trascini
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 100 : 'auto', // Z-index alto mentre trascini
    opacity: isDragging ? 0.8 : 1,
  };

  // Colori dinamici in base al ruolo
  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'Cuoco': return 'bg-orange-100 border-orange-200 text-orange-800';
      case 'Barista': return 'bg-purple-100 border-purple-200 text-purple-800';
      case 'Manager': return 'bg-red-100 border-red-200 text-red-800';
      case 'Lavapiatti': return 'bg-gray-100 border-gray-200 text-gray-800';
      default: return 'bg-blue-100 border-blue-200 text-blue-800'; // Cameriere
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        // Evita che il click parta se stai trascinando (opzionale, ma buona UX)
        if (!isDragging) onClick();
      }}
      className={`
        relative p-2 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing select-none transition-shadow
        hover:shadow-md
        ${getRoleColor(shift.role)}
        ${isDragging ? 'shadow-xl ring-2 ring-blue-500 ring-offset-2' : ''}
      `}
    >
      <div className="font-semibold text-sm truncate pr-4">
        {shift.employee_name}
      </div>
      <div className="text-xs opacity-90 flex justify-between items-center mt-1">
        <span>{shift.start_time} - {shift.end_time}</span>
      </div>
      
      {/* Indicatore Ruolo (Opzionale) */}
      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-current opacity-50" />
    </div>
  );
};

export default DraggableEmployee;