import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { X, Check, XCircle, Calendar, Clock, Bell } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

interface Request {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  is_all_day: boolean;
  employees: {
    first_name: string;
    last_name: string;
    departments: { name: string; color: string };
  };
}

interface AdminRequestsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminRequestsPanel({ isOpen, onClose }: AdminRequestsPanelProps) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) fetchRequests();
  }, [isOpen]);

  async function fetchRequests() {
    setLoading(true);
    const { data, error } = await supabase
      .from('leave_requests')
      .select(`
        *,
        employees (
          first_name,
          last_name,
          departments ( name, color )
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setRequests(data as any);
    }
    setLoading(false);
  }

  const handleDecision = async (req: Request, decision: 'approved' | 'rejected') => {
    try {
      // 1. Aggiorna lo stato della richiesta
      const { error: updateError } = await supabase
        .from('leave_requests')
        .update({ status: decision })
        .eq('id', req.id);

      if (updateError) throw updateError;

      // 2. CREA LA NOTIFICA PER IL DIPENDENTE
      const dateStr = format(parseISO(req.start_date), 'd MMM', { locale: it });
      const msg = decision === 'approved' 
        ? `✅ Le tue ferie dal ${dateStr} sono state approvate!`
        : `❌ La richiesta di ferie dal ${dateStr} non è stata accettata.`;
      
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: req.employee_id,
        message: msg,
        type: decision === 'approved' ? 'success' : 'error'
      });

      if (notifError) throw notifError;

      // 3. Rimuovi dalla lista locale (UI Optimistic Update)
      setRequests(prev => prev.filter(r => r.id !== req.id));

    } catch (error) {
      alert('Errore durante l\'operazione');
      console.error(error);
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        ></div>
      )}

      {/* Slide-over Panel */}
      <div className={`
        fixed inset-y-0 right-0 z-50 w-full md:w-[450px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-gray-100
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-600"/> Richieste in Arrivo
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Hai <span className="font-bold text-indigo-600">{requests.length}</span> decisioni da prendere
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Lista */}
        <div className="p-6 overflow-y-auto h-[calc(100vh-100px)] space-y-4 bg-white">
          {loading ? (
             <p className="text-center text-gray-400 py-10">Caricamento...</p>
          ) : requests.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center opacity-60">
              <div className="bg-green-100 p-4 rounded-full mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-gray-800 font-bold">Tutto pulito!</p>
              <p className="text-sm">Nessuna richiesta in attesa.</p>
            </div>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                
                {/* Badge Motivo */}
                <span className="absolute top-0 right-0 bg-indigo-50 text-indigo-700 text-[10px] px-3 py-1 rounded-bl-xl font-bold uppercase tracking-wider border-b border-l border-indigo-100">
                  {req.reason}
                </span>

                <div className="flex items-center gap-3 mb-4 mt-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-gray-700 text-sm border-2 border-white shadow-sm ${req.employees.departments?.color || 'bg-gray-100'}`}>
                    {req.employees.first_name.charAt(0)}{req.employees.last_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg leading-tight">{req.employees.first_name} {req.employees.last_name}</h3>
                    <p className="text-xs text-gray-500 font-medium">{req.employees.departments?.name}</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg mb-4 border border-slate-100">
                   {req.is_all_day ? (
                     <div className="flex items-center justify-between text-gray-700 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-indigo-500" />
                          <span className="font-semibold">{format(parseISO(req.start_date), 'd MMM', {locale:it})}</span> 
                        </div>
                        <span className="text-gray-400">➜</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{format(parseISO(req.end_date), 'd MMM', {locale:it})}</span>
                        </div>
                     </div>
                   ) : (
                     <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-800 font-medium">
                          <Calendar className="w-4 h-4 text-indigo-500" />
                          {format(parseISO(req.start_date), 'EEEE d MMMM', {locale:it})}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 bg-white p-2 rounded border border-slate-200">
                           <Clock className="w-3 h-3 text-gray-400" />
                           {format(parseISO(req.start_date), 'HH:mm')} - {format(parseISO(req.end_date), 'HH:mm')}
                        </div>
                     </div>
                   )}
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => handleDecision(req, 'rejected')}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 font-bold transition-colors text-sm"
                  >
                    <XCircle className="w-4 h-4" /> Rifiuta
                  </button>
                  <button 
                    onClick={() => handleDecision(req, 'approved')}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-bold shadow-md shadow-indigo-200 transition-all active:scale-95 text-sm"
                  >
                    <Check className="w-4 h-4" /> Approva
                  </button>
                </div>

              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}