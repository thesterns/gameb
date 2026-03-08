
CREATE TABLE public.challenge_dimension_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.challenge_dimension_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage dimension items of own challenges"
  ON public.challenge_dimension_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.challenges WHERE challenges.id = challenge_dimension_items.challenge_id AND challenges.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.challenges WHERE challenges.id = challenge_dimension_items.challenge_id AND challenges.user_id = auth.uid()
  ));
