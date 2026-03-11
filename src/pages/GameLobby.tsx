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
  const [showImageModal, setShowImageModal] = useState(false);

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

    // For challenges, assign random dimension values to each participant
    if (gameType === "challenge" && challengeId) {
      try {
        const { data: dimItems } = await supabase
          .from("challenge_dimension_items")
          .select("dimension, value")
          .eq("challenge_id", challengeId);

        if (dimItems && dimItems.length > 0) {
          // Group by dimension + dedupe values
          const byDimension: Record<string, string[]> = {};
          for (const item of dimItems) {
            if (!byDimension[item.dimension]) byDimension[item.dimension] = [];
            byDimension[item.dimension].push(item.value);
          }

          for (const [dimension, values] of Object.entries(byDimension)) {
            byDimension[dimension] = Array.from(new Set(values.filter(Boolean)));
          }

          const hasAtLeastOneRealChoice = Object.values(byDimension).some((values) => values.length > 1);

          if (participants.length > 1 && !hasAtLeastOneRealChoice) {
            toast.error("כדי שכל שחקן יקבל ערכים שונים, צריך לפחות שני ערכים באחד המימדים");
            return;
          }

          // Assign random values per dimension, with shuffled participant order each time
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

  const isKingMode = gameType === "quiz" && quizMode === "king";
  const isTribeMode = gameType === "quiz" && quizMode === "tribe";
  const isMajorityMode = gameType === "quiz" && quizMode === "majority";

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
          {isKingMode && (
            <p className="text-primary-foreground/70 text-sm mt-1">👑 מצב מלך</p>
          )}
          {isTribeMode && (
            <p className="text-primary-foreground/70 text-sm mt-1">🏕️ מצב שבט</p>
          )}
          {isMajorityMode && (
            <p className="text-primary-foreground/70 text-sm mt-1">🗳️ הרוב קובע</p>
          )}
          {gameType === "challenge" && (
            <p className="text-primary-foreground/70 text-sm mt-1">🎯 אתגר</p>
          )}
        </div>

        <div className="bg-card rounded-3xl p-8 shadow-elevated space-y-6">
          {/* Media */}
          {youtubeUrl && <YouTubeEmbed url={youtubeUrl} />}
          {imageUrl && !youtubeUrl && (
            <button
              type="button"
              className="w-full"
              onClick={() => setShowImageModal(true)}
            >
              <img
                src={imageUrl}
                alt={gameTitle}
                className="w-full max-h-48 object-contain rounded-2xl cursor-zoom-in"
              />
            </button>
          )}

          {/* Join Code */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground font-medium">קוד להצטרפות</p>
            <button onClick={handleCopyCode} className="group flex items-center justify-center gap-2 mx-auto">
              <span className="text-5xl font-heading font-bold tracking-[0.2em] text-foreground" dir="ltr">
                {joinCode}
              </span>
              {copied ? <Check className="size-5 text-accent" /> : <Copy className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />}
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
                <p className="text-center text-muted-foreground text-sm py-8">ממתין למשתתפים...</p>
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
                  <QRCodeSVG value={`${window.location.origin}/join/${joinCode}`} size={220} level="M" />
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  קוד: <span className="font-bold font-heading tracking-wider">{joinCode}</span>
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image Modal */}
        <AnimatePresence>
          {showImageModal && imageUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
              onClick={() => setShowImageModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card rounded-3xl p-4 shadow-elevated max-w-3xl w-full flex flex-col items-stretch"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-heading font-bold text-lg truncate">
                    {gameTitle}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowImageModal(false)}
                  >
                    <X className="!size-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-center">
                  <img
                    src={imageUrl}
                    alt={gameTitle}
                    className="max-h-[80vh] w-auto max-w-full object-contain rounded-2xl"
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default GameLobby;
```
