import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Zap, Users, Trophy, Sparkles, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import heroImage from "@/assets/hero-quiz.png";

const features = [
  {
    icon: Zap,
    title: "משחקים בזמן אמת",
    description: "צרו משחקים ושחקו עם חברים בזמן אמת",
    color: "bg-answer-red/10 text-answer-red",
  },
  {
    icon: Users,
    title: "עד 100 שחקנים",
    description: "הזמינו חברים למשחק עם קוד פשוט",
    color: "bg-answer-blue/10 text-answer-blue",
  },
  {
    icon: Trophy,
    title: "3 מצבי משחק",
    description: "גאון, מלך ושבט - כל אחד חוויה שונה",
    color: "bg-answer-green/10 text-answer-green",
  },
  {
    icon: Sparkles,
    title: "עיצוב מותאם",
    description: "בחרו סגנון עיצוב שמתאים לאירוע שלכם",
    color: "bg-answer-yellow/10 text-answer-yellow",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.3 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const Index = () => {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [joiningGame, setJoiningGame] = useState(false);
  const [joinError, setJoinError] = useState("");

  const handleJoinFromHome = async () => {
    if (joinCode.length !== 5) return;
    setJoiningGame(true);

    const { data: session, error } = await supabase
      .from("game_sessions")
      .select("id, status")
      .eq("join_code", joinCode)
      .single();

    if (error || !session) {
      toast.error("קוד משחק לא נמצא");
      setJoiningGame(false);
      return;
    }

    if (session.status !== "lobby") {
      toast.error("המשחק כבר התחיל או הסתיים");
      setJoiningGame(false);
      return;
    }

    // Navigate to join page with session already resolved – skip code step
    navigate(`/join/${joinCode}`);
    setJoiningGame(false);
  };

  // Redirect authenticated users (e.g. after OAuth callback) to dashboard
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")) {
        navigate("/dashboard");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <h1 className="text-2xl font-heading font-bold text-gradient">
          לך תדע
        </h1>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => navigate("/login")}>
            התחברות
          </Button>
          <Button variant="hero" onClick={() => navigate("/register")}>
            הרשמה
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 pt-8 pb-16 max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-10">
          <motion.div
            className="flex-1 text-center lg:text-right"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-6xl font-heading font-black leading-tight mb-6">
              משחקים שעושים
              <br />
              <span className="text-gradient">את ההבדל</span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-lg mx-auto lg:mx-0 lg:mr-0">
              צרו משחקים מדהימים, הזמינו שחקנים ותיהנו ממשחק בזמן אמת.
              מושלם לשיעורים, אירועים וכיף עם חברים!
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start max-w-md mx-auto lg:mx-0">
              <Input
                placeholder="הכניסו קוד משחק"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                className="text-center text-lg font-heading tracking-widest h-14 rounded-xl"
                dir="ltr"
              />
              <Button
                variant="hero"
                size="xl"
                disabled={joinCode.length !== 5 || joiningGame}
                onClick={handleJoinFromHome}
              >
                <ArrowLeft className="!size-5" />
                {joiningGame ? "בודק..." : "הצטרפו למשחק"}
              </Button>
            </div>
          </motion.div>

          <motion.div
            className="flex-1 flex justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative">
              <div className="absolute inset-0 gradient-hero rounded-3xl blur-3xl opacity-20 scale-110" />
              <img
                src={heroImage}
                alt="לך תדע - משחקים אינטראקטיביים"
                className="relative z-10 w-72 md:w-96 animate-float drop-shadow-2xl"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h3 className="text-3xl md:text-4xl font-heading font-bold mb-4">
            למה לך תדע?
          </h3>
          <p className="text-muted-foreground text-lg">
            הכלי המושלם ליצירת משחקים אינטראקטיביים
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={item}
              className="bg-card rounded-2xl p-6 shadow-card hover:shadow-elevated transition-shadow duration-300 text-center"
            >
              <div
                className={`w-14 h-14 rounded-xl ${feature.color} flex items-center justify-center mx-auto mb-4`}
              >
                <feature.icon className="!size-7" />
              </div>
              <h4 className="font-heading font-bold text-lg mb-2">
                {feature.title}
              </h4>
              <p className="text-muted-foreground text-sm">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Join Game CTA */}
      <section className="px-6 py-16">
        <motion.div
          className="max-w-2xl mx-auto gradient-primary rounded-3xl p-8 md:p-12 text-center text-primary-foreground shadow-elevated"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h3 className="text-3xl font-heading font-bold mb-4">
            יש לכם קוד משחק?
          </h3>
          <p className="text-primary-foreground/80 mb-6 text-lg">
            הכניסו את הקוד והצטרפו למשחק תוך שניות
          </p>
          <Button
            variant="outline"
            size="xl"
            className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
            onClick={() => navigate("/join")}
          >
            הצטרפו עכשיו
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-muted-foreground text-sm border-t border-border">
        <p>© 2026 לך תדע. כל הזכויות שמורות.</p>
      </footer>
    </div>
  );
};

export default Index;
