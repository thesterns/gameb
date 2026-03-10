import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client"; 
import { toast } from "sonner";

const SocialAuthButtons = () => {
  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // אנחנו מוחקים את ה-redirectTo כדי שהשרת יחליט לבד
          skipBrowserRedirect: false,
          queryParams: {
            prompt: 'select_account',
          }
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error("שגיאה בהתחברות");
      console.error("Auth error:", error);
    }
  };

  return (
    <div className="space-y-3">
      <Button 
        type="button"
        variant="outline" 
        className="w-full py-6" 
        onClick={handleGoogleLogin}
      >
        התחברות עם Google
      </Button>
    </div>
  );
};

export default SocialAuthButtons;
