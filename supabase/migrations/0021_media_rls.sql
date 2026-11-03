GRANT SELECT ON public.media_titles TO authenticated;
GRANT SELECT ON public.media_title_tags TO authenticated;
GRANT SELECT ON public.media_availability TO authenticated;
GRANT SELECT ON public.media_phrases TO authenticated;

DROP POLICY IF EXISTS media_titles_read ON public.media_titles;
CREATE POLICY media_titles_read ON public.media_titles
  FOR SELECT TO authenticated
  USING (review_status = 'approved');

DROP POLICY IF EXISTS media_title_tags_read ON public.media_title_tags;
CREATE POLICY media_title_tags_read ON public.media_title_tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.media_titles m
      WHERE m.id = media_id AND m.review_status = 'approved'
    )
  );

DROP POLICY IF EXISTS media_availability_read ON public.media_availability;
CREATE POLICY media_availability_read ON public.media_availability
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.media_titles m
      WHERE m.id = media_id AND m.review_status = 'approved'
    )
  );

DROP POLICY IF EXISTS media_phrases_read ON public.media_phrases;
CREATE POLICY media_phrases_read ON public.media_phrases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.media_titles m
      WHERE m.id = media_id AND m.review_status = 'approved'
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.media_guides TO authenticated;

DROP POLICY IF EXISTS media_guides_read ON public.media_guides;
CREATE POLICY media_guides_read ON public.media_guides
  FOR SELECT TO authenticated
  USING (
    profile_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.learner_profiles p
      WHERE p.id = profile_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS media_guides_insert ON public.media_guides;
CREATE POLICY media_guides_insert ON public.media_guides
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.learner_profiles p
      WHERE p.id = profile_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS media_guides_update ON public.media_guides;
CREATE POLICY media_guides_update ON public.media_guides
  FOR UPDATE TO authenticated
  USING (
    profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.learner_profiles p
      WHERE p.id = profile_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.learner_profiles p
      WHERE p.id = profile_id AND p.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_taste_profile TO authenticated;

DROP POLICY IF EXISTS user_taste_profile_owner ON public.user_taste_profile;
CREATE POLICY user_taste_profile_owner ON public.user_taste_profile
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.learner_profiles p
      WHERE p.id = profile_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.learner_profiles p
      WHERE p.id = profile_id AND p.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendation_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_progress TO authenticated;

DROP POLICY IF EXISTS recommendations_owner ON public.recommendations;
CREATE POLICY recommendations_owner ON public.recommendations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS recommendation_feedback_owner ON public.recommendation_feedback;
CREATE POLICY recommendation_feedback_owner ON public.recommendation_feedback
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS media_progress_owner ON public.media_progress;
CREATE POLICY media_progress_owner ON public.media_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
