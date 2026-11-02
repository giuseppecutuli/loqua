GRANT SELECT, INSERT ON public.xp_events TO authenticated;

DROP POLICY IF EXISTS xp_events_read ON public.xp_events;
CREATE POLICY xp_events_read ON public.xp_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS xp_events_append ON public.xp_events;
CREATE POLICY xp_events_append ON public.xp_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
