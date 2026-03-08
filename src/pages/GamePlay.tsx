import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, CheckCircle2, XCircle, Trophy, ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface Question {
  id: string;
  text: string;
  sort_order: number;
}

interface Answer {
  id: string;
  text: string;
  is_correct: boolean;
  sort_order: number;
}

const ANSWER_COLORS = [
  "bg-[hsl(var(--answer-red))]",
  "bg-[hsl(var(--answer-blue))]",
  "bg-[hsl(var(--answer-yellow))]",
  "bg-[hsl(var(--answer-green))]",
  "bg-[hsl(var(--answer-purple))]",
  "bg-[hsl(var(--answer-orange))]",
];

const GamePlay = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { playerName?: string; isHost?: boolean } | null;
  const isHost = state?.isHost || false;
  const playerName = state?.playerName || "";

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(30);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gameFinished, setGameFinished] = useState(false);
  const [responseCount, setResponseCount] = useState(0);
  const [participantCount, setParticipantCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load game data
  useEffect(() => {
    if (!sessionId) return;

    const load = async () => {
      const { data: session } = await supabase
        .from("game_sessions")
        .select("quiz_id, current_question_index")
        .eq("id", sessionId)
        .single();

      if (!session) return;

      const { data: quiz } = await supabase
        .from("quizzes")
        .select("time_per_question")
        .eq("id", session.quiz_id)
        .single();

      setTotalTime(quiz?.time_per_question || 30);

      const { data: qs } = await supabase
        .from("questions")
        .select("id, text, sort_order")
        .eq("quiz_id", session.quiz_id)
        .order("sort_order");

      setQuestions(qs || []);
      setCurrentIndex(session.current_question_index || 0);

      // Get participant count
      const { count } = await supabase
        .from("game_participants")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId);

      setParticipantCount(count || 0);

      // If player, find participant id
      if (!isHost && playerName) {
        const { data: participant } = await supabase
          .from("game_participants")
          .select("id")
          .eq("session_id", sessionId)
          .eq("player_name", playerName)
          .single();

        setParticipantId(participant?.id || null);
      }

      setLoading(false);
    };

    load();
  }, [sessionId, isHost, playerName]);

  // Load answers for current question
  useEffect(() => {
    if (questions.length === 0 || currentIndex >= questions.length) return;

    const loadAnswers = async () => {
      const q = questions[currentIndex];
      const { data } = await supabase
        .from("answers")
        .select("id, text, is_correct, sort_order")
        .eq("question_id", q.id)
        .order("sort_order");

      setAnswers(data || []);
      setSelectedAnswerId(null);
      setTimeUp(false);
      setTimeLeft(totalTime);
      setResponseCount(0);
    };

    loadAnswers();
  }, [questions, currentIndex, totalTime]);

  // Timer countdown
  useEffect(() => {
    if (loading || timeUp || questions.length === 0 || currentIndex >= questions.length) return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setTimeUp(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, currentIndex, questions, timeUp]);

  // Listen for session changes (current_question_index, status)
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`gameplay-session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const updated = payload.new as { current_question_index: number; status: string };
          if (updated.status === "finished") {
            setGameFinished(true);
            return;
          }
          if (typeof updated.current_question_index === "number") {
            setCurrentIndex(updated.current_question_index);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Listen for response count (host view)
  useEffect(() => {
    if (!sessionId || !isHost || questions.length === 0 || currentIndex >= questions.length) return;

    const questionId = questions[currentIndex]?.id;
    if (!questionId) return;

    const channel = supabase
      .channel(`responses-${sessionId}-${questionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_responses",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const resp = payload.new as { question_id: string };
          if (resp.question_id === questionId) {
            setResponseCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, isHost, questions, currentIndex]);

  const handleSelectAnswer = useCallback(
    async (answerId: string) => {
      if (timeUp || selectedAnswerId || !participantId) return;

      setSelectedAnswerId(answerId);

      const answer = answers.find((a) => a.id === answerId);
      const isCorrect = answer?.is_correct || false;
      const earnedScore = isCorrect ? 10 : 0;

      if (isCorrect) setScore((prev) => prev + earnedScore);

      await supabase.from("game_responses").insert({
        session_id: sessionId,
        participant_id: participantId,
        question_id: questions[currentIndex].id,
        answer_id: answerId,
        is_correct: isCorrect,
        score: earnedScore,
      });
    },
    [timeUp, selectedAnswerId, participantId, answers, sessionId, questions, currentIndex]
  );

  const handleNextQuestion = async () => {
    if (!isHost || !sessionId) return;

    const nextIndex = currentIndex + 1;

    if (nextIndex >= questions.length) {
      await supabase
        .from("game_sessions")
        .update({ status: "finished", current_question_index: nextIndex })
        .eq("id", sessionId);
      setGameFinished(true);
      return;
    }

    await supabase
      .from("game_sessions")
      .update({ current_question_index: nextIndex })
      .eq("id", sessionId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">טוען משחק...</p>
      </div>
    );
  }

  if (gameFinished) {
    return <GameFinished sessionId={sessionId!} isHost={isHost} playerName={playerName} score={score} />;
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">אין שאלות בחידון הזה</p>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  const correctAnswer = answers.find((a) => a.is_correct);

  return (
    <div className="min-h-screen gradient-hero flex flex-col" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 text-primary-foreground/80 text-sm">
          <span>
            שאלה {currentIndex + 1} / {questions.length}
          </span>
        </div>
        {!isHost && (
          <div className="flex items-center gap-1 text-primary-foreground font-heading font-bold">
            <Trophy className="size-4" />
            <span>{score}</span>
          </div>
        )}
        {isHost && (
          <div className="flex items-center gap-1 text-primary-foreground/80 text-sm">
            <Users className="size-4" />
            <span>
              {responseCount}/{participantCount} ענו
            </span>
          </div>
        )}
      </div>

      {/* Timer bar */}
      <div className="px-4">
        <Progress
          value={totalTime > 0 ? (timeLeft / totalTime) * 100 : 0}
          className="h-2 bg-primary-foreground/20"
        />
      </div>

      {/* Timer + Question */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6">
        {/* Timer circle */}
        <motion.div
          className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-heading font-bold ${
            timeUp
              ? "bg-destructive/20 text-destructive"
              : timeLeft <= 5
              ? "bg-destructive/20 text-destructive animate-pulse"
              : "bg-primary-foreground/10 text-primary-foreground"
          }`}
          key={timeLeft}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
        >
          {timeLeft}
        </motion.div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-card rounded-3xl p-8 shadow-elevated w-full max-w-lg text-center"
          >
            <h2 className="text-2xl font-heading font-bold text-foreground leading-relaxed">
              {currentQuestion.text}
            </h2>
          </motion.div>
        </AnimatePresence>

        {/* Answers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
          {answers.map((answer, idx) => {
            const isSelected = selectedAnswerId === answer.id;
            const showCorrect = timeUp && answer.is_correct;
            const showWrong = timeUp && isSelected && !answer.is_correct;

            return (
              <motion.button
                key={answer.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => handleSelectAnswer(answer.id)}
                disabled={timeUp || !!selectedAnswerId || isHost}
                className={`relative p-5 rounded-2xl text-lg font-heading font-semibold text-white transition-all
                  ${
                    showCorrect
                      ? "!bg-[hsl(var(--accent))] ring-4 ring-[hsl(var(--accent))]/30"
                      : showWrong
                      ? "!bg-destructive ring-4 ring-destructive/30 opacity-70"
                      : isSelected
                      ? `${ANSWER_COLORS[idx % ANSWER_COLORS.length]} ring-4 ring-white/50 scale-[0.97]`
                      : `${ANSWER_COLORS[idx % ANSWER_COLORS.length]} hover:scale-[1.02] active:scale-[0.97]`
                  }
                  ${timeUp && !showCorrect && !showWrong ? "opacity-50" : ""}
                  disabled:cursor-default
                `}
              >
                {answer.text}
                {showCorrect && (
                  <CheckCircle2 className="absolute top-2 left-2 size-6" />
                )}
                {showWrong && (
                  <XCircle className="absolute top-2 left-2 size-6" />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Time up message for player */}
        {timeUp && !isHost && !selectedAnswerId && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-primary-foreground/80 font-heading font-semibold"
          >
            הזמן נגמר! לא נבחרה תשובה
          </motion.p>
        )}

        {/* Correct answer feedback for player */}
        {timeUp && !isHost && selectedAnswerId && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`font-heading font-semibold ${
              answers.find((a) => a.id === selectedAnswerId)?.is_correct
                ? "text-[hsl(var(--accent))]"
                : "text-destructive-foreground"
            }`}
          >
            {answers.find((a) => a.id === selectedAnswerId)?.is_correct
              ? "תשובה נכונה! +10 נקודות 🎉"
              : `תשובה שגויה. התשובה הנכונה: ${correctAnswer?.text}`}
          </motion.p>
        )}

        {/* Host: next question button */}
        {isHost && timeUp && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Button variant="hero" size="xl" onClick={handleNextQuestion}>
              <ArrowLeft className="!size-5" />
              {currentIndex + 1 >= questions.length ? "סיים משחק" : "שאלה הבאה"}
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

// Game finished screen
const GameFinished = ({
  sessionId,
  isHost,
  playerName,
  score,
}: {
  sessionId: string;
  isHost: boolean;
  playerName: string;
  score: number;
}) => {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<{ player_name: string; total_score: number }[]>([]);

  useEffect(() => {
    const loadLeaderboard = async () => {
      const { data } = await supabase
        .from("game_responses")
        .select("participant_id, score, game_participants!inner(player_name)")
        .eq("session_id", sessionId);

      if (!data) return;

      const scores: Record<string, { player_name: string; total_score: number }> = {};
      for (const row of data) {
        const pid = row.participant_id;
        const name = (row.game_participants as any)?.player_name || "?";
        if (!scores[pid]) scores[pid] = { player_name: name, total_score: 0 };
        scores[pid].total_score += row.score;
      }

      const sorted = Object.values(scores).sort((a, b) => b.total_score - a.total_score);
      setLeaderboard(sorted);
    };

    loadLeaderboard();
  }, [sessionId]);

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center px-4" dir="rtl">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="text-center mb-6">
          <Trophy className="size-16 text-[hsl(var(--answer-yellow))] mx-auto mb-2" />
          <h1 className="text-3xl font-heading font-bold text-primary-foreground">המשחק נגמר!</h1>
        </div>

        <div className="bg-card rounded-3xl p-8 shadow-elevated space-y-6">
          {!isHost && (
            <div className="text-center">
              <p className="text-muted-foreground text-sm">הניקוד שלך</p>
              <p className="text-4xl font-heading font-bold text-foreground">{score}</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">טבלת תוצאות</p>
            {leaderboard.map((entry, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex items-center justify-between p-3 rounded-xl ${
                  idx === 0
                    ? "bg-[hsl(var(--answer-yellow))]/10 border border-[hsl(var(--answer-yellow))]/30"
                    : "bg-muted/30"
                } ${entry.player_name === playerName ? "ring-2 ring-primary" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-heading font-bold text-muted-foreground w-6">
                    {idx + 1}
                  </span>
                  <span className="font-heading font-semibold text-foreground">
                    {entry.player_name}
                  </span>
                </div>
                <span className="font-heading font-bold text-foreground">{entry.total_score}</span>
              </motion.div>
            ))}
          </div>

          <Button
            variant="hero"
            size="xl"
            className="w-full"
            onClick={() => navigate(isHost ? "/my-quizzes" : "/")}
          >
            {isHost ? "חזרה לחידונים" : "חזרה לדף הראשי"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default GamePlay;
