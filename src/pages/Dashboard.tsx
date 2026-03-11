import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { 
  LogOut, PlusCircle, BookOpen, Target, Gamepad2, Play, 
  LayoutDashboard, Trophy, Edit
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
      // השהיית סנכרון עבור התחברות חיצונית
      await new Promise(resolve => setTimeout(resolve, 1000));
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        if (mounted) navigate("/login");
        return;
      }

      if (mounted) {
        setUserName(session.user.user_metadata?.full_name || "משתמש");
        
        try {
          const [quizzesRes, challengesRes] = await Promise.all([
            supabase
              .from("quizzes")
              .select("id, title, description, created_at")
              .eq("user_id", session.user.id)
              .order("created_at", { ascending: false })
              .limit(6),
            supabase
              .from("challenges")
              .select("id, title, description, created_at")
              .eq("user_id", session.user.id)
              .order("created_at", { ascending: false })
              .limit(6)
          ]);

          if (quizzesRes.error) throw quizzesRes.error;
          if (challengesRes.error) throw challengesRes.error;

          setQuizzes(quizzesRes.data || []);
          setChallenges(challengesRes.data || []);
        } catch (error: any) {
          console.error("Error loading data:", error.message);
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

  // פונקציה משותפת ליצירת סשן חדש (חידון או אתגר)
  const startNewGame = async (id: string, type: 'quiz' | 'challenge') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const joinCode = String(Math.floor(10000 + Math.random() * 90000));
      
      const insertData: any = {
        host_user_id: user.id,
        join_code: joinCode,
        status: 'lobby'
      };

      if (type === 'quiz') insertData.quiz_id = id;
      else insertData.challenge_id = id;

      const { data: session, error } = await supabase
        .from("game_sessions")
        .insert(insertData)
        .select()
        .single();

      if (error || !session) throw error;

      navigate(`/game/${session.id}/lobby`);
    } catch (error) {
      console.error("Start game error:", error);
      toast.error("שגיאה בהפעלת המשחק");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-lg font-medium">טוען נתונים...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-right pb-12" dir="rtl">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="size-6 text-primary" />
            <h1 className="text-2xl font-bold text-gradient">zgame</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">שלום, {userName}</span>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="ml-2 h-4 w-4" /> יציאה
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-3xl font-heading font-bold mb-8">הדשבורד שלי</h2>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => navigate("/quiz/new")} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all text-center group">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <PlusCircle className="size-6 text-primary" />
                </div>
                <h3 className="font-bold text-base">צור חידון</h3>
              </button>

              <button onClick={() => navigate("/my-quizzes")} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all text-center group">
                <div className="w-12 h-12 bg-answer-blue/10 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <BookOpen className="size-6 text-answer-blue" />
                </div>
                <h3 className="font-bold text-base">החידונים שלי</h3>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => navigate("/challenge/new")} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all text-center group">
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Target className="size-6 text-accent-foreground" />
                </div>
                <h3 className="font-bold text-base">צור אתגר</h3>
              </button>

              <button onClick={() => navigate("/my-challenges")} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all text-center group">
                <div className="w-12 h-12 bg-answer-green/10 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Trophy className="size-6 text-answer-green" />
                </div>
                <h3 className="font-bold text-base">האתגרים שלי</h3>
              </button>
            </div>
          </div>

          {/* Recent Lists */}
          <div className="space-y-12">
            {/* Quizzes Section */}
            <section>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-primary rounded-full" /> חידונים אחרונים
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quizzes.map(q => (
                  <div key={q.id} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:border-primary/30 transition-colors">
                    <h4 className="font-bold truncate mb-1">{q.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4 h-8">{q.description || "אין תיאור זמין"}</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => startNewGame(q.id, 'quiz')}>
                        <Play className="size-3.5 ml-1.5" /> התחל
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/quiz/edit/${q.id}`)}>ערוך</Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Challenges Section */}
            <section>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-answer-green rounded-full" /> אתגרים אחרונים
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {challenges.map(c => (
                  <div key={c.id} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:border-answer-green/30 transition-colors">
                    <h4 className="font-bold truncate mb-1">{c.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4 h-8">{c.description || "ללא תיאור"}</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => startNewGame(c.id, 'challenge')}>
                        <Play className="size-3.5 ml-1.5" /> התחל
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/challenge/edit/${c.id}`)}>ערוך</Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Dashboard;
