import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Loader2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import QuizLogo from "@/components/QuizLogo";

interface Participant {
  id: string;
  player_name: string;
  joined_at: string;
}

const PlayerWaiting = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const playerName = (location.state as { playerName?: string })?.playerName || "";
  const [gameTitle, setGameTitle] = useState("");
  const [gameDescription, setGameDescription] = useState("");
  const [gameType, setGameType] = useState<"quiz" | "challenge">("quiz");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoText, setLogoText] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    const loadSession = async () => {
      const { data: session } = await supabase
        .from("game_sessions")
        .select("join_code, quiz_id, challenge_id, status")
        .eq("id", sessionId)
        .single();

      if (!session) return;

      if (session.status === "active") {
        if (session.challenge_id) {
          navigate(`/game/${sessionId}/challenge-play`, { state: { playerName } });
        } else {
          navigate(`/game/${sessionId}/play`, { state: { playerName } });
        }
        return;
      }

      setJoinCode(session.join_code);

      if (session.challenge_id) {
        setGameType("challenge");
        const { data: challenge } = await supabase
          .from("challenges")
          .select("title, description, image_url, youtube_url, logo_url, logo_text")
          .eq("id", session.challenge_id)
          .single();

        setGameTitle(challenge?.title || "אתגר");
        setGameDescription(challenge?.description || "");
        setImageUrl(challenge?.image_url || null);
        setYoutubeUrl(challenge?.youtube_url || null);
        setLogoUrl(challenge?.logo_url || null);
        setLogoText(challenge?.logo_text || null);
      } else if (session.quiz_id) {
        setGameType("quiz");
        const { data: quiz } = await supabase
          .from("quizzes")
          .select("title, description, image_url, youtube_url, logo_url, logo_text")
          .eq("id", session.quiz_id)
          .single();

        setGameTitle(quiz?.title || "חידון");
        setGameDescription(quiz?.description || "");
        setImageUrl(quiz?.image_url || null);
        setYoutubeUrl(quiz?.youtube_url || null);
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

    const participantsChannel = supabase
      .channel(`waiting-participants-${sessionId}`)
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

    const sessionChannel = supabase
      .channel(`waiting-session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const updated = payload.new as { status: string; challenge_id?: string };
          if (updated.status === "active") {
            if (updated.challenge_id) {
              navigate(`/game/${sessionId}/challenge-play`, { state: { playerName } });
            } else {
              navigate(`/game/${sessionId}/play`, { state: { playerName } });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(participantsChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, [sessionId, navigate, playerName]);

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
          <QuizLogo logoUrl={logoUrl} logoText={logoText} size="md" className="mb-3" />
          {youtubeUrl && (
            <div className="mb-4">
              <YouTubeEmbed url={youtubeUrl} className="max-h-48" />
            </div>
          )}
          {imageUrl && !youtubeUrl && (
            <div className="mb-4 flex justify-center">
              <img src={imageUrl} alt={gameTitle} className="w-32 h-32 rounded-2xl object-cover shadow-lg" />
            </div>
          )}
          <h1 className="text-3xl font-heading font-bold text-primary-foreground">
            {gameTitle}
          </h1>
          {gameDescription && (
            <p className="text-primary-foreground/80 mt-2 text-sm">{gameDescription}</p>
          )}
          <p className="text-primary-foreground/70 mt-1" dir="ltr">קוד משחק: {joinCode}</p>
        </div>

        <div className="bg-card rounded-3xl p-8 shadow-elevated space-y-6">
          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">שלום,</p>
            <p className="text-2xl font-heading font-bold text-foreground">{playerName}</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="size-4" />
              <span>משתתפים ({participants.length})</span>
            </div>

            <div className="bg-muted/30 rounded-xl p-4 min-h-[100px] max-h-[250px] overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {participants.map((p) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`px-3 py-1.5 rounded-full text-sm font-heading font-semibold ${
                        p.player_name === playerName
                          ? "gradient-primary text-primary-foreground"
                          : "gradient-secondary text-secondary-foreground"
                      }`}
                    >
                      {p.player_name}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 text-muted-foreground py-4">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm font-medium">ממתין לתחילת המשחק...</span>
          </div>

          <div className="text-center">
            <Button variant="ghost" className="text-muted-foreground" onClick={() => navigate("/")}>
              <Home className="size-4" />
              חזרה לדף הבית
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PlayerWaiting;
