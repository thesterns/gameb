import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, ArrowRight } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("שגיאה בשליחת המייל", { description: error.message });
    } else {
      setSent(true);
      toast.success("מייל איפוס נשלח בהצלחה!");
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
          <h2 className="text-2xl font-heading font-bold">שכחת סיסמה?</h2>
          <p className="text-muted-foreground mt-1">נשלח לך קישור לאיפוס הסיסמה</p>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-card space-y-5">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
                <Mail className="size-8 text-accent" />
              </div>
              <p className="text-foreground font-medium">בדוק את תיבת המייל שלך</p>
              <p className="text-sm text-muted-foreground">
                שלחנו קישור לאיפוס סיסמה ל-<br />
                <span className="font-semibold text-foreground" dir="ltr">{email}</span>
              </p>
              <Link to="/login">
                <Button variant="outline" className="mt-4">
                  <ArrowRight className="!size-4" />
                  חזרה להתחברות
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
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

              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                {loading ? "שולח..." : "שלח קישור איפוס"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                <Link to="/login" className="text-primary font-semibold hover:underline">
                  חזרה להתחברות
                </Link>
              </p>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
