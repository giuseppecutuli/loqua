GRANT SELECT, INSERT, UPDATE ON public.scheduled_notifications TO authenticated;
GRANT SELECT, INSERT ON public.product_events TO authenticated;

DROP POLICY IF EXISTS scheduled_notifications_owner ON public.scheduled_notifications;
CREATE POLICY scheduled_notifications_owner ON public.scheduled_notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS product_events_append ON public.product_events;
CREATE POLICY product_events_append ON public.product_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS product_events_read ON public.product_events;
CREATE POLICY product_events_read ON public.product_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
