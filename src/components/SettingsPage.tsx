import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { 
  Users, Clock, Building2, Save, Plus, Trash2, Palette, Pencil, X, 
  CalendarRange, Lock, Unlock, ArrowRight, ArrowLeft, ScrollText, MapPin, MapPinOff, FileText, UserPlus, LayoutGrid, KeyRound, User,
  ToggleLeft, ToggleRight, MessageSquare, ShieldAlert, CheckCircle2, Briefcase
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Link } from 'react-router-dom';

// --- INTERFACCE ---
interface Employee { id: string; first_name: string; last_name: string; username: string; role: string; department_id: string; contract_hours_weekly: number; hourly_rate: number; hourly_rate_net: number; contract_type: string; role_label: string; birth_date: string; needs_password_reset: boolean; departments?: { name: string }; }
interface Department { id: string; name: string; color: string; }
interface Role { id: string; name: string; department_id: string; } // NUOVA INTERFACCIA
interface Template { id: string; name: string; start_time: string; end_time: string; }
interface CompanyPeriod { id: string; start_date: string; end_date: string; type: 'opening' | 'closing'; description: string; }
interface EmployeeLog { id: string; action_type: string; latitude: number; longitude: number; timestamp: string; }
interface ChatLog { id: string; content: string; created_at: string; sender: { first_name: string; last_name: string }; receiver: { first_name: string; last_name: string }; }

const COLOR_PALETTE = ['bg-slate-200', 'bg-red-200', 'bg-orange-200', 'bg-amber-200', 'bg-yellow-200', 'bg-lime-200', 'bg-green-200', 'bg-emerald-200', 'bg-teal-200', 'bg-cyan-200', 'bg-sky-200', 'bg-blue-200', 'bg-indigo-200', 'bg-violet-200', 'bg-purple-200', 'bg-fuchsia-200', 'bg-pink-200', 'bg-rose-200'];
const CONTRACT_TYPES = ['Indeterminato Full-time', 'Indeterminato Part-time', 'Determinato', 'Apprendistato', 'A Chiamata (Intermittente)', 'Extra / Voucher', 'Stage / Tirocinio'];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'staff' | 'shifts' | 'depts' | 'features'>('staff');
  const [loading, setLoading] = useState(false);

  // Dati
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companyRoles, setCompanyRoles] = useState<Role[]>([]); // NUOVO STATO
  const [templates, setTemplates] = useState<Template[]>([]);
  const [periods, setPeriods] = useState<CompanyPeriod[]>([]);
  const [settings, setSettings] = useState({ opening_time: '09:00', closing_time: '23:00', require_geolocation: false, enable_time_clock: true, enable_chat: true });
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);

  // Stati Modali UI
  const [isCreateEmpOpen, setIsCreateEmpOpen] = useState(false);
  const [isCreateDeptOpen, setIsCreateDeptOpen] = useState(false);
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [viewingLogs, setViewingLogs] = useState<Employee | null>(null);
  const [logs, setLogs] = useState<EmployeeLog[]>([]);
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [newDeptColor, setNewDeptColor] = useState('bg-slate-200');
  const [periodType, setPeriodType] = useState<'opening' | 'closing'>('opening');

  // Stato temporaneo per creazione ruolo
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDept, setNewRoleDept] = useState('');

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (activeTab === 'features') fetchChatLogs(); }, [activeTab]);

  async function fetchData() {
    setLoading(true);
    const { data: emp } = await supabase.from('employees').select('*, departments(name)').neq('username', 'admin').order('first_name');
    const { data: dept } = await supabase.from('departments').select('*').order('name');
    const { data: roles } = await supabase.from('company_roles').select('*').order('name'); // FETCH RUOLI
    const { data: templ } = await supabase.from('shift_templates').select('*').order('start_time');
    const { data: sett } = await supabase.from('settings').select('*').single();
    const { data: per } = await supabase.from('company_periods').select('*').order('start_date', { ascending: false });

    if (emp) setEmployees(emp as any);
    if (dept) setDepartments(dept);
    if (roles) setCompanyRoles(roles);
    if (templ) setTemplates(templ);
    if (sett) setSettings(sett);
    if (per) setPeriods(per as any);
    setLoading(false);
  }

  async function fetchChatLogs() {
    const { data } = await supabase.from('direct_messages').select(`id, content, created_at, sender:sender_id(first_name, last_name), receiver:receiver_id(first_name, last_name)`).order('created_at', { ascending: false }).limit(100);
    setChatLogs(data as any || []);
  }

  async function fetchLogs(empId: string) { const { data } = await supabase.from('employee_logs').select('*').eq('employee_id', empId).order('timestamp', { ascending: false }).limit(50); setLogs(data || []); }

  // --- ACTIONS ---
  const handleSaveSettings = async () => { 
    const { data: existing } = await supabase.from('settings').select('id').single(); 
    if (existing) await supabase.from('settings').update(settings).eq('id', existing.id); 
    else await supabase.from('settings').insert(settings); 
    setShowSuccessModal(true); setTimeout(() => setShowSuccessModal(false), 2000); 
  };

  // STAFF
  const handleCreateEmployee = async (e: React.FormEvent) => { e.preventDefault(); const formData = new FormData(e.target as HTMLFormElement); const firstName = formData.get('first_name') as string; const lastName = formData.get('last_name') as string; const cleanUser = (firstName + "." + lastName).toLowerCase().replace(/\s/g, ''); const newEmp = { first_name: firstName, last_name: lastName, birth_date: formData.get('birth_date'), department_id: formData.get('department_id'), contract_hours_weekly: formData.get('hours'), hourly_rate: formData.get('rate_gross'), hourly_rate_net: formData.get('rate_net'), contract_type: formData.get('contract_type'), role_label: formData.get('role_label'), username: cleanUser, password: cleanUser, role: 'staff', needs_password_reset: true }; const { error } = await supabase.from('employees').insert(newEmp); if(error) alert("Errore creazione"); fetchData(); setIsCreateEmpOpen(false); };
  const handleResetEmpPassword = async (emp: Employee) => { if(!confirm(`Resettare password?`)) return; await supabase.from('employees').update({ password: emp.username, needs_password_reset: true }).eq('id', emp.id); alert("Reset effettuato."); };
  const handleUpdateEmployee = async (e: React.FormEvent) => { e.preventDefault(); if (!editingEmp) return; await supabase.from('employees').update({ first_name: editingEmp.first_name, last_name: editingEmp.last_name, birth_date: editingEmp.birth_date, department_id: editingEmp.department_id, contract_hours_weekly: editingEmp.contract_hours_weekly, hourly_rate: editingEmp.hourly_rate, hourly_rate_net: editingEmp.hourly_rate_net, contract_type: editingEmp.contract_type, role_label: editingEmp.role_label }).eq('id', editingEmp.id); setEditingEmp(null); fetchData(); };
  const handleDeleteEmployee = async (id: string) => { if(!confirm("Eliminare?")) return; await supabase.from('employees').delete().eq('id', id); fetchData(); };
  
  // REPARTI & RUOLI
  const handleCreateDepartment = async (e: React.FormEvent) => { e.preventDefault(); const formData = new FormData(e.target as HTMLFormElement); await supabase.from('departments').insert({ name: formData.get('name'), color: newDeptColor }); fetchData(); setIsCreateDeptOpen(false); setNewDeptColor('bg-slate-200'); };
  const handleUpdateDepartment = async (e: React.FormEvent) => { e.preventDefault(); if (!editingDept) return; await supabase.from('departments').update({ name: editingDept.name, color: editingDept.color }).eq('id', editingDept.id); setEditingDept(null); fetchData(); };
  const handleDeleteDepartment = async (id: string) => { if(!confirm("Sicuro?")) return; await supabase.from('departments').delete().eq('id', id); fetchData(); };
  
  // ACTION NUOVA: CREA RUOLO
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName || !newRoleDept) return;
    await supabase.from('company_roles').insert({ name: newRoleName, department_id: newRoleDept });
    setNewRoleName(''); setNewRoleDept('');
    fetchData();
  };
  const handleDeleteRole = async (id: string) => {
    await supabase.from('company_roles').delete().eq('id', id);
    fetchData();
  };

  // ALTRI
  const handleCreateTemplate = async (e: React.FormEvent) => { e.preventDefault(); const formData = new FormData(e.target as HTMLFormElement); await supabase.from('shift_templates').insert({ name: formData.get('name'), start_time: formData.get('start'), end_time: formData.get('end') }); fetchData(); setIsCreateTemplateOpen(false); };
  const handleUpdateTemplate = async (e: React.FormEvent) => { e.preventDefault(); if (!editingTemplate) return; await supabase.from('shift_templates').update({ name: editingTemplate.name, start_time: editingTemplate.start_time, end_time: editingTemplate.end_time }).eq('id', editingTemplate.id); setEditingTemplate(null); fetchData(); };
  const handleDeleteTemplate = async (id: string) => { if(!confirm("Eliminare?")) return; await supabase.from('shift_templates').delete().eq('id', id); fetchData(); };
  const handleCreatePeriod = async (e: React.FormEvent) => { e.preventDefault(); const formData = new FormData(e.target as HTMLFormElement); if (formData.get('end')! < formData.get('start')!) return alert("Data errata."); await supabase.from('company_periods').insert({ description: formData.get('description'), start_date: formData.get('start'), end_date: formData.get('end'), type: periodType }); fetchData(); (e.target as HTMLFormElement).reset(); };
  const handleDeletePeriod = async (id: string) => { await supabase.from('company_periods').delete().eq('id', id); fetchData(); };
  
  const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => ( <button onClick={() => setActiveTab(id)} className={`w-full py-4 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === id ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}> <Icon className="w-4 h-4" /> <span className="hidden sm:inline">{label}</span> </button> );

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 relative">
      <div className="p-6 w-full max-w-7xl mx-auto pb-24">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* TASTO TORNA AL PLANNING */}
            <Link to="/admin" className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-colors shadow-sm font-bold text-sm flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Torna al Planning
            </Link>
            <div><h1 className="text-2xl font-bold text-slate-800">Impostazioni</h1><p className="text-slate-500 text-sm mt-1">Configura il tuo ristorante</p></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
          <div className="grid grid-cols-4 border-b border-slate-200 bg-white sticky top-0 z-10 shadow-sm">
            <TabButton id="staff" label="Staff" icon={Users} />
            <TabButton id="depts" label="Reparti & Ruoli" icon={Palette} />
            <TabButton id="shifts" label="Turni" icon={Clock} />
            <TabButton id="features" label="Funzionalità" icon={ShieldAlert} />
          </div>

          <div className="p-6 md:p-8 flex-1">
            
            {/* TAB STAFF */}
            {activeTab === 'staff' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200"><div><h3 className="font-bold text-slate-800 text-lg">Il tuo Team</h3><p className="text-slate-500 text-sm">{employees.length} collaboratori attivi</p></div><button onClick={() => setIsCreateEmpOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md flex items-center gap-2"><UserPlus className="w-5 h-5" /> Aggiungi Collaboratore</button></div>
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs"><tr><th className="p-4">Credenziali</th><th className="p-4">Collaboratore</th><th className="p-4 hidden md:table-cell">Dettagli</th><th className="p-4 hidden md:table-cell">Costo</th><th className="p-4 text-right">Azioni</th></tr></thead><tbody className="divide-y divide-slate-100">{employees.map(emp => (<tr key={emp.id} className="hover:bg-slate-50 bg-white"><td className="p-4"><div className="bg-slate-100 px-2 py-1 rounded border border-slate-200 font-mono text-xs text-slate-600 w-fit flex items-center gap-1"><User className="w-3 h-3"/> {emp.username}</div></td><td className="p-4"><div className="font-bold text-slate-800 text-base">{emp.first_name} {emp.last_name}</div><div className="flex items-center gap-2 mt-1"><span className={`px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200/60 uppercase tracking-wide ${departments.find(d => d.name === emp.departments?.name)?.color || 'bg-slate-100'}`}>{emp.departments?.name}</span>{emp.role_label && <span className="text-[10px] bg-slate-100 border px-1.5 py-0.5 rounded text-slate-500">{emp.role_label}</span>}</div></td><td className="p-4 hidden md:table-cell"><div className="text-slate-700 font-medium">{emp.contract_type || 'N/D'}</div><div className="text-slate-400 text-xs">{emp.contract_hours_weekly}h settimanali</div></td><td className="p-4 hidden md:table-cell"><div className="flex flex-col text-xs font-mono"><span className="text-emerald-600 font-bold">NET: € {emp.hourly_rate_net}</span><span className="text-slate-500">LOR: € {emp.hourly_rate}</span></div></td><td className="p-4 text-right"><div className="flex justify-end gap-1"><button onClick={() => handleResetEmpPassword(emp)} className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg"><KeyRound className="w-4 h-4"/></button><button onClick={() => { setViewingLogs(emp); fetchLogs(emp.id); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><ScrollText className="w-4 h-4"/></button><button onClick={() => setEditingEmp(emp)} className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-lg"><Pencil className="w-4 h-4"/></button><button onClick={() => handleDeleteEmployee(emp.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button></div></td></tr>))}</tbody></table></div>
              </div>
            )}

            {/* TAB REPARTI & RUOLI (AGGIORNATA) */}
            {activeTab === 'depts' && (
              <div className="space-y-8 animate-in fade-in">
                
                {/* Gestione Reparti */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200"><div><h3 className="font-bold text-slate-800 text-lg">Reparti</h3><p className="text-slate-500 text-sm">Organizza le aree di lavoro</p></div><button onClick={() => setIsCreateDeptOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md flex items-center gap-2"><LayoutGrid className="w-5 h-5" /> Aggiungi Reparto</button></div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{departments.map(dept => (<div key={dept.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-300 transition-all hover:shadow-md"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full ${dept.color} border-2 border-white shadow-sm flex items-center justify-center`}><span className="text-[10px] font-bold opacity-50">{dept.name.substring(0,2).toUpperCase()}</span></div><div><h4 className="font-bold text-slate-800">{dept.name}</h4><p className="text-[10px] text-slate-400 uppercase">{dept.color.replace('bg-', '')}</p></div></div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => setEditingDept(dept)} className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-lg"><Pencil className="w-4 h-4"/></button><button onClick={() => handleDeleteDepartment(dept.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button></div></div>))}</div>
                </div>

                {/* Gestione Ruoli (NUOVA SEZIONE) */}
                <div className="space-y-4 pt-6 border-t border-slate-200">
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Briefcase className="w-5 h-5 text-indigo-600"/> Ruoli & Sottoruoli</h3>
                  
                  {/* Form Aggiunta Ruolo */}
                  <form onSubmit={handleCreateRole} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 items-end shadow-sm">
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Ruolo</label>
                      <input 
                        value={newRoleName} onChange={e => setNewRoleName(e.target.value)} 
                        placeholder="Es. Sous Chef, Runner..." 
                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div className="w-full md:w-64">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reparto di Riferimento</label>
                      <select 
                        value={newRoleDept} onChange={e => setNewRoleDept(e.target.value)}
                        className="w-full p-2.5 border rounded-lg bg-white"
                      >
                        <option value="">Seleziona...</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <button type="submit" disabled={!newRoleName || !newRoleDept} className="w-full md:w-auto bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all">
                      Aggiungi Ruolo
                    </button>
                  </form>

                  {/* Lista Ruoli Esistenti */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {companyRoles.map(role => {
                      const dept = departments.find(d => d.id === role.department_id);
                      return (
                        <div key={role.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div>
                            <p className="font-bold text-sm text-slate-700">{role.name}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded uppercase ${dept?.color || 'bg-slate-200'}`}>{dept?.name || 'N/D'}</span>
                          </div>
                          <button onClick={() => handleDeleteRole(role.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB SHIFTS & FEATURES (Come prima) */}
            {activeTab === 'shifts' && (<div className="space-y-6 animate-in fade-in"><div className="flex justify-between items-center bg-indigo-50 p-4 rounded-xl border border-indigo-100"><div className="flex items-center gap-3"><div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600"><Clock className="w-6 h-6" /></div><div><h3 className="font-bold text-indigo-900 text-lg">Turni Predefiniti</h3><p className="text-indigo-700 text-sm">Blocchi rapidi</p></div></div><button onClick={() => setIsCreateTemplateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md flex items-center gap-2"><Plus className="w-5 h-5" /> Nuovo Template</button></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{templates.map(t => (<div key={t.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center group hover:border-indigo-300 transition-all hover:shadow-md"><div><h4 className="font-bold text-slate-800">{t.name}</h4><p className="text-slate-500 font-mono text-xs mt-1 bg-slate-100 w-fit px-2 py-0.5 rounded flex items-center gap-1"><Clock className="w-3 h-3"/> {t.start_time.slice(0,5)} - {t.end_time.slice(0,5)}</p></div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => setEditingTemplate(t)} className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-lg"><Pencil className="w-4 h-4"/></button><button onClick={() => handleDeleteTemplate(t.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button></div></div>))}</div></div>)}
            {activeTab === 'features' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
                  <h3 className="font-bold text-slate-800 mb-6 text-lg flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-indigo-600"/> Moduli & Permessi</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${settings.enable_time_clock ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}><Clock className="w-6 h-6"/></div><div><p className="font-bold text-slate-800">Sistema Timbrature</p><p className="text-xs text-slate-500">Permetti allo staff di registrare Entrata/Uscita</p></div></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={settings.enable_time_clock} onChange={e => setSettings({...settings, enable_time_clock: e.target.checked})} /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div></label></div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${settings.enable_chat ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}><MessageSquare className="w-6 h-6"/></div><div><p className="font-bold text-slate-800">Chat Interna</p><p className="text-xs text-slate-500">Messaggistica diretta tra collaboratori</p></div></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={settings.enable_chat} onChange={e => setSettings({...settings, enable_chat: e.target.checked})} /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div></label></div>
                    <div className="p-4 bg-white border border-slate-200 rounded-xl mt-4"><h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Orari Operativi</h4><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 mb-1">Apertura</label><input type="time" value={settings.opening_time} onChange={e => setSettings({...settings, opening_time: e.target.value})} className="w-full p-2 border rounded-lg" /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Chiusura</label><input type="time" value={settings.closing_time} onChange={e => setSettings({...settings, closing_time: e.target.value})} className="w-full p-2 border rounded-lg" /></div></div></div>
                  </div>
                  <button onClick={handleSaveSettings} className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 shadow-lg mt-6">Salva Configurazione</button>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[600px]"><h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><ScrollText className="w-5 h-5 text-indigo-600"/> Audit Log Chat</h3><div className="bg-indigo-50 p-3 rounded-lg text-xs text-indigo-700 mb-4 border border-indigo-100">Monitoraggio sicurezza.</div><div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs sticky top-0"><tr><th className="p-3">Data</th><th className="p-3">Mittente</th><th className="p-3">Destinatario</th><th className="p-3">Messaggio</th></tr></thead><tbody className="divide-y divide-slate-100">{chatLogs.map(log => (<tr key={log.id} className="hover:bg-slate-50"><td className="p-3 text-xs text-slate-400 font-mono whitespace-nowrap">{format(parseISO(log.created_at), 'dd/MM HH:mm', {locale:it})}</td><td className="p-3 font-bold text-slate-700">{log.sender?.first_name}</td><td className="p-3 text-slate-600">{log.receiver?.first_name}</td><td className="p-3 text-slate-500 italic truncate max-w-[150px]" title={log.content}>{log.content}</td></tr>))}</tbody></table></div></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODALE SUCCESSO */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center"><CheckCircle2 className="w-10 h-10" /></div>
            <div className="text-center"><h3 className="text-xl font-bold text-slate-800">Salvato!</h3><p className="text-slate-500 text-sm">Le impostazioni sono state aggiornate.</p></div>
          </div>
        </div>
      )}

      {/* --- MODALE CREATE/EDIT EMPLOYEE CON ETICHETTE E RUOLI DINAMICI --- */}
      {(isCreateEmpOpen || editingEmp) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-indigo-600 p-6 border-b flex justify-between items-center text-white">
              <h3 className="font-bold text-xl flex items-center gap-2">
                {isCreateEmpOpen ? <><UserPlus className="w-6 h-6"/> Nuova Assunzione</> : <><Pencil className="w-5 h-5"/> Modifica {editingEmp?.first_name}</>}
              </h3>
              <button onClick={() => { setIsCreateEmpOpen(false); setEditingEmp(null); }}><X/></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="emp-form" onSubmit={isCreateEmpOpen ? handleCreateEmployee : handleUpdateEmployee} className="space-y-6">
                
                {isCreateEmpOpen && (
                  <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg text-xs text-indigo-700 mb-4">
                    <p className="font-bold mb-1">ℹ️ Credenziali Automatiche</p>
                    <p>User: <b>nome.cognome</b> | Pass: <b>nome.cognome</b></p>
                  </div>
                )}

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 pb-2">Dati Personali</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome</label>
                      <input name="first_name" required className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" placeholder="Es. Mario" defaultValue={editingEmp?.first_name} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cognome</label>
                      <input name="last_name" required className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" placeholder="Es. Rossi" defaultValue={editingEmp?.last_name} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data di Nascita</label>
                    <input name="birth_date" type="date" required className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" defaultValue={editingEmp?.birth_date} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 pb-2">Ruolo & Contratto</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Select Reparto */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Reparto</label>
                      <select 
                        name="department_id" 
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                        defaultValue={editingEmp?.department_id}
                        onChange={(e) => {
                          // Se stiamo editando, aggiorna lo stato locale per far filtrare i ruoli
                          if(editingEmp) setEditingEmp({...editingEmp, department_id: e.target.value});
                        }}
                      >
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    
                    {/* Select Ruolo (Filtrata) */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ruolo</label>
                      <select 
                        name="role_label" 
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                        defaultValue={editingEmp?.role_label}
                      >
                        <option value="">Seleziona...</option>
                        {companyRoles
                          .filter(r => r.department_id === (editingEmp ? editingEmp.department_id : departments[0]?.id)) // Filtra per reparto selezionato
                          .map(r => <option key={r.id} value={r.name}>{r.name}</option>)
                        }
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipologia Contratto</label>
                    <select name="contract_type" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white" defaultValue={editingEmp?.contract_type}>
                      {CONTRACT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ore/Set</label><input name="hours" type="number" defaultValue={editingEmp?.contract_hours_weekly || 40} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" /></div>
                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">€ Netto/h</label><input name="rate_net" type="number" step="0.5" defaultValue={editingEmp?.hourly_rate_net || 0} className="w-full p-2.5 border border-emerald-200 rounded-lg text-sm" /></div>
                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">€ Lordo/h</label><input name="rate_gross" type="number" step="0.5" defaultValue={editingEmp?.hourly_rate || 0} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" /></div>
                  </div>
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-3 bg-slate-50">
              <button onClick={() => { setIsCreateEmpOpen(false); setEditingEmp(null); }} className="flex-1 py-3 text-slate-600 font-bold hover:bg-white rounded-lg border border-transparent hover:border-slate-200">Annulla</button>
              <button type="submit" form="emp-form" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md">{isCreateEmpOpen ? 'Assumi' : 'Salva'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ... (Altri modali Depts, Template, Logs, ecc. INVARIATI dal codice precedente) ... */}
      {isCreateDeptOpen && (<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in"><div className="bg-white rounded-2xl w-full max-w-md overflow-hidden"><div className="bg-indigo-600 p-6 flex justify-between items-center text-white"><h3 className="font-bold text-xl">Nuovo Reparto</h3><button onClick={() => setIsCreateDeptOpen(false)}><X/></button></div><div className="p-6"><form id="create-dept" onSubmit={handleCreateDepartment} className="space-y-4"><input name="name" placeholder="Nome Reparto" className="w-full p-3 border rounded-lg" required /><div className="flex flex-wrap gap-2">{COLOR_PALETTE.map(c=><button key={c} type="button" onClick={() => setNewDeptColor(c)} className={`w-8 h-8 rounded-full border-2 ${c} ${newDeptColor===c?'border-indigo-600':'border-transparent'}`} />)}</div></form></div><div className="p-4 border-t flex gap-3"><button onClick={() => setIsCreateDeptOpen(false)} className="flex-1 py-3 text-slate-600 font-bold border rounded-lg">Annulla</button><button type="submit" form="create-dept" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-lg">Crea</button></div></div></div>)}
      {/* ... (eccetera per gli altri modali) ... */}
    </div>
  );
}