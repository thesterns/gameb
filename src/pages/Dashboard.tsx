import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Gamepad2, LogOut, BookOpen, Crown, Brain, Users, Play, Target, Edit, Mail } from "lucide-react";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import ThemeToggle from "@/components/ThemeToggle";
import { toast } from "sonner";
import ChallengeHistoryDialog from "@/components/ChallengeHistoryDialog";

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
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);
  const [loadingChallenges, setLoadingChallenges] = useState(true);

  useEffect(() => {
    // מאזין לשינויים בסטטוס החיבור - זה הפתרון לזריקה ל-Login
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUserName(session.user.user_metadata?.full_name || "משתמש");

        // טעינת הנתונים מה-DB רק כשיש חיבור מאושר
        try {
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
        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          setLoadingQuizzes(false);
          setLoadingChallenges(false);
        }
      } else {
        // אם אין session, נחכה רגע קטן לראות אם זה רק עיכוב של גוגל
        const timeout = setTimeout(async () => {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            navigate("/login");
          }
        }, 1500);
        return () => clearTimeout(timeout);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("התנתקת בהצלחה");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-right" dir="rtl">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold text-gradient">zgame</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">שלום, {userName}</span>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="!size-4 ml-2" />
              יציאה
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-3xl font-heading font-bold mb-8 text-right">הדשבורד שלי</h2>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => navigate("/challenge/new")}
                className="bg-card rounded-2xl p-6 shadow-card hover:shadow-elevated transition-all text-center group"
              >
                <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Target className="!size-7 text-accent-foreground" />
                </div>
                <h3 className="font-heading font-bold text-lg">צור אתגר</h3>
                <p className="text-muted-foreground text-sm mt-1">צרו אתגר חדש</p>
              </button>

              <button
                onClick={() => navigate("/my-challenges")}
                className="bg-card rounded-2xl p-6 shadow-card hover:shadow-elevated transition-all text-center group"
              >
                <div className="w-14 h-14 gradient-secondary rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Target className="!size-7 text-secondary-foreground" />
                </div>
                <h3 className="font-heading font-bold text-lg">האתגרים שלי</h3>
                <p className="text-muted-foreground text-sm mt-1">ניהול ועריכת אתגרים</p>
              </button>
            </div>
          </div>

          <div className="mb-4">
            <button
              onClick={() => navigate("/join")}
              className="bg-card rounded-2xl p-4 shadow-card hover:shadow-elevated transition-all text-center group w-full sm:w-auto sm:px-10"
            >
              <div className="flex items-center justify-center gap-3">
                <Gamepad2 className="!size-6 text-secondary" />
                <h3 className="font-heading font-bold text-lg">הצטרף למשחק</h3>
              </div>
            </button>
          </div>

          {/* Recent Quizzes Section */}
          <div className="mb-10 text-right">
             <div className="flex items-center justify-between mb-4 flex-row-reverse">
                <h3 className="font-heading font-bold text-xl">החידונים האחרונים</h3>
                <Button variant="ghost" size="sm" onClick={() => navigate("/my-quizzes")}>הצג הכל</Button>
             </div>
             {loadingQuizzes ? (
                <div className="bg-card rounded-2xl p-8 text-center"><p>טוען חידונים...</p></div>
             ) : quizzes.length === 0 ? (
                <div className="bg-card rounded-2xl p-8 text-center border-dashed border-2">
                   <p className="mb-4">אין חידונים עדיין</p>
                   <Button onClick={() => navigate("/quiz/new")}>צור חידון ראשון</Button>
                </div>
             ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                   {quizzes.map((quiz) => (
                      <motion.div key={quiz.id} className="bg-card rounded-2xl p-5 shadow-card" whileHover={{ y: -5 }}>
                         <div className="text-right">
                            <h4 className="font-bold text-lg truncate">{quiz.title}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-2">{quiz.description}</p>
                            <Button className="w-full mt-4" onClick={() => navigate(`/game/${quiz.id}/lobby`)}>
                               <Play className="ml-2 size-4" /> התחל
                            </Button>
                         </div>
                      </motion.div>
                   ))}
                </div>
             )}
          </div>
        </motion.div>
      </main>

      <footer className="px-6 py-8 text-center text-muted-foreground text-sm border-t border-border mt-auto">
        <ContactFormDialog trigger={<button className="hover:text-foreground">צור קשר</button>} />
        <p className="mt-2">© 2026 zgame. כל הזכויות שמורות.</p>
      </footer>
    </div>
  );
};

export default Dashboard;
