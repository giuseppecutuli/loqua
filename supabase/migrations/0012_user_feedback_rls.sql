GRANT SELECT, INSERT ON public.user_feedback TO authenticated;

DROP POLICY IF EXISTS user_feedback_read ON public.user_feedback;
CREATE POLICY user_feedback_read ON public.user_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_feedback_append ON public.user_feedback;
CREATE POLICY user_feedback_append ON public.user_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
