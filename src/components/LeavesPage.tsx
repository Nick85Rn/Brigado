import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { format, differenceInDays, parseISO, isPast, isFuture } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  CalendarCheck, CheckCircle2, XCircle, Clock, CalendarDays, 
  Palmtree, Filter, Search, ArrowRight, User
} from 'lucide-react';

// Interfacce
interface LeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  is_all_day: boolean;
  created_at: string;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    departments: { name: string; color: string };
  };
}

export default function LeavesPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'history'>('pending');

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    setLoading(true);
    // Join con tabella employees e departments
    const { data, error } = await supabase
      .from('leave_requests')
      .select(`
        *,
        employee:employees (
          id, first_name, last_name, avatar_url,
          departments ( name, color )
        )
      `)
      .order('start_date', { ascending: true }); // Ordina per data richiesta

    if (!error && data) {
      setRequests(data as any);
    }
    setLoading(false);
  }

  const handleStatusUpdate = async (id: string, newStatus: 'approved' | 'rejected') => {
    // 1. Aggiorna DB
    await supabase.from('leave_requests').update({ status: newStatus }).eq('id', id);
    
    // 2. Aggiorna UI locale (Optimistic update)
    setRequests(prev => prev.map(req => req.id === id ? { ...req, status: newStatus } : req));
    
    // 3. (Opzionale) Invia notifica al dipendente qui
  };

  // --- LOGICA FILTRI ---
  const filteredRequests = requests.filter(req => {
    if (filter === 'pending') return req.status === 'pending';
    if (filter === 'approved') return req.status === 'approved' && isFuture(parseISO(req.end_date));
    if (filter === 'history') return req.status === 'rejected' || (req.status === 'approved' && isPast(parseISO(req.end_date)));
    return true;
  });

  const getDuration = (start: string, end: string) => {
    const days = differenceInDays(parseISO(end), parseISO(start)) + 1;
    return days === 1 ? '1 giorno' : `${days} giorni`;
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 p-6 pb-24">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Palmtree className="w-6 h-6 text-indigo-600"/> Gestione Ferie & Permessi
          </h1>
          <p className="text-slate-500 text-sm mt-1">Approva le richieste e monitora le assenze del team.</p>
        </div>
      </div>

      {/* TABS DI FILTRAGGIO */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-1 overflow-x-auto">
        <button 
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 text-sm font-bold rounded-t-lg flex items-center gap-2 transition-colors ${filter === 'pending' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Clock className="w-4 h-4" /> Da Approvare
          {requests.filter(r => r.status === 'pending').length > 0 && (
            <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full text-[10px]">
              {requests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setFilter('approved')}
          className={`px-4 py-2 text-sm font-bold rounded-t-lg flex items-center gap-2 transition-colors ${filter === 'approved' ? 'bg-white text-emerald-600 border-b-2 border-emerald-600 shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <CalendarCheck className="w-4 h-4" /> Approvate (Future)
        </button>
        <button 
          onClick={() => setFilter('history')}
          className={`px-4 py-2 text-sm font-bold rounded-t-lg flex items-center gap-2 transition-colors ${filter === 'history' ? 'bg-white text-slate-600 border-b-2 border-slate-600 shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <CalendarDays className="w-4 h-4" /> Storico / Rifiutate
        </button>
      </div>

      {/* LISTA RICHIESTE */}
      <div className="space-y-4">
        {loading ? (
          <p className="text-center text-slate-400 py-10">Caricamento richieste...</p>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
            <Palmtree className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Nessuna richiesta in questa sezione.</p>
          </div>
        ) : (
          filteredRequests.map((req) => (
            <div key={req.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group hover:border-indigo-200 transition-all">
              
              {/* Info Dipendente & Date */}
              <div className="flex items-start gap-4 flex-1">
                {/* Data Box */}
                <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded-lg p-2 min-w-[70px] text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{format(parseISO(req.start_date), 'MMM', {locale:it})}</span>
                  <span className="text-2xl font-bold text-slate-800 leading-none">{format(parseISO(req.start_date), 'dd')}</span>
                  <span className="text-[10px] text-slate-400 uppercase">{format(parseISO(req.start_date), 'EEE', {locale:it})}</span>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-800 text-lg">{req.employee.first_name} {req.employee.last_name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide border border-white/50 ${req.employee.departments?.color || 'bg-slate-200'}`}>
                      {req.employee.departments?.name}
                    </span>
                  </div>
                  
                  <div className="text-sm text-slate-600 flex items-center gap-2">
                    <span className="font-medium bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                      {req.is_all_day ? getDuration(req.start_date, req.end_date) : 'Ore Permesso'}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="italic">{req.reason}</span>
                  </div>

                  {/* Range date completo se più giorni */}
                  {differenceInDays(parseISO(req.end_date), parseISO(req.start_date)) > 0 && (
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      Fino al <span className="font-bold">{format(parseISO(req.end_date), 'dd MMMM', {locale:it})}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Azioni (Solo se Pending) */}
              {req.status === 'pending' && (
                <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
                  <button 
                    onClick={() => handleStatusUpdate(req.id, 'rejected')}
                    className="flex-1 md:flex-none px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Rifiuta
                  </button>
                  <button 
                    onClick={() => handleStatusUpdate(req.id, 'approved')}
                    className="flex-1 md:flex-none px-6 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approva
                  </button>
                </div>
              )}

              {/* Status Badge (Se non pending) */}
              {req.status !== 'pending' && (
                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1 ${req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {req.status === 'approved' ? <CheckCircle2 className="w-3 h-3"/> : <XCircle className="w-3 h-3"/>}
                  {req.status === 'approved' ? 'Approvata' : 'Rifiutata'}
                </div>
              )}

            </div>
          ))
        )}
      </div>
    </div>
  );
}