import { useState, useEffect } from 'react';
import { 
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  eachDayOfInterval, format, addWeeks, subWeeks, addMonths, subMonths, 
  isSameDay, setHours, setMinutes, parseISO, isSameMonth, startOfDay, endOfDay, differenceInYears, isWithinInterval, differenceInMinutes 
} from 'date-fns';
import { it } from 'date-fns/locale';
import { supabase } from '../supabase';
import { 
  ChevronLeft, ChevronRight, 
  Users, LayoutGrid, List, Clock, Download,
  AlertTriangle, Palmtree, UserMinus, Send, Euro, BarChart3, Layers, Printer, Megaphone, Trash2, X, CalendarClock, Eye 
} from 'lucide-react';
import ShiftModal from './ShiftModal';
import Toast from './Toast';

// --- FIX IMPORT DND KIT ---
import { DndContext, useDroppable, DragOverlay, useSensors, useSensor, PointerSensor } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'; 

import DraggableEmployee from './DraggableEmployee';

// --- INTERFACCE ---
interface Employee { id: string; first_name: string; last_name: string; avatar_url?: string; birth_date?: string; hourly_rate?: number; departments: { name: string; color: string }; }
interface Shift { id: string; employee_id: string; start_time: string; end_time: string; notes?: string; is_published: boolean; employees?: Employee; }
interface LeaveRequest { id: string; employee_id: string; start_date: string; end_date: string; reason: string; is_all_day: boolean; }
interface SelectedSlot { employeeId: string; employeeName: string; date: Date; shiftId?: string; initialData?: { startTime: string; endTime: string; notes: string; }; }
interface Announcement { id: string; content: string; created_at: string; visible_from: string; visible_until: string; read_count?: number; total_employees?: number; } // AGGIUNTO READ_COUNT

// --- UTILS ---
const calculateStats = (shifts: Shift[]) => { 
  let totalHours = 0; 
  let totalCost = 0; 
  shifts.forEach(s => { 
    const hours = differenceInMinutes(parseISO(s.end_time), parseISO(s.start_time)) / 60; 
    const rate = s.employees?.hourly_rate || 0; 
    totalHours += hours; 
    totalCost += hours * rate; 
  }); 
  return { totalHours, totalCost }; 
};

const CalendarCell = ({ id, date, children, isMonthView, isToday }: any) => { 
  const { setNodeRef, isOver } = useDroppable({ id }); 
  return ( 
    <div ref={setNodeRef} className={`relative border-r border-b transition-all group flex flex-col ${isMonthView ? 'min-h-[100px]' : 'min-h-[150px]'} ${isOver ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-500 z-10' : 'bg-white hover:bg-slate-50'}`}> 
      <div className={`p-1.5 flex justify-between items-center text-xs border-b border-dashed border-slate-100 ${isToday ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700'}`}> 
        <span className="text-sm font-semibold">{format(date, 'd')}</span> 
        <span className="text-[10px] uppercase text-slate-400 font-bold">{format(date, 'EEE', { locale: it })}</span> 
      </div> 
      <div className="flex-1 p-1 space-y-1 overflow-y-auto max-h-[300px] scrollbar-hide">{children}</div> 
      {(!children || children.length === 0) && !isOver && <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none"><span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">+</span></div>} 
    </div> 
  ); 
};

export default function WeeklyScheduler() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  
  // Data State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnnounceOpen, setIsAnnounceOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const startDate = viewMode === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : startOfMonth(currentDate); 
  const gridStartDate = startOfWeek(startDate, { weekStartsOn: 1 });
  const endDate = viewMode === 'week' ? endOfWeek(currentDate, { weekStartsOn: 1 }) : endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: gridStartDate, end: endDate });

  const { totalHours, totalCost } = calculateStats(shifts);
  const unpublishedCount = shifts.filter(s => !s.is_published).length;

  useEffect(() => { fetchData(); fetchAnnouncements(); }, [currentDate, viewMode]);

  async function fetchData() {
    try {
      setLoading(true);
      const { data: empData } = await supabase.from('employees').select(`*, departments ( name, color )`).order('first_name');
      setEmployees(empData as any || []);
      const { data: shiftData } = await supabase.from('shifts').select(`*, employees:employee_id ( *, departments(color, name) )`).gte('start_time', gridStartDate.toISOString()).lte('end_time', endDate.toISOString());
      setShifts(shiftData as any || []);
      const { data: leaveData } = await supabase.from('leave_requests').select('*').eq('status', 'approved').or(`start_date.lte.${endDate.toISOString()},end_date.gte.${gridStartDate.toISOString()}`);
      setLeaves(leaveData || []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  // --- ANNOUNCEMENTS LOGIC ---
  async function fetchAnnouncements() { 
    // 1. Fetch Annunci
    const { data: anns } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }); 
    
    // 2. Fetch Conta Letture (Aggregation manuale per semplicità)
    const { data: reads } = await supabase.from('announcement_reads').select('announcement_id');
    const { count: empCount } = await supabase.from('employees').select('*', { count: 'exact', head: true });

    const enrichedAnns = (anns || []).map(a => {
        const readCount = reads?.filter(r => r.announcement_id === a.id).length || 0;
        return { ...a, read_count: readCount, total_employees: empCount || 0 };
    });

    setAnnouncements(enrichedAnns); 
  }
  
  const handlePostAnnouncement = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    const form = e.target as HTMLFormElement; 
    const formData = new FormData(form);
    
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await supabase.from('announcements').insert({ 
      content: formData.get('content'),
      visible_from: formData.get('visible_from') || now.toISOString(),
      visible_until: formData.get('visible_until') || nextWeek.toISOString()
    }); 
    
    form.reset(); 
    fetchAnnouncements(); 
    setToast({msg: 'Avviso programmato', type: 'success'}); 
  };
  
  const handleDeleteAnnouncement = async (id: string) => { 
    await supabase.from('announcements').delete().eq('id', id); 
    fetchAnnouncements(); 
  };

  // --- ACTIONS & DND (uguale a prima) ---
  const handlePrint = () => { window.print(); };
  const handlePublishAll = async () => { if(!confirm(`Pubblicare ${unpublishedCount} turni in bozza?`)) return; const idsToPublish = shifts.filter(s => !s.is_published).map(s => s.id); if(idsToPublish.length === 0) return; await supabase.from('shifts').update({ is_published: true }).in('id', idsToPublish); fetchData(); setToast({ msg: 'Turni pubblicati!', type: 'success' }); };
  const handleExport = () => { if (shifts.length === 0) return alert("Nessun turno."); const headers = ["Dipendente", "Data", "Inizio", "Fine", "Ore", "Costo", "Note"]; const rows = shifts.map(s => { const date = format(parseISO(s.start_time), 'yyyy-MM-dd'); const start = format(parseISO(s.start_time), 'HH:mm'); const end = format(parseISO(s.end_time), 'HH:mm'); const hours = (differenceInMinutes(parseISO(s.end_time), parseISO(s.start_time)) / 60).toFixed(2); const cost = ((parseFloat(hours) * (s.employees?.hourly_rate || 0))).toFixed(2); return [`${s.employees?.first_name} ${s.employees?.last_name}`, date, start, end, hours.replace('.', ','), cost.replace('.', ','), s.notes || ''].join(';'); }); const csvContent = "data:text/csv;charset=utf-8," + headers.join(';') + "\n" + rows.join('\n'); const encodedUri = encodeURI(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", `planning_${format(currentDate, 'yyyy_MM')}.csv`); document.body.appendChild(link); link.click(); };
  const handleDragStart = (event: DragStartEvent) => { setActiveDragId(String(event.active.id)); };
  const handleDragEnd = (event: DragEndEvent) => { setActiveDragId(null); const { active, over } = event; if (over && active) { const empId = String(active.id).replace('emp-', ''); const dateStr = String(over.id).replace('cell::', ''); const targetDate = new Date(dateStr); const employee = employees.find(e => e.id === empId); handleSlotClick(empId, employee?.first_name || '', targetDate); } };
  const handleSlotClick = (empId: string, empName: string, date: Date) => { if(!empId) return; setSelectedSlot({ employeeId: empId, employeeName: empName, date: date, initialData: undefined }); setIsModalOpen(true); };
  const handleEditShiftClick = (e: React.MouseEvent, shift: Shift) => { e.stopPropagation(); if (!shift.employees) return; setSelectedSlot({ employeeId: shift.employee_id, employeeName: shift.employees.first_name, date: parseISO(shift.start_time), shiftId: shift.id, initialData: { startTime: format(parseISO(shift.start_time), 'HH:mm'), endTime: format(parseISO(shift.end_time), 'HH:mm'), notes: shift.notes || '' } }); setIsModalOpen(true); };
  const handleSaveShift = async (startTimeStr: string, endTimeStr: string, notes: string) => { if (!selectedSlot) return; const [startH, startM] = startTimeStr.split(':').map(Number); const [endH, endM] = endTimeStr.split(':').map(Number); const startDateTime = setMinutes(setHours(selectedSlot.date, startH), startM); const endDateTime = setMinutes(setHours(selectedSlot.date, endH), endM); const payload = { employee_id: selectedSlot.employeeId, start_time: startDateTime.toISOString(), end_time: endDateTime.toISOString(), notes: notes, is_published: false }; if (selectedSlot.shiftId) { await supabase.from('shifts').update(payload).eq('id', selectedSlot.shiftId); } else { await supabase.from('shifts').insert(payload); } setIsModalOpen(false); fetchData(); setToast({msg: 'Salvato (Bozza)', type: 'success'}); };
  const handleDeleteShift = async () => { if (!selectedSlot?.shiftId) return; await supabase.from('shifts').delete().eq('id', selectedSlot.shiftId); setIsModalOpen(false); fetchData(); setToast({msg: 'Eliminato', type: 'success'}); };
  const goNext = () => setCurrentDate(viewMode === 'week' ? addWeeks(currentDate, 1) : addMonths(currentDate, 1));
  const goPrev = () => setCurrentDate(viewMode === 'week' ? subWeeks(currentDate, 1) : subMonths(currentDate, 1));
  const getShiftsForDay = (day: Date) => shifts.filter(s => isSameDay(parseISO(s.start_time), day));
  const getShiftWarnings = (shift: Shift, employee: Employee | undefined, dayShifts: Shift[]) => { if (!employee) return []; const warnings = []; const shiftStart = parseISO(shift.start_time); const hasLeave = leaves.find(l => l.employee_id === employee.id && isWithinInterval(shiftStart, { start: startOfDay(parseISO(l.start_date)), end: endOfDay(parseISO(l.end_date)) })); if (hasLeave) warnings.push({ label: 'IN FERIE', color: 'bg-red-100 text-red-700 border-red-200', icon: Palmtree }); if (dayShifts.filter(s => s.employee_id === employee.id).length > 1) warnings.push({ label: 'DOPPIO', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Layers }); if (employee.birth_date && differenceInYears(new Date(), parseISO(employee.birth_date)) < 18) warnings.push({ label: 'UNDER 18', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: UserMinus }); return warnings; };
  const activeEmployee = activeDragId ? employees.find(e => `emp-${e.id}` === activeDragId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <style>{` @media print { @page { size: landscape; margin: 10px; } body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } .print-area { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } .bg-slate-50 { background: white !important; } } `}</style>
      
      <div className="flex h-full gap-4 overflow-hidden">
        {/* SIDEBAR */}
        <div className="w-64 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col shrink-0 no-print">
          <div className="p-4 border-b border-slate-100 bg-slate-50 rounded-t-xl"><h3 className="font-bold text-slate-700 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-600" /> Staff</h3><p className="text-xs text-slate-400 mt-1">Trascina sul calendario</p></div>
          <div className="p-3 space-y-2 overflow-y-auto flex-1">{employees.map(emp => (<DraggableEmployee key={emp.id} employee={emp} />))}</div>
        </div>
        
        {/* CALENDARIO */}
        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative print-area">
          {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
          
          <div className="p-4 border-b border-gray-200 flex flex-col gap-4 bg-white shadow-sm z-20 relative">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                 <h2 className="text-xl font-bold text-slate-800 capitalize flex items-center gap-2">{format(currentDate, 'MMMM yyyy', { locale: it })}</h2>
                 <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200 no-print">
                  <button onClick={goPrev} className="p-1 hover:bg-white hover:shadow-sm rounded transition-all"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                  <div className="w-[1px] bg-slate-300 mx-1"></div>
                  <button onClick={goNext} className="p-1 hover:bg-white hover:shadow-sm rounded transition-all"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
                </div>
              </div>
              
              <div className="flex gap-2 no-print">
                 {/* TASTO BACHECA */}
                 <button onClick={() => setIsAnnounceOpen(true)} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200 relative" title="Bacheca">
                   <Megaphone className="w-5 h-5" />
                   {announcements.length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                 </button>
                 
                 <button onClick={handlePrint} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100" title="Stampa"><Printer className="w-5 h-5" /></button>
                 <button onClick={handleExport} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100" title="Esporta CSV"><Download className="w-5 h-5" /></button>
                 <div className="w-[1px] bg-slate-200 mx-1"></div>
                 <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200 text-xs font-bold">
                   <button onClick={() => setViewMode('week')} className={`px-3 py-1.5 rounded transition-all flex items-center gap-2 ${viewMode === 'week' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}><List className="w-3.5 h-3.5" /> Week</button>
                   <button onClick={() => setViewMode('month')} className={`px-3 py-1.5 rounded transition-all flex items-center gap-2 ${viewMode === 'month' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}><LayoutGrid className="w-3.5 h-3.5" /> Month</button>
                 </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200 no-print">
               <div className="flex items-center gap-6 px-2">
                 <div className="flex items-center gap-2"><div className="p-1.5 bg-emerald-100 rounded text-emerald-700"><Euro className="w-4 h-4"/></div><div><p className="text-[10px] text-slate-500 uppercase font-bold">Costo</p><p className="text-sm font-bold text-slate-800">€ {totalCost.toFixed(2)}</p></div></div>
                 <div className="flex items-center gap-2"><div className="p-1.5 bg-blue-100 rounded text-blue-700"><BarChart3 className="w-4 h-4"/></div><div><p className="text-[10px] text-slate-500 uppercase font-bold">Ore</p><p className="text-sm font-bold text-slate-800">{totalHours.toFixed(1)} h</p></div></div>
               </div>
               {unpublishedCount > 0 ? ( <button onClick={handlePublishAll} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-all animate-pulse"><Send className="w-3 h-3" /> Pubblica {unpublishedCount}</button>) : (<span className="text-xs text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded border border-emerald-100">Pubblicato</span>)}
            </div>
          </div>
          
          <div className="flex-1 overflow-auto bg-slate-50">
            <div className={`grid h-full ${viewMode === 'week' ? 'grid-cols-7 grid-rows-[40px_1fr]' : 'grid-cols-7 grid-rows-[40px_auto]'} gap-[1px] border-l border-t border-slate-200 bg-slate-200`}>
              {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => (<div key={d} className="bg-slate-50 flex items-center justify-center text-xs font-bold uppercase text-slate-500 tracking-wider h-10">{d}</div>))}
              {calendarDays.map((day) => { const dayShifts = getShiftsForDay(day); return ( <CalendarCell key={day.toISOString()} id={`cell::${day.toISOString()}`} date={day} isMonthView={viewMode === 'month'} isToday={isSameDay(day, new Date())}> <div className={`space-y-1.5 h-full ${viewMode === 'month' && !isSameMonth(day, currentDate) ? 'opacity-40 bg-slate-100' : ''}`}> {dayShifts.map(shift => { const warnings = getShiftWarnings(shift, shift.employees, dayShifts); let borderClass = "border-l-2 border-indigo-500"; const draftClass = !shift.is_published ? "border-dashed opacity-80" : ""; if (warnings.some(w => w.label === 'IN FERIE')) borderClass = "border-2 border-red-500 bg-red-50"; else if (warnings.some(w => w.label === 'DOPPIO')) borderClass = "border-2 border-amber-500 bg-amber-50"; return ( <div key={shift.id} onClick={(e) => handleEditShiftClick(e, shift)} className={`bg-white border border-slate-200 p-2 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-all group flex flex-col gap-1 select-none relative ${borderClass} ${draftClass}`}> <div className="flex items-center gap-2"> <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold text-white shadow-sm overflow-hidden ${shift.employees?.departments?.color || 'bg-slate-400'}`}>{shift.employees?.avatar_url ? <img src={shift.employees.avatar_url} className="w-full h-full object-cover" /> : <span>{shift.employees?.first_name[0]}</span>}</div> <p className="text-xs font-bold text-slate-800 truncate">{shift.employees?.first_name}</p> </div> <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium bg-slate-50 w-fit px-1.5 py-0.5 rounded border border-slate-100"><Clock className="w-2.5 h-2.5" />{format(parseISO(shift.start_time), 'HH:mm')} - {format(parseISO(shift.end_time), 'HH:mm')}</div> {warnings.length > 0 && (<div className="flex flex-wrap gap-1 mt-1">{warnings.map((w, i) => (<div key={i} className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${w.color}`}><w.icon className="w-2.5 h-2.5" /> {w.label}</div>))}</div>)} </div> ); })} </div> </CalendarCell> ); })}
            </div>
          </div>
        </div>

        {selectedSlot && <ShiftModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveShift} onDelete={selectedSlot.shiftId ? handleDeleteShift : undefined} employeeName={selectedSlot.employeeName} date={selectedSlot.date} initialData={selectedSlot.initialData} />}
        
        {isAnnounceOpen && ( 
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
              <div className="bg-indigo-600 p-4 border-b flex justify-between items-center text-white shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2"><Megaphone className="w-5 h-5"/> Bacheca Avvisi</h3>
                <button onClick={() => setIsAnnounceOpen(false)}><X/></button>
              </div>
              <div className="p-6 overflow-y-auto">
                <form onSubmit={handlePostAnnouncement} className="mb-6 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <textarea name="content" required placeholder="Scrivi qui l'avviso per lo staff..." className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-20 text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Visibile Dal</label><input name="visible_from" type="datetime-local" className="w-full p-2 text-xs border rounded-lg" defaultValue={new Date().toISOString().slice(0,16)} /></div>
                    <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fino Al</label><input name="visible_until" type="datetime-local" className="w-full p-2 text-xs border rounded-lg" /></div>
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 text-sm flex items-center justify-center gap-2"><Send className="w-4 h-4"/> Pubblica Avviso</button>
                </form>
                
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Storico Avvisi</h4>
                <div className="space-y-2">
                  {announcements.length === 0 ? <p className="text-center text-slate-400 italic text-sm">Nessun avviso.</p> : announcements.map(a => {
                    const now = new Date();
                    const start = parseISO(a.visible_from || now.toISOString()); 
                    const end = parseISO(a.visible_until || now.toISOString());
                    const isActive = now >= start && now <= end;
                    const isFuture = now < start;
                    const readPercentage = a.total_employees && a.total_employees > 0 ? Math.round(((a.read_count || 0) / a.total_employees) * 100) : 0;

                    return (
                      <div key={a.id} className={`p-3 rounded-lg border flex flex-col gap-2 ${isActive ? 'bg-white border-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm text-slate-800 font-medium mb-1">{a.content}</p>
                            <div className="flex items-center gap-2 text-[10px]">
                              {isActive && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">ATTIVO</span>}
                              {isFuture && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">PROGRAMMATO</span>}
                              {!isActive && !isFuture && <span className="bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-bold">SCADUTO</span>}
                              <span className="text-slate-400 flex items-center gap-1"><CalendarClock className="w-3 h-3"/> {format(start, 'd MMM')} - {format(end, 'd MMM')}</span>
                            </div>
                          </div>
                          <button onClick={() => handleDeleteAnnouncement(a.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 className="w-4 h-4"/></button>
                        </div>
                        
                        {/* READ STATS */}
                        <div className="bg-slate-50 p-2 rounded flex items-center justify-between text-xs text-slate-500">
                           <div className="flex items-center gap-1"><Eye className="w-3 h-3" /> Letto da:</div>
                           <div className="font-bold text-indigo-600">{a.read_count} / {a.total_employees} ({readPercentage}%)</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div> 
        )}

        <DragOverlay>{activeEmployee ? (<div className="flex items-center gap-3 p-3 bg-white rounded-xl border-2 border-indigo-500 shadow-2xl cursor-grabbing w-64 opacity-90 rotate-3"><div className={`w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden flex items-center justify-center bg-slate-100 ${activeEmployee.departments?.color}`}>{activeEmployee.avatar_url ? <img src={activeEmployee.avatar_url} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-slate-600">{activeEmployee.first_name[0]}</span>}</div><div><p className="font-bold text-sm text-slate-800">{activeEmployee.first_name}</p><p className="text-[10px] text-slate-500 uppercase font-bold">{activeEmployee.departments?.name}</p></div></div>) : null}</DragOverlay>
      </div>
    </DndContext>
  );
}