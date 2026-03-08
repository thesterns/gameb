CREATE POLICY "Anyone can read quizzes of active games"
ON public.quizzes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM game_sessions
    WHERE game_sessions.quiz_id = quizzes.id
    AND game_sessions.status IN ('lobby', 'active')
  )
);