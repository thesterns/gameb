import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Users, Play, Copy, Check, Crown, Share2, QrCode, X, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import QuizLogo from "@/components/QuizLogo";

interface Participant {
  id: string;
  player_name: string;
  joined_at: string;
}

const GameLobby = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [gameTitle, setGameTitle] = useState("");
  const [gameType, setGameType] = useState<"quiz" | "challenge">("quiz");
  const [quizMode, setQuizMode] = useState("genius");
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoText, setLogoText] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [kingParticipantId, setKingParticipantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const loadSession = async () => {
      const { data: session, error } = await supabase
        .from("game_sessions")
        .select("join_code, quiz_id, challenge_id, status")
        .eq("id", sessionId)
        .single();

      if (error || !session) {
        toast.error("לא נמצא משחק");
        navigate("/dashboard");
        return;
      }

      setJoinCode(session.join_code);

      if (session.challenge_id) {
        setGameType("challenge");
        setChallengeId(session.challenge_id);
        const { data: challenge } = await supabase
          .from("challenges")
          .select("title, youtube_url, image_url, logo_url, logo_text")
          .eq("id", session.challenge_id)
          .single();

        setGameTitle(challenge?.title || "אתגר");
        setYoutubeUrl(challenge?.youtube_url || null);
        setImageUrl(challenge?.image_url || null);
        setLogoUrl(challenge?.logo_url || null);
        setLogoText(challenge?.logo_text || null);
      } else if (session.quiz_id) {
        setGameType("quiz");
        const { data: quiz } = await supabase
          .from("quizzes")
          .select("title, mode, youtube_url, image_url, logo_url, logo_text")
          .eq("id", session.quiz_id)
          .single();

        setGameTitle(quiz?.title || "חידון");
        setQuizMode(quiz?.mode || "genius");
        setYoutubeUrl(quiz?.youtube_url || null);
        setImageUrl(quiz?.image_url || null);
        setLogoUrl((quiz as any)?.logo_url || null);
        setLogoText((quiz as any)?.logo_text || null);
      }

      const { data: existingParticipants } = await supabase
        .from("game_participants")
        .select("id, player_name, joined_at")
        .eq("session_id", sessionId)
        .order("joined_at");

      setParticipants(existingParticipants || []);
      setLoading(false);
    };

    loadSession();

    const channel = supabase
      .channel(`lobby-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_participants",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newP = payload.new as Participant;
          setParticipants((prev) => {
            if (prev.some((p) => p.id === newP.id)) return prev;
            return [...prev, newP];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, navigate]);

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(joinCode);
    setCopied(true);
    toast.success("הקוד הועתק!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const joinUrl = `${window.location.origin}/join/${joinCode}`;
    const label = gameType === "challenge" ? "אתגר" : "חידון";
    const shareText = `הצטרפו ל${label} "${gameTitle}" עם הקוד ${joinCode}\n${joinUrl}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `הצטרפו ל${label}: ${gameTitle}`,
          text: shareText,
          url: joinUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      toast.success("הטקסט והקישור הועתקו!");
    }
  };

  const handleStartPlaying = async () => {
    if (participants.length === 0) {
      toast.error("צריך לפחות משתתף אחד כדי להתחיל");
      return;
    }

    const updateData: Record<string, unknown> = { status: "active" };
    const { error } = await supabase
      .from("game_sessions")
      .update(updateData)
      .eq("id", sessionId);

    if (error) {
      toast.error("שגיאה בהפעלת המשחק");
      return;
    }

    navigate(gameType === "challenge" ? `/game/${sessionId}/challenge-play` : `/game/${sessionId}/play`, { state: { isHost: true } });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">טוען...</div>;

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center px-4">
      <motion.div className="w-full max-w-md" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        
        <QuizLogo logoUrl={logoUrl} logoText={logoText} size="md" className="mb-4" />

        <div className="text-center mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-primary-foreground/70 mb-4">
            <ArrowRight className="!size-4" /> חזרה
          </Button>
          <h1 className="text-3xl font-heading font-bold text-primary-foreground">{gameTitle}</h1>
        </div>

        <div className="bg-card rounded-3xl p-8 shadow-elevated space-y-6">
          
          {/* Media Section with Shadcn Dialog for Zoom */}
          {youtubeUrl && <YouTubeEmbed url={youtubeUrl} />}
          {imageUrl && !youtubeUrl && (
            <Dialog>
              <DialogTrigger asChild>
                <div className="relative group cursor-zoom-in">
                  <img 
                    src={imageUrl} 
                    alt={gameTitle} 
                    className="w-full max-h-48 object-contain rounded-2xl transition-transform group-hover:scale-[1.02]" 
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-2xl">
                    <ZoomIn className="text-white size-8 drop-shadow-lg" />
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] md:max-w-4xl border-none bg-transparent shadow-none p-0 flex items-center justify-center">
                <DialogHeader className="hidden">
                  <DialogTitle>{gameTitle}</DialogTitle>
                </DialogHeader>
                <div className="relative w-full h-full flex items-center justify-center p-2">
                  <img 
                    src={imageUrl} 
                    alt={gameTitle} 
                    className="max-w-full max-h-[90vh] object-contain rounded-lg" 
                  />
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Join Code */}
          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">קוד להצטרפות</p>
            <button onClick={handleCopyCode} className="group block w-full text-center">
              <span className="text-5xl font-heading font-bold tracking-[0.2em] text-foreground" dir="ltr">{joinCode}</span>
              <div className="flex items-center justify-center gap-1 mt-1 text-muted-foreground text-xs">
                {copied ? <Check className="size-3 text-accent" /> : <Copy className="size-3" />}
                {copied ? "הועתק!" : "לחץ להעתקת הקוד"}
              </div>
            </button>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleShare}><Share2 className="size-4" /> שתף</Button>
              <Button variant="outline" size="sm" onClick={() => setShowQR(true)}><QrCode className="size-4" /> QR</Button>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="size-4" />
              <span>משתתפים ({participants.length})</span>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 min-h-[100px] max-h-[180px] overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {participants.length === 0 ? (
                  <p className="text-center w-full text-muted-foreground text-sm py-4 italic">ממתין למשתתפים...</p>
                ) : (
                  participants.map((p) => (
                    <span key={p.id} className="px-3 py-1 bg-white dark:bg-zinc-800 rounded-full text-xs font-semibold shadow-sm">
                      {p.player_name}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <Button variant="hero" size="xl" className="w-full" onClick={handleStartPlaying} disabled={participants.length === 0}>
            <Play className="!size-5" /> התחל משחק
          </Button>
        </div>

        {/* QR Code Modal (Old-school style but kept for your preference) */}
        <AnimatePresence>
          {showQR && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
              onClick={() => setShowQR(false)}
            >
              <motion.div 
                className="bg-card rounded-3xl p-8 text-center max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-xl">סרוק להצטרפות</h3>
                  <X className="cursor-pointer" onClick={() => setShowQR(false)} />
                </div>
                <div className="bg-white p-4 rounded-2xl inline-block shadow-inner">
                  <QRCodeSVG value={`${window.location.origin}/join/${joinCode}`} size={200} />
                </div>
                <p className="mt-4 font-heading text-2xl tracking-widest">{joinCode}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
};

export default GameLobby;
