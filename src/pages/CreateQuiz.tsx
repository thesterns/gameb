import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Plus, Trash2, GripVertical, Check, Info, ImagePlus, X, Youtube, Zap, Clock, Shuffle, Sparkles, Loader2 } from "lucide-react";
import YouTubeEmbed, { isValidYouTubeUrl } from "@/components/YouTubeEmbed";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { themeOptions, type GameTheme } from "@/lib/gameThemes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
  image_url?: string;
  imageFile?: File;
  imagePreview?: string;
  youtube_url?: string;
  double_points: boolean;
  custom_time?: number;
  use_participant_answers?: boolean;
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
  double_points: false,
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
  majority: {
    label: "הרוב קובע",
    description: "התשובה הנכונה תהיה התשובה שהרוב בחרו. במקרה של שוויון, כל התשובות המקסימליות נכונות.",
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
  const [theme, setTheme] = useState<GameTheme>("default");
  const [timePerQuestion, setTimePerQuestion] = useState<number>(30);
  const [questions, setQuestions] = useState<Question[]>([createDefaultQuestion()]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [quizImageFile, setQuizImageFile] = useState<File | null>(null);
  const [quizImagePreview, setQuizImagePreview] = useState<string | undefined>(undefined);
  const [quizImageUrl, setQuizImageUrl] = useState<string | undefined>(undefined);
  const [quizYoutubeUrl, setQuizYoutubeUrl] = useState<string>("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | undefined>(undefined);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [logoText, setLogoText] = useState<string>("");
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiNumAnswers, setAiNumAnswers] = useState(4);
  const [aiNumQuestions, setAiNumQuestions] = useState(5);
  const [aiGenerating, setAiGenerating] = useState(false);

  // Load existing quiz data in edit mode
  useEffect(() => {
    if (!quizId) return;

    const loadQuiz = async () => {
      const { data: quiz, error: quizErr } = await supabase
        .from("quizzes")
        .select("title, description, mode, time_per_question, image_url, theme, youtube_url, logo_url, logo_text")
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
      setTheme(((quiz as any).theme as GameTheme) || "default");
      if ((quiz as any).image_url) {
        setQuizImageUrl((quiz as any).image_url);
        setQuizImagePreview((quiz as any).image_url);
      }
      if ((quiz as any).youtube_url) {
        setQuizYoutubeUrl((quiz as any).youtube_url);
      }
      if ((quiz as any).logo_url) {
        setLogoUrl((quiz as any).logo_url);
        setLogoPreview((quiz as any).logo_url);
      }
      if ((quiz as any).logo_text) {
        setLogoText((quiz as any).logo_text);
      }

      const { data: dbQuestions } = await supabase
        .from("questions")
        .select("id, text, sort_order, image_url, double_points, custom_time")
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
            image_url: (q as any).image_url || undefined,
            imagePreview: (q as any).image_url || undefined,
            youtube_url: (q as any).youtube_url || undefined,
            double_points: (q as any).double_points || false,
            custom_time: (q as any).custom_time || undefined,
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

  const handleImageSelect = (qId: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("יש לבחור קובץ תמונה בלבד");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("גודל התמונה מוגבל ל-5MB");
      return;
    }
    const preview = URL.createObjectURL(file);
    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, imageFile: file, imagePreview: preview } : q))
    );
  };

  const removeImage = (qId: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId ? { ...q, imageFile: undefined, imagePreview: undefined, image_url: undefined } : q
      )
    );
  };

  const uploadQuestionImage = async (file: File, quizId: string, questionIndex: number): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${quizId}/${questionIndex}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("question-images").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("question-images").getPublicUrl(path);
    return data.publicUrl;
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
        // Upload quiz image if needed
        let finalQuizImageUrl = quizImageUrl || null;
        if (quizImageFile) {
          finalQuizImageUrl = await uploadQuestionImage(quizImageFile, quizId, 999);
        }

        // Upload logo if needed
        let finalLogoUrl = logoUrl || null;
        if (logoFile) {
          finalLogoUrl = await uploadQuestionImage(logoFile, quizId, 998);
        }

        // Update existing quiz
        const { error: quizErr } = await supabase
          .from("quizzes")
          .update({ title: title.trim(), description: description.trim() || null, mode, theme, time_per_question: timePerQuestion, image_url: finalQuizImageUrl, youtube_url: quizYoutubeUrl.trim() || null, logo_url: finalLogoUrl, logo_text: logoText.trim() || null } as any)
          .eq("id", quizId);

        if (quizErr) throw quizErr;

        // Delete old questions (cascade deletes answers)
        await supabase.from("questions").delete().eq("quiz_id", quizId);

        // Re-insert questions and answers
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          let imageUrl = q.image_url || null;
          if (q.imageFile) {
            imageUrl = await uploadQuestionImage(q.imageFile, quizId, i);
          }
          const { data: dbQ, error: qErr } = await supabase
            .from("questions")
            .insert({ quiz_id: quizId, text: q.text.trim(), sort_order: i, image_url: imageUrl, youtube_url: q.youtube_url?.trim() || null, double_points: q.double_points, custom_time: q.custom_time || null } as any)
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
          .insert({ title: title.trim(), description: description.trim() || null, user_id: user.id, mode, theme, time_per_question: timePerQuestion, youtube_url: quizYoutubeUrl.trim() || null, logo_text: logoText.trim() || null } as any)
          .select()
          .single();

        if (quizErr || !quiz) throw quizErr;

        // Upload quiz image if needed
        if (quizImageFile) {
          const quizImgUrl = await uploadQuestionImage(quizImageFile, quiz.id, 999);
          await supabase.from("quizzes").update({ image_url: quizImgUrl } as any).eq("id", quiz.id);
        }

        // Upload logo if needed
        if (logoFile) {
          const logoImgUrl = await uploadQuestionImage(logoFile, quiz.id, 998);
          await supabase.from("quizzes").update({ logo_url: logoImgUrl } as any).eq("id", quiz.id);
        }

        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          let imageUrl: string | null = null;
          if (q.imageFile) {
            imageUrl = await uploadQuestionImage(q.imageFile, quiz.id, i);
          }
          const { data: dbQ, error: qErr } = await supabase
            .from("questions")
            .insert({ quiz_id: quiz.id, text: q.text.trim(), sort_order: i, image_url: imageUrl, youtube_url: q.youtube_url?.trim() || null, double_points: q.double_points, custom_time: q.custom_time || null } as any)
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

  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) { toast.error("יש להזין נושא לשאלות"); return; }
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-questions", {
        body: { topic: aiTopic.trim(), numAnswers: aiNumAnswers, numQuestions: aiNumQuestions },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      const generated: Question[] = (data.questions || []).map((q: any) => ({
        id: generateId(),
        text: q.text,
        double_points: false,
        answers: (q.answers || []).map((a: any) => ({
          id: generateId(),
          text: a.text,
          is_correct: !!a.is_correct,
        })),
      }));
      if (generated.length === 0) { toast.error("לא נוצרו שאלות"); return; }
      // If only one empty default question exists, replace it
      if (questions.length === 1 && !questions[0].text.trim() && questions[0].answers.every(a => !a.text.trim())) {
        setQuestions(generated);
      } else {
        setQuestions(prev => [...prev, ...generated]);
      }
      setAiDialogOpen(false);
      setAiTopic("");
      toast.success(`${generated.length} שאלות נוצרו בהצלחה!`);
    } catch (err: any) {
      toast.error("שגיאה ביצירת שאלות: " + (err?.message || ""));
    } finally {
      setAiGenerating(false);
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
            {/* Quiz image */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">תמונת חידון (לא חובה)</label>
              {quizImagePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={quizImagePreview} alt="תמונת חידון" className="w-full max-h-48 object-contain bg-muted/30" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 left-2 size-7 rounded-full"
                    onClick={() => { setQuizImageFile(null); setQuizImagePreview(undefined); setQuizImageUrl(undefined); }}
                  >
                    <X className="!size-3.5" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border rounded-xl p-3 justify-center">
                  <ImagePlus className="size-4" />
                  <span>הוסף תמונה לחידון</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (!file.type.startsWith("image/")) { toast.error("יש לבחור קובץ תמונה בלבד"); return; }
                        if (file.size > 5 * 1024 * 1024) { toast.error("גודל התמונה מוגבל ל-5MB"); return; }
                        setQuizImageFile(file);
                        setQuizImagePreview(URL.createObjectURL(file));
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            {/* Quiz YouTube URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">קישור יוטיוב לחידון (לא חובה)</label>
              <div className="flex items-center gap-2 border border-border rounded-xl p-3">
                <Youtube className="size-4 text-destructive shrink-0" />
                <Input
                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={quizYoutubeUrl}
                  onChange={(e) => setQuizYoutubeUrl(e.target.value)}
                  maxLength={500}
                />
                {quizYoutubeUrl && (
                  <Button variant="ghost" size="icon" className="shrink-0 size-7" onClick={() => setQuizYoutubeUrl("")}>
                    <X className="!size-3.5" />
                  </Button>
                )}
              </div>
              {quizYoutubeUrl && isValidYouTubeUrl(quizYoutubeUrl) && (
                <YouTubeEmbed url={quizYoutubeUrl} className="max-h-48" />
              )}
              {quizYoutubeUrl && !isValidYouTubeUrl(quizYoutubeUrl) && (
                <p className="text-xs text-destructive">קישור יוטיוב לא תקין</p>
              )}
            </div>
            {/* Logo */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">לוגו למשחק (לא חובה)</label>
              <p className="text-xs text-muted-foreground">יוצג בכל השאלות, בשקופית הפתיחה ובתוצאות</p>
              <div className="flex items-start gap-4">
                {logoPreview ? (
                  <div className="relative shrink-0">
                    <img src={logoPreview} alt="לוגו" className="w-16 h-16 object-contain rounded-xl border border-border bg-muted/30" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -left-2 size-5 rounded-full"
                      onClick={() => { setLogoFile(null); setLogoPreview(undefined); setLogoUrl(undefined); }}
                    >
                      <X className="!size-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center cursor-pointer border border-dashed border-border rounded-xl w-16 h-16 hover:border-foreground/30 transition-colors shrink-0">
                    <ImagePlus className="size-5 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (!file.type.startsWith("image/")) { toast.error("יש לבחור קובץ תמונה בלבד"); return; }
                          if (file.size > 5 * 1024 * 1024) { toast.error("גודל התמונה מוגבל ל-5MB"); return; }
                          setLogoFile(file);
                          setLogoPreview(URL.createObjectURL(file));
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
                <div className="flex-1">
                  <Input
                    placeholder="טקסט כותרת (יוצג ליד הלוגו)"
                    value={logoText}
                    onChange={(e) => setLogoText(e.target.value)}
                    maxLength={100}
                  />
                </div>
              </div>
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
            {/* Theme selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">עיצוב המשחק</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {themeOptions.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTheme(t.value)}
                    className={`rounded-xl p-3 text-right border-2 transition-all ${
                      theme === t.value
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border bg-card hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="text-lg mb-0.5">{t.emoji}</div>
                    <div className="text-sm font-heading font-semibold">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.description}</div>
                  </button>
                ))}
              </div>
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

        {/* Shuffle & AI buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="hero"
            size="sm"
            onClick={() => setAiDialogOpen(true)}
          >
            <Sparkles className="!size-4" />
            צור שאלות עם AI
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setQuestions((prev) => {
                const shuffled = [...prev];
                for (let i = shuffled.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                return shuffled;
              });
              toast.success("סדר השאלות עורבב!");
            }}
          >
            <Shuffle className="!size-4" />
            ערבב סדר שאלות
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setQuestions((prev) =>
                prev.map((q) => {
                  const shuffled = [...q.answers];
                  for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                  }
                  return { ...q, answers: shuffled };
                })
              );
              toast.success("סדר התשובות עורבב!");
            }}
          >
            <Shuffle className="!size-4" />
            ערבב סדר תשובות
          </Button>
        </div>

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

              {/* Per-question settings: double points & custom time */}
              <div className="flex flex-wrap items-center gap-4 rounded-xl bg-muted/30 p-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={q.double_points}
                    onCheckedChange={(checked) =>
                      setQuestions((prev) =>
                        prev.map((qq) => qq.id === q.id ? { ...qq, double_points: !!checked } : qq)
                      )
                    }
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <Zap className="size-4 text-primary" />
                  <span className="text-sm font-medium">ניקוד כפול</span>
                </label>
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">זמן מענה:</span>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    placeholder={`${timePerQuestion}`}
                    value={q.custom_time ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQuestions((prev) =>
                        prev.map((qq) =>
                          qq.id === q.id
                            ? { ...qq, custom_time: val ? Math.min(120, Math.max(5, Number(val) || 5)) : undefined }
                            : qq
                        )
                      );
                    }}
                    className="w-20 h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">שניות</span>
                </div>
              </div>

        {/* AI Generate Questions Dialog */}
        <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                יצירת שאלות עם AI
              </DialogTitle>
              <DialogDescription className="text-right">
                הזן נושא וכמות תשובות, וה-AI ייצור שאלות עבורך
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">נושא השאלות *</Label>
                <Textarea
                  placeholder="למשל: היסטוריה של מדינת ישראל, גאוגרפיה עולמית, מדע וטכנולוגיה..."
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">כמות שאלות</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={aiNumQuestions}
                  onChange={(e) => setAiNumQuestions(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-24"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">כמות תשובות לכל שאלה</Label>
                <Input
                  type="number"
                  min={2}
                  max={8}
                  value={aiNumAnswers}
                  onChange={(e) => setAiNumAnswers(Math.min(8, Math.max(2, Number(e.target.value) || 2)))}
                  className="w-24"
                />
              </div>
            </div>
            <Button
              variant="hero"
              className="w-full"
              onClick={handleAiGenerate}
              disabled={aiGenerating || !aiTopic.trim()}
            >
              {aiGenerating ? (
                <>
                  <Loader2 className="!size-4 animate-spin" />
                  יוצר שאלות...
                </>
              ) : (
                <>
                  <Sparkles className="!size-4" />
                  צור שאלות
                </>
              )}
            </Button>
          </DialogContent>
        </Dialog>

              {q.imagePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={q.imagePreview} alt="תמונת שאלה" className="w-full max-h-48 object-contain bg-muted/30" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 left-2 size-7 rounded-full"
                    onClick={() => removeImage(q.id)}
                  >
                    <X className="!size-3.5" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border rounded-xl p-3 justify-center">
                  <ImagePlus className="size-4" />
                  <span>הוסף תמונה (אופציונלי)</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageSelect(q.id, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}

              {/* YouTube URL */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 border border-border rounded-xl p-3">
                  <Youtube className="size-4 text-destructive shrink-0" />
                  <Input
                    className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    placeholder="קישור יוטיוב (אופציונלי)"
                    value={q.youtube_url || ""}
                    onChange={(e) =>
                      setQuestions((prev) =>
                        prev.map((qq) => qq.id === q.id ? { ...qq, youtube_url: e.target.value } : qq)
                      )
                    }
                    maxLength={500}
                  />
                  {q.youtube_url && (
                    <Button variant="ghost" size="icon" className="shrink-0 size-7" onClick={() =>
                      setQuestions((prev) =>
                        prev.map((qq) => qq.id === q.id ? { ...qq, youtube_url: undefined } : qq)
                      )
                    }>
                      <X className="!size-3.5" />
                    </Button>
                  )}
                </div>
                {q.youtube_url && isValidYouTubeUrl(q.youtube_url) && (
                  <YouTubeEmbed url={q.youtube_url} className="max-h-48" />
                )}
                {q.youtube_url && !isValidYouTubeUrl(q.youtube_url) && (
                  <p className="text-xs text-destructive">קישור יוטיוב לא תקין</p>
                )}
              </div>

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
