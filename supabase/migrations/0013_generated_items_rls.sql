GRANT INSERT ON public.items TO authenticated;
GRANT INSERT, UPDATE ON public.item_concepts TO authenticated;

DROP POLICY IF EXISTS items_read ON public.items;
CREATE POLICY items_read ON public.items
  FOR SELECT TO authenticated
  USING (
    (
      review_status = 'approved'
      AND retired_at IS NULL
      AND (owner_user_id IS NULL OR owner_user_id = auth.uid())
    )
    OR (
      owner_user_id = auth.uid()
      AND review_status = 'pending'
      AND auto_validated = true
      AND expires_at > now()
      AND retired_at IS NULL
    )
  );

DROP POLICY IF EXISTS items_insert_generated ON public.items;
CREATE POLICY items_insert_generated ON public.items
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND source = 'generated'
    AND review_status = 'pending'
    AND auto_validated = true
    AND expires_at IS NOT NULL
  );

DROP POLICY IF EXISTS item_concepts_insert_generated ON public.item_concepts;
CREATE POLICY item_concepts_insert_generated ON public.item_concepts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.items i
      WHERE i.id = item_id
        AND i.owner_user_id = auth.uid()
        AND i.source = 'generated'
    )
  );
