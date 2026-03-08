import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const CreateQuiz = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold text-gradient">QuizMaster</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowRight className="!size-4" />
            חזרה לדשבורד
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-3xl font-heading font-bold mb-8">צור חידון חדש</h2>
          <div className="bg-card rounded-2xl p-8 shadow-card text-center">
            <p className="text-muted-foreground">דף יצירת חידון - בקרוב!</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default CreateQuiz;
