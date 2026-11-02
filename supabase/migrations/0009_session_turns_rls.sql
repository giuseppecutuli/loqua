GRANT SELECT, INSERT, DELETE ON public.session_turns TO authenticated;

DROP POLICY IF EXISTS session_turns_read ON public.session_turns;
CREATE POLICY session_turns_read ON public.session_turns
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS session_turns_append ON public.session_turns;
CREATE POLICY session_turns_append ON public.session_turns
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS session_turns_delete ON public.session_turns;
CREATE POLICY session_turns_delete ON public.session_turns
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );
