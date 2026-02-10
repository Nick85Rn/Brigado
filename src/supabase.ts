import { createClient } from '@supabase/supabase-js'

// TypeScript potrebbe lamentarsi se non è sicuro che le variabili esistano, 
// quindi aggiungiamo "as string" per forzarlo in questa fase di setup.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseKey)