import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Plus, Trash2, GripVertical, Check, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Answer {
  id: string;
  text: string;
  is_correct: boolean;
}

interface Question {
  id: string;
  text: string;
  answers: Answer[];
}

const generateId = () => crypto.randomUUID();

const createDefaultAnswer = (): Answer => ({
  id: generateId(),
  text: "",
  is_correct: false,
});

const createDefaultQuestion = (): Question => ({
  id: generateId(),
  text: "",
  answers: [createDefaultAnswer(), createDefaultAnswer()],
});

const modeDescriptions: Record<string, { label: string; description: string }> = {
  genius: {
    label: "גאון",
    description: "קובעים מראש תשובות נכונות לשאלות. השחקנים מקבלים ניקוד לפי מהירות ודיוק.",
  },
  king: {
    label: "מלך",
    description: "התשובה הנכונה תהיה התשובה שיקבע השחקן שהוא המלך.",
  },
  tribe: {
    label: "שבט",
    description: "התשובה הנכונה תהיה התשובה שיענה אחד השחקנים לפי תור בין כולם.",
  },
};

const answerColors = [
  "border-[hsl(var(--answer-red))]",
  "border-[hsl(var(--answer-blue))]",
  "border-[hsl(var(--answer-yellow))]",
  "border-[hsl(var(--answer-green))]",
  "border-[hsl(var(--answer-purple))]",
  "border-[hsl(var(--answer-orange))]",
  "border-[hsl(var(--answer-red))]",
  "border-[hsl(var(--answer-blue))]",
];

const CreateQuiz = () => {
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();
  const isEdit = Boolean(quizId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<string>("genius");
  const [timePerQuestion, setTimePerQuestion] = useState<number>(30);
  const [questions, setQuestions] = useState<Question[]>([createDefaultQuestion()]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  // Load existing quiz data in edit mode
  useEffect(() => {
    if (!quizId) return;

    const loadQuiz = async () => {
      const { data: quiz, error: quizErr } = await supabase
        .from("quizzes")
        .select("title, description, mode, time_per_question")
        .eq("id", quizId)
        .single();

      if (quizErr || !quiz) {
        toast.error("לא ניתן לטעון את החידון");
        navigate("/my-quizzes");
        return;
      }

      setTitle(quiz.title);
      setDescription(quiz.description || "");
      setMode(quiz.mode || "genius");
      setTimePerQuestion(quiz.time_per_question ?? 30);

      const { data: dbQuestions } = await supabase
        .from("questions")
        .select("id, text, sort_order")
        .eq("quiz_id", quizId)
        .order("sort_order");

      if (dbQuestions?.length) {
        const loadedQuestions: Question[] = [];
        for (const q of dbQuestions) {
          const { data: dbAnswers } = await supabase
            .from("answers")
            .select("id, text, is_correct, sort_order")
            .eq("question_id", q.id)
            .order("sort_order");

          loadedQuestions.push({
            id: q.id,
            text: q.text,
            answers: (dbAnswers || []).map((a) => ({
              id: a.id,
              text: a.text,
              is_correct: a.is_correct,
            })),
          });
        }
        setQuestions(loadedQuestions);
      }
      setLoading(false);
    };

    loadQuiz();
  }, [quizId, navigate]);

  const updateQuestion = (qId: string, text: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, text } : q))
    );
  };

  const removeQuestion = (qId: string) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((q) => q.id !== qId));
  };

  const addAnswer = (qId: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId || q.answers.length >= 8) return q;
        return { ...q, answers: [...q.answers, createDefaultAnswer()] };
      })
    );
  };

  const removeAnswer = (qId: string, aId: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId || q.answers.length <= 2) return q;
        return { ...q, answers: q.answers.filter((a) => a.id !== aId) };
      })
    );
  };

  const updateAnswerText = (qId: string, aId: string, text: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? {
              ...q,
              answers: q.answers.map((a) =>
                a.id === aId ? { ...a, text } : a
              ),
            }
          : q
      )
    );
  };

  const toggleCorrect = (qId: string, aId: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? {
              ...q,
              answers: q.answers.map((a) =>
                a.id === aId ? { ...a, is_correct: !a.is_correct } : a
              ),
            }
          : q
      )
    );
  };

  const validate = (): string | null => {
    if (!title.trim()) return "יש להזין שם לחידון";
    if (title.trim().length > 200) return "שם החידון ארוך מדי";
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) return `שאלה ${i + 1}: יש להזין טקסט לשאלה`;
      if (q.answers.length < 2) return `שאלה ${i + 1}: צריך לפחות 2 תשובות`;
      for (let j = 0; j < q.answers.length; j++) {
        if (!q.answers[j].text.trim())
          return `שאלה ${i + 1}, תשובה ${j + 1}: יש להזין טקסט`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("יש להתחבר כדי לשמור חידון");
        navigate("/login");
        return;
      }

      if (isEdit && quizId) {
        // Update existing quiz
        const { error: quizErr } = await supabase
          .from("quizzes")
          .update({ title: title.trim(), description: description.trim() || null, mode, time_per_question: timePerQuestion })
          .eq("id", quizId);

        if (quizErr) throw quizErr;

        // Delete old questions (cascade deletes answers)
        await supabase.from("questions").delete().eq("quiz_id", quizId);

        // Re-insert questions and answers
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const { data: dbQ, error: qErr } = await supabase
            .from("questions")
            .insert({ quiz_id: quizId, text: q.text.trim(), sort_order: i })
            .select()
            .single();

          if (qErr || !dbQ) throw qErr;

          const answersToInsert = q.answers.map((a, j) => ({
            question_id: dbQ.id,
            text: a.text.trim(),
            is_correct: a.is_correct,
            sort_order: j,
          }));

          const { error: aErr } = await supabase.from("answers").insert(answersToInsert);
          if (aErr) throw aErr;
        }

        toast.success("החידון עודכן בהצלחה!");
      } else {
        // Create new quiz
        const { data: quiz, error: quizErr } = await supabase
          .from("quizzes")
          .insert({ title: title.trim(), description: description.trim() || null, user_id: user.id, mode, time_per_question: timePerQuestion })
          .select()
          .single();

        if (quizErr || !quiz) throw quizErr;

        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const { data: dbQ, error: qErr } = await supabase
            .from("questions")
            .insert({ quiz_id: quiz.id, text: q.text.trim(), sort_order: i })
            .select()
            .single();

          if (qErr || !dbQ) throw qErr;

          const answersToInsert = q.answers.map((a, j) => ({
            question_id: dbQ.id,
            text: a.text.trim(),
            is_correct: a.is_correct,
            sort_order: j,
          }));

          const { error: aErr } = await supabase.from("answers").insert(answersToInsert);
          if (aErr) throw aErr;
        }

        toast.success("החידון נוצר בהצלחה!");
      }

      navigate("/my-quizzes");
    } catch (err: any) {
      toast.error("שגיאה בשמירת החידון: " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">טוען חידון...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold text-gradient">
            {isEdit ? "עריכת חידון" : "יצירת חידון"}
          </h1>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/my-quizzes")}>
              <ArrowRight className="!size-4" />
              חזרה
            </Button>
            <Button variant="hero" size="sm" onClick={handleSave} disabled={saving}>
              <Check className="!size-4" />
              {saving ? "שומר..." : isEdit ? "שמור שינויים" : "שמור חידון"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="bg-card rounded-2xl p-6 shadow-card space-y-4">
            <h2 className="text-xl font-heading font-bold">פרטי החידון</h2>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">שם החידון *</label>
              <Input
                placeholder="למשל: חידון גאוגרפיה כיתה ו'"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">תיאור (לא חובה)</label>
              <Textarea
                placeholder="תיאור קצר על החידון..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">סוג משחק *</label>
              <Select value={mode} onValueChange={setMode} dir="rtl">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="genius">🧠 גאון</SelectItem>
                  <SelectItem value="king">👑 מלך</SelectItem>
                  <SelectItem value="tribe">🏕️ שבט</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <Info className="size-4 mt-0.5 shrink-0" />
                <span>{modeDescriptions[mode].description}</span>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">זמן לשאלה (שניות) *</label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={5}
                  max={120}
                  value={timePerQuestion}
                  onChange={(e) => setTimePerQuestion(Math.min(120, Math.max(5, Number(e.target.value) || 5)))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">שניות (5-120)</span>
              </div>
            </div>
          </div>
          </div>
        </motion.div>

        <AnimatePresence mode="popLayout">
          {questions.map((q, qIndex) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              layout
              className="bg-card rounded-2xl p-6 shadow-card space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="size-4 text-muted-foreground" />
                  <h3 className="font-heading font-bold text-lg">שאלה {qIndex + 1}</h3>
                </div>
                {questions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeQuestion(q.id)}
                  >
                    <Trash2 className="!size-4" />
                  </Button>
                )}
              </div>

              <Input
                placeholder="הקלד את השאלה כאן..."
                value={q.text}
                onChange={(e) => updateQuestion(q.id, e.target.value)}
                maxLength={500}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  תשובות ({q.answers.length}/8) — סמן תשובות נכונות
                </label>
                <AnimatePresence mode="popLayout">
                  {q.answers.map((a, aIndex) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      layout
                      className={`flex items-center gap-2 border-r-4 rounded-lg pr-3 pl-2 py-1 bg-muted/30 ${answerColors[aIndex]}`}
                    >
                      <Checkbox
                        checked={a.is_correct}
                        onCheckedChange={() => toggleCorrect(q.id, a.id)}
                        className="data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                      />
                      <Input
                        className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                        placeholder={`תשובה ${aIndex + 1}`}
                        value={a.text}
                        onChange={(e) => updateAnswerText(q.id, a.id, e.target.value)}
                        maxLength={300}
                      />
                      {q.answers.length > 2 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeAnswer(q.id, a.id)}
                        >
                          <Trash2 className="!size-3.5" />
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {q.answers.length < 8 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => addAnswer(q.id)}
                  >
                    <Plus className="!size-4" />
                    הוסף תשובה
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <Button
          variant="game"
          size="lg"
          className="w-full"
          onClick={() => setQuestions((prev) => [...prev, createDefaultQuestion()])}
        >
          <Plus className="!size-5" />
          הוסף שאלה
        </Button>

        <div className="h-8" />
      </main>
    </div>
  );
};

export default CreateQuiz;
