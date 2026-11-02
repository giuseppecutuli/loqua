GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

DROP POLICY IF EXISTS users_owner ON public.users;
CREATE POLICY users_owner ON public.users
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS devices_owner ON public.devices;
CREATE POLICY devices_owner ON public.devices
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS learner_profiles_owner ON public.learner_profiles;
CREATE POLICY learner_profiles_owner ON public.learner_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS consents_owner ON public.consents;
CREATE POLICY consents_owner ON public.consents
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS settings_owner ON public.settings;
CREATE POLICY settings_owner ON public.settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS sync_state_owner ON public.sync_state;
CREATE POLICY sync_state_owner ON public.sync_state
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS sync_conflict_log_owner ON public.sync_conflict_log;
CREATE POLICY sync_conflict_log_owner ON public.sync_conflict_log
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS backup_meta_owner ON public.backup_meta;
CREATE POLICY backup_meta_owner ON public.backup_meta
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, ui_locale, created_at, updated_at)
  VALUES (NEW.id, NEW.email, 'it', now(), now())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
