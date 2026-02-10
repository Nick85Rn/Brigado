import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { X, Bell, Trash2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  is_read: boolean;
  created_at: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onRead: () => void;
}

export default function EmployeeNotifications({ isOpen, onClose, userId, onRead }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchNotifications();
    }
  }, [isOpen, userId]);

  async function fetchNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    setNotifications(data as any || []);
    
    if (data && data.length > 0) {
      // Segna come lette
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      
      onRead(); // Aggiorna il badge rosso
    }
  }

  async function clearAll() {
    await supabase.from('notifications').delete().eq('user_id', userId);
    setNotifications([]);
  }

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose}></div>}

      <div className={`
        fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] bg-white shadow-2xl transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="bg-white p-5 flex justify-between items-center border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-lg text-gray-800">Notifiche</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto h-[calc(100vh-140px)]">
          {notifications.length === 0 ? (
            <div className="text-center py-20 opacity-50">
              <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Nessuna nuova notifica</p>
            </div>
          ) : (
            notifications.map(notif => (
              <div key={notif.id} className={`
                p-4 rounded-xl border shadow-sm relative overflow-hidden
                ${notif.type === 'success' ? 'bg-white border-green-200' : 'bg-white border-red-200'}
              `}>
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${notif.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <p className="text-gray-800 font-medium text-sm pr-6">{notif.message}</p>
                <p className="text-xs text-gray-400 mt-2 text-right">
                  {formatDistanceToNow(parseISO(notif.created_at), { addSuffix: true, locale: it })}
                </p>
              </div>
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
            <button 
              onClick={clearAll}
              className="w-full py-3 flex items-center justify-center gap-2 text-gray-500 hover:text-red-500 text-sm font-bold transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Svuota tutto
            </button>
          </div>
        )}
      </div>
    </>
  );
}