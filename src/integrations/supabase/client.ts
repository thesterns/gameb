import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// וודא שהשמות כאן תואמים בדיוק למה שכתוב ב-Vercel
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// השורה הזו תדפיס לך לקונסול אם המפתח בכלל הגיע מהשרת
if (!SUPABASE_ANON_KEY) {
  console.error("Critical Error: SUPABASE_ANON_KEY is undefined! Check Vercel Env Vars.");
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});
