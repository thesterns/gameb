
CREATE TABLE public.challenge_sentences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.game_participants(id) ON DELETE CASCADE,
  sentence TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (session_id, participant_id)
);

ALTER TABLE public.challenge_sentences ENABLE ROW LEVEL SECURITY;

-- Anyone in an active/finished game can read sentences
CREATE POLICY "Anyone can read sentences of active games"
  ON public.challenge_sentences FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE game_sessions.id = challenge_sentences.session_id
    AND game_sessions.status IN ('active', 'finished')
  ));

-- Anyone can insert their own sentence
CREATE POLICY "Participants can insert own sentence"
  ON public.challenge_sentences FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.game_participants
    WHERE game_participants.id = challenge_sentences.participant_id
    AND game_participants.session_id = challenge_sentences.session_id
  ));

-- Enable realtime for sentences
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_sentences;
