import React, { useState, useEffect } from 'react';
import { 
  format, 
  startOfWeek, 
  addDays, 
  addWeeks, 
  subWeeks, 
  isSameDay, 
  parseISO 
} from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  DndContext, 
  DragEndEvent, 
  closestCorners, 
  useSensor, 
  useSensors, 
  MouseSensor, 
  TouchSensor,
  DragOverlay
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Plus, AlertTriangle } from 'lucide-react';

// Importa i tuoi componenti (assicurati che esistano o adattali)
import { supabase } from '../supabase';
import DraggableEmployee from './DraggableEmployee'; // Assumiamo che questo sia il "blocchetto" del turno
import ShiftModal from './ShiftModal'; // Modale per creare/modificare turni

// --- TIPI ---
interface Shift {
  id: string;
  employee_name: string;
  date: string; // Formato YYYY-MM-DD
  start_time: string;
  end_time: string;
  role?: string;
}

const WeeklyScheduler: React.FC = () => {
  // --- STATO ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Gestione Modale
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  // --- 1. CONFIGURAZIONE SENSORI (IL FIX PER TABLET) ---
  const sensors = useSensors(
    // Mouse: Attivazione standard (basta muovere di 10px)
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    // Touch (iPad/Mobile): Attivazione ritardata per non bloccare lo scroll
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // Tieni premuto 250ms per iniziare il drag
        tolerance: 5, // Se muovi il dito durante l'attesa, è uno scroll (annulla drag)
      },
    })
  );

  // --- 2. CARICAMENTO DATI ---
  const fetchShifts = async () => {
    setLoading(true);
    // Calcoliamo l'inizio e la fine della settimana visualizzata per filtrare la query
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = addDays(start, 6);

    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .gte('date', format(start, 'yyyy-MM-dd'))
      .lte('date', format(end, 'yyyy-MM-dd'));

    if (error) {
      console.error('Errore fetch turni:', error);
    } else {
      setShifts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchShifts();
  }, [currentDate]);

  // --- 3. GESTIONE DRAG & DROP ---
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const shiftId = active.id as string;
    const newDate = over.id as string; // L'ID della colonna Droppable è la data (YYYY-MM-DD)

    // Ottimistic Update (Aggiorna UI subito)
    const oldShifts = [...shifts];
    setShifts((prev) => 
      prev.map((s) => s.id === shiftId ? { ...s, date: newDate } : s)
    );

    // Aggiorna Database
    const { error } = await supabase
      .from('shifts')
      .update({ date: newDate })
      .eq('id', shiftId);

    if (error) {
      console.error('Errore aggiornamento turno:', error);
      alert("Errore nello spostamento del turno!");
      setShifts(oldShifts); // Revert in caso di errore
    }
  };

  // --- UTILS ---
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const day = addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i);
    return {
      date: day,
      formatted: format(day, 'yyyy-MM-dd'),
      label: format(day, 'EEEE d MMM', { locale: it }),
    };
  });

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

  const openNewShiftModal = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedShift(null);
    setIsModalOpen(true);
  };

  const openEditShiftModal = (shift: Shift) => {
    setSelectedShift(shift);
    setSelectedDate(shift.date);
    setIsModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-4">
      {/* HEADER CONTROLLI */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800">Planning Turni</h2>
        
        <div className="flex items-center gap-4">
          <button onClick={handlePrevWeek} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          <span className="text-lg font-medium min-w-[200px] text-center capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: it })}
          </span>
          <button onClick={handleNextWeek} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronRight className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <button 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all"
          onClick={() => openNewShiftModal(format(new Date(), 'yyyy-MM-dd'))}
        >
          <Plus className="w-5 h-5" />
          Nuovo Turno
        </button>
      </div>

      {/* GRIGLIA SETTIMANALE */}
      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCorners} 
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-7 gap-4 h-full min-h-[600px]">
          {weekDays.map((day) => {
            const dayShifts = shifts.filter((s) => s.date === day.formatted);
            const isToday = isSameDay(day.date, new Date());

            return (
              <div 
                key={day.formatted} 
                id={day.formatted} // Questo ID serve al droppable
                className={`
                  flex flex-col rounded-xl border-2 transition-colors min-h-[500px]
                  ${isToday ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}
                  // Qui usiamo una classe droppable fittizia, dnd-kit usa l'ID per capire dove cade
                `}
                // Nota: In una implementazione pura dnd-kit, qui useresti "useDroppable". 
                // Per semplicità, assumiamo che il drop funzioni sulle coordinate o aggiungiamo useDroppable se necessario.
                // IMPORTANTE: Per far funzionare il drop sulle colonne vuote, serve useDroppable.
                // Lo aggiungo inline in un componente interno per pulizia?
                // Facciamo che la logica droppable è gestita dal componente "DroppableDay" qui sotto.
              >
                <DroppableDay 
                  id={day.formatted} 
                  label={day.label} 
                  isToday={isToday}
                  onAddClick={() => openNewShiftModal(day.formatted)}
                >
                  {dayShifts.map((shift) => (
                    <DraggableEmployee 
                      key={shift.id} 
                      id={shift.id} 
                      shift={shift} 
                      onClick={() => openEditShiftModal(shift)}
                    />
                  ))}
                </DroppableDay>
              </div>
            );
          })}
        </div>
      </DndContext>

      {/* MODALE */}
      {isModalOpen && (
        <ShiftModal 
          isOpen={isModalOpen}
          onClose={() => {
             setIsModalOpen(false);
             fetchShifts(); // Ricarica dopo chiusura
          }}
          initialDate={selectedDate || ''}
          existingShift={selectedShift}
        />
      )}
    </div>
  );
};

// --- COMPONENTE INTERNO PER LA COLONNA DROPPABLE ---
import { useDroppable } from '@dnd-kit/core';

interface DroppableDayProps {
  id: string;
  label: string;
  isToday: boolean;
  children: React.ReactNode;
  onAddClick: () => void;
}

const DroppableDay: React.FC<DroppableDayProps> = ({ id, label, isToday, children, onAddClick }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  return (
    <div 
      ref={setNodeRef}
      className={`flex flex-col h-full w-full ${isOver ? 'bg-blue-100/50' : ''}`}
    >
      {/* Intestazione Giorno */}
      <div className={`p-3 border-b border-gray-100 flex justify-between items-center
        ${isToday ? 'text-blue-700' : 'text-gray-600'}
      `}>
        <span className="font-semibold text-sm capitalize">{label}</span>
        <button 
          onClick={(e) => { e.stopPropagation(); onAddClick(); }}
          className="text-gray-400 hover:text-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Area Turni */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        {children}
      </div>
    </div>
  );
};

export default WeeklyScheduler;