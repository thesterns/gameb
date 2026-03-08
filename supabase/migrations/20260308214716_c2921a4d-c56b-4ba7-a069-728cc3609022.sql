-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Users can manage dimension items of own challenges" ON public.challenge_dimension_items;

CREATE POLICY "Users can manage dimension items of own challenges"
ON public.challenge_dimension_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM challenges
    WHERE challenges.id = challenge_dimension_items.challenge_id
    AND challenges.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM challenges
    WHERE challenges.id = challenge_dimension_items.challenge_id
    AND challenges.user_id = auth.uid()
  )
);