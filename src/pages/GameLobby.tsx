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
  const [quizTitle, setQuizTitle] = useState("");
  const [quizMode, setQuizMode] = useState("genius");
  const [quizYoutubeUrl, setQuizYoutubeUrl] = useState<string | null>(null);
  const [quizImageUrl, setQuizImageUrl] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
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
        .select("join_code, quiz_id, status")
        .eq("id", sessionId)
        .single();

      if (error || !session) {
        toast.error("לא נמצא משחק");
        navigate("/my-quizzes");
        return;
      }

      setJoinCode(session.join_code);

      const { data: quiz } = await supabase
        .from("quizzes")
        .select("title, mode, youtube_url, image_url")
        .eq("id", session.quiz_id)
        .single();

      setQuizTitle(quiz?.title || "חידון");
      setQuizMode(quiz?.mode || "genius");
      setQuizYoutubeUrl(quiz?.youtube_url || null);
      setQuizImageUrl(quiz?.image_url || null);

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
    const shareText = `הצטרפו למשחק החידון "${quizTitle}" עם הקוד ${joinCode}\n${joinUrl}`;
    
    // Use Web Share API only on mobile (touch devices)
    const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (isMobile && navigator.share) {
      try {
        await navigator.share({
          title: `הצטרפו למשחק: ${quizTitle}`,
          text: `הצטרפו למשחק החידון "${quizTitle}" עם הקוד ${joinCode}`,
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

    if (quizMode === "king" && !kingParticipantId) {
      toast.error("יש לבחור מלך לפני תחילת המשחק");
      return;
    }

    const updateData: Record<string, unknown> = { status: "active" };
    if (quizMode === "king" && kingParticipantId) {
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

    navigate(`/game/${sessionId}/play`, { state: { isHost: true } });
  };

  const isKingMode = quizMode === "king";
  const isTribeMode = quizMode === "tribe";

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
        <div className="text-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 mb-4"
            onClick={() => navigate("/my-quizzes")}
          >
            <ArrowRight className="!size-4" />
            חזרה לחידונים
          </Button>
          <h1 className="text-3xl font-heading font-bold text-primary-foreground">
            {quizTitle}
          </h1>
          {(isKingMode || isTribeMode) && (
            <p className="text-primary-foreground/70 text-sm mt-1">
              {isKingMode ? "👑 מצב מלך" : "🏕️ מצב שבט"}
            </p>
          )}
        </div>

        <div className="bg-card rounded-3xl p-8 shadow-elevated space-y-6">
          {/* Quiz media */}
          {quizYoutubeUrl && (
            <YouTubeEmbed url={quizYoutubeUrl} />
          )}
          {quizImageUrl && !quizYoutubeUrl && (
            <img
              src={quizImageUrl}
              alt={quizTitle}
              className="w-full max-h-48 object-contain rounded-2xl"
            />
          )}

          {/* Join Code */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground font-medium">קוד להצטרפות</p>
            <button
              onClick={handleCopyCode}
              className="group flex items-center justify-center gap-2 mx-auto"
            >
              <span className="text-5xl font-heading font-bold tracking-[0.2em] text-foreground" dir="ltr">
                {joinCode}
              </span>
              {copied ? (
                <Check className="size-5 text-accent" />
              ) : (
                <Copy className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              )}
            </button>
            <p className="text-xs text-muted-foreground">לחץ להעתקה</p>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="!size-4" />
                שתף קישור
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowQR(true)}>
                <QrCode className="!size-4" />
                QR
              </Button>
            </div>
          </div>

          {/* King mode instruction */}
          {isKingMode && (
            <div className="bg-[hsl(var(--answer-yellow))]/10 border border-[hsl(var(--answer-yellow))]/30 rounded-xl p-3 text-center">
              <p className="text-sm font-medium text-foreground flex items-center justify-center gap-1">
                <Crown className="size-4 text-[hsl(var(--answer-yellow))]" />
                לחץ על שחקן כדי לבחור אותו כמלך
              </p>
            </div>
          )}

          {isTribeMode && (
            <div className="bg-[hsl(var(--answer-green))]/10 border border-[hsl(var(--answer-green))]/30 rounded-xl p-3 text-center">
              <p className="text-sm font-medium text-foreground">
                🏕️ במצב שבט, תפקיד המלך עובר בין השחקנים בכל שאלה
              </p>
            </div>
          )}

          {/* Participants */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="size-4" />
              <span>משתתפים ({participants.length})</span>
            </div>

            <div className="bg-muted/30 rounded-xl p-4 min-h-[120px] max-h-[300px] overflow-y-auto">
              {participants.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">
                  ממתין למשתתפים...
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <AnimatePresence>
                    {participants.map((p) => {
                      const isKing = kingParticipantId === p.id;
                      return (
                        <motion.button
                          key={p.id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={isKingMode ? () => handleSelectKing(p.id) : undefined}
                          className={`px-3 py-1.5 rounded-full text-sm font-heading font-semibold flex items-center gap-1 transition-all ${
                            isKing
                              ? "bg-[hsl(var(--answer-yellow))] text-white ring-2 ring-[hsl(var(--answer-yellow))]/50"
                              : "gradient-secondary text-secondary-foreground"
                          } ${isKingMode ? "cursor-pointer hover:scale-105" : "cursor-default"}`}
                        >
                          {isKing && <Crown className="size-3" />}
                          {p.player_name}
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* Start Button */}
          <Button
            variant="hero"
            size="xl"
            className="w-full"
            onClick={handleStartPlaying}
            disabled={participants.length === 0}
          >
            <Play className="!size-5" />
            התחל משחק
          </Button>
        </div>

        {/* QR Code Modal */}
        <AnimatePresence>
          {showQR && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
              onClick={() => setShowQR(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-card rounded-3xl p-8 shadow-elevated text-center max-w-sm w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading font-bold text-lg">סרקו להצטרפות</h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowQR(false)}>
                    <X className="!size-4" />
                  </Button>
                </div>
                <div className="bg-white rounded-2xl p-6 inline-block mx-auto">
                  <QRCodeSVG
                    value={`${window.location.origin}/join/${joinCode}`}
                    size={220}
                    level="M"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-4">קוד: <span className="font-bold font-heading tracking-wider">{joinCode}</span></p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default GameLobby;
