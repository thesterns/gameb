import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Plus, Trash2, Pencil, Copy, Search, Play } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("all");

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q) => {
      const matchesSearch = !search.trim() ||
        q.title.toLowerCase().includes(search.toLowerCase()) ||
        (q.description || "").toLowerCase().includes(search.toLowerCase());
      const matchesMode = modeFilter === "all" || q.mode === modeFilter;
      return matchesSearch && matchesMode;
    });
  }, [quizzes, search, modeFilter]);

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

  const handleDuplicate = async (quizId: string) => {
    try {
      // Fetch the original quiz
      const { data: original, error: qErr } = await supabase
        .from("quizzes")
        .select("title, description, mode")
        .eq("id", quizId)
        .single();
      if (qErr || !original) throw qErr;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create duplicated quiz
      const { data: newQuiz, error: insertErr } = await supabase
        .from("quizzes")
        .insert({ title: original.title + " (עותק)", description: original.description, mode: original.mode, user_id: user.id })
        .select()
        .single();
      if (insertErr || !newQuiz) throw insertErr;

      // Fetch questions
      const { data: questions } = await supabase
        .from("questions")
        .select("id, text, sort_order")
        .eq("quiz_id", quizId)
        .order("sort_order");

      for (const q of questions || []) {
        const { data: newQ } = await supabase
          .from("questions")
          .insert({ quiz_id: newQuiz.id, text: q.text, sort_order: q.sort_order })
          .select()
          .single();
        if (!newQ) continue;

        const { data: answers } = await supabase
          .from("answers")
          .select("text, is_correct, sort_order")
          .eq("question_id", q.id);

        if (answers?.length) {
          await supabase.from("answers").insert(
            answers.map((a) => ({ ...a, question_id: newQ.id }))
          );
        }
      }

      setQuizzes((prev) => [{ ...newQuiz } as Quiz, ...prev]);
      toast.success("החידון שוכפל בהצלחה");
    } catch {
      toast.error("שגיאה בשכפול החידון");
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
        {!loading && quizzes.length > 0 && (
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי שם או תיאור..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={modeFilter} onValueChange={setModeFilter} dir="rtl">
              <SelectTrigger className="w-36">
                <SelectValue placeholder="כל הסוגים" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסוגים</SelectItem>
                <SelectItem value="genius">🧠 גאון</SelectItem>
                <SelectItem value="king">👑 מלך</SelectItem>
                <SelectItem value="tribe">🏕️ שבט</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

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
        ) : filteredQuizzes.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">לא נמצאו חידונים תואמים</p>
        ) : (
          filteredQuizzes.map((quiz) => (
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
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="hero"
                  size="sm"
                  className="ml-1"
                  onClick={() => handleStartGame(quiz.id)}
                >
                  <Play className="!size-4" />
                  הפעל
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => navigate(`/quiz/${quiz.id}/edit`)}
                >
                  <Pencil className="!size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => handleDuplicate(quiz.id)}
                >
                  <Copy className="!size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(quiz.id)}
                >
                  <Trash2 className="!size-4" />
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </main>
    </div>
  );
};

export default MyQuizzes;
