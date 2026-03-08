import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-heading font-bold text-gradient">404</h1>
        <p className="text-xl text-muted-foreground">הדף לא נמצא</p>
        <Button variant="hero" onClick={() => navigate("/dashboard")}>
          <ArrowRight className="!size-4" />
          חזרה לדשבורד
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
