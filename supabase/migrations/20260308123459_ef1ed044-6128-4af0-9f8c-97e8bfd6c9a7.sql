
DROP POLICY "Anyone can join a game" ON public.game_participants;
CREATE POLICY "Anyone can join a lobby game"
  ON public.game_participants FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.game_sessions
      WHERE game_sessions.id = session_id AND game_sessions.status = 'lobby'
    )
  );
