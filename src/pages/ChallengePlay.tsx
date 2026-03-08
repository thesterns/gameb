import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, Users, Clock, MapPin, User, Package, Sparkles } from "lucide-react";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import QuizLogo from "@/components/QuizLogo";

const DIMENSION_META: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  time: { label: "זמן", icon: Clock, color: "text-[hsl(var(--answer-blue))]" },
  place: { label: "מקום", icon: MapPin, color: "text-[hsl(var(--answer-green))]" },
  person: { label: "אדם", icon: User, color: "text-[hsl(var(--answer-red))]" },
  object: { label: "חפץ", icon: Package, color: "text-[hsl(var(--answer-yellow))]" },
  extra: { label: "נוסף", icon: Sparkles, color: "text-[hsl(var(--answer-purple))]" },
};

interface Assignment {
  dimension: string;
  value: string;
}

interface ParticipantWithAssignments {
  id: string;
  player_name: string;
  assignments: Assignment[];
}

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
  const [participantsWithAssignments, setParticipantsWithAssignments] = useState<ParticipantWithAssignments[]>([]);
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
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

      const { data: allAssignments } = await supabase
        .from("participant_dimension_assignments")
        .select("participant_id, dimension, value")
        .eq("session_id", sessionId);

      const assignmentMap: Record<string, Assignment[]> = {};
      for (const a of allAssignments || []) {
        if (!assignmentMap[a.participant_id]) assignmentMap[a.participant_id] = [];
        assignmentMap[a.participant_id].push({ dimension: a.dimension, value: a.value });
      }

      const pwa: ParticipantWithAssignments[] = (parts || []).map((p) => ({
        ...p,
        assignments: assignmentMap[p.id] || [],
      }));

      setParticipantsWithAssignments(pwa);

      // Find current player's assignments (by name match for non-host)
      if (!isHost && playerName) {
        const myP = pwa.find((p) => p.player_name === playerName);
        if (myP) {
          setMyParticipantId(myP.id);
          setMyAssignments(myP.assignments);
        }
      }

      setLoading(false);
    };

    load();
  }, [sessionId, navigate, isHost, playerName]);

  if (loading || !challenge) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">טוען...</p>
      </div>
    );
  }

  const dimensionOrder = ["time", "place", "person", "object", "extra"];

  const renderAssignments = (assignments: Assignment[]) => {
    const sorted = [...assignments].sort(
      (a, b) => dimensionOrder.indexOf(a.dimension) - dimensionOrder.indexOf(b.dimension)
    );
    return (
      <div className="space-y-2">
        {sorted.map((a) => {
          const meta = DIMENSION_META[a.dimension];
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <motion.div
              key={a.dimension}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3"
            >
              <Icon className={`size-5 ${meta.color} shrink-0`} />
              <span className="text-sm font-medium text-muted-foreground w-12">{meta.label}</span>
              <span className="font-heading font-bold text-foreground">{a.value}</span>
            </motion.div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center px-4 py-8">
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

          {/* Player view: show their own assignments */}
          {!isHost && myAssignments.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-heading font-bold text-lg text-center">🎯 הערכים שלך</h3>
              {renderAssignments(myAssignments)}
            </div>
          )}

          {!isHost && myAssignments.length === 0 && (
            <div className="text-center py-4">
              <p className="text-muted-foreground">לא הוקצו ערכים</p>
            </div>
          )}

          {/* Host view: show all participants and their assignments */}
          {isHost && (
            <div className="space-y-4">
              <h3 className="font-heading font-bold text-lg flex items-center gap-2">
                <Users className="size-5" />
                משתתפים ({participantsWithAssignments.length})
              </h3>
              {participantsWithAssignments.map((p) => (
                <div key={p.id} className="border border-border rounded-2xl p-4 space-y-2">
                  <h4 className="font-heading font-bold text-foreground">{p.player_name}</h4>
                  {p.assignments.length > 0 ? renderAssignments(p.assignments) : (
                    <p className="text-sm text-muted-foreground">לא הוקצו ערכים</p>
                  )}
                </div>
              ))}
            </div>
          )}

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
