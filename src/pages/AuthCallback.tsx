import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = async () => {
      // מחכה שה-Session יתבסס
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (session) {
        navigate("/dashboard", { replace: true });
      } else {
        // אם אחרי 2 שניות עדיין אין כלום, כנראה שיש שגיאה
        const timeout = setTimeout(() => {
          navigate("/login", { replace: true });
        }, 2000);
        return () => clearTimeout(timeout);
      }
    };

    handleAuth();

    // מאזין לאירוע כניסה
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        navigate("/dashboard", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background" dir="rtl">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
      <p className="text-lg font-medium">משלים התחברות מאובטחת...</p>
    </div>
  );
};

export default AuthCallback;
