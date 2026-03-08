import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Users, Trophy, Calendar } from "lucide-react";

interface Session {
  id: string;
  created_at: string;
  status: string;
  join_code: string;
}

interface ParticipantScore {
  player_name: string;
  total_score: number;
}

interface GameHistoryDialogProps {
  quizId: string;
  quizTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GameHistoryDialog = ({ quizId, quizTitle, open, onOpenChange }: GameHistoryDialogProps) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionScores, setSessionScores] = useState<Record<string, ParticipantScore[]>>({});
  const [loadingSession, setLoadingSession] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("game_sessions")
      .select("id, created_at, status, join_code")
      .eq("quiz_id", quizId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setSessions(data || []);
        setLoading(false);
      });
  }, [open, quizId]);

  const loadScores = async (sessionId: string) => {
    if (sessionScores[sessionId]) return;
    setLoadingSession(sessionId);

    const { data: participants } = await supabase
      .from("game_participants")
      .select("id, player_name")
      .eq("session_id", sessionId)
      .order("joined_at");

    if (!participants?.length) {
      setSessionScores((prev) => ({ ...prev, [sessionId]: [] }));
      setLoadingSession(null);
      return;
    }

    const { data: responses } = await supabase
      .from("game_responses")
      .select("participant_id, score")
      .eq("session_id", sessionId);

    const scoreMap: Record<string, number> = {};
    (responses || []).forEach((r) => {
      scoreMap[r.participant_id] = (scoreMap[r.participant_id] || 0) + r.score;
    });

    const scores: ParticipantScore[] = participants
      .map((p) => ({ player_name: p.player_name, total_score: scoreMap[p.id] || 0 }))
      .sort((a, b) => b.total_score - a.total_score);

    setSessionScores((prev) => ({ ...prev, [sessionId]: scores }));
    setLoadingSession(null);
  };

  const statusLabels: Record<string, string> = {
    lobby: "ממתין",
    active: "פעיל",
    finished: "הסתיים",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">היסטוריית משחקים – {quizTitle}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-center text-muted-foreground py-8">טוען...</p>
        ) : sessions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">אין הפעלות קודמות</p>
        ) : (
          <Accordion type="single" collapsible className="space-y-2">
            {sessions.map((session, idx) => (
              <AccordionItem key={session.id} value={session.id} className="border rounded-xl px-4">
                <AccordionTrigger
                  className="hover:no-underline py-3"
                  onClick={() => loadScores(session.id)}
                >
                  <div className="flex items-center gap-3 text-sm w-full">
                    <span className="font-heading font-semibold">הפעלה {sessions.length - idx}</span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="size-3" />
                      {new Date(session.created_at).toLocaleDateString("he-IL")}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground mr-auto">
                      {statusLabels[session.status] || session.status}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {loadingSession === session.id ? (
                    <p className="text-sm text-muted-foreground py-2">טוען תוצאות...</p>
                  ) : !sessionScores[session.id]?.length ? (
                    <p className="text-sm text-muted-foreground py-2">אין משתתפים</p>
                  ) : (
                    <div className="space-y-1.5 pb-2">
                      {sessionScores[session.id].map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            {i === 0 && <Trophy className="size-4 text-answer-yellow" />}
                            {i === 1 && <span className="text-muted-foreground font-mono w-4 text-center">2</span>}
                            {i === 2 && <span className="text-muted-foreground font-mono w-4 text-center">3</span>}
                            {i > 2 && <span className="text-muted-foreground font-mono w-4 text-center">{i + 1}</span>}
                            <span className="font-medium">{p.player_name}</span>
                          </div>
                          <span className="font-heading font-bold">{p.total_score} נק׳</span>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GameHistoryDialog;
