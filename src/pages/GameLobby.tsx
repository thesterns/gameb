import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Users, Play, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Participant {
  id: string;
  player_name: string;
  joined_at: string;
}

const GameLobby = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [quizTitle, setQuizTitle] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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
        .select("title")
        .eq("id", session.quiz_id)
        .single();

      setQuizTitle(quiz?.title || "חידון");

      // Load existing participants
      const { data: existingParticipants } = await supabase
        .from("game_participants")
        .select("id, player_name, joined_at")
        .eq("session_id", sessionId)
        .order("joined_at");

      setParticipants(existingParticipants || []);
      setLoading(false);
    };

    loadSession();

    // Subscribe to realtime participant changes
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

  const handleStartPlaying = async () => {
    if (participants.length === 0) {
      toast.error("צריך לפחות משתתף אחד כדי להתחיל");
      return;
    }

    const { error } = await supabase
      .from("game_sessions")
      .update({ status: "active" })
      .eq("id", sessionId);

    if (error) {
      toast.error("שגיאה בהפעלת המשחק");
      return;
    }

    navigate(`/game/${sessionId}/play`, { state: { isHost: true } });
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
        </div>

        <div className="bg-card rounded-3xl p-8 shadow-elevated space-y-6">
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
          </div>

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
                    {participants.map((p) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="gradient-secondary text-secondary-foreground px-3 py-1.5 rounded-full text-sm font-heading font-semibold"
                      >
                        {p.player_name}
                      </motion.div>
                    ))}
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
      </motion.div>
    </div>
  );
};

export default GameLobby;
