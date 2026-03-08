import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Plus, Target, Edit, Trash2, Play } from "lucide-react";
import { toast } from "sonner";

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

const MyChallenges = () => {
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }

      const { data } = await supabase
        .from("challenges")
        .select("id, title, description, created_at")
        .order("created_at", { ascending: false });

      setChallenges(data || []);
      setLoading(false);
    };
    load();
  }, [navigate]);

  const handleDelete = async (id: string) => {
    if (!confirm("למחוק את האתגר?")) return;
    const { error } = await supabase.from("challenges").delete().eq("id", id);
    if (error) { toast.error("שגיאה במחיקה"); return; }
    setChallenges((prev) => prev.filter((c) => c.id !== id));
    toast.success("האתגר נמחק");
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowRight className="!size-4" />
            חזרה
          </Button>
          <h1 className="font-heading font-bold text-lg text-gradient">האתגרים שלי</h1>
          <Button variant="hero" size="sm" onClick={() => navigate("/challenge/new")}>
            <Plus className="!size-4" />
            חדש
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="bg-card rounded-2xl p-8 shadow-card text-center">
            <p className="text-muted-foreground">טוען...</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {challenges.map((challenge) => (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-2xl p-5 shadow-card text-right"
              >
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <Target className="size-3.5" />
                  <span>אתגר</span>
                </div>
                <h4 className="font-heading font-bold text-lg text-foreground truncate">{challenge.title}</h4>
                {challenge.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{challenge.description}</p>
                )}
                <Button
                  variant="hero"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={async () => {
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
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/challenge/${challenge.id}/edit`)}>
                    <Edit className="!size-4" />
                    ערוך
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(challenge.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="!size-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyChallenges;
