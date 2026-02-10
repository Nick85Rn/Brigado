import { useState } from 'react';
import { X, Send, Clock, CalendarDays } from 'lucide-react';
import { supabase } from '../supabase';

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  onSuccess: () => void;
}

export default function LeaveRequestModal({ isOpen, onClose, employeeId, onSuccess }: LeaveRequestModalProps) {
  const [isAllDay, setIsAllDay] = useState(true); // Toggle stato
  
  // Stati per i campi
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [reason, setReason] = useState('Ferie');
  
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let finalStart, finalEnd;

      if (isAllDay) {
        // Se è tutto il giorno, forziamo gli orari 00:00 -> 23:59
        // Nota: Aggiungiamo la data ISO completa
        finalStart = new Date(startDate).toISOString();
        // Per la fine, impostiamo alla fine della giornata
        const endD = new Date(endDate || startDate); // Se endDate manca, usa startDate (1 giorno solo)
        endD.setHours(23, 59, 59);
        finalEnd = endD.toISOString();
      } else {
        // Se è a ore, combiniamo Data + Ora
        // Assumiamo che il permesso sia nello stesso giorno per semplicità UX Mobile
        // (Se serve su più giorni a ore diverse, meglio fare due richieste separate)
        finalStart = new Date(`${startDate}T${startTime}`).toISOString();
        finalEnd = new Date(`${startDate}T${endTime}`).toISOString();
      }

      const { error } = await supabase.from('leave_requests').insert({
        employee_id: employeeId,
        start_date: finalStart,
        end_date: finalEnd,
        reason: reason,
        status: 'pending',
        is_all_day: isAllDay
      });

      if (error) throw error;

      onSuccess();
      onClose();
      // Reset
      setStartDate('');
      setEndDate('');
      setIsAllDay(true);
    } catch (error) {
      alert('Errore invio richiesta: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
        
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800">Nuova Richiesta</h3>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* TOGGLE TABS */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          <button 
            type="button"
            onClick={() => setIsAllDay(true)}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${isAllDay ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
          >
            <CalendarDays className="w-4 h-4" /> Giornata Intera
          </button>
          <button 
            type="button"
            onClick={() => setIsAllDay(false)}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${!isAllDay ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
          >
            <Clock className="w-4 h-4" /> A Ore
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {isAllDay ? (
            /* --- FORM GIORNATA INTERA --- */
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Dal Giorno</label>
                <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Al Giorno</label>
                <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
          ) : (
             /* --- FORM A ORE --- */
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Giorno</label>
                <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <label className="text-xs font-bold text-slate-500 uppercase">Dalle ore</label>
                   <input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                   <label className="text-xs font-bold text-slate-500 uppercase">Alle ore</label>
                   <input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1 mt-4">
            <label className="text-xs font-bold text-slate-500 uppercase">Motivo</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none">
              <option value="Ferie">🏖️ Ferie</option>
              <option value="Permesso">⏱️ Permesso (Visita/Impegni)</option>
              <option value="Malattia">🚑 Malattia</option>
              <option value="Altro">📝 Altro</option>
            </select>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 mt-4">
            {loading ? 'Invio...' : <><Send className="w-5 h-5" /> Invia Richiesta</>}
          </button>
        </form>

      </div>
    </div>
  );
}