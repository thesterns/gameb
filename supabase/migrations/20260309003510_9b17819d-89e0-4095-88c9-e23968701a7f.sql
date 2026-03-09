CREATE OR REPLACE FUNCTION public.resolve_majority_scores(p_session_id uuid, p_question_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_host_user_id uuid;
  v_double_points boolean := false;
  v_point_value integer := 10;
  v_max_count integer;
BEGIN
  -- Verify caller is the host
  SELECT host_user_id INTO v_host_user_id
  FROM game_sessions WHERE id = p_session_id;

  IF v_host_user_id IS NULL OR v_host_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the host can resolve scores';
  END IF;

  -- Check if question has double points
  SELECT COALESCE(qn.double_points, false) INTO v_double_points
  FROM questions qn WHERE qn.id = p_question_id;
  
  v_point_value := CASE WHEN v_double_points THEN 20 ELSE 10 END;

  -- Find the maximum vote count for any answer
  SELECT COALESCE(MAX(cnt), 0) INTO v_max_count
  FROM (
    SELECT answer_id, COUNT(*) as cnt
    FROM game_responses
    WHERE session_id = p_session_id AND question_id = p_question_id AND answer_id IS NOT NULL
    GROUP BY answer_id
  ) sub;

  IF v_max_count = 0 THEN
    RETURN;
  END IF;

  -- Update all responses: correct if their answer has max count
  UPDATE game_responses gr
  SET is_correct = (
    SELECT COUNT(*) FROM game_responses gr2 
    WHERE gr2.session_id = p_session_id 
      AND gr2.question_id = p_question_id 
      AND gr2.answer_id = gr.answer_id
  ) = v_max_count,
  score = CASE 
    WHEN (
      SELECT COUNT(*) FROM game_responses gr2 
      WHERE gr2.session_id = p_session_id 
        AND gr2.question_id = p_question_id 
        AND gr2.answer_id = gr.answer_id
    ) = v_max_count THEN v_point_value 
    ELSE 0 
  END
  WHERE gr.session_id = p_session_id AND gr.question_id = p_question_id;
END;
$$;