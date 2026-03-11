import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoText, setLogoText] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  
  // המפתח לפתרון: State פשוט להגדלת תמונה
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const loadSession = async () => {
      const { data: session, error } = await supabase
        .from("game_sessions")
        .select("join_code, quiz_id, challenge_id")
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
          .select("title, youtube_url, image_url, logo_url, logo_text")
          .eq("id", session.quiz_id)
          .single();

        setGameTitle(quiz?.title || "חידון");
        setYoutubeUrl(quiz?.youtube_url || null);
        setImageUrl(quiz?.image_url || null);
        setLogoUrl((quiz as any)?.logo_url || null);
        setLogoText((quiz as any)?.logo_text || null);
      }

      const { data: participantsData } = await supabase
        .from("game_participants")
        .select("id, player_name, joined_at")
        .eq("session_id", sessionId)
        .order("joined_at");

      setParticipants(participantsData || []);
      setLoading(false);
    };

    loadSession();

    const channel = supabase
      .channel(`lobby-${sessionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_participants", filter: `session_id=eq.${sessionId}` }, 
      (payload) => {
        setParticipants((prev) => [...prev, payload.new as Participant]);
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, navigate]);

  const handleStart = async () => {
    if (participants.length === 0) {
      toast.error("צריך לפחות משתתף אחד");
      return;
    }
    await supabase.from("game_sessions").update({ status: "active" }).eq("id", sessionId);
    navigate(gameType === "challenge" ? `/game/${sessionId}/challenge-play` : `/game/${sessionId}/play`, { state: { isHost: true } });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white">טוען...</div>;

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center px-4 relative overflow-x-hidden">
      <motion.div className="w-full max-w-md z-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        
        <QuizLogo logoUrl={logoUrl} logoText={logoText} size="md" className="mb-4" />

        <div className="bg-card rounded-3xl p-8 shadow-elevated space-y-6 relative">
          
          <h1 className="text-2xl font-bold text-center text-foreground">{gameTitle}</h1>

          {/* Media Section */}
          {youtubeUrl && <YouTubeEmbed url={youtubeUrl} />}
          {imageUrl && !youtubeUrl && (
            <div 
              className="relative group cursor-pointer" 
              onClick={() => {
                console.log("Zoom trigger clicked");
                setIsZoomed(true);
              }}
            >
              <img 
                src={imageUrl} 
                alt="Quiz" 
                className="w-full max-h-48 object-contain rounded-2xl hover:scale-[1.02] transition-transform" 
              />
              <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <ZoomIn className="size-5" />
              </div>
            </div>
          )}

          {/* Join Code */}
          <div className="text-center bg-muted/30 py-4 rounded-2xl">
            <p className="text-xs text-muted-foreground uppercase font-bold mb-1">קוד הצטרפות</p>
            <div className="text-4xl font-heading font-bold tracking-[0.2em]">{joinCode}</div>
          </div>

          <Button variant="hero" size="xl" className="w-full" onClick={handleStart} disabled={participants.length === 0}>
            <Play className="mr-2" /> התחל משחק ({participants.length})
          </Button>
        </div>
      </motion.div>

      {/* --- Overlay ההגדלה העצמאי - הכי בטוח שיש --- */}
      <AnimatePresence>
        {isZoomed && imageUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4"
            onClick={() => setIsZoomed(false)} // סגירה בלחיצה על הרקע
          >
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="relative max-w-5xl w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()} // מונע סגירה כשלוחצים על התמונה עצמה
            >
              <button 
                className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 p-2 rounded-full text-white transition-colors"
                onClick={() => setIsZoomed(false)}
              >
                <X className="size-8" />
              </button>
              
              <img 
                src={imageUrl} 
                alt="Zoomed" 
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Code Modal (אם תרצה להשאיר) */}
      <AnimatePresence>
        {showQR && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowQR(false)}>
            <div className="bg-card p-8 rounded-3xl max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
              <QRCodeSVG value={`${window.location.origin}/join/${joinCode}`} size={200} />
              <Button className="mt-4 w-full" onClick={() => setShowQR(false)}>סגור</Button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GameLobby;
