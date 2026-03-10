import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { 
  LogOut, Plus, BookOpen, Target, Gamepad2, Play, 
  LayoutDashboard, Trophy, Settings, HelpCircle 
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { toast } from "sonner";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initializeDashboard = async () => {
      // השהייה קלה כדי לוודא ש-Supabase עיבד את ה-Session מה-URL (במקרה של כניסה מגוגל)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        if (mounted) navigate("/login");
        return;
      }

      if (mounted) {
        setUserName(session.user.user_metadata?.full_name || "משתמש");
        
        // שליפת נתונים במקביל מה-DB החדש
        try {
          const [quizzesRes, challengesRes] = await Promise.all([
            supabase
              .from("quizzes")
              .select("id, title, description, created_at")
              .eq("user_id", session.user.id)
              .order("created_at", { ascending: false }),
            supabase
              .from("challenges")
              .select("id, title, description, created_at")
              .eq("user_id", session.user.id)
              .order("created_at", { ascending: false })
          ]);

          if (quizzesRes.error) throw quizzesRes.error;
          if (challengesRes.error) throw challengesRes.error;

          setQuizzes(quizzesRes.data || []);
          setChallenges(challengesRes.data || []);
        } catch (error: any) {
          console.error("Error fetching data:", error.message);
          toast.error("שגיאה בטעינת הנתונים מהשרת");
        } finally {
          setLoading(false);
        }
      }
    };

    initializeDashboard();

    return () => { mounted = false; };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("התנתקת בהצלחה");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-lg font-medium">מעדכן נתונים מהשרת...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-right pb-12" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="size-6 text-primary" />
            <h1 className="text-2xl font-bold text-gradient">zgame</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">שלום, {userName}</span>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive hover:bg-destructive/10">
              <LogOut className="ml-2 h-4 w-4" /> יציאה
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-heading font-bold text-foreground">הדשבורד שלי</h2>
            <Button onClick={() => navigate("/join")} variant="outline" className="gap-2">
              <Gamepad2 className="size-4" /> הצטרף למשחק
            </Button>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center text-center group hover:border-primary/50 transition-colors">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus className="size-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">חידון חדש</h3>
              <p className="text-muted-foreground text-sm mb-6">צור שאלות אמריקאיות ונהל משחק רב משתתפים</p>
              <Button onClick={() => navigate("/quiz/new")} className="w-full">התחל ליצור</Button>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center text-center group hover:border-accent/50 transition-colors">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Target className="size-8 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">אתגר חדש</h3>
              <p className="text-muted-foreground text-sm mb-6">בנה אתגר קבוצתי עם משימות וממדים מותאמים</p>
              <Button onClick={() => navigate("/challenge/new")} variant="secondary" className="w-full">צור אתגר</Button>
            </div>
          </div>

          {/* Quizzes List */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <BookOpen className="size-6 text-primary" /> החידונים שלי
              </h3>
              <Button variant="link" onClick={() => navigate("/my-quizzes")}>הצג הכל</Button>
            </div>
            {quizzes.length === 0 ? (
              <div className="bg-card/50 border-2 border-dashed border-border rounded-2xl p-10 text-center">
                <p className="text-muted-foreground mb-4">עדיין לא יצרת אף חידון</p>
                <Button variant="outline" onClick={() => navigate("/quiz/new")}>ליצירת החידון הראשון</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {quizzes.map((quiz) => (
                  <motion.div key={quiz.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
                    <h4 className="font-bold text-lg mb-1 truncate">{quiz.title}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">{quiz.description || "אין תיאור"}</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => navigate(`/game/${quiz.id}/lobby`)}>
                        <Play className="size-3.5 ml-1.5" /> התחל
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/quiz/edit/${quiz.id}`)}>
                        ערוך
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          {/* Challenges List */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <Trophy className="size-6 text-accent-foreground" /> האתגרים שלי
              </h3>
              <Button variant="link" onClick={() => navigate("/my-challenges")}>הצג הכל</Button>
            </div>
            {challenges.length === 0 ? (
              <div className="bg-card/50 border-2 border-dashed border-border rounded-2xl p-10 text-center">
                <p className="text-muted-foreground mb-4">אין אתגרים פעילים כרגע</p>
                <Button variant="outline" onClick={() => navigate("/challenge/new")}>צור אתגר חדש</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {challenges.map((challenge) => (
                  <motion.div key={challenge.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
                    <h4 className="font-bold text-lg mb-1 truncate">{challenge.title}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">{challenge.description || "אין תיאור"}</p>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(`/challenge/${challenge.id}`)}>
                      צפה בפרטים
                    </Button>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </motion.div>
      </main>
    </div>
  );
};

export default Dashboard;
