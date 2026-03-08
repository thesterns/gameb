import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, Users } from "lucide-react";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import QuizLogo from "@/components/QuizLogo";

const ChallengePlay = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isHost = (location.state as { isHost?: boolean })?.isHost || false;
  const playerName = (location.state as { playerName?: string })?.playerName || "";

  const [challenge, setChallenge] = useState<{
    title: string;
    description: string | null;
    image_url: string | null;
    youtube_url: string | null;
    logo_url: string | null;
    logo_text: string | null;
  } | null>(null);
  const [participants, setParticipants] = useState<{ id: string; player_name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    const load = async () => {
      const { data: session } = await supabase
        .from("game_sessions")
        .select("challenge_id")
        .eq("id", sessionId)
        .single();

      if (!session?.challenge_id) {
        navigate("/dashboard");
        return;
      }

      const { data: ch } = await supabase
        .from("challenges")
        .select("title, description, image_url, youtube_url, logo_url, logo_text")
        .eq("id", session.challenge_id)
        .single();

      setChallenge(ch || null);

      const { data: parts } = await supabase
        .from("game_participants")
        .select("id, player_name")
        .eq("session_id", sessionId)
        .order("joined_at");

      setParticipants(parts || []);
      setLoading(false);
    };

    load();
  }, [sessionId, navigate]);

  if (loading || !challenge) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">טוען...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center px-4">
      <motion.div
        className="w-full max-w-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <QuizLogo logoUrl={challenge.logo_url} logoText={challenge.logo_text} size="md" className="mb-4" />

        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 text-primary-foreground/70 text-sm mb-2">
            <Target className="size-4" />
            <span>אתגר</span>
          </div>
          <h1 className="text-3xl font-heading font-bold text-primary-foreground">
            {challenge.title}
          </h1>
          {challenge.description && (
            <p className="text-primary-foreground/80 mt-2">{challenge.description}</p>
          )}
        </div>

        <div className="bg-card rounded-3xl p-8 shadow-elevated space-y-6">
          {challenge.youtube_url && <YouTubeEmbed url={challenge.youtube_url} />}
          {challenge.image_url && !challenge.youtube_url && (
            <img src={challenge.image_url} alt={challenge.title} className="w-full max-h-64 object-contain rounded-2xl" />
          )}

          {/* Participants */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="size-4" />
              <span>משתתפים ({participants.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <span
                  key={p.id}
                  className={`px-3 py-1.5 rounded-full text-sm font-heading font-semibold ${
                    p.player_name === playerName
                      ? "gradient-primary text-primary-foreground"
                      : "gradient-secondary text-secondary-foreground"
                  }`}
                >
                  {p.player_name}
                </span>
              ))}
            </div>
          </div>

          <div className="text-center py-4">
            <p className="text-lg font-heading font-bold text-foreground">🎯 האתגר התחיל!</p>
            {!isHost && playerName && (
              <p className="text-muted-foreground text-sm mt-1">שלום {playerName}, בהצלחה!</p>
            )}
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate(isHost ? "/dashboard" : "/")}
          >
            <ArrowRight className="!size-4" />
            {isHost ? "חזרה לדשבורד" : "חזרה לדף הבית"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default ChallengePlay;
