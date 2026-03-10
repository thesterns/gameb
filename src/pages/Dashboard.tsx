import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeDashboard = async () => {
      // 1. נותנים ל-Supabase רגע קטן לעבד את ה-Token מה-URL
      // בלי השהייה הזו, הוא יגיד שאין session
      await new Promise(resolve => setTimeout(resolve, 1000));

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.log("No session found, redirecting to login");
        navigate("/login");
      } else {
        console.log("Session confirmed!", session.user.email);
        setIsLoading(false);
      }
    };

    initializeDashboard();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-lg">מאמת חיבור מגוגל...</p>
      </div>
    );
  }

  return (
    <div>
      {/* כאן שים את כל תוכן ה-Dashboard המקורי שלך */}
      <h1>ברוך הבא לדשבורד!</h1>
      <button onClick={() => supabase.auth.signOut().then(() => navigate("/"))}>התנתק</button>
    </div>
  );
};

export default Dashboard;
