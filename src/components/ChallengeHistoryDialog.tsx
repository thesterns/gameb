import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Share2 } from "lucide-react";
import { toast } from "sonner";

interface ChallengeSession {
  id: string;
  created_at: string;
  challenge_title: string;
  participants: { id: string; player_name: string }[];
  sentences: { participant_id: string; sentence: string }[];
  scores: Record<string, number>;
  ranking: Record<string, number>;
}

const RANK_EMOJI: Record<number, string> = { 1: "🏆", 2: "🥈", 3: "🥉" };

interface ChallengeHistoryDialogProps {
  challengeId: string;
  challengeTitle: string;
}

const ChallengeHistoryDialog = ({ challengeId, challengeTitle }: ChallengeHistoryDialogProps) => {
  const [sessions, setSessions] = useState<ChallengeSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);

      // Get all sessions for this challenge
      const { data: gameSessions } = await supabase
        .from("game_sessions")
        .select("id, created_at")
        .eq("challenge_id", challengeId)
        .in("status", ["active", "finished"])
        .order("created_at", { ascending: false });

      if (!gameSessions?.length) {
        setSessions([]);
        setLoading(false);
        return;
      }

      const sessionIds = gameSessions.map((s) => s.id);

      const [partsRes, sentRes, votesRes] = await Promise.all([
        supabase.from("game_participants").select("id, player_name, session_id").in("session_id", sessionIds),
        supabase.from("challenge_sentences").select("participant_id, sentence, session_id").in("session_id", sessionIds),
        supabase.from("challenge_votes").select("session_id, target_participant_id, vote_type").in("session_id", sessionIds),
      ]);

      const result: ChallengeSession[] = gameSessions.map((gs) => {
        const parts = (partsRes.data || []).filter((p) => p.session_id === gs.id);
        const sents = (sentRes.data || []).filter((s) => s.session_id === gs.id);
        const sessionVotes = (votesRes.data || []).filter((v) => v.session_id === gs.id);

        const VOTE_POINTS: Record<string, number> = { gold: 3, silver: 2, bronze: 1 };
        const scores: Record<string, number> = {};
        for (const v of sessionVotes) {
          scores[v.target_participant_id] = (scores[v.target_participant_id] || 0) + (VOTE_POINTS[v.vote_type] || 0);
        }

        const sorted = Object.entries(scores)
          .filter(([, s]) => s > 0)
          .sort(([, a], [, b]) => b - a);
        const ranking: Record<string, number> = {};
        let rank = 1;
        for (let i = 0; i < sorted.length; i++) {
          if (i > 0 && sorted[i][1] < sorted[i - 1][1]) rank = i + 1;
          if (rank <= 3) ranking[sorted[i][0]] = rank;
        }

        return {
          id: gs.id,
          created_at: gs.created_at,
          challenge_title: challengeTitle,
          participants: parts.map((p) => ({ id: p.id, player_name: p.player_name })),
          sentences: sents.map((s) => ({ participant_id: s.participant_id, sentence: s.sentence })),
          scores,
          ranking,
        };
      });

      setSessions(result.filter((s) => s.sentences.length > 0));
      setLoading(false);
    };

    load();
  }, [open, challengeId, challengeTitle]);

  const shareToWhatsApp = (session: ChallengeSession) => {
    const nameMap: Record<string, string> = {};
    for (const p of session.participants) nameMap[p.id] = p.player_name;

    // Sort by score
    const sortedSentences = [...session.sentences].sort((a, b) => {
      return (session.scores[b.participant_id] || 0) - (session.scores[a.participant_id] || 0);
    });

    let text = `🎯 *${session.challenge_title}*\n\n`;

    for (const s of sortedSentences) {
      const name = nameMap[s.participant_id] || "?";
      const rank = session.ranking[s.participant_id];
      const emoji = rank ? RANK_EMOJI[rank] + " " : "";
      const score = session.scores[s.participant_id] || 0;
      text += `${emoji}*${name}*${score > 0 ? ` (${score} נק׳)` : ""}\n${s.sentence}\n\n`;
    }

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full mt-2">
          <MessageSquare className="!size-4" />
          הצג משפטים
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading text-right">משפטים - {challengeTitle}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <p className="text-center text-muted-foreground py-4">טוען...</p>
          ) : sessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">אין משחקים עם משפטים</p>
          ) : (
            <div className="space-y-6 pr-2">
              {sessions.map((session) => {
                const nameMap: Record<string, string> = {};
                for (const p of session.participants) nameMap[p.id] = p.player_name;

                const sortedSentences = [...session.sentences].sort((a, b) => {
                  return (session.scores[b.participant_id] || 0) - (session.scores[a.participant_id] || 0);
                });

                return (
                  <div key={session.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.created_at).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <Button variant="ghost" size="sm" onClick={() => shareToWhatsApp(session)}>
                        <Share2 className="!size-4" />
                        WhatsApp
                      </Button>
                    </div>
                    {sortedSentences.map((s) => {
                      const rank = session.ranking[s.participant_id];
                      const score = session.scores[s.participant_id] || 0;
                      return (
                        <div
                          key={s.participant_id}
                          className={`rounded-xl p-3 space-y-1 border ${
                            rank === 1 ? "bg-yellow-500/10 border-yellow-500/30" :
                            rank === 2 ? "bg-gray-400/10 border-gray-400/30" :
                            rank === 3 ? "bg-amber-700/10 border-amber-700/30" :
                            "bg-muted/30 border-transparent"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {rank && <span className="text-lg">{RANK_EMOJI[rank]}</span>}
                              <p className="font-heading font-bold text-sm">{nameMap[s.participant_id]}</p>
                            </div>
                            {score > 0 && <span className="text-xs font-bold text-primary">{score} נק׳</span>}
                          </div>
                          <p className="text-sm text-muted-foreground">{s.sentence}</p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ChallengeHistoryDialog;
