import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { Gamepad2, ArrowLeft } from "lucide-react";

const JoinGame = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const handleCodeChange = (value: string) => {
    const numeric = value.replace(/\D/g, "").slice(0, 5);
    setCode(numeric);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 5) {
      navigate(`/game/${code}/lobby`);
    }
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
          QuizMaster
        </Link>

        <div className="bg-card rounded-3xl p-8 shadow-elevated">
          <div className="w-16 h-16 gradient-secondary rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Gamepad2 className="!size-8 text-secondary-foreground" />
          </div>

          <h2 className="text-2xl font-heading font-bold mb-2">הצטרפו למשחק</h2>
          <p className="text-muted-foreground mb-6">הכניסו את קוד המשחק</p>

          <form onSubmit={handleJoin} className="space-y-4">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="12345"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              className="text-center text-3xl font-heading font-bold h-16 tracking-[0.3em] rounded-xl"
              maxLength={5}
              dir="ltr"
            />

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
