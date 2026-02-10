import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './supabase';

// --- COMPONENTI ---
import LoginPage from './components/LoginPage';
import WeeklyScheduler from './components/WeeklyScheduler';
import EmployeeDashboard from './components/EmployeeDashboard';
import AdminRequestsPanel from './components/AdminRequestsPanel';
import SettingsPage from './components/SettingsPage'; 
import CostDashboard from './components/CostDashboard'; 
import LeavesPage from './components/LeavesPage'; // <--- NUOVO IMPORT

// --- ICONE ---
import { 
  ChefHat, Smartphone, LayoutGrid, Bell, Settings, BarChart3, CalendarDays, LogOut, Palmtree 
} from 'lucide-react';

// ... (ProtectedRoute rimane UGUALE a prima) ...
const ProtectedRoute = ({ children, allowedRole }: { children: any, allowedRole?: 'admin' | 'staff' }) => {
  const userStr = localStorage.getItem('brigade_user');
  if (!userStr) return <Navigate to="/" replace />;
  const user = JSON.parse(userStr);
  if (allowedRole && user.role !== allowedRole && user.role !== 'admin') { 
    return <Navigate to={user.role === 'admin' ? '/admin' : '/staff'} replace />;
  }
  return children;
};

// ============================================================================
// ADMIN SHELL AGGIORNATA CON LINK FERIE
// ============================================================================
const AdminShell = ({ children }: { children: React.ReactNode }) => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    checkPendingRequests();
    const interval = setInterval(checkPendingRequests, 30000); 
    return () => clearInterval(interval);
  }, [isPanelOpen]); 

  async function checkPendingRequests() {
    const { count } = await supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    setPendingCount(count || 0);
  }

  const handleLogout = () => { localStorage.removeItem('brigade_user'); navigate('/'); };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shadow-sm z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 p-1.5 rounded-lg shadow-sm"><ChefHat className="w-6 h-6 text-white" /></div>
          <div className="leading-none hidden md:block"><h1 className="text-xl font-bold text-slate-900 tracking-tight font-serif">BRIGADE</h1><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 inline-block">Restaurant OS</span></div>
        </div>
        
        {/* NAVIGAZIONE CENTRALE ADMIN */}
        <div className="hidden md:flex bg-slate-100 p-1 rounded-lg border border-slate-200">
           <Link to="/admin" className={`px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${location.pathname === '/admin' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
             <CalendarDays className="w-4 h-4"/> Planning
           </Link>
           {/* NUOVO LINK FERIE */}
           <Link to="/admin/leaves" className={`px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${location.pathname === '/admin/leaves' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'} relative`}>
             <Palmtree className="w-4 h-4"/> Ferie
             {pendingCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
           </Link>
           <Link to="/admin/costs" className={`px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${location.pathname === '/admin/costs' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
             <BarChart3 className="w-4 h-4"/> Costi
           </Link>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
           <Link to="/staff" className="hidden lg:flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors"><Smartphone className="w-4 h-4" /> App Staff</Link>
           <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>
           {/* Il campanellino ora apre solo le notifiche veloci, ma la gestione vera è nella pagina Ferie */}
           <button onClick={() => setIsPanelOpen(true)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors relative group" title="Notifiche Staff"><Bell className="w-5 h-5" />{pendingCount > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}</button>
           <Link to="/admin/settings" className={`p-2 rounded-full transition-colors ${location.pathname === '/admin/settings' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:text-slate-700'}`} title="Impostazioni"><Settings className="w-5 h-5" /></Link>
           <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 rounded-full transition-colors" title="Esci"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden flex flex-col w-full max-w-[1920px] mx-auto">{children}</main>
      <AdminRequestsPanel isOpen={isPanelOpen} onClose={() => { setIsPanelOpen(false); checkPendingRequests(); }} />
    </div>
  );
};

// ============================================================================
// ROUTER
// ============================================================================
function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      
      {/* Rotte Admin */}
      <Route path="/admin" element={<ProtectedRoute allowedRole="admin"><AdminShell><WeeklyScheduler /></AdminShell></ProtectedRoute>} />
      <Route path="/admin/costs" element={<ProtectedRoute allowedRole="admin"><AdminShell><CostDashboard /></AdminShell></ProtectedRoute>} />
      <Route path="/admin/leaves" element={<ProtectedRoute allowedRole="admin"><AdminShell><LeavesPage /></AdminShell></ProtectedRoute>} /> {/* NUOVA ROTTA */}
      <Route path="/admin/settings" element={<ProtectedRoute allowedRole="admin"><AdminShell><SettingsPage /></AdminShell></ProtectedRoute>} />
      
      {/* Rotte Staff */}
      <Route path="/staff" element={<ProtectedRoute><EmployeeDashboard /></ProtectedRoute>} />
    </Routes>
  );
}

export default App;