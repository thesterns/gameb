-- Allow participants to update their own sentences
CREATE POLICY "Participants can update own sentence"
ON public.challenge_sentences
FOR UPDATE
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM game_participants
    WHERE game_participants.id = challenge_sentences.participant_id
    AND game_participants.session_id = challenge_sentences.session_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM game_participants
    WHERE game_participants.id = challenge_sentences.participant_id
    AND game_participants.session_id = challenge_sentences.session_id
  )
);