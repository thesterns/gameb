-- Create challenge_votes table for gold/silver/bronze voting
CREATE TABLE public.challenge_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  voter_participant_id uuid NOT NULL REFERENCES public.game_participants(id) ON DELETE CASCADE,
  target_participant_id uuid NOT NULL REFERENCES public.game_participants(id) ON DELETE CASCADE,
  vote_type text NOT NULL CHECK (vote_type IN ('gold', 'silver', 'bronze')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, voter_participant_id, vote_type),
  UNIQUE (session_id, voter_participant_id, target_participant_id)
);

ALTER TABLE public.challenge_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read votes of active/finished games
CREATE POLICY "Anyone can read votes of active games"
ON public.challenge_votes
FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM game_sessions
    WHERE game_sessions.id = challenge_votes.session_id
    AND game_sessions.status IN ('active', 'finished')
  )
);

-- Participants can insert their own votes
CREATE POLICY "Participants can insert own votes"
ON public.challenge_votes
FOR INSERT
TO authenticated, anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM game_participants
    WHERE game_participants.id = challenge_votes.voter_participant_id
    AND game_participants.session_id = challenge_votes.session_id
  )
);

-- Participants can update their own votes
CREATE POLICY "Participants can update own votes"
ON public.challenge_votes
FOR UPDATE
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM game_participants
    WHERE game_participants.id = challenge_votes.voter_participant_id
    AND game_participants.session_id = challenge_votes.session_id
  )
);

-- Participants can delete their own votes
CREATE POLICY "Participants can delete own votes"
ON public.challenge_votes
FOR DELETE
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM game_participants
    WHERE game_participants.id = challenge_votes.voter_participant_id
    AND game_participants.session_id = challenge_votes.session_id
  )
);

-- Enable realtime for votes
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_votes;