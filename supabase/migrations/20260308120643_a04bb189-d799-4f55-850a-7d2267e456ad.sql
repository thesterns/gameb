
-- Quizzes table
CREATE TABLE public.quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quizzes" ON public.quizzes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create own quizzes" ON public.quizzes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quizzes" ON public.quizzes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quizzes" ON public.quizzes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Questions table
CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage questions of own quizzes" ON public.questions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes WHERE quizzes.id = questions.quiz_id AND quizzes.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes WHERE quizzes.id = questions.quiz_id AND quizzes.user_id = auth.uid()));

-- Answers table
CREATE TABLE public.answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage answers of own quizzes" ON public.answers
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.questions
    JOIN public.quizzes ON quizzes.id = questions.quiz_id
    WHERE questions.id = answers.question_id AND quizzes.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.questions
    JOIN public.quizzes ON quizzes.id = questions.quiz_id
    WHERE questions.id = answers.question_id AND quizzes.user_id = auth.uid()
  ));
