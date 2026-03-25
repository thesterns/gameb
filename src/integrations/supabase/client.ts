import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// אנחנו משתמשים בשמות המדויקים שמוגדרים ב-Vercel
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
// בחלק מהפרויקטים (כולל Lovable) המפתח נקרא PUBLISHABLE_KEY במקום ANON_KEY
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// השורה הזו תציל אותך - היא תדפיס הודעה אדומה אם המפתח לא הגיע מ-Vercel
if (!SUPABASE_ANON_KEY) {
  console.error(
    "Critical Error: Supabase key is missing! Expected VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY."
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});
