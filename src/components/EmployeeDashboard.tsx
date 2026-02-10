import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../supabase';
import { format, isToday, isYesterday, parseISO, isTomorrow } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  Bell, Clock, Calendar, LogOut, 
  PlusCircle, CheckCircle2, XCircle, Clock3, Camera, Play, Square, CalendarX,
  RefreshCw, ArrowLeft, Coffee, Megaphone, Check, MessageSquare, Send, X, CheckCheck, Search, Shield, ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LeaveRequestModal from './LeaveRequestModal';
import EmployeeNotifications from './EmployeeNotifications';

// --- INTERFACCE ---
interface Employee { id: string; first_name: string; last_name: string; avatar_url?: string; departments: { name: string; color: string }; role_label?: string; role?: string; }
interface Shift { id: string; start_time: string; end_time: string; notes?: string; is_published: boolean; }
interface LeaveRequest { id: string; start_date: string; end_date: string; reason: string; status: 'pending' | 'approved' | 'rejected'; is_all_day: boolean; }
interface TimeEntry { id: string; clock_in: string; clock_out?: string; break_start?: string; break_end?: string; }
interface Availability { id: string; date: string; reason: string; }
interface Announcement { id: string; content: string; created_at: string; visible_from: string; visible_until: string; }
interface Message { id: string; sender_id: string; receiver_id: string; content: string; created_at: string; is_read: boolean; }

const formatChatTime = (dateStr: string) => {
  if (!dateStr) return '';
  const date = parseISO(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Ieri';
  return format(date, 'dd/MM');
};

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [settings, setSettings] = useState({ enable_time_clock: true, enable_chat: true, require_geolocation: false });

  // CHAT STATE
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedColleague, setSelectedColleague] = useState<Employee | null>(null);
  const [rawMessages, setRawMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchChat, setSearchChat] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // UI & DATA STATE
  const [isAnnounceModalOpen, setIsAnnounceModalOpen] = useState(false);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>([]);
  const [unavailabilities, setUnavailabilities] = useState<Availability[]>([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [showUnavailForm, setShowUnavailForm] = useState(false);
  const [unavailDate, setUnavailDate] = useState('');
  const [unavailReason, setUnavailReason] = useState('');

  // --- INIT ---
  useEffect(() => {
    const userStr = localStorage.getItem('brigade_user');
    // FIX LOOP: Se non c'è utente, vai al LOGIN, non alla Home (che potrebbe rimandarti qui)
    if (!userStr) { navigate('/login'); return; }
    
    setCurrentUser(JSON.parse(userStr));

    async function init() {
      const { data: sett } = await supabase.from('settings').select('*').single();
      if(sett) setSettings(sett);
      
      const { data: emps } = await supabase.from('employees').select(`*, departments(name, color)`).neq('username', 'admin');
      setEmployees(emps as any || []);
      
      const nowISO = new Date().toISOString();
      const { data: ann } = await supabase.from('announcements').select('*').lte('visible_from', nowISO).gte('visible_until', nowISO).order('created_at', { ascending: false });
      setAnnouncements(ann || []);
    }
    init();
  }, []);

  // POLLING
  useEffect(() => {
    if (currentUser) {
      fetchMyShifts(); fetchMyRequests(); fetchActiveEntry(); fetchUnavailabilities(); checkUnread(); fetchAnnouncements();
      const interval = setInterval(() => {
        checkUnread();
        if (isChatOpen) fetchAllMessages(); 
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [currentUser, isChatOpen]);

  useEffect(() => {
    if (selectedColleague && isChatOpen) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [rawMessages, selectedColleague, isChatOpen]);

  // --- CHAT LOGIC ---
  async function fetchAllMessages() {
    if (!currentUser) return;
    const { data } = await supabase.from('direct_messages')
      .select('*')
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: true });
    setRawMessages(data || []);
  }

  const conversations = useMemo(() => {
    if (!currentUser || employees.length === 0) return [];
    const convMap = new Map();

    employees.filter(e => e.id !== currentUser.id).forEach(emp => {
      convMap.set(emp.id, { contact: emp, lastMessage: null, unreadCount: 0, updatedAt: new Date(0).toISOString() });
    });

    rawMessages.forEach(msg => {
      const otherId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
      if (convMap.has(otherId)) {
        const conv = convMap.get(otherId);
        conv.lastMessage = msg;
        conv.updatedAt = msg.created_at;
        if (msg.sender_id !== currentUser.id && !msg.is_read) conv.unreadCount += 1;
      }
    });

    let convArray = Array.from(convMap.values());
    if (searchChat) {
      convArray = convArray.filter(c => c.contact.first_name.toLowerCase().includes(searchChat.toLowerCase()) || c.contact.last_name.toLowerCase().includes(searchChat.toLowerCase()));
    }
    return convArray.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [rawMessages, employees, currentUser, searchChat]);

  const activeChatMessages = useMemo(() => {
    if (!selectedColleague || !currentUser) return [];
    return rawMessages.filter(m => 
      (m.sender_id === currentUser.id && m.receiver_id === selectedColleague.id) ||
      (m.sender_id === selectedColleague.id && m.receiver_id === currentUser.id)
    );
  }, [rawMessages, selectedColleague, currentUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedColleague || !currentUser) return;
    const content = newMessage;
    setNewMessage('');
    const { error } = await supabase.from('direct_messages').insert({ sender_id: currentUser.id, receiver_id: selectedColleague.id, content: content });
    if (error) alert("Errore invio: " + error.message);
    else fetchAllMessages();
  };

  const openChat = async (employee: Employee) => {
    setSelectedColleague(employee);
    if(currentUser) {
      await supabase.from('direct_messages').update({ is_read: true }).eq('sender_id', employee.id).eq('receiver_id', currentUser.id).eq('is_read', false);
      fetchAllMessages();
    }
  };

  // --- ACTIONS ---
  async function fetchAnnouncements() { const nowISO = new Date().toISOString(); const { data: ann } = await supabase.from('announcements').select('*').lte('visible_from', nowISO).gte('visible_until', nowISO).order('created_at', { ascending: false }); const { data: reads } = await supabase.from('announcement_reads').select('announcement_id').eq('employee_id', currentUser?.id); setAnnouncements(ann || []); setReadAnnouncementIds(reads?.map(r => r.announcement_id) || []); }
  const handleMarkAsRead = async (announcementId: string) => { if (!currentUser) return; setReadAnnouncementIds(prev => [...prev, announcementId]); await supabase.from('announcement_reads').insert({ announcement_id: announcementId, employee_id: currentUser.id }); };
  async function fetchMyShifts() { const todayISO = new Date().toISOString(); const { data } = await supabase.from('shifts').select('*').eq('employee_id', currentUser?.id).eq('is_published', true).gte('end_time', todayISO).order('start_time', { ascending: true }).limit(10); setShifts(data || []); }
  async function fetchMyRequests() { const { data } = await supabase.from('leave_requests').select('*').eq('employee_id', currentUser?.id).order('created_at', { ascending: false }); setRequests(data as any || []); }
  async function checkUnread() { const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', currentUser?.id).eq('is_read', false); setUnreadCount(count || 0); }
  async function fetchActiveEntry() { const { data } = await supabase.from('time_entries').select('*').eq('employee_id', currentUser?.id).is('clock_out', null).maybeSingle(); setActiveEntry(data); }
  async function fetchUnavailabilities() { const today = new Date().toISOString().split('T')[0]; const { data } = await supabase.from('availability').select('*').eq('employee_id', currentUser?.id).gte('date', today).order('date'); setUnavailabilities(data || []); }
  const handleClockIn = async () => { if (!currentUser) return; const perform = async () => { const { data, error } = await supabase.from('time_entries').insert({ employee_id: currentUser.id }).select().single(); if (!error) setActiveEntry(data); }; if (settings.require_geolocation && navigator.geolocation) navigator.geolocation.getCurrentPosition(async (pos) => { await supabase.from('employee_logs').insert({ employee_id: currentUser.id, action_type: 'clock_in', latitude: pos.coords.latitude, longitude: pos.coords.longitude }); await perform(); }); else await perform(); };
  const handleClockOut = async () => { if (!activeEntry) return; const perform = async () => { await supabase.from('time_entries').update({ clock_out: new Date().toISOString() }).eq('id', activeEntry.id); setActiveEntry(null); }; if (settings.require_geolocation && navigator.geolocation) navigator.geolocation.getCurrentPosition(async (pos) => { await supabase.from('employee_logs').insert({ employee_id: currentUser?.id, action_type: 'clock_out', latitude: pos.coords.latitude, longitude: pos.coords.longitude }); await perform(); }); else await perform(); };
  const toggleBreak = async () => { if (!activeEntry) return; const now = new Date().toISOString(); if (!activeEntry.break_start) { const { data } = await supabase.from('time_entries').update({ break_start: now }).eq('id', activeEntry.id).select().single(); if(data) setActiveEntry(data); } else if (!activeEntry.break_end) { const { data } = await supabase.from('time_entries').update({ break_end: now }).eq('id', activeEntry.id).select().single(); if(data) setActiveEntry(data); } };
  const handleSwapRequest = async (shiftId: string) => { if(!confirm("Vuoi cedere questo turno?")) return; await supabase.from('shift_swaps').insert({ shift_id: shiftId, requester_id: currentUser?.id, status: 'pending' }); alert("Richiesta inviata!"); };
  const handleAddUnavailability = async (e: React.FormEvent) => { e.preventDefault(); if (!unavailDate) return; await supabase.from('availability').insert({ employee_id: currentUser?.id, date: unavailDate, reason: unavailReason, is_available: false }); setUnavailDate(''); setUnavailReason(''); setShowUnavailForm(false); fetchUnavailabilities(); };
  const handleDeleteUnavailability = async (id: string) => { await supabase.from('availability').delete().eq('id', id); fetchUnavailabilities(); };
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => { if (!event.target.files || !event.target.files[0] || !currentUser) return; try { setUploading(true); const file = event.target.files[0]; const fileExt = file.name.split('.').pop(); const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`; const filePath = `${fileName}`; const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file); if (uploadError) throw uploadError; const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath); await supabase.from('employees').update({ avatar_url: publicUrl }).eq('id', currentUser.id); setCurrentUser({ ...currentUser, avatar_url: publicUrl }); setEmployees(prev => prev.map(emp => emp.id === currentUser.id ? { ...emp, avatar_url: publicUrl } : emp)); } catch (error) { alert('Errore upload foto.'); } finally { setUploading(false); } };
  const getStatusBadge = (status: string) => { switch (status) { case 'approved': return <span className="text-green-700 bg-green-100 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> OK</span>; case 'rejected': return <span className="text-red-700 bg-red-100 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1"><XCircle className="w-3 h-3"/> NO</span>; default: return <span className="text-yellow-700 bg-yellow-100 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1"><Clock3 className="w-3 h-3"/> Wait</span>; } };

  if (!currentUser) return null;

  const nextShift = shifts[0];
  const otherShifts = shifts.slice(1);
  const isOnBreak = activeEntry?.break_start && !activeEntry?.break_end;
  const unreadAnnouncements = announcements.filter(a => !readAnnouncementIds.includes(a.id)).length;

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans text-slate-900 overflow-x-hidden">
      
      {/* ⚠️ SMART BANNER */}
      {announcements.length > 0 && (
        <div 
          onClick={() => setIsAnnounceModalOpen(true)}
          className={`
            relative z-20 mx-3 md:mx-4 mt-4 -mb-4 rounded-xl shadow-lg border border-white/20 p-3 flex items-center justify-between cursor-pointer transition-all active:scale-95
            ${unreadAnnouncements > 0 
              ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 animate-gradient bg-[length:200%_auto] text-white' 
              : 'bg-white text-slate-600 border-slate-200'
            }
          `}
        >
          <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 ${unreadAnnouncements > 0 ? 'bg-white/20' : 'bg-slate-100'}`}>
              <Megaphone className={`w-5 h-5 ${unreadAnnouncements > 0 ? 'text-white animate-pulse' : 'text-slate-500'}`} />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${unreadAnnouncements > 0 ? 'text-indigo-200' : 'text-slate-400'}`}>
                {unreadAnnouncements > 0 ? `${unreadAnnouncements} DA LEGGERE` : 'BACHECA'}
              </span>
              <p className="text-sm font-bold truncate pr-1 w-full">
                {announcements[0].content}
              </p>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 shrink-0 ${unreadAnnouncements > 0 ? 'text-white' : 'text-slate-400'}`} />
        </div>
      )}

      {/* HEADER DASHBOARD */}
      <div className="bg-white p-4 md:p-6 pb-8 rounded-b-[2.5rem] shadow-sm relative z-10 pt-10">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            
            {/* TASTO ADMIN */}
            {currentUser.role === 'admin' && (
              <button 
                onClick={() => navigate('/')} 
                className="p-3 bg-slate-900 text-white rounded-full shadow-lg hover:bg-slate-800 transition-all active:scale-95 border-2 border-slate-700 hidden md:flex"
                title="Torna al Pannello Admin"
              >
                <Shield className="w-5 h-5" />
              </button>
            )}

            <div className="relative group">
              <div className="w-14 h-14 rounded-full border-2 border-slate-100 shadow-sm overflow-hidden flex items-center justify-center bg-slate-100">
                {currentUser.avatar_url ? <img src={currentUser.avatar_url} className={`w-full h-full object-cover ${uploading ? 'opacity-50' : ''}`} /> : <span className="text-xl font-bold text-slate-400">{currentUser.first_name[0]}</span>}
              </div>
              <label className="absolute bottom-0 right-0 bg-indigo-600 text-white p-1 rounded-full cursor-pointer shadow-md hover:bg-indigo-700"><Camera className="w-3 h-3" /><input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading}/></label>
            </div>
            <div>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Bentornato</p>
              <h1 className="text-xl font-bold text-slate-900">{currentUser.first_name}</h1>
              {currentUser.role_label && <p className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded w-fit mt-1">{currentUser.role_label}</p>}
            </div>
          </div>
          
          <div className="flex gap-2">
            {settings.enable_chat && (<button onClick={() => { setIsChatOpen(true); fetchAllMessages(); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-full relative active:scale-95 border border-indigo-200"><MessageSquare className="w-5 h-5" /></button>)}
            <button onClick={() => setIsNotifOpen(true)} className="p-3 bg-slate-100 rounded-full text-slate-600 relative active:scale-95"><Bell className="w-5 h-5" />{unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white animate-pulse">{unreadCount}</span>}</button>
            <button onClick={() => { localStorage.removeItem('brigade_user'); navigate('/login'); }} className="p-3 bg-slate-100 rounded-full text-slate-500"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
        
        {settings.enable_time_clock && (<div className="mb-6 space-y-3">{!activeEntry ? ( <button onClick={handleClockIn} className="w-full bg-emerald-600 text-white p-4 rounded-2xl shadow-lg shadow-emerald-200 flex items-center justify-between active:scale-95 transition-transform"><div className="flex items-center gap-4"><div className="bg-white/20 p-2.5 rounded-xl"><Play className="w-6 h-6 fill-current"/></div><div className="text-left"><p className="font-bold text-lg leading-none">Inizia Turno</p><p className="text-emerald-100 text-xs mt-1 font-medium">Registra il tuo ingresso</p></div></div></button> ) : ( <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl space-y-4"><div className="flex justify-between items-center"><div className="flex items-center gap-4"><div className="bg-red-500 p-2.5 rounded-xl animate-bounce"><Clock className="w-6 h-6"/></div><div className="text-left"><p className="font-bold text-lg leading-none">In Servizio</p><p className="text-slate-400 text-xs mt-1 font-medium font-mono">Dalle {format(parseISO(activeEntry.clock_in), 'HH:mm')}</p></div></div><button onClick={handleClockOut} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-bold text-sm shadow-md transition-colors flex items-center gap-2"><Square className="w-4 h-4 fill-current"/> Stop</button></div>{!activeEntry.break_end && (<button onClick={toggleBreak} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${isOnBreak ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-white/10 hover:bg-white/20 text-white'}`}><Coffee className="w-5 h-5"/> {isOnBreak ? 'Termina Pausa' : 'Inizia Pausa'}</button>)}{activeEntry.break_end && <p className="text-center text-xs text-slate-500">Pausa effettuata</p>}</div> )}</div>)}
        {nextShift && !activeEntry ? ( <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden group"><div className="flex justify-between items-start"><div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Prossimo Turno</p><div className="text-3xl font-bold mb-1 tracking-tight text-slate-800">{format(parseISO(nextShift.start_time), 'HH:mm')}<span className="text-slate-400 text-xl font-normal ml-2">- {format(parseISO(nextShift.end_time), 'HH:mm')}</span></div><p className="text-sm font-bold text-indigo-600 mb-0">{isToday(parseISO(nextShift.start_time)) ? 'Oggi' : isTomorrow(parseISO(nextShift.start_time)) ? 'Domani' : format(parseISO(nextShift.start_time), 'EEEE d MMMM', { locale: it })}</p></div>{nextShift.notes && <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide border border-indigo-100">{nextShift.notes}</span>}</div></div> ) : null}
      </div>
      
      {/* RESTO DELLA DASHBOARD (Invariato) */}
      <div className="px-4 -mt-6 relative z-20 grid grid-cols-2 gap-3"><button onClick={() => setIsRequestModalOpen(true)} className="bg-white hover:bg-slate-50 text-slate-800 p-4 rounded-2xl shadow-md border border-slate-100 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"><PlusCircle className="w-6 h-6 text-indigo-600"/><span className="text-xs font-bold">Chiedi Ferie</span></button><button onClick={() => setShowUnavailForm(true)} className="bg-white hover:bg-slate-50 text-slate-800 p-4 rounded-2xl shadow-md border border-slate-100 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"><CalendarX className="w-6 h-6 text-red-500"/><span className="text-xs font-bold">Non ci sono</span></button></div>
      {showUnavailForm && ( <div className="px-4 mt-4 animate-in slide-in-from-top-4"><div className="bg-red-50 p-4 rounded-2xl border border-red-100"><h4 className="font-bold text-red-800 text-sm mb-2">Segnala Indisponibilità</h4><form onSubmit={handleAddUnavailability} className="space-y-2"><input type="date" required value={unavailDate} onChange={e => setUnavailDate(e.target.value)} className="w-full p-2 rounded-lg border border-red-200 text-sm" /><input type="text" required placeholder="Motivo (es. Esame)" value={unavailReason} onChange={e => setUnavailReason(e.target.value)} className="w-full p-2 rounded-lg border border-red-200 text-sm" /><div className="flex gap-2 pt-2"><button type="button" onClick={() => setShowUnavailForm(false)} className="flex-1 py-2 text-xs font-bold text-slate-500">Annulla</button><button type="submit" className="flex-1 py-2 bg-red-600 text-white rounded-lg text-xs font-bold shadow-sm">Invia</button></div></form></div></div> )}
      
      <div className="p-4 md:p-6 grid gap-8">
        {unavailabilities.length > 0 && (<section><h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider"><CalendarX className="w-4 h-4 text-red-500" /> Le tue Indisponibilità</h3><div className="space-y-2">{unavailabilities.map(u => (<div key={u.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm"><div><p className="font-bold text-slate-800 text-sm">{format(parseISO(u.date), 'd MMMM', {locale:it})}</p><p className="text-xs text-red-500">{u.reason}</p></div><button onClick={() => handleDeleteUnavailability(u.id)} className="text-slate-300 hover:text-red-500"><XCircle className="w-4 h-4"/></button></div>))}</div></section>)}
        <section><h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider"><Calendar className="w-4 h-4 text-slate-400" /> Prossimi Turni</h3><div className="space-y-3">{otherShifts.length > 0 ? otherShifts.map(shift => (<div key={shift.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3"><div className="flex justify-between items-center border-b border-slate-50 pb-2"><p className="font-bold text-slate-800 capitalize text-sm">{format(parseISO(shift.start_time), 'EEEE d MMMM', { locale: it })}</p><button onClick={() => handleSwapRequest(shift.id)} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 flex items-center gap-1"><RefreshCw className="w-3 h-3"/> Cedi</button></div><div className="flex items-center gap-2 text-slate-600 text-xs font-medium"><Clock className="w-4 h-4 text-slate-400" /><span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-slate-700">{format(parseISO(shift.start_time), 'HH:mm')} - {format(parseISO(shift.end_time), 'HH:mm')}</span></div></div>)) : <p className="text-slate-400 text-sm text-center py-2 italic">Nessun altro turno pubblicato.</p>}</div></section>
        <section><h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider"><CheckCircle2 className="w-4 h-4 text-slate-400" /> Storico Richieste</h3><div className="space-y-3">{requests.length > 0 ? requests.map(req => (<div key={req.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden"><div className={`absolute left-0 top-0 bottom-0 w-1 ${req.status === 'approved' ? 'bg-green-500' : req.status === 'rejected' ? 'bg-red-500' : 'bg-yellow-400'}`}></div><div className="flex justify-between items-start mb-2 pl-2"><div className="flex items-center gap-2"><span className="font-bold text-slate-700 text-sm">{req.reason}</span>{!req.is_all_day && <span className="bg-indigo-50 text-indigo-600 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide border border-indigo-100">Ore</span>}</div>{getStatusBadge(req.status)}</div><div className="text-sm text-slate-500 pl-2">{req.is_all_day ? (<div className="flex items-center gap-1"><span className="font-semibold text-slate-800">{format(parseISO(req.start_date), 'd MMM', { locale: it })}</span> <span className="text-slate-300">→</span><span className="font-semibold text-slate-800">{format(parseISO(req.end_date), 'd MMM', { locale: it })}</span></div>) : (<div className="flex flex-col gap-1"><span className="text-xs font-semibold text-slate-800 capitalize border-b border-slate-100 pb-1 mb-1 w-fit">{format(parseISO(req.start_date), 'EEE d MMM', { locale: it })}</span><div className="flex items-center gap-2 font-mono text-xs"><span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{format(parseISO(req.start_date), 'HH:mm')}</span><span className="text-slate-300">→</span><span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{format(parseISO(req.end_date), 'HH:mm')}</span></div></div>)}</div></div>)) : <div className="text-center py-6 bg-white rounded-2xl border border-dashed border-slate-200"><p className="text-slate-400 text-sm">Non hai ancora chiesto ferie.</p></div>}</div></section>
      </div>

      {/* MODALE AVVISI EXPANDED */}
      {isAnnounceModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Megaphone className="w-5 h-5 text-indigo-600"/> Bacheca Avvisi</h3>
              <button onClick={() => setIsAnnounceModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500"/></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 bg-slate-100">
              {announcements.map(a => {
                const isRead = readAnnouncementIds.includes(a.id);
                return (
                  <div key={a.id} className={`p-4 rounded-xl shadow-sm border transition-all ${isRead ? 'bg-white border-slate-200 opacity-70' : 'bg-indigo-600 text-white border-indigo-500'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${isRead ? 'text-slate-400' : 'text-indigo-200'}`}>
                        {format(parseISO(a.created_at), 'd MMMM, HH:mm', {locale:it})}
                      </span>
                      {isRead ? <CheckCircle2 className="w-5 h-5 text-green-500"/> : <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></div>}
                    </div>
                    <p className={`text-sm font-medium leading-relaxed ${isRead ? 'text-slate-700' : 'text-white'}`}>{a.content}</p>
                    {!isRead && (
                      <button onClick={() => handleMarkAsRead(a.id)} className="mt-3 w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors">
                        <Check className="w-4 h-4"/> Ho Letto
                      </button>
                    )}
                  </div>
                );
              })}
              {announcements.length === 0 && <p className="text-center text-slate-400 py-10">Nessun avviso.</p>}
            </div>
          </div>
        </div>
      )}

      {/* TELEGRAM STYLE CHAT */}
      {isChatOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            
            <div className="bg-indigo-600 p-4 border-b flex justify-between items-center text-white shrink-0 shadow-sm relative z-10">
              <h3 className="font-bold text-lg flex items-center gap-2"><MessageSquare className="w-5 h-5"/> {selectedColleague ? selectedColleague.first_name : 'Messaggi'}</h3>
              <button onClick={() => { setIsChatOpen(false); setSelectedColleague(null); }} className="p-1 hover:bg-white/10 rounded-full"><X/></button>
            </div>
            
            {!selectedColleague ? (
              <div className="flex-1 overflow-y-auto bg-slate-50">
                <div className="p-3 sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                  <div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><input value={searchChat} onChange={e => setSearchChat(e.target.value)} placeholder="Cerca collega..." className="w-full bg-white border border-slate-200 pl-9 p-2.5 rounded-xl text-sm outline-none focus:border-indigo-500 transition-colors" /></div>
                </div>
                <div className="divide-y divide-slate-100">
                  {conversations.map(({ contact, lastMessage, unreadCount }) => (
                    <button key={contact.id} onClick={() => openChat(contact)} className="w-full flex items-center gap-3 p-4 hover:bg-white transition-colors active:bg-slate-100">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden ${contact.departments?.color || 'bg-slate-400'}`}>{contact.avatar_url ? <img src={contact.avatar_url} className="w-full h-full object-cover" /> : contact.first_name[0]}</div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex justify-between items-center mb-0.5"><p className="font-bold text-slate-800 text-sm truncate">{contact.first_name} {contact.last_name}</p>{lastMessage && <span className={`text-[10px] ${unreadCount > 0 ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>{formatChatTime(lastMessage.created_at)}</span>}</div>
                        <div className="flex justify-between items-center"><p className={`text-xs truncate max-w-[200px] ${unreadCount > 0 ? 'text-slate-800 font-semibold' : 'text-slate-500'}`}>{lastMessage ? (<>{lastMessage.sender_id === currentUser?.id && <span className="text-indigo-500 mr-1">Tu:</span>}{lastMessage.content}</>) : <span className="italic text-slate-400">Inizia a chattare</span>}</p>{unreadCount > 0 && <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{unreadCount}</span>}</div>
                      </div>
                    </button>
                  ))}
                  {conversations.length === 0 && <p className="text-center text-slate-400 text-sm py-10">Nessuna conversazione.</p>}
                </div>
              </div>
            ) : (
              <>
                <div className="bg-white p-2 border-b flex items-center gap-2 px-3 shadow-sm z-10 text-xs text-slate-500 cursor-pointer hover:bg-slate-50" onClick={() => setSelectedColleague(null)}><ArrowLeft className="w-4 h-4"/> Torna alla lista</div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#eef1f6]">
                  {activeChatMessages.map((msg, index) => {
                    const isMe = msg.sender_id === currentUser?.id;
                    const showDate = index === 0 || format(parseISO(msg.created_at), 'yyyy-MM-dd') !== format(parseISO(activeChatMessages[index - 1].created_at), 'yyyy-MM-dd');
                    return (
                      <div key={msg.id}>
                        {showDate && (<div className="flex justify-center my-4"><span className="bg-slate-300/50 text-slate-600 text-[10px] px-2 py-1 rounded-full font-bold shadow-sm">{formatChatTime(msg.created_at)}</span></div>)}
                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm shadow-sm relative group ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-800 rounded-bl-none border border-slate-200'}`}>
                            <p className="mb-1 leading-snug">{msg.content}</p>
                            <div className={`flex items-center justify-end gap-1 text-[9px] ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}><span>{format(parseISO(msg.created_at), 'HH:mm')}</span>{isMe && (msg.is_read ? <CheckCheck className="w-3 h-3 text-cyan-300"/> : <Check className="w-3 h-3"/>)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="p-3 bg-white border-t flex gap-2 items-end">
                  <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Scrivi messaggio..." className="flex-1 p-3 bg-slate-100 border-0 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400" autoFocus />
                  <button type="submit" disabled={!newMessage.trim()} className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-90 shadow-md"><Send className="w-5 h-5"/></button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <LeaveRequestModal isOpen={isRequestModalOpen} onClose={() => setIsRequestModalOpen(false)} employeeId={currentUser.id} onSuccess={fetchMyRequests} />
      <EmployeeNotifications isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} userId={currentUser.id} onRead={checkUnread} />
    </div>
  );
}