import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client"; 
import { toast } from "sonner";

const SocialAuthButtons = () => {
  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // שימוש בכתובת המדויקת שהגדרת ב-Supabase
          redirectTo: 'https://game.makeitbetter.co.il/auth/callback',
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error("שגיאה בהתחברות");
    }
  };

  const handleAppleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: 'https://game.makeitbetter.co.il/auth/callback',
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error("שגיאה בהתחברות");
    }
  };

  return (
    <div className="space-y-3">
      <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>
        התחברות עם Google
      </Button>
      <Button variant="outline" className="w-full" onClick={handleAppleLogin}>
        התחברות עם Apple
      </Button>
    </div>
  );
};

export default SocialAuthButtons;
