import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { 
  Plus, Gamepad2, LogOut, BookOpen, Crown, Brain, 
  Users, Play, Target, Edit, Mail, LayoutDashboard 
} from "lucide-react";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import ChallengeHistoryDialog from "@/components/ChallengeHistoryDialog";
import ThemeToggle from "@/components/ThemeToggle";
import { toast } from "sonner";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  mode: string;
  created_at: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

const modeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  genius: { label: "גאון", icon: <Brain className="size-3.5" /> },
  king: { label: "מלך", icon: <Crown className="size-3.5" /> },
  tribe: { label: "שבט", icon: <Users className="size-3.5" /> },
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      // המתנה לסנכרון Auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (mounted) navigate("/login");
        return;
      }
      
      if (mounted) {
        setUserName(session.user.user_metadata?.full_name || "משתמש");

        // טעינת נתונים במקביל
        const [quizzesRes, challengesRes] = await Promise.all([
          supabase
            .from("quizzes")
            .select("id, title, description, mode, created_at")
            .order("created_at", { ascending: false })
            .limit(6),
          supabase
            .from("challenges")
            .select("id, title, description, created_at")
            .order("created_at", { ascending: false })
            .limit(6),
        ]);

        setQuizzes(quizzesRes.data || []);
        setChallenges(challengesRes.data || []);
        setLoading(false);
      }
    };

    checkAuth();
    return () => { mounted = false; };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("התנתקת בהצלחה");
    navigate("/");
  };

  const handleStartGame = async (id: string, type: 'quiz' | 'challenge') => {
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
      console.error("Error starting game:", error);
      toast.error("שגיאה בהפעלת המשחק");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
        <p className="text-muted-foreground">טוען נתונים...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="size-6 text-primary" />
            <h1 className="text-2xl font-heading font-bold text-gradient">zgame</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">שלום, {userName}</span>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="size-4" /> יציאה
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-3xl font-heading font-bold mb-8">הדשבורד שלי</h2>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => navigate("/quiz/new")} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all text-center group">
                <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Plus className="size-6 text-white" />
                </div>
                <h3 className="font-bold">צור חידון</h3>
              </button>
              <button onClick={() => navigate("/my-quizzes")} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all text-center group">
                <div className="w-12 h-12 gradient-fun rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <BookOpen className="size-6 text-white" />
                </div>
                <h3 className="font-bold">החידונים שלי</h3>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => navigate("/challenge/new")} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all text-center group">
                <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Target className="size-6 text-accent-foreground" />
                </div>
                <h3 className="font-bold">צור אתגר</h3>
              </button>
              <button onClick={() => navigate("/my-challenges")} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all text-center group">
                <div className="w-12 h-12 gradient-secondary rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Target className="size-6 text-white" />
                </div>
                <h3 className="font-bold">האתגרים שלי</h3>
              </button>
            </div>
          </div>

          <Button onClick={() => navigate("/join")} variant="outline" className="w-full sm:w-auto gap-2 mb-12">
            <Gamepad2 className="size-5 text-primary" /> הצטרף למשחק עם קוד
          </Button>

          {/* Quizzes List */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <div className="w-1.5 h-6 bg-primary rounded-full" /> חידונים אחרונים
              </h3>
              <Button variant="link" onClick={() => navigate("/my-quizzes")}>הצג הכל</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quizzes.map((quiz) => {
                const mode = modeLabels[quiz.mode] || modeLabels.genius;
                return (
                  <div key={quiz.id} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      {mode.icon} <span>{mode.label}</span>
                    </div>
                    <h4 className="font-bold truncate mb-1">{quiz.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 h-8 mb-4">{quiz.description || "אין תיאור"}</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => handleStartGame(quiz.id, 'quiz')}>
                        <Play className="size-3.5 ml-1.5" /> התחל
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/quiz/${quiz.id}/edit`)}>
                        <Edit className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Challenges List */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <div className="w-1.5 h-6 bg-green-500 rounded-full" /> אתגרים אחרונים
              </h3>
              <Button variant="link" onClick={() => navigate("/my-challenges")}>הצג הכל</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {challenges.map((c) => (
                <div key={c.id} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:border-green-500/50 transition-colors">
                  <h4 className="font-bold truncate mb-1">{c.title}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 h-8 mb-4">{c.description || "אין תיאור"}</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => handleStartGame(c.id, 'challenge')}>
                      <Play className="size-3.5 ml-1.5" /> התחל
                    </Button>
                    <ChallengeHistoryDialog challengeId={c.id} challengeTitle={c.title} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-8 mt-12 border-t border-border flex flex-col items-center gap-4">
        <ContactFormDialog trigger={
          <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <Mail className="size-4" /> צור קשר
          </button>
        } />
        <p className="text-xs text-muted-foreground">© 2026 zgame. כל הזכויות שמורות.</p>
      </footer>
    </div>
  );
};

export default Dashboard;
