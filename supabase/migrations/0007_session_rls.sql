GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_items TO authenticated;
GRANT SELECT, INSERT ON public.attempts TO authenticated;
GRANT SELECT, INSERT ON public.error_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_phrases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.srs_cards TO authenticated;
GRANT SELECT, INSERT ON public.srs_reviews TO authenticated;

DROP POLICY IF EXISTS sessions_owner ON public.sessions;
CREATE POLICY sessions_owner ON public.sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS session_items_owner ON public.session_items;
CREATE POLICY session_items_owner ON public.session_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS attempts_read ON public.attempts;
CREATE POLICY attempts_read ON public.attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS attempts_append ON public.attempts;
CREATE POLICY attempts_append ON public.attempts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS error_events_read ON public.error_events;
CREATE POLICY error_events_read ON public.error_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS error_events_append ON public.error_events;
CREATE POLICY error_events_append ON public.error_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS saved_phrases_owner ON public.saved_phrases;
CREATE POLICY saved_phrases_owner ON public.saved_phrases
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS srs_cards_owner ON public.srs_cards;
CREATE POLICY srs_cards_owner ON public.srs_cards
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS srs_reviews_read ON public.srs_reviews;
CREATE POLICY srs_reviews_read ON public.srs_reviews
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.srs_cards c
      WHERE c.id = card_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS srs_reviews_append ON public.srs_reviews;
CREATE POLICY srs_reviews_append ON public.srs_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.srs_cards c
      WHERE c.id = card_id AND c.user_id = auth.uid()
    )
  );
