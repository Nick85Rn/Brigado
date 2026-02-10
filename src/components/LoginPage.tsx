import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { ChefHat, Lock, User, ArrowRight, KeyRound, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'login' | 'reset'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Dati Form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [tempUser, setTempUser] = useState<any>(null);

  // --- CHECK SESSIONE ESISTENTE (NUOVO) ---
  useEffect(() => {
    const storedUser = localStorage.getItem('brigade_user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      // Redirect immediato se già loggato
      if (user.role === 'admin') navigate('/admin');
      else navigate('/staff');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('employees')
        .select('*')
        .ilike('username', username) 
        .single();

      if (fetchError || !data) throw new Error('Utente non trovato');
      if (data.password !== password) throw new Error('Password errata');

      if (data.needs_password_reset) {
        setTempUser(data);
        setStep('reset');
        setLoading(false);
        return;
      }

      finalizeLogin(data);

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError("Le password non coincidono"); return; }
    if (newPassword.length < 4) { setError("La password deve avere almeno 4 caratteri"); return; }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.from('employees').update({ password: newPassword, needs_password_reset: false }).eq('id', tempUser.id);
      if (updateError) throw updateError;
      const updatedUser = { ...tempUser, password: newPassword, needs_password_reset: false };
      finalizeLogin(updatedUser);
    } catch (err: any) {
      setError("Errore reset: " + err.message);
      setLoading(false);
    }
  };

  const finalizeLogin = (user: any) => {
    localStorage.setItem('brigade_user', JSON.stringify(user));
    if (user.role === 'admin') navigate('/admin');
    else navigate('/staff');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-600 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="bg-white/10 p-4 rounded-3xl w-fit mx-auto mb-6 backdrop-blur-md border border-white/10 shadow-2xl">
            <ChefHat className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white font-serif tracking-tight mb-2">BRIGADE</h1>
          <p className="text-slate-400 text-sm uppercase tracking-widest font-medium">Restaurant OS</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
          {step === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <h2 className="text-xl font-bold text-center mb-6">Accedi</h2>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Utente</label>
                <div className="relative">
                  <User className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="nome.cognome" className="w-full bg-slate-800/50 border border-slate-700 text-white p-3 pl-10 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600" autoFocus />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                  <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-800/50 border border-slate-700 text-white p-3 pl-10 pr-10 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3.5 text-slate-500 hover:text-white">{showPass ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</button>
                </div>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex items-center gap-2 text-red-200 text-sm animate-in slide-in-from-top-2"><AlertCircle className="w-4 h-4 shrink-0"/> {error}</div>}
              <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20">{loading ? 'Verifica...' : 'Entra'} <ArrowRight className="w-5 h-5"/></button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-400 border border-amber-500/30"><KeyRound className="w-8 h-8" /></div>
                <h2 className="text-xl font-bold text-white">Primo Accesso</h2>
                <p className="text-slate-400 text-sm mt-2">Ciao {tempUser?.first_name}, imposta la tua password.</p>
              </div>
              <div className="space-y-3">
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nuova Password" className="w-full bg-slate-800/50 border border-slate-700 text-white p-3 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"/>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Conferma Password" className="w-full bg-slate-800/50 border border-slate-700 text-white p-3 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"/>
              </div>
              {error && <p className="text-red-400 text-sm text-center font-bold">{error}</p>}
              <button disabled={loading} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 shadow-lg">{loading ? 'Salvataggio...' : 'Imposta e Accedi'}</button>
            </form>
          )}
        </div>
        <p className="text-center text-slate-600 text-xs mt-8">v2.1.1 • Powered by Pellicioni Nicola</p>
      </div>
    </div>
  );
}