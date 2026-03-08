import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Gamepad2, LogOut, BookOpen, Crown, Brain, Users, Play, Target, Edit } from "lucide-react";
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
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      setUserName(session.user.user_metadata?.full_name || "משתמש");

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
      setLoadingQuizzes(false);
      setChallenges(challengesRes.data || []);
      setLoadingChallenges(false);
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
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold text-gradient">לך תדע</h1>
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-3xl font-heading font-bold mb-8">הדשבורד שלי</h2>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            {/* Quiz pair */}
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

            {/* Challenge pair */}
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

          {/* Recent Quizzes */}
          {loadingQuizzes ? (
            <div className="bg-card rounded-2xl p-8 shadow-card text-center mb-10">
              <p className="text-muted-foreground">טוען חידונים...</p>
            </div>
          ) : quizzes.length === 0 ? (
            <div className="bg-card rounded-2xl p-8 shadow-card text-center mb-10">
              <BookOpen className="!size-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-heading font-bold text-xl mb-2">אין חידונים עדיין</h3>
              <p className="text-muted-foreground mb-4">צרו את החידון הראשון שלכם!</p>
              <Button variant="hero" onClick={() => navigate("/quiz/new")}>
                <Plus className="!size-5" />
                צור חידון חדש
              </Button>
            </div>
          ) : (
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold text-xl">החידונים האחרונים</h3>
                <Button variant="ghost" size="sm" onClick={() => navigate("/my-quizzes")}>
                  הצג הכל
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {quizzes.map((quiz) => {
                  const mode = modeLabels[quiz.mode] || modeLabels.genius;
                  return (
                    <motion.div
                      key={quiz.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card rounded-2xl p-5 shadow-card hover:shadow-elevated transition-all text-right"
                    >
                      <button
                        onClick={() => navigate(`/quiz/${quiz.id}/edit`)}
                        className="w-full text-right"
                      >
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                          {mode.icon}
                          <span>{mode.label}</span>
                        </div>
                        <h4 className="font-heading font-bold text-lg text-foreground truncate">{quiz.title}</h4>
                        {quiz.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{quiz.description}</p>
                        )}
                      </button>
                      <Button
                        variant="hero"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) return;
                            const joinCode = String(Math.floor(10000 + Math.random() * 90000));
                            const { data: session, error } = await supabase
                              .from("game_sessions")
                              .insert({ quiz_id: quiz.id, host_user_id: user.id, join_code: joinCode })
                              .select()
                              .single();
                            if (error || !session) throw error;
                            navigate(`/game/${session.id}/lobby`);
                          } catch {
                            toast.error("שגיאה בהפעלת המשחק");
                          }
                        }}
                      >
                        <Play className="!size-4" />
                        התחל משחק
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Challenges */}
          {loadingChallenges ? (
            <div className="bg-card rounded-2xl p-8 shadow-card text-center">
              <p className="text-muted-foreground">טוען אתגרים...</p>
            </div>
          ) : challenges.length === 0 ? (
            <div className="bg-card rounded-2xl p-8 shadow-card text-center">
              <Target className="!size-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-heading font-bold text-xl mb-2">אין אתגרים עדיין</h3>
              <p className="text-muted-foreground mb-4">צרו את האתגר הראשון שלכם!</p>
              <Button variant="hero" onClick={() => navigate("/challenge/new")}>
                <Plus className="!size-5" />
                צור אתגר חדש
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold text-xl">האתגרים האחרונים</h3>
                <Button variant="ghost" size="sm" onClick={() => navigate("/my-challenges")}>
                  הצג הכל
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {challenges.map((challenge) => (
                  <motion.div
                    key={challenge.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-2xl p-5 shadow-card hover:shadow-elevated transition-all text-right"
                  >
                    <button
                      onClick={() => navigate(`/challenge/${challenge.id}/edit`)}
                      className="w-full text-right"
                    >
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                        <Target className="size-3.5" />
                        <span>אתגר</span>
                      </div>
                      <h4 className="font-heading font-bold text-lg text-foreground truncate">{challenge.title}</h4>
                      {challenge.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{challenge.description}</p>
                      )}
                    </button>
                    <Button
                      variant="hero"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) return;
                          const joinCode = String(Math.floor(10000 + Math.random() * 90000));
                          const { data: session, error } = await supabase
                            .from("game_sessions")
                            .insert({ challenge_id: challenge.id, host_user_id: user.id, join_code: joinCode } as any)
                            .select()
                            .single();
                          if (error || !session) throw error;
                          navigate(`/game/${session.id}/lobby`);
                        } catch {
                          toast.error("שגיאה בהפעלת המשחק");
                        }
                      }}
                    >
                      <Play className="!size-4" />
                      התחל משחק
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default Dashboard;
