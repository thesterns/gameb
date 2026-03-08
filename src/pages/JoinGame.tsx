import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { useNavigate, Link, useParams } from "react-router-dom";
import { Gamepad2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const JoinGame = () => {
  const navigate = useNavigate();
  const { directLink } = useParams<{ directLink?: string }>();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"code" | "name">("code");
  const [sessionId, setSessionId] = useState("");
  const [joining, setJoining] = useState(false);
  const [codeError, setCodeError] = useState("");

  // Auto-submit code from direct link
  useEffect(() => {
    if (directLink && /^\d{5}$/.test(directLink)) {
      setCode(directLink);
      // Auto-submit
      (async () => {
        const { data: session } = await supabase
          .from("game_sessions")
          .select("id, status")
          .eq("join_code", directLink)
          .single();

        if (!session) {
          setCodeError("קוד משחק לא נמצא, נסו שוב");
          return;
        }
        if (session.status !== "lobby") {
          setCodeError("המשחק כבר התחיל או הסתיים");
          return;
        }
        setSessionId(session.id);
        setStep("name");
      })();
    }
  }, [directLink]);

  const handleCodeChange = (value: string) => {
    const numeric = value.replace(/\D/g, "").slice(0, 5);
    setCode(numeric);
    if (codeError) setCodeError("");
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 5) return;
    setCodeError("");

    const { data: session, error } = await supabase
      .from("game_sessions")
      .select("id, status")
      .eq("join_code", code)
      .single();

    if (error || !session) {
      setCodeError("קוד משחק לא נמצא, נסו שוב");
      return;
    }

    if (session.status !== "lobby") {
      setCodeError("המשחק כבר התחיל או הסתיים");
      return;
    }

    setSessionId(session.id);
    setStep("name");
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setJoining(true);
    const { error } = await supabase
      .from("game_participants")
      .insert({ session_id: sessionId, player_name: name.trim() });

    if (error) {
      toast.error("שגיאה בהצטרפות למשחק");
      setJoining(false);
      return;
    }

    navigate(`/game/${sessionId}/waiting`, { state: { playerName: name.trim() } });
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center px-4">
      <motion.div
        className="w-full max-w-sm text-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Link to="/" className="text-3xl font-heading font-bold text-primary-foreground inline-block mb-8">
          לך תדע
        </Link>

        <div className="bg-card rounded-3xl p-8 shadow-elevated">
          <div className="w-16 h-16 gradient-secondary rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Gamepad2 className="!size-8 text-secondary-foreground" />
          </div>

          {step === "code" ? (
            <>
              <h2 className="text-2xl font-heading font-bold mb-2">הצטרפו למשחק</h2>
              <p className="text-muted-foreground mb-6">הכניסו את קוד המשחק</p>

              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="12345"
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    className={`text-center text-3xl font-heading font-bold h-16 tracking-[0.3em] rounded-xl ${
                      codeError ? "border-destructive ring-2 ring-destructive/30" : ""
                    }`}
                    maxLength={5}
                    dir="ltr"
                  />
                  {codeError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 text-sm font-semibold text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-center"
                    >
                      {codeError}
                    </motion.p>
                  )}
                </div>
                <Button
                  type="submit"
                  variant="hero"
                  size="xl"
                  className="w-full"
                  disabled={code.length !== 5}
                >
                  <ArrowLeft className="!size-5" />
                  המשך
                </Button>
              </form>
            </>
          ) : (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className="text-2xl font-heading font-bold mb-2">מה השם שלך?</h2>
              <p className="text-muted-foreground mb-6">הכניסו כינוי למשחק</p>

              <form onSubmit={handleJoin} className="space-y-4">
                <Input
                  type="text"
                  placeholder="הכינוי שלך"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-center text-xl font-heading font-bold h-14 rounded-xl"
                  maxLength={20}
                  autoFocus
                />
                <Button
                  type="submit"
                  variant="hero"
                  size="xl"
                  className="w-full"
                  disabled={!name.trim() || joining}
                >
                  <ArrowLeft className="!size-5" />
                  {joining ? "מצטרף..." : "הצטרף למשחק"}
                </Button>
              </form>
            </motion.div>
          )}
        </div>

        <Link
          to="/"
          className="inline-block mt-6 text-primary-foreground/70 hover:text-primary-foreground text-sm transition-colors"
        >
          חזרה לדף הראשי
        </Link>
      </motion.div>
    </div>
  );
};

export default JoinGame;
