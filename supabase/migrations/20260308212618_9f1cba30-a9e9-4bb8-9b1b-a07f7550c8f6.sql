
CREATE POLICY "Anyone can read challenges of active games"
  ON public.challenges FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE game_sessions.challenge_id = challenges.id
    AND game_sessions.status IN ('lobby', 'active')
  ));
