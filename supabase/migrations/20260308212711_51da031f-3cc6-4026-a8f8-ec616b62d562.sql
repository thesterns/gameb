
CREATE TABLE public.participant_dimension_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.game_participants(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  value TEXT NOT NULL
);

ALTER TABLE public.participant_dimension_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read assignments of active games"
  ON public.participant_dimension_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE game_sessions.id = participant_dimension_assignments.session_id
    AND game_sessions.status IN ('active', 'finished')
  ));

CREATE POLICY "Host can insert assignments"
  ON public.participant_dimension_assignments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE game_sessions.id = participant_dimension_assignments.session_id
    AND game_sessions.host_user_id = auth.uid()
  ));
