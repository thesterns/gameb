import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Gamepad2, LogOut, BookOpen } from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      setUserName(session.user.user_metadata?.full_name || "משתמש");
    };
    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("התנתקת בהצלחה");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold text-gradient">QuizMaster</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">שלום, {userName}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="!size-4" />
              יציאה
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-3xl font-heading font-bold mb-8">הדשבורד שלי</h2>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <button
              onClick={() => navigate("/quiz/new")}
              className="bg-card rounded-2xl p-6 shadow-card hover:shadow-elevated transition-all text-center group"
            >
              <div className="w-14 h-14 gradient-primary rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Plus className="!size-7 text-primary-foreground" />
              </div>
              <h3 className="font-heading font-bold text-lg">צור חידון</h3>
              <p className="text-muted-foreground text-sm mt-1">צרו חידון חדש מאפס</p>
            </button>

            <button
              onClick={() => navigate("/my-quizzes")}
              className="bg-card rounded-2xl p-6 shadow-card hover:shadow-elevated transition-all text-center group"
            >
              <div className="w-14 h-14 gradient-fun rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <BookOpen className="!size-7 text-accent-foreground" />
              </div>
              <h3 className="font-heading font-bold text-lg">החידונים שלי</h3>
              <p className="text-muted-foreground text-sm mt-1">ניהול ועריכת חידונים</p>
            </button>

            <button
              onClick={() => navigate("/join")}
              className="bg-card rounded-2xl p-6 shadow-card hover:shadow-elevated transition-all text-center group"
            >
              <div className="w-14 h-14 gradient-secondary rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Gamepad2 className="!size-7 text-secondary-foreground" />
              </div>
              <h3 className="font-heading font-bold text-lg">הצטרף למשחק</h3>
              <p className="text-muted-foreground text-sm mt-1">הכניסו קוד משחק</p>
            </button>
          </div>

          {/* Recent quizzes placeholder */}
          <div className="bg-card rounded-2xl p-8 shadow-card text-center">
            <BookOpen className="!size-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-heading font-bold text-xl mb-2">אין חידונים עדיין</h3>
            <p className="text-muted-foreground mb-4">צרו את החידון הראשון שלכם!</p>
            <Button variant="hero" onClick={() => navigate("/quiz/new")}>
              <Plus className="!size-5" />
              צור חידון חדש
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Dashboard;
