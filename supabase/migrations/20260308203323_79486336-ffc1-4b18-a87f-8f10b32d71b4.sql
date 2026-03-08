
-- Add per-question settings: double points and custom time
ALTER TABLE public.questions ADD COLUMN double_points boolean NOT NULL DEFAULT false;
ALTER TABLE public.questions ADD COLUMN custom_time integer DEFAULT NULL;

-- Update submit_answer to handle double points
CREATE OR REPLACE FUNCTION public.submit_answer(p_session_id uuid, p_participant_id uuid, p_question_id uuid, p_answer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session record;
  v_is_correct boolean := false;
  v_score integer := 0;
  v_is_king boolean := false;
  v_quiz_mode text;
  v_double_points boolean := false;
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

  -- Check if question has double points
  SELECT COALESCE(qn.double_points, false) INTO v_double_points
  FROM questions qn WHERE qn.id = p_question_id;

  -- For genius mode, compute correctness from the answer table
  IF v_quiz_mode = 'genius' THEN
    SELECT a.is_correct INTO v_is_correct
    FROM answers a WHERE a.id = p_answer_id AND a.question_id = p_question_id;
    
    IF v_is_correct IS NULL THEN
      v_is_correct := false;
    END IF;
    v_score := CASE WHEN v_is_correct THEN (CASE WHEN v_double_points THEN 20 ELSE 10 END) ELSE 0 END;
  ELSE
    -- King/tribe mode: store with score=0, will be resolved later
    v_is_correct := false;
    v_score := 0;
  END IF;

  INSERT INTO game_responses (session_id, participant_id, question_id, answer_id, is_correct, score)
  VALUES (p_session_id, p_participant_id, p_question_id, p_answer_id, v_is_correct, v_score);

  RETURN jsonb_build_object('is_correct', v_is_correct, 'score', v_score);
END;
$function$;

-- Update resolve_king_scores to handle double points
CREATE OR REPLACE FUNCTION public.resolve_king_scores(p_session_id uuid, p_question_id uuid, p_king_participant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_correct_answer_id uuid;
  v_host_user_id uuid;
  v_double_points boolean := false;
  v_point_value integer := 10;
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
      score = CASE WHEN answer_id = v_correct_answer_id THEN v_point_value ELSE 0 END
  WHERE session_id = p_session_id
    AND question_id = p_question_id
    AND participant_id != p_king_participant_id;
END;
$function$;
