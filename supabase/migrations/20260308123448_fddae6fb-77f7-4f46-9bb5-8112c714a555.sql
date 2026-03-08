
CREATE TABLE public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  host_user_id uuid NOT NULL,
  join_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'lobby',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Host can do everything with their sessions
CREATE POLICY "Host can manage own sessions"
  ON public.game_sessions FOR ALL TO authenticated
  USING (host_user_id = auth.uid())
  WITH CHECK (host_user_id = auth.uid());

-- Anyone can read a session by join_code (for joining)
CREATE POLICY "Anyone can read sessions by join code"
  ON public.game_sessions FOR SELECT TO anon
  USING (true);

CREATE TABLE public.game_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_participants ENABLE ROW LEVEL SECURITY;

-- Anyone can join (insert) a game
CREATE POLICY "Anyone can join a game"
  ON public.game_participants FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Anyone can read participants of a session
CREATE POLICY "Anyone can read participants"
  ON public.game_participants FOR SELECT TO anon, authenticated
  USING (true);

-- Enable realtime for participants
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
