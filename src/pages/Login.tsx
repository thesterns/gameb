import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, Mail, Lock } from "lucide-react";
import SocialAuthButtons from "@/components/SocialAuthButtons";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        navigate("/dashboard");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("שגיאה בהתחברות", { description: error.message });
    } else {
      toast.success("התחברת בהצלחה!");
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-heading font-bold text-gradient inline-block mb-2">
            zgame
          </Link>
          <h2 className="text-2xl font-heading font-bold">התחברות</h2>
          <p className="text-muted-foreground mt-1">ברוכים השבים!</p>
        </div>

        <form onSubmit={handleLogin} className="bg-card rounded-2xl p-8 shadow-card space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">כתובת מייל</Label>
            <div className="relative">
              <Mail className="absolute right-3 top-3 size-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pr-10"
                required
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">סיסמה</Label>
            <div className="relative">
              <Lock className="absolute right-3 top-3 size-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                required
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">
              שכחת סיסמה?
            </Link>
          </div>

          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
            <LogIn className="!size-5" />
            {loading ? "מתחבר..." : "התחברות"}
          </Button>

          <SocialAuthButtons />

          <p className="text-center text-sm text-muted-foreground">
            אין לך חשבון?{" "}
            <Link to="/register" className="text-primary font-semibold hover:underline">
              הרשמה
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;
