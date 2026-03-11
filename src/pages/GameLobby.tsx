import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Users, Play, Copy, Check, Crown, Share2, QrCode, X } from "lucide-react";
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
  const [showImageZoom, setShowImageZoom] = useState(false);

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
    
    const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (isMobile && navigator.share) {
      try {
        await navigator.share({
          title: `הצטרפו ל${label}: ${gameTitle}`,
          text: shareText,
          url: joinUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      toast.success("הטקסט והקישור הועתקו!");
    }
  };

  const handleSelectKing = (participantId: string) => {
    setKingParticipantId((prev) => (prev === participantId ? null : participantId));
  };

  const handleStartPlaying = async () => {
    if (participants.length === 0) {
      toast.error("צריך לפחות משתתף אחד כדי להתחיל");
      return;
    }

    if (gameType === "quiz" && quizMode === "king" && !kingParticipantId) {
      toast.error("יש לבחור מלך לפני תחילת המשחק");
      return;
    }

    if (gameType === "challenge" && challengeId) {
      try {
        const { data: dimItems } = await supabase
          .from("challenge_dimension_items")
          .select("dimension, value")
          .eq("challenge_id", challengeId);

        if (dimItems && dimItems.length > 0) {
          const byDimension: Record<string, string[]> = {};
          for (const item of dimItems) {
            if (!byDimension[item.dimension]) byDimension[item.dimension] = [];
            byDimension[item.dimension].push(item.value);
          }

          for (const [dimension, values] of Object.entries(byDimension)) {
            byDimension[dimension] = Array.from(new Set(values.filter(Boolean)));
          }

          const assignments: { session_id: string; participant_id: string; dimension: string; value: string }[] = [];

          for (const [dimension, values] of Object.entries(byDimension)) {
            const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
            let shuffledValues = [...values].sort(() => Math.random() - 0.5);

            for (let i = 0; i < shuffledParticipants.length; i++) {
              if (i > 0 && i % values.length === 0) {
                shuffledValues = [...values].sort(() => Math.random() - 0.5);
              }
              const randomValue = shuffledValues[i % values.length];
              assignments.push({
                session_id: sessionId!,
                participant_id: shuffledParticipants[i].id,
                dimension,
                value: randomValue,
              });
            }
          }

          if (assignments.length > 0) {
            const { error: assignErr } = await supabase
              .from("participant_dimension_assignments")
              .insert(assignments);
            if (assignErr) {
              console.error("Assignment error:", assignErr);
              toast.error("שגיאה בהקצאת ערכים למשתתפים");
              return;
            }
          }
        }
      } catch (e) {
        console.error(e);
        toast.error("שגיאה בהקצאת ערכים");
        return;
      }
    }

    const updateData: Record<string, unknown> = { status: "active" };
    if (gameType === "quiz" && quizMode === "king" && kingParticipantId) {
      updateData.king_participant_id = kingParticipantId;
    }

    const { error } = await supabase
      .from("game_sessions")
      .update(updateData)
      .eq("id", sessionId);

    if (error) {
      toast.error("שגיאה בהפעלת המשחק");
      return;
    }

    if (gameType === "challenge") {
      navigate(`/game/${sessionId}/challenge-play`, { state: { isHost: true } });
    } else {
      navigate(`/game/${sessionId}/play`, { state: { isHost: true } });
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
    <div className="min-h-screen gradient-hero flex items-center justify-center px-4">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <QuizLogo logoUrl={logoUrl} logoText={logoText} size="md" className="mb-4" />

        <div className="text-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 mb-4"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowRight className="!size-4" />
            חזרה
          </Button>
          <h1 className="text-3xl font-heading font-bold text-primary-foreground">
            {gameTitle}
          </h1>
        </div>

        <div className="bg-card rounded-3xl p-8 shadow-elevated space-y-6">
          {/* Media Section */}
          {youtubeUrl && <YouTubeEmbed url={youtubeUrl} />}
          {imageUrl && !youtubeUrl && (
            <div className="relative z-[20] w-full flex justify-center">
              <img 
                src={imageUrl} 
                alt={gameTitle} 
                className="w-full max-h-48 object-contain rounded-2xl cursor-zoom-in hover:opacity-90 transition-opacity pointer-events-auto" 
                onClick={(e) => {
                  e.stopPropagation();
                  console.log("Image clicked!"); // לוג לבדיקה בטרמינל דפדפן
                  setShowImageZoom(true);
                }}
              />
            </div>
          )}

          {/* Join Code Section */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground font-medium">קוד להצטרפות</p>
            <button onClick={handleCopyCode} className="group flex items-center justify-center gap-2 mx-auto">
              <span className="text-5xl font-heading font-bold tracking-[0.2em] text-foreground" dir="ltr">
                {joinCode}
              </span>
              {copied ? <Check className="size-5 text-accent" /> : <Copy className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />}
            </button>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="!size-4" /> שתף
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowQR(true)}>
                <QrCode className="!size-4" /> QR
              </Button>
            </div>
          </div>

          {/* Participants Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="size-4" />
              <span>משתתפים ({participants.length})</span>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 min-h-[120px] max-h-[200px] overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => (
                  <span key={p.id} className="px-3 py-1 bg-secondary rounded-full text-xs font-semibold">
                    {p.player_name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <Button
            variant="hero"
            size="xl"
            className="w-full mt-4"
            onClick={handleStartPlaying}
            disabled={participants.length === 0}
          >
            <Play className="!size-5" /> התחל משחק
          </Button>
        </div>

        {/* --- Modals (Keep at the very bottom of the main div) --- */}

        {/* QR Code Modal */}
        <AnimatePresence>
          {showQR && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center px-4"
              onClick={() => setShowQR(false)}
            >
              <motion.div
                className="bg-card rounded-3xl p-8 shadow-elevated text-center max-w-sm w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading font-bold text-lg">סרקו להצטרפות</h3>
                  <X className="size-6 cursor-pointer" onClick={() => setShowQR(false)} />
                </div>
                <div className="bg-white rounded-2xl p-6 inline-block">
                  <QRCodeSVG value={`${window.location.origin}/join/${joinCode}`} size={200} />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image Zoom Modal */}
        <AnimatePresence>
          {showImageZoom && imageUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 md:p-10"
              style={{ cursor: 'zoom-out' }}
              onClick={() => setShowImageZoom(false)}
            >
              <motion.div 
                className="relative max-w-5xl w-full h-full flex items-center justify-center"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300 transition-colors"
                  onClick={() => setShowImageZoom(false)}
                >
                  <X className="size-8" />
                </button>
                <img
                  src={imageUrl}
                  alt="Zoomed"
                  className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl cursor-default"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
};

export default GameLobby;
