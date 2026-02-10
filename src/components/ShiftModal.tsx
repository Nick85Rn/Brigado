import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { X, Clock, Trash2, Check, User } from 'lucide-react';

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (startTime: string, endTime: string, notes: string) => void;
  onDelete?: () => void;
  employeeName: string;
  date: Date;
  initialData?: { startTime: string; endTime: string; notes: string };
}

export default function ShiftModal({ isOpen, onClose, onSave, onDelete, employeeName, date, initialData }: ShiftModalProps) {
  const [activeTab, setActiveTab] = useState<'templates' | 'manual'>('templates');
  const [startTime, setStartTime] = useState(initialData?.startTime || '09:00');
  const [endTime, setEndTime] = useState(initialData?.endTime || '15:00');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [templates, setTemplates] = useState<any[]>([]);

  // Carica i template (Pranzo, Cena, ecc.)
  useEffect(() => {
    async function loadTemplates() {
      const { data } = await supabase.from('shift_templates').select('*').order('start_time');
      if (data) setTemplates(data);
    }
    if (isOpen) {
      loadTemplates();
      // Se stiamo modificando un turno esistente, andiamo direttamente al manuale
      if (initialData?.notes) {
        setStartTime(initialData.startTime);
        setEndTime(initialData.endTime);
        setNotes(initialData.notes);
        setActiveTab('manual'); 
      } else {
        // Se è nuovo, reset
        setActiveTab('templates');
      }
    }
  }, [isOpen, initialData]);

  const handleTemplateClick = (t: any) => {
    setStartTime(t.start_time.slice(0, 5));
    setEndTime(t.end_time.slice(0, 5));
    setNotes(t.name);
    // Salvataggio automatico o switch a manuale per conferma?
    // Facciamo switch a manuale per conferma visiva veloce
    setActiveTab('manual');
  };

  const handleSave = () => {
    onSave(startTime, endTime, notes);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
        
        {/* Header */}
        <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600"/> {employeeName}
            </h3>
            <p className="text-xs text-slate-500 capitalize">
              {date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X className="w-5 h-5"/></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('templates')} 
            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'templates' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            ⚡ Rapido
          </button>
          <button 
            onClick={() => setActiveTab('manual')} 
            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'manual' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            🛠️ Manuale
          </button>
        </div>

        <div className="p-6">
          
          {/* VISTA TEMPLATE RAPIDI */}
          {activeTab === 'templates' && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Scegli un turno predefinito:</p>
              <div className="grid grid-cols-2 gap-3">
                {templates.map(t => (
                  <button 
                    key={t.id}
                    onClick={() => handleTemplateClick(t)}
                    className="flex flex-col items-center justify-center p-4 border border-slate-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 hover:shadow-md transition-all group"
                  >
                    <span className="font-bold text-slate-700 group-hover:text-indigo-700">{t.name}</span>
                    <span className="text-xs text-slate-400 mt-1 bg-slate-100 px-2 py-0.5 rounded group-hover:bg-white">{t.start_time.slice(0,5)} - {t.end_time.slice(0,5)}</span>
                  </button>
                ))}
                
                {/* Bottone "Altro" che porta al manuale */}
                <button 
                  onClick={() => setActiveTab('manual')}
                  className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-300 rounded-xl hover:border-slate-500 hover:bg-slate-50 transition-all text-slate-400"
                >
                  <Clock className="w-5 h-5 mb-1"/>
                  <span className="text-xs font-bold">Personalizzato</span>
                </button>
              </div>
              {templates.length === 0 && <p className="text-sm text-slate-500 italic text-center py-4">Nessun template configurato nelle impostazioni.</p>}
            </div>
          )}

          {/* VISTA MANUALE */}
          {activeTab === 'manual' && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Inizio</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg text-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fine</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg text-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Etichetta Turno (Facoltativo)</label>
                <input 
                  type="text" 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="Es. Straordinario, Evento..." 
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
              </div>

              <div className="pt-4 flex gap-3">
                {onDelete && (
                  <button 
                    onClick={() => { if(confirm("Eliminare turno?")) { onDelete(); onClose(); } }} 
                    className="p-3 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    title="Elimina"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button 
                  onClick={handleSave} 
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" /> Conferma Turno
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}