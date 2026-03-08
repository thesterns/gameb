
-- 1. Create submit_answer SECURITY DEFINER function
-- Players call this instead of direct INSERT. It computes is_correct and score server-side.
CREATE OR REPLACE FUNCTION public.submit_answer(
  p_session_id uuid,
  p_participant_id uuid,
  p_question_id uuid,
  p_answer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_is_correct boolean := false;
  v_score integer := 0;
  v_is_king boolean := false;
  v_quiz_mode text;
BEGIN
  -- Validate session exists and is active
  SELECT gs.status, gs.king_participant_id, q.mode
  INTO v_session
  FROM game_sessions gs
  JOIN quizzes q ON q.id = gs.quiz_id
  WHERE gs.id = p_session_id;

  IF NOT FOUND OR v_session.status != 'active' THEN
    RETURN jsonb_build_object('error', 'Session not active');
  END IF;

  v_quiz_mode := v_session.mode;
  v_is_king := (v_session.king_participant_id = p_participant_id);

  -- Validate participant belongs to this session
  IF NOT EXISTS (
    SELECT 1 FROM game_participants WHERE id = p_participant_id AND session_id = p_session_id
  ) THEN
    RETURN jsonb_build_object('error', 'Invalid participant');
  END IF;

  -- Prevent duplicate answers
  IF EXISTS (
    SELECT 1 FROM game_responses
    WHERE session_id = p_session_id AND participant_id = p_participant_id AND question_id = p_question_id
  ) THEN
    RETURN jsonb_build_object('error', 'Already answered');
  END IF;

  -- For genius mode, compute correctness from the answer table
  IF v_quiz_mode = 'genius' THEN
    SELECT a.is_correct INTO v_is_correct
    FROM answers a WHERE a.id = p_answer_id AND a.question_id = p_question_id;
    
    IF v_is_correct IS NULL THEN
      v_is_correct := false;
    END IF;
    v_score := CASE WHEN v_is_correct THEN 10 ELSE 0 END;
  ELSE
    -- King/tribe mode: store with score=0, will be resolved later
    v_is_correct := false;
    v_score := 0;
  END IF;

  INSERT INTO game_responses (session_id, participant_id, question_id, answer_id, is_correct, score)
  VALUES (p_session_id, p_participant_id, p_question_id, p_answer_id, v_is_correct, v_score);

  RETURN jsonb_build_object('is_correct', v_is_correct, 'score', v_score);
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.submit_answer TO anon;
GRANT EXECUTE ON FUNCTION public.submit_answer TO authenticated;

-- 2. Create resolve_king_scores SECURITY DEFINER function
-- Host calls this to resolve scores in king/tribe mode
CREATE OR REPLACE FUNCTION public.resolve_king_scores(
  p_session_id uuid,
  p_question_id uuid,
  p_king_participant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correct_answer_id uuid;
  v_host_user_id uuid;
BEGIN
  -- Verify caller is the host
  SELECT host_user_id INTO v_host_user_id
  FROM game_sessions WHERE id = p_session_id;

  IF v_host_user_id IS NULL OR v_host_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the host can resolve scores';
  END IF;

  -- Get king's chosen answer
  SELECT answer_id INTO v_correct_answer_id
  FROM game_responses
  WHERE session_id = p_session_id
    AND question_id = p_question_id
    AND participant_id = p_king_participant_id;

  IF v_correct_answer_id IS NULL THEN
    RETURN;
  END IF;

  -- Update all non-king responses
  UPDATE game_responses
  SET is_correct = (answer_id = v_correct_answer_id),
      score = CASE WHEN answer_id = v_correct_answer_id THEN 10 ELSE 0 END
  WHERE session_id = p_session_id
    AND question_id = p_question_id
    AND participant_id != p_king_participant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_king_scores TO authenticated;

-- 3. Drop the open UPDATE policy
DROP POLICY IF EXISTS "Anyone can update responses" ON public.game_responses;

-- 4. Drop the open INSERT policy and replace with a restricted one
DROP POLICY IF EXISTS "Anyone can insert responses" ON public.game_responses;

-- Only allow inserts with score=0 and is_correct=false (as a safety net; main path is via RPC)
CREATE POLICY "Restricted insert responses"
ON public.game_responses FOR INSERT
WITH CHECK (score = 0 AND is_correct = false);

-- 5. Fix storage DELETE policy
DROP POLICY IF EXISTS "Authenticated users can delete question images" ON storage.objects;

CREATE POLICY "Users can delete own question images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'question-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
