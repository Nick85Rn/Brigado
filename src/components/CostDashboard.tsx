import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { startOfMonth, endOfMonth, format, eachWeekOfInterval, startOfWeek, endOfWeek, parseISO, differenceInMinutes, isSameWeek, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { BarChart3, TrendingUp, Wallet, PieChart, Users, ArrowUpRight, ArrowDownRight, DollarSign, Clock, ArrowLeft, AlertCircle } from 'lucide-react';

interface Shift {
  id: string;
  start_time: string;
  end_time: string;
  employees: {
    id: string;
    first_name: string;
    last_name: string;
    hourly_rate: number;
    departments: { name: string; color: string };
  };
}

interface TimeEntry {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
}

export default function CostDashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState(0); 

  useEffect(() => { fetchData(); }, [currentDate]);

  async function fetchData() {
    setLoading(true);
    const start = startOfMonth(currentDate).toISOString();
    const end = endOfMonth(currentDate).toISOString();

    // 1. Scarica Turni Pianificati
    const { data: shiftsData } = await supabase
      .from('shifts')
      .select(`id, start_time, end_time, employees ( id, first_name, last_name, hourly_rate, departments ( name, color ) )`)
      .gte('start_time', start).lte('end_time', end).eq('is_published', true);

    // 2. Scarica Timbrature Reali (Actual)
    const { data: entriesData } = await supabase
      .from('time_entries')
      .select('*')
      .gte('clock_in', start).lte('clock_in', end)
      .not('clock_out', 'is', null); // Prendi solo turni chiusi

    setShifts(shiftsData as any || []);
    setEntries(entriesData as any || []);
    setLoading(false);
  }

  // --- CALCOLI AVANZATI ---
  
  // Helper: Calcola ore reali nette (meno pause)
  const getActualHours = (entry: TimeEntry) => {
    if (!entry.clock_out) return 0;
    let total = differenceInMinutes(parseISO(entry.clock_out), parseISO(entry.clock_in));
    if (entry.break_start && entry.break_end) {
      total -= differenceInMinutes(parseISO(entry.break_end), parseISO(entry.break_start));
    }
    return total / 60;
  };

  // 1. Totali Generali
  const plannedCost = shifts.reduce((acc, s) => acc + ((differenceInMinutes(parseISO(s.end_time), parseISO(s.start_time))/60) * (s.employees?.hourly_rate || 0)), 0);
  
  // Per il costo reale, dobbiamo mappare le timbrature al costo orario del dipendente
  // Creiamo una mappa rapida ID Dipendente -> Costo Orario
  const empRates = shifts.reduce((acc: any, s) => {
    acc[s.employees.id] = s.employees.hourly_rate || 0;
    return acc;
  }, {});

  const actualCost = entries.reduce((acc, e) => acc + (getActualHours(e) * (empRates[e.employee_id] || 0)), 0);
  const variance = actualCost - plannedCost;

  // 2. Statistiche per Dipendente (Budget vs Actual)
  const empStats = shifts.reduce((acc: any, s) => {
    const id = s.employees.id;
    const plannedH = differenceInMinutes(parseISO(s.end_time), parseISO(s.start_time)) / 60;
    
    if (!acc[id]) acc[id] = { 
      name: `${s.employees.first_name} ${s.employees.last_name}`, 
      dept: s.employees.departments.name,
      color: s.employees.departments.color,
      rate: s.employees.hourly_rate,
      plannedHours: 0, 
      actualHours: 0 
    };
    acc[id].plannedHours += plannedH;
    return acc;
  }, {});

  // Aggiungi ore reali ai dipendenti
  entries.forEach(e => {
    if (empStats[e.employee_id]) {
      empStats[e.employee_id].actualHours += getActualHours(e);
    }
  });
  
  const empArray = Object.values(empStats).sort((a:any, b:any) => b.actualHours - a.actualHours);
  const laborCostPercent = revenue > 0 ? ((actualCost / revenue) * 100).toFixed(1) : 0;

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 p-6 pb-24">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="p-2 bg-white border border-slate-200 rounded-full hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-colors shadow-sm"><ArrowLeft className="w-5 h-5" /></Link>
          <div><h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><BarChart3 className="w-6 h-6 text-indigo-600"/> Analisi Costi & Scostamenti</h1><p className="text-slate-500 text-sm mt-1">Confronto Budget (Pianificato) vs Reale (Timbrato)</p></div>
        </div>
        <div className="bg-white p-1 rounded-lg border border-slate-200 flex items-center shadow-sm"><input type="month" value={format(currentDate, 'yyyy-MM')} onChange={(e) => setCurrentDate(parseISO(e.target.value))} className="text-sm font-bold text-slate-700 bg-transparent outline-none px-3 py-1 cursor-pointer"/></div>
      </div>

      {/* KPI CARDS - CONFRONTO BUDGET VS ACTUAL */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs font-bold text-slate-400 uppercase">Budget Pianificato</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">€ {plannedCost.toFixed(0)}</h3>
          </div>
          <div className="absolute right-0 bottom-0 p-4 opacity-10"><Wallet className="w-16 h-16 text-slate-400"/></div>
        </div>

        <div className={`p-5 rounded-xl shadow-sm border relative overflow-hidden ${variance > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
          <div className="relative z-10">
            <p className={`text-xs font-bold uppercase ${variance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>Costo Reale (Actual)</p>
            <h3 className={`text-2xl font-bold mt-1 ${variance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>€ {actualCost.toFixed(0)}</h3>
            <p className="text-[10px] font-bold mt-1 flex items-center gap-1">
              {variance > 0 ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownRight className="w-3 h-3"/>} 
              {variance > 0 ? `+€${variance.toFixed(0)} Fuori Budget` : `-€${Math.abs(variance).toFixed(0)} Risparmio`}
            </p>
          </div>
        </div>

        {/* INPUT FATTURATO */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 col-span-2 flex items-center justify-between gap-4">
          <div><p className="text-xs font-bold text-slate-400 uppercase mb-1">Fatturato Reale</p><div className="flex items-center gap-2"><span className="text-slate-400 font-bold">€</span><input type="number" placeholder="0" value={revenue || ''} onChange={e => setRevenue(Number(e.target.value))} className="font-bold text-xl text-slate-800 w-32 outline-none border-b border-dashed border-slate-300 focus:border-indigo-500 bg-transparent"/></div></div>
          <div className="text-right"><p className="text-xs font-bold text-slate-400 uppercase">Incidenza (Labor Cost)</p><div className={`text-2xl font-bold mt-1 flex items-center justify-end gap-1 ${Number(laborCostPercent) > 35 ? 'text-red-500' : 'text-emerald-500'}`}>{laborCostPercent}%</div><p className="text-[10px] text-slate-400">Target ideale: 30-35%</p></div>
        </div>
      </div>

      {/* TABELLA DETTAGLIO: IL CUORE DEL CONTROLLO */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-600"/> Dettaglio Ore & Scostamenti</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
              <tr>
                <th className="p-3 rounded-l-lg">Nome</th>
                <th className="p-3">Reparto</th>
                <th className="p-3 text-right text-slate-400">Ore Previste</th>
                <th className="p-3 text-right">Ore Reali</th>
                <th className="p-3 text-right">Scostamento</th>
                <th className="p-3 text-right rounded-r-lg">Costo Reale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(empArray as any[]).map((e) => {
                const diff = e.actualHours - e.plannedHours;
                const isOver = diff > 0.5; // Tolleranza mezz'ora
                return (
                  <tr key={e.name} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-700">{e.name}</td>
                    <td className="p-3"><span className={`px-2 py-1 rounded text-[10px] font-bold border border-slate-200 uppercase tracking-wide ${e.color}`}>{e.dept}</span></td>
                    <td className="p-3 text-right font-mono text-slate-400">{e.plannedHours.toFixed(1)} h</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-800">{e.actualHours.toFixed(1)} h</td>
                    <td className="p-3 text-right">
                      {isOver ? (
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">+{diff.toFixed(1)} h</span>
                      ) : (
                        <span className="text-emerald-500 text-xs font-bold">OK</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-800">€ {(e.actualHours * e.rate).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}