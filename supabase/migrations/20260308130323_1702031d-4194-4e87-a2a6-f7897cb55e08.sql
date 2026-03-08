
-- Table to store player responses
CREATE TABLE public.game_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.game_participants(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_id uuid REFERENCES public.answers(id) ON DELETE SET NULL,
  is_correct boolean NOT NULL DEFAULT false,
  score integer NOT NULL DEFAULT 0,
  answered_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(participant_id, question_id)
);

ALTER TABLE public.game_responses ENABLE ROW LEVEL SECURITY;

-- Anyone can read responses (for leaderboard)
CREATE POLICY "Anyone can read responses" ON public.game_responses
  FOR SELECT USING (true);

-- Anyone can insert responses (players are unauthenticated)
CREATE POLICY "Anyone can insert responses" ON public.game_responses
  FOR INSERT WITH CHECK (true);

-- Add current_question_index to game_sessions
ALTER TABLE public.game_sessions ADD COLUMN current_question_index integer NOT NULL DEFAULT 0;

-- Enable realtime for game_responses
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_responses;

-- Allow reading questions and answers for active game sessions
CREATE POLICY "Anyone can read questions of active games" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM game_sessions
      WHERE game_sessions.quiz_id = questions.quiz_id
      AND game_sessions.status IN ('active', 'lobby')
    )
  );

CREATE POLICY "Anyone can read answers of active games" ON public.answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM questions
      JOIN game_sessions ON game_sessions.quiz_id = questions.quiz_id
      WHERE questions.id = answers.question_id
      AND game_sessions.status IN ('active', 'lobby')
    )
  );
