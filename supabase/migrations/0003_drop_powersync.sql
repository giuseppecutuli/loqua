DROP PUBLICATION IF EXISTS powersync;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'powersync_role') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM powersync_role';
    EXECUTE 'DROP OWNED BY powersync_role';
    EXECUTE 'DROP ROLE powersync_role';
  END IF;
END;
$$;
