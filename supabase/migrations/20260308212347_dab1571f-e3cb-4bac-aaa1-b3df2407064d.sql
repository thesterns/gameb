
ALTER TABLE public.game_sessions ALTER COLUMN quiz_id DROP NOT NULL;
ALTER TABLE public.game_sessions ADD COLUMN challenge_id UUID REFERENCES public.challenges(id);
