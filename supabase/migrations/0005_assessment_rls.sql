GRANT SELECT ON public.content_packs TO authenticated;
GRANT SELECT ON public.skills TO authenticated;
GRANT SELECT ON public.concepts TO authenticated;
GRANT SELECT ON public.concept_edges TO authenticated;
GRANT SELECT ON public.items TO authenticated;
GRANT SELECT ON public.item_concepts TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.level_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_skill_state TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_concept_state TO authenticated;

DROP POLICY IF EXISTS content_packs_read ON public.content_packs;
CREATE POLICY content_packs_read ON public.content_packs
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS skills_read ON public.skills;
CREATE POLICY skills_read ON public.skills
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS concepts_read ON public.concepts;
CREATE POLICY concepts_read ON public.concepts
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS concept_edges_read ON public.concept_edges;
CREATE POLICY concept_edges_read ON public.concept_edges
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS items_read ON public.items;
CREATE POLICY items_read ON public.items
  FOR SELECT TO authenticated
  USING (
    review_status = 'approved'
    AND retired_at IS NULL
    AND (owner_user_id IS NULL OR owner_user_id = auth.uid())
  );

DROP POLICY IF EXISTS item_concepts_read ON public.item_concepts;
CREATE POLICY item_concepts_read ON public.item_concepts
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS assessments_owner ON public.assessments;
CREATE POLICY assessments_owner ON public.assessments
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS assessment_scores_owner ON public.assessment_scores;
CREATE POLICY assessment_scores_owner ON public.assessment_scores
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_id AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS level_events_owner ON public.level_events;
CREATE POLICY level_events_owner ON public.level_events
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_skill_state_owner ON public.user_skill_state;
CREATE POLICY user_skill_state_owner ON public.user_skill_state
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_concept_state_owner ON public.user_concept_state;
CREATE POLICY user_concept_state_owner ON public.user_concept_state
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
