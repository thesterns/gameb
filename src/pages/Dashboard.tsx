import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { LogOut, Plus, BookOpen, Target, Gamepad2, Play, ThemeToggle, Mail } from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [quizzes, setQuizzes] = useState([]);

  useEffect(() => {
    let mounted = true;

    const checkUser = async () => {
      // בדיקה ראשונית של ה-session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // אם אין session, נחכה עוד חצי שנייה ליתר ביטחון (בשביל החזרה מגוגל)
        await new Promise(resolve => setTimeout(resolve, 800));
        const { data: { session: retrySession } } = await supabase.auth.getSession();
        
        if (!retrySession && mounted) {
          navigate("/login");
          return;
        }
        if (retrySession) setUserName(retrySession.user.user_metadata?.full_name || "משתמש");
      } else {
        setUserName(session.user.user_metadata?.full_name || "משתמש");
      }

      if (mounted) setIsLoading(false);
    };

    checkUser();

    // האזנה לשינויי סטטוס (חשוב מאוד לכניסה ראשונה)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session && mounted) {
        setUserName(session.user.user_metadata?.full_name || "משתמש");
        setIsLoading(false);
      }
      if (event === "SIGNED_OUT" && mounted) {
        navigate("/login");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">מעדכן נתונים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-right" dir="rtl">
      {/* כאן נכנס שאר תוכן ה-Dashboard המקורי שלך */}
      <header className="border-b border-border bg-card p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">zgame</h1>
          <div className="flex items-center gap-4">
            <span>שלום, {userName}</span>
            <Button variant="ghost" onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}>
              <LogOut className="ml-2 h-4 w-4" /> יציאה
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-6">
        <h2 className="text-3xl font-bold mb-6">ברוך הבא לדשבורד</h2>
        {/* שאר הכפתורים והחידונים שלך כאן */}
      </main>
    </div>
  );
};

export default Dashboard;
