import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Clock, User, Briefcase } from 'lucide-react';
import { supabase } from '../supabase';

// Definiamo il tipo Shift anche qui (o importalo da un file types.ts condiviso)
interface Shift {
  id: string;
  employee_name: string;
  date: string;
  start_time: string;
  end_time: string;
  role?: string;
}

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate: string; // <--- Ecco la proprietà che mancava!
  existingShift: Shift | null;
}

const ShiftModal: React.FC<ShiftModalProps> = ({ 
  isOpen, 
  onClose, 
  initialDate, 
  existingShift 
}) => {
  const [employeeName, setEmployeeName] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [role, setRole] = useState('Cameriere');
  const [loading, setLoading] = useState(false);

  // Quando il modale si apre o cambiano le props, aggiorniamo i campi
  useEffect(() => {
    if (existingShift) {
      // MODALITÀ MODIFICA: Carica i dati del turno esistente
      setEmployeeName(existingShift.employee_name);
      setDate(existingShift.date);
      setStartTime(existingShift.start_time);
      setEndTime(existingShift.end_time);
      setRole(existingShift.role || 'Cameriere');
    } else {
      // MODALITÀ CREAZIONE: Usa la data cliccata e resetta il resto
      setEmployeeName('');
      setDate(initialDate); // Usa la data passata dal Scheduler
      setStartTime('09:00');
      setEndTime('17:00');
      setRole('Cameriere');
    }
  }, [existingShift, initialDate, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const shiftData = {
      employee_name: employeeName,
      date,
      start_time: startTime,
      end_time: endTime,
      role
    };

    let error;

    if (existingShift) {
      // UPDATE
      const { error: updateError } = await supabase
        .from('shifts')
        .update(shiftData)
        .eq('id', existingShift.id);
      error = updateError;
    } else {
      // INSERT
      const { error: insertError } = await supabase
        .from('shifts')
        .insert([shiftData]);
      error = insertError;
    }

    setLoading(false);

    if (error) {
      console.error('Errore salvataggio:', error);
      alert('Errore nel salvataggio del turno');
    } else {
      onClose(); // Chiudi e ricarica (gestito dal padre)
    }
  };

  const handleDelete = async () => {
    if (!existingShift) return;
    if (!window.confirm('Sei sicuro di voler eliminare questo turno?')) return;

    setLoading(true);
    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('id', existingShift.id);
    
    setLoading(false);

    if (error) {
      console.error('Errore eliminazione:', error);
      alert('Impossibile eliminare il turno');
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* HEADER */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">
            {existingShift ? 'Modifica Turno' : 'Nuovo Turno'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          
          {/* Dipendente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dipendente</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                required
                placeholder="Nome dipendente..."
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                className="pl-10 w-full rounded-lg border border-gray-300 p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Ruolo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="pl-10 w-full rounded-lg border border-gray-300 p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="Cameriere">Cameriere</option>
                <option value="Cuoco">Cuoco</option>
                <option value="Barista">Barista</option>
                <option value="Manager">Manager</option>
                <option value="Lavapiatti">Lavapiatti</option>
              </select>
            </div>
          </div>

          {/* Data (Readonly o modificabile, a tua scelta) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Orari */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inizio</label>
              <div className="relative">
                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="pl-9 w-full rounded-lg border border-gray-300 p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fine</label>
              <div className="relative">
                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="pl-9 w-full rounded-lg border border-gray-300 p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100">
            {existingShift ? (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center text-red-600 hover:text-red-700 font-medium px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
                disabled={loading}
              >
                <Trash2 className="w-5 h-5 mr-2" />
                Elimina
              </button>
            ) : (
              <div></div> /* Spacer vuoto */
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-all disabled:opacity-50"
              >
                <Save className="w-5 h-5 mr-2" />
                {loading ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShiftModal;