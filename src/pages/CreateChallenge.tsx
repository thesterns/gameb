import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, ImagePlus, X, Youtube, Save, Plus, Trash2, Clock, MapPin, User, Package, Sparkles } from "lucide-react";
import YouTubeEmbed, { isValidYouTubeUrl } from "@/components/YouTubeEmbed";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DIMENSIONS = [
  { key: "time", label: "זמן", icon: Clock, color: "text-[hsl(var(--answer-blue))]", border: "border-[hsl(var(--answer-blue))]" },
  { key: "place", label: "מקום", icon: MapPin, color: "text-[hsl(var(--answer-green))]", border: "border-[hsl(var(--answer-green))]" },
  { key: "person", label: "אדם", icon: User, color: "text-[hsl(var(--answer-red))]", border: "border-[hsl(var(--answer-red))]" },
  { key: "object", label: "חפץ", icon: Package, color: "text-[hsl(var(--answer-yellow))]", border: "border-[hsl(var(--answer-yellow))]" },
  { key: "extra", label: "נוסף", icon: Sparkles, color: "text-[hsl(var(--answer-purple))]", border: "border-[hsl(var(--answer-purple))]" },
] as const;

type DimensionKey = typeof DIMENSIONS[number]["key"];

type DimensionsState = Record<DimensionKey, string[]>;

const emptyDimensions = (): DimensionsState => ({
  time: [],
  place: [],
  person: [],
  object: [],
  extra: [],
});

const emptyNewItems = (): Record<DimensionKey, string> => ({
  time: "",
  place: "",
  person: "",
  object: "",
  extra: "",
});

const parseDimensionValues = (raw: string): string[] =>
  raw
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

const mergePendingDimensionInputs = (
  currentDimensions: DimensionsState,
  pendingInputs: Record<DimensionKey, string>
): DimensionsState => {
  const merged = emptyDimensions();

  for (const dim of DIMENSIONS) {
    merged[dim.key] = [
      ...currentDimensions[dim.key],
      ...parseDimensionValues(pendingInputs[dim.key] ?? ""),
    ];
  }

  return merged;
};

const CreateChallenge = () => {
  const navigate = useNavigate();
  const { challengeId } = useParams<{ challengeId: string }>();
  const isEdit = Boolean(challengeId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instruction, setInstruction] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | undefined>();
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | undefined>();
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [logoText, setLogoText] = useState("");
  const [dimensions, setDimensions] = useState<DimensionsState>(emptyDimensions());
  const [newItems, setNewItems] = useState<Record<DimensionKey, string>>(emptyNewItems());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!challengeId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", challengeId)
        .single();
      if (error || !data) {
        toast.error("לא ניתן לטעון את האתגר");
        navigate("/my-challenges");
        return;
      }
      setTitle(data.title);
      setDescription(data.description || "");
      setInstruction((data as any).instruction || "");
      if (data.image_url) { setImageUrl(data.image_url); setImagePreview(data.image_url); }
      if (data.youtube_url) setYoutubeUrl(data.youtube_url);
      if (data.logo_url) { setLogoUrl(data.logo_url); setLogoPreview(data.logo_url); }
      if (data.logo_text) setLogoText(data.logo_text);

      // Load dimension items
      const { data: items } = await supabase
        .from("challenge_dimension_items")
        .select("dimension, value, sort_order")
        .eq("challenge_id", challengeId)
        .order("sort_order");

      if (items?.length) {
        const dims = emptyDimensions();
        for (const item of items) {
          const key = item.dimension as DimensionKey;
          if (key in dims) {
            dims[key].push(item.value);
          }
        }
        setDimensions(dims);
      }

      setLoading(false);
    };
    load();
  }, [challengeId, navigate]);

  const uploadImage = async (file: File, id: string, suffix: string): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `challenges/${id}/${suffix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("question-images").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("question-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleImageSelect = (file: File, type: "image" | "logo") => {
    if (!file.type.startsWith("image/")) { toast.error("יש לבחור קובץ תמונה בלבד"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("גודל התמונה מוגבל ל-5MB"); return; }
    const preview = URL.createObjectURL(file);
    if (type === "image") { setImageFile(file); setImagePreview(preview); }
    else { setLogoFile(file); setLogoPreview(preview); }
  };

  const addDimensionItem = (dim: DimensionKey) => {
    const values = parseDimensionValues(newItems[dim]);
    if (values.length === 0) return;

    setDimensions((prev) => ({ ...prev, [dim]: [...prev[dim], ...values] }));
    setNewItems((prev) => ({ ...prev, [dim]: "" }));
  };

  const removeDimensionItem = (dim: DimensionKey, index: number) => {
    setDimensions((prev) => ({ ...prev, [dim]: prev[dim].filter((_, i) => i !== index) }));
  };

  const saveDimensionItems = async (cId: string, dimensionsToSave: DimensionsState) => {
    const { error: delErr } = await supabase
      .from("challenge_dimension_items")
      .delete()
      .eq("challenge_id", cId);

    if (delErr) {
      console.error("Delete dimension items error:", delErr);
      throw delErr;
    }

    const rows: { challenge_id: string; dimension: string; value: string; sort_order: number }[] = [];
    for (const dim of DIMENSIONS) {
      dimensionsToSave[dim.key].forEach((value, i) => {
        rows.push({ challenge_id: cId, dimension: dim.key, value, sort_order: i });
      });
    }

    if (rows.length === 0) return;

    const { error } = await supabase.from("challenge_dimension_items").insert(rows);
    if (error) throw error;
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("יש להזין שם לאתגר");
      return;
    }

    const finalizedDimensions = mergePendingDimensionInputs(dimensions, newItems);
    setDimensions(finalizedDimensions);
    setNewItems(emptyNewItems());

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("יש להתחבר");
        navigate("/login");
        return;
      }

      if (isEdit && challengeId) {
        let finalImageUrl = imageUrl || null;
        if (imageFile) finalImageUrl = await uploadImage(imageFile, challengeId, "img");
        let finalLogoUrl = logoUrl || null;
        if (logoFile) finalLogoUrl = await uploadImage(logoFile, challengeId, "logo");

        const { error } = await supabase
          .from("challenges")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            image_url: finalImageUrl,
            youtube_url: youtubeUrl.trim() || null,
            logo_url: finalLogoUrl,
            logo_text: logoText.trim() || null,
          })
          .eq("id", challengeId);
        if (error) throw error;

        await saveDimensionItems(challengeId, finalizedDimensions);
        toast.success("האתגר עודכן בהצלחה!");
      } else {
        const { data: challenge, error } = await supabase
          .from("challenges")
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            user_id: user.id,
            youtube_url: youtubeUrl.trim() || null,
            logo_text: logoText.trim() || null,
          })
          .select()
          .single();
        if (error || !challenge) throw error;

        if (imageFile) {
          const imgUrl = await uploadImage(imageFile, challenge.id, "img");
          await supabase.from("challenges").update({ image_url: imgUrl }).eq("id", challenge.id);
        }
        if (logoFile) {
          const lUrl = await uploadImage(logoFile, challenge.id, "logo");
          await supabase.from("challenges").update({ logo_url: lUrl }).eq("id", challenge.id);
        }

        await saveDimensionItems(challenge.id, finalizedDimensions);
        toast.success("האתגר נוצר בהצלחה!");
      }

      navigate(isEdit ? "/my-challenges" : "/dashboard");
    } catch (e) {
      console.error(e);
      toast.error("שגיאה בשמירת האתגר");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">טוען...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(isEdit ? "/my-challenges" : "/dashboard")}
          >
            <ArrowRight className="!size-4" />
            חזרה
          </Button>
          <h1 className="font-heading font-bold text-lg text-gradient">
            {isEdit ? "עריכת אתגר" : "אתגר חדש"}
          </h1>
          <Button variant="hero" size="sm" onClick={handleSave} disabled={saving}>
            <Save className="!size-4" />
            {saving ? "שומר..." : "שמור"}
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Title & Description */}
          <div className="bg-card rounded-2xl p-5 shadow-card space-y-4">
            <h2 className="font-heading font-bold text-lg">פרטי האתגר</h2>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">שם האתגר *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="הזינו שם לאתגר" className="text-right" maxLength={200} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">תיאור</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="תיאור קצר של האתגר" className="text-right" rows={3} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">הנחיה למשתתפים</label>
              <Input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="הנחיה שתופיע מעל הערכים במשחק (למשל: ׳כתבו משפט מצחיק׳)" className="text-right" maxLength={300} />
            </div>
          </div>

          {/* 5 Dimensions */}
          <div className="bg-card rounded-2xl p-5 shadow-card space-y-5">
            <h2 className="font-heading font-bold text-lg">חמישה מימדים</h2>
            <p className="text-sm text-muted-foreground">הוסיפו ערכים לכל מימד – זמן, מקום, אדם, חפץ ונוסף</p>

            {DIMENSIONS.map((dim) => {
              const Icon = dim.icon;
              return (
                <div key={dim.key} className={`border-r-4 ${dim.border} pr-4 space-y-2`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`size-5 ${dim.color}`} />
                    <h3 className="font-heading font-bold">{dim.label}</h3>
                    <span className="text-xs text-muted-foreground">({dimensions[dim.key].length})</span>
                  </div>

                  {/* Items list */}
                  <AnimatePresence>
                    {dimensions[dim.key].map((item, idx) => (
                      <motion.div
                        key={`${dim.key}-${idx}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2"
                      >
                        <span className="text-sm flex-1">{item}</span>
                        <button onClick={() => removeDimensionItem(dim.key, idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="size-3.5" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Add new item */}
                  <div className="flex gap-2">
                    <Input
                      value={newItems[dim.key]}
                      onChange={(e) => setNewItems((prev) => ({ ...prev, [dim.key]: e.target.value }))}
                      placeholder={`הוסיפו ${dim.label}... (ניתן להפריד בפסיקים)`}
                      className="text-right flex-1"
                      maxLength={200}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDimensionItem(dim.key); } }}
                    />
                    <Button variant="outline" size="icon" onClick={() => addDimensionItem(dim.key)} disabled={!newItems[dim.key].trim()}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Image */}
          <div className="bg-card rounded-2xl p-5 shadow-card space-y-4">
            <h2 className="font-heading font-bold text-lg">תמונה</h2>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="תמונת אתגר" className="w-full max-h-64 object-cover rounded-xl" />
                <button onClick={() => { setImageFile(null); setImagePreview(undefined); setImageUrl(undefined); }} className="absolute top-2 left-2 bg-destructive text-destructive-foreground rounded-full p-1">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary transition-colors">
                <ImagePlus className="size-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">לחצו להעלאת תמונה</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0], "image")} />
              </label>
            )}
          </div>

          {/* YouTube */}
          <div className="bg-card rounded-2xl p-5 shadow-card space-y-4">
            <h2 className="font-heading font-bold text-lg flex items-center gap-2">
              <Youtube className="size-5 text-destructive" />
              קישור לסרטון
            </h2>
            <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="text-left" dir="ltr" />
            {youtubeUrl && isValidYouTubeUrl(youtubeUrl) && <YouTubeEmbed url={youtubeUrl} />}
            {youtubeUrl && !isValidYouTubeUrl(youtubeUrl) && <p className="text-sm text-destructive">קישור YouTube לא תקין</p>}
          </div>

          {/* Logo & Title Text */}
          <div className="bg-card rounded-2xl p-5 shadow-card space-y-4">
            <h2 className="font-heading font-bold text-lg">לוגו ומשפט כותרת</h2>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">לוגו</label>
              {logoPreview ? (
                <div className="relative inline-block">
                  <img src={logoPreview} alt="לוגו" className="h-20 object-contain rounded-lg" />
                  <button onClick={() => { setLogoFile(null); setLogoPreview(undefined); setLogoUrl(undefined); }} className="absolute -top-2 -left-2 bg-destructive text-destructive-foreground rounded-full p-1">
                    <X className="size-3" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 border-2 border-dashed border-border rounded-xl p-4 cursor-pointer hover:border-primary transition-colors w-fit">
                  <ImagePlus className="size-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">העלאת לוגו</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0], "logo")} />
                </label>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">משפט כותרת</label>
              <Input value={logoText} onChange={(e) => setLogoText(e.target.value)} placeholder="משפט שיופיע מתחת ללוגו" className="text-right" />
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default CreateChallenge;
