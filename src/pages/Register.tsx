import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Mail, Lock, User } from "lucide-react";
import SocialAuthButtons from "@/components/SocialAuthButtons";

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast.error("שגיאה בהרשמה", { description: error.message });
    } else {
      toast.success("נרשמת בהצלחה!", {
        description: "בדוק את המייל שלך לאימות החשבון",
      });
      navigate("/login");
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
            לך תדע
          </Link>
          <h2 className="text-2xl font-heading font-bold">הרשמה</h2>
          <p className="text-muted-foreground mt-1">צרו חשבון חדש והתחילו ליצור חידונים</p>
        </div>

        <form onSubmit={handleRegister} className="bg-card rounded-2xl p-8 shadow-card space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">שם מלא</Label>
            <div className="relative">
              <User className="absolute right-3 top-3 size-4 text-muted-foreground" />
              <Input
                id="name"
                placeholder="השם שלך"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pr-10"
                required
              />
            </div>
          </div>

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
                placeholder="לפחות 6 תווים"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                required
                dir="ltr"
                minLength={6}
              />
            </div>
          </div>

          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
            <UserPlus className="!size-5" />
            {loading ? "נרשם..." : "הרשמה"}
          </Button>

          <SocialAuthButtons />

          <p className="text-center text-sm text-muted-foreground">
            כבר יש לך חשבון?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              התחברות
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
};

export default Register;
