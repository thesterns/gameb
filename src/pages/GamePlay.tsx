import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, CheckCircle2, XCircle, Trophy, ArrowLeft, Users, Crown, RotateCw, BarChart3, Star } from "lucide-react";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import QuizLogo from "@/components/QuizLogo";
import { Confetti } from "@/components/Confetti";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { themeClasses, type GameTheme } from "@/lib/gameThemes";

interface Question {
  id: string;
  text: string;
  sort_order: number;
  image_url?: string;
  youtube_url?: string;
  double_points?: boolean;
  custom_time?: number;
}

interface Answer {
  id: string;
  text: string;
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

interface LeaderboardEntry {
  player_name: string;
  total_score: number;
  total_correct: number;
  max_streak: number;
}

const StarBadge = ({ maxStreak, totalCorrect }: { maxStreak: number; totalCorrect: number }) => {
  if (maxStreak >= 5 || totalCorrect >= 5) {
    return <Star className="size-4 fill-[hsl(var(--answer-yellow))] text-[hsl(var(--answer-yellow))]" />;
  }
  if (maxStreak >= 3 || totalCorrect >= 3) {
    return <Star className="size-4 fill-muted-foreground/50 text-muted-foreground" />;
  }
  return null;
};

/** Compute leaderboard with streak data from raw responses */
function computeLeaderboard(
  data: { participant_id: string; score: number; is_correct: boolean; question_id: string; game_participants: any }[],
  questionsOrdered: { id: string }[],
  excludeId?: string | null,
): LeaderboardEntry[] {
  const players: Record<string, {
    player_name: string;
    total_score: number;
    total_correct: number;
    responses: Map<string, boolean>; // question_id -> is_correct
  }> = {};

  for (const row of data) {
    const pid = row.participant_id;
    if (excludeId && pid === excludeId) continue;
    const name = (row.game_participants as any)?.player_name || "?";
    if (!players[pid]) players[pid] = { player_name: name, total_score: 0, total_correct: 0, responses: new Map() };
    players[pid].total_score += row.score;
    if (row.is_correct) players[pid].total_correct += 1;
    players[pid].responses.set(row.question_id, row.is_correct);
  }

  // Compute max streak per player based on question order
  const result: LeaderboardEntry[] = Object.values(players).map((p) => {
    let maxStreak = 0;
    let currentStreak = 0;
    for (const q of questionsOrdered) {
      if (p.responses.get(q.id)) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else if (p.responses.has(q.id)) {
        currentStreak = 0;
      }
    }
    return { player_name: p.player_name, total_score: p.total_score, total_correct: p.total_correct, max_streak: maxStreak };
  });

  return result.sort((a, b) => b.total_score - a.total_score);
}

const GamePlay = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { playerName?: string; isHost?: boolean } | null;

  // Persist & restore player identity across refreshes
  const storageKey = sessionId ? `game_state_${sessionId}` : "";

  const resolvedState = (() => {
    if (state?.playerName || state?.isHost) {
      // Save to sessionStorage for refresh recovery
      if (storageKey) {
        sessionStorage.setItem(storageKey, JSON.stringify({ playerName: state.playerName || "", isHost: !!state.isHost }));
      }
      return { playerName: state.playerName || "", isHost: !!state.isHost };
    }
    // Try to restore from sessionStorage
    try {
      const saved = storageKey ? sessionStorage.getItem(storageKey) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        return { playerName: parsed.playerName || "", isHost: !!parsed.isHost };
      }
    } catch {}
    return { playerName: "", isHost: false };
  })();

  const isHost = resolvedState.isHost;
  const playerName = resolvedState.playerName;

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
  const [quizYoutubeUrl, setQuizYoutubeUrl] = useState<string | null>(null);
  const [quizLogoUrl, setQuizLogoUrl] = useState<string | null>(null);
  const [quizLogoText, setQuizLogoText] = useState<string | null>(null);
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
  const [myAnswerCorrect, setMyAnswerCorrect] = useState<boolean | null>(null);
  const [revealedCorrectAnswerId, setRevealedCorrectAnswerId] = useState<string | null>(null);

  // Streak & confetti
  const [correctStreak, setCorrectStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [totalCorrect, setTotalCorrect] = useState(0);

  // Leaderboard state
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [midGameLeaderboard, setMidGameLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Auto-advance state
  const [autoAdvance, setAutoAdvance] = useState(false);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Player leaderboard popup
  const [showPlayerLeaderboard, setShowPlayerLeaderboard] = useState(false);
  const [playerLeaderboardData, setPlayerLeaderboardData] = useState<LeaderboardEntry[]>([]);

  // Statistics overlay
  const [showStats, setShowStats] = useState(false);
  const [statsData, setStatsData] = useState<{ text: string; count: number; colorClass: string }[]>([]);

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
        .select("quiz_id, current_question_index, king_participant_id, status")
        .eq("id", sessionId)
        .single();

      if (!session) return;

      // Handle finished game
      if ((session as any).status === "finished") {
        setGameFinished(true);
      }

      // Skip intro slide if game is already past question 0
      const qIndex = session.current_question_index || 0;
      if (qIndex > 0 || (session as any).status === "active") {
        setShowIntroSlide(false);
      }

      setKingParticipantId((session as any).king_participant_id || null);

      const { data: quiz } = await supabase
        .from("quizzes")
        .select("time_per_question, mode, title, description, image_url, youtube_url, theme, logo_url, logo_text")
        .eq("id", session.quiz_id)
        .single();

      setTotalTime(quiz?.time_per_question || 30);
      setQuizMode(quiz?.mode || "genius");
      setQuizTheme(((quiz as any)?.theme as GameTheme) || "default");
      setQuizTitle(quiz?.title || "");
      setQuizDescription((quiz as any)?.description || "");
      setQuizImageUrl((quiz as any)?.image_url || null);
      setQuizYoutubeUrl((quiz as any)?.youtube_url || null);
      setQuizLogoUrl((quiz as any)?.logo_url || null);
      setQuizLogoText((quiz as any)?.logo_text || null);

      const { data: qs } = await supabase
        .from("questions")
        .select("id, text, sort_order, image_url, youtube_url, double_points, custom_time")
        .eq("quiz_id", session.quiz_id)
        .order("sort_order");

      setQuestions(qs || []);
      setCurrentIndex(qIndex);

      // Load participants (needed for tribe mode rotation & king name)
      const { data: parts } = await supabase
        .from("game_participants")
        .select("id, player_name, joined_at")
        .eq("session_id", sessionId)
        .order("joined_at");

      setParticipants(parts || []);
      setParticipantCount(parts?.length || 0);

      // If player, find participant id and restore score
      if (!isHost && playerName) {
        const { data: participant } = await supabase
          .from("game_participants")
          .select("id")
          .eq("session_id", sessionId)
          .eq("player_name", playerName)
          .single();

        if (participant) {
          setParticipantId(participant.id);

          // Restore accumulated score from previous responses
          const { data: prevResponses } = await supabase
            .from("game_responses")
            .select("score")
            .eq("session_id", sessionId)
            .eq("participant_id", participant.id);

          if (prevResponses) {
            const totalScore = prevResponses.reduce((sum, r) => sum + r.score, 0);
            setScore(totalScore);
          }
        }
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
        .select("id, text, sort_order")
        .eq("question_id", q.id)
        .order("sort_order");

      setAnswers(data || []);
      setSelectedAnswerId(null);
      setTimeUp(false);
      const currentQuestion = questions[currentIndex];
      const questionTime = currentQuestion?.custom_time || totalTime;
      setTimeLeft(questionTime);
      setResponseCount(0);
      setKingAnswerId(null);
      setWaitingForKing(false);
      setMyAnswerCorrect(null);
      setRevealedCorrectAnswerId(null);
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

  // Host broadcasts correct answer when time expires (genius mode)
  useEffect(() => {
    const isKingOrTribe = quizMode === "king" || quizMode === "tribe";
    if (!timeUp || !isHost || isKingOrTribe || !leaderboardChannelRef.current) return;
    if (!questions.length || currentIndex >= questions.length) return;

    const questionId = questions[currentIndex].id;
    const broadcastCorrectAnswer = async () => {
      const { data } = await supabase
        .from("answers")
        .select("id")
        .eq("question_id", questionId)
        .eq("is_correct", true)
        .single();

      if (data && leaderboardChannelRef.current) {
        setRevealedCorrectAnswerId(data.id);
        await leaderboardChannelRef.current.send({
          type: "broadcast",
          event: "reveal_correct_answer",
          payload: { correct_answer_id: data.id },
        });
      }
    };
    broadcastCorrectAnswer();
  }, [timeUp, isHost, quizMode, questions, currentIndex]);


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
      .on("broadcast", { event: "reveal_correct_answer" }, (payload) => {
        setRevealedCorrectAnswerId(payload.payload.correct_answer_id);
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

      // Call server-side RPC to submit answer (score computed server-side)
      const { data } = await supabase.rpc("submit_answer", {
        p_session_id: sessionId,
        p_participant_id: participantId,
        p_question_id: questions[currentIndex].id,
        p_answer_id: answerId,
      });

      if (isCurrentPlayerKing) {
        return;
      }

      if (isKingOrTribeMode) {
        setWaitingForKing(true);
      } else {
        // For genius mode, server returns the computed result
        const result = data as { is_correct: boolean; score: number } | null;
        setMyAnswerCorrect(result?.is_correct ?? false);
        if (result?.is_correct) {
          setScore((prev) => prev + result.score);
          setTotalCorrect((prev) => prev + 1);
          setCorrectStreak((prev) => {
            const newStreak = prev + 1;
            setMaxStreak((m) => Math.max(m, newStreak));
            if (newStreak >= 3) setShowConfetti(true);
            return newStreak;
          });
        } else {
          setCorrectStreak(0);
        }
      }
    },
    [
      timeUp,
      selectedAnswerId,
      participantId,
      sessionId,
      questions,
      currentIndex,
      isCurrentPlayerKing,
      isKingOrTribeMode,
    ]
  );

  // Update scores for king/tribe mode - called before advancing questions
  const updateKingTribeScores = useCallback(async (questionIndex: number) => {
    if (!isKingOrTribeMode || !sessionId || !questions.length || questionIndex >= questions.length) return;

    const questionId = questions[questionIndex].id;
    const kingId = quizMode === "king" ? kingParticipantId : getCurrentKingId(questionIndex);
    if (!kingId) return;

    // Call server-side RPC to resolve scores (host-only, validated server-side)
    await supabase.rpc("resolve_king_scores", {
      p_session_id: sessionId,
      p_question_id: questionId,
      p_king_participant_id: kingId,
    });
  }, [isKingOrTribeMode, sessionId, questions, quizMode, kingParticipantId, getCurrentKingId]);

  // Track king answer locally for player feedback
  useEffect(() => {
    if (!timeUp || !isKingOrTribeMode || isHost || !kingAnswerId || !selectedAnswerId) return;
    if (isCurrentPlayerKing) return;

    const isCorrect = selectedAnswerId === kingAnswerId;
    if (isCorrect) {
      const currentQ = questions[currentIndex];
      const pts = currentQ?.double_points ? 20 : 10;
      setScore((prev) => prev + pts);
      setTotalCorrect((prev) => prev + 1);
      setCorrectStreak((prev) => {
        const newStreak = prev + 1;
        setMaxStreak((m) => Math.max(m, newStreak));
        if (newStreak >= 3) setShowConfetti(true);
        return newStreak;
      });
    } else {
      setCorrectStreak(0);
    }
  }, [timeUp, kingAnswerId, isKingOrTribeMode, isHost, selectedAnswerId, isCurrentPlayerKing]);

  // Reset confetti after showing
  useEffect(() => {
    if (!showConfetti) return;
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, [showConfetti]);

  // Auto-advance: when enabled and timeUp, advance after 4 seconds
  useEffect(() => {
    if (!autoAdvance || !isHost || !timeUp || gameFinished || showIntroSlide || showLeaderboard) return;
    
    // Clear any existing timer
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    
    autoAdvanceTimerRef.current = setTimeout(() => {
      handleNextQuestion();
    }, 4000);

    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    };
  }, [autoAdvance, isHost, timeUp, gameFinished, showIntroSlide, showLeaderboard, currentIndex]);

  const handleShowStats = async () => {
    if (!sessionId || !questions.length || currentIndex >= questions.length) return;
    const questionId = questions[currentIndex].id;

    const { data: responses } = await supabase
      .from("game_responses")
      .select("answer_id")
      .eq("session_id", sessionId)
      .eq("question_id", questionId);

    const countMap: Record<string, number> = {};
    for (const r of responses || []) {
      if (r.answer_id) {
        countMap[r.answer_id] = (countMap[r.answer_id] || 0) + 1;
      }
    }

    const distribution = answers.map((a, idx) => ({
      text: a.text,
      count: countMap[a.id] || 0,
      colorClass: ANSWER_COLORS[idx % ANSWER_COLORS.length],
    }));

    setStatsData(distribution);
    setShowStats(true);
  };

  const handlePlayerLeaderboard = async () => {
    if (!sessionId) return;

    const { data } = await supabase
      .from("game_responses")
      .select("participant_id, score, is_correct, question_id, game_participants!inner(player_name)")
      .eq("session_id", sessionId);

    if (!data) return;

    const excludeId = quizMode === "king" ? currentKingId : null;
    const sorted = computeLeaderboard(data as any, questions, excludeId);
    setPlayerLeaderboardData(sorted);
    setShowPlayerLeaderboard(true);
  };

  const handleShowLeaderboard = async () => {
    if (!isHost || !sessionId) return;

    const { data } = await supabase
      .from("game_responses")
      .select("participant_id, score, is_correct, question_id, game_participants!inner(player_name)")
      .eq("session_id", sessionId);

    if (!data) return;

    const excludeId = quizMode === "king" ? currentKingId : null;
    const sorted = computeLeaderboard(data as any, questions, excludeId);
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

    // Ensure king/tribe scores are updated before advancing
    if (isKingOrTribeMode) {
      await updateKingTribeScores(currentIndex);
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

  // If no identity after refresh, redirect appropriately
  if (!isHost && !playerName) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4" dir="rtl">
        <p className="text-muted-foreground">הסשן פג תוקף. יש להצטרף מחדש.</p>
        <Button variant="hero" onClick={() => navigate("/join")}>
          חזרה להצטרפות
        </Button>
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
        quizTheme={quizTheme}
        quizYoutubeUrl={quizYoutubeUrl}
        quizImageUrl={quizImageUrl}
        quizTitle={quizTitle}
        quizLogoUrl={quizLogoUrl}
        quizLogoText={quizLogoText}
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
          <QuizLogo logoUrl={quizLogoUrl} logoText={quizLogoText} size="lg" className="mb-4" />
          {quizYoutubeUrl && (
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <YouTubeEmbed url={quizYoutubeUrl} className="max-h-64" />
            </motion.div>
          )}
          {quizImageUrl && !quizYoutubeUrl && (
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

  // In genius mode, correct answer is revealed via broadcast. In king/tribe, it's the king's choice.
  const correctAnswerForDisplay =
    isKingOrTribeMode && kingAnswerId
      ? answers.find((a) => a.id === kingAnswerId)
      : revealedCorrectAnswerId
      ? answers.find((a) => a.id === revealedCorrectAnswerId)
      : null;

  return (
    <div className={`min-h-screen ${t.bg} flex flex-col`} dir="rtl">
      {/* Confetti effect */}
      <Confetti show={showConfetti} />
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <QuizLogo logoUrl={quizLogoUrl} logoText={quizLogoText} size="sm" />
        <div className={`flex items-center gap-2 ${t.textSecondary} text-sm`}>
          <span>
            שאלה {currentIndex + 1} / {questions.length}
          </span>
        </div>
        {!isHost && !isCurrentPlayerKing && (
          <button
            onClick={handlePlayerLeaderboard}
            className={`flex items-center gap-1 ${t.text} font-heading font-bold hover:opacity-80 transition-opacity`}
          >
            <Trophy className="size-4" />
            <span>{score}</span>
          </button>
        )}
        {isCurrentPlayerKing && (
          <div className="flex items-center gap-1 text-[hsl(var(--answer-yellow))] font-heading font-bold">
            <Crown className="size-4" />
            <span>מלך</span>
          </div>
        )}
        {isHost && (
          <div className={`flex items-center gap-3 ${t.textSecondary} text-sm`}>
            <label className="flex items-center gap-1.5 cursor-pointer" title="התקדמות אוטומטית">
              <RotateCw className={`size-3.5 ${autoAdvance ? 'text-[hsl(var(--accent))]' : ''}`} />
              <span className="text-xs hidden sm:inline">אוטומטי</span>
              <Switch
                checked={autoAdvance}
                onCheckedChange={setAutoAdvance}
                className="scale-75"
              />
            </label>
            <div className="flex items-center gap-1">
              <Users className="size-4" />
              <span>
                {responseCount}/{participantCount} ענו
              </span>
            </div>
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

      {/* Double points indicator */}
      {questions[currentIndex]?.double_points && (
        <div className="px-4 flex justify-center">
          <div className="bg-primary/20 text-primary rounded-full px-4 py-1 text-sm font-heading font-bold flex items-center gap-1.5 animate-pulse">
            ⚡ ניקוד כפול!
          </div>
        </div>
      )}

      {/* Timer bar */}
      <div className="px-4">
        <Progress
          value={(() => {
            const currentQ = questions[currentIndex];
            const qTime = currentQ?.custom_time || totalTime;
            return qTime > 0 ? (timeLeft / qTime) * 100 : 0;
          })()}
          className={`h-2 ${t.progressBg}`}
        />
      </div>

      {/* Timer + Question */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6">
        {/* Timer circle */}
        <motion.div
          className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-heading font-bold ${
            timeUp
              ? t.timerDanger
              : timeLeft <= 5
              ? `${t.timerDanger} animate-pulse`
              : `${t.timerBg} ${t.timerText}`
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
            {(currentQuestion as any).youtube_url && (
              <div className="mb-4">
                <YouTubeEmbed url={(currentQuestion as any).youtube_url} className="max-h-56" />
              </div>
            )}
            {currentQuestion.image_url && !(currentQuestion as any).youtube_url && (
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
            const showCorrectGenius = timeUp && !isKingOrTribeMode && revealedCorrectAnswerId === answer.id;
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
                      ? `${t.answerColors[idx % t.answerColors.length]} ring-4 ring-white/50 scale-[0.97]`
                      : `${t.answerColors[idx % t.answerColors.length]} hover:scale-[1.02] active:scale-[0.97]`
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
              myAnswerCorrect
                ? "text-[hsl(var(--accent))]"
                : "text-destructive-foreground"
            }`}
          >
            {myAnswerCorrect
              ? `תשובה נכונה! 🎉${correctStreak >= 3 ? ` 🔥 רצף של ${correctStreak}!` : ""}`
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
              ? `תשובה נכונה! 🎉${correctStreak >= 3 ? ` 🔥 רצף של ${correctStreak}!` : ""}`
              : `תשובה שגויה. התשובה הנכונה: ${correctAnswerForDisplay?.text || "?"}`}
          </motion.p>
        )}

        {/* Host: stats + leaderboard + next question buttons */}
        {isHost && !showLeaderboard && !showStats && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-3 mt-8 pt-4 border-t border-muted/30 justify-center">
            <Button
              variant="outline"
              size="lg"
              onClick={handleShowStats}
              disabled={isKingOrTribeMode && !kingAnswerId}
              className="text-muted-foreground"
            >
              <BarChart3 className="!size-4" />
              סטטיסטיקה
            </Button>
            <Button variant="outline" size="lg" onClick={handleShowLeaderboard} className="text-muted-foreground">
              <Trophy className="!size-4" />
              לוח נקודות
            </Button>
            <Button variant="outline" size="lg" onClick={handleNextQuestion} className="text-muted-foreground">
              <ArrowLeft className="!size-4" />
              {currentIndex + 1 >= questions.length ? "סיים משחק" : "שאלה הבאה"}
            </Button>
          </motion.div>
        )}
      </div>

      {/* Statistics overlay */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 ${t.bg} flex items-center justify-center px-4`}
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md"
            >
              <div className="text-center mb-4">
                <BarChart3 className="size-12 text-primary mx-auto mb-2" />
                <h2 className={`text-2xl font-heading font-bold ${t.text}`}>התפלגות תשובות</h2>
                <p className={`${t.textSecondary} text-sm`}>שאלה {currentIndex + 1}: {questions[currentIndex]?.text}</p>
              </div>

              <div className="bg-card rounded-3xl p-6 shadow-elevated space-y-4">
                {statsData.map((item, idx) => {
                  const maxCount = Math.max(...statsData.map(s => s.count), 1);
                  const pct = Math.round((item.count / participantCount) * 100) || 0;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.08 }}
                      className="space-y-1"
                    >
                      <div className="flex justify-between text-sm">
                        <span className="font-heading font-semibold text-foreground truncate max-w-[70%]">{item.text}</span>
                        <span className="text-muted-foreground font-heading">{item.count} ({pct}%)</span>
                      </div>
                      <div className="h-6 bg-muted/30 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${item.colorClass}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${maxCount > 0 ? (item.count / maxCount) * 100 : 0}%` }}
                          transition={{ delay: idx * 0.08 + 0.2, duration: 0.5, ease: "easeOut" }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
                {statsData.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">אין נתונים עדיין</p>
                )}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-4 flex gap-3"
              >
                <Button variant="outline" size="lg" className="flex-1" onClick={() => {
                  setShowStats(false);
                  handleShowLeaderboard();
                }}>
                  <Trophy className="!size-4" />
                  לוח נקודות
                </Button>
                <Button variant="hero" size="lg" className="flex-1" onClick={() => {
                  setShowStats(false);
                  handleNextQuestion();
                }}>
                  <ArrowLeft className="!size-4" />
                  {currentIndex + 1 >= questions.length ? "סיים משחק" : "שאלה הבאה"}
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaderboard overlay */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 ${t.bg} flex items-center justify-center px-4`}
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
                <h2 className={`text-2xl font-heading font-bold ${t.text}`}>לוח נקודות</h2>
                <p className={`${t.textSecondary} text-sm`}>אחרי שאלה {currentIndex + 1} מתוך {questions.length}</p>
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
                      <StarBadge maxStreak={entry.max_streak ?? 0} totalCorrect={entry.total_correct ?? 0} />
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

      {/* Player leaderboard popup */}
      <AnimatePresence>
        {showPlayerLeaderboard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
            dir="rtl"
            onClick={() => setShowPlayerLeaderboard(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-4">
                <Trophy className="size-12 text-[hsl(var(--answer-yellow))] mx-auto mb-2" />
                <h2 className="text-2xl font-heading font-bold text-primary-foreground">לוח נקודות</h2>
                <p className="text-primary-foreground/60 text-sm">אחרי שאלה {currentIndex + 1} מתוך {questions.length}</p>
              </div>

              <div className="bg-card rounded-3xl p-6 shadow-elevated space-y-3 max-h-[60vh] overflow-y-auto">
                {playerLeaderboardData.map((entry, idx) => (
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
                {playerLeaderboardData.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">אין נתונים עדיין</p>
                )}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-4"
              >
                <Button variant="hero" size="xl" className="w-full" onClick={() => setShowPlayerLeaderboard(false)}>
                  סגור
                </Button>
              </motion.div>
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
  quizTheme,
  quizYoutubeUrl,
  quizImageUrl,
  quizTitle,
  quizLogoUrl,
  quizLogoText,
}: {
  sessionId: string;
  isHost: boolean;
  playerName: string;
  score: number;
  quizMode: string;
  kingParticipantId: string | null;
  quizTheme: GameTheme;
  quizYoutubeUrl: string | null;
  quizImageUrl: string | null;
  quizTitle: string;
  quizLogoUrl: string | null;
  quizLogoText: string | null;
}) => {
  const navigate = useNavigate();
  const t = themeClasses[quizTheme];
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

  // Assign ranks with ties (same score = same rank)
  const rankedLeaderboard = leaderboard.map((entry, idx) => {
    let rank = 1;
    for (let i = 0; i < idx; i++) {
      if (leaderboard[i].total_score > entry.total_score) {
        rank = i + 1 + 1; // next rank after this different-score group
      }
    }
    // More precise: rank = number of players with strictly higher score + 1
    rank = leaderboard.filter(e => e.total_score > entry.total_score).length + 1;
    return { ...entry, rank };
  });

  // Podium entries: all players with rank 1, 2, or 3
  const podiumEntries = rankedLeaderboard.filter(e => e.rank <= 3);
  const restEntries = rankedLeaderboard.filter(e => e.rank > 3);

  const medalEmojis: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
  
  // Group podium by rank for display
  const podiumByRank = [1, 2, 3]
    .map(rank => ({
      rank,
      players: podiumEntries.filter(e => e.rank === rank),
    }))
    .filter(g => g.players.length > 0);

  // Podium visual order: if we have 3 distinct ranks, show [2nd, 1st, 3rd]
  const podiumDisplayOrder = podiumByRank.length >= 3
    ? [podiumByRank[1], podiumByRank[0], podiumByRank[2]]
    : podiumByRank;

  const podiumHeights: Record<number, string> = { 1: "h-28", 2: "h-20", 3: "h-14" };
  const podiumTextSizes: Record<number, string> = { 1: "text-xl", 2: "text-base", 3: "text-sm" };
  const podiumMedalSizes: Record<number, string> = { 1: "text-4xl", 2: "text-3xl", 3: "text-2xl" };

  return (
    <div className={`min-h-screen ${t.bg} flex items-center justify-center px-4`} dir="rtl">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="text-center mb-6">
          <QuizLogo logoUrl={quizLogoUrl} logoText={quizLogoText} size="lg" className="mb-3" />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
          >
            <Trophy className="size-16 text-[hsl(var(--answer-yellow))] mx-auto mb-2" />
          </motion.div>
          <h1 className={`text-3xl font-heading font-bold ${t.text}`}>המשחק נגמר!</h1>
        </div>

        <div className="bg-card rounded-3xl p-8 shadow-elevated space-y-6">
          {/* Podium for top ranks */}
          {podiumDisplayOrder.length > 0 && (
            <div className="flex items-end justify-center gap-3 pt-4 pb-2">
              {podiumDisplayOrder.map((group, displayIdx) => {
                if (!group || group.players.length === 0) return null;
                const rank = group.rank;

                return (
                  <motion.div
                    key={rank}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + displayIdx * 0.15 }}
                    className="flex flex-col items-center gap-1 flex-1 max-w-[140px]"
                  >
                    <span className={podiumMedalSizes[rank]}>{medalEmojis[rank]}</span>
                    {group.players.map((entry, pIdx) => (
                      <span
                        key={pIdx}
                        className={`font-heading font-bold truncate max-w-full ${podiumTextSizes[rank]} ${
                          entry.player_name === playerName ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {entry.player_name}
                      </span>
                    ))}
                    <span className="text-sm font-heading font-bold text-muted-foreground">
                      {group.players[0].total_score} נק׳
                    </span>
                    <div
                      className={`w-full ${podiumHeights[rank]} rounded-t-xl ${
                        rank === 1
                          ? "bg-[hsl(var(--answer-yellow))]/30 border-2 border-[hsl(var(--answer-yellow))]/50"
                          : rank === 2
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
          {restEntries.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">שאר המשתתפים</p>
              {restEntries.map((entry, idx) => (
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
                      {entry.rank}
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

          {/* Quiz media below results */}
          {quizYoutubeUrl && (
            <div className="pt-2">
              <YouTubeEmbed url={quizYoutubeUrl} />
            </div>
          )}
          {quizImageUrl && !quizYoutubeUrl && (
            <img
              src={quizImageUrl}
              alt={quizTitle}
              className="w-full max-h-48 object-contain rounded-2xl"
            />
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
