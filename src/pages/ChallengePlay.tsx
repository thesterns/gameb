import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Target, Users, Clock, MapPin, User, Package, Sparkles, Send, CheckCircle } from "lucide-react";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import QuizLogo from "@/components/QuizLogo";
import { toast } from "sonner";

const DIMENSION_META: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  time: { label: "זמן", icon: Clock, color: "text-[hsl(var(--answer-blue))]" },
  place: { label: "מקום", icon: MapPin, color: "text-[hsl(var(--answer-green))]" },
  person: { label: "אדם", icon: User, color: "text-[hsl(var(--answer-red))]" },
  object: { label: "חפץ", icon: Package, color: "text-[hsl(var(--answer-yellow))]" },
  extra: { label: "נוסף", icon: Sparkles, color: "text-[hsl(var(--answer-purple))]" },
};

type VoteType = "gold" | "silver" | "bronze" | "none";

const VOTE_META: Record<VoteType, { label: string; emoji: string; points: number; color: string }> = {
  gold: { label: "זהב", emoji: "🥇", points: 3, color: "text-yellow-500" },
  silver: { label: "כסף", emoji: "🥈", points: 2, color: "text-gray-400" },
  bronze: { label: "ארד", emoji: "🥉", points: 1, color: "text-amber-700" },
  none: { label: "ללא", emoji: "➖", points: 0, color: "text-muted-foreground" },
};

interface Assignment {
  dimension: string;
  value: string;
}

interface SentenceEntry {
  participant_id: string;
  player_name: string;
  sentence: string;
}

interface Vote {
  voter_participant_id: string;
  target_participant_id: string;
  vote_type: VoteType;
}

interface ParticipantWithAssignments {
  id: string;
  player_name: string;
  assignments: Assignment[];
}

const ChallengePlay = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isHost = (location.state as { isHost?: boolean })?.isHost || false;
  const playerName = (location.state as { playerName?: string })?.playerName || "";

  const [challenge, setChallenge] = useState<{
    title: string;
    description: string | null;
    image_url: string | null;
    youtube_url: string | null;
    logo_url: string | null;
    logo_text: string | null;
  } | null>(null);
  const [participantsWithAssignments, setParticipantsWithAssignments] = useState<ParticipantWithAssignments[]>([]);
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [sentence, setSentence] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sentences, setSentences] = useState<SentenceEntry[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);

  // Compute my votes (what I voted for others)
  const myVotes = votes.filter((v) => v.voter_participant_id === myParticipantId);
  const getMyVoteForTarget = (targetId: string): VoteType => {
    const v = myVotes.find((v) => v.target_participant_id === targetId);
    return v?.vote_type || "none";
  };

  // Compute scores per participant from all votes
  const getScores = useCallback(() => {
    const scores: Record<string, number> = {};
    for (const v of votes) {
      const pts = VOTE_META[v.vote_type]?.points || 0;
      scores[v.target_participant_id] = (scores[v.target_participant_id] || 0) + pts;
    }
    return scores;
  }, [votes]);

  // Get ranking (1st, 2nd, 3rd)
  const getRanking = useCallback(() => {
    const scores = getScores();
    const sorted = Object.entries(scores)
      .filter(([, s]) => s > 0)
      .sort(([, a], [, b]) => b - a);

    const ranking: Record<string, number> = {};
    let rank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i][1] < sorted[i - 1][1]) rank = i + 1;
      if (rank <= 3) ranking[sorted[i][0]] = rank;
    }
    return ranking;
  }, [getScores]);

  const RANK_DISPLAY: Record<number, { emoji: string; label: string; bg: string }> = {
    1: { emoji: "🏆", label: "מקום ראשון", bg: "bg-yellow-500/10 border-yellow-500/30" },
    2: { emoji: "🥈", label: "מקום שני", bg: "bg-gray-400/10 border-gray-400/30" },
    3: { emoji: "🥉", label: "מקום שלישי", bg: "bg-amber-700/10 border-amber-700/30" },
  };

  useEffect(() => {
    if (!sessionId) return;

    const load = async () => {
      const { data: session } = await supabase
        .from("game_sessions")
        .select("challenge_id")
        .eq("id", sessionId)
        .single();

      if (!session?.challenge_id) {
        navigate("/dashboard");
        return;
      }

      const [chRes, partsRes, assignRes, sentRes, votesRes] = await Promise.all([
        supabase.from("challenges").select("title, description, image_url, youtube_url, logo_url, logo_text").eq("id", session.challenge_id).single(),
        supabase.from("game_participants").select("id, player_name").eq("session_id", sessionId).order("joined_at"),
        supabase.from("participant_dimension_assignments").select("participant_id, dimension, value").eq("session_id", sessionId),
        supabase.from("challenge_sentences").select("participant_id, sentence").eq("session_id", sessionId),
        supabase.from("challenge_votes").select("voter_participant_id, target_participant_id, vote_type").eq("session_id", sessionId),
      ]);

      setChallenge(chRes.data || null);

      const parts = partsRes.data || [];
      const assignmentMap: Record<string, Assignment[]> = {};
      for (const a of assignRes.data || []) {
        if (!assignmentMap[a.participant_id]) assignmentMap[a.participant_id] = [];
        assignmentMap[a.participant_id].push({ dimension: a.dimension, value: a.value });
      }

      const pwa: ParticipantWithAssignments[] = parts.map((p) => ({
        ...p,
        assignments: assignmentMap[p.id] || [],
      }));
      setParticipantsWithAssignments(pwa);

      if (!isHost && playerName) {
        const myP = pwa.find((p) => p.player_name === playerName);
        if (myP) {
          setMyParticipantId(myP.id);
          setMyAssignments(myP.assignments);
        }
      }

      const nameMap: Record<string, string> = {};
      for (const p of parts) nameMap[p.id] = p.player_name;

      if (sentRes.data) {
        const entries: SentenceEntry[] = sentRes.data.map((s) => ({
          participant_id: s.participant_id,
          player_name: nameMap[s.participant_id] || "",
          sentence: s.sentence,
        }));
        setSentences(entries);

        if (!isHost && playerName) {
          const myP = pwa.find((p) => p.player_name === playerName);
          if (myP && sentRes.data.some((s) => s.participant_id === myP.id)) {
            setSubmitted(true);
            const mySentence = sentRes.data.find((s) => s.participant_id === myP.id);
            if (mySentence) setSentence(mySentence.sentence);
          }
        }
      }

      if (votesRes.data) {
        setVotes(votesRes.data.map((v) => ({ ...v, vote_type: v.vote_type as VoteType })));
      }

      setLoading(false);
    };

    load();

    // Realtime for sentences
    const sentChannel = supabase
      .channel(`challenge-sentences-${sessionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "challenge_sentences", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const newS = payload.new as { participant_id: string; sentence: string };
          setParticipantsWithAssignments((prev) => {
            const player = prev.find((p) => p.id === newS.participant_id);
            if (!player) return prev;
            setSentences((prevSentences) => {
              if (prevSentences.some((s) => s.participant_id === newS.participant_id)) return prevSentences;
              return [...prevSentences, { participant_id: newS.participant_id, player_name: player.player_name, sentence: newS.sentence }];
            });
            return prev;
          });
        }
      )
      .subscribe();

    // Realtime for votes
    const voteChannel = supabase
      .channel(`challenge-votes-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_votes", filter: `session_id=eq.${sessionId}` },
        () => {
          // Refetch all votes on any change
          supabase.from("challenge_votes").select("voter_participant_id, target_participant_id, vote_type").eq("session_id", sessionId)
            .then(({ data }) => {
              if (data) setVotes(data.map((v) => ({ ...v, vote_type: v.vote_type as VoteType })));
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sentChannel);
      supabase.removeChannel(voteChannel);
    };
  }, [sessionId, navigate, isHost, playerName]);

  const handleSubmitSentence = async () => {
    if (!sentence.trim() || !myParticipantId || !sessionId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("challenge_sentences").insert({
        session_id: sessionId,
        participant_id: myParticipantId,
        sentence: sentence.trim(),
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success("המשפט נשלח!");
    } catch {
      toast.error("שגיאה בשליחה");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoteFixed = async (targetId: string, newVoteType: VoteType) => {
    if (!myParticipantId || !sessionId) return;

    const currentVote = getMyVoteForTarget(targetId);
    const existingOfType = myVotes.find((v) => v.vote_type === newVoteType && v.target_participant_id !== targetId);

    try {
      if (newVoteType === "none") {
        if (currentVote !== "none") {
          await supabase.from("challenge_votes")
            .delete()
            .eq("session_id", sessionId)
            .eq("voter_participant_id", myParticipantId)
            .eq("target_participant_id", targetId);
        }
      } else {
        if (existingOfType) {
          await supabase.from("challenge_votes")
            .delete()
            .eq("session_id", sessionId)
            .eq("voter_participant_id", myParticipantId)
            .eq("target_participant_id", existingOfType.target_participant_id);
        }
        if (currentVote !== "none") {
          await supabase.from("challenge_votes")
            .delete()
            .eq("session_id", sessionId)
            .eq("voter_participant_id", myParticipantId)
            .eq("target_participant_id", targetId);
        }
        await supabase.from("challenge_votes").insert({
          session_id: sessionId,
          voter_participant_id: myParticipantId,
          target_participant_id: targetId,
          vote_type: newVoteType,
        });
      }

      setVotes((prev) => {
        let updated = prev.filter(
          (v) => !(v.voter_participant_id === myParticipantId && v.target_participant_id === targetId)
        );
        if (newVoteType !== "none" && existingOfType) {
          updated = updated.filter(
            (v) => !(v.voter_participant_id === myParticipantId && v.target_participant_id === existingOfType.target_participant_id)
          );
        }
        if (newVoteType !== "none") {
          updated.push({ voter_participant_id: myParticipantId, target_participant_id: targetId, vote_type: newVoteType });
        }
        return updated;
      });
    } catch {
      toast.error("שגיאה בדירוג");
    }
  };

  if (loading || !challenge) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">טוען...</p>
      </div>
    );
  }

  const dimensionOrder = ["time", "place", "person", "object", "extra"];

  const renderAssignments = (assignments: Assignment[]) => {
    const sorted = [...assignments].sort(
      (a, b) => dimensionOrder.indexOf(a.dimension) - dimensionOrder.indexOf(b.dimension)
    );
    return (
      <div className="space-y-2">
        {sorted.map((a) => {
          const meta = DIMENSION_META[a.dimension];
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <motion.div
              key={a.dimension}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3"
            >
              <Icon className={`size-5 ${meta.color} shrink-0`} />
              <span className="text-sm font-medium text-muted-foreground w-12">{meta.label}</span>
              <span className="font-heading font-bold text-foreground">{a.value}</span>
            </motion.div>
          );
        })}
      </div>
    );
  };

  const visibleSentences = isHost ? sentences : submitted ? sentences : [];
  const otherSentences = visibleSentences.filter((s) => s.participant_id !== myParticipantId);
  const scores = getScores();
  const ranking = getRanking();

  // Sort participants by score for host view
  const sortedParticipants = [...participantsWithAssignments].sort((a, b) => {
    return (scores[b.id] || 0) - (scores[a.id] || 0);
  });

  const voteOptions: VoteType[] = ["gold", "silver", "bronze", "none"];

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center px-4 py-8">
      <motion.div
        className="w-full max-w-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <QuizLogo logoUrl={challenge.logo_url} logoText={challenge.logo_text} size="md" className="mb-4" />

        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 text-primary-foreground/70 text-sm mb-2">
            <Target className="size-4" />
            <span>אתגר</span>
          </div>
          <h1 className="text-3xl font-heading font-bold text-primary-foreground">
            {challenge.title}
          </h1>
          {challenge.description && (
            <p className="text-primary-foreground/80 mt-2">{challenge.description}</p>
          )}
        </div>

        <div className="bg-card rounded-3xl p-8 shadow-elevated space-y-6">
          {challenge.youtube_url && <YouTubeEmbed url={challenge.youtube_url} />}
          {challenge.image_url && !challenge.youtube_url && (
            <img src={challenge.image_url} alt={challenge.title} className="w-full max-h-64 object-contain rounded-2xl" />
          )}

          {/* Player view: assignments + sentence input */}
          {!isHost && (
            <>
              {myAssignments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-heading font-bold text-lg text-center">🎯 הערכים שלך</h3>
                  {renderAssignments(myAssignments)}
                </div>
              )}

              {myAssignments.length === 0 && !myParticipantId && (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">לא הוקצו ערכים</p>
                </div>
              )}

              {/* Sentence input */}
              {myParticipantId && (
                <div className="space-y-3">
                  <h3 className="font-heading font-bold text-sm text-muted-foreground text-center">
                    כתבו משפט שמשלב את כל הערכים שקיבלתם
                  </h3>
                  {submitted ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-accent/10 border border-accent/30 rounded-xl p-4 text-center space-y-2"
                    >
                      <CheckCircle className="size-6 text-accent mx-auto" />
                      <p className="font-heading font-bold text-foreground">המשפט נשלח!</p>
                      <p className="text-sm text-muted-foreground italic">"{sentence}"</p>
                    </motion.div>
                  ) : (
                    <div className="space-y-2">
                      <Textarea
                        value={sentence}
                        onChange={(e) => setSentence(e.target.value)}
                        placeholder="כתבו את המשפט שלכם כאן..."
                        className="text-right min-h-[100px]"
                        maxLength={500}
                      />
                      <Button
                        variant="hero"
                        className="w-full"
                        onClick={handleSubmitSentence}
                        disabled={!sentence.trim() || submitting}
                      >
                        <Send className="!size-4" />
                        {submitting ? "שולח..." : "שלח משפט"}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Other players' sentences with voting */}
              {submitted && otherSentences.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-heading font-bold text-lg flex items-center gap-2">
                    📝 דרגו את המשפטים
                  </h3>
                  <p className="text-xs text-muted-foreground text-center">
                    בחרו זהב 🥇, כסף 🥈 וארד 🥉 – אחד מכל סוג
                  </p>
                  <AnimatePresence>
                    {otherSentences.map((s) => {
                      const currentVote = getMyVoteForTarget(s.participant_id);
                      const rank = ranking[s.participant_id];
                      const rankInfo = rank ? RANK_DISPLAY[rank] : null;
                      return (
                        <motion.div
                          key={s.participant_id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`rounded-xl p-4 space-y-3 border ${rankInfo ? rankInfo.bg : "bg-muted/30 border-transparent"}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <p className="font-heading font-bold text-sm text-foreground">{s.player_name}</p>
                              {rankInfo && <span className="text-lg">{rankInfo.emoji}</span>}
                            </div>
                            {scores[s.participant_id] > 0 && (
                              <span className="text-xs font-bold text-muted-foreground">{scores[s.participant_id]} נק׳</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{s.sentence}</p>
                          <div className="flex gap-1.5">
                            {voteOptions.map((vt) => {
                              const meta = VOTE_META[vt];
                              const isSelected = currentVote === vt;
                              return (
                                <button
                                  key={vt}
                                  onClick={() => handleVoteFixed(s.participant_id, vt === currentVote ? "none" : vt)}
                                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground scale-105"
                                      : "bg-muted/50 hover:bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {meta.emoji}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}

          {/* Host: show participants with sentences and scores */}
          {isHost && (
            <div className="space-y-4">
              <h3 className="font-heading font-bold text-lg flex items-center gap-2">
                <Users className="size-5" />
                משתתפים ({sentences.length}/{participantsWithAssignments.length} שלחו)
              </h3>
              {sortedParticipants.map((p) => {
                const pSentence = sentences.find((s) => s.participant_id === p.id);
                const score = scores[p.id] || 0;
                const rank = ranking[p.id];
                const rankInfo = rank ? RANK_DISPLAY[rank] : null;
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`border rounded-2xl p-4 space-y-2 ${rankInfo ? rankInfo.bg : "border-border"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {rankInfo && <span className="text-xl">{rankInfo.emoji}</span>}
                        <h4 className="font-heading font-bold text-foreground">{p.player_name}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        {score > 0 && (
                          <span className="text-sm font-bold text-primary">{score} נק׳</span>
                        )}
                        {pSentence ? (
                          <CheckCircle className="size-4 text-accent" />
                        ) : (
                          <span className="text-xs text-muted-foreground">ממתין...</span>
                        )}
                      </div>
                    </div>
                    {pSentence && (
                      <p className="text-sm text-muted-foreground">{pSentence.sentence}</p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate(isHost ? "/dashboard" : "/")}
          >
            <ArrowRight className="!size-4" />
            {isHost ? "חזרה לדשבורד" : "חזרה לדף הבית"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default ChallengePlay;
