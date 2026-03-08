import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, CheckCircle2, XCircle, Trophy, ArrowLeft, Users, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { themeClasses, type GameTheme } from "@/lib/gameThemes";

interface Question {
  id: string;
  text: string;
  sort_order: number;
  image_url?: string;
}

interface Answer {
  id: string;
  text: string;
  is_correct: boolean;
  sort_order: number;
}

interface Participant {
  id: string;
  player_name: string;
  joined_at: string;
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
  const [showIntroSlide, setShowIntroSlide] = useState(true);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [quizImageUrl, setQuizImageUrl] = useState<string | null>(null);
  const [responseCount, setResponseCount] = useState(0);
  const [participantCount, setParticipantCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // King/tribe mode state
  const [quizMode, setQuizMode] = useState("genius");
  const [quizTheme, setQuizTheme] = useState<GameTheme>("default");
  const [kingParticipantId, setKingParticipantId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [kingAnswerId, setKingAnswerId] = useState<string | null>(null);
  const [waitingForKing, setWaitingForKing] = useState(false);

  // Leaderboard state
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [midGameLeaderboard, setMidGameLeaderboard] = useState<{ player_name: string; total_score: number }[]>([]);

  // Determine current king for tribe mode
  const getCurrentKingId = useCallback(
    (index: number) => {
      if (quizMode !== "tribe" || participants.length === 0) return null;
      return participants[index % participants.length]?.id || null;
    },
    [quizMode, participants]
  );

  const currentKingId =
    quizMode === "king" ? kingParticipantId : getCurrentKingId(currentIndex);

  const isCurrentPlayerKing = !isHost && participantId && currentKingId === participantId;

  const currentKingName =
    currentKingId ? participants.find((p) => p.id === currentKingId)?.player_name || "" : "";

  // Load game data
  useEffect(() => {
    if (!sessionId) return;

    const load = async () => {
      const { data: session } = await supabase
        .from("game_sessions")
        .select("quiz_id, current_question_index, king_participant_id")
        .eq("id", sessionId)
        .single();

      if (!session) return;

      setKingParticipantId((session as any).king_participant_id || null);

      const { data: quiz } = await supabase
        .from("quizzes")
        .select("time_per_question, mode, title, description, image_url, theme")
        .eq("id", session.quiz_id)
        .single();

      setTotalTime(quiz?.time_per_question || 30);
      setQuizMode(quiz?.mode || "genius");
      setQuizTheme(((quiz as any)?.theme as GameTheme) || "default");
      setQuizTitle(quiz?.title || "");
      setQuizDescription((quiz as any)?.description || "");
      setQuizImageUrl((quiz as any)?.image_url || null);

      const { data: qs } = await supabase
        .from("questions")
        .select("id, text, sort_order, image_url")
        .eq("quiz_id", session.quiz_id)
        .order("sort_order");

      setQuestions(qs || []);
      setCurrentIndex(session.current_question_index || 0);

      // Load participants (needed for tribe mode rotation & king name)
      const { data: parts } = await supabase
        .from("game_participants")
        .select("id, player_name, joined_at")
        .eq("session_id", sessionId)
        .order("joined_at");

      setParticipants(parts || []);
      setParticipantCount(parts?.length || 0);

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
    if (questions.length === 0 || currentIndex >= questions.length || showIntroSlide) return;

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
      setKingAnswerId(null);
      setWaitingForKing(false);
    };

    loadAnswers();
  }, [questions, currentIndex, totalTime, showIntroSlide]);

  // Timer countdown
  useEffect(() => {
    if (loading || timeUp || questions.length === 0 || currentIndex >= questions.length || showIntroSlide) return;

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

  // Leaderboard broadcast channel
  const leaderboardChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`leaderboard-${sessionId}`);
    channel
      .on("broadcast", { event: "show_leaderboard" }, (payload) => {
        console.log("[Leaderboard] Received show_leaderboard broadcast", payload);
        setShowLeaderboard(true);
        setMidGameLeaderboard(payload.payload.leaderboard || []);
      })
      .on("broadcast", { event: "hide_leaderboard" }, () => {
        console.log("[Leaderboard] Received hide_leaderboard broadcast");
        setShowLeaderboard(false);
      })
      .on("broadcast", { event: "dismiss_intro" }, () => {
        setShowIntroSlide(false);
      })
      .subscribe((status) => {
        console.log("[Leaderboard] Channel subscription status:", status);
        if (status === "SUBSCRIBED") {
          leaderboardChannelRef.current = channel;
        }
      });

    return () => {
      supabase.removeChannel(channel);
      leaderboardChannelRef.current = null;
    };
  }, [sessionId]);

  // Listen for response count (host view) AND king's answer (king/tribe mode)
  useEffect(() => {
    if (!sessionId || questions.length === 0 || currentIndex >= questions.length) return;

    const questionId = questions[currentIndex]?.id;
    if (!questionId) return;

    const isKingMode = quizMode === "king" || quizMode === "tribe";

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
          const resp = payload.new as {
            question_id: string;
            participant_id: string;
            answer_id: string | null;
          };
          if (resp.question_id === questionId) {
            setResponseCount((prev) => prev + 1);
            // If king answered, capture it
            if (isKingMode && resp.participant_id === currentKingId && resp.answer_id) {
              setKingAnswerId(resp.answer_id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, isHost, questions, currentIndex, quizMode, currentKingId]);

  // Auto-end question when all participants answered
  useEffect(() => {
    if (timeUp || participantCount === 0 || responseCount < participantCount) return;
    // All participants answered - end early
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeUp(true);
  }, [responseCount, participantCount, timeUp]);

  // In king/tribe mode, when king answers, check if we need to wait
  const isKingOrTribeMode = quizMode === "king" || quizMode === "tribe";

  const handleSelectAnswer = useCallback(
    async (answerId: string) => {
      if (timeUp || selectedAnswerId || !participantId) return;

      setSelectedAnswerId(answerId);

      // King doesn't get scored
      if (isCurrentPlayerKing) {
        await supabase.from("game_responses").insert({
          session_id: sessionId,
          participant_id: participantId,
          question_id: questions[currentIndex].id,
          answer_id: answerId,
          is_correct: false,
          score: 0,
        });
        return;
      }

      // For king/tribe modes, correctness is determined by king's answer
      // For genius mode, correctness is from the pre-set is_correct
      let isCorrect = false;
      if (isKingOrTribeMode) {
        // We don't know yet if correct - will be resolved when king answers
        // For now, insert with is_correct=false, score=0 - will be evaluated at end
        // Actually, since king might answer after this player, we store the answer_id
        // and evaluate at timeUp
        await supabase.from("game_responses").insert({
          session_id: sessionId,
          participant_id: participantId,
          question_id: questions[currentIndex].id,
          answer_id: answerId,
          is_correct: false,
          score: 0,
        });
        setWaitingForKing(true);
      } else {
        const answer = answers.find((a) => a.id === answerId);
        isCorrect = answer?.is_correct || false;
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
      }
    },
    [
      timeUp,
      selectedAnswerId,
      participantId,
      answers,
      sessionId,
      questions,
      currentIndex,
      isCurrentPlayerKing,
      isKingOrTribeMode,
    ]
  );

  // When time is up in king/tribe mode, update scores based on king's answer
  useEffect(() => {
    if (!timeUp || !isKingOrTribeMode || !isHost || !sessionId) return;
    if (questions.length === 0 || currentIndex >= questions.length) return;

    const questionId = questions[currentIndex].id;

    const updateScores = async () => {
      // Find king's response to get the "correct" answer
      const { data: kingResponse } = await supabase
        .from("game_responses")
        .select("answer_id")
        .eq("session_id", sessionId)
        .eq("question_id", questionId)
        .eq("participant_id", currentKingId!)
        .single();

      if (!kingResponse?.answer_id) return;

      const correctAnswerId = kingResponse.answer_id;

      // Get all non-king responses for this question
      const { data: allResponses } = await supabase
        .from("game_responses")
        .select("id, participant_id, answer_id")
        .eq("session_id", sessionId)
        .eq("question_id", questionId)
        .neq("participant_id", currentKingId!);

      if (!allResponses) return;

      // Update each response
      for (const resp of allResponses) {
        const correct = resp.answer_id === correctAnswerId;
        await supabase
          .from("game_responses")
          .update({ is_correct: correct, score: correct ? 10 : 0 })
          .eq("id", resp.id);
      }
    };

    if (currentKingId) {
      updateScores();
    }
  }, [timeUp, isKingOrTribeMode, isHost, sessionId, questions, currentIndex, currentKingId]);

  // Track king answer locally for player feedback
  useEffect(() => {
    if (!timeUp || !isKingOrTribeMode || isHost || !kingAnswerId || !selectedAnswerId) return;
    if (isCurrentPlayerKing) return;

    const isCorrect = selectedAnswerId === kingAnswerId;
    if (isCorrect) {
      setScore((prev) => prev + 10);
    }
  }, [timeUp, kingAnswerId, isKingOrTribeMode, isHost, selectedAnswerId, isCurrentPlayerKing]);

  const handleShowLeaderboard = async () => {
    if (!isHost || !sessionId) return;

    // Load current scores
    const { data } = await supabase
      .from("game_responses")
      .select("participant_id, score, game_participants!inner(player_name)")
      .eq("session_id", sessionId);

    if (!data) return;

    const scores: Record<string, { player_name: string; total_score: number }> = {};
    for (const row of data) {
      const pid = row.participant_id;
      if (quizMode === "king" && pid === currentKingId) continue;
      const name = (row.game_participants as any)?.player_name || "?";
      if (!scores[pid]) scores[pid] = { player_name: name, total_score: 0 };
      scores[pid].total_score += row.score;
    }

    const sorted = Object.values(scores).sort((a, b) => b.total_score - a.total_score);
    setMidGameLeaderboard(sorted);
    setShowLeaderboard(true);

    // Broadcast to all players
    if (leaderboardChannelRef.current) {
      console.log("[Leaderboard] Broadcasting show_leaderboard to players");
      const result = await leaderboardChannelRef.current.send({
        type: "broadcast",
        event: "show_leaderboard",
        payload: { leaderboard: sorted },
      });
      console.log("[Leaderboard] Broadcast result:", result);
    } else {
      console.warn("[Leaderboard] Channel not ready, cannot broadcast");
    }
  };

  const handleHideLeaderboard = async () => {
    setShowLeaderboard(false);

    if (leaderboardChannelRef.current) {
      await leaderboardChannelRef.current.send({
        type: "broadcast",
        event: "hide_leaderboard",
        payload: {},
      });
    }
  };

  const handleNextQuestion = async () => {
    if (!isHost || !sessionId) return;

    // Hide leaderboard first if shown
    if (showLeaderboard) {
      await handleHideLeaderboard();
    }

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

  const t = themeClasses[quizTheme];

  if (gameFinished) {
    return (
      <GameFinished
        sessionId={sessionId!}
        isHost={isHost}
        playerName={playerName}
        score={score}
        quizMode={quizMode}
        kingParticipantId={currentKingId}
      />
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">אין שאלות בחידון הזה</p>
      </div>
    );
  }

  if (showIntroSlide) {
    return (
      <div className={`min-h-screen ${t.bg} flex items-center justify-center px-4`} dir="rtl">
        <motion.div
          className="w-full max-w-lg text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {quizImageUrl && (
            <motion.img
              src={quizImageUrl}
              alt="תמונת חידון"
              className="w-full max-h-64 object-contain rounded-3xl mb-6 mx-auto"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            />
          )}
          <motion.h1
            className={`text-4xl font-heading font-bold ${t.text} mb-3`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {quizTitle}
          </motion.h1>
          {quizDescription && (
            <motion.p
              className={`text-lg ${t.textSecondary} mb-8`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {quizDescription}
            </motion.p>
          )}
          <motion.p
            className={`${t.textSecondary} text-sm mb-6`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {questions.length} שאלות · {totalTime} שניות לשאלה
          </motion.p>
          {isHost && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Button
                variant="hero"
                size="xl"
                onClick={async () => {
                  setShowIntroSlide(false);
                  if (leaderboardChannelRef.current) {
                    await leaderboardChannelRef.current.send({
                      type: "broadcast",
                      event: "dismiss_intro",
                      payload: {},
                    });
                  }
                }}
              >
                <ArrowLeft className="!size-5" />
                התחל חידון
              </Button>
            </motion.div>
          )}
          {!isHost && (
            <motion.p
              className={`${t.textSecondary} font-heading font-semibold`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              ממתינים למנהל להתחיל...
            </motion.p>
          )}
        </motion.div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  // In genius mode, correct answer is pre-set. In king/tribe, it's the king's choice.
  const correctAnswerForDisplay =
    isKingOrTribeMode && kingAnswerId
      ? answers.find((a) => a.id === kingAnswerId)
      : answers.find((a) => a.is_correct);

  return (
    <div className={`min-h-screen ${t.bg} flex flex-col`} dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 text-primary-foreground/80 text-sm">
          <span>
            שאלה {currentIndex + 1} / {questions.length}
          </span>
        </div>
        {!isHost && !isCurrentPlayerKing && (
          <div className="flex items-center gap-1 text-primary-foreground font-heading font-bold">
            <Trophy className="size-4" />
            <span>{score}</span>
          </div>
        )}
        {isCurrentPlayerKing && (
          <div className="flex items-center gap-1 text-[hsl(var(--answer-yellow))] font-heading font-bold">
            <Crown className="size-4" />
            <span>מלך</span>
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

      {/* King indicator */}
      {isKingOrTribeMode && currentKingName && (
        <div className="px-4 pb-2">
          <div className="bg-[hsl(var(--answer-yellow))]/20 rounded-full px-4 py-1.5 flex items-center justify-center gap-2">
            <Crown className="size-4 text-[hsl(var(--answer-yellow))]" />
            <span className="text-sm font-heading font-semibold text-primary-foreground">
              המלך: {currentKingName}
            </span>
          </div>
        </div>
      )}

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
            {currentQuestion.image_url && (
              <img
                src={currentQuestion.image_url}
                alt="תמונת שאלה"
                className="w-full max-h-56 object-contain rounded-2xl mb-4"
              />
            )}
            <h2 className="text-2xl font-heading font-bold text-foreground leading-relaxed">
              {currentQuestion.text}
            </h2>
            {isCurrentPlayerKing && (
              <p className="text-sm text-[hsl(var(--answer-yellow))] mt-2 font-medium">
                👑 בחר את התשובה הנכונה
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Answers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
          {answers.map((answer, idx) => {
            const isSelected = selectedAnswerId === answer.id;
            // King never sees correct/wrong feedback on their own answers
            const isKingViewing = isCurrentPlayerKing;
            const showCorrectGenius = timeUp && !isKingOrTribeMode && answer.is_correct;
            // Players in king/tribe mode only see feedback AFTER king has chosen
            const showCorrectKing =
              timeUp && isKingOrTribeMode && !isKingViewing && kingAnswerId && answer.id === kingAnswerId;
            const showCorrect = showCorrectGenius || showCorrectKing;
            const showWrong =
              timeUp &&
              isSelected &&
              !isKingViewing &&
              (!isKingOrTribeMode || !!kingAnswerId) &&
              !showCorrect;

            // In king/tribe mode, don't dim answers until king has chosen
            const dimUnselected = timeUp && !showCorrect && !showWrong && (!isKingOrTribeMode || !!kingAnswerId || isKingViewing);

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
                  ${dimUnselected ? "opacity-50" : ""}
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

        {/* King waiting message */}
        {isCurrentPlayerKing && selectedAnswerId && !timeUp && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[hsl(var(--answer-yellow))] font-heading font-semibold"
          >
            👑 בחרת את התשובה הנכונה!
          </motion.p>
        )}

        {/* Time up message for player */}
        {timeUp && !isHost && !selectedAnswerId && !isCurrentPlayerKing && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-primary-foreground/80 font-heading font-semibold"
          >
            הזמן נגמר! לא נבחרה תשובה
          </motion.p>
        )}

        {/* Correct answer feedback for player (non-king) in genius mode */}
        {timeUp && !isHost && selectedAnswerId && !isCurrentPlayerKing && !isKingOrTribeMode && (
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
              : `תשובה שגויה. התשובה הנכונה: ${correctAnswerForDisplay?.text || "?"}`}
          </motion.p>
        )}

        {/* King/tribe mode: waiting for king to choose */}
        {timeUp && isKingOrTribeMode && !kingAnswerId && !isCurrentPlayerKing && !isHost && selectedAnswerId && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[hsl(var(--answer-yellow))] font-heading font-semibold"
          >
            👑 ממתינים לבחירת המלך...
          </motion.p>
        )}

        {/* King/tribe mode: king hasn't answered and no one is waiting */}
        {timeUp && isKingOrTribeMode && !kingAnswerId && !isCurrentPlayerKing && !isHost && !selectedAnswerId && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[hsl(var(--answer-yellow))] font-heading font-semibold"
          >
            👑 המלך לא בחר תשובה
          </motion.p>
        )}

        {/* King/tribe mode: feedback AFTER king chose */}
        {timeUp && isKingOrTribeMode && kingAnswerId && !isCurrentPlayerKing && !isHost && selectedAnswerId && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`font-heading font-semibold ${
              selectedAnswerId === kingAnswerId
                ? "text-[hsl(var(--accent))]"
                : "text-destructive-foreground"
            }`}
          >
            {selectedAnswerId === kingAnswerId
              ? "תשובה נכונה! +10 נקודות 🎉"
              : `תשובה שגויה. התשובה הנכונה: ${correctAnswerForDisplay?.text || "?"}`}
          </motion.p>
        )}

        {/* Host: leaderboard + next question buttons */}
        {isHost && (timeUp || responseCount >= participantCount) && !showLeaderboard && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
            <Button variant="game" size="xl" onClick={handleShowLeaderboard}>
              <Trophy className="!size-5" />
              לוח נקודות
            </Button>
            <Button variant="hero" size="xl" onClick={handleNextQuestion}>
              <ArrowLeft className="!size-5" />
              {currentIndex + 1 >= questions.length ? "סיים משחק" : "שאלה הבאה"}
            </Button>
          </motion.div>
        )}
      </div>

      {/* Leaderboard overlay */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 gradient-hero flex items-center justify-center px-4"
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md"
            >
              <div className="text-center mb-4">
                <Trophy className="size-12 text-[hsl(var(--answer-yellow))] mx-auto mb-2" />
                <h2 className="text-2xl font-heading font-bold text-primary-foreground">לוח נקודות</h2>
                <p className="text-primary-foreground/60 text-sm">אחרי שאלה {currentIndex + 1} מתוך {questions.length}</p>
              </div>

              <div className="bg-card rounded-3xl p-6 shadow-elevated space-y-3 max-h-[60vh] overflow-y-auto">
                {midGameLeaderboard.map((entry, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`flex items-center justify-between p-3 rounded-xl ${
                      idx === 0
                        ? "bg-[hsl(var(--answer-yellow))]/10 ring-1 ring-[hsl(var(--answer-yellow))]/30"
                        : idx === 1
                        ? "bg-muted/40"
                        : idx === 2
                        ? "bg-[hsl(var(--answer-orange))]/10"
                        : "bg-muted/20"
                    } ${entry.player_name === playerName ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-heading font-bold text-muted-foreground w-6">
                        {idx < 3 ? ["🥇", "🥈", "🥉"][idx] : idx + 1}
                      </span>
                      <span className="font-heading font-semibold text-foreground">
                        {entry.player_name}
                      </span>
                    </div>
                    <span className="font-heading font-bold text-foreground">{entry.total_score} נק׳</span>
                  </motion.div>
                ))}
                {midGameLeaderboard.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">אין נתונים עדיין</p>
                )}
              </div>

              {isHost && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-4"
                >
                  <Button variant="hero" size="xl" className="w-full" onClick={async () => {
                    await handleHideLeaderboard();
                    handleNextQuestion();
                  }}>
                    <ArrowLeft className="!size-5" />
                    {currentIndex + 1 >= questions.length ? "סיים משחק" : "שאלה הבאה"}
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Game finished screen
const GameFinished = ({
  sessionId,
  isHost,
  playerName,
  score,
  quizMode,
  kingParticipantId,
}: {
  sessionId: string;
  isHost: boolean;
  playerName: string;
  score: number;
  quizMode: string;
  kingParticipantId: string | null;
}) => {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<{ player_name: string; total_score: number }[]>(
    []
  );

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

        // In king mode, exclude king from leaderboard
        if (quizMode === "king" && pid === kingParticipantId) continue;

        const name = (row.game_participants as any)?.player_name || "?";
        if (!scores[pid]) scores[pid] = { player_name: name, total_score: 0 };
        scores[pid].total_score += row.score;
      }

      const sorted = Object.values(scores).sort((a, b) => b.total_score - a.total_score);
      setLeaderboard(sorted);
    };

    loadLeaderboard();
  }, [sessionId, quizMode, kingParticipantId]);

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  const medalEmojis = ["🥇", "🥈", "🥉"];
  const podiumOrder = top3.length === 3 ? [1, 0, 2] : top3.map((_, i) => i);

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center px-4" dir="rtl">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
          >
            <Trophy className="size-16 text-[hsl(var(--answer-yellow))] mx-auto mb-2" />
          </motion.div>
          <h1 className="text-3xl font-heading font-bold text-primary-foreground">המשחק נגמר!</h1>
        </div>

        <div className="bg-card rounded-3xl p-8 shadow-elevated space-y-6">
          {/* Podium for top 3 */}
          {top3.length > 0 && (
            <div className="flex items-end justify-center gap-3 pt-4 pb-2">
              {podiumOrder.map((originalIdx) => {
                const entry = top3[originalIdx];
                if (!entry) return null;
                const heights = ["h-28", "h-20", "h-14"];
                const sizes = ["text-xl", "text-base", "text-sm"];
                const medalSizes = ["text-4xl", "text-3xl", "text-2xl"];
                const isMe = entry.player_name === playerName;

                return (
                  <motion.div
                    key={originalIdx}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + originalIdx * 0.15 }}
                    className="flex flex-col items-center gap-1 flex-1 max-w-[120px]"
                  >
                    <span className={medalSizes[originalIdx]}>{medalEmojis[originalIdx]}</span>
                    <span
                      className={`font-heading font-bold truncate max-w-full ${sizes[originalIdx]} ${
                        isMe ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {entry.player_name}
                    </span>
                    <span className="text-sm font-heading font-bold text-muted-foreground">
                      {entry.total_score} נק׳
                    </span>
                    <div
                      className={`w-full ${heights[originalIdx]} rounded-t-xl ${
                        originalIdx === 0
                          ? "bg-[hsl(var(--answer-yellow))]/30 border-2 border-[hsl(var(--answer-yellow))]/50"
                          : originalIdx === 1
                          ? "bg-muted/50 border-2 border-muted-foreground/20"
                          : "bg-[hsl(var(--answer-orange))]/20 border-2 border-[hsl(var(--answer-orange))]/30"
                      }`}
                    />
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Player score (non-host) */}
          {!isHost && (
            <div className="text-center border-t border-border pt-4">
              <p className="text-muted-foreground text-sm">הניקוד שלך</p>
              <p className="text-4xl font-heading font-bold text-foreground">{score}</p>
            </div>
          )}

          {/* Rest of leaderboard */}
          {rest.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">שאר המשתתפים</p>
              {rest.map((entry, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + idx * 0.05 }}
                  className={`flex items-center justify-between p-3 rounded-xl bg-muted/30 ${
                    entry.player_name === playerName ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-heading font-bold text-muted-foreground w-6">
                      {idx + 4}
                    </span>
                    <span className="font-heading font-semibold text-foreground">
                      {entry.player_name}
                    </span>
                  </div>
                  <span className="font-heading font-bold text-foreground">{entry.total_score}</span>
                </motion.div>
              ))}
            </div>
          )}

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
