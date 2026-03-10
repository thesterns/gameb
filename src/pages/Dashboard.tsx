import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { LogOut, Plus, BookOpen, Target, Gamepad2, Play, Mail } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      // השהיית ביטחון כדי לתת ל-Supabase לעבד את ה-Token מה-URL
      await new Promise(resolve => setTimeout(resolve, 1000));

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session && mounted) {
        console.log("No session found, redirecting to login");
        navigate("/login");
        return;
      }

      if (session && mounted) {
        setUserName(session.user.user_metadata?.full_name || "משתמש");
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => { mounted = false; };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("התנתקת בהצלחה");
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-lg font-medium">מעבד נתונים מגוגל...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-right" dir="rtl">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gradient">zgame</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">שלום, {userName}</span>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="ml-2 h-4 w-4" /> יציאה
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-3xl font-bold mb-8">הדשבורד שלי</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <Button size="lg" className="h-32 text-xl" onClick={() => navigate("/quiz/new")}>
                <Plus className="ml-2 h-6 w-6" /> צור חידון חדש
             </Button>
             <Button size="lg" variant="outline" className="h-32 text-xl" onClick={() => navigate("/my-quizzes")}>
                <BookOpen className="ml-2 h-6 w-6" /> החידונים שלי
             </Button>
          </div>
          
          {/* כאן תוכל להחזיר את שאר כפתורי האתגרים והחידונים שלך מהקוד הקודם */}
        </motion.div>
      </main>
    </div>
  );
};

export default Dashboard;
