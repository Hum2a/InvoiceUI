-- Additive migration creating the unprivileged application role for non-bypassed Row Level Security.
-- In Neon, the default connection role (neondb_owner) has BYPASSRLS.
-- This unprivileged role (invoiceui_app) has NOBYPASSRLS so PostgreSQL enforces RLS on every transaction.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'invoiceui_app') THEN
    CREATE ROLE invoiceui_app NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

GRANT ALL ON TABLE invoice_workspaces TO invoiceui_app;
GRANT ALL ON TABLE invoice_webhook_events TO invoiceui_app;
GRANT ALL ON TABLE auth_user, auth_session, auth_account, auth_verification, auth_rate_limit TO invoiceui_app;
GRANT USAGE ON SCHEMA public TO invoiceui_app;
GRANT invoiceui_app TO CURRENT_USER;
