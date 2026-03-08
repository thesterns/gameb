import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, Plus, Trash2, Pencil, Copy } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  mode: string;
  created_at: string;
}

const modeLabels: Record<string, string> = {
  genius: "🧠 גאון",
  king: "👑 מלך",
  tribe: "🏕️ שבט",
};

const MyQuizzes = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuizzes = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, description, mode, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("שגיאה בטעינת החידונים");
      } else {
        setQuizzes(data || []);
      }
      setLoading(false);
    };

    fetchQuizzes();
  }, [navigate]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) {
      toast.error("שגיאה במחיקת החידון");
    } else {
      setQuizzes((prev) => prev.filter((q) => q.id !== id));
      toast.success("החידון נמחק");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold text-gradient">החידונים שלי</h1>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowRight className="!size-4" />
              חזרה לדשבורד
            </Button>
            <Button variant="hero" size="sm" onClick={() => navigate("/quiz/new")}>
              <Plus className="!size-4" />
              צור חידון
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-4">
        {loading ? (
          <p className="text-center text-muted-foreground py-12">טוען...</p>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-muted-foreground text-lg">עדיין אין לך חידונים</p>
            <Button variant="hero" onClick={() => navigate("/quiz/new")}>
              <Plus className="!size-4" />
              צור חידון ראשון
            </Button>
          </div>
        ) : (
          quizzes.map((quiz) => (
            <motion.div
              key={quiz.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl p-5 shadow-card flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <h3 className="font-heading font-bold text-lg truncate">{quiz.title}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{modeLabels[quiz.mode] || quiz.mode}</span>
                  <span>·</span>
                  <span>{new Date(quiz.created_at).toLocaleDateString("he-IL")}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive shrink-0"
                onClick={() => handleDelete(quiz.id)}
              >
                <Trash2 className="!size-4" />
              </Button>
            </motion.div>
          ))
        )}
      </main>
    </div>
  );
};

export default MyQuizzes;
