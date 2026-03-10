import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client"; 
import { toast } from "sonner";

const SocialAuthButtons = () => {
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const handleAppleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin }
    });
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
